use std::sync::Arc;

use axum::{
    body::Bytes,
    extract::{self, ws::WebSocket},
    response::Response,
};
use axum_extra::extract::CookieJar;
use serde::{Deserialize, Serialize};

use crate::{
    api::audio::{get_metadata, InitSongInfo},
    db::{self, Album, Artist, Song, StorageBackend, User},
    ApiError,
};

use super::{
    audio::AlbumCover,
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
        .max_write_buffer_size(128 * 1024)
        .write_buffer_size(16 * 1024)
        .max_message_size(128 * 1024 * 1024)
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
    let info: Box<[Arc<InitSongInfo>]> = serde_json::from_str(&info_str)?;

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
    album_cover: Option<AlbumCover>,
) -> Result<AddSongResult, ApiError> {
    let storage_backend = StorageBackend::get_by_name(&final_meta.storage_backend, &state.sqlite)
        .await?
        .ok_or(ApiError::NotFound)?;
    let operator = storage_backend.operator().await?;
    let path = format!(
        "songs/{}-{}.{}",
        final_meta.title.replace("/", "~slash~"),
        chrono::Utc::now().timestamp(),
        mime_type.split_once("/").unwrap().1
    );

    // Write to storage backend first since its waaaaaay more likely to fail
    let _ = operator.write(&path, song_data).await?;
    let song_id = Song::insert_w_source(
        &final_meta.title,
        &path,
        &mime_type,
        &final_meta.storage_backend,
        &state.sqlite,
    )
    .await?;
    let mut res = AddSongResult::default();

    // Create & add album tag to song
    if let Some(album_title) = final_meta.album {
        let album_tag_res = if let Some(album_cover) = album_cover {
            // TODO: album cover from song metadata, needs some image encoding/decoding stuff and operator

            let cover_image_mime_type = &*album_cover.mime_type;
            let cover_image_path = format!(
                "images/{}.{}",
                album_title.replace("/", "~slash~"),
                cover_image_mime_type.split_once("/").unwrap().1
            );
            let write_image_res = operator.write(&cover_image_path, album_cover.data).await;
            if let Err(err) = write_image_res {
                Err(db::Error::InsertError(
                    "albums",
                    sqlx::Error::Io(std::io::Error::new(
                        std::io::ErrorKind::Other,
                        format!("couldn't write album cover to backend: {err:?}"),
                    )),
                ))
            } else {
                Album::insert_w_source_and_tag(
                    &album_title,
                    &cover_image_path,
                    cover_image_mime_type,
                    &final_meta.storage_backend,
                    &state.sqlite,
                )
                .await
            }
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

fn default_storage_backend_name() -> Arc<str> {
    Arc::from("init")
}
