//! Cache migration module
//!
//! Supports two migration modes:
//! - **Move**: Move cache files to new location, update config to point to new path
//! - **MoveAndLink**: Move cache files to new location, create symlink at old location

use crate::error::{CogniaError, CogniaResult};
use crate::platform::{disk, fs};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Migration mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MigrationMode {
    /// Move files to new location, update config path
    Move,
    /// Move files to new location, create symlink at original location
    MoveAndLink,
}

/// Migration progress stage
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MigrationStage {
    Validating,
    Calculating,
    Copying,
    Verifying,
    CreatingLink,
    CleaningUp,
    UpdatingConfig,
    Complete,
    Failed,
}

/// Migration progress info
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationProgress {
    pub stage: MigrationStage,
    pub message: String,
    pub bytes_copied: u64,
    pub total_bytes: u64,
    pub percent: f32,
}

/// Migration result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationResult {
    pub success: bool,
    pub mode: String,
    pub source: String,
    pub destination: String,
    pub bytes_migrated: u64,
    pub bytes_migrated_human: String,
    pub files_count: usize,
    pub symlink_created: bool,
    pub error: Option<String>,
}

/// Validation result before migration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationValidation {
    pub is_valid: bool,
    pub source_exists: bool,
    pub source_size: u64,
    pub source_size_human: String,
    pub source_file_count: usize,
    pub destination_exists: bool,
    pub destination_writable: bool,
    pub destination_space_available: u64,
    pub destination_space_human: String,
    pub has_enough_space: bool,
    pub is_same_drive: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

/// Count files in a directory recursively
async fn count_files_recursive(path: &Path) -> usize {
    let path = path.to_path_buf();
    tokio::task::spawn_blocking(move || count_files_sync(&path))
        .await
        .unwrap_or(0)
}

fn count_files_sync(path: &Path) -> usize {
    let mut count = 0;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                count += 1;
            } else if p.is_dir() {
                count += count_files_sync(&p);
            }
        }
    }
    count
}

/// Calculate directory size
async fn dir_size(path: &Path) -> u64 {
    let path = path.to_path_buf();
    tokio::task::spawn_blocking(move || dir_size_sync(&path))
        .await
        .unwrap_or(0)
}

fn dir_size_sync(path: &Path) -> u64 {
    let mut total = 0u64;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                if let Ok(meta) = std::fs::metadata(&p) {
                    total += meta.len();
                }
            } else if p.is_dir() {
                total += dir_size_sync(&p);
            }
        }
    }
    total
}

/// Check if two paths are on the same drive/mount
fn is_same_drive(a: &Path, b: &Path) -> bool {
    #[cfg(windows)]
    {
        let a_prefix = a.components().next();
        let b_prefix = b.components().next();
        match (a_prefix, b_prefix) {
            (Some(std::path::Component::Prefix(a_p)), Some(std::path::Component::Prefix(b_p))) => {
                a_p.as_os_str() == b_p.as_os_str()
            }
            _ => false,
        }
    }
    #[cfg(not(windows))]
    {
        // On Unix, compare mount points by checking if stat().st_dev matches
        use std::os::unix::fs::MetadataExt;
        let a_dev = std::fs::metadata(a).map(|m| m.dev()).ok();
        let b_parent = b
            .parent()
            .and_then(|p| std::fs::metadata(p).map(|m| m.dev()).ok());
        match (a_dev, b_parent) {
            (Some(a), Some(b)) => a == b,
            _ => false,
        }
    }
}

/// Check if a path is writable by attempting to create a temp file
async fn is_path_writable(path: &Path) -> bool {
    let test_dir = if path.exists() {
        path.to_path_buf()
    } else if let Some(parent) = path.parent() {
        if parent.exists() {
            parent.to_path_buf()
        } else {
            return false;
        }
    } else {
        return false;
    };

    let test_file = test_dir.join(".cognia_write_test");
    match tokio::fs::write(&test_file, b"test").await {
        Ok(_) => {
            let _ = tokio::fs::remove_file(&test_file).await;
            true
        }
        Err(_) => false,
    }
}

/// Validate migration parameters before executing
pub async fn validate_migration(
    source: &Path,
    destination: &Path,
) -> CogniaResult<MigrationValidation> {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    let source_exists = fs::exists(source).await;
    let destination_exists = fs::exists(destination).await;

    let source_size = if source_exists {
        dir_size(source).await
    } else {
        0
    };

    let source_file_count = if source_exists {
        count_files_recursive(source).await
    } else {
        0
    };

    // Check destination writability
    let dest_check_path = if destination_exists {
        destination.to_path_buf()
    } else {
        destination
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| destination.to_path_buf())
    };
    let destination_writable = is_path_writable(&dest_check_path).await;

    // Check available space at destination
    let (destination_space_available, has_enough_space) = if destination_writable {
        match disk::get_disk_space(&dest_check_path).await {
            Ok(space) => {
                let enough = space.available > source_size + 1024 * 1024; // 1MB buffer
                (space.available, enough)
            }
            Err(_) => (0, false),
        }
    } else {
        (0, false)
    };

    let same_drive = is_same_drive(source, destination);

    // Validation checks
    if !source_exists {
        errors.push("Source cache directory does not exist".to_string());
    }

    if source_size == 0 && source_exists {
        warnings.push("Source cache directory is empty".to_string());
    }

    if destination_exists {
        // Check if destination is non-empty
        let dest_size = dir_size(destination).await;
        if dest_size > 0 {
            warnings.push(format!(
                "Destination directory is not empty ({} existing data)",
                disk::format_size(dest_size)
            ));
        }
    }

    if !destination_writable {
        errors.push("Destination path is not writable".to_string());
    }

    if !has_enough_space && source_size > 0 {
        errors.push(format!(
            "Insufficient disk space at destination: need {}, available {}",
            disk::format_size(source_size),
            disk::format_size(destination_space_available)
        ));
    }

    if source == destination {
        errors.push("Source and destination paths are the same".to_string());
    }

    // Check if source is a symlink already
    if source_exists {
        let source_meta = tokio::fs::symlink_metadata(source).await;
        if let Ok(meta) = source_meta {
            if meta.file_type().is_symlink() {
                warnings.push("Source path is already a symlink".to_string());
            }
        }
    }

    if same_drive {
        warnings
            .push("Source and destination are on the same drive - move will be faster".to_string());
    }

    let is_valid = errors.is_empty();

    Ok(MigrationValidation {
        is_valid,
        source_exists,
        source_size,
        source_size_human: disk::format_size(source_size),
        source_file_count,
        destination_exists,
        destination_writable,
        destination_space_available,
        destination_space_human: disk::format_size(destination_space_available),
        has_enough_space,
        is_same_drive: same_drive,
        errors,
        warnings,
    })
}

/// Copy directory recursively with size tracking
fn copy_dir_recursive<'a>(
    src: &'a Path,
    dst: &'a Path,
    bytes_copied: &'a mut u64,
    files_count: &'a mut usize,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = CogniaResult<()>> + Send + 'a>> {
    Box::pin(async move {
        fs::create_dir_all(dst).await?;

        let mut entries = tokio::fs::read_dir(src)
            .await
            .map_err(|e| CogniaError::Io(e))?;

        while let Some(entry) = entries.next_entry().await.map_err(|e| CogniaError::Io(e))? {
            let src_path = entry.path();
            let dst_path = dst.join(entry.file_name());

            let file_type = entry.file_type().await.map_err(|e| CogniaError::Io(e))?;

            if file_type.is_dir() {
                copy_dir_recursive(&src_path, &dst_path, bytes_copied, files_count).await?;
            } else if file_type.is_file() {
                tokio::fs::copy(&src_path, &dst_path)
                    .await
                    .map_err(|e| CogniaError::Io(e))?;
                let size = tokio::fs::metadata(&dst_path)
                    .await
                    .map(|m| m.len())
                    .unwrap_or(0);
                *bytes_copied += size;
                *files_count += 1;
            }
            // Skip symlinks for safety
        }

        Ok(())
    })
}

/// Execute cache migration
///
/// Mode::Move: Move files, update config path
/// Mode::MoveAndLink: Move files, create symlink at old location
pub async fn migrate_cache(
    source: &Path,
    destination: &Path,
    mode: MigrationMode,
) -> CogniaResult<MigrationResult> {
    // Step 1: Validate
    let validation = validate_migration(source, destination).await?;
    if !validation.is_valid {
        return Ok(MigrationResult {
            success: false,
            mode: format!("{:?}", mode).to_lowercase(),
            source: source.display().to_string(),
            destination: destination.display().to_string(),
            bytes_migrated: 0,
            bytes_migrated_human: "0 B".to_string(),
            files_count: 0,
            symlink_created: false,
            error: Some(validation.errors.join("; ")),
        });
    }

    // Step 2: Create destination directory
    fs::create_dir_all(destination).await?;

    // Step 3: Copy files
    let mut bytes_copied = 0u64;
    let mut files_count = 0usize;

    if let Err(e) =
        copy_dir_recursive(source, destination, &mut bytes_copied, &mut files_count).await
    {
        // Cleanup on failure
        let _ = fs::remove_dir_all(destination).await;
        return Ok(MigrationResult {
            success: false,
            mode: format!("{:?}", mode).to_lowercase(),
            source: source.display().to_string(),
            destination: destination.display().to_string(),
            bytes_migrated: bytes_copied,
            bytes_migrated_human: disk::format_size(bytes_copied),
            files_count,
            symlink_created: false,
            error: Some(format!("Copy failed: {}", e)),
        });
    }

    // Step 4: Verify basic integrity (compare total sizes)
    let dest_size = dir_size(destination).await;
    let size_diff = if validation.source_size > dest_size {
        validation.source_size - dest_size
    } else {
        dest_size - validation.source_size
    };

    // Allow 1% tolerance for filesystem overhead differences
    let tolerance = validation.source_size / 100;
    if size_diff > tolerance.max(4096) {
        let _ = fs::remove_dir_all(destination).await;
        return Ok(MigrationResult {
            success: false,
            mode: format!("{:?}", mode).to_lowercase(),
            source: source.display().to_string(),
            destination: destination.display().to_string(),
            bytes_migrated: bytes_copied,
            bytes_migrated_human: disk::format_size(bytes_copied),
            files_count,
            symlink_created: false,
            error: Some(format!(
                "Verification failed: source {} vs destination {}",
                disk::format_size(validation.source_size),
                disk::format_size(dest_size)
            )),
        });
    }

    // Step 5: Remove old cache
    if let Err(e) = fs::remove_dir_all(source).await {
        return Ok(MigrationResult {
            success: false,
            mode: format!("{:?}", mode).to_lowercase(),
            source: source.display().to_string(),
            destination: destination.display().to_string(),
            bytes_migrated: bytes_copied,
            bytes_migrated_human: disk::format_size(bytes_copied),
            files_count,
            symlink_created: false,
            error: Some(format!("Failed to remove source directory: {}", e)),
        });
    }

    // Step 6: Create symlink if MoveAndLink mode
    let symlink_created = if mode == MigrationMode::MoveAndLink {
        match fs::create_symlink(destination, source).await {
            Ok(_) => true,
            Err(e) => {
                return Ok(MigrationResult {
                    success: false,
                    mode: "move_and_link".to_string(),
                    source: source.display().to_string(),
                    destination: destination.display().to_string(),
                    bytes_migrated: bytes_copied,
                    bytes_migrated_human: disk::format_size(bytes_copied),
                    files_count,
                    symlink_created: false,
                    error: Some(format!(
                        "Files moved but symlink creation failed: {}. Data is at new location.",
                        e
                    )),
                });
            }
        }
    } else {
        false
    };

    Ok(MigrationResult {
        success: true,
        mode: match mode {
            MigrationMode::Move => "move".to_string(),
            MigrationMode::MoveAndLink => "move_and_link".to_string(),
        },
        source: source.display().to_string(),
        destination: destination.display().to_string(),
        bytes_migrated: bytes_copied,
        bytes_migrated_human: disk::format_size(bytes_copied),
        files_count,
        symlink_created,
        error: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_validate_same_path() {
        let dir = tempdir().unwrap();
        let path = dir.path().to_path_buf();
        let result = validate_migration(&path, &path).await.unwrap();
        assert!(!result.is_valid);
        assert!(result.errors.iter().any(|e| e.contains("same")));
    }

    #[tokio::test]
    async fn test_validate_nonexistent_source() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("nonexistent");
        let dst = dir.path().join("dst");
        let result = validate_migration(&src, &dst).await.unwrap();
        assert!(!result.is_valid);
        assert!(result.errors.iter().any(|e| e.contains("does not exist")));
    }

    #[tokio::test]
    async fn test_migrate_move_mode() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("cache_src");
        let dst = dir.path().join("cache_dst");

        // Create source with test files
        tokio::fs::create_dir_all(&src).await.unwrap();
        tokio::fs::write(src.join("file1.txt"), b"hello")
            .await
            .unwrap();
        tokio::fs::write(src.join("file2.txt"), b"world")
            .await
            .unwrap();

        let result = migrate_cache(&src, &dst, MigrationMode::Move)
            .await
            .unwrap();
        assert!(result.success);
        assert_eq!(result.files_count, 2);
        assert!(!result.symlink_created);
        assert!(!src.exists()); // Source should be removed
        assert!(dst.join("file1.txt").exists());
        assert!(dst.join("file2.txt").exists());
    }

    #[tokio::test]
    async fn test_migrate_move_and_link() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("cache_src");
        let dst = dir.path().join("cache_dst");

        tokio::fs::create_dir_all(&src).await.unwrap();
        tokio::fs::write(src.join("test.dat"), b"data")
            .await
            .unwrap();

        let result = migrate_cache(&src, &dst, MigrationMode::MoveAndLink)
            .await
            .unwrap();
        assert!(result.success);
        assert!(result.symlink_created);
        // Source should now be a symlink pointing to destination
        let meta = tokio::fs::symlink_metadata(&src).await.unwrap();
        assert!(meta.file_type().is_symlink());
        // Files should be accessible via old path (through symlink)
        assert!(src.join("test.dat").exists());
    }
}
