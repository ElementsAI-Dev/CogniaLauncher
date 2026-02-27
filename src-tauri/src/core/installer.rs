use crate::error::{CogniaError, CogniaResult};
use crate::platform::fs;
use serde::{Deserialize, Serialize};
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;

type ProgressCallback = Arc<dyn Fn(ExtractProgress) + Send + Sync>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallTransaction {
    pub id: String,
    pub started_at: String,
    pub operations: Vec<InstallOperation>,
    pub status: TransactionStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum InstallOperation {
    CreateDir {
        path: PathBuf,
    },
    CopyFile {
        src: PathBuf,
        dst: PathBuf,
    },
    CreateSymlink {
        src: PathBuf,
        dst: PathBuf,
    },
    WriteFile {
        path: PathBuf,
        backup: Option<PathBuf>,
    },
    DeleteFile {
        path: PathBuf,
        backup: Option<PathBuf>,
    },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TransactionStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    RolledBack,
}

impl InstallTransaction {
    pub fn new() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            started_at: chrono::Utc::now().to_rfc3339(),
            operations: Vec::new(),
            status: TransactionStatus::Pending,
        }
    }

    pub fn add_operation(&mut self, op: InstallOperation) {
        self.operations.push(op);
    }

    pub async fn execute(&mut self) -> CogniaResult<()> {
        self.status = TransactionStatus::InProgress;

        for (idx, op) in self.operations.iter().enumerate() {
            if let Err(e) = self.execute_operation(op).await {
                self.rollback(idx).await?;
                self.status = TransactionStatus::Failed;
                return Err(e);
            }
        }

        self.status = TransactionStatus::Completed;
        Ok(())
    }

    async fn execute_operation(&self, op: &InstallOperation) -> CogniaResult<()> {
        match op {
            InstallOperation::CreateDir { path } => {
                fs::create_dir_all(path).await?;
            }
            InstallOperation::CopyFile { src, dst } => {
                fs::copy_file(src, dst).await?;
            }
            InstallOperation::CreateSymlink { src, dst } => {
                fs::create_symlink(src, dst).await?;
            }
            InstallOperation::WriteFile { path, .. } => {
                // File should already be written
                if !fs::exists(path).await {
                    return Err(CogniaError::Installation(format!(
                        "File not found: {:?}",
                        path
                    )));
                }
            }
            InstallOperation::DeleteFile { path, backup } => {
                if let Some(backup_path) = backup {
                    fs::copy_file(path, backup_path).await?;
                }
                fs::remove_file(path).await?;
            }
        }
        Ok(())
    }

    async fn rollback(&self, up_to: usize) -> CogniaResult<()> {
        for op in self.operations[..up_to].iter().rev() {
            let _ = self.rollback_operation(op).await;
        }
        Ok(())
    }

    async fn rollback_operation(&self, op: &InstallOperation) -> CogniaResult<()> {
        match op {
            InstallOperation::CreateDir { path } => {
                if fs::exists(path).await {
                    let _ = fs::remove_dir(path).await;
                }
            }
            InstallOperation::CopyFile { dst, .. } => {
                if fs::exists(dst).await {
                    let _ = fs::remove_file(dst).await;
                }
            }
            InstallOperation::CreateSymlink { dst, .. } => {
                if fs::exists(dst).await {
                    let _ = fs::remove_file(dst).await;
                }
            }
            InstallOperation::WriteFile { path, backup } => {
                if let Some(backup_path) = backup {
                    if fs::exists(backup_path).await {
                        let _ = fs::move_file(backup_path, path).await;
                    }
                }
            }
            InstallOperation::DeleteFile { path, backup } => {
                if let Some(backup_path) = backup {
                    if fs::exists(backup_path).await {
                        let _ = fs::move_file(backup_path, path).await;
                    }
                }
            }
        }
        Ok(())
    }
}

impl Default for InstallTransaction {
    fn default() -> Self {
        Self::new()
    }
}

// ── Extraction progress ──

#[derive(Debug, Clone, Serialize)]
pub struct ExtractProgress {
    pub current_file: String,
    pub files_done: usize,
    pub total_files: Option<usize>,
}

// ── Zip-slip protection ──

fn validate_extract_path(dest: &Path, entry_path: &Path) -> CogniaResult<PathBuf> {
    let canonical_dest = dest
        .canonicalize()
        .unwrap_or_else(|_| dest.to_path_buf());

    // Reject paths with parent-directory traversals
    for component in entry_path.components() {
        if matches!(component, Component::ParentDir) {
            return Err(CogniaError::Installation(format!(
                "Zip-slip detected: path contains '..': {}",
                entry_path.display()
            )));
        }
    }

    let target = canonical_dest.join(entry_path);

    // Double-check the resolved path stays inside dest
    if !target.starts_with(&canonical_dest) {
        return Err(CogniaError::Installation(format!(
            "Zip-slip detected: {} escapes destination {}",
            entry_path.display(),
            dest.display()
        )));
    }

    Ok(target)
}

// ── Public API ──

pub async fn extract_archive(archive: &Path, dest: &Path) -> CogniaResult<Vec<PathBuf>> {
    extract_archive_with_progress(archive, dest, None).await
}

pub async fn extract_archive_with_progress(
    archive: &Path,
    dest: &Path,
    on_progress: Option<ProgressCallback>,
) -> CogniaResult<Vec<PathBuf>> {
    let filename = archive
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");
    let ext = archive.extension().and_then(|e| e.to_str()).unwrap_or("");

    fs::create_dir_all(dest).await?;

    let archive = archive.to_path_buf();
    let dest = dest.to_path_buf();

    let files = match ext {
        "gz" | "tgz" => extract_tar_gz(&archive, &dest, on_progress).await?,
        "zip" => extract_zip(&archive, &dest, on_progress).await?,
        "xz" | "txz" => {
            if filename.ends_with(".tar.xz") || filename.ends_with(".txz") || ext == "txz" {
                extract_tar_xz(&archive, &dest, on_progress).await?
            } else {
                return Err(CogniaError::Installation(format!(
                    "Standalone .xz not supported, expected .tar.xz: {}",
                    filename
                )));
            }
        }
        "bz2" | "tbz2" => extract_tar_bz2(&archive, &dest, on_progress).await?,
        "zst" | "tzst" => extract_tar_zst(&archive, &dest, on_progress).await?,
        "7z" => extract_7z(&archive, &dest, on_progress).await?,
        _ => {
            return Err(CogniaError::Installation(format!(
                "Unsupported archive format: {}",
                ext
            )))
        }
    };

    Ok(files)
}

// ── Format-specific extractors ──

fn emit_progress(
    on_progress: &Option<ProgressCallback>,
    current_file: &str,
    files_done: usize,
    total_files: Option<usize>,
) {
    if let Some(cb) = on_progress {
        cb(ExtractProgress {
            current_file: current_file.to_string(),
            files_done,
            total_files,
        });
    }
}

fn extract_tar_entries<R: std::io::Read>(
    mut archive: tar::Archive<R>,
    dest: &Path,
    on_progress: &Option<ProgressCallback>,
) -> CogniaResult<Vec<PathBuf>> {
    let mut files = Vec::new();
    let entries = archive
        .entries()
        .map_err(|e| CogniaError::Installation(format!("Failed to read tar entries: {}", e)))?;

    for (idx, entry) in entries.enumerate() {
        let mut entry = entry.map_err(|e| {
            CogniaError::Installation(format!("Failed to read tar entry: {}", e))
        })?;

        let entry_path = entry
            .path()
            .map_err(|e| CogniaError::Installation(format!("Invalid path in tar: {}", e)))?
            .into_owned();

        // Skip symlinks pointing outside dest for security
        if entry.header().entry_type().is_symlink() {
            if let Ok(link_target) = entry.link_name() {
                if let Some(target) = link_target {
                    let resolved = dest.join(&entry_path).parent().map(|p| p.join(&target));
                    if let Some(resolved) = resolved {
                        let canonical_dest = dest.canonicalize().unwrap_or_else(|_| dest.to_path_buf());
                        if !resolved.starts_with(&canonical_dest) && !target.is_relative() {
                            log::warn!("Skipping symlink outside dest: {}", entry_path.display());
                            continue;
                        }
                    }
                }
            }
        }

        let target = validate_extract_path(dest, &entry_path)?;

        entry.unpack(&target).map_err(|e| {
            CogniaError::Installation(format!(
                "Failed to extract {}: {}",
                entry_path.display(),
                e
            ))
        })?;

        let display_name = entry_path.display().to_string();
        files.push(target);
        emit_progress(on_progress, &display_name, idx + 1, None);
    }

    Ok(files)
}

async fn extract_tar_gz(
    archive: &Path,
    dest: &Path,
    on_progress: Option<ProgressCallback>,
) -> CogniaResult<Vec<PathBuf>> {
    let archive = archive.to_path_buf();
    let dest = dest.to_path_buf();

    tokio::task::spawn_blocking(move || {
        let file = std::fs::File::open(&archive).map_err(|e| {
            CogniaError::Installation(format!("Failed to open {}: {}", archive.display(), e))
        })?;
        let decoder = flate2::read::GzDecoder::new(file);
        let tar = tar::Archive::new(decoder);
        extract_tar_entries(tar, &dest, &on_progress)
    })
    .await
    .map_err(|e| CogniaError::Installation(format!("Task join error: {}", e)))?
}

async fn extract_tar_xz(
    archive: &Path,
    dest: &Path,
    on_progress: Option<ProgressCallback>,
) -> CogniaResult<Vec<PathBuf>> {
    let archive = archive.to_path_buf();
    let dest = dest.to_path_buf();

    tokio::task::spawn_blocking(move || {
        let file = std::fs::File::open(&archive).map_err(|e| {
            CogniaError::Installation(format!("Failed to open {}: {}", archive.display(), e))
        })?;
        let decoder = xz2::read::XzDecoder::new(file);
        let tar = tar::Archive::new(decoder);
        extract_tar_entries(tar, &dest, &on_progress)
    })
    .await
    .map_err(|e| CogniaError::Installation(format!("Task join error: {}", e)))?
}

async fn extract_tar_bz2(
    archive: &Path,
    dest: &Path,
    on_progress: Option<ProgressCallback>,
) -> CogniaResult<Vec<PathBuf>> {
    let archive = archive.to_path_buf();
    let dest = dest.to_path_buf();

    tokio::task::spawn_blocking(move || {
        let file = std::fs::File::open(&archive).map_err(|e| {
            CogniaError::Installation(format!("Failed to open {}: {}", archive.display(), e))
        })?;
        let decoder = bzip2::read::BzDecoder::new(file);
        let tar = tar::Archive::new(decoder);
        extract_tar_entries(tar, &dest, &on_progress)
    })
    .await
    .map_err(|e| CogniaError::Installation(format!("Task join error: {}", e)))?
}

async fn extract_tar_zst(
    archive: &Path,
    dest: &Path,
    on_progress: Option<ProgressCallback>,
) -> CogniaResult<Vec<PathBuf>> {
    let archive = archive.to_path_buf();
    let dest = dest.to_path_buf();

    tokio::task::spawn_blocking(move || {
        let file = std::fs::File::open(&archive).map_err(|e| {
            CogniaError::Installation(format!("Failed to open {}: {}", archive.display(), e))
        })?;
        let decoder = zstd::Decoder::new(file).map_err(|e| {
            CogniaError::Installation(format!("Failed to create zstd decoder: {}", e))
        })?;
        let tar = tar::Archive::new(decoder);
        extract_tar_entries(tar, &dest, &on_progress)
    })
    .await
    .map_err(|e| CogniaError::Installation(format!("Task join error: {}", e)))?
}

async fn extract_zip(
    archive: &Path,
    dest: &Path,
    on_progress: Option<ProgressCallback>,
) -> CogniaResult<Vec<PathBuf>> {
    let archive = archive.to_path_buf();
    let dest = dest.to_path_buf();

    tokio::task::spawn_blocking(move || {
        let file = std::fs::File::open(&archive).map_err(|e| {
            CogniaError::Installation(format!("Failed to open {}: {}", archive.display(), e))
        })?;
        let mut zip = zip::ZipArchive::new(file).map_err(|e| {
            CogniaError::Installation(format!("Failed to read zip archive: {}", e))
        })?;

        let total = zip.len();
        let mut files = Vec::with_capacity(total);

        for i in 0..total {
            let mut entry = zip.by_index(i).map_err(|e| {
                CogniaError::Installation(format!("Failed to read zip entry {}: {}", i, e))
            })?;

            let entry_path = match entry.enclosed_name() {
                Some(p) => p.to_path_buf(),
                None => {
                    log::warn!("Skipping unsafe zip entry: {:?}", entry.name());
                    continue;
                }
            };

            let target = validate_extract_path(&dest, &entry_path)?;

            if entry.is_dir() {
                std::fs::create_dir_all(&target).map_err(|e| {
                    CogniaError::Installation(format!(
                        "Failed to create dir {}: {}",
                        target.display(),
                        e
                    ))
                })?;
            } else {
                if let Some(parent) = target.parent() {
                    std::fs::create_dir_all(parent).map_err(|e| {
                        CogniaError::Installation(format!(
                            "Failed to create parent dir {}: {}",
                            parent.display(),
                            e
                        ))
                    })?;
                }

                let mut outfile = std::fs::File::create(&target).map_err(|e| {
                    CogniaError::Installation(format!(
                        "Failed to create file {}: {}",
                        target.display(),
                        e
                    ))
                })?;

                std::io::copy(&mut entry, &mut outfile).map_err(|e| {
                    CogniaError::Installation(format!(
                        "Failed to write {}: {}",
                        target.display(),
                        e
                    ))
                })?;

                // Preserve unix permissions
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    if let Some(mode) = entry.unix_mode() {
                        let _ = std::fs::set_permissions(
                            &target,
                            std::fs::Permissions::from_mode(mode),
                        );
                    }
                }
            }

            let display_name = entry_path.display().to_string();
            files.push(target);
            emit_progress(&on_progress, &display_name, i + 1, Some(total));
        }

        Ok(files)
    })
    .await
    .map_err(|e| CogniaError::Installation(format!("Task join error: {}", e)))?
}

async fn extract_7z(
    archive: &Path,
    dest: &Path,
    on_progress: Option<ProgressCallback>,
) -> CogniaResult<Vec<PathBuf>> {
    let archive = archive.to_path_buf();
    let dest = dest.to_path_buf();

    tokio::task::spawn_blocking(move || {
        sevenz_rust2::decompress_file(&archive, &dest).map_err(|e| {
            CogniaError::Installation(format!("Failed to extract 7z: {}", e))
        })?;

        // Collect extracted files by walking the dest directory
        let mut files = Vec::new();
        for entry in walkdir::WalkDir::new(&dest)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            if entry.file_type().is_file() {
                files.push(entry.into_path());
            }
        }

        emit_progress(
            &on_progress,
            "complete",
            files.len(),
            Some(files.len()),
        );

        Ok(files)
    })
    .await
    .map_err(|e| CogniaError::Installation(format!("Task join error: {}", e)))?
}

// ── Tests ──

#[cfg(test)]
mod extract_tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_validate_extract_path_normal() {
        let dest = Path::new("/tmp/extract");
        let entry = Path::new("subdir/file.txt");
        let result = validate_extract_path(dest, entry);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_extract_path_zipslip() {
        let dest = Path::new("/tmp/extract");
        let entry = Path::new("../../../etc/passwd");
        let result = validate_extract_path(dest, entry);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Zip-slip detected"));
    }

    #[test]
    fn test_validate_extract_path_dotdot_in_middle() {
        let dest = Path::new("/tmp/extract");
        let entry = Path::new("foo/../../bar");
        let result = validate_extract_path(dest, entry);
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_extract_zip_native() {
        let tmp = tempfile::tempdir().unwrap();
        let zip_path = tmp.path().join("test.zip");
        let extract_dir = tmp.path().join("out");

        // Create a test zip in-memory
        {
            let file = std::fs::File::create(&zip_path).unwrap();
            let mut writer = zip::ZipWriter::new(file);
            let options: zip::write::FileOptions<'_, ()> =
                zip::write::FileOptions::default()
                    .compression_method(zip::CompressionMethod::Deflated);
            writer.start_file("hello.txt", options).unwrap();
            writer.write_all(b"Hello, world!").unwrap();
            writer.start_file("subdir/nested.txt", options).unwrap();
            writer.write_all(b"Nested content").unwrap();
            writer.finish().unwrap();
        }

        let files = extract_archive(&zip_path, &extract_dir).await.unwrap();
        assert_eq!(files.len(), 2);
        assert!(extract_dir.join("hello.txt").exists());
        assert!(extract_dir.join("subdir/nested.txt").exists());

        let content = std::fs::read_to_string(extract_dir.join("hello.txt")).unwrap();
        assert_eq!(content, "Hello, world!");
    }

    #[tokio::test]
    async fn test_extract_tar_gz_native() {
        let tmp = tempfile::tempdir().unwrap();
        let archive_path = tmp.path().join("test.tar.gz");
        let extract_dir = tmp.path().join("out");

        // Create a test tar.gz
        {
            let file = std::fs::File::create(&archive_path).unwrap();
            let encoder = flate2::write::GzEncoder::new(file, flate2::Compression::default());
            let mut tar_builder = tar::Builder::new(encoder);

            let data = b"Hello from tar.gz!";
            let mut header = tar::Header::new_gnu();
            header.set_size(data.len() as u64);
            header.set_mode(0o644);
            header.set_cksum();
            tar_builder
                .append_data(&mut header, "greeting.txt", &data[..])
                .unwrap();
            tar_builder.finish().unwrap();
        }

        let files = extract_archive(&archive_path, &extract_dir).await.unwrap();
        assert_eq!(files.len(), 1);
        assert!(extract_dir.join("greeting.txt").exists());
    }

    #[tokio::test]
    async fn test_extract_unsupported_format() {
        let tmp = tempfile::tempdir().unwrap();
        let archive_path = tmp.path().join("test.rar");
        std::fs::write(&archive_path, b"fake").unwrap();

        let result = extract_archive(&archive_path, &tmp.path().join("out")).await;
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Unsupported archive format"));
    }

    #[tokio::test]
    async fn test_extract_zip_with_progress() {
        use std::sync::{Arc, Mutex};

        let tmp = tempfile::tempdir().unwrap();
        let zip_path = tmp.path().join("progress.zip");
        let extract_dir = tmp.path().join("out");

        {
            let file = std::fs::File::create(&zip_path).unwrap();
            let mut writer = zip::ZipWriter::new(file);
            let options: zip::write::FileOptions<'_, ()> =
                zip::write::FileOptions::default()
                    .compression_method(zip::CompressionMethod::Deflated);
            writer.start_file("a.txt", options).unwrap();
            writer.write_all(b"aaa").unwrap();
            writer.start_file("b.txt", options).unwrap();
            writer.write_all(b"bbb").unwrap();
            writer.finish().unwrap();
        }

        let progress_log: Arc<Mutex<Vec<(usize, Option<usize>)>>> =
            Arc::new(Mutex::new(Vec::new()));
        let log_clone = progress_log.clone();

        let callback = move |p: ExtractProgress| {
            log_clone.lock().unwrap().push((p.files_done, p.total_files));
        };

        let files = extract_archive_with_progress(&zip_path, &extract_dir, Some(Arc::new(callback)))
            .await
            .unwrap();
        assert_eq!(files.len(), 2);

        let log = progress_log.lock().unwrap();
        assert_eq!(log.len(), 2);
        assert_eq!(log[0], (1, Some(2)));
        assert_eq!(log[1], (2, Some(2)));
    }

    #[tokio::test]
    async fn test_extract_tar_bz2_native() {
        let tmp = tempfile::tempdir().unwrap();
        let archive_path = tmp.path().join("test.tar.bz2");
        let extract_dir = tmp.path().join("out");

        {
            let file = std::fs::File::create(&archive_path).unwrap();
            let encoder = bzip2::write::BzEncoder::new(file, bzip2::Compression::default());
            let mut tar_builder = tar::Builder::new(encoder);

            let data = b"Hello from tar.bz2!";
            let mut header = tar::Header::new_gnu();
            header.set_size(data.len() as u64);
            header.set_mode(0o644);
            header.set_cksum();
            tar_builder
                .append_data(&mut header, "bz2-file.txt", &data[..])
                .unwrap();
            tar_builder.finish().unwrap();
        }

        let files = extract_archive(&archive_path, &extract_dir).await.unwrap();
        assert_eq!(files.len(), 1);
        assert!(extract_dir.join("bz2-file.txt").exists());

        let content = std::fs::read_to_string(extract_dir.join("bz2-file.txt")).unwrap();
        assert_eq!(content, "Hello from tar.bz2!");
    }

    #[tokio::test]
    async fn test_extract_tar_xz_native() {
        let tmp = tempfile::tempdir().unwrap();
        let archive_path = tmp.path().join("test.tar.xz");
        let extract_dir = tmp.path().join("out");

        {
            let file = std::fs::File::create(&archive_path).unwrap();
            let encoder = xz2::write::XzEncoder::new(file, 6);
            let mut tar_builder = tar::Builder::new(encoder);

            let data = b"Hello from tar.xz!";
            let mut header = tar::Header::new_gnu();
            header.set_size(data.len() as u64);
            header.set_mode(0o644);
            header.set_cksum();
            tar_builder
                .append_data(&mut header, "xz-file.txt", &data[..])
                .unwrap();
            tar_builder.finish().unwrap();
        }

        let files = extract_archive(&archive_path, &extract_dir).await.unwrap();
        assert_eq!(files.len(), 1);
        assert!(extract_dir.join("xz-file.txt").exists());

        let content = std::fs::read_to_string(extract_dir.join("xz-file.txt")).unwrap();
        assert_eq!(content, "Hello from tar.xz!");
    }

    #[tokio::test]
    async fn test_extract_tar_zst_native() {
        let tmp = tempfile::tempdir().unwrap();
        let archive_path = tmp.path().join("test.tar.zst");
        let extract_dir = tmp.path().join("out");

        {
            let file = std::fs::File::create(&archive_path).unwrap();
            let encoder = zstd::Encoder::new(file, 3).unwrap().auto_finish();
            let mut tar_builder = tar::Builder::new(encoder);

            let data = b"Hello from tar.zst!";
            let mut header = tar::Header::new_gnu();
            header.set_size(data.len() as u64);
            header.set_mode(0o644);
            header.set_cksum();
            tar_builder
                .append_data(&mut header, "zst-file.txt", &data[..])
                .unwrap();
            tar_builder.finish().unwrap();
        }

        let files = extract_archive(&archive_path, &extract_dir).await.unwrap();
        assert_eq!(files.len(), 1);
        assert!(extract_dir.join("zst-file.txt").exists());

        let content = std::fs::read_to_string(extract_dir.join("zst-file.txt")).unwrap();
        assert_eq!(content, "Hello from tar.zst!");
    }

    #[tokio::test]
    async fn test_extract_tar_gz_multiple_files() {
        let tmp = tempfile::tempdir().unwrap();
        let archive_path = tmp.path().join("multi.tar.gz");
        let extract_dir = tmp.path().join("out");

        {
            let file = std::fs::File::create(&archive_path).unwrap();
            let encoder = flate2::write::GzEncoder::new(file, flate2::Compression::default());
            let mut tar_builder = tar::Builder::new(encoder);

            // Add directory entry first (required on Windows)
            let mut dir_header = tar::Header::new_gnu();
            dir_header.set_entry_type(tar::EntryType::Directory);
            dir_header.set_size(0);
            dir_header.set_mode(0o755);
            dir_header.set_cksum();
            tar_builder
                .append_data(&mut dir_header, "dir/", &b""[..])
                .unwrap();

            for i in 0..5 {
                let data = format!("File content {}", i);
                let data_bytes = data.as_bytes();
                let mut header = tar::Header::new_gnu();
                header.set_size(data_bytes.len() as u64);
                header.set_mode(0o644);
                header.set_cksum();
                tar_builder
                    .append_data(
                        &mut header,
                        format!("dir/file{}.txt", i),
                        data_bytes,
                    )
                    .unwrap();
            }
            tar_builder.finish().unwrap();
        }

        let files = extract_archive(&archive_path, &extract_dir).await.unwrap();
        // 5 files + 1 directory entry
        assert!(files.len() >= 5);
        for i in 0..5 {
            let path = extract_dir.join(format!("dir/file{}.txt", i));
            assert!(path.exists(), "Missing file: {}", path.display());
        }
    }

    #[tokio::test]
    async fn test_extract_standalone_xz_rejected() {
        let tmp = tempfile::tempdir().unwrap();
        // A plain .xz (not .tar.xz) should be rejected
        let archive_path = tmp.path().join("test.xz");
        std::fs::write(&archive_path, b"fake xz").unwrap();

        let result = extract_archive(&archive_path, &tmp.path().join("out")).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Standalone .xz not supported"));
    }

    #[test]
    fn test_extract_progress_fields() {
        let progress = ExtractProgress {
            current_file: "foo/bar.txt".to_string(),
            files_done: 3,
            total_files: Some(10),
        };
        assert_eq!(progress.current_file, "foo/bar.txt");
        assert_eq!(progress.files_done, 3);
        assert_eq!(progress.total_files, Some(10));
    }

    #[test]
    fn test_extract_progress_serialize() {
        let progress = ExtractProgress {
            current_file: "test.txt".to_string(),
            files_done: 1,
            total_files: Some(5),
        };
        let json = serde_json::to_string(&progress).unwrap();
        assert!(json.contains("test.txt"));
        assert!(json.contains("\"files_done\":1"));
        assert!(json.contains("\"total_files\":5"));
    }

    #[test]
    fn test_install_transaction_new() {
        let tx = InstallTransaction::new();
        assert!(!tx.id.is_empty());
        assert!(!tx.started_at.is_empty());
        assert!(tx.operations.is_empty());
        assert_eq!(tx.status, TransactionStatus::Pending);
    }

    #[test]
    fn test_install_transaction_default() {
        let tx = InstallTransaction::default();
        assert_eq!(tx.status, TransactionStatus::Pending);
        assert!(tx.operations.is_empty());
    }

    #[test]
    fn test_install_transaction_add_operation() {
        let mut tx = InstallTransaction::new();
        tx.add_operation(InstallOperation::CreateDir {
            path: PathBuf::from("/tmp/test"),
        });
        tx.add_operation(InstallOperation::CopyFile {
            src: PathBuf::from("/tmp/src"),
            dst: PathBuf::from("/tmp/dst"),
        });
        assert_eq!(tx.operations.len(), 2);
    }

    #[test]
    fn test_transaction_status_serde() {
        let statuses = vec![
            TransactionStatus::Pending,
            TransactionStatus::InProgress,
            TransactionStatus::Completed,
            TransactionStatus::Failed,
            TransactionStatus::RolledBack,
        ];
        for status in statuses {
            let json = serde_json::to_string(&status).unwrap();
            let deser: TransactionStatus = serde_json::from_str(&json).unwrap();
            assert_eq!(deser, status);
        }
    }

    #[test]
    fn test_install_operation_create_dir_serde() {
        let op = InstallOperation::CreateDir {
            path: PathBuf::from("/tmp/new-dir"),
        };
        let json = serde_json::to_string(&op).unwrap();
        assert!(json.contains("\"type\":\"create_dir\""));
        let deser: InstallOperation = serde_json::from_str(&json).unwrap();
        match deser {
            InstallOperation::CreateDir { path } => {
                assert_eq!(path, PathBuf::from("/tmp/new-dir"));
            }
            _ => panic!("Expected CreateDir"),
        }
    }

    #[test]
    fn test_install_operation_copy_file_serde() {
        let op = InstallOperation::CopyFile {
            src: PathBuf::from("/src/file"),
            dst: PathBuf::from("/dst/file"),
        };
        let json = serde_json::to_string(&op).unwrap();
        assert!(json.contains("\"type\":\"copy_file\""));
    }

    #[test]
    fn test_install_operation_create_symlink_serde() {
        let op = InstallOperation::CreateSymlink {
            src: PathBuf::from("/target"),
            dst: PathBuf::from("/link"),
        };
        let json = serde_json::to_string(&op).unwrap();
        assert!(json.contains("\"type\":\"create_symlink\""));
    }

    #[test]
    fn test_install_operation_write_file_serde() {
        let op = InstallOperation::WriteFile {
            path: PathBuf::from("/tmp/file.txt"),
            backup: Some(PathBuf::from("/tmp/file.txt.bak")),
        };
        let json = serde_json::to_string(&op).unwrap();
        assert!(json.contains("\"type\":\"write_file\""));

        let deser: InstallOperation = serde_json::from_str(&json).unwrap();
        match deser {
            InstallOperation::WriteFile { path, backup } => {
                assert_eq!(path, PathBuf::from("/tmp/file.txt"));
                assert!(backup.is_some());
            }
            _ => panic!("Expected WriteFile"),
        }
    }

    #[test]
    fn test_install_operation_delete_file_serde() {
        let op = InstallOperation::DeleteFile {
            path: PathBuf::from("/tmp/old-file"),
            backup: None,
        };
        let json = serde_json::to_string(&op).unwrap();
        assert!(json.contains("\"type\":\"delete_file\""));
    }

    #[test]
    fn test_install_transaction_serde_roundtrip() {
        let mut tx = InstallTransaction::new();
        tx.add_operation(InstallOperation::CreateDir {
            path: PathBuf::from("/tmp/test"),
        });

        let json = serde_json::to_string(&tx).unwrap();
        let deser: InstallTransaction = serde_json::from_str(&json).unwrap();
        assert_eq!(deser.id, tx.id);
        assert_eq!(deser.operations.len(), 1);
        assert_eq!(deser.status, TransactionStatus::Pending);
    }

    #[tokio::test]
    async fn test_install_transaction_execute_create_dir() {
        let dir = tempfile::tempdir().unwrap();
        let new_dir = dir.path().join("subdir");

        let mut tx = InstallTransaction::new();
        tx.add_operation(InstallOperation::CreateDir {
            path: new_dir.clone(),
        });

        tx.execute().await.unwrap();
        assert_eq!(tx.status, TransactionStatus::Completed);
        assert!(new_dir.exists());
    }

    #[tokio::test]
    async fn test_install_transaction_execute_copy_file() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("source.txt");
        let dst = dir.path().join("dest.txt");
        std::fs::write(&src, "test content").unwrap();

        let mut tx = InstallTransaction::new();
        tx.add_operation(InstallOperation::CopyFile {
            src: src.clone(),
            dst: dst.clone(),
        });

        tx.execute().await.unwrap();
        assert_eq!(tx.status, TransactionStatus::Completed);
        assert!(dst.exists());
        assert_eq!(std::fs::read_to_string(&dst).unwrap(), "test content");
    }
}
