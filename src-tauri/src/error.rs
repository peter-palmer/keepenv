//! Error types shared by every Keepenv command.
//!
//! Errors crossing the IPC boundary carry a machine-readable `kind` so the UI
//! can react to specific situations (most importantly `conflict`).
//!
//! Security note: error messages may name files and directories, but must
//! never contain environment-file *contents*. Do not add a variant that
//! embeds file data.

use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("That project is not registered in Keepenv.")]
    ProjectNotFound,

    #[error("\"{0}\" is not a valid environment file name.")]
    InvalidFileName(String),

    #[error("The project folder no longer exists or is not a directory.")]
    InvalidProjectRoot,

    #[error("The resolved path is outside the project folder.")]
    PathEscapesRoot,

    #[error("\"{0}\" was not found in the project folder.")]
    FileNotFound(String),

    #[error("\"{0}\" already exists in the project folder.")]
    FileAlreadyExists(String),

    #[error("\"{0}\" changed on disk since Keepenv loaded it.")]
    Conflict(String),

    #[error("\"{0}\" is not a regular file.")]
    NotARegularFile(String),

    #[error("\"{0}\" is not valid UTF-8 text.")]
    NotUtf8(String),

    #[error("\"{0}\" is too large to edit safely.")]
    TooLarge(String),

    #[error("Could not move \"{0}\" to the Trash.")]
    TrashFailed(String),

    #[error("Filesystem error: {0}")]
    Io(String),

    #[error("Could not save Keepenv's settings: {0}")]
    Store(String),
}

impl AppError {
    /// Stable machine-readable discriminant for the UI.
    pub fn kind(&self) -> &'static str {
        match self {
            Self::ProjectNotFound => "projectNotFound",
            Self::InvalidFileName(_) => "invalidFileName",
            Self::InvalidProjectRoot => "invalidProjectRoot",
            Self::PathEscapesRoot => "pathEscapesRoot",
            Self::FileNotFound(_) => "fileNotFound",
            Self::FileAlreadyExists(_) => "fileAlreadyExists",
            Self::Conflict(_) => "conflict",
            Self::NotARegularFile(_) => "notARegularFile",
            Self::NotUtf8(_) => "notUtf8",
            Self::TooLarge(_) => "tooLarge",
            Self::TrashFailed(_) => "trashFailed",
            Self::Io(_) => "io",
            Self::Store(_) => "store",
        }
    }
}

impl From<std::io::Error> for AppError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value.to_string())
    }
}

/// Serialized to the frontend as `{ kind, message }`.
impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("AppError", 2)?;
        state.serialize_field("kind", self.kind())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

pub type AppResult<T> = Result<T, AppError>;
