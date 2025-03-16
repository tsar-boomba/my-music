use std::{net::SocketAddr, sync::Arc};

use api::api_router;
use axum::{extract, Router};
use color_eyre::eyre::{eyre, Context};
use config::Config;
use db::{StorageBackend, User};
pub use error::ApiError;
use http::{header::SET_COOKIE, HeaderValue, Method};
use sqlx::sqlite::SqliteConnectOptions;
use static_files::handle_static;
use tokio::{net::TcpListener, signal};
use tower_http::{
    cors::{AllowHeaders, CorsLayer},
    normalize_path::NormalizePathLayer,
    trace::TraceLayer,
};

mod api;
mod config;
mod db;
mod error;
mod static_files;

fn main() -> color_eyre::Result<()> {
    let config = Config::from_json(&std::fs::read("./my-music-config.json")?)?;

    tracing_subscriber::fmt()
        .with_ansi(false)
        .with_env_filter(&config.tracing_filter)
        .init();

    let mut rt_builder = if config.multi_thread_runtime {
        tokio::runtime::Builder::new_multi_thread()
    } else {
        tokio::runtime::Builder::new_current_thread()
    };

    if let Some(num_workers) = config.runtime_workers {
        rt_builder.worker_threads(num_workers);
    }

    rt_builder.enable_all().build()?.block_on(server(config))
}

async fn server(config: Config) -> color_eyre::Result<()> {
    tracing::debug!("{config:#?}");
    let config = Arc::new(config);
    let cors_layer = if cfg!(debug_assertions) {
        CorsLayer::very_permissive().expose_headers([SET_COOKIE])
    } else {
        CorsLayer::new()
            .allow_origin(HeaderValue::try_from(
                config
                    .domain
                    .host()
                    .ok_or(eyre!("config.domain must have a host"))?,
            )?)
            .expose_headers([SET_COOKIE])
            .allow_headers(AllowHeaders::mirror_request())
            .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
    };

    let sqlite_options = SqliteConnectOptions::new()
        .filename(config.data_dir.join("db"))
        .create_if_missing(true);
    let sqlite = sqlx::SqlitePool::connect_with(sqlite_options).await?;
    sqlx::migrate!().run(&sqlite).await?;
    StorageBackend::try_insert_new("init", &config.init_storage_backend, &sqlite).await?;
    User::try_insert_new(&config.init_username, &config.init_password, true, &sqlite).await?;

    let base_path = config.domain.path().trim_end_matches("/");

    let api_router = api_router(config.clone(), sqlite)?;

    let base_router = Router::<Arc<Config>>::new()
        .fallback({
            let base_path = Arc::<str>::from(base_path);
            async move |extract::State(config): extract::State<Arc<Config>>,
                        req: extract::Request| {
                let path = req.uri().path().trim_start_matches(&*base_path.clone());
                handle_static(&config, path).await
            }
        })
        .with_state(config.clone())
        .nest(&format!("{base_path}/api"), api_router)
        .layer(cors_layer)
        .layer(TraceLayer::new_for_http())
        .layer(NormalizePathLayer::trim_trailing_slash());

    let listener = TcpListener::bind(config.listen_addr)
        .await
        .context("failed to bind to tcp socket")?;
    tracing::info!("Started my-music on http://{}", config.listen_addr);
    Ok(axum::serve(
        listener,
        base_router.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await?)
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => println!(),
        _ = terminate => println!(),
    }
}
