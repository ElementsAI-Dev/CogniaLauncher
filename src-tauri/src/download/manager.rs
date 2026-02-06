//! Download manager - the main coordinator for all download operations

use super::queue::{DownloadQueue, QueueStats};
use super::state::DownloadError;
use super::task::{DownloadConfig, DownloadProgress, DownloadTask};
use super::throttle::SpeedLimiter;
use crate::platform::fs;
use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use tokio::sync::{mpsc, RwLock};

/// Events emitted by the download manager
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DownloadEvent {
    /// A new task was added
    TaskAdded { task_id: String },
    /// Task started downloading
    TaskStarted { task_id: String },
    /// Task progress updated
    TaskProgress {
        task_id: String,
        progress: DownloadProgress,
    },
    /// Task completed successfully
    TaskCompleted { task_id: String },
    /// Task failed
    TaskFailed { task_id: String, error: String },
    /// Task was paused
    TaskPaused { task_id: String },
    /// Task was resumed
    TaskResumed { task_id: String },
    /// Task was cancelled
    TaskCancelled { task_id: String },
    /// Queue stats updated
    QueueUpdated { stats: QueueStats },
}

/// Control signals for download workers (reserved for future use)
#[derive(Debug, Clone)]
#[allow(dead_code)]
enum ControlSignal {
    Pause,
    Resume,
    Cancel,
    Shutdown,
}

/// Per-task control state
struct TaskControl {
    paused: Arc<AtomicBool>,
    cancelled: Arc<AtomicBool>,
}

impl TaskControl {
    fn new() -> Self {
        Self {
            paused: Arc::new(AtomicBool::new(false)),
            cancelled: Arc::new(AtomicBool::new(false)),
        }
    }

    fn pause(&self) {
        self.paused.store(true, Ordering::SeqCst);
    }

    fn resume(&self) {
        self.paused.store(false, Ordering::SeqCst);
    }

    fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
    }

    fn is_paused(&self) -> bool {
        self.paused.load(Ordering::SeqCst)
    }

    fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }
}

/// Configuration for the download manager
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadManagerConfig {
    /// Maximum concurrent downloads
    pub max_concurrent: usize,
    /// Global speed limit in bytes per second (0 = unlimited)
    pub speed_limit: u64,
    /// Default configuration for new tasks
    pub default_task_config: DownloadConfig,
    /// Directory for partial downloads
    pub partials_dir: PathBuf,
    /// Whether to auto-start downloads when added
    pub auto_start: bool,
}

impl Default for DownloadManagerConfig {
    fn default() -> Self {
        Self {
            max_concurrent: 4,
            speed_limit: 0,
            default_task_config: DownloadConfig::default(),
            partials_dir: PathBuf::from(".downloads"),
            auto_start: true,
        }
    }
}

/// The main download manager
pub struct DownloadManager {
    /// Download queue
    queue: Arc<RwLock<DownloadQueue>>,
    /// HTTP client
    client: Client,
    /// Speed limiter
    speed_limiter: SpeedLimiter,
    /// Configuration
    config: Arc<RwLock<DownloadManagerConfig>>,
    /// Task controls for pause/cancel
    task_controls: Arc<RwLock<HashMap<String, TaskControl>>>,
    /// Event sender
    event_tx: Option<mpsc::UnboundedSender<DownloadEvent>>,
    /// Whether the manager is running
    running: Arc<AtomicBool>,
    /// Shutdown signal (reserved for future graceful shutdown)
    #[allow(dead_code)]
    shutdown_tx: Option<mpsc::Sender<()>>,
}

impl Default for DownloadManager {
    fn default() -> Self {
        Self::new(DownloadManagerConfig::default())
    }
}

impl DownloadManager {
    /// Create a new download manager with the given configuration
    pub fn new(config: DownloadManagerConfig) -> Self {
        let speed_limiter = if config.speed_limit > 0 {
            SpeedLimiter::with_limit(config.speed_limit)
        } else {
            SpeedLimiter::new()
        };

        let client = Client::builder()
            .timeout(Duration::from_secs(config.default_task_config.timeout_secs))
            .user_agent("CogniaLauncher/0.1.0")
            .build()
            .expect("Failed to create HTTP client");

        Self {
            queue: Arc::new(RwLock::new(DownloadQueue::new(config.max_concurrent))),
            client,
            speed_limiter,
            config: Arc::new(RwLock::new(config)),
            task_controls: Arc::new(RwLock::new(HashMap::new())),
            event_tx: None,
            running: Arc::new(AtomicBool::new(false)),
            shutdown_tx: None,
        }
    }

    /// Set the event sender for receiving download events
    pub fn set_event_sender(&mut self, tx: mpsc::UnboundedSender<DownloadEvent>) {
        self.event_tx = Some(tx);
    }

    /// Create an event receiver
    pub fn create_event_channel(&mut self) -> mpsc::UnboundedReceiver<DownloadEvent> {
        let (tx, rx) = mpsc::unbounded_channel();
        self.event_tx = Some(tx);
        rx
    }

    /// Emit an event
    fn emit(&self, event: DownloadEvent) {
        if let Some(ref tx) = self.event_tx {
            let _ = tx.send(event);
        }
    }

    /// Add a new download task
    pub async fn add_task(&self, mut task: DownloadTask) -> String {
        // Apply default config if not set
        let config = self.config.read().await;
        if task.config.max_retries == 0 {
            task.config = config.default_task_config.clone();
        }
        drop(config);

        let task_id = task.id.clone();

        // Add to queue
        {
            let mut queue = self.queue.write().await;
            queue.add(task);
        }

        // Add control
        {
            let mut controls = self.task_controls.write().await;
            controls.insert(task_id.clone(), TaskControl::new());
        }

        self.emit(DownloadEvent::TaskAdded {
            task_id: task_id.clone(),
        });
        self.emit_queue_stats().await;

        task_id
    }

    /// Create and add a simple download task
    pub async fn download(
        &self,
        url: String,
        destination: PathBuf,
        name: String,
    ) -> String {
        let task = DownloadTask::new(url, destination, name);
        self.add_task(task).await
    }

    /// Pause a download
    pub async fn pause(&self, task_id: &str) -> Result<(), DownloadError> {
        // Signal the task to pause
        {
            let controls = self.task_controls.read().await;
            if let Some(control) = controls.get(task_id) {
                control.pause();
            }
        }

        // Update queue state
        {
            let mut queue = self.queue.write().await;
            queue.pause(task_id)?;
        }

        self.emit(DownloadEvent::TaskPaused {
            task_id: task_id.to_string(),
        });
        self.emit_queue_stats().await;

        Ok(())
    }

    /// Resume a paused download
    pub async fn resume(&self, task_id: &str) -> Result<(), DownloadError> {
        // Signal the task to resume
        {
            let controls = self.task_controls.read().await;
            if let Some(control) = controls.get(task_id) {
                control.resume();
            }
        }

        // Update queue state
        {
            let mut queue = self.queue.write().await;
            queue.resume(task_id)?;
        }

        self.emit(DownloadEvent::TaskResumed {
            task_id: task_id.to_string(),
        });
        self.emit_queue_stats().await;

        Ok(())
    }

    /// Cancel a download
    pub async fn cancel(&self, task_id: &str) -> Result<(), DownloadError> {
        // Signal the task to cancel
        {
            let controls = self.task_controls.read().await;
            if let Some(control) = controls.get(task_id) {
                control.cancel();
            }
        }

        // Update queue state
        {
            let mut queue = self.queue.write().await;
            queue.cancel(task_id)?;
        }

        self.emit(DownloadEvent::TaskCancelled {
            task_id: task_id.to_string(),
        });
        self.emit_queue_stats().await;

        Ok(())
    }

    /// Remove a task from the queue
    pub async fn remove(&self, task_id: &str) -> Option<DownloadTask> {
        // Cancel first if active
        let _ = self.cancel(task_id).await;

        let task = {
            let mut queue = self.queue.write().await;
            queue.remove(task_id)
        };

        {
            let mut controls = self.task_controls.write().await;
            controls.remove(task_id);
        }

        self.emit_queue_stats().await;
        task
    }

    /// Get a task by ID
    pub async fn get_task(&self, task_id: &str) -> Option<DownloadTask> {
        let queue = self.queue.read().await;
        queue.get(task_id).cloned()
    }

    /// Get all tasks
    pub async fn list_tasks(&self) -> Vec<DownloadTask> {
        let queue = self.queue.read().await;
        queue.list_all().into_iter().cloned().collect()
    }

    /// Get queue statistics
    pub async fn stats(&self) -> QueueStats {
        let queue = self.queue.read().await;
        queue.stats()
    }

    /// Set the speed limit (0 = unlimited)
    pub async fn set_speed_limit(&self, bytes_per_second: u64) {
        self.speed_limiter.set_limit(bytes_per_second);
        let mut config = self.config.write().await;
        config.speed_limit = bytes_per_second;
    }

    /// Get the current speed limit
    pub async fn get_speed_limit(&self) -> u64 {
        self.speed_limiter.get_limit().await
    }

    /// Get max concurrent downloads
    pub async fn get_max_concurrent(&self) -> usize {
        let config = self.config.read().await;
        config.max_concurrent
    }

    /// Set max concurrent downloads
    pub async fn set_max_concurrent(&self, max: usize) {
        let mut queue = self.queue.write().await;
        queue.set_max_concurrent(max);
        let mut config = self.config.write().await;
        config.max_concurrent = max;
    }

    /// Pause all downloads
    pub async fn pause_all(&self) -> usize {
        let mut queue = self.queue.write().await;
        let count = queue.pause_all();
        drop(queue);
        self.emit_queue_stats().await;
        count
    }

    /// Resume all paused downloads
    pub async fn resume_all(&self) -> usize {
        let mut queue = self.queue.write().await;
        let count = queue.resume_all();
        drop(queue);
        self.emit_queue_stats().await;
        count
    }

    /// Cancel all downloads
    pub async fn cancel_all(&self) -> usize {
        let mut queue = self.queue.write().await;
        let count = queue.cancel_all();
        drop(queue);
        self.emit_queue_stats().await;
        count
    }

    /// Clear finished downloads
    pub async fn clear_finished(&self) -> usize {
        let mut queue = self.queue.write().await;
        let count = queue.clear_finished();
        drop(queue);
        self.emit_queue_stats().await;
        count
    }

    /// Retry all failed downloads
    pub async fn retry_all_failed(&self) -> usize {
        let mut queue = self.queue.write().await;
        let count = queue.retry_all_failed();
        drop(queue);
        self.emit_queue_stats().await;
        count
    }

    /// Clean up stale partial download files older than the given max age
    pub async fn cleanup_stale_partials(&self, max_age: Duration) -> usize {
        let config = self.config.read().await;
        let partials_dir = config.partials_dir.clone();
        drop(config);

        if !partials_dir.exists() {
            return 0;
        }

        let mut cleaned = 0;
        let now = std::time::SystemTime::now();

        let mut entries = match tokio::fs::read_dir(&partials_dir).await {
            Ok(entries) => entries,
            Err(_) => return 0,
        };

        while let Ok(Some(entry)) = entries.next_entry().await {
            if let Ok(metadata) = entry.metadata().await {
                let age = metadata
                    .modified()
                    .ok()
                    .and_then(|m| now.duration_since(m).ok())
                    .unwrap_or_default();

                if age > max_age {
                    if let Ok(()) = tokio::fs::remove_file(entry.path()).await {
                        cleaned += 1;
                        log::info!("Cleaned stale partial download: {:?}", entry.path());
                    }
                }
            }
        }

        cleaned
    }

    /// Graceful shutdown: stop the processor loop and cancel all active downloads
    pub async fn shutdown(&self) {
        self.running.store(false, Ordering::SeqCst);

        // Cancel all active downloads
        let active_ids: Vec<String> = {
            let queue = self.queue.read().await;
            queue.list_active().iter().map(|t| t.id.clone()).collect()
        };

        for task_id in &active_ids {
            let controls = self.task_controls.read().await;
            if let Some(control) = controls.get(task_id) {
                control.cancel();
            }
        }

        // Give workers a moment to clean up
        tokio::time::sleep(Duration::from_millis(500)).await;

        log::info!(
            "Download manager shutdown: cancelled {} active downloads",
            active_ids.len()
        );
    }

    /// Start the download manager background processing
    pub async fn start(&self) {
        if self.running.swap(true, Ordering::SeqCst) {
            return; // Already running
        }

        let queue = self.queue.clone();
        let client = self.client.clone();
        let speed_limiter = self.speed_limiter.clone();
        let task_controls = self.task_controls.clone();
        let event_tx = self.event_tx.clone();
        let running = self.running.clone();
        let config = self.config.clone();

        tokio::spawn(async move {
            while running.load(Ordering::SeqCst) {
                // Check for new tasks to start
                let task_id = {
                    let mut q = queue.write().await;
                    q.next_pending()
                };

                if let Some(task_id) = task_id {
                    // Get task details
                    let task = {
                        let q = queue.read().await;
                        q.get(&task_id).cloned()
                    };

                    if let Some(task) = task {
                        let control = {
                            let controls = task_controls.read().await;
                            controls.get(&task_id).map(|c| TaskControl {
                                paused: c.paused.clone(),
                                cancelled: c.cancelled.clone(),
                            })
                        };

                        if let Some(control) = control {
                            // Spawn download worker
                            let queue = queue.clone();
                            let client = client.clone();
                            let speed_limiter = speed_limiter.clone();
                            let event_tx = event_tx.clone();
                            let cfg = config.clone();

                            tokio::spawn(async move {
                                Self::download_worker(
                                    task,
                                    control,
                                    queue,
                                    client,
                                    speed_limiter,
                                    event_tx,
                                    cfg,
                                )
                                .await;
                            });
                        }
                    }
                } else {
                    // No pending tasks, sleep a bit
                    tokio::time::sleep(Duration::from_millis(100)).await;
                }
            }
        });
    }

    /// Stop the download manager
    pub async fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
        self.pause_all().await;
    }

    /// Check if the manager is running
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    /// Emit queue stats event
    async fn emit_queue_stats(&self) {
        let stats = {
            let queue = self.queue.read().await;
            queue.stats()
        };
        self.emit(DownloadEvent::QueueUpdated { stats });
    }

    /// The actual download worker
    async fn download_worker(
        task: DownloadTask,
        control: TaskControl,
        queue: Arc<RwLock<DownloadQueue>>,
        client: Client,
        speed_limiter: SpeedLimiter,
        event_tx: Option<mpsc::UnboundedSender<DownloadEvent>>,
        config: Arc<RwLock<DownloadManagerConfig>>,
    ) {
        let task_id = task.id.clone();

        // Emit started event
        if let Some(ref tx) = event_tx {
            let _ = tx.send(DownloadEvent::TaskStarted {
                task_id: task_id.clone(),
            });
        }

        // Perform the download
        let result = Self::do_download(
            &task,
            &control,
            &queue,
            &client,
            &speed_limiter,
            &event_tx,
            &config,
        )
        .await;

        // Update task state based on result
        match result {
            Ok(()) => {
                let mut q = queue.write().await;
                let _ = q.complete(&task_id);

                if let Some(ref tx) = event_tx {
                    let _ = tx.send(DownloadEvent::TaskCompleted {
                        task_id: task_id.clone(),
                    });
                    let _ = tx.send(DownloadEvent::QueueUpdated { stats: q.stats() });
                }
            }
            Err(err) => {
                if control.is_cancelled() {
                    // Already handled by cancel()
                    return;
                }

                // Get retry count before failing (for backoff calculation)
                let retry_count = {
                    let q = queue.read().await;
                    q.get(&task_id).map(|t| t.retries).unwrap_or(0)
                };

                let mut q = queue.write().await;
                let will_retry = q.fail(&task_id, err.clone()).unwrap_or(false);

                if will_retry {
                    // Exponential backoff: 2^retry * 1s, capped at 60s
                    let backoff_secs = (2u64.pow(retry_count)).min(60);
                    drop(q); // Release lock during sleep
                    log::info!(
                        "Download {} failed (attempt {}), retrying in {}s: {}",
                        task_id, retry_count + 1, backoff_secs, err
                    );
                    tokio::time::sleep(Duration::from_secs(backoff_secs)).await;
                } else {
                    if let Some(ref tx) = event_tx {
                        let _ = tx.send(DownloadEvent::TaskFailed {
                            task_id: task_id.clone(),
                            error: err.to_string(),
                        });
                    }

                    if let Some(ref tx) = event_tx {
                        let _ = tx.send(DownloadEvent::QueueUpdated { stats: q.stats() });
                    }
                }
            }
        }
    }

    /// Perform the actual download
    async fn do_download(
        task: &DownloadTask,
        control: &TaskControl,
        queue: &Arc<RwLock<DownloadQueue>>,
        client: &Client,
        speed_limiter: &SpeedLimiter,
        event_tx: &Option<mpsc::UnboundedSender<DownloadEvent>>,
        _config: &Arc<RwLock<DownloadManagerConfig>>,
    ) -> Result<(), DownloadError> {
        let task_id = &task.id;
        let url = &task.url;
        let dest = &task.destination;

        // Create parent directory if needed
        if let Some(parent) = dest.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| DownloadError::FileSystem {
                    message: e.to_string(),
                })?;
        }

        // Check if we can resume
        let resume_from = if task.config.allow_resume && dest.exists() {
            let size = tokio::fs::metadata(dest)
                .await
                .map(|m| m.len())
                .unwrap_or(0);
            if size > 0 {
                Some(size)
            } else {
                None
            }
        } else {
            None
        };

        // Build request
        let mut request = client.get(url);
        if let Some(pos) = resume_from {
            request = request.header("Range", format!("bytes={}-", pos));
        }

        // Send request
        let response = request.send().await.map_err(|e| DownloadError::Network {
            message: e.to_string(),
        })?;

        // Check status
        if !response.status().is_success() && response.status().as_u16() != 206 {
            return Err(DownloadError::HttpError {
                status: response.status().as_u16(),
                message: response.status().to_string(),
            });
        }

        // Get total size
        let total_size = response.content_length().map(|len| {
            len + resume_from.unwrap_or(0)
        });

        // Open file
        let mut file = if resume_from.is_some() {
            tokio::fs::OpenOptions::new()
                .write(true)
                .append(true)
                .open(dest)
                .await
                .map_err(|e| DownloadError::FileSystem {
                    message: e.to_string(),
                })?
        } else {
            File::create(dest)
                .await
                .map_err(|e| DownloadError::FileSystem {
                    message: e.to_string(),
                })?
        };

        let mut downloaded = resume_from.unwrap_or(0);
        let start_time = Instant::now();
        let mut last_progress_update = Instant::now();
        let mut stream = response.bytes_stream();

        while let Some(chunk_result) = stream.next().await {
            // Check for cancellation
            if control.is_cancelled() {
                return Err(DownloadError::Interrupted);
            }

            // Check for pause
            while control.is_paused() {
                if control.is_cancelled() {
                    return Err(DownloadError::Interrupted);
                }
                tokio::time::sleep(Duration::from_millis(100)).await;
            }

            let chunk = chunk_result.map_err(|e| DownloadError::Network {
                message: e.to_string(),
            })?;

            // Apply speed limit
            let chunk_len = chunk.len() as u64;
            if speed_limiter.is_enabled() {
                let mut remaining = chunk_len;
                while remaining > 0 {
                    let allowed = speed_limiter.acquire(remaining).await;
                    remaining -= allowed;
                }
            }

            // Write to file
            file.write_all(&chunk)
                .await
                .map_err(|e| DownloadError::FileSystem {
                    message: e.to_string(),
                })?;

            downloaded += chunk_len;

            // Update progress (throttle to avoid too many updates)
            if last_progress_update.elapsed() >= Duration::from_millis(100) {
                let elapsed = start_time.elapsed().as_secs_f64();
                let speed = if elapsed > 0.0 {
                    (downloaded - resume_from.unwrap_or(0)) as f64 / elapsed
                } else {
                    0.0
                };

                let progress = DownloadProgress::new(downloaded, total_size, speed);

                // Update task in queue
                {
                    let mut q = queue.write().await;
                    if let Some(t) = q.get_mut(task_id) {
                        t.progress = progress.clone();
                    }
                }

                // Emit progress event
                if let Some(ref tx) = event_tx {
                    let _ = tx.send(DownloadEvent::TaskProgress {
                        task_id: task_id.clone(),
                        progress,
                    });
                }

                last_progress_update = Instant::now();
            }
        }

        // Flush file
        file.flush()
            .await
            .map_err(|e| DownloadError::FileSystem {
                message: e.to_string(),
            })?;

        // Verify checksum if provided
        if task.config.verify_checksum {
            if let Some(ref expected) = task.expected_checksum {
                let actual = fs::calculate_sha256(dest).await.map_err(|e| {
                    DownloadError::FileSystem {
                        message: e.to_string(),
                    }
                })?;

                if &actual != expected {
                    // Remove corrupted file
                    let _ = tokio::fs::remove_file(dest).await;
                    return Err(DownloadError::ChecksumMismatch {
                        expected: expected.clone(),
                        actual,
                    });
                }
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::download::DownloadState;

    #[tokio::test]
    async fn test_download_manager_new() {
        let manager = DownloadManager::new(DownloadManagerConfig::default());
        assert!(!manager.is_running());
    }

    #[tokio::test]
    async fn test_download_manager_add_task() {
        let manager = DownloadManager::new(DownloadManagerConfig::default());

        let task_id = manager
            .download(
                "https://example.com/file.zip".to_string(),
                PathBuf::from("/tmp/file.zip"),
                "Test File".to_string(),
            )
            .await;

        assert!(!task_id.is_empty());

        let task = manager.get_task(&task_id).await;
        assert!(task.is_some());
        assert_eq!(task.unwrap().state, DownloadState::Queued);
    }

    #[tokio::test]
    async fn test_download_manager_stats() {
        let manager = DownloadManager::new(DownloadManagerConfig::default());

        manager
            .download(
                "https://example.com/file1.zip".to_string(),
                PathBuf::from("/tmp/file1.zip"),
                "Test 1".to_string(),
            )
            .await;

        manager
            .download(
                "https://example.com/file2.zip".to_string(),
                PathBuf::from("/tmp/file2.zip"),
                "Test 2".to_string(),
            )
            .await;

        let stats = manager.stats().await;
        assert_eq!(stats.total_tasks, 2);
        assert_eq!(stats.queued, 2);
    }

    #[tokio::test]
    async fn test_download_manager_cancel() {
        let manager = DownloadManager::new(DownloadManagerConfig::default());

        let task_id = manager
            .download(
                "https://example.com/file.zip".to_string(),
                PathBuf::from("/tmp/file.zip"),
                "Test File".to_string(),
            )
            .await;

        manager.cancel(&task_id).await.unwrap();

        let task = manager.get_task(&task_id).await.unwrap();
        assert_eq!(task.state, DownloadState::Cancelled);
    }

    #[tokio::test]
    async fn test_download_manager_remove() {
        let manager = DownloadManager::new(DownloadManagerConfig::default());

        let task_id = manager
            .download(
                "https://example.com/file.zip".to_string(),
                PathBuf::from("/tmp/file.zip"),
                "Test File".to_string(),
            )
            .await;

        let removed = manager.remove(&task_id).await;
        assert!(removed.is_some());

        let task = manager.get_task(&task_id).await;
        assert!(task.is_none());
    }

    #[tokio::test]
    async fn test_download_manager_speed_limit() {
        let manager = DownloadManager::new(DownloadManagerConfig::default());

        assert_eq!(manager.get_speed_limit().await, 0);

        manager.set_speed_limit(1024 * 1024).await; // 1 MB/s
        assert_eq!(manager.get_speed_limit().await, 1024 * 1024);

        manager.set_speed_limit(0).await;
        assert_eq!(manager.get_speed_limit().await, 0);
    }

    #[tokio::test]
    async fn test_download_manager_clear_finished() {
        let manager = DownloadManager::new(DownloadManagerConfig::default());

        let task_id = manager
            .download(
                "https://example.com/file.zip".to_string(),
                PathBuf::from("/tmp/file.zip"),
                "Test File".to_string(),
            )
            .await;

        manager.cancel(&task_id).await.unwrap();

        let cleared = manager.clear_finished().await;
        assert_eq!(cleared, 1);
        assert_eq!(manager.stats().await.total_tasks, 0);
    }
}
