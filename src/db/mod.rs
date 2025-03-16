use sqlx::Sqlite;
use thiserror::Error;

pub mod album;
pub mod artist;
pub mod song;
pub mod source;
pub mod storage_backend;
pub mod tag;
pub mod user;

pub use album::Album;
pub use artist::Artist;
pub use song::Song;
pub use source::Source;
pub use storage_backend::{FsConfig, StorageBackend, StorageBackendConfig};
pub use tag::Tag;
pub use user::User;

type DB = Sqlite;

#[derive(Debug, Error)]
pub enum Error {
    #[error("Error inserting row into {0}: {1:?}")]
    InsertError(&'static str, sqlx::Error),
    #[error("Error updating row in {0}: {1:?}")]
    UpdateError(&'static str, sqlx::Error),
    #[error("Error selecting rows from {0}: {1:?}")]
    SelectError(&'static str, sqlx::Error),
    #[error("Error deleting rows in {0}: {1:?}")]
    DeleteError(&'static str, sqlx::Error),
    #[error("Row for {0} is invalid because \"{1}\"")]
    InvalidRow(&'static str, String),
    #[error("Error for transaction on {0}: {1:?}")]
    TransactionError(&'static str, sqlx::Error),
    #[error("Error deserializing JSON for {0}: {1:?}")]
    Deserialize(&'static str, serde_json::Error),
}

impl Error {
    /// Panics if this is an invalid row error
    pub fn into_sqlx_error(self) -> sqlx::Error {
        match self {
            Error::InsertError(_, error) => error,
            Error::UpdateError(_, error) => error,
            Error::SelectError(_, error) => error,
            Error::DeleteError(_, error) => error,
            Error::TransactionError(_, error) => error,
            Error::InvalidRow(_, _) | Error::Deserialize(_, _) => panic!("No sqlx error"),
        }
    }
}
