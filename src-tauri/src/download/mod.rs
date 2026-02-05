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
mod queue;
mod state;
mod task;
mod throttle;

pub use asset_picker::{AssetLike, AssetMatch, AssetPicker, LibcType, detect_arch, detect_platform};
pub use manager::{DownloadManager, DownloadManagerConfig, DownloadEvent};
pub use queue::DownloadQueue;
pub use state::{DownloadState, DownloadError};
pub use task::{DownloadTask, DownloadProgress, DownloadConfig};
pub use throttle::SpeedLimiter;
