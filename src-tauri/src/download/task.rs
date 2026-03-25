//! Download task definition

use super::state::{DownloadError, DownloadState};
use crate::platform::disk::{format_duration, format_size};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Instant;

/// Exponential Weighted Moving Average speed tracker.
///
/// Produces a smoothed download speed that responds quickly to changes
/// while filtering out per-chunk jitter.  Not serialized — used only
/// inside download workers.
pub(crate) struct SpeedTracker {
    prev_speed: f64,
    prev_bytes: u64,
    prev_time: Instant,
    alpha: f64,
}

impl SpeedTracker {
    /// Create a new tracker.  `alpha` controls responsiveness (0.3 = moderate).
    pub fn new() -> Self {
        Self {
            prev_speed: 0.0,
            prev_bytes: 0,
            prev_time: Instant::now(),
            alpha: 0.3,
        }
    }

    /// Feed the current cumulative byte count and get the smoothed speed (bytes/s).
    pub fn update(&mut self, current_bytes: u64) -> f64 {
        let now = Instant::now();
        let dt = now.duration_since(self.prev_time).as_secs_f64();
        if dt < 0.05 {
            return self.prev_speed;
        }

        let delta_bytes = current_bytes.saturating_sub(self.prev_bytes);
        let instant_speed = delta_bytes as f64 / dt;

        self.prev_speed = if self.prev_speed == 0.0 {
            instant_speed
        } else {
            self.alpha * instant_speed + (1.0 - self.alpha) * self.prev_speed
        };

        self.prev_bytes = current_bytes;
        self.prev_time = now;
        self.prev_speed
    }
}

/// Action to perform after a download completes successfully
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PostAction {
    #[default]
    None,
    OpenFile,
    RevealInFolder,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceKind {
    DirectUrl,
    BatchItem,
    GithubReleaseAsset,
    GithubSourceArchive,
    GithubWorkflowArtifact,
    GitlabReleaseAsset,
    GitlabSourceArchive,
    GitlabPipelineArtifact,
    GitlabPackageFile,
    #[default]
    Unknown,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ArtifactKind {
    Archive,
    Installer,
    PackageFile,
    PortableBinary,
    CiArtifact,
    SourceArchive,
    #[default]
    Unknown,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ArtifactPlatform {
    Windows,
    Macos,
    Linux,
    Universal,
    #[default]
    Unknown,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ArtifactArch {
    X64,
    Arm64,
    X86,
    Universal,
    #[default]
    Unknown,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InstallIntent {
    #[default]
    None,
    OpenInstaller,
    ExtractThenContinue,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FollowUpAction {
    Install,
    Extract,
    Open,
    Reveal,
    Reuse,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceDescriptor {
    pub kind: SourceKind,
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub repo: Option<String>,
    #[serde(default)]
    pub release_tag: Option<String>,
    #[serde(default)]
    pub ref_name: Option<String>,
    #[serde(default)]
    pub workflow_run_id: Option<String>,
    #[serde(default)]
    pub artifact_id: Option<String>,
    #[serde(default)]
    pub pipeline_id: Option<String>,
    #[serde(default)]
    pub job_id: Option<String>,
    #[serde(default)]
    pub package_id: Option<String>,
    #[serde(default)]
    pub package_file_id: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactProfile {
    pub artifact_kind: ArtifactKind,
    pub source_kind: SourceKind,
    pub platform: ArtifactPlatform,
    pub arch: ArtifactArch,
    pub install_intent: InstallIntent,
    #[serde(default)]
    pub suggested_follow_ups: Vec<FollowUpAction>,
}

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
    /// Whether to auto-extract archive after download completes
    #[serde(default)]
    pub auto_extract: bool,
    /// Destination directory for extraction (None = same dir as download)
    #[serde(default)]
    pub extract_dest: Option<PathBuf>,
    /// Number of parallel segments for downloading (1 = single connection, max 32)
    #[serde(default = "default_segments")]
    pub segments: u8,
    /// Action to perform after download completes
    #[serde(default)]
    pub post_action: PostAction,
    /// Whether to delete the archive after successful extraction
    #[serde(default)]
    pub delete_after_extract: bool,
    /// Whether to auto-rename the destination file using the server-provided filename
    #[serde(default = "default_auto_rename")]
    pub auto_rename: bool,
}

fn default_auto_rename() -> bool {
    true
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
fn default_segments() -> u8 {
    1
}

impl Default for DownloadConfig {
    fn default() -> Self {
        Self {
            max_retries: default_max_retries(),
            timeout_secs: default_timeout(),
            verify_checksum: default_verify_checksum(),
            speed_limit: 0,
            allow_resume: default_allow_resume(),
            auto_extract: false,
            extract_dest: None,
            segments: default_segments(),
            post_action: PostAction::None,
            delete_after_extract: false,
            auto_rename: default_auto_rename(),
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
            .map(|t| {
                if t > 0 {
                    (downloaded as f64 / t as f64 * 100.0) as f32
                } else {
                    0.0
                }
            })
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
    /// Stable reason code for the most recent failure
    #[serde(default)]
    pub failure_reason_code: Option<String>,
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
    /// Custom HTTP headers to send with the download request (e.g. auth tokens)
    #[serde(default)]
    pub headers: std::collections::HashMap<String, String>,
    /// Server-provided filename from Content-Disposition header
    #[serde(default)]
    pub server_filename: Option<String>,
    /// Mirror/fallback URLs to try if the primary URL fails
    #[serde(default)]
    pub mirror_urls: Vec<String>,
    /// User-defined tags for categorization and filtering
    #[serde(default)]
    pub tags: Vec<String>,
    /// Suggested installation or follow-up intent for the downloaded artifact
    #[serde(default)]
    pub install_intent: Option<InstallIntent>,
    /// Stable descriptor of where this download came from
    #[serde(default)]
    pub source_descriptor: Option<SourceDescriptor>,
    /// Resolved artifact profile used by UI follow-up actions
    #[serde(default)]
    pub artifact_profile: Option<ArtifactProfile>,
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
            failure_reason_code: None,
            retries: 0,
            config: DownloadConfig::default(),
            supports_resume: false,
            provider: None,
            metadata: std::collections::HashMap::new(),
            headers: std::collections::HashMap::new(),
            server_filename: None,
            mirror_urls: Vec::new(),
            tags: Vec::new(),
            install_intent: None,
            source_descriptor: None,
            artifact_profile: None,
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
        self.error = None;
        self.failure_reason_code = None;
    }

    /// Mark as completed
    pub fn mark_completed(&mut self) {
        self.state = DownloadState::Completed;
        self.completed_at = Some(Utc::now());
        self.progress.percent = 100.0;
        self.error = None;
        self.failure_reason_code = None;
    }

    /// Mark as failed
    pub fn mark_failed(&mut self, error: DownloadError) {
        self.error = Some(error.to_string());
        self.failure_reason_code = Some(error.reason_code().to_string());
        self.state = error.to_failed_state();
    }

    /// Mark as paused
    pub fn mark_paused(&mut self) {
        self.state = DownloadState::Paused;
    }

    /// Mark as cancelled
    pub fn mark_cancelled(&mut self) {
        self.state = DownloadState::Cancelled;
        self.failure_reason_code = None;
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

    pub fn with_header(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.task.headers.insert(key.into(), value.into());
        self
    }

    pub fn with_headers(mut self, headers: std::collections::HashMap<String, String>) -> Self {
        self.task.headers.extend(headers);
        self
    }

    pub fn with_mirror(mut self, url: String) -> Self {
        self.task.mirror_urls.push(url);
        self
    }

    pub fn with_tag(mut self, tag: String) -> Self {
        self.task.tags.push(tag);
        self
    }

    pub fn with_tags(mut self, tags: Vec<String>) -> Self {
        self.task.tags.extend(tags);
        self
    }

    pub fn with_mirrors(mut self, urls: Vec<String>) -> Self {
        self.task.mirror_urls.extend(urls);
        self
    }

    pub fn build(self) -> DownloadTask {
        self.task
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
        let progress =
            DownloadProgress::new(1024 * 1024 * 50, Some(1024 * 1024 * 100), 1024.0 * 1024.0);
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
        assert!(task.failure_reason_code.is_none());
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

    #[test]
    fn test_download_task_filename() {
        let task = DownloadTask::new(
            "https://example.com/path/to/file.zip".to_string(),
            PathBuf::from("/tmp/downloads/file.zip"),
            "My Download".to_string(),
        );

        assert_eq!(task.filename(), "file.zip");
    }

    #[test]
    fn test_download_task_mark_failed() {
        let mut task = DownloadTask::new(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test File".to_string(),
        );

        task.mark_started();
        task.mark_failed(DownloadError::Network {
            message: "Network error".to_string(),
        });

        match &task.state {
            DownloadState::Failed { error, recoverable } => {
                assert!(error.contains("Network error"));
                assert!(*recoverable);
            }
            _ => panic!("Expected Failed state"),
        }
        assert!(task.error.is_some());
        assert_eq!(task.failure_reason_code.as_deref(), Some("network_error"));
    }

    #[test]
    fn test_download_task_mark_cancelled() {
        let mut task = DownloadTask::new(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test File".to_string(),
        );

        task.mark_cancelled();
        assert_eq!(task.state, DownloadState::Cancelled);
        assert!(task.state.is_terminal());
    }

    #[test]
    fn test_download_task_update_progress() {
        let mut task = DownloadTask::new(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test File".to_string(),
        );

        task.mark_started();
        task.update_progress(500, Some(1000), 100.0);

        assert_eq!(task.progress.downloaded_bytes, 500);
        assert_eq!(task.progress.total_bytes, Some(1000));
        assert_eq!(task.progress.percent, 50.0);
        assert_eq!(task.progress.speed, 100.0);
    }

    #[test]
    fn test_download_task_builder_with_config() {
        let config = DownloadConfig {
            max_retries: 10,
            timeout_secs: 120,
            verify_checksum: false,
            speed_limit: 1024 * 1024,
            allow_resume: false,
            auto_extract: false,
            extract_dest: None,
            segments: 1,
            ..Default::default()
        };

        let task = DownloadTask::builder(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test File".to_string(),
        )
        .with_config(config.clone())
        .build();

        assert_eq!(task.config.max_retries, 10);
        assert_eq!(task.config.timeout_secs, 120);
        assert!(!task.config.verify_checksum);
        assert_eq!(task.config.speed_limit, 1024 * 1024);
        assert!(!task.config.allow_resume);
    }

    #[test]
    fn test_download_progress_completed() {
        let progress = DownloadProgress::new(1000, Some(1000), 500.0);
        assert_eq!(progress.percent, 100.0);
        assert_eq!(progress.eta_secs, Some(0));
    }

    #[test]
    fn test_download_progress_zero_total() {
        let progress = DownloadProgress::new(0, Some(0), 0.0);
        // 0/0 should not panic; percent depends on implementation
        assert!(progress.percent.is_finite());
    }

    #[test]
    fn test_download_config_default() {
        let config = DownloadConfig::default();
        assert_eq!(config.max_retries, 3);
        assert!(config.verify_checksum);
        assert!(config.timeout_secs > 0);
        assert!(config.allow_resume);
    }

    #[test]
    fn test_download_task_retry_count() {
        let mut task = DownloadTask::new(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test File".to_string(),
        );
        task.config.max_retries = 2;

        assert_eq!(task.retries, 0);
        assert!(task.can_retry());

        task.increment_retry();
        assert_eq!(task.retries, 1);
        assert!(task.can_retry());

        task.increment_retry();
        assert_eq!(task.retries, 2);
        assert!(!task.can_retry());
    }

    #[test]
    fn test_download_task_builder_with_metadata() {
        let task = DownloadTask::builder(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test".to_string(),
        )
        .with_metadata("key1".to_string(), "val1".to_string())
        .with_metadata("key2".to_string(), "val2".to_string())
        .build();

        assert_eq!(task.metadata.len(), 2);
        assert_eq!(task.metadata.get("key1"), Some(&"val1".to_string()));
        assert_eq!(task.metadata.get("key2"), Some(&"val2".to_string()));
    }

    #[test]
    fn test_format_size() {
        assert_eq!(format_size(0), "0 B");
        assert_eq!(format_size(512), "512 B");
        assert_eq!(format_size(1024), "1.00 KB");
        assert_eq!(format_size(1024 * 512), "512.00 KB");
        assert_eq!(format_size(1024 * 1024), "1.00 MB");
        assert_eq!(format_size(1024 * 1024 * 1024), "1.00 GB");
    }

    #[test]
    fn test_format_duration_edge_cases() {
        assert_eq!(format_duration(0), "0s");
        assert_eq!(format_duration(59), "59s");
        assert_eq!(format_duration(60), "1m 0s");
        assert_eq!(format_duration(3600), "1h 0m");
        assert_eq!(format_duration(7200), "2h 0m");
        assert_eq!(format_duration(86400), "24h 0m");
    }

    #[test]
    fn test_download_progress_eta_human() {
        let progress = DownloadProgress::new(500, Some(1000), 100.0);
        let eta = progress.eta_human();
        assert!(eta.is_some());
        assert_eq!(eta.unwrap(), "5s");
    }

    #[test]
    fn test_download_task_supports_resume_default() {
        let task = DownloadTask::new(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test".to_string(),
        );
        // Default should be false until server confirms
        assert!(!task.supports_resume);
    }

    #[test]
    fn test_download_task_server_filename_default() {
        let task = DownloadTask::new(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test".to_string(),
        );
        assert!(task.server_filename.is_none());
    }

    #[test]
    fn test_download_config_auto_extract_default() {
        let config = DownloadConfig::default();
        assert!(!config.auto_extract);
        assert!(config.extract_dest.is_none());
    }

    #[test]
    fn test_download_config_auto_extract_enabled() {
        let config = DownloadConfig {
            auto_extract: true,
            extract_dest: Some(PathBuf::from("/tmp/extracted")),
            ..Default::default()
        };
        assert!(config.auto_extract);
        assert_eq!(config.extract_dest, Some(PathBuf::from("/tmp/extracted")));
    }

    #[test]
    fn test_download_task_builder_with_auto_extract_config() {
        let config = DownloadConfig {
            auto_extract: true,
            extract_dest: Some(PathBuf::from("/opt/packages")),
            ..Default::default()
        };

        let task = DownloadTask::builder(
            "https://example.com/archive.tar.gz".to_string(),
            PathBuf::from("/tmp/archive.tar.gz"),
            "Archive".to_string(),
        )
        .with_config(config)
        .build();

        assert!(task.config.auto_extract);
        assert_eq!(
            task.config.extract_dest,
            Some(PathBuf::from("/opt/packages"))
        );
    }

    #[test]
    fn test_download_config_serde_roundtrip() {
        let config = DownloadConfig {
            max_retries: 5,
            timeout_secs: 600,
            verify_checksum: false,
            speed_limit: 2048,
            allow_resume: false,
            auto_extract: true,
            extract_dest: Some(PathBuf::from("/tmp/out")),
            segments: 4,
            ..Default::default()
        };

        let json = serde_json::to_string(&config).unwrap();
        let deserialized: DownloadConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.max_retries, 5);
        assert_eq!(deserialized.timeout_secs, 600);
        assert!(!deserialized.verify_checksum);
        assert_eq!(deserialized.speed_limit, 2048);
        assert!(!deserialized.allow_resume);
        assert!(deserialized.auto_extract);
        assert_eq!(deserialized.extract_dest, Some(PathBuf::from("/tmp/out")));
    }

    #[test]
    fn test_download_config_serde_defaults() {
        // Deserialize with missing optional fields => defaults apply
        let json = r#"{"maxRetries":3,"timeoutSecs":300,"verifyChecksum":true,"speedLimit":0,"allowResume":true}"#;
        let config: DownloadConfig = serde_json::from_str(json).unwrap();
        assert!(!config.auto_extract);
        assert!(config.extract_dest.is_none());
    }

    #[test]
    fn test_download_task_builder_with_header() {
        let task = DownloadTask::builder(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test".to_string(),
        )
        .with_header("Authorization", "Bearer token123")
        .build();

        assert_eq!(
            task.headers.get("Authorization"),
            Some(&"Bearer token123".to_string())
        );
    }

    #[test]
    fn test_download_task_builder_with_headers() {
        let mut headers = std::collections::HashMap::new();
        headers.insert("X-Custom".to_string(), "value1".to_string());
        headers.insert("Accept".to_string(), "application/octet-stream".to_string());

        let task = DownloadTask::builder(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test".to_string(),
        )
        .with_headers(headers)
        .build();

        assert_eq!(task.headers.len(), 2);
        assert_eq!(task.headers.get("X-Custom"), Some(&"value1".to_string()));
        assert_eq!(
            task.headers.get("Accept"),
            Some(&"application/octet-stream".to_string())
        );
    }

    #[test]
    fn test_download_progress_total_human_none() {
        let progress = DownloadProgress::new(1024, None, 100.0);
        assert!(progress.total_human().is_none());
    }

    #[test]
    fn test_download_task_filename_root_path() {
        let task = DownloadTask::new(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/"),
            "Test".to_string(),
        );
        // Root path has no file_name component
        assert_eq!(task.filename(), "unknown");
    }

    #[test]
    fn test_download_task_headers_default_empty() {
        let task = DownloadTask::new(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test".to_string(),
        );
        assert!(task.headers.is_empty());
    }

    #[test]
    fn test_download_task_serde_server_filename() {
        let mut task = DownloadTask::new(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test".to_string(),
        );
        task.server_filename = Some("actual-file-v2.0.zip".to_string());

        let json = serde_json::to_string(&task).unwrap();
        assert!(json.contains("actual-file-v2.0.zip"));

        let deserialized: DownloadTask = serde_json::from_str(&json).unwrap();
        assert_eq!(
            deserialized.server_filename,
            Some("actual-file-v2.0.zip".to_string())
        );
    }

    #[test]
    fn test_download_config_segments_default() {
        let config = DownloadConfig::default();
        assert_eq!(config.segments, 1);
    }

    #[test]
    fn test_download_config_segments_custom() {
        let config = DownloadConfig {
            segments: 8,
            ..Default::default()
        };
        assert_eq!(config.segments, 8);
    }

    #[test]
    fn test_download_config_segments_serde_roundtrip() {
        let config = DownloadConfig {
            segments: 16,
            ..Default::default()
        };
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: DownloadConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.segments, 16);
    }

    #[test]
    fn test_download_config_segments_serde_default_when_missing() {
        let json = r#"{"maxRetries":3,"timeoutSecs":300,"verifyChecksum":true,"speedLimit":0,"allowResume":true}"#;
        let config: DownloadConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.segments, 1);
    }

    #[test]
    fn test_download_task_mirror_urls_default_empty() {
        let task = DownloadTask::new(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test".to_string(),
        );
        assert!(task.mirror_urls.is_empty());
    }

    #[test]
    fn test_download_task_builder_with_mirror() {
        let task = DownloadTask::builder(
            "https://primary.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test".to_string(),
        )
        .with_mirror("https://mirror1.com/file.zip".to_string())
        .with_mirror("https://mirror2.com/file.zip".to_string())
        .build();

        assert_eq!(task.mirror_urls.len(), 2);
        assert_eq!(task.mirror_urls[0], "https://mirror1.com/file.zip");
        assert_eq!(task.mirror_urls[1], "https://mirror2.com/file.zip");
    }

    #[test]
    fn test_download_task_builder_with_mirrors() {
        let mirrors = vec![
            "https://mirror1.com/file.zip".to_string(),
            "https://mirror2.com/file.zip".to_string(),
        ];
        let task = DownloadTask::builder(
            "https://primary.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test".to_string(),
        )
        .with_mirrors(mirrors)
        .build();

        assert_eq!(task.mirror_urls.len(), 2);
    }

    #[test]
    fn test_download_task_mirror_urls_serde_roundtrip() {
        let mut task = DownloadTask::new(
            "https://primary.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test".to_string(),
        );
        task.mirror_urls = vec![
            "https://mirror1.com/file.zip".to_string(),
            "https://mirror2.com/file.zip".to_string(),
        ];

        let json = serde_json::to_string(&task).unwrap();
        assert!(json.contains("mirror1.com"));

        let deserialized: DownloadTask = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.mirror_urls.len(), 2);
        assert_eq!(deserialized.mirror_urls[0], "https://mirror1.com/file.zip");
    }

    #[test]
    fn test_download_task_mirror_urls_serde_default_when_missing() {
        let json = serde_json::json!({
            "id": "test-id",
            "url": "https://example.com/file.zip",
            "destination": "/tmp/file.zip",
            "name": "Test",
            "state": {"type": "queued"},
            "progress": {"downloadedBytes": 0, "speed": 0.0, "percent": 0.0},
            "priority": 0,
            "createdAt": "2025-01-01T00:00:00Z",
            "retries": 0,
            "config": {"maxRetries": 3, "timeoutSecs": 300, "verifyChecksum": true, "speedLimit": 0, "allowResume": true},
            "supportsResume": false,
            "metadata": {}
        });
        let task: DownloadTask = serde_json::from_value(json).unwrap();
        assert!(task.mirror_urls.is_empty());
    }

    #[test]
    fn test_speed_tracker_initial() {
        let tracker = SpeedTracker::new();
        assert_eq!(tracker.prev_speed, 0.0);
    }

    #[test]
    fn test_speed_tracker_first_update_sets_speed() {
        let mut tracker = SpeedTracker::new();
        // Simulate time passing by overriding prev_time
        tracker.prev_time = Instant::now() - std::time::Duration::from_secs(1);
        let speed = tracker.update(1024 * 1024); // 1 MB after 1 second
        assert!(speed > 0.0);
        assert!(speed > 500_000.0); // Should be close to 1 MB/s
    }

    #[test]
    fn test_speed_tracker_ewma_smoothing() {
        let mut tracker = SpeedTracker::new();
        // First update: 1 MB over 1 second
        tracker.prev_time = Instant::now() - std::time::Duration::from_secs(1);
        let s1 = tracker.update(1_000_000);
        // Second update: 2 MB more over another second
        tracker.prev_time = Instant::now() - std::time::Duration::from_secs(1);
        let s2 = tracker.update(3_000_000);
        // EWMA should smooth: s2 should be between s1 and instant (2 MB/s)
        assert!(s2 > s1);
    }

    #[test]
    fn test_speed_tracker_skips_tiny_intervals() {
        let mut tracker = SpeedTracker::new();
        // Update with no time elapsed should return prev_speed (0)
        let speed = tracker.update(1024);
        assert_eq!(speed, 0.0);
    }

    #[test]
    fn test_download_config_delete_after_extract_default() {
        let config = DownloadConfig::default();
        assert!(!config.delete_after_extract);
    }

    #[test]
    fn test_download_config_auto_rename_default() {
        let config = DownloadConfig::default();
        assert!(config.auto_rename); // default true
    }

    #[test]
    fn test_download_config_new_fields_serde() {
        let config = DownloadConfig {
            delete_after_extract: true,
            auto_rename: false,
            ..Default::default()
        };
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("deleteAfterExtract"));
        assert!(json.contains("autoRename"));
        let deser: DownloadConfig = serde_json::from_str(&json).unwrap();
        assert!(deser.delete_after_extract);
        assert!(!deser.auto_rename);
    }

    #[test]
    fn test_download_task_tags_default_empty() {
        let task = DownloadTask::new(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test".to_string(),
        );
        assert!(task.tags.is_empty());
    }

    #[test]
    fn test_download_task_builder_with_tags() {
        let task = DownloadTask::builder(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test".to_string(),
        )
        .with_tag("github".to_string())
        .with_tag("release".to_string())
        .build();

        assert_eq!(task.tags.len(), 2);
        assert_eq!(task.tags[0], "github");
        assert_eq!(task.tags[1], "release");
    }

    #[test]
    fn test_download_task_builder_with_tags_vec() {
        let task = DownloadTask::builder(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test".to_string(),
        )
        .with_tags(vec!["a".into(), "b".into()])
        .build();

        assert_eq!(task.tags, vec!["a", "b"]);
    }

    #[test]
    fn test_download_task_tags_serde_roundtrip() {
        let mut task = DownloadTask::new(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test".to_string(),
        );
        task.tags = vec!["github".into(), "v2".into()];
        let json = serde_json::to_string(&task).unwrap();
        assert!(json.contains("\"tags\""));
        let deser: DownloadTask = serde_json::from_str(&json).unwrap();
        assert_eq!(deser.tags, vec!["github", "v2"]);
    }
}
