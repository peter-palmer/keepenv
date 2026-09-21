//! Path validation — the security chokepoint of Keepenv.
//!
//! Every filesystem operation exposed to the webview routes through
//! [`resolve_env_file`]. The webview can never name a path directly: it passes
//! a project id (looked up in Keepenv's own store) and a *file name* that must
//! match the `.env` family and contain no path separators. This makes it
//! structurally impossible for the UI layer — or anything injected into it —
//! to reach `~/.ssh/id_rsa` or any other file outside a registered project.

use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};

/// Upper bound on an environment file name, in bytes.
const MAX_FILE_NAME_LEN: usize = 100;

/// Returns true when `name` is a legal environment file name.
///
/// Accepted: `.env`, and `.env` followed by one of `.`, `-` or `_`, then an
/// alphanumeric character, then any of `[A-Za-z0-9._-]`.
///
/// Rejected: anything containing a path separator, `..`, a NUL byte, or
/// non-ASCII characters.
pub fn is_valid_env_file_name(name: &str) -> bool {
    if name.is_empty() || name.len() > MAX_FILE_NAME_LEN {
        return false;
    }
    if name.contains('/') || name.contains('\\') || name.contains('\0') || name.contains("..") {
        return false;
    }
    let Some(rest) = name.strip_prefix(".env") else {
        return false;
    };
    if rest.is_empty() {
        return true;
    }

    let mut chars = rest.chars();
    // The separator that follows `.env`.
    match chars.next() {
        Some('.') | Some('-') | Some('_') => {}
        _ => return false,
    }
    // The suffix must start alphanumeric and stay within a safe alphabet.
    match chars.next() {
        Some(c) if c.is_ascii_alphanumeric() => {}
        _ => return false,
    }
    chars.all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_')
}

/// Canonicalizes a project root, verifying it still exists and is a directory.
pub fn canonical_root(root: &str) -> AppResult<PathBuf> {
    let path = Path::new(root);
    let canonical = path
        .canonicalize()
        .map_err(|_| AppError::InvalidProjectRoot)?;
    if !canonical.is_dir() {
        return Err(AppError::InvalidProjectRoot);
    }
    Ok(canonical)
}

/// Resolves `file_name` inside `root`, rejecting anything that would escape.
///
/// Because the name is validated to contain no separators and no `..`, the
/// join cannot traverse upwards; the explicit prefix check below is a second
/// line of defence that also covers platform quirks.
///
/// Symlinks are deliberately followed on read/write (a `.env` symlinked into a
/// shared folder is a legitimate setup, and every other editor honours it).
/// The *link* itself must still live directly in the project root, which the
/// name validation guarantees.
pub fn resolve_env_file(root: &str, file_name: &str) -> AppResult<PathBuf> {
    if !is_valid_env_file_name(file_name) {
        return Err(AppError::InvalidFileName(file_name.to_string()));
    }
    let canonical = canonical_root(root)?;
    let candidate = canonical.join(file_name);

    if !candidate.starts_with(&canonical) {
        return Err(AppError::PathEscapesRoot);
    }
    if candidate.parent() != Some(canonical.as_path()) {
        return Err(AppError::PathEscapesRoot);
    }
    Ok(candidate)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_the_env_family() {
        for name in [
            ".env",
            ".env.local",
            ".env.production",
            ".env.production.local",
            ".env-staging",
            ".env_test",
            ".env.example",
            ".env.1",
        ] {
            assert!(is_valid_env_file_name(name), "should accept {name}");
        }
    }

    #[test]
    fn rejects_traversal_and_separators() {
        for name in [
            "../.env",
            ".env/../../etc/passwd",
            ".env/..",
            "..",
            ".env\\..\\secrets",
            "/etc/passwd",
            ".env\0.local",
            ".env..local",
        ] {
            assert!(!is_valid_env_file_name(name), "should reject {name:?}");
        }
    }

    #[test]
    fn rejects_non_env_names() {
        for name in [
            "",
            "env",
            "package.json",
            ".environment.json",
            ".git",
            ".envrc",
            ".env.",
            ".env-",
            ".env..",
            ".env.é",
        ] {
            assert!(!is_valid_env_file_name(name), "should reject {name:?}");
        }
    }

    #[test]
    fn rejects_overlong_names() {
        let long = format!(".env.{}", "a".repeat(MAX_FILE_NAME_LEN));
        assert!(!is_valid_env_file_name(&long));
    }

    #[test]
    fn resolve_keeps_files_inside_the_root() {
        let dir = std::env::temp_dir().join(format!("keepenv-paths-{}", std::process::id()));
        std::fs::create_dir_all(&dir).expect("temp dir");
        let root = dir.to_string_lossy().to_string();

        let resolved = resolve_env_file(&root, ".env.local").expect("valid name resolves");
        assert!(resolved.starts_with(dir.canonicalize().expect("canonical")));
        assert_eq!(
            resolved.file_name().and_then(|n| n.to_str()),
            Some(".env.local")
        );

        assert!(resolve_env_file(&root, "../.env").is_err());
        assert!(resolve_env_file(&root, ".ssh/id_rsa").is_err());

        std::fs::remove_dir_all(&dir).ok();
    }
}
