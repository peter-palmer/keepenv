//! Read-only Git status command.

use tauri::State;

use crate::error::{AppError, AppResult};
use crate::git;
use crate::model::GitStatus;
use crate::paths::{canonical_root, is_valid_env_file_name};
use crate::store::AppState;

#[tauri::command]
pub fn git_status(
    state: State<'_, AppState>,
    project_id: String,
    file_name: String,
) -> AppResult<GitStatus> {
    if !is_valid_env_file_name(&file_name) {
        return Err(AppError::InvalidFileName(file_name));
    }
    let root_path = state.store().find_project(&project_id)?.root_path;
    let root = canonical_root(&root_path)?;
    Ok(git::ignore_status(&root, &file_name))
}
