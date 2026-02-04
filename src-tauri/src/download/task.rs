//! Download task definition

use super::state::{DownloadError, DownloadState};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Configuration for a download task
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadConfig {
    /// Maximum number of retries for failed downloads
    #[serde(default = "default_max_retries")]
    pub max_retries: u32,
    /// Timeout in seconds for the download
    #[serde(default = "default_timeout")]
    pub timeout_secs: u64,
    /// Whether to verify checksum after download
    #[serde(default = "default_verify_checksum")]
    pub verify_checksum: bool,
    /// Speed limit in bytes per second (0 = unlimited)
    #[serde(default)]
    pub speed_limit: u64,
    /// Whether to allow resume from partial download
    #[serde(default = "default_allow_resume")]
    pub allow_resume: bool,
}

fn default_max_retries() -> u32 {
    3
}
fn default_timeout() -> u64 {
    300
}
fn default_verify_checksum() -> bool {
    true
}
fn default_allow_resume() -> bool {
    true
}

impl Default for DownloadConfig {
    fn default() -> Self {
        Self {
            max_retries: default_max_retries(),
            timeout_secs: default_timeout(),
            verify_checksum: default_verify_checksum(),
            speed_limit: 0,
            allow_resume: default_allow_resume(),
        }
    }
}

/// Real-time progress information for a download
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    /// Bytes downloaded so far
    pub downloaded_bytes: u64,
    /// Total size in bytes (if known)
    pub total_bytes: Option<u64>,
    /// Current download speed in bytes per second
    pub speed: f64,
    /// Estimated time remaining in seconds
    pub eta_secs: Option<u64>,
    /// Progress percentage (0-100)
    pub percent: f32,
}

impl DownloadProgress {
    /// Create a new progress instance
    pub fn new(downloaded: u64, total: Option<u64>, speed: f64) -> Self {
        let percent = total
            .map(|t| if t > 0 { (downloaded as f64 / t as f64 * 100.0) as f32 } else { 0.0 })
            .unwrap_or(0.0);

        let eta_secs = if speed > 0.0 {
            total.map(|t| ((t.saturating_sub(downloaded)) as f64 / speed) as u64)
        } else {
            None
        };

        Self {
            downloaded_bytes: downloaded,
            total_bytes: total,
            speed,
            eta_secs,
            percent,
        }
    }

    /// Format downloaded size as human-readable string
    pub fn downloaded_human(&self) -> String {
        format_size(self.downloaded_bytes)
    }

    /// Format total size as human-readable string
    pub fn total_human(&self) -> Option<String> {
        self.total_bytes.map(format_size)
    }

    /// Format speed as human-readable string
    pub fn speed_human(&self) -> String {
        format!("{}/s", format_size(self.speed as u64))
    }

    /// Format ETA as human-readable string
    pub fn eta_human(&self) -> Option<String> {
        self.eta_secs.map(format_duration)
    }
}

/// A download task with all metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadTask {
    /// Unique identifier for the task
    pub id: String,
    /// Source URL to download from
    pub url: String,
    /// Destination path for the downloaded file
    pub destination: PathBuf,
    /// Display name for the download
    pub name: String,
    /// Current state of the download
    pub state: DownloadState,
    /// Progress information
    pub progress: DownloadProgress,
    /// Expected checksum for verification (SHA256)
    pub expected_checksum: Option<String>,
    /// Task priority (higher = more important)
    pub priority: i32,
    /// When the task was created
    pub created_at: DateTime<Utc>,
    /// When the download started
    pub started_at: Option<DateTime<Utc>>,
    /// When the download completed
    pub completed_at: Option<DateTime<Utc>>,
    /// Last error message if failed
    pub error: Option<String>,
    /// Number of retry attempts made
    pub retries: u32,
    /// Task configuration
    pub config: DownloadConfig,
    /// Whether the server supports resume
    pub supports_resume: bool,
    /// Provider that initiated the download (if any)
    pub provider: Option<String>,
    /// Additional metadata
    pub metadata: std::collections::HashMap<String, String>,
}

impl DownloadTask {
    /// Create a new download task
    pub fn new(url: String, destination: PathBuf, name: String) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            url,
            destination,
            name,
            state: DownloadState::Queued,
            progress: DownloadProgress::default(),
            expected_checksum: None,
            priority: 0,
            created_at: Utc::now(),
            started_at: None,
            completed_at: None,
            error: None,
            retries: 0,
            config: DownloadConfig::default(),
            supports_resume: false,
            provider: None,
            metadata: std::collections::HashMap::new(),
        }
    }

    /// Create a new task with builder pattern
    pub fn builder(url: String, destination: PathBuf, name: String) -> DownloadTaskBuilder {
        DownloadTaskBuilder::new(url, destination, name)
    }

    /// Update progress
    pub fn update_progress(&mut self, downloaded: u64, total: Option<u64>, speed: f64) {
        self.progress = DownloadProgress::new(downloaded, total, speed);
    }

    /// Mark as started
    pub fn mark_started(&mut self) {
        self.state = DownloadState::Downloading;
        self.started_at = Some(Utc::now());
    }

    /// Mark as completed
    pub fn mark_completed(&mut self) {
        self.state = DownloadState::Completed;
        self.completed_at = Some(Utc::now());
        self.progress.percent = 100.0;
    }

    /// Mark as failed
    pub fn mark_failed(&mut self, error: DownloadError) {
        self.error = Some(error.to_string());
        self.state = error.to_failed_state();
    }

    /// Mark as paused
    pub fn mark_paused(&mut self) {
        self.state = DownloadState::Paused;
    }

    /// Mark as cancelled
    pub fn mark_cancelled(&mut self) {
        self.state = DownloadState::Cancelled;
    }

    /// Increment retry count
    pub fn increment_retry(&mut self) {
        self.retries += 1;
    }

    /// Check if more retries are allowed
    pub fn can_retry(&self) -> bool {
        self.retries < self.config.max_retries
    }

    /// Get the filename from destination
    pub fn filename(&self) -> String {
        self.destination
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string())
    }
}

/// Builder for creating download tasks with fluent API
pub struct DownloadTaskBuilder {
    task: DownloadTask,
}

impl DownloadTaskBuilder {
    pub fn new(url: String, destination: PathBuf, name: String) -> Self {
        Self {
            task: DownloadTask::new(url, destination, name),
        }
    }

    pub fn with_checksum(mut self, checksum: String) -> Self {
        self.task.expected_checksum = Some(checksum);
        self
    }

    pub fn with_priority(mut self, priority: i32) -> Self {
        self.task.priority = priority;
        self
    }

    pub fn with_config(mut self, config: DownloadConfig) -> Self {
        self.task.config = config;
        self
    }

    pub fn with_provider(mut self, provider: String) -> Self {
        self.task.provider = Some(provider);
        self
    }

    pub fn with_metadata(mut self, key: String, value: String) -> Self {
        self.task.metadata.insert(key, value);
        self
    }

    pub fn build(self) -> DownloadTask {
        self.task
    }
}

fn format_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

fn format_duration(secs: u64) -> String {
    if secs >= 3600 {
        let hours = secs / 3600;
        let mins = (secs % 3600) / 60;
        format!("{}h {}m", hours, mins)
    } else if secs >= 60 {
        let mins = secs / 60;
        let secs = secs % 60;
        format!("{}m {}s", mins, secs)
    } else {
        format!("{}s", secs)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_download_progress_new() {
        let progress = DownloadProgress::new(50, Some(100), 10.0);
        assert_eq!(progress.downloaded_bytes, 50);
        assert_eq!(progress.total_bytes, Some(100));
        assert_eq!(progress.speed, 10.0);
        assert_eq!(progress.percent, 50.0);
        assert_eq!(progress.eta_secs, Some(5));
    }

    #[test]
    fn test_download_progress_no_total() {
        let progress = DownloadProgress::new(50, None, 10.0);
        assert_eq!(progress.percent, 0.0);
        assert_eq!(progress.eta_secs, None);
    }

    #[test]
    fn test_download_progress_zero_speed() {
        let progress = DownloadProgress::new(50, Some(100), 0.0);
        assert_eq!(progress.eta_secs, None);
    }

    #[test]
    fn test_download_progress_human_formats() {
        let progress = DownloadProgress::new(1024 * 1024 * 50, Some(1024 * 1024 * 100), 1024.0 * 1024.0);
        assert_eq!(progress.downloaded_human(), "50.00 MB");
        assert_eq!(progress.total_human(), Some("100.00 MB".to_string()));
        assert_eq!(progress.speed_human(), "1.00 MB/s");
    }

    #[test]
    fn test_download_task_new() {
        let task = DownloadTask::new(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test File".to_string(),
        );

        assert!(!task.id.is_empty());
        assert_eq!(task.state, DownloadState::Queued);
        assert_eq!(task.retries, 0);
        assert!(task.can_retry());
    }

    #[test]
    fn test_download_task_builder() {
        let task = DownloadTask::builder(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test File".to_string(),
        )
        .with_checksum("abc123".to_string())
        .with_priority(10)
        .with_provider("github".to_string())
        .with_metadata("version".to_string(), "1.0.0".to_string())
        .build();

        assert_eq!(task.expected_checksum, Some("abc123".to_string()));
        assert_eq!(task.priority, 10);
        assert_eq!(task.provider, Some("github".to_string()));
        assert_eq!(task.metadata.get("version"), Some(&"1.0.0".to_string()));
    }

    #[test]
    fn test_download_task_state_transitions() {
        let mut task = DownloadTask::new(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test File".to_string(),
        );

        assert!(task.state.can_pause());
        task.mark_started();
        assert_eq!(task.state, DownloadState::Downloading);
        assert!(task.started_at.is_some());

        task.mark_paused();
        assert_eq!(task.state, DownloadState::Paused);
        assert!(task.state.can_resume());

        task.mark_started();
        task.mark_completed();
        assert_eq!(task.state, DownloadState::Completed);
        assert!(task.completed_at.is_some());
        assert!(task.state.is_terminal());
    }

    #[test]
    fn test_download_task_retry() {
        let mut task = DownloadTask::new(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test File".to_string(),
        );

        assert!(task.can_retry());
        task.increment_retry();
        assert!(task.can_retry());
        task.increment_retry();
        assert!(task.can_retry());
        task.increment_retry();
        assert!(!task.can_retry());
    }

    #[test]
    fn test_format_duration() {
        assert_eq!(format_duration(30), "30s");
        assert_eq!(format_duration(90), "1m 30s");
        assert_eq!(format_duration(3661), "1h 1m");
    }
}
