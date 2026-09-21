//! Project registry commands.
//!
//! Removing a project only forgets it. Nothing in this module deletes,
//! moves or modifies anything inside a project folder.

use tauri::State;

use crate::error::AppResult;
use crate::model::Project;
use crate::store::AppState;

#[tauri::command]
pub fn list_projects(state: State<'_, AppState>) -> Vec<Project> {
    state.store().projects()
}

#[tauri::command]
pub fn add_project(state: State<'_, AppState>, root_path: String) -> AppResult<Project> {
    state.store().add_project(&root_path)
}

#[tauri::command]
pub fn rename_project(state: State<'_, AppState>, id: String, name: String) -> AppResult<Project> {
    state.store().rename_project(&id, &name)
}

/// Forgets a project. The folder on disk is left untouched.
#[tauri::command]
pub fn remove_project(state: State<'_, AppState>, id: String) -> AppResult<()> {
    state.store().remove_project(&id)
}

#[tauri::command]
pub fn reorder_projects(state: State<'_, AppState>, ids: Vec<String>) -> AppResult<Vec<Project>> {
    state.store().reorder_projects(&ids)
}
