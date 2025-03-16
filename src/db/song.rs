use itertools::Itertools;
use serde::{Deserialize, Serialize};
use sqlx::{prelude::*, Pool, Sqlite};

use super::Error;

#[derive(Debug, FromRow, Serialize, Deserialize, ts_rs::TS)]
#[ts(export, export_to = "../web/src/types/Song.ts")]
#[serde(rename_all = "camelCase")]
pub struct Song {
    #[ts(type = "number")]
    pub id: i64,

    pub title: String,

    #[serde(skip_deserializing)]
    pub created_at: chrono::NaiveDateTime,

    #[serde(skip_deserializing)]
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Debug, Serialize, FromRow)]
pub struct SongWTags {
    #[serde(flatten)]
    #[sqlx(flatten)]
    pub item: Song,
    pub tags: Option<String>,
}

impl Song {
    pub async fn get_all(
        executor: impl Executor<'_, Database = super::DB>,
    ) -> Result<Vec<Self>, Error> {
        sqlx::query_as!(Song, "SELECT * FROM songs")
            .fetch_all(executor)
            .await
            .map_err(|e| Error::SelectError("songs", e))
    }

    pub async fn get_by_id(
        id: i64,
        executor: impl Executor<'_, Database = super::DB>,
    ) -> Result<Option<Self>, Error> {
        sqlx::query_as!(Song, "SELECT * FROM songs WHERE id = $1", id)
            .fetch_optional(executor)
            .await
            .map_err(|e| Error::SelectError("songs", e))
    }

    pub async fn insert_w_source(
        title: &str,
        path: &str,
        mime_type: &str,
        backend: &str,
        executor: &Pool<Sqlite>,
    ) -> Result<i64, Error> {
        let mut transaction = executor
            .begin()
            .await
            .map_err(|e| Error::TransactionError("songs", e))?;

        let song_id = sqlx::query!("INSERT INTO songs (title) VALUES ($1)", title)
            .execute(&mut *transaction)
            .await
            .unwrap()
            .last_insert_rowid();

        sqlx::query!(
            r#"
    -- Insert into sources and store the source_id
    INSERT INTO sources (path, mime_type, storage_backend_name) VALUES ($1, $2, $3);
    -- Insert into songs_to_sources using both IDs
    INSERT INTO songs_to_sources (song_id, source_id) VALUES ($4, last_insert_rowid());
        "#,
            path,
            mime_type,
            backend,
            song_id
        )
        .execute(&mut *transaction)
        .await
        .map_err(|e| Error::InsertError("sources", e))
        .map(|_| ())?;

        transaction
            .commit()
            .await
            .map_err(|e| Error::TransactionError("songs", e))?;

        Ok(song_id)
    }

    pub async fn add_tag(
        song_id: i64,
        tag: &str,
        executor: impl Executor<'_, Database = super::DB>,
    ) -> Result<(), Error> {
        sqlx::query!(
            "INSERT OR IGNORE INTO songs_to_tags(song_id, tag_id) VALUES ($1, $2)",
            song_id,
            tag
        )
        .execute(executor)
        .await
        .map_err(|e| Error::InsertError("songs_to_tags", e))
        .map(|_| ())
    }

    pub async fn add_tags(
        id: i64,
        tags: &[&str],
        executor: impl Executor<'_, Database = super::DB>,
    ) -> Result<(), Error> {
        let sql = format!(
            r#"
			INSERT OR IGNORE INTO songs_to_tags (song_id, tag_id)
			SELECT {}, name
			FROM tags
			WHERE name IN ({});
		"#,
            id,
            tags.into_iter()
                .map(|_| "?")
                .intersperse(",")
                .collect::<Box<str>>()
        );

        let mut query = sqlx::query(&sql);

        for tag in tags {
            query = query.bind(tag);
        }

        query
            .execute(executor)
            .await
            .map_err(|e| Error::InsertError("songs_to_tags", e))
            .map(|_| ())
    }
}
