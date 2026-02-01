use crate::error::{CogniaError, CogniaResult};
use crate::platform::fs;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

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

pub async fn extract_archive(archive: &Path, dest: &Path) -> CogniaResult<Vec<PathBuf>> {
    let ext = archive.extension().and_then(|e| e.to_str()).unwrap_or("");

    fs::create_dir_all(dest).await?;

    let files = match ext {
        "gz" | "tgz" => extract_tar_gz(archive, dest).await?,
        "zip" => extract_zip(archive, dest).await?,
        "xz" => extract_tar_xz(archive, dest).await?,
        _ => {
            return Err(CogniaError::Installation(format!(
                "Unsupported archive format: {}",
                ext
            )))
        }
    };

    Ok(files)
}

async fn extract_tar_gz(archive: &Path, dest: &Path) -> CogniaResult<Vec<PathBuf>> {
    use crate::platform::process;

    #[cfg(unix)]
    let output = process::execute(
        "tar",
        &[
            "-xzf",
            &archive.display().to_string(),
            "-C",
            &dest.display().to_string(),
        ],
        None,
    )
    .await?;

    #[cfg(windows)]
    let output = process::execute(
        "tar",
        &[
            "-xzf",
            &archive.display().to_string(),
            "-C",
            &dest.display().to_string(),
        ],
        None,
    )
    .await?;

    if !output.success {
        return Err(CogniaError::Installation(output.stderr));
    }

    Ok(vec![])
}

async fn extract_zip(archive: &Path, dest: &Path) -> CogniaResult<Vec<PathBuf>> {
    use crate::platform::process;

    #[cfg(unix)]
    let output = process::execute(
        "unzip",
        &[
            "-o",
            &archive.display().to_string(),
            "-d",
            &dest.display().to_string(),
        ],
        None,
    )
    .await?;

    #[cfg(windows)]
    let output = process::execute(
        "powershell",
        &[
            "-Command",
            &format!(
                "Expand-Archive -Force -Path '{}' -DestinationPath '{}'",
                archive.display(),
                dest.display()
            ),
        ],
        None,
    )
    .await?;

    if !output.success {
        return Err(CogniaError::Installation(output.stderr));
    }

    Ok(vec![])
}

async fn extract_tar_xz(archive: &Path, dest: &Path) -> CogniaResult<Vec<PathBuf>> {
    use crate::platform::process;

    let output = process::execute(
        "tar",
        &[
            "-xJf",
            &archive.display().to_string(),
            "-C",
            &dest.display().to_string(),
        ],
        None,
    )
    .await?;

    if !output.success {
        return Err(CogniaError::Installation(output.stderr));
    }

    Ok(vec![])
}
