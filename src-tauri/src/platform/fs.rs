use sha2::{Digest, Sha256};
use std::io;
use std::path::{Path, PathBuf};
use thiserror::Error;
use tokio::fs;
use tokio::io::AsyncReadExt;

#[derive(Error, Debug)]
pub enum FsError {
    #[error("IO error: {0}")]
    Io(#[from] io::Error),
    #[error("Path not found: {0}")]
    NotFound(PathBuf),
    #[error("Permission denied: {0}")]
    PermissionDenied(PathBuf),
    #[error("File already exists: {0}")]
    AlreadyExists(PathBuf),
    #[error("Invalid path: {0}")]
    InvalidPath(String),
}

pub type FsResult<T> = Result<T, FsError>;

pub async fn read_file(path: impl AsRef<Path>) -> FsResult<Vec<u8>> {
    let path = path.as_ref();
    fs::read(path).await.map_err(|e| match e.kind() {
        io::ErrorKind::NotFound => FsError::NotFound(path.to_path_buf()),
        io::ErrorKind::PermissionDenied => FsError::PermissionDenied(path.to_path_buf()),
        _ => FsError::Io(e),
    })
}

pub async fn read_file_string(path: impl AsRef<Path>) -> FsResult<String> {
    let path = path.as_ref();
    fs::read_to_string(path).await.map_err(|e| match e.kind() {
        io::ErrorKind::NotFound => FsError::NotFound(path.to_path_buf()),
        io::ErrorKind::PermissionDenied => FsError::PermissionDenied(path.to_path_buf()),
        _ => FsError::Io(e),
    })
}

pub async fn write_file(path: impl AsRef<Path>, contents: &[u8]) -> FsResult<()> {
    let path = path.as_ref();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await?;
    }
    fs::write(path, contents).await.map_err(|e| match e.kind() {
        io::ErrorKind::PermissionDenied => FsError::PermissionDenied(path.to_path_buf()),
        _ => FsError::Io(e),
    })
}

pub async fn write_file_string(path: impl AsRef<Path>, contents: &str) -> FsResult<()> {
    write_file(path, contents.as_bytes()).await
}

pub async fn write_file_atomic(path: impl AsRef<Path>, contents: &[u8]) -> FsResult<()> {
    let path = path.as_ref();
    let parent = path
        .parent()
        .ok_or_else(|| FsError::InvalidPath("No parent directory".into()))?;

    fs::create_dir_all(parent).await?;

    let temp_path = parent.join(format!(".{}.tmp", uuid::Uuid::new_v4()));

    let result = async {
        fs::write(&temp_path, contents).await?;
        fs::rename(&temp_path, path).await?;
        Ok::<_, io::Error>(())
    }
    .await;

    if result.is_err() {
        let _ = fs::remove_file(&temp_path).await;
    }

    result.map_err(FsError::Io)
}

pub async fn copy_file(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> FsResult<u64> {
    let src = src.as_ref();
    let dst = dst.as_ref();

    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent).await?;
    }

    fs::copy(src, dst).await.map_err(|e| match e.kind() {
        io::ErrorKind::NotFound => FsError::NotFound(src.to_path_buf()),
        io::ErrorKind::PermissionDenied => FsError::PermissionDenied(dst.to_path_buf()),
        _ => FsError::Io(e),
    })
}

pub async fn move_file(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> FsResult<()> {
    let src = src.as_ref();
    let dst = dst.as_ref();

    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent).await?;
    }

    fs::rename(src, dst).await.map_err(|e| match e.kind() {
        io::ErrorKind::NotFound => FsError::NotFound(src.to_path_buf()),
        io::ErrorKind::PermissionDenied => FsError::PermissionDenied(dst.to_path_buf()),
        _ => FsError::Io(e),
    })
}

pub async fn remove_file(path: impl AsRef<Path>) -> FsResult<()> {
    let path = path.as_ref();
    fs::remove_file(path).await.map_err(|e| match e.kind() {
        io::ErrorKind::NotFound => FsError::NotFound(path.to_path_buf()),
        io::ErrorKind::PermissionDenied => FsError::PermissionDenied(path.to_path_buf()),
        _ => FsError::Io(e),
    })
}

pub async fn remove_dir(path: impl AsRef<Path>) -> FsResult<()> {
    let path = path.as_ref();
    fs::remove_dir(path).await.map_err(|e| match e.kind() {
        io::ErrorKind::NotFound => FsError::NotFound(path.to_path_buf()),
        io::ErrorKind::PermissionDenied => FsError::PermissionDenied(path.to_path_buf()),
        _ => FsError::Io(e),
    })
}

pub async fn remove_dir_all(path: impl AsRef<Path>) -> FsResult<()> {
    let path = path.as_ref();
    fs::remove_dir_all(path).await.map_err(|e| match e.kind() {
        io::ErrorKind::NotFound => FsError::NotFound(path.to_path_buf()),
        io::ErrorKind::PermissionDenied => FsError::PermissionDenied(path.to_path_buf()),
        _ => FsError::Io(e),
    })
}

/// Move file to system trash/recycle bin (cross-platform)
/// Note: This is a blocking operation, should be called via spawn_blocking in async context
pub fn move_to_trash(path: impl AsRef<Path>) -> FsResult<()> {
    let path = path.as_ref();
    if !path.exists() {
        return Err(FsError::NotFound(path.to_path_buf()));
    }
    trash::delete(path).map_err(|e| FsError::Io(io::Error::other(e.to_string())))
}

/// Move multiple files to trash (batch operation)
pub fn move_to_trash_batch<P: AsRef<Path>>(paths: &[P]) -> FsResult<usize> {
    let valid_paths: Vec<&Path> = paths
        .iter()
        .map(|p| p.as_ref())
        .filter(|p| p.exists())
        .collect();
    let count = valid_paths.len();
    if count == 0 {
        return Ok(0);
    }
    trash::delete_all(&valid_paths).map_err(|e| FsError::Io(io::Error::other(e.to_string())))?;
    Ok(count)
}

/// Remove file with option to use trash or permanent delete
pub async fn remove_file_with_option(path: impl AsRef<Path>, use_trash: bool) -> FsResult<()> {
    let path = path.as_ref().to_path_buf();
    if use_trash {
        let path_clone = path.clone();
        tokio::task::spawn_blocking(move || move_to_trash(&path_clone))
            .await
            .map_err(|e| FsError::Io(io::Error::other(e.to_string())))??;
        Ok(())
    } else {
        remove_file(&path).await
    }
}

/// Remove directory with option to use trash or permanent delete
pub async fn remove_dir_with_option(path: impl AsRef<Path>, use_trash: bool) -> FsResult<()> {
    let path = path.as_ref().to_path_buf();
    if use_trash {
        let path_clone = path.clone();
        tokio::task::spawn_blocking(move || move_to_trash(&path_clone))
            .await
            .map_err(|e| FsError::Io(io::Error::other(e.to_string())))??;
        Ok(())
    } else {
        remove_dir_all(&path).await
    }
}

/// Batch remove files with option to use trash
pub async fn remove_files_batch(paths: Vec<PathBuf>, use_trash: bool) -> FsResult<usize> {
    if paths.is_empty() {
        return Ok(0);
    }

    if use_trash {
        tokio::task::spawn_blocking(move || move_to_trash_batch(&paths))
            .await
            .map_err(|e| FsError::Io(io::Error::other(e.to_string())))?
    } else {
        let mut count = 0;
        for path in paths {
            if exists(&path).await {
                remove_file(&path).await?;
                count += 1;
            }
        }
        Ok(count)
    }
}

pub async fn create_dir(path: impl AsRef<Path>) -> FsResult<()> {
    let path = path.as_ref();
    fs::create_dir(path).await.map_err(|e| match e.kind() {
        io::ErrorKind::AlreadyExists => FsError::AlreadyExists(path.to_path_buf()),
        io::ErrorKind::PermissionDenied => FsError::PermissionDenied(path.to_path_buf()),
        _ => FsError::Io(e),
    })
}

pub async fn create_dir_all(path: impl AsRef<Path>) -> FsResult<()> {
    let path = path.as_ref();
    fs::create_dir_all(path).await.map_err(|e| match e.kind() {
        io::ErrorKind::PermissionDenied => FsError::PermissionDenied(path.to_path_buf()),
        _ => FsError::Io(e),
    })
}

pub async fn exists(path: impl AsRef<Path>) -> bool {
    fs::try_exists(path).await.unwrap_or(false)
}

pub async fn is_file(path: impl AsRef<Path>) -> bool {
    fs::metadata(path)
        .await
        .map(|m| m.is_file())
        .unwrap_or(false)
}

pub async fn is_dir(path: impl AsRef<Path>) -> bool {
    fs::metadata(path)
        .await
        .map(|m| m.is_dir())
        .unwrap_or(false)
}

pub async fn file_size(path: impl AsRef<Path>) -> FsResult<u64> {
    let path = path.as_ref();
    let meta = fs::metadata(path).await.map_err(|e| match e.kind() {
        io::ErrorKind::NotFound => FsError::NotFound(path.to_path_buf()),
        _ => FsError::Io(e),
    })?;
    Ok(meta.len())
}

#[cfg(unix)]
pub async fn create_symlink(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> FsResult<()> {
    let src = src.as_ref();
    let dst = dst.as_ref();

    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent).await?;
    }

    tokio::fs::symlink(src, dst)
        .await
        .map_err(|e| match e.kind() {
            io::ErrorKind::AlreadyExists => FsError::AlreadyExists(dst.to_path_buf()),
            io::ErrorKind::PermissionDenied => FsError::PermissionDenied(dst.to_path_buf()),
            _ => FsError::Io(e),
        })
}

#[cfg(windows)]
pub async fn create_symlink(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> FsResult<()> {
    let src = src.as_ref();
    let dst = dst.as_ref();

    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent).await?;
    }

    let is_dir = is_dir(src).await;

    let result = if is_dir {
        tokio::fs::symlink_dir(src, dst).await
    } else {
        tokio::fs::symlink_file(src, dst).await
    };

    result.map_err(|e| match e.kind() {
        io::ErrorKind::AlreadyExists => FsError::AlreadyExists(dst.to_path_buf()),
        io::ErrorKind::PermissionDenied => FsError::PermissionDenied(dst.to_path_buf()),
        _ => FsError::Io(e),
    })
}

pub async fn calculate_sha256(path: impl AsRef<Path>) -> FsResult<String> {
    let path = path.as_ref();
    let mut file = tokio::fs::File::open(path)
        .await
        .map_err(|e| match e.kind() {
            io::ErrorKind::NotFound => FsError::NotFound(path.to_path_buf()),
            _ => FsError::Io(e),
        })?;

    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 8192];

    loop {
        let bytes_read = file.read(&mut buffer).await?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    Ok(hex::encode(hasher.finalize()))
}

pub fn get_home_dir() -> Option<PathBuf> {
    directories::BaseDirs::new().map(|dirs| dirs.home_dir().to_path_buf())
}

pub fn get_cognia_dir() -> Option<PathBuf> {
    get_home_dir().map(|home| home.join(".CogniaLauncher"))
}

pub fn get_config_dir() -> Option<PathBuf> {
    get_cognia_dir().map(|dir| dir.join("config"))
}

pub fn get_cache_dir() -> Option<PathBuf> {
    get_cognia_dir().map(|dir| dir.join("cache"))
}

pub fn get_environments_dir() -> Option<PathBuf> {
    get_cognia_dir().map(|dir| dir.join("environments"))
}

pub fn get_bin_dir() -> Option<PathBuf> {
    get_cognia_dir().map(|dir| dir.join("bin"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_write_and_read_file() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("test.txt");

        write_file_string(&path, "hello world").await.unwrap();
        let content = read_file_string(&path).await.unwrap();

        assert_eq!(content, "hello world");
    }

    #[tokio::test]
    async fn test_atomic_write() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("atomic.txt");

        write_file_atomic(&path, b"atomic content").await.unwrap();
        let content = read_file(&path).await.unwrap();

        assert_eq!(content, b"atomic content");
    }

    #[tokio::test]
    async fn test_copy_file() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("src.txt");
        let dst = dir.path().join("dst.txt");

        write_file_string(&src, "copy me").await.unwrap();
        copy_file(&src, &dst).await.unwrap();

        let content = read_file_string(&dst).await.unwrap();
        assert_eq!(content, "copy me");
    }

    #[tokio::test]
    async fn test_exists() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("exists.txt");

        assert!(!exists(&path).await);
        write_file_string(&path, "").await.unwrap();
        assert!(exists(&path).await);
    }

    #[tokio::test]
    async fn test_remove_file_with_option_permanent() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("to_delete.txt");

        write_file_string(&path, "delete me").await.unwrap();
        assert!(exists(&path).await);

        remove_file_with_option(&path, false).await.unwrap();
        assert!(!exists(&path).await);
    }

    #[tokio::test]
    async fn test_remove_file_with_option_trash() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("to_trash.txt");

        write_file_string(&path, "trash me").await.unwrap();
        assert!(exists(&path).await);

        remove_file_with_option(&path, true).await.unwrap();
        assert!(!exists(&path).await);
    }

    #[tokio::test]
    async fn test_remove_dir_with_option_permanent() {
        let dir = tempdir().unwrap();
        let sub_dir = dir.path().join("sub_dir");
        create_dir_all(&sub_dir).await.unwrap();
        let file = sub_dir.join("file.txt");
        write_file_string(&file, "content").await.unwrap();

        assert!(exists(&sub_dir).await);
        remove_dir_with_option(&sub_dir, false).await.unwrap();
        assert!(!exists(&sub_dir).await);
    }

    #[tokio::test]
    async fn test_remove_files_batch_permanent() {
        let dir = tempdir().unwrap();
        let file1 = dir.path().join("batch1.txt");
        let file2 = dir.path().join("batch2.txt");
        let file3 = dir.path().join("batch3.txt");

        write_file_string(&file1, "1").await.unwrap();
        write_file_string(&file2, "2").await.unwrap();
        write_file_string(&file3, "3").await.unwrap();

        let paths = vec![file1.clone(), file2.clone(), file3.clone()];
        let count = remove_files_batch(paths, false).await.unwrap();

        assert_eq!(count, 3);
        assert!(!exists(&file1).await);
        assert!(!exists(&file2).await);
        assert!(!exists(&file3).await);
    }

    #[tokio::test]
    async fn test_remove_files_batch_empty() {
        let count = remove_files_batch(vec![], false).await.unwrap();
        assert_eq!(count, 0);
    }

    #[tokio::test]
    async fn test_remove_files_batch_trash() {
        let dir = tempdir().unwrap();
        let file1 = dir.path().join("trash_batch1.txt");
        let file2 = dir.path().join("trash_batch2.txt");

        write_file_string(&file1, "1").await.unwrap();
        write_file_string(&file2, "2").await.unwrap();

        let paths = vec![file1.clone(), file2.clone()];
        let count = remove_files_batch(paths, true).await.unwrap();

        assert_eq!(count, 2);
        assert!(!exists(&file1).await);
        assert!(!exists(&file2).await);
    }

    #[test]
    fn test_move_to_trash_nonexistent() {
        let path = std::path::Path::new("/nonexistent/path/file.txt");
        let result = move_to_trash(path);
        assert!(result.is_err());
    }

    #[test]
    fn test_move_to_trash_batch_empty() {
        let empty_paths: Vec<PathBuf> = vec![];
        let result = move_to_trash_batch(&empty_paths);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 0);
    }

    #[tokio::test]
    async fn test_read_file_not_found() {
        let result = read_file("/nonexistent/file.txt").await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), FsError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_read_file_string_not_found() {
        let result = read_file_string("/nonexistent/file.txt").await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), FsError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_write_file_creates_parents() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("a").join("b").join("c").join("deep.txt");
        write_file(&path, b"deep content").await.unwrap();
        let content = read_file(&path).await.unwrap();
        assert_eq!(content, b"deep content");
    }

    #[tokio::test]
    async fn test_move_file_success() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("move_src.txt");
        let dst = dir.path().join("move_dst.txt");
        write_file_string(&src, "move me").await.unwrap();
        move_file(&src, &dst).await.unwrap();
        assert!(!exists(&src).await);
        let content = read_file_string(&dst).await.unwrap();
        assert_eq!(content, "move me");
    }

    #[tokio::test]
    async fn test_move_file_not_found() {
        let dir = tempdir().unwrap();
        let result = move_file(
            dir.path().join("nonexistent.txt"),
            dir.path().join("dst.txt"),
        )
        .await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), FsError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_remove_file_not_found() {
        let result = remove_file("/nonexistent/remove_me.txt").await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), FsError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_remove_dir_not_found() {
        let result = remove_dir("/nonexistent/dir").await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), FsError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_remove_dir_all_not_found() {
        let result = remove_dir_all("/nonexistent/dir_all").await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), FsError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_create_dir_already_exists() {
        let dir = tempdir().unwrap();
        let sub = dir.path().join("sub");
        create_dir(&sub).await.unwrap();
        let result = create_dir(&sub).await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), FsError::AlreadyExists(_)));
    }

    #[tokio::test]
    async fn test_create_dir_all_idempotent() {
        let dir = tempdir().unwrap();
        let sub = dir.path().join("a").join("b");
        create_dir_all(&sub).await.unwrap();
        // Should not error when called again
        create_dir_all(&sub).await.unwrap();
        assert!(is_dir(&sub).await);
    }

    #[tokio::test]
    async fn test_is_file_and_is_dir() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test_file.txt");
        write_file_string(&file_path, "content").await.unwrap();

        assert!(is_file(&file_path).await);
        assert!(!is_dir(&file_path).await);
        assert!(is_dir(dir.path()).await);
        assert!(!is_file(dir.path()).await);
        let nonexistent = dir.path().join("no_such_entry");
        assert!(!is_file(&nonexistent).await);
        assert!(!is_dir(&nonexistent).await);
    }

    #[tokio::test]
    async fn test_file_size_success() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("sized.txt");
        write_file_string(&path, "hello").await.unwrap();
        let size = file_size(&path).await.unwrap();
        assert_eq!(size, 5);
    }

    #[tokio::test]
    async fn test_file_size_not_found() {
        let result = file_size("/nonexistent/file.txt").await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), FsError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_calculate_sha256_success() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("hash_me.txt");
        write_file_string(&path, "hello").await.unwrap();
        let hash = calculate_sha256(&path).await.unwrap();
        // SHA-256 of "hello"
        assert_eq!(
            hash,
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
    }

    #[tokio::test]
    async fn test_calculate_sha256_not_found() {
        let result = calculate_sha256("/nonexistent/file.txt").await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), FsError::NotFound(_)));
    }

    #[test]
    fn test_get_home_dir() {
        assert!(get_home_dir().is_some());
    }

    #[test]
    fn test_get_cognia_dir() {
        let dir = get_cognia_dir();
        assert!(dir.is_some());
        assert!(dir.unwrap().ends_with(".CogniaLauncher"));
    }

    #[test]
    fn test_get_config_dir() {
        let dir = get_config_dir();
        assert!(dir.is_some());
        assert!(dir.unwrap().ends_with("config"));
    }

    #[test]
    fn test_get_cache_dir() {
        let dir = get_cache_dir();
        assert!(dir.is_some());
        assert!(dir.unwrap().ends_with("cache"));
    }

    #[test]
    fn test_get_environments_dir() {
        let dir = get_environments_dir();
        assert!(dir.is_some());
        assert!(dir.unwrap().ends_with("environments"));
    }

    #[test]
    fn test_get_bin_dir() {
        let dir = get_bin_dir();
        assert!(dir.is_some());
        assert!(dir.unwrap().ends_with("bin"));
    }

    #[test]
    fn test_fs_error_display() {
        let err = FsError::NotFound(PathBuf::from("/test"));
        assert!(format!("{}", err).contains("/test"));

        let err = FsError::PermissionDenied(PathBuf::from("/root"));
        assert!(format!("{}", err).contains("/root"));

        let err = FsError::AlreadyExists(PathBuf::from("/dup"));
        assert!(format!("{}", err).contains("/dup"));

        let err = FsError::InvalidPath("bad".to_string());
        assert!(format!("{}", err).contains("bad"));
    }
}
