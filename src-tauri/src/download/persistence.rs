//! Download queue persistence - save/restore incomplete tasks across app restarts

use super::task::DownloadTask;
use super::state::DownloadState;
use std::path::{Path, PathBuf};
use tokio::sync::Mutex;
use std::sync::Arc;
use std::time::{Duration, Instant};

/// Manages persistence of the download queue to a JSON file.
///
/// Only non-terminal tasks (Queued, Downloading, Paused) are persisted.
/// Terminal tasks (Completed, Cancelled, Failed) are tracked by DownloadHistory.
pub struct QueuePersistence {
    file_path: PathBuf,
    /// Debounce: skip writes if last write was less than this ago
    last_write: Arc<Mutex<Instant>>,
    debounce: Duration,
}

impl QueuePersistence {
    /// Create a new persistence manager.
    ///
    /// `dir` is the directory where `download_queue.json` will be stored.
    pub fn new(dir: &Path) -> Self {
        Self {
            file_path: dir.join("download_queue.json"),
            last_write: Arc::new(Mutex::new(Instant::now() - Duration::from_secs(60))),
            debounce: Duration::from_millis(500),
        }
    }

    /// Save non-terminal tasks to disk.
    ///
    /// Uses debounce to avoid excessive writes. Pass `force = true` to bypass.
    pub async fn save(&self, tasks: &[DownloadTask], force: bool) -> Result<(), String> {
        if !force {
            let last = self.last_write.lock().await;
            if last.elapsed() < self.debounce {
                return Ok(());
            }
        }

        let persistable: Vec<&DownloadTask> = tasks
            .iter()
            .filter(|t| !t.state.is_terminal())
            .collect();

        let json = serde_json::to_string_pretty(&persistable)
            .map_err(|e| format!("Failed to serialize queue: {}", e))?;

        if let Some(parent) = self.file_path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }

        // Write atomically: write to temp then rename
        let tmp_path = self.file_path.with_extension("json.tmp");
        tokio::fs::write(&tmp_path, json.as_bytes())
            .await
            .map_err(|e| format!("Failed to write queue file: {}", e))?;
        tokio::fs::rename(&tmp_path, &self.file_path)
            .await
            .map_err(|e| format!("Failed to rename queue file: {}", e))?;

        let mut last = self.last_write.lock().await;
        *last = Instant::now();

        Ok(())
    }

    /// Load persisted tasks from disk.
    ///
    /// All loaded tasks are reset to `Queued` state (Downloading tasks were interrupted).
    /// Returns an empty vec if the file doesn't exist.
    pub async fn load(&self) -> Result<Vec<DownloadTask>, String> {
        if !self.file_path.exists() {
            return Ok(Vec::new());
        }

        let data = tokio::fs::read_to_string(&self.file_path)
            .await
            .map_err(|e| format!("Failed to read queue file: {}", e))?;

        if data.trim().is_empty() {
            return Ok(Vec::new());
        }

        let mut tasks: Vec<DownloadTask> = serde_json::from_str(&data)
            .map_err(|e| format!("Failed to deserialize queue: {}", e))?;

        // Reset all tasks to Queued — they were interrupted
        for task in &mut tasks {
            match &task.state {
                DownloadState::Downloading | DownloadState::Queued | DownloadState::Paused => {
                    task.state = DownloadState::Queued;
                    task.error = None;
                }
                _ => {
                    // Terminal tasks shouldn't be in the file, but handle gracefully
                    task.state = DownloadState::Queued;
                    task.error = None;
                    task.retries = 0;
                }
            }
        }

        log::info!(
            "Restored {} download tasks from {}",
            tasks.len(),
            self.file_path.display()
        );

        Ok(tasks)
    }

    /// Remove the persistence file (e.g. when all tasks are done).
    pub async fn clear(&self) -> Result<(), String> {
        if self.file_path.exists() {
            tokio::fs::remove_file(&self.file_path)
                .await
                .map_err(|e| format!("Failed to remove queue file: {}", e))?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tempfile::TempDir;

    fn create_test_task(name: &str) -> DownloadTask {
        DownloadTask::new(
            format!("https://example.com/{}.zip", name),
            PathBuf::from(format!("/tmp/{}.zip", name)),
            name.to_string(),
        )
    }

    #[tokio::test]
    async fn test_save_and_load() {
        let tmp = TempDir::new().unwrap();
        let persistence = QueuePersistence::new(tmp.path());

        let tasks = vec![
            create_test_task("file1"),
            create_test_task("file2"),
        ];

        persistence.save(&tasks, true).await.unwrap();
        let loaded = persistence.load().await.unwrap();

        assert_eq!(loaded.len(), 2);
        assert_eq!(loaded[0].name, "file1");
        assert_eq!(loaded[1].name, "file2");
        assert_eq!(loaded[0].state, DownloadState::Queued);
    }

    #[tokio::test]
    async fn test_load_nonexistent() {
        let tmp = TempDir::new().unwrap();
        let persistence = QueuePersistence::new(tmp.path());

        let loaded = persistence.load().await.unwrap();
        assert!(loaded.is_empty());
    }

    #[tokio::test]
    async fn test_terminal_tasks_not_saved() {
        let tmp = TempDir::new().unwrap();
        let persistence = QueuePersistence::new(tmp.path());

        let mut task1 = create_test_task("active");
        let mut task2 = create_test_task("completed");
        task2.mark_completed();
        let mut task3 = create_test_task("cancelled");
        task3.mark_cancelled();
        let mut task4 = create_test_task("paused");
        task4.mark_paused();

        // task1 = Queued, task4 = Paused → both non-terminal
        let tasks = vec![task1, task2, task3, task4];

        persistence.save(&tasks, true).await.unwrap();
        let loaded = persistence.load().await.unwrap();

        assert_eq!(loaded.len(), 2);
        assert!(loaded.iter().all(|t| t.state == DownloadState::Queued));
    }

    #[tokio::test]
    async fn test_downloading_tasks_reset_to_queued() {
        let tmp = TempDir::new().unwrap();
        let persistence = QueuePersistence::new(tmp.path());

        let mut task = create_test_task("downloading");
        task.mark_started(); // state = Downloading

        persistence.save(&[task], true).await.unwrap();
        let loaded = persistence.load().await.unwrap();

        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].state, DownloadState::Queued);
    }

    #[tokio::test]
    async fn test_clear() {
        let tmp = TempDir::new().unwrap();
        let persistence = QueuePersistence::new(tmp.path());

        let tasks = vec![create_test_task("file1")];
        persistence.save(&tasks, true).await.unwrap();

        assert!(tmp.path().join("download_queue.json").exists());

        persistence.clear().await.unwrap();
        assert!(!tmp.path().join("download_queue.json").exists());
    }

    #[tokio::test]
    async fn test_debounce() {
        let tmp = TempDir::new().unwrap();
        let persistence = QueuePersistence::new(tmp.path());

        let tasks = vec![create_test_task("file1")];

        // First save (forced) should succeed
        persistence.save(&tasks, true).await.unwrap();
        assert!(tmp.path().join("download_queue.json").exists());

        // Immediate second save (not forced) should be debounced
        tokio::fs::remove_file(tmp.path().join("download_queue.json"))
            .await
            .unwrap();
        persistence.save(&tasks, false).await.unwrap();
        // File should NOT exist because debounce skipped the write
        assert!(!tmp.path().join("download_queue.json").exists());
    }

    #[tokio::test]
    async fn test_empty_file() {
        let tmp = TempDir::new().unwrap();
        let persistence = QueuePersistence::new(tmp.path());

        tokio::fs::write(tmp.path().join("download_queue.json"), "")
            .await
            .unwrap();

        let loaded = persistence.load().await.unwrap();
        assert!(loaded.is_empty());
    }
}
