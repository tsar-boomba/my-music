use serde::{Deserialize, Serialize};
use sqlx::prelude::*;

use super::Error;

#[derive(Debug, FromRow, Serialize, Deserialize, ts_rs::TS)]
#[ts(export, export_to = "../web/src/types/Tag.ts")]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    pub name: String,

    pub background_color: Option<String>,

    pub text_color: Option<String>,

    pub border_color: Option<String>,

    #[ts(type = "number | null")]
    pub artist_id: Option<i64>,

    #[ts(type = "number | null")]
    pub album_id: Option<i64>,

    #[serde(skip_deserializing)]
    pub created_at: chrono::NaiveDateTime,

    #[serde(skip_deserializing)]
    pub updated_at: chrono::NaiveDateTime,
}

impl Tag {
    pub async fn get_all(
        executor: impl Executor<'_, Database = super::DB>,
    ) -> Result<Vec<Self>, Error> {
        sqlx::query_as!(Tag, "SELECT * FROM tags")
            .fetch_all(executor)
            .await
            .map_err(|e| Error::Select("tags", e))
    }

    pub async fn for_song(
        song_id: i64,
        executor: impl Executor<'_, Database = super::DB>,
    ) -> Result<Vec<Self>, Error> {
        sqlx::query_as!(
            Tag,
            "SELECT t.* FROM songs_to_tags stt JOIN tags t ON t.name = stt.tag_id WHERE stt.song_id = $1",
            song_id
        )
        .fetch_all(executor)
        .await
        .map_err(|e| Error::Select("songs_to_sources", e))
    }
}
