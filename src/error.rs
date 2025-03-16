use std::io;

use axum::response::IntoResponse;
use http::StatusCode;
use thiserror::Error;

use crate::db;

#[derive(Debug, Error)]
pub enum ApiError {
    #[error("{0:?}")]
    Io(#[from] io::Error),
    #[error("{0:?}")]
    Db(#[from] db::Error),
    #[error("{0:?}")]
    Reqwest(#[from] reqwest::Error),
    #[error("{0:?}")]
    Rss(#[from] rss::Error),
    #[error("Not found")]
    NotFound,
    #[error("Unauthorized")]
    Unauthorized,
    #[error("Axum Error: {0:?}")]
    Axum(#[from] axum::Error),
    #[error("Invalid WS Message")]
    InvalidWSMessage,
    #[error("JSON Error: {0:?}")]
    SerdeJson(#[from] serde_json::Error),
    #[error("Symphonia Error: {0:?}")]
    Symphonia(#[from] symphonia::core::errors::Error),
    #[error("OpenDAL Error: {0:?}")]
    OpenDal(#[from] opendal::Error),
}

impl IntoResponse for ApiError {
    /// Convert any errors in handlers into responses and log them
    fn into_response(self) -> axum::response::Response {
        tracing::error!("API Error: {self}");
        match self {
            Self::Io(_)
            | Self::Db(_)
            | Self::Reqwest(_)
            | Self::Rss(_)
            | Self::Axum(_)
            | Self::InvalidWSMessage
            | Self::Symphonia(_)
            | Self::OpenDal(_) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "internal server error").into_response()
            }
            Self::Unauthorized => (StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
            Self::NotFound => (StatusCode::NOT_FOUND, "not found").into_response(),
            Self::SerdeJson(_) => (StatusCode::BAD_REQUEST, "invalid json").into_response(),
        }
    }
}
