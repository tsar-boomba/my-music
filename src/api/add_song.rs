use std::{io::Cursor, sync::Arc};

use axum::{
    body::Bytes,
    extract::{self, ws::WebSocket},
    response::Response,
};
use axum_extra::extract::CookieJar;
use serde::{Deserialize, Serialize};
use symphonia::core::{
    formats::FormatOptions,
    io::MediaSourceStream,
    meta::{MetadataOptions, MetadataRevision, StandardTagKey, StandardVisualKey, Tag, Visual},
    probe::Hint,
};

use crate::{
    db::{Album, Artist, Song, StorageBackend, User},
    ApiError,
};

use super::{
    auth::{self, AUTH_COOKIE},
    State,
};

pub async fn handler(
    extract::State(state): extract::State<State>,
    cookies: CookieJar,
    ws: extract::WebSocketUpgrade,
) -> Result<Response, ApiError> {
    let user = auth::authenticate(&state, cookies.get(AUTH_COOKIE)).await?;
    if !user.admin {
        return Err(ApiError::Unauthorized);
    }

    Ok(ws
        .max_frame_size(128 * 1024 * 1024)
        .on_upgrade(move |ws| async move {
            let state = state;
            let user = user;
            tokio::spawn(async move {
                if let Err(err) = handle_ws(ws, state, user).await {
                    tracing::error!("error handling WS: {err:?}");
                }
            });
        }))
}

const ALLOWED_MIME_TYPES: [&str; 3] = ["audio/flac", "audio/mp3", "audio/mpeg"];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UploadInfo {
    name: Arc<str>,
    #[allow(unused)]
    size: usize,
    #[serde(rename = "type")]
    mime_type: Arc<str>,
}

#[derive(Debug)]
struct ParsedMetadata {
    title: Option<Arc<str>>,
    album: Option<Arc<str>>,
    artists: Vec<Arc<str>>,
    album_cover: Option<Arc<Visual>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClientMetadata {
    title: Option<Arc<str>>,
    album: Option<Arc<str>>,
    artists: Vec<Arc<str>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FinalMetadata {
    title: Arc<str>,
    album: Option<Arc<str>>,
    artists: Arc<[Box<str>]>,
    #[serde(default = "default_storage_backend_name")]
    storage_backend: Arc<str>,
}

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct AddSongResult {
    created_album: Option<bool>,
    added_album: Option<bool>,
    created_artists: Option<bool>,
    added_artists: Option<bool>,
}

#[derive(Debug, Serialize)]
struct Error {
    error: String,
}

/// 1. Client sends metadata on songs they want to upload
/// 2. We verify the metadata
/// 3. For each song to be uploaded
/// 	1. The client sends the file
/// 	2. We parse metadata in the file and send back to client
/// 	3. Client sends back final metadata for file
/// 	4. We save the file in a storage backend and in the database
/// 4.
async fn handle_ws(mut ws: WebSocket, state: State, _user: User) -> Result<(), ApiError> {
    let info_str = ws
        .recv()
        .await
        .ok_or(ApiError::InvalidWSMessage)??
        .into_text()?;
    let info: Box<[Arc<UploadInfo>]> = serde_json::from_str(&info_str)?;

    tracing::debug!("Uploading: {info:#?}");

    for info in &info {
        if !ALLOWED_MIME_TYPES.contains(&&*info.mime_type) {
            return close_with_error(ws, format!("Invalid mime type: {}", info.mime_type)).await;
        }
    }

    for song in info {
        // Client sends song data up
        let song_data = ws
            .recv()
            .await
            .ok_or(ApiError::InvalidWSMessage)??
            .into_data();

        // We parse metadata from song and send back to client
        let parsed_meta = tokio::task::spawn_blocking({
            let song_data = song_data.clone();
            let song = song.clone();
            move || get_metadata(song_data, &song)
        })
        .await
        .unwrap()?;
        tracing::debug!(
            "Parsed meta from song: {:?} from {:?} by {:?}. album_cover? {}",
            parsed_meta.title.as_deref().unwrap_or_default(),
            parsed_meta.album.as_deref().unwrap_or_default(),
            parsed_meta.artists,
            parsed_meta.album_cover.is_some()
        );
        ws.send(extract::ws::Message::Text(
            serde_json::to_string(&ClientMetadata {
                album: parsed_meta.album.clone(),
                artists: parsed_meta.artists.clone(),
                title: parsed_meta.title.clone(),
            })?
            .into(),
        ))
        .await?;

        // Client sends back final data for saving song, allow redoing this until successful
        loop {
            let final_meta_str = ws
                .recv()
                .await
                .ok_or(ApiError::InvalidWSMessage)??
                .into_text()?;
            let final_meta: FinalMetadata = serde_json::from_str(&final_meta_str)?;
            tracing::debug!("Got final meta: {final_meta:#?}");

            let res = match add_song(
                state.clone(),
                song_data.clone(),
                song.mime_type.clone(),
                final_meta,
                parsed_meta.album_cover.clone(),
            )
            .await
            {
                Ok(res) => res,
                Err(err) => {
                    // Failed to add song, inform client and let them send final meta again
                    ws.send(extract::ws::Message::Text(
                        serde_json::to_string(&Error {
                            error: format!("{err:?}"),
                        })?
                        .into(),
                    ))
                    .await?;
                    continue;
                }
            };

            // We added the song successfully, break this loop and move onto next song
            ws.send(extract::ws::Message::Text(
                serde_json::to_string(&res).unwrap().into(),
            ))
            .await?;
            break;
        }
    }

    ws.send(extract::ws::Message::Close(None)).await?;
    Ok(())
}

async fn add_song(
    state: State,
    song_data: Bytes,
    mime_type: Arc<str>,
    final_meta: FinalMetadata,
    album_cover: Option<Arc<Visual>>,
) -> Result<AddSongResult, ApiError> {
    let storage_backend = StorageBackend::get_by_name(&final_meta.storage_backend, &state.sqlite)
        .await?
        .ok_or(ApiError::NotFound)?;
    let operator = storage_backend.operator().await?;
    let path = format!(
        "songs/{}-{}.{}",
        final_meta.title,
        chrono::Utc::now().timestamp(),
        mime_type.split_once("/").unwrap().1
    );

    let song_id = Song::insert_w_source(
        &final_meta.title,
        &path,
        &mime_type,
        &final_meta.storage_backend,
        &state.sqlite,
    )
    .await?;
    let _ = operator.write(&path, song_data).await?;
    let mut res = AddSongResult::default();

    // Create & add album tag to song
    if let Some(album_title) = final_meta.album {
        let album_tag_res = if let Some(_album_cover) = album_cover {
            // TODO: album cover from song metadata, needs some image encoding/decoding stuff and operator
            // Album::insert_w_source(&final_meta.album, path, mime_type, backend, executor)
            Album::insert_w_tag(&album_title, &state.sqlite).await
        } else {
            Album::insert_w_tag(&album_title, &state.sqlite).await
        };

        match album_tag_res {
            Ok(album_tag) => {
                res.created_album = Some(true);
                Song::add_tag(song_id, album_tag, &state.sqlite)
                    .await
                    .inspect(|_| res.added_album = Some(true))
                    .inspect_err(|err| {
                        res.added_album = Some(false);
                        tracing::error!("Error adding album to song: {err:?}")
                    })
                    .ok();
            }
            Err(err) => {
                res.added_album = Some(false);
                tracing::error!("Error creating album: {err:?}");
            }
        }
    }

    // Create and add artist tags to song
    if final_meta.artists.len() > 0 {
        let artists_slice = final_meta.artists.iter().map(|s| &**s).collect::<Vec<_>>();
        match Artist::insert_w_tags(&artists_slice, &state.sqlite).await {
            Ok(tags) => {
                res.created_artists = Some(true);
                Song::add_tags(song_id, tags, &state.sqlite)
                    .await
                    .inspect(|_| res.added_artists = Some(true))
                    .inspect_err(|err| {
                        res.added_artists = Some(false);
                        tracing::error!("Error adding artists to song: {err:?}")
                    })
                    .ok();
            }
            Err(err) => {
                res.created_artists = Some(false);
                tracing::error!("Error creating artist tags: {err:?}");
            }
        };
    }

    Ok(res)
}

async fn close_with_error(mut ws: WebSocket, error: String) -> Result<(), ApiError> {
    ws.send(extract::ws::Message::Text(
        serde_json::to_string(&Error { error })?.into(),
    ))
    .await?;
    ws.send(extract::ws::Message::Close(None))
        .await
        .map_err(Into::into)
}

fn get_metadata(song: Bytes, info: &UploadInfo) -> Result<ParsedMetadata, ApiError> {
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

fn populate_from_meta(meta: &mut ParsedMetadata, parsed_meta: &MetadataRevision) {
    meta.title = get_string_tag(parsed_meta.tags(), StandardTagKey::TrackTitle).map(Arc::from);
    meta.album = get_string_tag(parsed_meta.tags(), StandardTagKey::Album).map(Arc::from);
    meta.album_cover = parsed_meta
        .visuals()
        .iter()
        .find(|v| {
            v.usage
                .is_some_and(|usage| usage == StandardVisualKey::FrontCover)
        })
        .cloned()
        .map(Arc::new);

    if let Some(artist) = get_string_tag(parsed_meta.tags(), StandardTagKey::Artist).map(Arc::from)
    {
        meta.artists.push(artist);
    }
}

fn get_string_tag(tags: &[Tag], key: StandardTagKey) -> Option<&str> {
    tags.iter()
        .find(|t| t.std_key.is_some_and(|k| k == key))
        .and_then(|t| match &t.value {
            symphonia::core::meta::Value::String(v) => Some(v.as_str()),
            _ => None,
        })
}

fn default_storage_backend_name() -> Arc<str> {
    Arc::from("init")
}
