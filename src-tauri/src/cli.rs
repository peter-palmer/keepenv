//! Command line launch arguments.
//!
//! Keepenv can be opened from a terminal with `keepenv .`, the way editors
//! like VS Code and Windsurf work. The shell wrapper in `scripts/keepenv`
//! passes the folder as a single argument; this module turns that argument
//! into a validated directory.
//!
//! Resolution happens here rather than in the webview so the rule that the
//! interface never names a path on its own still holds.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// Extracts the project folder from a launch argument vector.
///
/// Skips the executable name and anything that looks like a flag — macOS
/// passes `-psn_0_…` when an app is opened through LaunchServices, so a
/// leading `-` is never a path.
///
/// Relative paths resolve against `cwd`, which is the directory the shell
/// wrapper ran in. The result is canonicalised and must be a directory.
pub fn project_path_from_args(args: &[String], cwd: Option<&Path>) -> Option<PathBuf> {
    let candidate = args
        .iter()
        .skip(1)
        .find(|argument| !argument.starts_with('-') && !argument.is_empty())?;

    let path = PathBuf::from(candidate);
    let absolute = if path.is_absolute() {
        path
    } else {
        cwd?.join(path)
    };

    let canonical = absolute.canonicalize().ok()?;
    if canonical.is_dir() {
        Some(canonical)
    } else {
        None
    }
}

/// A folder passed on the command line that the interface has not consumed yet.
///
/// Needed because a cold start parses its arguments before the webview is
/// listening for events. The UI drains this once on mount; later invocations
/// of `keepenv` arrive as events instead.
#[derive(Default)]
pub struct PendingLaunch {
    path: Mutex<Option<PathBuf>>,
}

impl PendingLaunch {
    pub fn set(&self, path: PathBuf) {
        let mut guard = self.path.lock().unwrap_or_else(|e| e.into_inner());
        *guard = Some(path);
    }

    pub fn take(&self) -> Option<PathBuf> {
        let mut guard = self.path.lock().unwrap_or_else(|e| e.into_inner());
        guard.take()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn workspace(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "keepenv-cli-{tag}-{}-{:?}",
            std::process::id(),
            std::thread::current().id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("workspace");
        dir.canonicalize().expect("canonical")
    }

    fn argv(items: &[&str]) -> Vec<String> {
        items.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn resolves_an_absolute_directory() {
        let dir = workspace("abs");
        let args = argv(&["keepenv", &dir.to_string_lossy()]);
        assert_eq!(project_path_from_args(&args, None), Some(dir.clone()));
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn resolves_dot_against_the_shell_working_directory() {
        let dir = workspace("dot");
        let args = argv(&["keepenv", "."]);
        assert_eq!(project_path_from_args(&args, Some(&dir)), Some(dir.clone()));
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn resolves_a_relative_subdirectory() {
        let dir = workspace("relative");
        let nested = dir.join("project");
        fs::create_dir_all(&nested).expect("nested");
        let args = argv(&["keepenv", "project"]);
        assert_eq!(
            project_path_from_args(&args, Some(&dir)),
            Some(nested.canonicalize().expect("canonical"))
        );
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn ignores_flags_including_the_launchservices_serial_number() {
        let dir = workspace("flags");
        // Finder and `open` append a process serial number argument.
        let args = argv(&["keepenv", "-psn_0_1234567", &dir.to_string_lossy()]);
        assert_eq!(project_path_from_args(&args, None), Some(dir.clone()));

        let only_flags = argv(&["keepenv", "-psn_0_1234567"]);
        assert_eq!(project_path_from_args(&only_flags, Some(&dir)), None);
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn rejects_files_and_missing_paths() {
        let dir = workspace("reject");
        let file = dir.join("notes.txt");
        fs::write(&file, "x").expect("file");

        assert_eq!(
            project_path_from_args(&argv(&["keepenv", &file.to_string_lossy()]), None),
            None,
            "a file is not a project folder"
        );
        assert_eq!(
            project_path_from_args(&argv(&["keepenv", "does-not-exist"]), Some(&dir)),
            None
        );
        assert_eq!(
            project_path_from_args(&argv(&["keepenv"]), Some(&dir)),
            None
        );
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_relative_path_without_a_working_directory_is_refused() {
        assert_eq!(project_path_from_args(&argv(&["keepenv", "."]), None), None);
    }

    #[test]
    fn pending_launch_is_consumed_once() {
        let pending = PendingLaunch::default();
        assert_eq!(pending.take(), None);

        pending.set(PathBuf::from("/tmp/example"));
        assert_eq!(pending.take(), Some(PathBuf::from("/tmp/example")));
        assert_eq!(pending.take(), None, "draining twice must not repeat");
    }
}
