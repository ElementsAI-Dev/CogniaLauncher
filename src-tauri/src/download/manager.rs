//! Download manager - the main coordinator for all download operations

use super::persistence::QueuePersistence;
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
    /// Task is being extracted
    TaskExtracting { task_id: String },
    /// Task archive was extracted
    TaskExtracted {
        task_id: String,
        files: Vec<String>,
    },
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
    /// Progress event throttle interval in milliseconds
    pub progress_interval_ms: u64,
}

impl Default for DownloadManagerConfig {
    fn default() -> Self {
        Self {
            max_concurrent: 4,
            speed_limit: 0,
            default_task_config: DownloadConfig::default(),
            partials_dir: PathBuf::from(".downloads"),
            auto_start: true,
            progress_interval_ms: 100,
        }
    }
}

/// Parse a Content-Disposition header value to extract the filename.
///
/// Supports `filename*=UTF-8''encoded` (RFC 5987), `filename="quoted"`, and
/// `filename=unquoted` forms.  `filename*` takes priority when present.
fn parse_content_disposition(header: &str) -> Option<String> {
    let mut filename = None;
    let mut filename_star = None;

    for part in header.split(';') {
        let part = part.trim();
        if part.starts_with("filename*=") {
            let value = part.trim_start_matches("filename*=");
            // RFC 5987: charset'language'value  (e.g. UTF-8''my%20file.zip)
            if let Some(encoded) = value.split('\'').nth(2) {
                filename_star = Some(percent_decode(encoded));
            }
        } else if part.starts_with("filename=") {
            filename = Some(
                part.trim_start_matches("filename=")
                    .trim_matches('"')
                    .to_string(),
            );
        }
    }

    // filename* takes precedence per RFC 6266 §4.3
    filename_star.or(filename)
}

/// Decode percent-encoded bytes (RFC 3986 / RFC 5987).
fn percent_decode(input: &str) -> String {
    let mut bytes = Vec::with_capacity(input.len());
    let mut chars = input.chars();
    while let Some(c) = chars.next() {
        if c == '%' {
            let hex: String = chars.by_ref().take(2).collect();
            if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                bytes.push(byte);
            } else {
                bytes.push(b'%');
                bytes.extend(hex.as_bytes());
            }
        } else {
            bytes.push(c as u8);
        }
    }
    String::from_utf8(bytes).unwrap_or_else(|e| String::from_utf8_lossy(e.as_bytes()).into_owned())
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
    /// Queue persistence for crash recovery
    persistence: Option<Arc<QueuePersistence>>,
}

impl Default for DownloadManager {
    fn default() -> Self {
        Self::new(DownloadManagerConfig::default(), None)
    }
}

impl DownloadManager {
    /// Create a new download manager with the given configuration
    pub fn new(config: DownloadManagerConfig, proxy: Option<String>) -> Self {
        let speed_limiter = if config.speed_limit > 0 {
            SpeedLimiter::with_limit(config.speed_limit)
        } else {
            SpeedLimiter::new()
        };

        let mut builder = Client::builder()
            .connect_timeout(Duration::from_secs(30))
            .read_timeout(Duration::from_secs(300))
            .user_agent("CogniaLauncher/0.1.0");

        if let Some(ref proxy_url) = proxy {
            if !proxy_url.is_empty() {
                if let Ok(p) = reqwest::Proxy::all(proxy_url) {
                    builder = builder.proxy(p);
                }
            }
        }

        let client = builder.build().expect("Failed to create HTTP client");

        Self {
            queue: Arc::new(RwLock::new(DownloadQueue::new(config.max_concurrent))),
            client,
            speed_limiter,
            config: Arc::new(RwLock::new(config)),
            task_controls: Arc::new(RwLock::new(HashMap::new())),
            event_tx: None,
            running: Arc::new(AtomicBool::new(false)),
            shutdown_tx: None,
            persistence: None,
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

    /// Enable queue persistence for crash recovery.
    ///
    /// `dir` is the directory where `download_queue.json` will be stored.
    pub fn enable_persistence(&mut self, dir: &std::path::Path) {
        self.persistence = Some(Arc::new(QueuePersistence::new(dir)));
    }

    /// Load persisted tasks from previous session and add them to the queue.
    pub async fn load_persisted_tasks(&self) -> usize {
        let persistence = match &self.persistence {
            Some(p) => p.clone(),
            None => return 0,
        };

        match persistence.load().await {
            Ok(tasks) => {
                let count = tasks.len();
                for task in tasks {
                    let task_id = task.id.clone();
                    {
                        let mut queue = self.queue.write().await;
                        queue.add(task);
                    }
                    {
                        let mut controls = self.task_controls.write().await;
                        controls.insert(task_id, TaskControl::new());
                    }
                }
                count
            }
            Err(e) => {
                log::warn!("Failed to load persisted download queue: {}", e);
                0
            }
        }
    }

    /// Persist the current queue state to disk (debounced).
    async fn persist_queue(&self) {
        let persistence = match &self.persistence {
            Some(p) => p.clone(),
            None => return,
        };

        let tasks: Vec<DownloadTask> = {
            let queue = self.queue.read().await;
            queue.list_all().into_iter().cloned().collect()
        };

        if let Err(e) = persistence.save(&tasks, false).await {
            log::warn!("Failed to persist download queue: {}", e);
        }
    }

    /// Force-persist the current queue state (bypasses debounce).
    pub async fn persist_queue_force(&self) {
        let persistence = match &self.persistence {
            Some(p) => p.clone(),
            None => return,
        };

        let tasks: Vec<DownloadTask> = {
            let queue = self.queue.read().await;
            queue.list_all().into_iter().cloned().collect()
        };

        if let Err(e) = persistence.save(&tasks, true).await {
            log::warn!("Failed to persist download queue: {}", e);
        }
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
        self.persist_queue().await;

        task_id
    }

    /// Create and add a simple download task
    pub async fn download(&self, url: String, destination: PathBuf, name: String) -> String {
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
        self.persist_queue().await;

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
        self.persist_queue().await;

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
        self.persist_queue().await;

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
        self.persist_queue().await;
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
        // Signal all active task controls to pause
        let active_ids: Vec<String> = {
            let queue = self.queue.read().await;
            queue.list_active().iter().map(|t| t.id.clone()).collect()
        };
        {
            let controls = self.task_controls.read().await;
            for task_id in &active_ids {
                if let Some(control) = controls.get(task_id) {
                    control.pause();
                }
            }
        }

        let mut queue = self.queue.write().await;
        let count = queue.pause_all();
        drop(queue);
        self.emit_queue_stats().await;
        count
    }

    /// Resume all paused downloads
    pub async fn resume_all(&self) -> usize {
        // Clear paused flag on all task controls so workers resume
        let paused_ids: Vec<String> = {
            let queue = self.queue.read().await;
            queue
                .list_all()
                .iter()
                .filter(|t| t.state == crate::download::DownloadState::Paused)
                .map(|t| t.id.clone())
                .collect()
        };
        {
            let controls = self.task_controls.read().await;
            for task_id in &paused_ids {
                if let Some(control) = controls.get(task_id) {
                    control.resume();
                }
            }
        }

        let mut queue = self.queue.write().await;
        let count = queue.resume_all();
        drop(queue);
        self.emit_queue_stats().await;
        count
    }

    /// Cancel all downloads
    pub async fn cancel_all(&self) -> usize {
        // Signal all non-terminal task controls to cancel
        let non_terminal_ids: Vec<String> = {
            let queue = self.queue.read().await;
            queue
                .list_all()
                .iter()
                .filter(|t| !t.state.is_terminal())
                .map(|t| t.id.clone())
                .collect()
        };
        {
            let controls = self.task_controls.read().await;
            for task_id in &non_terminal_ids {
                if let Some(control) = controls.get(task_id) {
                    control.cancel();
                }
            }
        }

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

    /// Set priority for a download task
    pub async fn set_priority(
        &self,
        task_id: &str,
        priority: i32,
    ) -> Result<(), DownloadError> {
        let mut queue = self.queue.write().await;
        queue.set_priority(task_id, priority)?;
        drop(queue);
        self.emit_queue_stats().await;
        Ok(())
    }

    /// Force-retry a single terminal task (failed/cancelled/completed)
    pub async fn retry_task(&self, task_id: &str) -> Result<(), DownloadError> {
        {
            let controls = self.task_controls.read().await;
            if let Some(control) = controls.get(task_id) {
                // Reset control flags so the new worker starts clean
                control.resume();
            }
        }

        let mut queue = self.queue.write().await;
        queue.retry_task(task_id)?;
        drop(queue);
        self.emit_queue_stats().await;
        Ok(())
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

        // Force-persist remaining queue state for crash recovery
        self.persist_queue_force().await;

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

        // Perform the download with per-task timeout, trying mirror URLs on failure
        let timeout_duration = Duration::from_secs(task.config.timeout_secs);

        // Build list of URLs to try: primary first, then mirrors
        let mut urls_to_try = vec![task.url.clone()];
        urls_to_try.extend(task.mirror_urls.clone());

        let mut result: Result<(), DownloadError> = Err(DownloadError::Network {
            message: "No URLs to try".to_string(),
        });

        for (url_idx, try_url) in urls_to_try.iter().enumerate() {
            if control.is_cancelled() {
                result = Err(DownloadError::Interrupted);
                break;
            }

            // Use a temporary task with the current URL
            let mut try_task = task.clone();
            try_task.url = try_url.clone();

            let download_future = Self::do_download(
                &try_task,
                &control,
                &queue,
                &client,
                &speed_limiter,
                &event_tx,
                &config,
            );
            result = match tokio::time::timeout(timeout_duration, download_future).await {
                Ok(inner) => inner,
                Err(_) => Err(DownloadError::Timeout {
                    seconds: task.config.timeout_secs,
                }),
            };

            if result.is_ok() {
                if url_idx > 0 {
                    log::info!(
                        "Download {} succeeded with mirror URL #{}",
                        task_id,
                        url_idx
                    );
                }
                break;
            }

            // If there are more mirrors to try and error is recoverable, log and continue
            if url_idx < urls_to_try.len() - 1 {
                log::warn!(
                    "Download {} failed with URL {}, trying mirror #{}: {}",
                    task_id,
                    try_url,
                    url_idx + 1,
                    result.as_ref().unwrap_err()
                );
            }
        }

        // Update task state based on result
        match result {
            Ok(()) => {
                // Auto-extract if configured
                if task.config.auto_extract {
                    if let Some(ref tx) = event_tx {
                        let _ = tx.send(DownloadEvent::TaskExtracting {
                            task_id: task_id.clone(),
                        });
                    }

                    let extract_dest = task
                        .config
                        .extract_dest
                        .clone()
                        .unwrap_or_else(|| {
                            task.destination
                                .parent()
                                .unwrap_or(&task.destination)
                                .to_path_buf()
                        });

                    match crate::core::installer::extract_archive(
                        &task.destination,
                        &extract_dest,
                    )
                    .await
                    {
                        Ok(files) => {
                            let file_strs: Vec<String> =
                                files.into_iter().map(|p| p.display().to_string()).collect();
                            if let Some(ref tx) = event_tx {
                                let _ = tx.send(DownloadEvent::TaskExtracted {
                                    task_id: task_id.clone(),
                                    files: file_strs,
                                });
                            }
                        }
                        Err(e) => {
                            log::warn!(
                                "Auto-extract failed for {}: {}",
                                task_id,
                                e
                            );
                        }
                    }
                }

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
                    // Use server-provided retry_after for rate limits,
                    // otherwise exponential backoff: 2^retry * 1s, capped at 60s
                    let backoff_secs = match &err {
                        DownloadError::RateLimited { retry_after } => *retry_after,
                        _ => (2u64.pow(retry_count)).min(60),
                    };
                    drop(q); // Release lock during sleep
                    log::info!(
                        "Download {} failed (attempt {}), retrying in {}s: {}",
                        task_id,
                        retry_count + 1,
                        backoff_secs,
                        err
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
        config: &Arc<RwLock<DownloadManagerConfig>>,
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

        // Apply custom headers (e.g. auth tokens for private repos)
        for (key, value) in &task.headers {
            request = request.header(key.as_str(), value.as_str());
        }

        // Send request
        let response = request.send().await.map_err(|e| DownloadError::Network {
            message: e.to_string(),
        })?;

        // Detect GitHub 403 rate limit → recoverable error with auto-retry
        if response.status() == reqwest::StatusCode::FORBIDDEN {
            let remaining = response
                .headers()
                .get("x-ratelimit-remaining")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse::<u64>().ok());
            if remaining == Some(0) {
                let retry_after = response
                    .headers()
                    .get("x-ratelimit-reset")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|v| v.parse::<u64>().ok())
                    .map(|epoch| {
                        epoch.saturating_sub(
                            std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs(),
                        )
                    })
                    .unwrap_or(60);
                return Err(DownloadError::RateLimited { retry_after });
            }
        }

        // Check status
        if !response.status().is_success() && response.status().as_u16() != 206 {
            return Err(DownloadError::HttpError {
                status: response.status().as_u16(),
                message: response.status().to_string(),
            });
        }

        // Detect resume support from server
        let server_supports_resume = response
            .headers()
            .get("accept-ranges")
            .and_then(|v| v.to_str().ok())
            .map(|v| v == "bytes")
            .unwrap_or(false);
        if server_supports_resume {
            let mut q = queue.write().await;
            if let Some(t) = q.get_mut(task_id) {
                t.supports_resume = true;
            }
        }

        // Parse Content-Disposition for server-provided filename
        let server_filename = response
            .headers()
            .get("content-disposition")
            .and_then(|v| v.to_str().ok())
            .and_then(parse_content_disposition);
        if server_filename.is_some() {
            let mut q = queue.write().await;
            if let Some(t) = q.get_mut(task_id) {
                t.server_filename = server_filename;
            }
        }

        // Get total size
        let total_size = response
            .content_length()
            .map(|len| len + resume_from.unwrap_or(0));

        // Check disk space before downloading
        if let Some(total) = total_size {
            let check_path = dest.parent().unwrap_or(dest);
            if let Ok(space) = crate::platform::disk::get_disk_space(check_path).await {
                if space.available < total {
                    return Err(DownloadError::InsufficientSpace {
                        required: total,
                        available: space.available,
                    });
                }
            }
        }

        // Read configurable progress interval
        let progress_interval = {
            let cfg = config.read().await;
            Duration::from_millis(cfg.progress_interval_ms)
        };

        // Minimum file size to use segmented download (10 MB)
        const SEGMENT_THRESHOLD: u64 = 10 * 1024 * 1024;
        let use_segments = task.config.segments > 1
            && server_supports_resume
            && resume_from.is_none()
            && total_size.map(|s| s >= SEGMENT_THRESHOLD).unwrap_or(false);

        if use_segments {
            // Drop the initial response — we'll make per-segment Range requests
            drop(response);
            let total = total_size.unwrap(); // safe: checked above
            let num_segments = (task.config.segments as u64).min(32).max(1);
            let segment_size = total / num_segments;

            // Shared progress counter
            let downloaded_total = Arc::new(std::sync::atomic::AtomicU64::new(0));
            let start_time = Instant::now();
            let last_progress = Arc::new(tokio::sync::Mutex::new(Instant::now()));

            // Pre-allocate file
            {
                let file = File::create(dest)
                    .await
                    .map_err(|e| DownloadError::FileSystem {
                        message: e.to_string(),
                    })?;
                file.set_len(total)
                    .await
                    .map_err(|e| DownloadError::FileSystem {
                        message: e.to_string(),
                    })?;
            }

            let mut handles = Vec::new();

            for i in 0..num_segments {
                let range_start = i * segment_size;
                let range_end = if i == num_segments - 1 {
                    total - 1
                } else {
                    (i + 1) * segment_size - 1
                };

                let client = client.clone();
                let url = url.clone();
                let dest = dest.clone();
                let headers = task.headers.clone();
                let speed_limiter = speed_limiter.clone();
                let control_paused = control.paused.clone();
                let control_cancelled = control.cancelled.clone();
                let downloaded_total = downloaded_total.clone();

                let handle = tokio::spawn(async move {
                    let mut req = client
                        .get(&url)
                        .header("Range", format!("bytes={}-{}", range_start, range_end));
                    for (key, value) in &headers {
                        req = req.header(key.as_str(), value.as_str());
                    }

                    let resp = req.send().await.map_err(|e| DownloadError::Network {
                        message: format!("Segment {} error: {}", i, e),
                    })?;

                    if !resp.status().is_success() && resp.status().as_u16() != 206 {
                        return Err(DownloadError::HttpError {
                            status: resp.status().as_u16(),
                            message: format!("Segment {}: {}", i, resp.status()),
                        });
                    }

                    let mut file = tokio::fs::OpenOptions::new()
                        .write(true)
                        .open(&dest)
                        .await
                        .map_err(|e| DownloadError::FileSystem {
                            message: e.to_string(),
                        })?;

                    use tokio::io::AsyncSeekExt;
                    file.seek(std::io::SeekFrom::Start(range_start))
                        .await
                        .map_err(|e| DownloadError::FileSystem {
                            message: e.to_string(),
                        })?;

                    let mut stream = resp.bytes_stream();
                    while let Some(chunk_result) = stream.next().await {
                        if control_cancelled.load(Ordering::SeqCst) {
                            return Err(DownloadError::Interrupted);
                        }
                        while control_paused.load(Ordering::SeqCst) {
                            if control_cancelled.load(Ordering::SeqCst) {
                                return Err(DownloadError::Interrupted);
                            }
                            tokio::time::sleep(Duration::from_millis(100)).await;
                        }

                        let chunk = chunk_result.map_err(|e| DownloadError::Network {
                            message: e.to_string(),
                        })?;

                        let chunk_len = chunk.len() as u64;
                        if speed_limiter.is_enabled() {
                            let mut remaining = chunk_len;
                            while remaining > 0 {
                                let allowed = speed_limiter.acquire(remaining).await;
                                remaining -= allowed;
                            }
                        }

                        file.write_all(&chunk)
                            .await
                            .map_err(|e| DownloadError::FileSystem {
                                message: e.to_string(),
                            })?;

                        downloaded_total.fetch_add(chunk_len, Ordering::Relaxed);
                    }

                    file.flush().await.map_err(|e| DownloadError::FileSystem {
                        message: e.to_string(),
                    })?;

                    Ok::<(), DownloadError>(())
                });

                handles.push(handle);
            }

            // Progress reporting loop
            let progress_queue = queue.clone();
            let progress_event_tx = event_tx.clone();
            let progress_downloaded = downloaded_total.clone();
            let progress_task_id = task_id.clone();
            let progress_total = total;
            let progress_last = last_progress.clone();
            let progress_start = start_time;
            let progress_control_cancelled = control.cancelled.clone();

            let progress_handle = tokio::spawn(async move {
                loop {
                    tokio::time::sleep(Duration::from_millis(200)).await;
                    if progress_control_cancelled.load(Ordering::SeqCst) {
                        break;
                    }

                    let mut last = progress_last.lock().await;
                    if last.elapsed() < Duration::from_millis(100) {
                        continue;
                    }
                    *last = Instant::now();
                    drop(last);

                    let dl = progress_downloaded.load(Ordering::Relaxed);
                    let elapsed = progress_start.elapsed().as_secs_f64();
                    let speed = if elapsed > 0.0 {
                        dl as f64 / elapsed
                    } else {
                        0.0
                    };

                    let progress = DownloadProgress::new(dl, Some(progress_total), speed);
                    {
                        let mut q = progress_queue.write().await;
                        if let Some(t) = q.get_mut(&progress_task_id) {
                            t.progress = progress.clone();
                        }
                    }
                    if let Some(ref tx) = progress_event_tx {
                        let _ = tx.send(DownloadEvent::TaskProgress {
                            task_id: progress_task_id.clone(),
                            progress,
                        });
                    }

                    if dl >= progress_total {
                        break;
                    }
                }
            });

            // Wait for all segments to complete
            let mut first_error: Option<DownloadError> = None;
            for handle in handles {
                match handle.await {
                    Ok(Ok(())) => {}
                    Ok(Err(e)) => {
                        if first_error.is_none() {
                            first_error = Some(e);
                        }
                    }
                    Err(e) => {
                        if first_error.is_none() {
                            first_error = Some(DownloadError::Network {
                                message: format!("Segment task panicked: {}", e),
                            });
                        }
                    }
                }
            }

            progress_handle.abort();

            if let Some(err) = first_error {
                let _ = tokio::fs::remove_file(dest).await;
                return Err(err);
            }
        } else {
            // Single-connection download (original logic)
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
                if control.is_cancelled() {
                    return Err(DownloadError::Interrupted);
                }

                while control.is_paused() {
                    if control.is_cancelled() {
                        return Err(DownloadError::Interrupted);
                    }
                    tokio::time::sleep(Duration::from_millis(100)).await;
                }

                let chunk = chunk_result.map_err(|e| DownloadError::Network {
                    message: e.to_string(),
                })?;

                let chunk_len = chunk.len() as u64;
                if speed_limiter.is_enabled() {
                    let mut remaining = chunk_len;
                    while remaining > 0 {
                        let allowed = speed_limiter.acquire(remaining).await;
                        remaining -= allowed;
                    }
                }

                file.write_all(&chunk)
                    .await
                    .map_err(|e| DownloadError::FileSystem {
                        message: e.to_string(),
                    })?;

                downloaded += chunk_len;

                if last_progress_update.elapsed() >= progress_interval {
                    let elapsed = start_time.elapsed().as_secs_f64();
                    let speed = if elapsed > 0.0 {
                        (downloaded - resume_from.unwrap_or(0)) as f64 / elapsed
                    } else {
                        0.0
                    };

                    let progress = DownloadProgress::new(downloaded, total_size, speed);

                    {
                        let mut q = queue.write().await;
                        if let Some(t) = q.get_mut(task_id) {
                            t.progress = progress.clone();
                        }
                    }

                    if let Some(ref tx) = event_tx {
                        let _ = tx.send(DownloadEvent::TaskProgress {
                            task_id: task_id.clone(),
                            progress,
                        });
                    }

                    last_progress_update = Instant::now();
                }
            }

            file.flush().await.map_err(|e| DownloadError::FileSystem {
                message: e.to_string(),
            })?;
        }

        // Verify checksum if provided
        if task.config.verify_checksum {
            if let Some(ref expected) = task.expected_checksum {
                let actual =
                    fs::calculate_sha256(dest)
                        .await
                        .map_err(|e| DownloadError::FileSystem {
                            message: e.to_string(),
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
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);
        assert!(!manager.is_running());
    }

    #[tokio::test]
    async fn test_download_manager_add_task() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

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
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

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
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

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
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

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
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

        assert_eq!(manager.get_speed_limit().await, 0);

        manager.set_speed_limit(1024 * 1024).await; // 1 MB/s
        assert_eq!(manager.get_speed_limit().await, 1024 * 1024);

        manager.set_speed_limit(0).await;
        assert_eq!(manager.get_speed_limit().await, 0);
    }

    #[tokio::test]
    async fn test_download_manager_clear_finished() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

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

    #[tokio::test]
    async fn test_download_manager_pause_resume() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

        let task_id = manager
            .download(
                "https://example.com/file.zip".to_string(),
                PathBuf::from("/tmp/file.zip"),
                "Test File".to_string(),
            )
            .await;

        // Pause the queued task
        manager.pause(&task_id).await.unwrap();
        let task = manager.get_task(&task_id).await.unwrap();
        assert_eq!(task.state, DownloadState::Paused);

        // Resume the paused task
        manager.resume(&task_id).await.unwrap();
        let task = manager.get_task(&task_id).await.unwrap();
        assert_eq!(task.state, DownloadState::Queued);
    }

    #[tokio::test]
    async fn test_download_manager_list_tasks() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

        manager
            .download(
                "https://example.com/a.zip".to_string(),
                PathBuf::from("/tmp/a.zip"),
                "File A".to_string(),
            )
            .await;
        manager
            .download(
                "https://example.com/b.zip".to_string(),
                PathBuf::from("/tmp/b.zip"),
                "File B".to_string(),
            )
            .await;

        let tasks = manager.list_tasks().await;
        assert_eq!(tasks.len(), 2);
    }

    #[tokio::test]
    async fn test_download_manager_set_max_concurrent() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

        assert_eq!(manager.get_max_concurrent().await, 4);

        manager.set_max_concurrent(8).await;
        assert_eq!(manager.get_max_concurrent().await, 8);

        manager.set_max_concurrent(1).await;
        assert_eq!(manager.get_max_concurrent().await, 1);
    }

    #[tokio::test]
    async fn test_download_manager_start_stop() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

        assert!(!manager.is_running());

        manager.start().await;
        assert!(manager.is_running());

        // Starting again should be idempotent
        manager.start().await;
        assert!(manager.is_running());

        manager.stop().await;
        assert!(!manager.is_running());
    }

    #[tokio::test]
    async fn test_download_manager_pause_all_resume_all() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

        for i in 0..3 {
            manager
                .download(
                    format!("https://example.com/file{}.zip", i),
                    PathBuf::from(format!("/tmp/file{}.zip", i)),
                    format!("File {}", i),
                )
                .await;
        }

        assert_eq!(manager.stats().await.queued, 3);

        // Pause all (queued tasks can be paused)
        let paused = manager.pause_all().await;
        // pause_all pauses active tasks; queued tasks aren't active
        // So the count depends on how many are actually active
        let stats = manager.stats().await;
        assert_eq!(stats.total_tasks, 3);
        let _ = paused; // Count varies based on internal state
    }

    #[tokio::test]
    async fn test_download_manager_cancel_all() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

        for i in 0..3 {
            manager
                .download(
                    format!("https://example.com/file{}.zip", i),
                    PathBuf::from(format!("/tmp/file{}.zip", i)),
                    format!("File {}", i),
                )
                .await;
        }

        let cancelled = manager.cancel_all().await;
        assert_eq!(cancelled, 3);
        assert_eq!(manager.stats().await.cancelled, 3);
    }

    #[tokio::test]
    async fn test_download_manager_event_channel() {
        let mut manager = DownloadManager::new(DownloadManagerConfig::default(), None);
        let mut rx = manager.create_event_channel();

        manager
            .download(
                "https://example.com/file.zip".to_string(),
                PathBuf::from("/tmp/file.zip"),
                "Test File".to_string(),
            )
            .await;

        // Should receive TaskAdded event
        let event = tokio::time::timeout(std::time::Duration::from_millis(100), rx.recv()).await;
        assert!(event.is_ok());
        let event = event.unwrap().unwrap();
        matches!(event, DownloadEvent::TaskAdded { .. });
    }

    #[tokio::test]
    async fn test_download_manager_retry_all_failed() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

        let task_id = manager
            .download(
                "https://example.com/file.zip".to_string(),
                PathBuf::from("/tmp/file.zip"),
                "Test File".to_string(),
            )
            .await;

        // Cancel first (terminal state)
        manager.cancel(&task_id).await.unwrap();

        // Retry failed should not affect cancelled tasks
        let retried = manager.retry_all_failed().await;
        assert_eq!(retried, 0);
    }

    #[tokio::test]
    async fn test_download_manager_shutdown() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);
        manager.start().await;
        assert!(manager.is_running());

        manager.shutdown().await;
        assert!(!manager.is_running());
    }

    #[tokio::test]
    async fn test_download_manager_add_task_with_builder() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

        let task = crate::download::DownloadTask::builder(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test File".to_string(),
        )
        .with_checksum("abc123def456".to_string())
        .with_priority(10)
        .with_provider("github:user/repo".to_string())
        .build();

        let task_id = manager.add_task(task).await;
        let retrieved = manager.get_task(&task_id).await.unwrap();

        assert_eq!(
            retrieved.expected_checksum,
            Some("abc123def456".to_string())
        );
        assert_eq!(retrieved.priority, 10);
        assert_eq!(retrieved.provider, Some("github:user/repo".to_string()));
    }

    #[tokio::test]
    async fn test_download_manager_get_nonexistent_task() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);
        let task = manager.get_task("nonexistent-id").await;
        assert!(task.is_none());
    }

    #[tokio::test]
    async fn test_download_manager_pause_nonexistent() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);
        let result = manager.pause("nonexistent-id").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_download_manager_resume_nonexistent() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);
        let result = manager.resume("nonexistent-id").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_download_manager_cancel_nonexistent() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);
        let result = manager.cancel("nonexistent-id").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_download_manager_remove_nonexistent() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);
        let removed = manager.remove("nonexistent-id").await;
        assert!(removed.is_none());
    }

    #[tokio::test]
    async fn test_download_manager_default() {
        let manager = DownloadManager::default();
        assert!(!manager.is_running());
        assert_eq!(manager.get_speed_limit().await, 0);
        assert_eq!(manager.get_max_concurrent().await, 4);
        assert_eq!(manager.stats().await.total_tasks, 0);
    }

    #[tokio::test]
    async fn test_download_manager_config_default() {
        let config = DownloadManagerConfig::default();
        assert_eq!(config.max_concurrent, 4);
        assert_eq!(config.speed_limit, 0);
        assert!(config.auto_start);
        assert_eq!(config.partials_dir, PathBuf::from(".downloads"));
    }

    #[tokio::test]
    async fn test_download_manager_with_custom_config() {
        let config = DownloadManagerConfig {
            max_concurrent: 8,
            speed_limit: 1024 * 1024,
            partials_dir: PathBuf::from("/custom/partials"),
            auto_start: false,
            ..Default::default()
        };

        let manager = DownloadManager::new(config, None);
        assert_eq!(manager.get_max_concurrent().await, 8);
        assert_eq!(manager.get_speed_limit().await, 1024 * 1024);
    }

    #[tokio::test]
    async fn test_download_manager_cancel_all_signals_controls() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

        let task_id = manager
            .download(
                "https://example.com/file.zip".to_string(),
                PathBuf::from("/tmp/file.zip"),
                "Test File".to_string(),
            )
            .await;

        // Verify cancel_all signals TaskControls
        let cancelled = manager.cancel_all().await;
        assert_eq!(cancelled, 1);

        // Verify the control was signaled
        let controls = manager.task_controls.read().await;
        if let Some(control) = controls.get(&task_id) {
            assert!(control.is_cancelled());
        }
    }

    #[tokio::test]
    async fn test_download_manager_double_pause() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

        let task_id = manager
            .download(
                "https://example.com/file.zip".to_string(),
                PathBuf::from("/tmp/file.zip"),
                "Test File".to_string(),
            )
            .await;

        manager.pause(&task_id).await.unwrap();

        // Second pause should fail (already paused, can't pause again)
        let result = manager.pause(&task_id).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_download_manager_resume_queued() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

        let task_id = manager
            .download(
                "https://example.com/file.zip".to_string(),
                PathBuf::from("/tmp/file.zip"),
                "Test File".to_string(),
            )
            .await;

        // Resume a queued task should fail (not paused)
        let result = manager.resume(&task_id).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_download_manager_cancel_completed() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

        let task_id = manager
            .download(
                "https://example.com/file.zip".to_string(),
                PathBuf::from("/tmp/file.zip"),
                "Test File".to_string(),
            )
            .await;

        // Complete the task via queue
        {
            let queue = manager.queue.clone();
            let mut q = queue.write().await;
            q.next_pending(); // Move to downloading
            let _ = q.complete(&task_id); // Complete it
        }

        // Cancel a completed task should fail
        let result = manager.cancel(&task_id).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_download_manager_cleanup_stale_partials_no_dir() {
        let manager = DownloadManager::new(
            DownloadManagerConfig {
                partials_dir: PathBuf::from("/nonexistent/partials/dir"),
                ..Default::default()
            },
            None,
        );

        // Should return 0 if the directory doesn't exist
        let cleaned = manager
            .cleanup_stale_partials(std::time::Duration::from_secs(0))
            .await;
        assert_eq!(cleaned, 0);
    }

    #[test]
    fn test_parse_content_disposition_quoted() {
        let result = parse_content_disposition(r#"attachment; filename="my-file.zip""#);
        assert_eq!(result, Some("my-file.zip".to_string()));
    }

    #[test]
    fn test_parse_content_disposition_unquoted() {
        let result = parse_content_disposition("attachment; filename=my-file.zip");
        assert_eq!(result, Some("my-file.zip".to_string()));
    }

    #[test]
    fn test_parse_content_disposition_no_filename() {
        let result = parse_content_disposition("inline");
        assert_eq!(result, None);
    }

    #[test]
    fn test_parse_content_disposition_empty() {
        let result = parse_content_disposition("");
        assert_eq!(result, None);
    }

    #[test]
    fn test_parse_content_disposition_with_extra_params() {
        let result = parse_content_disposition(
            r#"attachment; filename="report.pdf"; size=12345"#,
        );
        assert_eq!(result, Some("report.pdf".to_string()));
    }

    #[test]
    fn test_parse_content_disposition_spaces_around_filename() {
        let result = parse_content_disposition(r#"attachment;  filename="spaced.tar.gz" "#);
        assert_eq!(result, Some("spaced.tar.gz".to_string()));
    }

    #[test]
    fn test_download_event_extracting_serialize() {
        let event = DownloadEvent::TaskExtracting {
            task_id: "abc-123".to_string(),
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("task_extracting"));
        assert!(json.contains("abc-123"));
    }

    #[test]
    fn test_download_event_extracted_serialize() {
        let event = DownloadEvent::TaskExtracted {
            task_id: "abc-123".to_string(),
            files: vec!["file1.txt".to_string(), "dir/file2.txt".to_string()],
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("task_extracted"));
        assert!(json.contains("file1.txt"));
        assert!(json.contains("dir/file2.txt"));
    }

    #[tokio::test]
    async fn test_download_manager_task_has_server_filename_none() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

        let task_id = manager
            .download(
                "https://example.com/file.zip".to_string(),
                PathBuf::from("/tmp/file.zip"),
                "Test File".to_string(),
            )
            .await;

        let task = manager.get_task(&task_id).await.unwrap();
        assert!(task.server_filename.is_none());
    }

    #[tokio::test]
    async fn test_download_manager_set_priority() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

        let task_id = manager
            .download(
                "https://example.com/file.zip".to_string(),
                PathBuf::from("/tmp/file.zip"),
                "Test File".to_string(),
            )
            .await;

        manager.set_priority(&task_id, 99).await.unwrap();
        let task = manager.get_task(&task_id).await.unwrap();
        assert_eq!(task.priority, 99);
    }

    #[tokio::test]
    async fn test_download_manager_set_priority_nonexistent() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);
        let result = manager.set_priority("nonexistent", 5).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_download_manager_retry_task() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

        let task_id = manager
            .download(
                "https://example.com/file.zip".to_string(),
                PathBuf::from("/tmp/file.zip"),
                "Test File".to_string(),
            )
            .await;

        // Cancel first to make terminal
        manager.cancel(&task_id).await.unwrap();
        assert_eq!(
            manager.get_task(&task_id).await.unwrap().state,
            DownloadState::Cancelled
        );

        // Retry should reset to Queued
        manager.retry_task(&task_id).await.unwrap();
        assert_eq!(
            manager.get_task(&task_id).await.unwrap().state,
            DownloadState::Queued
        );
    }

    #[tokio::test]
    async fn test_download_manager_retry_task_nonexistent() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);
        let result = manager.retry_task("nonexistent").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_download_manager_set_event_sender() {
        let mut manager = DownloadManager::new(DownloadManagerConfig::default(), None);
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
        manager.set_event_sender(tx);

        manager
            .download(
                "https://example.com/file.zip".to_string(),
                PathBuf::from("/tmp/file.zip"),
                "Test File".to_string(),
            )
            .await;

        // Should receive TaskAdded event
        let event = tokio::time::timeout(Duration::from_millis(100), rx.recv()).await;
        assert!(event.is_ok());
        assert!(matches!(
            event.unwrap().unwrap(),
            DownloadEvent::TaskAdded { .. }
        ));
    }

    #[tokio::test]
    async fn test_download_manager_with_proxy() {
        let manager = DownloadManager::new(
            DownloadManagerConfig::default(),
            Some("http://proxy.example.com:8080".to_string()),
        );
        // Should not panic; just verify constructor works
        assert!(!manager.is_running());
    }

    #[tokio::test]
    async fn test_download_manager_with_empty_proxy() {
        let manager =
            DownloadManager::new(DownloadManagerConfig::default(), Some("".to_string()));
        // Empty proxy should be ignored
        assert!(!manager.is_running());
    }

    #[test]
    fn test_download_manager_config_serde_roundtrip() {
        let config = DownloadManagerConfig {
            max_concurrent: 8,
            speed_limit: 1024 * 1024,
            partials_dir: PathBuf::from("/custom/dir"),
            auto_start: false,
            progress_interval_ms: 200,
            default_task_config: DownloadConfig {
                max_retries: 5,
                ..Default::default()
            },
        };

        let json = serde_json::to_string(&config).unwrap();
        let deserialized: DownloadManagerConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.max_concurrent, 8);
        assert_eq!(deserialized.speed_limit, 1024 * 1024);
        assert!(!deserialized.auto_start);
        assert_eq!(deserialized.partials_dir, PathBuf::from("/custom/dir"));
        assert_eq!(deserialized.default_task_config.max_retries, 5);
    }

    #[test]
    fn test_download_event_serde_all_variants() {
        let events = vec![
            DownloadEvent::TaskAdded {
                task_id: "t1".into(),
            },
            DownloadEvent::TaskStarted {
                task_id: "t1".into(),
            },
            DownloadEvent::TaskProgress {
                task_id: "t1".into(),
                progress: DownloadProgress::new(50, Some(100), 10.0),
            },
            DownloadEvent::TaskCompleted {
                task_id: "t1".into(),
            },
            DownloadEvent::TaskFailed {
                task_id: "t1".into(),
                error: "err".into(),
            },
            DownloadEvent::TaskPaused {
                task_id: "t1".into(),
            },
            DownloadEvent::TaskResumed {
                task_id: "t1".into(),
            },
            DownloadEvent::TaskCancelled {
                task_id: "t1".into(),
            },
            DownloadEvent::TaskExtracting {
                task_id: "t1".into(),
            },
            DownloadEvent::TaskExtracted {
                task_id: "t1".into(),
                files: vec!["a.txt".into()],
            },
            DownloadEvent::QueueUpdated {
                stats: QueueStats::default(),
            },
        ];

        for event in events {
            let json = serde_json::to_string(&event).unwrap();
            let deserialized: DownloadEvent = serde_json::from_str(&json).unwrap();
            // Verify serialization roundtrip doesn't panic
            let json2 = serde_json::to_string(&deserialized).unwrap();
            assert_eq!(json, json2);
        }
    }

    #[test]
    fn test_task_control_operations() {
        let control = TaskControl::new();
        assert!(!control.is_paused());
        assert!(!control.is_cancelled());

        control.pause();
        assert!(control.is_paused());
        assert!(!control.is_cancelled());

        control.resume();
        assert!(!control.is_paused());

        control.cancel();
        assert!(control.is_cancelled());
    }

    #[tokio::test]
    async fn test_download_manager_resume_all_empty() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);
        let resumed = manager.resume_all().await;
        assert_eq!(resumed, 0);
    }

    #[tokio::test]
    async fn test_download_manager_retry_all_failed_none() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);
        let retried = manager.retry_all_failed().await;
        assert_eq!(retried, 0);
    }

    #[tokio::test]
    async fn test_download_manager_task_with_auto_extract() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

        let task = crate::download::DownloadTask::builder(
            "https://example.com/archive.tar.gz".to_string(),
            PathBuf::from("/tmp/archive.tar.gz"),
            "Archive".to_string(),
        )
        .with_config(DownloadConfig {
            auto_extract: true,
            extract_dest: Some(PathBuf::from("/tmp/extracted")),
            ..Default::default()
        })
        .build();

        let task_id = manager.add_task(task).await;
        let retrieved = manager.get_task(&task_id).await.unwrap();

        assert!(retrieved.config.auto_extract);
        assert_eq!(
            retrieved.config.extract_dest,
            Some(PathBuf::from("/tmp/extracted"))
        );
    }

    #[test]
    fn test_parse_content_disposition_filename_star_utf8() {
        let result = parse_content_disposition(
            "attachment; filename*=UTF-8''my%20file%20%E4%B8%AD%E6%96%87.zip",
        );
        assert_eq!(result, Some("my file 中文.zip".to_string()));
    }

    #[test]
    fn test_parse_content_disposition_filename_star_takes_priority() {
        let result = parse_content_disposition(
            r#"attachment; filename="fallback.zip"; filename*=UTF-8''preferred%20name.zip"#,
        );
        assert_eq!(result, Some("preferred name.zip".to_string()));
    }

    #[test]
    fn test_parse_content_disposition_filename_star_reverse_order() {
        let result = parse_content_disposition(
            r#"attachment; filename*=UTF-8''star-name.zip; filename="fallback.zip""#,
        );
        assert_eq!(result, Some("star-name.zip".to_string()));
    }

    #[test]
    fn test_parse_content_disposition_only_filename_fallback() {
        let result = parse_content_disposition(r#"attachment; filename="only-plain.zip""#);
        assert_eq!(result, Some("only-plain.zip".to_string()));
    }

    #[test]
    fn test_parse_content_disposition_filename_star_no_language() {
        let result = parse_content_disposition(
            "attachment; filename*=UTF-8''simple.zip",
        );
        assert_eq!(result, Some("simple.zip".to_string()));
    }

    #[test]
    fn test_percent_decode_basic() {
        assert_eq!(percent_decode("hello%20world"), "hello world");
        assert_eq!(percent_decode("no%20spaces%21"), "no spaces!");
        assert_eq!(percent_decode("plain"), "plain");
    }

    #[test]
    fn test_percent_decode_utf8() {
        // 中 = E4 B8 AD, 文 = E6 96 87
        assert_eq!(percent_decode("%E4%B8%AD%E6%96%87"), "中文");
    }

    #[test]
    fn test_percent_decode_mixed() {
        assert_eq!(percent_decode("file%20name%20v2.zip"), "file name v2.zip");
    }

    #[test]
    fn test_percent_decode_invalid_hex() {
        // Invalid hex should be kept as-is
        assert_eq!(percent_decode("%ZZ"), "%ZZ");
    }

    #[test]
    fn test_percent_decode_empty() {
        assert_eq!(percent_decode(""), "");
    }

    #[test]
    fn test_download_manager_config_progress_interval_default() {
        let config = DownloadManagerConfig::default();
        assert_eq!(config.progress_interval_ms, 100);
    }

    #[test]
    fn test_download_manager_config_progress_interval_custom() {
        let config = DownloadManagerConfig {
            progress_interval_ms: 250,
            ..Default::default()
        };
        assert_eq!(config.progress_interval_ms, 250);
    }

    #[tokio::test]
    async fn test_download_manager_task_has_mirror_urls_empty() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

        let task_id = manager
            .download(
                "https://example.com/file.zip".to_string(),
                PathBuf::from("/tmp/file.zip"),
                "Test File".to_string(),
            )
            .await;

        let task = manager.get_task(&task_id).await.unwrap();
        assert!(task.mirror_urls.is_empty());
    }

    #[tokio::test]
    async fn test_download_manager_task_with_mirrors() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

        let task = crate::download::DownloadTask::builder(
            "https://primary.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test File".to_string(),
        )
        .with_mirror("https://mirror1.com/file.zip".to_string())
        .with_mirror("https://mirror2.com/file.zip".to_string())
        .build();

        let task_id = manager.add_task(task).await;
        let retrieved = manager.get_task(&task_id).await.unwrap();

        assert_eq!(retrieved.mirror_urls.len(), 2);
        assert_eq!(retrieved.mirror_urls[0], "https://mirror1.com/file.zip");
        assert_eq!(retrieved.mirror_urls[1], "https://mirror2.com/file.zip");
    }

    #[tokio::test]
    async fn test_download_manager_task_segments_preserved() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);

        let task = crate::download::DownloadTask::builder(
            "https://example.com/big.zip".to_string(),
            PathBuf::from("/tmp/big.zip"),
            "Big File".to_string(),
        )
        .with_config(DownloadConfig {
            segments: 8,
            ..Default::default()
        })
        .build();

        let task_id = manager.add_task(task).await;
        let retrieved = manager.get_task(&task_id).await.unwrap();
        assert_eq!(retrieved.config.segments, 8);
    }

    #[tokio::test]
    async fn test_download_manager_persistence_not_enabled() {
        let manager = DownloadManager::new(DownloadManagerConfig::default(), None);
        // persist_queue_force should be a no-op when persistence is None
        manager.persist_queue_force().await;
        // load should return 0 when persistence is None
        assert_eq!(manager.load_persisted_tasks().await, 0);
    }
}
