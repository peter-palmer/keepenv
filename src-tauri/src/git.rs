//! Git awareness — read-only.
//!
//! Keepenv answers one question: "is this environment file exposed to Git?".
//! It never commits, never stages and never edits `.gitignore`.
//!
//! `git` is invoked with a fixed argument vector through `std::process::Command`
//! (no shell), and the file name has already passed
//! [`crate::paths::is_valid_env_file_name`], so there is no command- or
//! option-injection surface. The `--` separator is used regardless.

use std::path::Path;
use std::process::{Command, Output, Stdio};

use crate::model::{GitIgnoreState, GitStatus};

fn run_git(root: &Path, args: &[&str]) -> Option<Output> {
    Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        // Never let Git block on a credential or terminal prompt.
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_OPTIONAL_LOCKS", "0")
        .stdin(Stdio::null())
        .output()
        .ok()
}

/// Determines how Git treats `file_name` inside `root`.
pub fn ignore_status(root: &Path, file_name: &str) -> GitStatus {
    let Some(inside) = run_git(root, &["rev-parse", "--is-inside-work-tree"]) else {
        return GitStatus {
            state: GitIgnoreState::GitUnavailable,
        };
    };
    if !inside.status.success() || String::from_utf8_lossy(&inside.stdout).trim() != "true" {
        return GitStatus {
            state: GitIgnoreState::NoRepository,
        };
    }

    // A tracked file is the worst case: its contents are already in history,
    // and a `.gitignore` rule does not undo that.
    let tracked = run_git(root, &["ls-files", "--error-unmatch", "--", file_name])
        .map(|o| o.status.success())
        .unwrap_or(false);
    if tracked {
        return GitStatus {
            state: GitIgnoreState::Tracked,
        };
    }

    let ignored = run_git(root, &["check-ignore", "-q", "--", file_name])
        .map(|o| o.status.success())
        .unwrap_or(false);

    GitStatus {
        state: if ignored {
            GitIgnoreState::Ignored
        } else {
            GitIgnoreState::NotIgnored
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "keepenv-git-{tag}-{}-{:?}",
            std::process::id(),
            std::thread::current().id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    fn git_available() -> bool {
        Command::new("git")
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    }

    #[test]
    fn reports_no_repository_outside_a_work_tree() {
        if !git_available() {
            return;
        }
        let dir = temp_dir("norepo");
        // A bare temp directory may still sit inside someone's repository, so
        // only assert the two outcomes that mean "not a repo of its own".
        let status = ignore_status(&dir, ".env");
        assert!(matches!(
            status.state,
            GitIgnoreState::NoRepository | GitIgnoreState::NotIgnored | GitIgnoreState::Ignored
        ));
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn detects_ignored_tracked_and_exposed_files() {
        if !git_available() {
            return;
        }
        let dir = temp_dir("repo");
        let ok = Command::new("git")
            .arg("-C")
            .arg(&dir)
            .args(["init", "--quiet"])
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        if !ok {
            fs::remove_dir_all(&dir).ok();
            return;
        }

        fs::write(dir.join(".gitignore"), ".env.local\n").unwrap();
        fs::write(dir.join(".env.local"), "SECRET=1").unwrap();
        fs::write(dir.join(".env.example"), "SECRET=").unwrap();
        fs::write(dir.join(".env"), "SECRET=2").unwrap();

        assert_eq!(
            ignore_status(&dir, ".env.local").state,
            GitIgnoreState::Ignored
        );
        assert_eq!(
            ignore_status(&dir, ".env").state,
            GitIgnoreState::NotIgnored
        );

        Command::new("git")
            .arg("-C")
            .arg(&dir)
            .args(["add", "--", ".env.example"])
            .status()
            .ok();
        assert_eq!(
            ignore_status(&dir, ".env.example").state,
            GitIgnoreState::Tracked
        );

        fs::remove_dir_all(&dir).ok();
    }
}
