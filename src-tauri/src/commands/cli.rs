//! Launch target commands.

use tauri::State;

use crate::cli::PendingLaunch;
use crate::error::AppResult;
use crate::model::Project;
use crate::store::AppState;

/// Consumes the folder Keepenv was launched with, registering it as a project.
///
/// Returns `None` when the app was opened normally. Registering is idempotent:
/// running `keepenv .` twice in the same folder selects the existing project
/// rather than adding a duplicate.
#[tauri::command]
pub fn take_launch_target(
    pending: State<'_, PendingLaunch>,
    state: State<'_, AppState>,
) -> AppResult<Option<Project>> {
    let Some(path) = pending.take() else {
        return Ok(None);
    };
    let project = state.store().add_project(&path.to_string_lossy())?;
    Ok(Some(project))
}
