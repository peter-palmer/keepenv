//! Environment file commands.

use tauri::State;

use crate::env_files;
use crate::error::AppResult;
use crate::model::{EnvFileContents, EnvFileInfo, EnvFileWriteResult};
use crate::paths::{canonical_root, resolve_env_file};
use crate::store::AppState;

/// Looks up a registered project's root path, releasing the store lock before
/// any filesystem work happens.
fn root_of(state: &State<'_, AppState>, project_id: &str) -> AppResult<String> {
    Ok(state.store().find_project(project_id)?.root_path)
}

#[tauri::command]
pub fn list_env_files(
    state: State<'_, AppState>,
    project_id: String,
) -> AppResult<Vec<EnvFileInfo>> {
    let root = canonical_root(&root_of(&state, &project_id)?)?;
    env_files::discover(&root)
}

#[tauri::command]
pub fn read_env_file(
    state: State<'_, AppState>,
    project_id: String,
    file_name: String,
) -> AppResult<EnvFileContents> {
    let path = resolve_env_file(&root_of(&state, &project_id)?, &file_name)?;
    env_files::read(&path, &file_name)
}

/// Writes an environment file.
///
/// `expected_digest` is the fingerprint Keepenv recorded when it loaded the
/// file. Omitting it forces the write and is only reachable from an explicit
/// "overwrite anyway" choice in the conflict dialog.
#[tauri::command]
pub fn write_env_file(
    state: State<'_, AppState>,
    project_id: String,
    file_name: String,
    content: String,
    expected_digest: Option<String>,
) -> AppResult<EnvFileWriteResult> {
    let path = resolve_env_file(&root_of(&state, &project_id)?, &file_name)?;
    env_files::write(&path, &file_name, &content, expected_digest.as_deref())
}

#[tauri::command]
pub fn create_env_file(
    state: State<'_, AppState>,
    project_id: String,
    file_name: String,
) -> AppResult<()> {
    let path = resolve_env_file(&root_of(&state, &project_id)?, &file_name)?;
    env_files::create(&path, &file_name)
}

/// Moves an environment file to the Trash. Never deletes permanently.
#[tauri::command]
pub fn trash_env_file(
    state: State<'_, AppState>,
    project_id: String,
    file_name: String,
) -> AppResult<()> {
    let path = resolve_env_file(&root_of(&state, &project_id)?, &file_name)?;
    env_files::move_to_trash(&path, &file_name)
}
