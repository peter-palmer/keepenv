//! Keepenv's local metadata store.
//!
//! A single JSON document in the OS application-config directory, holding the
//! project list and UI preferences. It is written atomically (temp file in the
//! same directory, then rename) so a crash mid-write cannot truncate it.
//!
//! # Security invariant
//!
//! Only [`Project`] and [`Preferences`] are persisted. Environment variable
//! names and values never reach this module — there is no API here that
//! accepts file contents.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::model::{Preferences, Project};
use crate::paths::canonical_root;
use crate::util::{epoch_millis, iso8601_now};

const STORE_VERSION: u32 = 1;
const STORE_FILE_NAME: &str = "keepenv.json";
const MAX_PROJECT_NAME_LEN: usize = 80;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreData {
    pub version: u32,
    #[serde(default)]
    pub projects: Vec<Project>,
    #[serde(default)]
    pub preferences: Preferences,
}

impl Default for StoreData {
    fn default() -> Self {
        Self {
            version: STORE_VERSION,
            projects: Vec::new(),
            preferences: Preferences::default(),
        }
    }
}

pub struct Store {
    path: PathBuf,
    data: StoreData,
}

impl Store {
    /// Loads the store from `dir`, falling back to an empty store.
    ///
    /// A file that cannot be parsed is preserved under a `.corrupt-*` name
    /// rather than being overwritten, so a user can recover their project list
    /// by hand if an upgrade ever goes wrong.
    pub fn load(dir: &Path) -> Self {
        let path = dir.join(STORE_FILE_NAME);
        let data = match fs::read_to_string(&path) {
            Ok(raw) => match serde_json::from_str::<StoreData>(&raw) {
                Ok(parsed) => parsed,
                Err(_) => {
                    let stamp = epoch_millis(std::time::SystemTime::now()).unwrap_or(0);
                    let backup = dir.join(format!("{STORE_FILE_NAME}.corrupt-{stamp}"));
                    let _ = fs::rename(&path, backup);
                    StoreData::default()
                }
            },
            Err(_) => StoreData::default(),
        };
        let mut store = Self { path, data };
        // Trust the persisted `order` on the way in, then make it dense.
        store.data.projects.sort_by_key(|p| p.order);
        store.renumber();
        store
    }

    pub fn preferences(&self) -> &Preferences {
        &self.data.preferences
    }

    /// Projects in display order.
    pub fn projects(&self) -> Vec<Project> {
        let mut projects = self.data.projects.clone();
        projects.sort_by_key(|p| p.order);
        projects
    }

    pub fn find_project(&self, id: &str) -> AppResult<Project> {
        self.data
            .projects
            .iter()
            .find(|p| p.id == id)
            .cloned()
            .ok_or(AppError::ProjectNotFound)
    }

    /// Registers a folder. Adding a folder that is already registered returns
    /// the existing entry instead of creating a duplicate.
    pub fn add_project(&mut self, root_path: &str) -> AppResult<Project> {
        let canonical = canonical_root(root_path)?;
        let canonical_str = canonical.to_string_lossy().to_string();

        if let Some(existing) = self
            .data
            .projects
            .iter()
            .find(|p| p.root_path == canonical_str)
        {
            return Ok(existing.clone());
        }

        let name = canonical
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .filter(|n| !n.is_empty())
            .unwrap_or_else(|| canonical_str.clone());

        let project = Project {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            root_path: canonical_str,
            added_at: iso8601_now(),
            order: self.data.projects.len() as u32,
        };
        self.data.projects.push(project.clone());
        self.save()?;
        Ok(project)
    }

    pub fn rename_project(&mut self, id: &str, name: &str) -> AppResult<Project> {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Err(AppError::Store("A project name cannot be empty.".into()));
        }
        let truncated: String = trimmed.chars().take(MAX_PROJECT_NAME_LEN).collect();

        let project = self
            .data
            .projects
            .iter_mut()
            .find(|p| p.id == id)
            .ok_or(AppError::ProjectNotFound)?;
        project.name = truncated;
        let updated = project.clone();
        self.save()?;
        Ok(updated)
    }

    /// Removes a project from Keepenv. Never touches the project folder.
    pub fn remove_project(&mut self, id: &str) -> AppResult<()> {
        let before = self.data.projects.len();
        self.data.projects.retain(|p| p.id != id);
        if self.data.projects.len() == before {
            return Err(AppError::ProjectNotFound);
        }
        if self.data.preferences.last_project_id.as_deref() == Some(id) {
            self.data.preferences.last_project_id = None;
        }
        self.renumber();
        self.save()
    }

    /// Applies a new display order. Ids missing from `ids` keep their relative
    /// order and are appended, so a stale UI cannot drop projects.
    pub fn reorder_projects(&mut self, ids: &[String]) -> AppResult<Vec<Project>> {
        let mut ordered: Vec<Project> = Vec::with_capacity(self.data.projects.len());
        for id in ids {
            if let Some(project) = self.data.projects.iter().find(|p| &p.id == id) {
                if !ordered.iter().any(|p| p.id == project.id) {
                    ordered.push(project.clone());
                }
            }
        }
        let mut remaining: Vec<Project> = self
            .data
            .projects
            .iter()
            .filter(|p| !ordered.iter().any(|o| o.id == p.id))
            .cloned()
            .collect();
        remaining.sort_by_key(|p| p.order);
        ordered.extend(remaining);

        self.data.projects = ordered;
        self.renumber();
        self.save()?;
        Ok(self.projects())
    }

    pub fn set_preferences(&mut self, preferences: Preferences) -> AppResult<Preferences> {
        self.data.preferences = preferences;
        self.save()?;
        Ok(self.data.preferences.clone())
    }

    /// Makes `order` dense and consistent with the current vector order.
    ///
    /// This must never re-sort by the existing `order` values: after
    /// [`Self::reorder_projects`] the vector *is* the new order, and sorting
    /// by the stale values would silently undo the user's drag.
    fn renumber(&mut self) {
        for (index, project) in self.data.projects.iter_mut().enumerate() {
            project.order = index as u32;
        }
    }

    fn save(&mut self) -> AppResult<()> {
        self.data.version = STORE_VERSION;

        let parent = self
            .path
            .parent()
            .ok_or_else(|| AppError::Store("No configuration directory.".into()))?;
        fs::create_dir_all(parent).map_err(|e| AppError::Store(e.to_string()))?;

        let serialized =
            serde_json::to_string_pretty(&self.data).map_err(|e| AppError::Store(e.to_string()))?;

        let temp = self.path.with_extension("json.tmp");
        fs::write(&temp, serialized).map_err(|e| AppError::Store(e.to_string()))?;
        fs::rename(&temp, &self.path).map_err(|e| AppError::Store(e.to_string()))?;
        Ok(())
    }
}

/// Tauri-managed application state.
pub struct AppState {
    pub store: Mutex<Store>,
}

impl AppState {
    pub fn new(config_dir: &Path) -> Self {
        Self {
            store: Mutex::new(Store::load(config_dir)),
        }
    }

    /// Locks the store, recovering from a poisoned mutex rather than panicking.
    pub fn store(&self) -> std::sync::MutexGuard<'_, Store> {
        self.store.lock().unwrap_or_else(|e| e.into_inner())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "keepenv-store-{tag}-{}-{:?}",
            std::process::id(),
            std::thread::current().id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    #[test]
    fn adds_and_persists_projects() {
        let dir = temp_dir("add");
        let project_dir = dir.join("my-app");
        fs::create_dir_all(&project_dir).expect("project dir");

        let mut store = Store::load(&dir);
        let added = store
            .add_project(&project_dir.to_string_lossy())
            .expect("adds");
        assert_eq!(added.name, "my-app");
        assert_eq!(added.order, 0);

        // Adding the same folder again is a no-op.
        let again = store
            .add_project(&project_dir.to_string_lossy())
            .expect("adds");
        assert_eq!(again.id, added.id);
        assert_eq!(store.projects().len(), 1);

        // Reloading from disk keeps the project.
        let reloaded = Store::load(&dir);
        assert_eq!(reloaded.projects().len(), 1);
        assert_eq!(reloaded.projects()[0].id, added.id);

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn removing_a_project_leaves_the_folder_alone() {
        let dir = temp_dir("remove");
        let project_dir = dir.join("keep-me");
        fs::create_dir_all(&project_dir).expect("project dir");
        fs::write(project_dir.join(".env"), "A=1").expect("env file");

        let mut store = Store::load(&dir);
        let added = store
            .add_project(&project_dir.to_string_lossy())
            .expect("adds");
        store.remove_project(&added.id).expect("removes");

        assert!(store.projects().is_empty());
        assert!(
            project_dir.join(".env").exists(),
            "project files must survive"
        );

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn reordering_keeps_every_project() {
        let dir = temp_dir("reorder");
        let mut store = Store::load(&dir);
        let mut ids = Vec::new();
        for name in ["a", "b", "c"] {
            let project_dir = dir.join(name);
            fs::create_dir_all(&project_dir).expect("project dir");
            ids.push(
                store
                    .add_project(&project_dir.to_string_lossy())
                    .expect("adds")
                    .id,
            );
        }

        // Only mention the last id; the rest must be retained.
        let reordered = store.reorder_projects(&[ids[2].clone()]).expect("reorders");
        assert_eq!(reordered.len(), 3);
        assert_eq!(reordered[0].id, ids[2]);
        assert_eq!(reordered[0].order, 0);
        assert_eq!(reordered[2].order, 2);

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_corrupt_store_is_preserved_not_overwritten() {
        let dir = temp_dir("corrupt");
        fs::write(dir.join(STORE_FILE_NAME), "{ not json").expect("write");

        let store = Store::load(&dir);
        assert!(store.projects().is_empty());

        let backups: Vec<_> = fs::read_dir(&dir)
            .expect("read dir")
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().contains(".corrupt-"))
            .collect();
        assert_eq!(backups.len(), 1, "the unreadable file must be kept");

        fs::remove_dir_all(&dir).ok();
    }
}
