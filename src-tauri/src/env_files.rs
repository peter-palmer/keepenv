//! Reading, writing and discovering environment files.
//!
//! Every function here takes an already-validated path produced by
//! [`crate::paths::resolve_env_file`]; none of them accept a path from the
//! webview directly.
//!
//! # Security
//!
//! File contents pass through this module in memory only. They are never
//! logged, never written anywhere other than the user's own file, and never
//! included in error messages.

use std::fs::{self, File};
use std::io::Write;
use std::path::Path;

use sha2::{Digest, Sha256};

use crate::error::{AppError, AppResult};
use crate::model::{EnvFileContents, EnvFileInfo, EnvFileWriteResult};
use crate::paths::is_valid_env_file_name;
use crate::util::{epoch_millis, to_hex};

/// Environment files are configuration, not data sets. Anything larger than
/// this is refused rather than loaded into the editor.
const MAX_FILE_BYTES: u64 = 2 * 1024 * 1024;

/// SHA-256 of the file's bytes, used to detect external modification.
pub fn digest(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    to_hex(&hasher.finalize())
}

/// Lists the environment files directly inside `root`.
///
/// Deliberately non-recursive: only the project root is inspected, so
/// `node_modules`, `.git`, `dist`, `build`, `.next` and `vendor` are never
/// walked. Monorepo discovery is explicitly out of scope for v1.
pub fn discover(root: &Path) -> AppResult<Vec<EnvFileInfo>> {
    let entries = fs::read_dir(root)?;
    let mut files = Vec::new();

    for entry in entries.flatten() {
        let file_name = entry.file_name();
        let Some(name) = file_name.to_str() else {
            continue;
        };
        if !is_valid_env_file_name(name) {
            continue;
        }

        let is_symlink = entry.file_type().map(|t| t.is_symlink()).unwrap_or(false);

        // Follows symlinks: a `.env` pointing at a shared file is still a file.
        let Ok(metadata) = fs::metadata(entry.path()) else {
            continue;
        };
        if !metadata.is_file() {
            continue;
        }

        files.push(EnvFileInfo {
            name: name.to_string(),
            size_bytes: metadata.len(),
            modified_at_ms: metadata.modified().ok().and_then(epoch_millis),
            is_symlink,
        });
    }

    files.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(files)
}

/// Reads an environment file as UTF-8 text.
pub fn read(path: &Path, name: &str) -> AppResult<EnvFileContents> {
    let metadata = fs::metadata(path).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => AppError::FileNotFound(name.to_string()),
        _ => AppError::Io(e.to_string()),
    })?;
    if !metadata.is_file() {
        return Err(AppError::NotARegularFile(name.to_string()));
    }
    if metadata.len() > MAX_FILE_BYTES {
        return Err(AppError::TooLarge(name.to_string()));
    }

    let bytes = fs::read(path)?;
    let content =
        String::from_utf8(bytes.clone()).map_err(|_| AppError::NotUtf8(name.to_string()))?;

    Ok(EnvFileContents {
        name: name.to_string(),
        digest: digest(&bytes),
        size_bytes: metadata.len(),
        modified_at_ms: metadata.modified().ok().and_then(epoch_millis),
        content,
    })
}

/// Writes an environment file.
///
/// When `expected_digest` is supplied, the file on disk must still match it or
/// the write is refused with [`AppError::Conflict`]. Passing `None` is a
/// deliberate force-overwrite and is only reachable from an explicit choice in
/// the conflict dialog.
///
/// The write is atomic (temp file + rename) so an interrupted save cannot
/// truncate a `.env`. When the target is a symlink the rename is applied to
/// the link's target, which keeps the link intact.
pub fn write(
    path: &Path,
    name: &str,
    content: &str,
    expected_digest: Option<&str>,
) -> AppResult<EnvFileWriteResult> {
    if let Some(expected) = expected_digest {
        match fs::read(path) {
            Ok(current) => {
                if digest(&current) != expected {
                    return Err(AppError::Conflict(name.to_string()));
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                // The file was removed outside Keepenv since it was loaded.
                return Err(AppError::Conflict(name.to_string()));
            }
            Err(e) => return Err(AppError::Io(e.to_string())),
        }
    }

    // Resolve symlinks so the rename replaces the target, not the link.
    let target = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let directory = target
        .parent()
        .ok_or_else(|| AppError::Io("The file has no parent directory.".into()))?;

    // The temp name must not itself look like an environment file, or a
    // concurrent discovery could show it as a tab.
    let temp_path = directory.join(format!(
        ".tmp-keepenv-{}-{}",
        std::process::id(),
        name.trim_start_matches('.')
    ));

    let write_result = (|| -> std::io::Result<()> {
        let mut file = File::create(&temp_path)?;
        file.write_all(content.as_bytes())?;
        file.sync_all()?;
        Ok(())
    })();

    if let Err(e) = write_result {
        let _ = fs::remove_file(&temp_path);
        return Err(AppError::Io(e.to_string()));
    }

    // Preserve the original file's permissions where there is one.
    if let Ok(metadata) = fs::metadata(&target) {
        let _ = fs::set_permissions(&temp_path, metadata.permissions());
    }

    if let Err(e) = fs::rename(&temp_path, &target) {
        let _ = fs::remove_file(&temp_path);
        return Err(AppError::Io(e.to_string()));
    }

    let metadata = fs::metadata(&target)?;
    Ok(EnvFileWriteResult {
        digest: digest(content.as_bytes()),
        size_bytes: metadata.len(),
        modified_at_ms: metadata.modified().ok().and_then(epoch_millis),
    })
}

/// Creates a new, empty environment file. Fails if one already exists.
pub fn create(path: &Path, name: &str) -> AppResult<()> {
    match File::options().write(true).create_new(true).open(path) {
        Ok(_) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
            Err(AppError::FileAlreadyExists(name.to_string()))
        }
        Err(e) => Err(AppError::Io(e.to_string())),
    }
}

/// Moves an environment file to the Trash.
///
/// Never falls back to a permanent delete: if the Trash is unavailable the
/// operation fails and the file stays where it is.
pub fn move_to_trash(path: &Path, name: &str) -> AppResult<()> {
    if !path.exists() {
        return Err(AppError::FileNotFound(name.to_string()));
    }
    trash::delete(path).map_err(|_| AppError::TrashFailed(name.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "keepenv-files-{tag}-{}-{:?}",
            std::process::id(),
            std::thread::current().id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    #[test]
    fn discovery_finds_only_env_files_in_the_root() {
        let dir = temp_dir("discover");
        fs::write(dir.join(".env"), "A=1").unwrap();
        fs::write(dir.join(".env.local"), "B=2").unwrap();
        fs::write(dir.join(".env.production"), "C=3").unwrap();
        fs::write(dir.join("package.json"), "{}").unwrap();
        fs::write(dir.join(".envrc"), "use flake").unwrap();
        fs::create_dir_all(dir.join("node_modules")).unwrap();
        fs::write(dir.join("node_modules/.env"), "NESTED=1").unwrap();

        let found = discover(&dir).expect("discovers");
        let names: Vec<_> = found.iter().map(|f| f.name.as_str()).collect();
        assert_eq!(names, vec![".env", ".env.local", ".env.production"]);

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn write_refuses_when_the_file_changed_on_disk() {
        let dir = temp_dir("conflict");
        let path = dir.join(".env");
        fs::write(&path, "A=1\n").unwrap();

        let loaded = read(&path, ".env").expect("reads");

        // Something else edits the file.
        fs::write(&path, "A=2\n").unwrap();

        let result = write(&path, ".env", "A=3\n", Some(&loaded.digest));
        assert!(matches!(result, Err(AppError::Conflict(_))));
        assert_eq!(fs::read_to_string(&path).unwrap(), "A=2\n");

        // Forcing is allowed when the caller passes no expectation.
        write(&path, ".env", "A=3\n", None).expect("force writes");
        assert_eq!(fs::read_to_string(&path).unwrap(), "A=3\n");

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn write_preserves_bytes_exactly() {
        let dir = temp_dir("bytes");
        let path = dir.join(".env");
        let original = "# comment\r\n\r\nKEY='a=b'\nOTHER=\n";
        fs::write(&path, original).unwrap();

        let loaded = read(&path, ".env").expect("reads");
        assert_eq!(loaded.content, original);

        write(&path, ".env", &loaded.content, Some(&loaded.digest)).expect("writes");
        assert_eq!(fs::read_to_string(&path).unwrap(), original);

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn create_refuses_to_clobber() {
        let dir = temp_dir("create");
        let path = dir.join(".env.staging");
        create(&path, ".env.staging").expect("creates");
        assert_eq!(fs::read_to_string(&path).unwrap(), "");

        let again = create(&path, ".env.staging");
        assert!(matches!(again, Err(AppError::FileAlreadyExists(_))));

        fs::remove_dir_all(&dir).ok();
    }
}
