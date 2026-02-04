//! Download state management

use serde::{Deserialize, Serialize};

/// Represents the current state of a download task
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DownloadState {
    /// Task is queued and waiting to start
    Queued,
    /// Task is currently downloading
    Downloading,
    /// Task is paused by user
    Paused,
    /// Task was cancelled by user
    Cancelled,
    /// Task completed successfully
    Completed,
    /// Task failed with an error
    Failed {
        error: String,
        recoverable: bool,
    },
}

impl Default for DownloadState {
    fn default() -> Self {
        Self::Queued
    }
}

impl DownloadState {
    /// Check if the download is in a terminal state
    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Completed | Self::Cancelled | Self::Failed { .. })
    }

    /// Check if the download can be resumed
    pub fn can_resume(&self) -> bool {
        matches!(self, Self::Paused | Self::Failed { recoverable: true, .. })
    }

    /// Check if the download can be paused
    pub fn can_pause(&self) -> bool {
        matches!(self, Self::Downloading | Self::Queued)
    }

    /// Check if the download is active (downloading or queued)
    pub fn is_active(&self) -> bool {
        matches!(self, Self::Downloading | Self::Queued)
    }

    /// Get a human-readable status string
    pub fn status_text(&self) -> &'static str {
        match self {
            Self::Queued => "queued",
            Self::Downloading => "downloading",
            Self::Paused => "paused",
            Self::Cancelled => "cancelled",
            Self::Completed => "completed",
            Self::Failed { .. } => "failed",
        }
    }
}

/// Download-specific errors
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DownloadError {
    /// Network error during download
    Network { message: String },
    /// File system error
    FileSystem { message: String },
    /// Checksum verification failed
    ChecksumMismatch { expected: String, actual: String },
    /// Not enough disk space
    InsufficientSpace { required: u64, available: u64 },
    /// Download was interrupted
    Interrupted,
    /// URL is invalid or inaccessible
    InvalidUrl { url: String },
    /// Server returned an error status
    HttpError { status: u16, message: String },
    /// Download timeout
    Timeout { seconds: u64 },
    /// Rate limited by server
    RateLimited { retry_after: u64 },
    /// Task not found
    TaskNotFound { id: String },
    /// Invalid operation for current state
    InvalidOperation { state: String, operation: String },
}

impl std::fmt::Display for DownloadError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Network { message } => write!(f, "Network error: {}", message),
            Self::FileSystem { message } => write!(f, "File system error: {}", message),
            Self::ChecksumMismatch { expected, actual } => {
                write!(f, "Checksum mismatch: expected {}, got {}", expected, actual)
            }
            Self::InsufficientSpace { required, available } => {
                write!(
                    f,
                    "Insufficient disk space: {} required, {} available",
                    format_size(*required),
                    format_size(*available)
                )
            }
            Self::Interrupted => write!(f, "Download interrupted"),
            Self::InvalidUrl { url } => write!(f, "Invalid URL: {}", url),
            Self::HttpError { status, message } => {
                write!(f, "HTTP error {}: {}", status, message)
            }
            Self::Timeout { seconds } => write!(f, "Download timeout after {} seconds", seconds),
            Self::RateLimited { retry_after } => {
                write!(f, "Rate limited, retry after {} seconds", retry_after)
            }
            Self::TaskNotFound { id } => write!(f, "Download task not found: {}", id),
            Self::InvalidOperation { state, operation } => {
                write!(f, "Cannot {} while in {} state", operation, state)
            }
        }
    }
}

impl std::error::Error for DownloadError {}

impl DownloadError {
    /// Check if the error is recoverable (can be retried)
    pub fn is_recoverable(&self) -> bool {
        matches!(
            self,
            Self::Network { .. }
                | Self::Timeout { .. }
                | Self::RateLimited { .. }
                | Self::Interrupted
                | Self::HttpError { status, .. } if *status >= 500
        )
    }

    /// Convert to DownloadState::Failed
    pub fn to_failed_state(&self) -> DownloadState {
        DownloadState::Failed {
            error: self.to_string(),
            recoverable: self.is_recoverable(),
        }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_download_state_is_terminal() {
        assert!(!DownloadState::Queued.is_terminal());
        assert!(!DownloadState::Downloading.is_terminal());
        assert!(!DownloadState::Paused.is_terminal());
        assert!(DownloadState::Cancelled.is_terminal());
        assert!(DownloadState::Completed.is_terminal());
        assert!(DownloadState::Failed {
            error: "test".into(),
            recoverable: true
        }
        .is_terminal());
    }

    #[test]
    fn test_download_state_can_resume() {
        assert!(!DownloadState::Queued.can_resume());
        assert!(!DownloadState::Downloading.can_resume());
        assert!(DownloadState::Paused.can_resume());
        assert!(!DownloadState::Cancelled.can_resume());
        assert!(!DownloadState::Completed.can_resume());
        assert!(DownloadState::Failed {
            error: "test".into(),
            recoverable: true
        }
        .can_resume());
        assert!(!DownloadState::Failed {
            error: "test".into(),
            recoverable: false
        }
        .can_resume());
    }

    #[test]
    fn test_download_state_can_pause() {
        assert!(DownloadState::Queued.can_pause());
        assert!(DownloadState::Downloading.can_pause());
        assert!(!DownloadState::Paused.can_pause());
        assert!(!DownloadState::Cancelled.can_pause());
        assert!(!DownloadState::Completed.can_pause());
    }

    #[test]
    fn test_download_error_is_recoverable() {
        assert!(DownloadError::Network {
            message: "test".into()
        }
        .is_recoverable());
        assert!(DownloadError::Timeout { seconds: 30 }.is_recoverable());
        assert!(DownloadError::RateLimited { retry_after: 60 }.is_recoverable());
        assert!(DownloadError::Interrupted.is_recoverable());
        assert!(DownloadError::HttpError {
            status: 503,
            message: "Service Unavailable".into()
        }
        .is_recoverable());

        assert!(!DownloadError::ChecksumMismatch {
            expected: "abc".into(),
            actual: "def".into()
        }
        .is_recoverable());
        assert!(!DownloadError::InvalidUrl {
            url: "bad".into()
        }
        .is_recoverable());
        assert!(!DownloadError::HttpError {
            status: 404,
            message: "Not Found".into()
        }
        .is_recoverable());
    }

    #[test]
    fn test_download_error_display() {
        let err = DownloadError::InsufficientSpace {
            required: 1024 * 1024 * 100,
            available: 1024 * 1024 * 50,
        };
        assert!(err.to_string().contains("Insufficient disk space"));
    }
}
