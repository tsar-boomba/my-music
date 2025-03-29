use serde::{Deserialize, Serialize};
use sqlx::{prelude::*, Pool};

use super::Error;

#[derive(Debug, FromRow, Serialize, Deserialize, ts_rs::TS)]
#[ts(export, export_to = "../web/src/types/Artist.ts")]
#[serde(rename_all = "camelCase")]
pub struct Artist {
    pub name: String,

    pub link: Option<String>,

    #[ts(type = "number | null")]
    pub image_source_id: Option<i64>,

    #[serde(skip_deserializing)]
    pub created_at: chrono::NaiveDateTime,

    #[serde(skip_deserializing)]
    pub updated_at: chrono::NaiveDateTime,
}

impl Artist {
    pub async fn insert_w_tags<'a, 'b>(
        artists: &'a [&'b str],
        executor: &Pool<super::DB>,
    ) -> Result<&'a [&'b str], Error> {
        let mut transaction = executor
            .begin()
            .await
            .map_err(|e| Error::TransactionError("songs", e))?;

        for artist in artists {
            sqlx::query!("INSERT OR IGNORE INTO artists (name) VALUES ($1)", artist)
                .execute(&mut *transaction)
                .await
                .map_err(|e| Error::InsertError("sources", e))?;

            sqlx::query!(
                "INSERT OR IGNORE INTO tags(name, artist_id) VALUES ($1, $2)",
                artist,
                artist
            )
            .execute(&mut *transaction)
            .await
            .map_err(|e| Error::InsertError("tags", e))?;
        }

        transaction
            .commit()
            .await
            .map_err(|e| Error::TransactionError("songs", e))?;

        Ok(artists)
    }
}
