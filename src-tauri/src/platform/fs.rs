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
}
