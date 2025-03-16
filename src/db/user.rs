use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2, PasswordHash, PasswordVerifier,
};
use serde::{Deserialize, Serialize};
use sqlx::prelude::*;

use super::Error;

#[derive(Debug, FromRow, Serialize, Deserialize, ts_rs::TS)]
#[ts(export, export_to = "../web/src/types/User.ts")]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub username: String,

    #[serde(skip)]
    pub hashed_pass: String,

    pub admin: bool,

    #[serde(skip_deserializing)]
    pub created_at: chrono::NaiveDateTime,

    #[serde(skip_deserializing)]
    pub updated_at: chrono::NaiveDateTime,
}

impl User {
    pub async fn try_insert_new(
        username: &str,
        password: &str,
        admin: bool,
        executor: impl Executor<'_, Database = super::DB>,
    ) -> Result<(), Error> {
        let hashed_pass = Self::hash_password(password).await;
        sqlx::query!(
            r#"
		INSERT OR IGNORE INTO users(username, hashed_pass, admin)
		VALUES (?1, ?2, ?3)
		"#,
            username,
            hashed_pass,
            admin,
        )
        .execute(executor)
        .await
        .map_err(|e| Error::InsertError("tags", e))
        .map(|_| ())
    }

    pub async fn get_by_username(
        username: &str,
        executor: impl Executor<'_, Database = super::DB>,
    ) -> Result<Option<Self>, Error> {
        match sqlx::query_as!(User, "SELECT * FROM users where username = ?1", username)
            .fetch_optional(executor)
            .await
        {
            Ok(user) => Ok(user),
            Err(err) => match err {
                _ => Err(Error::SelectError("sources", err)),
            },
        }
    }

    pub async fn hash_password(password: &str) -> String {
        let password = password.to_string();
        tokio::task::spawn_blocking(move || {
            let salt = SaltString::generate(&mut OsRng);

            // Argon2 with default params (Argon2id v19)
            let argon2 = Argon2::default();

            // Hash password to PHC string ($argon2id$v=19$...)
            argon2
                .hash_password(password.as_bytes(), &salt)
                .unwrap()
                .to_string()
        })
        .await
        .unwrap()
    }

    pub async fn verify_password(password: &str, hashed_password: &str) -> bool {
        let password = password.to_string();
        let hashed_password = hashed_password.to_string();

        tokio::task::spawn_blocking(move || {
            let parsed_hash = PasswordHash::new(&hashed_password).unwrap();
            Argon2::default()
                .verify_password(password.as_bytes(), &parsed_hash)
                .is_ok()
        })
        .await
        .unwrap()
    }
}
