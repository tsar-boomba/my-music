pub mod add_song;
mod auth;
mod crud;

use std::{
    ops::{Bound, RangeBounds},
    sync::Arc,
    time::Duration,
};

use auth::{authenticate, AUTH_COOKIE};
use axum::{
    body::Body,
    extract,
    response::Response,
    routing::{delete, get, post},
    Router,
};
use axum_extra::extract::CookieJar;
use headers::HeaderMapExt;
use http::{
    header::{ACCEPT_RANGES, CONTENT_RANGE, CONTENT_TYPE},
    HeaderMap, StatusCode,
};
use sqlx::{Pool, Sqlite};

use crate::{config::Config, db::Source, ApiError};

#[derive(Debug, Clone)]
pub struct State {
    config: Arc<Config>,
    sqlite: Pool<Sqlite>,
}

pub fn api_router(config: Arc<Config>, sqlite: Pool<Sqlite>) -> color_eyre::Result<Router> {
    let state = State { config, sqlite };
    let router = Router::new()
        .route("/login", post(auth::login))
        .route("/check-auth", get(auth::check_auth))
        .route("/tags", get(crud::get_tags))
        .route("/add-songs", get(add_song::handler))
        .route("/songs", get(crud::get_songs))
        .route("/songs/{id}", delete(crud::delete_song))
        .route("/songs/{id}/sources", get(crud::get_sources_for_song))
        .route("/songs/sources", get(crud::get_all_sources_for_songs))
        .route("/sources", get(crud::get_sources))
        .route("/sources/{id}/data", get(get_source))
        .route("/users", get(crud::get_users).post(crud::create_user))
        .with_state(state);

    Ok(router)
}

async fn get_source(
    extract::State(state): extract::State<State>,
    extract::Path(source_id): extract::Path<i64>,
    headers: HeaderMap,
    cookies: CookieJar,
) -> Result<Response, ApiError> {
    let _user = authenticate(&state, cookies.get(AUTH_COOKIE)).await?;

    let Some((source, backend)) = Source::get_by_id_w_backend(source_id, &state.sqlite).await?
    else {
        return Err(ApiError::NotFound);
    };

    let operator = backend.operator().await?;
    let meta = operator.stat(&source.path).await?;
    let mut status = StatusCode::OK;
    let range = match headers
        .typed_get::<headers::Range>()
        .and_then(|range| range.satisfiable_ranges(meta.content_length()).next())
    {
        Some(range) => {
            status = StatusCode::PARTIAL_CONTENT;
            range
        }
        None => (Bound::Included(0), Bound::Unbounded),
    };

    let reader = match operator.reader(&source.path).await {
        Ok(reader) => reader,
        Err(err) => match err.kind() {
            opendal::ErrorKind::NotFound => return Err(ApiError::NotFound),
            _ => return Err(err.into()),
        },
    };

    let body = Body::from_stream(reader.into_bytes_stream(range).await?);
    let mut builder = Response::builder()
        .status(status)
        .header(CONTENT_TYPE, &source.mime_type)
        .header(ACCEPT_RANGES, "bytes");

    if status == StatusCode::PARTIAL_CONTENT {
        builder = builder.header(
            CONTENT_RANGE,
            format_content_range_header(range, meta.content_length()),
        )
    }

    let mut res = builder.body(body).unwrap();
    res.headers_mut().typed_insert(
        headers::CacheControl::new()
            .with_immutable()
            .with_private()
            .with_max_age(Duration::from_secs(7 * 24 * 60 * 60)),
    );

    Ok(res)
}

fn format_content_range_header(bounds: impl RangeBounds<u64>, size: u64) -> String {
    match (bounds.start_bound(), bounds.end_bound()) {
        (Bound::Included(start), Bound::Included(end)) => format!("bytes {start}-{end}/{size}"),
        (Bound::Included(start), Bound::Excluded(end)) => {
            format!("bytes {start}-{}/{size}", *end - 1)
        }
        (Bound::Included(start), Bound::Unbounded) => format!("bytes {start}-{}/{size}", size - 1),
        _ => unreachable!("invalid range for content-range header"),
    }
}
