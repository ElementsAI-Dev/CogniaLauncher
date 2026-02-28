use thiserror::Error;

#[derive(Error, Debug)]
pub enum CogniaError {
    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Provider error: {0}")]
    Provider(String),

    #[error("Provider not found: {0}")]
    ProviderNotFound(String),

    #[error("Package not found: {0}")]
    PackageNotFound(String),

    #[error("Version not found: {0}")]
    VersionNotFound(String),

    #[error("Version not installed: {0}")]
    VersionNotInstalled(String),

    #[error("Dependency resolution failed: {0}")]
    Resolution(String),

    #[error("Dependency conflict: {0}")]
    Conflict(String),

    #[error("Installation failed: {0}")]
    Installation(String),

    #[error("Checksum mismatch: expected {expected}, got {actual}")]
    ChecksumMismatch { expected: String, actual: String },

    #[error("Download failed: {0}")]
    Download(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Parse error: {0}")]
    Parse(String),

    #[error("Platform not supported: {0}")]
    PlatformNotSupported(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Operation cancelled")]
    Cancelled,

    #[error("Plugin error: {0}")]
    Plugin(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

pub type CogniaResult<T> = Result<T, CogniaError>;

impl From<crate::platform::FsError> for CogniaError {
    fn from(err: crate::platform::FsError) -> Self {
        CogniaError::Io(std::io::Error::other(err.to_string()))
    }
}

impl From<crate::platform::NetworkError> for CogniaError {
    fn from(err: crate::platform::NetworkError) -> Self {
        CogniaError::Network(err.to_string())
    }
}

impl From<crate::platform::ProcessError> for CogniaError {
    fn from(err: crate::platform::ProcessError) -> Self {
        CogniaError::Internal(err.to_string())
    }
}

impl serde::Serialize for CogniaError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
