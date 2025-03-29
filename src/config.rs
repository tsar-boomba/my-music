use std::{
    fs,
    net::SocketAddr,
    path::{Path, PathBuf},
    sync::Arc,
};

use http::Uri;
use serde::Deserialize;

use crate::db::{FsConfig, StorageBackendConfig};

#[derive(Debug, Deserialize)]
pub struct Config {
    #[cfg_attr(debug_assertions, serde(default = "dev_domain"))]
    #[serde(with = "http_serde::uri")]
    pub domain: Uri,

    #[serde(default = "default_listen_addr")]
    pub listen_addr: SocketAddr,

    #[serde(default)]
    pub multi_thread_runtime: bool,

    #[serde(default)]
    pub runtime_workers: Option<usize>,

    #[serde(default = "default_env_filter")]
    pub tracing_filter: Arc<str>,

    #[serde(default = "default_web_dir")]
    pub web_dir: Arc<Path>,

    #[serde(default = "default_data_dir")]
    pub data_dir: Arc<Path>,

    #[cfg_attr(debug_assertions, serde(default = "default_storage_backend"))]
    pub init_storage_backend: Arc<StorageBackendConfig>,

    #[cfg_attr(debug_assertions, serde(default = "default_username"))]
    pub init_username: Arc<str>,

    #[cfg_attr(debug_assertions, serde(default = "default_password"))]
    pub init_password: Arc<str>,

    #[cfg_attr(debug_assertions, serde(default = "default_jwt_secret"))]
    pub jwt_secret: Arc<str>,
}

impl Config {
    pub fn from_json(json: &[u8]) -> color_eyre::Result<Self> {
        Ok(serde_json::from_slice(json)?)
    }
}

fn dev_domain() -> Uri {
    "localhost".parse().unwrap()
}

fn default_env_filter() -> Arc<str> {
    if cfg!(debug_assertions) {
        Arc::from("info,my_music=debug,axum=debug,axum-core=debug,tower_http=debug")
    } else {
        Arc::from("info,my_music=debug,tower_http=debug")
    }
}

/// 0.0.0.0:8080
fn default_listen_addr() -> SocketAddr {
    if cfg!(debug_assertions) {
        "127.0.0.1:8013".parse().unwrap()
    } else {
        "0.0.0.0:8013".parse().unwrap()
    }
}

fn default_web_dir() -> Arc<Path> {
    if cfg!(debug_assertions) {
        Arc::from(Path::new("./web/dist").canonicalize().unwrap())
    } else {
        Arc::from(Path::new("/my-music-web").canonicalize().unwrap())
    }
}

fn default_data_dir() -> Arc<Path> {
    if cfg!(debug_assertions) {
        fs::create_dir("./my-music-data").ok();
        Arc::from(Path::new("./my-music-data").canonicalize().unwrap())
    } else {
        Arc::from(Path::new("/my-music-data").canonicalize().unwrap())
    }
}

fn default_username() -> Arc<str> {
    if cfg!(debug_assertions) {
        Arc::from("admin")
    } else {
        panic!("Must set INIT_USERNAME variable for production.")
    }
}

fn default_password() -> Arc<str> {
    if cfg!(debug_assertions) {
        Arc::from("password")
    } else {
        panic!("Must set INIT_PASSWORD variable for production.")
    }
}

fn default_jwt_secret() -> Arc<str> {
    if cfg!(debug_assertions) {
        Arc::from("secret")
    } else {
        panic!("Must set JWT_SECRET variable for production.")
    }
}

fn default_storage_backend() -> Arc<StorageBackendConfig> {
    if cfg!(debug_assertions) {
        fs::create_dir("./my-music-data/storage").ok();
        Arc::new(StorageBackendConfig::Fs(FsConfig {
            root: Arc::from(
                PathBuf::from("./my-music-data/storage")
                    .canonicalize()
                    .unwrap()
                    .to_str()
                    .unwrap(),
            ),
        }))
    } else {
        panic!("Must set INIT_PASSWORD env variable for production.")
    }
}
