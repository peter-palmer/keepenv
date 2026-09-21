//! Data types shared across the IPC boundary.
//!
//! # Security invariant
//!
//! [`Project`] and [`Preferences`] are the *only* structures Keepenv persists.
//! Both have a closed set of scalar fields and neither contains a free-form
//! map, so there is no representable way for the UI to store an environment
//! variable name or value in Keepenv's own storage. Keep it that way: never
//! add an untyped `extra` / `HashMap<String, Value>` field here.

use serde::{Deserialize, Serialize};

/// A project folder the user has added to Keepenv.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub root_path: String,
    pub added_at: String,
    pub order: u32,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThemePreference {
    #[default]
    System,
    Light,
    Dark,
}

/// UI preferences. Metadata only — never environment data.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Preferences {
    pub theme: ThemePreference,
    pub last_project_id: Option<String>,
}

/// An environment file discovered in a project root.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvFileInfo {
    pub name: String,
    pub size_bytes: u64,
    pub modified_at_ms: Option<u64>,
    pub is_symlink: bool,
}

/// The contents of an environment file, plus the fingerprint used to detect
/// external modification before a save.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvFileContents {
    pub name: String,
    pub content: String,
    pub digest: String,
    pub size_bytes: u64,
    pub modified_at_ms: Option<u64>,
}

/// The result of a successful write.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvFileWriteResult {
    pub digest: String,
    pub size_bytes: u64,
    pub modified_at_ms: Option<u64>,
}

/// How Git treats an environment file.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum GitIgnoreState {
    /// The project is not inside a Git working tree.
    NoRepository,
    /// The `git` executable could not be run.
    GitUnavailable,
    /// The file matches a `.gitignore` rule and is not tracked.
    Ignored,
    /// The file is committed to the repository — secrets may already be in history.
    Tracked,
    /// The file is neither ignored nor tracked; committing it would add it.
    NotIgnored,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub state: GitIgnoreState,
}
