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
    pub async fn get_all(
        executor: impl Executor<'_, Database = super::DB>,
    ) -> Result<Vec<Self>, Error> {
        sqlx::query_as!(
            Album,
            "SELECT a.* FROM albums a JOIN tags t ON t.name = a.title"
        )
        .fetch_all(executor)
        .await
        .map_err(|e| Error::SelectError("albums", e))
    }

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

    pub async fn insert_w_source_and_tag<'a>(
        title: &'a str,
        path: &str,
        mime_type: &str,
        backend: &str,
        executor: &Pool<super::DB>,
    ) -> Result<&'a str, Error> {
        let mut transaction = executor
            .begin()
            .await
            .map_err(|e| Error::TransactionError("songs", e))?;

        let mut cover_image_source_id = sqlx::query!(
            "SELECT cover_image_source_id FROM albums WHERE title = $1",
            title
        )
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|e| Error::SelectError("albums", e))?
        .and_then(|record| record.cover_image_source_id);

        if cover_image_source_id.is_none() {
            cover_image_source_id = Some(
                            sqlx::query!(
                            "INSERT INTO sources (path, mime_type, storage_backend_name) VALUES ($1, $2, $3)",
                            path,
                            mime_type,
                            backend
                        )
                            .execute(&mut *transaction)
                            .await
                            .unwrap()
                            .last_insert_rowid(),
                        );
        }

        let album_id = sqlx::query!(
            "INSERT OR REPLACE INTO albums (title, cover_image_source_id) VALUES ($1, $2)",
            title,
            cover_image_source_id
        )
        .execute(&mut *transaction)
        .await
        .map_err(|e| Error::InsertError("sources", e))?
        .last_insert_rowid();

        sqlx::query!(
            "INSERT OR IGNORE INTO tags(name, album_id) VALUES ($1, $2)",
            title,
            album_id
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
}
