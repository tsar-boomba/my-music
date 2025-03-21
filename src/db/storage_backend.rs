use std::sync::{Arc, OnceLock};

use chrono::Utc;
use opendal::Operator;
use rustc_hash::FxHashMap;
use serde::{Deserialize, Serialize};
use sqlx::prelude::*;
use tokio::sync::RwLock;

use super::Error;

/// Storage backend in the db
#[derive(Debug, FromRow)]
struct DBStorageBackend {
    pub name: String,

    pub config: String,

    pub created_at: chrono::NaiveDateTime,

    pub updated_at: chrono::NaiveDateTime,
}

/// A storage backend we can store songs and images in
#[derive(Debug, Serialize, Deserialize, ts_rs::TS)]
#[ts(export, export_to = "../web/src/types/StorageBackend.ts")]
pub struct StorageBackend {
    pub name: String,

    pub config: StorageBackendConfig,

    #[serde(skip_deserializing)]
    pub created_at: chrono::NaiveDateTime,

    #[serde(skip_deserializing)]
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Debug, Serialize, Deserialize, ts_rs::TS)]
#[ts(export, export_to = "../web/src/types/StorageBackendConfig.ts")]
#[serde(rename_all = "camelCase")]
pub enum StorageBackendConfig {
    Fs(FsConfig),
    S3(S3Config),
}

#[derive(Debug, Serialize, Deserialize, ts_rs::TS)]
#[ts(export, export_to = "../web/src/types/FsConfig.ts")]
pub struct FsConfig {
    pub root: Arc<str>,
}

#[derive(Debug, Serialize, Deserialize, ts_rs::TS)]
#[ts(export, export_to = "../web/src/types/S3Config.ts")]
pub struct S3Config {
    #[serde(default)]
    pub access_key_id: Arc<str>,

    #[serde(default)]
    pub secret_access_key: Arc<str>,

    pub region: Arc<str>,

    pub bucket: Arc<str>,

    #[serde(default)]
    pub disable_config_load: bool,
}

impl DBStorageBackend {
    fn parse(self) -> Result<StorageBackend, Error> {
        Ok(StorageBackend {
            config: serde_json::from_str(&self.config)
                .map_err(|e| Error::Deserialize("storage_backends", e))?,
            created_at: self.created_at,
            name: self.name,
            updated_at: self.updated_at,
        })
    }
}

impl StorageBackendConfig {
    pub fn operator(&self) -> Result<Operator, Error> {
        Ok(match self {
            StorageBackendConfig::Fs(fs_config) => {
                Operator::new(opendal::services::Fs::default().root(&fs_config.root))
                    .unwrap()
                    .finish()
            }
            StorageBackendConfig::S3(s3_config) => Operator::new({
                let mut builder = opendal::services::S3::default()
                    .access_key_id(&s3_config.access_key_id)
                    .secret_access_key(&s3_config.secret_access_key)
                    .region(&s3_config.region)
                    .bucket(&s3_config.bucket);

                if s3_config.disable_config_load {
                    builder = builder.disable_config_load()
                }

                builder
            })
            .unwrap()
            .finish(),
        }
        .layer(opendal::layers::TracingLayer))
    }
}

static OPERATORS: OnceLock<RwLock<FxHashMap<String, Operator>>> = OnceLock::new();

impl StorageBackend {
    pub fn from_raw_parts(name: &str, config: &str) -> Result<Self, Error> {
        Ok(Self {
            name: name.to_string(),
            config: serde_json::from_str(config)
                .map_err(|e| Error::Deserialize("storage_backends", e))?,
            created_at: Utc::now().naive_utc(),
            updated_at: Utc::now().naive_utc(),
        })
    }

    pub async fn get_by_name(
        name: &str,
        executor: impl Executor<'_, Database = super::DB>,
    ) -> Result<Option<Self>, Error> {
        sqlx::query_as!(
            DBStorageBackend,
            r#"
                SELECT * FROM storage_backends WHERE name = ?
                "#,
            name
        )
        .fetch_optional(executor)
        .await
        .map_err(|e| Error::SelectError("storage_backends", e))?
        .map(|db_ver| db_ver.parse())
        .transpose()
    }

    pub async fn try_insert_new(
        name: &str,
        config: &StorageBackendConfig,
        executor: impl Executor<'_, Database = super::DB>,
    ) -> Result<(), Error> {
        let config_json = serde_json::to_string(config).unwrap();
        sqlx::query!(
            r#"
		INSERT OR IGNORE INTO storage_backends(name, config)
		VALUES (?1, ?2)
		"#,
            name,
            config_json,
        )
        .execute(executor)
        .await
        .map_err(|e| Error::InsertError("tags", e))
        .map(|_| ())
    }

    pub async fn operator_by_name(
        name: &str,
        executor: impl Executor<'_, Database = super::DB>,
    ) -> Result<Option<Operator>, Error> {
        let Some(backend) = Self::get_by_name(name, executor).await? else {
            return Ok(None);
        };

        Some(backend.operator().await).transpose()
    }

    pub async fn operator(&self) -> Result<Operator, Error> {
        let operators =
            OPERATORS.get_or_init(|| RwLock::new(FxHashMap::with_hasher(Default::default())));

        // Use cached operator if it exists
        if let Some(operator) = operators.read().await.get(&self.name).cloned() {
            return Ok(operator);
        }

        // Create new operator for backend
        let new_operator = self.config.operator()?;
        operators
            .write()
            .await
            .insert(self.name.clone(), new_operator);

        Ok(operators.read().await.get(&self.name).cloned().unwrap())
    }
}
