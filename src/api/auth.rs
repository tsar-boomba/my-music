use std::sync::OnceLock;

use axum::{
    extract,
    response::{IntoResponse, Response},
    Json,
};
use axum_extra::extract::{
    cookie::{Cookie, SameSite},
    CookieJar,
};
use chrono::Utc;
use hmac::{Hmac, Mac};
use http::StatusCode;
use jwt::{SignWithKey, VerifyWithKey};
use rustc_hash::FxHashMap;
use serde::Deserialize;
use sha2::Sha256;

use crate::{config::Config, db::User, ApiError};

use super::State;

pub const AUTH_COOKIE: &str = "auth";
static KEY: OnceLock<Hmac<Sha256>> = OnceLock::new();

fn create_cookie(config: &Config, user: &User) -> Cookie<'static> {
    let mut claims = FxHashMap::default();
    claims.insert("sub", user.username.to_string());
    claims.insert("iat", Utc::now().timestamp().to_string());
    Cookie::build((
        AUTH_COOKIE,
        claims
            .sign_with_key(
                &*KEY.get_or_init(|| Hmac::new_from_slice(config.jwt_secret.as_bytes()).unwrap()),
            )
            .unwrap(),
    ))
    .http_only(true)
    .same_site(SameSite::Lax)
    .secure(true)
    .permanent()
    .build()
}

fn verify_cookie(config: &Config, token: &str) -> Option<FxHashMap<String, String>> {
    token
        .verify_with_key(
            &*KEY.get_or_init(|| Hmac::new_from_slice(config.jwt_secret.as_bytes()).unwrap()),
        )
        .ok()
}

pub async fn authenticate<'a>(
    state: &State,
    cookie: Option<&Cookie<'a>>,
) -> Result<User, ApiError> {
    let Some(auth_cookie) = cookie else {
        tracing::debug!("no cookie");
        return Err(ApiError::Unauthorized);
    };

    let Some(username) = verify_cookie(&state.config, auth_cookie.value())
        .and_then(|claims| claims.get("sub").cloned())
    else {
        return Err(ApiError::Unauthorized);
    };

    let Some(user) = User::get_by_username(&username, &state.sqlite).await? else {
        return Err(ApiError::Unauthorized);
    };

    Ok(user)
}

#[derive(Debug, Deserialize)]
pub struct Login {
    username: String,
    password: String,
}

pub async fn login(
    extract::State(state): extract::State<State>,
    Json(Login { username, password }): Json<Login>,
) -> Result<Response, ApiError> {
    let Some(user) = User::get_by_username(&username, &state.sqlite).await? else {
        tracing::debug!("Couldn't find user {username}");
        return Err(ApiError::Unauthorized);
    };

    if !User::verify_password(&password, &user.hashed_pass).await {
        tracing::debug!("Incorrect password for {username}");
        return Err(ApiError::Unauthorized);
    }

    let auth_cookie = create_cookie(&state.config, &user);

    Ok((
        StatusCode::OK,
        [("set-cookie", auth_cookie.encoded().to_string())],
        Json(user),
    )
        .into_response())
}

pub async fn check_auth(
    extract::State(state): extract::State<State>,
    cookies: CookieJar,
) -> Result<Json<User>, ApiError> {
    authenticate(&state, cookies.get(AUTH_COOKIE))
        .await
        .map(|user| Json(user))
}
