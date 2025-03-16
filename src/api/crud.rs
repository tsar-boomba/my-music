use axum::{extract, Json};
use axum_extra::extract::CookieJar;

use crate::{
    db::{Song, Source},
    ApiError,
};

use super::{
    auth::{authenticate, AUTH_COOKIE},
    State,
};

pub async fn get_songs(
    extract::State(state): extract::State<State>,
    cookies: CookieJar,
) -> Result<Json<Vec<Song>>, ApiError> {
    let _user = authenticate(&state, cookies.get(AUTH_COOKIE)).await?;
    Ok(Json(Song::get_all(&state.sqlite).await?))
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
