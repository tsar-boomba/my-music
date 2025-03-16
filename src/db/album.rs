use serde::{Deserialize, Serialize};
use sqlx::{prelude::*, Pool};

use super::Error;

#[derive(Debug, FromRow, Serialize, Deserialize, ts_rs::TS)]
#[ts(export, export_to = "../web/src/types/Album.ts")]
#[serde(rename_all = "camelCase")]
pub struct Album {
    pub title: String,

    pub link: Option<String>,

    #[ts(type = "number | null")]
    pub cover_image_source_id: Option<i64>,

    #[serde(skip_deserializing)]
    pub created_at: chrono::NaiveDateTime,

    #[serde(skip_deserializing)]
    pub updated_at: chrono::NaiveDateTime,
}

impl Album {
    pub async fn insert_w_tag<'a>(
        title: &'a str,
        executor: &Pool<super::DB>,
    ) -> Result<&'a str, Error> {
        let mut transaction = executor
            .begin()
            .await
            .map_err(|e| Error::TransactionError("songs", e))?;

        sqlx::query!("INSERT OR IGNORE INTO albums (title) VALUES ($1)", title)
            .execute(&mut *transaction)
            .await
            .map_err(|e| Error::InsertError("sources", e))?;

        sqlx::query!(
            "INSERT OR IGNORE INTO tags(name, album_id) VALUES ($1, $2)",
            title,
            title,
        )
        .execute(&mut *transaction)
        .await
        .map_err(|e| Error::InsertError("tags", e))?;

        transaction
            .commit()
            .await
            .map_err(|e| Error::TransactionError("songs", e))?;

        Ok(title)
    }

    pub async fn insert_w_source_and_tag(
        title: &str,
        path: &str,
        mime_type: &str,
        backend: &str,
        executor: &Pool<super::DB>,
    ) -> Result<i64, Error> {
        let mut transaction = executor
            .begin()
            .await
            .map_err(|e| Error::TransactionError("songs", e))?;

        let source_id = sqlx::query!(
            "INSERT INTO sources (path, mime_type, storage_backend_name) VALUES ($1, $2, $3)",
            path,
            mime_type,
            backend
        )
        .execute(&mut *transaction)
        .await
        .unwrap()
        .last_insert_rowid();

        let album_id = sqlx::query!(
            "INSERT INTO albums (title, cover_image_source_id) VALUES ($1, $2)",
            title,
            source_id
        )
        .execute(&mut *transaction)
        .await
        .map_err(|e| Error::InsertError("sources", e))?
        .last_insert_rowid();

        let tag_id = sqlx::query!(
            "INSERT INTO tags(name, album_id) VALUES ($1, $2)",
            title,
            album_id
        )
        .execute(&mut *transaction)
        .await
        .map_err(|e| Error::InsertError("tags", e))?
        .last_insert_rowid();

        transaction
            .commit()
            .await
            .map_err(|e| Error::TransactionError("songs", e))?;

        Ok(tag_id)
    }
}
