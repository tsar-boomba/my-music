use std::{
    io::{self, ErrorKind},
    path::PathBuf,
};

use axum::body::Bytes;
use axum_extra::extract::cookie::Cookie;
use http::{
    header::{CONTENT_ENCODING, CONTENT_TYPE, SET_COOKIE},
    HeaderValue, Response, StatusCode,
};
use http_body::Frame;
use http_body_util::{combinators::BoxBody, BodyExt, Full, StreamBody};
use tokio::{
    fs::{canonicalize, OpenOptions},
    io::BufReader,
};
use tokio_stream::StreamExt;
use tokio_util::io::ReaderStream;

use crate::config::Config;

pub async fn handle_static(
    config: &Config,
    path: &str,
) -> Result<Response<BoxBody<Bytes, io::Error>>, crate::ApiError> {
    let root_path = &config.web_dir;
    let raw_file_path = root_path.join(&path[1..]);
    let raw_file_path = if raw_file_path.extension().is_none() {
        // Convenience for serving SPA sites, remap non-resource paths to serve index.html
        let new_file_path = root_path.join("index.html");
        tracing::debug!(
            "Remapped `{}` to `{}`",
            raw_file_path.display(),
            new_file_path.display()
        );
        new_file_path
    } else {
        raw_file_path
    };

    let file_path = match canonicalize(&raw_file_path).await {
        Ok(file_path) => file_path,
        Err(err) => match err.kind() {
            ErrorKind::NotFound => {
                return Ok(not_found(path));
            }
            _ => return Err(err.into()),
        },
    };

    if !file_path.starts_with(root_path.as_ref()) {
        // Someone is trying to access files outside of the root directory
        tracing::warn!("Malicious request path: {}", path);
        return Ok(not_found(path));
    }

    let mut final_path = &file_path;
    let gzip_path = add_extension(&file_path, "gz");
    let have_gz_version = canonicalize(&gzip_path).await.is_ok();
    let is_gzip = have_gz_version || file_path.ends_with("gz");
    tracing::debug!("gzip path: {}", gzip_path.display());

    if have_gz_version {
        // We have a compressed version available, use that instead
        tracing::debug!("Using gzip version for {}", file_path.display());
        final_path = &gzip_path;
    }

    let file = match OpenOptions::new().read(true).open(final_path).await {
        Ok(file) => file,
        Err(err) => match err.kind() {
            ErrorKind::NotFound => return Ok(not_found(path)),
            _ => return Err(err.into()),
        },
    };

    let stream = ReaderStream::new(BufReader::new(file)).map(|read_res| read_res.map(Frame::data));
    // Use original path without gz for mime type
    let mime = mime_guess::from_path(&file_path).first_or_text_plain();

    let cookie = Cookie::build(("domain", config.domain.to_string()))
        .domain(config.domain.host().unwrap_or_default())
        .path("/")
        .http_only(false)
        .secure(false)
        .build();

    let mut response = Response::builder()
        .header(CONTENT_TYPE, mime.essence_str())
        .header(SET_COOKIE, cookie.encoded().to_string())
        .body(StreamBody::new(stream).boxed())
        .expect("values provided to the builder should be valid");

    if is_gzip {
        response
            .headers_mut()
            .insert(CONTENT_ENCODING, HeaderValue::from_static("gzip"));
    }

    Ok(response)
}

fn not_found<E>(path: &str) -> Response<BoxBody<Bytes, E>> {
    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .header(CONTENT_TYPE, "text/plain")
        .body(
            Full::new(Bytes::from(format!("Not found: {path}")))
                .map_err(|_| unreachable!("Creating not found body cannot fail."))
                .boxed(),
        )
        .unwrap()
}

fn add_extension(path: &PathBuf, extension: impl AsRef<std::path::Path>) -> PathBuf {
    match path.extension() {
        Some(ext) => {
            let mut ext = ext.to_os_string();
            ext.push(".");
            ext.push(extension.as_ref());
            path.with_extension(ext)
        }
        None => path.with_extension(extension.as_ref()),
    }
}
