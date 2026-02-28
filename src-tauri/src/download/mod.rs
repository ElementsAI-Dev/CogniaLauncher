//! Download management module
//!
//! This module provides a comprehensive download management system with:
//! - Download queue management
//! - Pause/resume support
//! - Progress tracking
//! - Speed limiting
//! - Retry mechanisms
//! - Download history
//! - Smart asset picking

mod asset_picker;
mod manager;
mod persistence;
mod queue;
mod state;
mod task;
mod throttle;

pub use asset_picker::{
    detect_arch, detect_platform, AssetLike, AssetMatch, AssetPicker, LibcType,
};
pub use manager::{DownloadEvent, DownloadManager, DownloadManagerConfig};
pub use persistence::QueuePersistence;
pub use queue::DownloadQueue;
pub use state::{DownloadError, DownloadState};
pub use task::{DownloadConfig, DownloadProgress, DownloadTask};
pub use throttle::SpeedLimiter;
