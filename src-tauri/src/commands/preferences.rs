//! UI preference commands.
//!
//! [`Preferences`] is a closed struct of scalars, so this command cannot be
//! used to persist environment data.

use tauri::State;

use crate::error::AppResult;
use crate::model::Preferences;
use crate::store::AppState;

#[tauri::command]
pub fn get_preferences(state: State<'_, AppState>) -> Preferences {
    state.store().preferences().clone()
}

#[tauri::command]
pub fn set_preferences(
    state: State<'_, AppState>,
    preferences: Preferences,
) -> AppResult<Preferences> {
    state.store().set_preferences(preferences)
}
