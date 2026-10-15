//! Keepenv — a local-only environment file manager.
//!
//! # Boundaries
//!
//! * The webview holds no absolute paths it can act on and has no generic
//!   filesystem, shell or network access. Everything goes through the typed
//!   commands in [`commands`].
//! * [`paths`] is the single place that turns untrusted input into a path.
//! * [`cli`] is the only other place a path enters the app, from the terminal
//!   wrapper, and it validates the folder before anything else sees it.
//! * [`store`] persists project metadata and preferences only — never the
//!   contents of an environment file.
//! * Nothing in this crate performs a network request.

mod cli;
mod commands;
mod env_files;
mod error;
mod git;
mod model;
mod paths;
mod store;
mod util;

use std::path::PathBuf;

use tauri::{Emitter, Manager};

use crate::cli::PendingLaunch;
use crate::store::AppState;

/// Emitted when `keepenv <folder>` runs while the app is already open.
const LAUNCH_TARGET_EVENT: &str = "keepenv://launch-target";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be registered first. A second `keepenv .` hands its arguments
        // to the running app and exits, instead of opening another window.
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }

            let working_directory = PathBuf::from(&cwd);
            let Some(path) = cli::project_path_from_args(&argv, Some(&working_directory)) else {
                return;
            };

            let registered = {
                let state = app.state::<AppState>();
                let mut store = state.store();
                store.add_project(&path.to_string_lossy())
            };
            if let Ok(project) = registered {
                let _ = app.emit(LAUNCH_TARGET_EVENT, project);
            }
        }))
        // Native folder picker. No other dialog permission is granted.
        .plugin(tauri_plugin_dialog::init())
        // Used from Rust only, to reveal items in Finder.
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let config_dir = app.path().app_config_dir()?;
            std::fs::create_dir_all(&config_dir)?;
            app.manage(AppState::new(&config_dir));
            app.manage(PendingLaunch::default());

            // A cold start parses its own arguments; the webview drains them
            // once it mounts.
            let args: Vec<String> = std::env::args().collect();
            let working_directory = std::env::current_dir().ok();
            if let Some(path) = cli::project_path_from_args(&args, working_directory.as_deref()) {
                app.state::<PendingLaunch>().set(path);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::projects::list_projects,
            commands::projects::add_project,
            commands::projects::rename_project,
            commands::projects::remove_project,
            commands::projects::reorder_projects,
            commands::env_files::list_env_files,
            commands::env_files::read_env_file,
            commands::env_files::write_env_file,
            commands::env_files::create_env_file,
            commands::env_files::trash_env_file,
            commands::git::git_status,
            commands::preferences::get_preferences,
            commands::preferences::set_preferences,
            commands::system::reveal_project,
            commands::system::reveal_env_file,
            commands::system::project_path,
            commands::system::home_directory,
            commands::cli::take_launch_target,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Keepenv");
}

#[cfg(test)]
mod workflow_tests {
    //! End-to-end exercise of the flow the UI drives: register a project,
    //! discover its environment files, read one, write it back, and confirm
    //! Keepenv's own storage never holds a value from those files.

    use std::fs;
    use std::path::PathBuf;

    use crate::env_files;
    use crate::git;
    use crate::model::GitIgnoreState;
    use crate::paths::resolve_env_file;
    use crate::store::Store;

    const SECRET: &str = "sk_test_do_not_persist_me";

    fn workspace(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "keepenv-workflow-{tag}-{}-{:?}",
            std::process::id(),
            std::thread::current().id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("workspace");
        dir
    }

    #[test]
    fn the_primary_flow_works_and_leaks_nothing_into_storage() {
        let root = workspace("primary");
        let config_dir = root.join("config");
        let project_dir = root.join("my-app");
        fs::create_dir_all(&config_dir).expect("config dir");
        fs::create_dir_all(project_dir.join("node_modules")).expect("project dir");

        let original = format!(
            "# Stripe configuration\n\nSTRIPE_SECRET_KEY=\"{SECRET}\"\n\n\
             # Database\nDATABASE_URL='postgres://localhost/test'\n\nEMPTY_VALUE=\n"
        );
        fs::write(project_dir.join(".env"), &original).expect("write .env");
        fs::write(project_dir.join(".env.local"), "DEBUG=true\n").expect("write .env.local");
        fs::write(project_dir.join("package.json"), "{}").expect("write package.json");
        fs::write(project_dir.join("node_modules/.env"), "HIDDEN=1").expect("write nested");

        // 1. The user picks the folder.
        let mut store = Store::load(&config_dir);
        let project = store
            .add_project(&project_dir.to_string_lossy())
            .expect("adds project");

        // 2. Environment files are discovered — root only.
        let files = env_files::discover(&PathBuf::from(&project.root_path)).expect("discovers");
        let names: Vec<&str> = files.iter().map(|f| f.name.as_str()).collect();
        assert_eq!(names, vec![".env", ".env.local"]);

        // 3. The file is read.
        let path = resolve_env_file(&project.root_path, ".env").expect("resolves");
        let loaded = env_files::read(&path, ".env").expect("reads");
        assert_eq!(loaded.content, original);

        // 4. One variable is edited and the file is written back.
        let edited = loaded
            .content
            .replace("postgres://localhost/test", "postgres://localhost/prod");
        env_files::write(&path, ".env", &edited, Some(&loaded.digest)).expect("writes");

        // 5. Only the intended line changed.
        let after = fs::read_to_string(&path).expect("re-reads");
        assert_eq!(after, edited);
        assert!(after.contains("# Stripe configuration"));
        assert!(after.contains("# Database"));
        assert!(after.contains("EMPTY_VALUE=\n"));
        assert!(after.contains("DATABASE_URL='postgres://localhost/prod'"));

        // 6. Restarting Keepenv keeps the project.
        let reloaded = Store::load(&config_dir);
        let restored = reloaded.projects();
        assert_eq!(restored.len(), 1);
        assert_eq!(restored[0].root_path, project.root_path);

        // 7. Keepenv's storage holds metadata only — no values, no keys.
        let stored = fs::read_to_string(config_dir.join("keepenv.json")).expect("store file");
        assert!(!stored.contains(SECRET), "a secret reached Keepenv's store");
        assert!(!stored.contains("STRIPE_SECRET_KEY"));
        assert!(!stored.contains("DATABASE_URL"));
        assert!(!stored.contains("postgres"));
        assert!(stored.contains(&project.root_path));

        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn git_exposure_is_reported_for_a_real_repository() {
        let ok = std::process::Command::new("git")
            .arg("--version")
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        if !ok {
            return;
        }

        let root = workspace("git");
        let project_dir = root.join("repo");
        fs::create_dir_all(&project_dir).expect("project dir");
        if std::process::Command::new("git")
            .arg("-C")
            .arg(&project_dir)
            .args(["init", "--quiet"])
            .status()
            .map(|s| !s.success())
            .unwrap_or(true)
        {
            fs::remove_dir_all(&root).ok();
            return;
        }

        fs::write(project_dir.join(".gitignore"), ".env.local\n").expect("gitignore");
        fs::write(project_dir.join(".env.local"), "A=1").expect("local");
        fs::write(project_dir.join(".env"), "B=2").expect("env");

        assert_eq!(
            git::ignore_status(&project_dir, ".env.local").state,
            GitIgnoreState::Ignored
        );
        assert_eq!(
            git::ignore_status(&project_dir, ".env").state,
            GitIgnoreState::NotIgnored
        );

        fs::remove_dir_all(&root).ok();
    }
}
