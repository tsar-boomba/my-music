use serde::{Deserialize, Serialize};
use sqlx::prelude::*;

use super::{Error, StorageBackend};

/// Some kind of binary data in the storage backend
#[derive(Debug, FromRow, Serialize, Deserialize, ts_rs::TS)]
#[ts(export, export_to = "../web/src/types/Source.ts")]
#[serde(rename_all = "camelCase")]
pub struct Source {
    #[ts(type = "number")]
    pub id: i64,

    pub path: String,

    pub mime_type: String,

    pub storage_backend_name: String,

    #[serde(skip_deserializing)]
    pub created_at: chrono::NaiveDateTime,

    #[serde(skip_deserializing)]
    pub updated_at: chrono::NaiveDateTime,
}

impl Source {
    pub async fn get_all(
        executor: impl Executor<'_, Database = super::DB>,
    ) -> Result<Vec<Self>, Error> {
        sqlx::query_as!(Source, "SELECT * from sources")
            .fetch_all(executor)
            .await
            .map_err(|e| Error::SelectError("sources", e))
    }

    pub async fn for_song(
        song_id: i64,
        executor: impl Executor<'_, Database = super::DB>,
    ) -> Result<Vec<Self>, Error> {
        sqlx::query_as!(Source, "SELECT s.* FROM songs_to_sources sts JOIN sources s ON s.id = sts.source_id WHERE sts.song_id = $1", song_id).fetch_all(executor).await.map_err(|e| Error::SelectError("songs_to_sources", e))
    }

    pub async fn get_by_id_w_backend(
        id: i64,
        executor: impl Executor<'_, Database = super::DB>,
    ) -> Result<Option<(Source, StorageBackend)>, Error> {
        let Some(result) = sqlx::query!("SELECT s.*, b.name, b.config FROM sources s JOIN storage_backends b ON storage_backend_name = b.name WHERE id = $1", id).fetch_optional(executor).await.map_err(|e| Error::SelectError("sources", e))? else {
            return Ok(None);
        };

        Ok(Some((
            Self {
                id: result.id,
                path: result.path,
                mime_type: result.mime_type,
                storage_backend_name: result.storage_backend_name,
                created_at: result.created_at,
                updated_at: result.updated_at,
            },
            StorageBackend::from_raw_parts(&result.name, &result.config)?,
        )))
    }
}
