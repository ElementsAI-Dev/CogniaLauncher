//! Download state management

use crate::platform::disk::format_size;
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
    Failed { error: String, recoverable: bool },
}

impl Default for DownloadState {
    fn default() -> Self {
        Self::Queued
    }
}

impl DownloadState {
    /// Check if the download is in a terminal state
    pub fn is_terminal(&self) -> bool {
        matches!(
            self,
            Self::Completed | Self::Cancelled | Self::Failed { .. }
        )
    }

    /// Check if the download can be resumed
    pub fn can_resume(&self) -> bool {
        matches!(
            self,
            Self::Paused
                | Self::Failed {
                    recoverable: true,
                    ..
                }
        )
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
                write!(
                    f,
                    "Checksum mismatch: expected {}, got {}",
                    expected, actual
                )
            }
            Self::InsufficientSpace {
                required,
                available,
            } => {
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
        match self {
            Self::Network { .. }
            | Self::Timeout { .. }
            | Self::RateLimited { .. }
            | Self::Interrupted => true,
            Self::HttpError { status, .. } if *status >= 500 => true,
            _ => false,
        }
    }

    /// Convert to DownloadState::Failed
    pub fn to_failed_state(&self) -> DownloadState {
        DownloadState::Failed {
            error: self.to_string(),
            recoverable: self.is_recoverable(),
        }
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
        assert!(!DownloadError::InvalidUrl { url: "bad".into() }.is_recoverable());
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

    #[test]
    fn test_download_state_is_active() {
        assert!(DownloadState::Queued.is_active());
        assert!(DownloadState::Downloading.is_active());
        assert!(!DownloadState::Paused.is_active());
        assert!(!DownloadState::Cancelled.is_active());
        assert!(!DownloadState::Completed.is_active());
        assert!(!DownloadState::Failed {
            error: "test".into(),
            recoverable: true
        }
        .is_active());
    }

    #[test]
    fn test_download_state_status_text() {
        assert_eq!(DownloadState::Queued.status_text(), "queued");
        assert_eq!(DownloadState::Downloading.status_text(), "downloading");
        assert_eq!(DownloadState::Paused.status_text(), "paused");
        assert_eq!(DownloadState::Cancelled.status_text(), "cancelled");
        assert_eq!(DownloadState::Completed.status_text(), "completed");
        assert_eq!(
            DownloadState::Failed {
                error: "err".into(),
                recoverable: false
            }
            .status_text(),
            "failed"
        );
    }

    #[test]
    fn test_download_state_default() {
        let state = DownloadState::default();
        assert_eq!(state, DownloadState::Queued);
    }

    #[test]
    fn test_download_error_to_failed_state() {
        let err = DownloadError::Network {
            message: "timeout".into(),
        };
        let state = err.to_failed_state();
        match state {
            DownloadState::Failed { error, recoverable } => {
                assert!(error.contains("Network error: timeout"));
                assert!(recoverable);
            }
            _ => panic!("Expected Failed state"),
        }

        let err = DownloadError::ChecksumMismatch {
            expected: "abc".into(),
            actual: "def".into(),
        };
        let state = err.to_failed_state();
        match state {
            DownloadState::Failed { error, recoverable } => {
                assert!(error.contains("Checksum mismatch"));
                assert!(!recoverable);
            }
            _ => panic!("Expected Failed state"),
        }
    }

    #[test]
    fn test_download_error_display_all_variants() {
        assert!(DownloadError::Network {
            message: "conn reset".into()
        }
        .to_string()
        .contains("Network error"));

        assert!(DownloadError::FileSystem {
            message: "disk full".into()
        }
        .to_string()
        .contains("File system error"));

        assert!(DownloadError::ChecksumMismatch {
            expected: "abc".into(),
            actual: "def".into(),
        }
        .to_string()
        .contains("Checksum mismatch"));

        assert!(DownloadError::Interrupted
            .to_string()
            .contains("interrupted"));

        assert!(DownloadError::InvalidUrl {
            url: "bad://url".into()
        }
        .to_string()
        .contains("Invalid URL"));

        assert!(DownloadError::HttpError {
            status: 404,
            message: "Not Found".into(),
        }
        .to_string()
        .contains("HTTP error 404"));

        assert!(DownloadError::Timeout { seconds: 30 }
            .to_string()
            .contains("timeout"));

        assert!(DownloadError::RateLimited { retry_after: 60 }
            .to_string()
            .contains("Rate limited"));

        assert!(DownloadError::TaskNotFound { id: "abc".into() }
            .to_string()
            .contains("not found"));

        assert!(DownloadError::InvalidOperation {
            state: "paused".into(),
            operation: "pause".into(),
        }
        .to_string()
        .contains("Cannot pause"));
    }

    #[test]
    fn test_download_error_http_500_is_recoverable() {
        assert!(DownloadError::HttpError {
            status: 500,
            message: "Internal Server Error".into()
        }
        .is_recoverable());
        assert!(DownloadError::HttpError {
            status: 502,
            message: "Bad Gateway".into()
        }
        .is_recoverable());
        assert!(DownloadError::HttpError {
            status: 503,
            message: "Service Unavailable".into()
        }
        .is_recoverable());
    }

    #[test]
    fn test_download_error_http_4xx_not_recoverable() {
        assert!(!DownloadError::HttpError {
            status: 400,
            message: "Bad Request".into()
        }
        .is_recoverable());
        assert!(!DownloadError::HttpError {
            status: 401,
            message: "Unauthorized".into()
        }
        .is_recoverable());
        assert!(!DownloadError::HttpError {
            status: 403,
            message: "Forbidden".into()
        }
        .is_recoverable());
    }

    #[test]
    fn test_download_error_filesystem_not_recoverable() {
        assert!(!DownloadError::FileSystem {
            message: "disk full".into()
        }
        .is_recoverable());
    }

    #[test]
    fn test_download_error_insufficient_space_not_recoverable() {
        assert!(!DownloadError::InsufficientSpace {
            required: 1000,
            available: 500,
        }
        .is_recoverable());
    }

    #[test]
    fn test_download_error_task_not_found_not_recoverable() {
        assert!(!DownloadError::TaskNotFound {
            id: "abc".into()
        }
        .is_recoverable());
    }

    #[test]
    fn test_download_error_invalid_operation_not_recoverable() {
        assert!(!DownloadError::InvalidOperation {
            state: "paused".into(),
            operation: "pause".into(),
        }
        .is_recoverable());
    }

    #[test]
    fn test_download_state_serde_roundtrip() {
        let states = vec![
            DownloadState::Queued,
            DownloadState::Downloading,
            DownloadState::Paused,
            DownloadState::Cancelled,
            DownloadState::Completed,
            DownloadState::Failed {
                error: "test error".into(),
                recoverable: true,
            },
            DownloadState::Failed {
                error: "fatal".into(),
                recoverable: false,
            },
        ];

        for state in states {
            let json = serde_json::to_string(&state).unwrap();
            let deserialized: DownloadState = serde_json::from_str(&json).unwrap();
            assert_eq!(deserialized, state);
        }
    }

    #[test]
    fn test_download_error_serde_roundtrip() {
        let errors: Vec<DownloadError> = vec![
            DownloadError::Network { message: "timeout".into() },
            DownloadError::FileSystem { message: "disk full".into() },
            DownloadError::ChecksumMismatch { expected: "abc".into(), actual: "def".into() },
            DownloadError::InsufficientSpace { required: 1000, available: 500 },
            DownloadError::Interrupted,
            DownloadError::InvalidUrl { url: "bad://url".into() },
            DownloadError::HttpError { status: 404, message: "Not Found".into() },
            DownloadError::Timeout { seconds: 30 },
            DownloadError::RateLimited { retry_after: 60 },
            DownloadError::TaskNotFound { id: "abc".into() },
            DownloadError::InvalidOperation { state: "paused".into(), operation: "pause".into() },
        ];

        for error in errors {
            let json = serde_json::to_string(&error).unwrap();
            let deserialized: DownloadError = serde_json::from_str(&json).unwrap();
            // Verify round-trip by checking Display output matches
            assert_eq!(deserialized.to_string(), error.to_string());
        }
    }

    #[test]
    fn test_format_size() {
        assert_eq!(format_size(0), "0 B");
        assert_eq!(format_size(500), "500 B");
        assert_eq!(format_size(1024), "1.00 KB");
        assert_eq!(format_size(1024 * 1024), "1.00 MB");
        assert_eq!(format_size(1024 * 1024 * 1024), "1.00 GB");
    }
}
