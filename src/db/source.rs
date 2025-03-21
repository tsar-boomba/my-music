use std::{
    sync::{Arc, LazyLock},
    time::{Duration, Instant},
};

use rustc_hash::FxHashMap;
use serde::{Deserialize, Serialize};
use sqlx::prelude::*;
use tokio::sync::RwLock;

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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SongSource {
    #[serde(flatten)]
    source: Source,
    song_id: i64,
    request: Arc<GetSourceRequest>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GetSourceRequest {
    #[serde(with = "http_serde::method")]
    pub method: http::Method,
    #[serde(with = "http_serde::uri")]
    pub uri: http::Uri,
    #[serde(with = "http_serde::header_map")]
    pub headers: http::HeaderMap,
}

/// 3 days
const REQ_VALID_FOR: Duration = Duration::from_secs(3 * 24 * 60 * 60);
static REQUESTS_CACHE: LazyLock<RwLock<FxHashMap<i64, (Instant, Arc<GetSourceRequest>)>>> =
    LazyLock::new(|| RwLock::new(Default::default()));

impl Source {
    pub async fn get_all(
        executor: impl Executor<'_, Database = super::DB>,
    ) -> Result<Vec<Self>, Error> {
        sqlx::query_as!(Source, "SELECT * from sources")
            .fetch_all(executor)
            .await
            .map_err(|e| Error::SelectError("sources", e))
    }

    pub async fn get_all_for_songs(
        executor: impl Executor<'_, Database = super::DB> + Copy,
    ) -> Result<Vec<SongSource>, Error> {
        let results = sqlx::query!("SELECT sts.song_id, s.* FROM songs_to_sources sts JOIN sources s ON s.id = sts.source_id").fetch_all(executor).await.map_err(|e| Error::SelectError("songs_to_sources", e))?;
        let mut results_w_reqs = Vec::with_capacity(results.len());

        // TODO: Consider parallelization for when lots of sources
        for record in results {
            let source = Source {
                id: record.id,
                path: record.path,
                mime_type: record.mime_type,
                storage_backend_name: record.storage_backend_name,
                created_at: record.created_at,
                updated_at: record.updated_at,
            };

            results_w_reqs.push(SongSource {
                request: source.get_req(executor).await?,
                song_id: record.song_id.unwrap(),
                source,
            });
        }

        Ok(results_w_reqs)
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

    async fn get_req(
        &self,
        executor: impl Executor<'_, Database = super::DB>,
    ) -> Result<Arc<GetSourceRequest>, Error> {
        // Fast path where we have an unexpired url in the cache already
        {
            let url_cache = REQUESTS_CACHE.read().await;
            if let Some((inserted_at, req)) = url_cache.get(&self.id) {
                if inserted_at.elapsed() <= REQ_VALID_FOR {
                    return Ok(req.clone());
                }
            }
        }

        let Some(operator) =
            StorageBackend::operator_by_name(&self.storage_backend_name, executor).await?
        else {
            // foreign key constraints should make this impossible
            unreachable!("source has no associated backend!");
        };

        let req = if operator.info().full_capability().presign_read {
            match operator
                // Actually expire later than the cache, to mitigate risk of returning an invalid url from cache
                .presign_read_with(&self.path, REQ_VALID_FOR + Duration::from_secs(1 * 60 * 60))
                .override_content_type(&self.mime_type)
                .override_cache_control(&format!(
                    "private, max-age={}, immutable",
                    REQ_VALID_FOR.as_secs()
                ))
                .await
            {
                Ok(presigned) => Arc::new(GetSourceRequest {
                    method: presigned.method().clone(),
                    uri: presigned.uri().clone(),
                    headers: presigned.header().clone(),
                }),
                Err(err) => {
                    tracing::error!(
                        "error creating presigned url, not caching, falling back to api: {err:?}"
                    );
                    return Ok(Arc::new(GetSourceRequest {
                        method: http::Method::GET,
                        uri: format!("/api/sources/{}/data", self.id).parse().unwrap(),
                        headers: http::HeaderMap::new(),
                    }));
                }
            }
        } else {
            Arc::new(GetSourceRequest {
                method: http::Method::GET,
                uri: format!("/api/sources/{}/data", self.id).parse().unwrap(),
                headers: http::HeaderMap::new(),
            })
        };

        REQUESTS_CACHE
            .write()
            .await
            .insert(self.id, (Instant::now(), req.clone()));
        Ok(req)
    }
}
