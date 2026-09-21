//! Finder integration.
//!
//! `reveal_item_in_dir` is called from Rust rather than granting the webview
//! the `opener` plugin permissions. That keeps `opener:allow-open-url` — which
//! would be a way to send data out of the machine — off the capability list
//! entirely.

use tauri::{Manager, State};

use crate::error::{AppError, AppResult};
use crate::paths::{canonical_root, resolve_env_file};
use crate::store::AppState;

#[tauri::command]
pub fn reveal_project(state: State<'_, AppState>, project_id: String) -> AppResult<()> {
    let root = canonical_root(&state.store().find_project(&project_id)?.root_path)?;
    tauri_plugin_opener::reveal_item_in_dir(&root).map_err(|e| AppError::Io(e.to_string()))
}

#[tauri::command]
pub fn reveal_env_file(
    state: State<'_, AppState>,
    project_id: String,
    file_name: String,
) -> AppResult<()> {
    let root_path = state.store().find_project(&project_id)?.root_path;
    let path = resolve_env_file(&root_path, &file_name)?;
    if !path.exists() {
        return Err(AppError::FileNotFound(file_name));
    }
    tauri_plugin_opener::reveal_item_in_dir(&path).map_err(|e| AppError::Io(e.to_string()))
}

/// The absolute path of a project root, for the "Copy path" action.
#[tauri::command]
pub fn project_path(state: State<'_, AppState>, project_id: String) -> AppResult<String> {
    Ok(state.store().find_project(&project_id)?.root_path)
}

/// The user's home directory, used only to abbreviate paths as `~/...`.
#[tauri::command]
pub fn home_directory(app: tauri::AppHandle) -> Option<String> {
    app.path()
        .home_dir()
        .ok()
        .map(|path| path.to_string_lossy().to_string())
}
