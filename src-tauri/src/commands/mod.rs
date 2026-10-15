//! The complete IPC surface of Keepenv.
//!
//! These commands are the *only* way the webview can touch the filesystem.
//! There is no generic "read file" or "run command" primitive: every entry
//! point takes a project id (resolved against Keepenv's own store) plus an
//! environment file name that must pass
//! [`crate::paths::is_valid_env_file_name`].

pub mod cli;
pub mod env_files;
pub mod git;
pub mod preferences;
pub mod projects;
pub mod system;
