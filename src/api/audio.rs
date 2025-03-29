use std::{io::Cursor, sync::Arc};

use axum::{body::Bytes, extract, Json};
use axum_extra::extract::CookieJar;
use serde::Deserialize;
use symphonia::core::{
    formats::FormatOptions,
    io::MediaSourceStream,
    meta::{MetadataOptions, MetadataRevision, StandardTagKey, StandardVisualKey, Tag},
    probe::Hint,
};

use crate::{
    db::{Album, Song, Source, StorageBackend},
    ApiError,
};

use super::{
    auth::{authenticate, AUTH_COOKIE},
    State,
};

pub const ALLOWED_COVER_IMAGE_MIME_TYPES: [&str; 3] = ["image/jpeg", "image/jpg", "image/png"];

#[derive(Debug)]
pub struct ParsedMetadata {
    pub title: Option<Arc<str>>,
    pub album: Option<Arc<str>>,
    pub artists: Vec<Arc<str>>,
    pub album_cover: Option<AlbumCover>,
}

#[derive(Debug, Clone)]
pub struct AlbumCover {
    pub data: Bytes,
    pub mime_type: Arc<str>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitSongInfo {
    pub name: Arc<str>,
    #[allow(unused)]
    pub size: usize,
    #[serde(rename = "type")]
    pub mime_type: Arc<str>,
}

/// Returns the albums that had their cover populated
pub async fn try_populate_album_covers(
    extract::State(state): extract::State<State>,
    cookies: CookieJar,
) -> Result<Json<Vec<String>>, ApiError> {
    let user = authenticate(&state, cookies.get(AUTH_COOKIE)).await?;
    if !user.admin {
        return Err(ApiError::Unauthorized);
    }

    let albums = Album::get_all(&state.sqlite).await?;
    let songs = Song::get_all_with_tags(&state.sqlite).await?;
    let mut populated = Vec::with_capacity(albums.len());

    for album in albums {
        // get song from op
        let Some(song) = songs.iter().find(|s| s.tags.contains(&album.title)) else {
            tracing::debug!("No song for album {}", album.title);
            continue;
        };
        let Ok(sources) = Source::for_song(song.song.id, &state.sqlite).await else {
            continue;
        };
        let Some(source) = sources.get(0).cloned() else {
            tracing::debug!("song has no sources {}", song.song.title);
            continue;
        };
        let Some(backend) =
            StorageBackend::get_by_name(&source.storage_backend_name, &state.sqlite).await?
        else {
            continue;
        };
        let Ok(operator) = backend.operator().await else {
            continue;
        };
        let song = operator.read(&source.path).await?;
        let Ok(meta) = tokio::task::spawn_blocking(move || {
            get_metadata(
                song.to_bytes(),
                &InitSongInfo {
                    name: Arc::from(""),
                    size: 0,
                    mime_type: Arc::from(source.mime_type.as_str()),
                },
            )
        })
        .await
        .unwrap() else {
            continue;
        };

        let Some(album_cover) = meta.album_cover else {
            tracing::debug!("No cover for {}", album.title);
            continue;
        };
        let cover_image_mime_type = &*album_cover.mime_type;
        let cover_image_path = format!(
            "images/{}.{}",
            album.title,
            cover_image_mime_type.split_once("/").unwrap().1
        )
        .replace("/", "~slash~");
        let write_image_res = operator.write(&cover_image_path, album_cover.data).await;
        if let Err(err) = write_image_res {
            tracing::error!("Error writing album cover to backend: {err:?}");
            continue;
        } else {
            let Ok(_) = Album::insert_w_source_and_tag(
                &album.title,
                &cover_image_path,
                cover_image_mime_type,
                &source.storage_backend_name,
                &state.sqlite,
            )
            .await
            else {
                tracing::error!("Error writing new source to DB");
                continue;
            };
        }

        populated.push(album.title);
    }

    Ok(Json(populated))
}

pub fn get_metadata(song: Bytes, info: &InitSongInfo) -> Result<ParsedMetadata, ApiError> {
    let src = MediaSourceStream::new(Box::new(Cursor::new(song)), Default::default());
    let mut hint = Hint::new();
    hint.mime_type(&info.mime_type);

    // Use the default options for metadata and format readers.
    let meta_opts: MetadataOptions = Default::default();
    let fmt_opts: FormatOptions = Default::default();

    // Probe the media source.
    let mut probed = symphonia::default::get_probe().format(&hint, src, &fmt_opts, &meta_opts)?;

    let mut meta = ParsedMetadata {
        title: Some(info.name.clone()),
        album: None,
        artists: vec![],
        album_cover: None,
    };

    tracing::debug!("tracks: {:?}", probed.format.tracks());
    if let Some(metadata_rev) = probed.format.metadata().current() {
        populate_from_meta(&mut meta, metadata_rev);
    } else if let Some(metadata_rev) = probed.metadata.get().as_ref().and_then(|m| m.current()) {
        populate_from_meta(&mut meta, metadata_rev);
    }

    Ok(meta)
}

pub fn populate_from_meta(meta: &mut ParsedMetadata, parsed_meta: &MetadataRevision) {
    meta.title = get_string_tag(parsed_meta.tags(), StandardTagKey::TrackTitle).map(Arc::from);
    meta.album = get_string_tag(parsed_meta.tags(), StandardTagKey::Album).map(Arc::from);
    meta.album_cover = parsed_meta
        .visuals()
        .iter()
        .find(|v| {
            tracing::debug!("Found visual: {}", v.media_type);
            v.usage
                .is_some_and(|usage| usage == StandardVisualKey::FrontCover)
                && ALLOWED_COVER_IMAGE_MIME_TYPES.contains(&v.media_type.as_str())
                && v.media_type.contains("/")
        })
        .map(|visual| AlbumCover {
            data: Bytes::from(visual.data.clone()),
            mime_type: Arc::from(visual.media_type.as_str()),
        });

    if let Some(artist) = get_string_tag(parsed_meta.tags(), StandardTagKey::Artist).map(Arc::from)
    {
        meta.artists.push(artist);
    }
}

pub fn get_string_tag(tags: &[Tag], key: StandardTagKey) -> Option<&str> {
    tags.iter()
        .find(|t| t.std_key.is_some_and(|k| k == key))
        .and_then(|t| match &t.value {
            symphonia::core::meta::Value::String(v) => Some(v.as_str()),
            _ => None,
        })
}
