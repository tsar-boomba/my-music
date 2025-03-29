use axum::{extract, Json};
use axum_extra::extract::CookieJar;
use serde::Deserialize;

use crate::{
    db::{song::SongWTags, source::{AlbumSource, SongSource}, Song, Source, Tag, User},
    ApiError,
};

use super::{
    auth::{authenticate, AUTH_COOKIE},
    State,
};

pub async fn get_songs(
    extract::State(state): extract::State<State>,
    cookies: CookieJar,
) -> Result<Json<Vec<SongWTags>>, ApiError> {
    let _user = authenticate(&state, cookies.get(AUTH_COOKIE)).await?;
    Ok(Json(Song::get_all_with_tags(&state.sqlite).await?))
}

pub async fn get_sources_for_song(
    extract::Path(song_id): extract::Path<i64>,
    extract::State(state): extract::State<State>,
    cookies: CookieJar,
) -> Result<Json<Vec<Source>>, ApiError> {
    let _user = authenticate(&state, cookies.get(AUTH_COOKIE)).await?;
    Ok(Json(Source::for_song(song_id, &state.sqlite).await?))
}

pub async fn get_sources(
    extract::State(state): extract::State<State>,
    cookies: CookieJar,
) -> Result<Json<Vec<Source>>, ApiError> {
    let _user = authenticate(&state, cookies.get(AUTH_COOKIE)).await?;
    Ok(Json(Source::get_all(&state.sqlite).await?))
}

pub async fn get_all_sources_for_songs(
    extract::State(state): extract::State<State>,
    cookies: CookieJar,
) -> Result<Json<Vec<SongSource>>, ApiError> {
    let _user = authenticate(&state, cookies.get(AUTH_COOKIE)).await?;
    Ok(Json(Source::get_all_for_songs(&state.sqlite).await?))
}

pub async fn get_all_sources_for_albums(
    extract::State(state): extract::State<State>,
    cookies: CookieJar,
) -> Result<Json<Vec<AlbumSource>>, ApiError> {
    let _user = authenticate(&state, cookies.get(AUTH_COOKIE)).await?;
    Ok(Json(Source::get_all_for_albums(&state.sqlite).await?))
}

pub async fn delete_song(
    extract::Path(song_id): extract::Path<i64>,
    extract::State(state): extract::State<State>,
    cookies: CookieJar,
) -> Result<(), ApiError> {
    let user = authenticate(&state, cookies.get(AUTH_COOKIE)).await?;
    if !user.admin {
        return Err(ApiError::Unauthorized);
    }

    Song::delete_w_sources(song_id, &state.sqlite).await?;
    Ok(())
}

pub async fn get_users(
    extract::State(state): extract::State<State>,
    cookies: CookieJar,
) -> Result<Json<Vec<User>>, ApiError> {
    let user = authenticate(&state, cookies.get(AUTH_COOKIE)).await?;
    if !user.admin {
        return Err(ApiError::Unauthorized);
    }

    Ok(Json(User::get_all(&state.sqlite).await?))
}

#[derive(Debug, Deserialize)]
pub struct NewUser {
    username: String,
    password: String,
    #[serde(default)]
    admin: bool,
}

pub async fn create_user(
    extract::State(state): extract::State<State>,
    cookies: CookieJar,
    Json(new_user): Json<NewUser>,
) -> Result<(), ApiError> {
    let user = authenticate(&state, cookies.get(AUTH_COOKIE)).await?;
    if !user.admin {
        return Err(ApiError::Unauthorized);
    }

    User::insert_new(
        &new_user.username,
        &new_user.password,
        new_user.admin,
        &state.sqlite,
    )
    .await?;

    Ok(())
}

pub async fn get_tags(
    extract::State(state): extract::State<State>,
    cookies: CookieJar,
) -> Result<Json<Vec<Tag>>, ApiError> {
    let _user = authenticate(&state, cookies.get(AUTH_COOKIE)).await?;

    Ok(Json(Tag::get_all(&state.sqlite).await?))
}
