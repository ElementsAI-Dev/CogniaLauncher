//! Download management commands

use crate::cache::download_history::{DownloadHistory, DownloadRecord, DownloadStatus, HistoryStats};
use crate::config::Settings;
use crate::download::{
    DownloadConfig, DownloadEvent, DownloadManager, DownloadManagerConfig, DownloadTask,
};
use crate::platform::disk::{self, DiskSpace};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::RwLock;

/// Shared download manager state
pub type SharedDownloadManager = Arc<RwLock<DownloadManager>>;

/// Shared settings
pub type SharedSettings = Arc<RwLock<Settings>>;

/// Task info returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadTaskInfo {
    pub id: String,
    pub url: String,
    pub name: String,
    pub destination: String,
    pub state: String,
    pub progress: DownloadProgressInfo,
    pub error: Option<String>,
    pub provider: Option<String>,
    pub created_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgressInfo {
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub speed: f64,
    pub speed_human: String,
    pub percent: f32,
    pub eta_secs: Option<u64>,
    pub eta_human: Option<String>,
    pub downloaded_human: String,
    pub total_human: Option<String>,
}

impl From<&DownloadTask> for DownloadTaskInfo {
    fn from(task: &DownloadTask) -> Self {
        Self {
            id: task.id.clone(),
            url: task.url.clone(),
            name: task.name.clone(),
            destination: task.destination.display().to_string(),
            state: task.state.status_text().to_string(),
            progress: DownloadProgressInfo {
                downloaded_bytes: task.progress.downloaded_bytes,
                total_bytes: task.progress.total_bytes,
                speed: task.progress.speed,
                speed_human: task.progress.speed_human(),
                percent: task.progress.percent,
                eta_secs: task.progress.eta_secs,
                eta_human: task.progress.eta_human(),
                downloaded_human: task.progress.downloaded_human(),
                total_human: task.progress.total_human(),
            },
            error: task.error.clone(),
            provider: task.provider.clone(),
            created_at: task.created_at.to_rfc3339(),
            started_at: task.started_at.map(|t| t.to_rfc3339()),
            completed_at: task.completed_at.map(|t| t.to_rfc3339()),
        }
    }
}

/// Queue statistics returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueStatsInfo {
    pub total_tasks: usize,
    pub queued: usize,
    pub downloading: usize,
    pub paused: usize,
    pub completed: usize,
    pub failed: usize,
    pub cancelled: usize,
    pub total_bytes: u64,
    pub downloaded_bytes: u64,
    pub total_human: String,
    pub downloaded_human: String,
    pub overall_progress: f32,
}

/// Download request from frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadRequest {
    pub url: String,
    pub destination: String,
    pub name: String,
    pub checksum: Option<String>,
    pub priority: Option<i32>,
    pub provider: Option<String>,
}

/// Initialize the download manager and start event forwarding
pub async fn init_download_manager(
    app: AppHandle,
    settings: &Settings,
) -> SharedDownloadManager {
    let config = DownloadManagerConfig {
        max_concurrent: settings.general.parallel_downloads as usize,
        speed_limit: 0, // Unlimited by default
        default_task_config: DownloadConfig::default(),
        partials_dir: settings.get_cache_dir().join("partials"),
        auto_start: true,
    };

    let mut manager = DownloadManager::new(config);
    let mut rx = manager.create_event_channel();

    // Start the manager
    manager.start().await;

    // Spawn event forwarding task
    let app_clone = app.clone();
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            let event_name = match &event {
                DownloadEvent::TaskAdded { .. } => "download-task-added",
                DownloadEvent::TaskStarted { .. } => "download-task-started",
                DownloadEvent::TaskProgress { .. } => "download-task-progress",
                DownloadEvent::TaskCompleted { .. } => "download-task-completed",
                DownloadEvent::TaskFailed { .. } => "download-task-failed",
                DownloadEvent::TaskPaused { .. } => "download-task-paused",
                DownloadEvent::TaskResumed { .. } => "download-task-resumed",
                DownloadEvent::TaskCancelled { .. } => "download-task-cancelled",
                DownloadEvent::QueueUpdated { .. } => "download-queue-updated",
            };

            let _ = app_clone.emit(event_name, &event);
        }
    });

    Arc::new(RwLock::new(manager))
}

/// Add a new download task
#[tauri::command]
pub async fn download_add(
    request: DownloadRequest,
    manager: State<'_, SharedDownloadManager>,
) -> Result<String, String> {
    let task = DownloadTask::builder(
        request.url,
        PathBuf::from(request.destination),
        request.name,
    )
    .with_priority(request.priority.unwrap_or(0))
    .with_checksum(request.checksum.unwrap_or_default())
    .with_provider(request.provider.unwrap_or_default())
    .build();

    let mgr = manager.read().await;
    let task_id = mgr.add_task(task).await;

    Ok(task_id)
}

/// Get a download task by ID
#[tauri::command]
pub async fn download_get(
    task_id: String,
    manager: State<'_, SharedDownloadManager>,
) -> Result<Option<DownloadTaskInfo>, String> {
    let mgr = manager.read().await;
    let task = mgr.get_task(&task_id).await;

    Ok(task.as_ref().map(DownloadTaskInfo::from))
}

/// List all download tasks
#[tauri::command]
pub async fn download_list(
    manager: State<'_, SharedDownloadManager>,
) -> Result<Vec<DownloadTaskInfo>, String> {
    let mgr = manager.read().await;
    let tasks = mgr.list_tasks().await;

    Ok(tasks.iter().map(DownloadTaskInfo::from).collect())
}

/// Get queue statistics
#[tauri::command]
pub async fn download_stats(
    manager: State<'_, SharedDownloadManager>,
) -> Result<QueueStatsInfo, String> {
    let mgr = manager.read().await;
    let stats = mgr.stats().await;

    let overall_progress = if stats.total_bytes > 0 {
        (stats.downloaded_bytes as f64 / stats.total_bytes as f64 * 100.0) as f32
    } else {
        0.0
    };

    Ok(QueueStatsInfo {
        total_tasks: stats.total_tasks,
        queued: stats.queued,
        downloading: stats.downloading,
        paused: stats.paused,
        completed: stats.completed,
        failed: stats.failed,
        cancelled: stats.cancelled,
        total_bytes: stats.total_bytes,
        downloaded_bytes: stats.downloaded_bytes,
        total_human: format_size(stats.total_bytes),
        downloaded_human: format_size(stats.downloaded_bytes),
        overall_progress,
    })
}

/// Pause a download task
#[tauri::command]
pub async fn download_pause(
    task_id: String,
    manager: State<'_, SharedDownloadManager>,
) -> Result<(), String> {
    let mgr = manager.read().await;
    mgr.pause(&task_id).await.map_err(|e| e.to_string())
}

/// Resume a paused download task
#[tauri::command]
pub async fn download_resume(
    task_id: String,
    manager: State<'_, SharedDownloadManager>,
) -> Result<(), String> {
    let mgr = manager.read().await;
    mgr.resume(&task_id).await.map_err(|e| e.to_string())
}

/// Cancel a download task
#[tauri::command]
pub async fn download_cancel(
    task_id: String,
    manager: State<'_, SharedDownloadManager>,
) -> Result<(), String> {
    let mgr = manager.read().await;
    mgr.cancel(&task_id).await.map_err(|e| e.to_string())
}

/// Remove a download task
#[tauri::command]
pub async fn download_remove(
    task_id: String,
    manager: State<'_, SharedDownloadManager>,
) -> Result<bool, String> {
    let mgr = manager.read().await;
    Ok(mgr.remove(&task_id).await.is_some())
}

/// Pause all downloads
#[tauri::command]
pub async fn download_pause_all(
    manager: State<'_, SharedDownloadManager>,
) -> Result<usize, String> {
    let mgr = manager.read().await;
    Ok(mgr.pause_all().await)
}

/// Resume all paused downloads
#[tauri::command]
pub async fn download_resume_all(
    manager: State<'_, SharedDownloadManager>,
) -> Result<usize, String> {
    let mgr = manager.read().await;
    Ok(mgr.resume_all().await)
}

/// Cancel all downloads
#[tauri::command]
pub async fn download_cancel_all(
    manager: State<'_, SharedDownloadManager>,
) -> Result<usize, String> {
    let mgr = manager.read().await;
    Ok(mgr.cancel_all().await)
}

/// Clear finished downloads
#[tauri::command]
pub async fn download_clear_finished(
    manager: State<'_, SharedDownloadManager>,
) -> Result<usize, String> {
    let mgr = manager.read().await;
    Ok(mgr.clear_finished().await)
}

/// Retry all failed downloads
#[tauri::command]
pub async fn download_retry_failed(
    manager: State<'_, SharedDownloadManager>,
) -> Result<usize, String> {
    let mgr = manager.read().await;
    Ok(mgr.retry_all_failed().await)
}

/// Set the speed limit (0 = unlimited)
#[tauri::command]
pub async fn download_set_speed_limit(
    bytes_per_second: u64,
    manager: State<'_, SharedDownloadManager>,
) -> Result<(), String> {
    let mgr = manager.read().await;
    mgr.set_speed_limit(bytes_per_second).await;
    Ok(())
}

/// Get the current speed limit
#[tauri::command]
pub async fn download_get_speed_limit(
    manager: State<'_, SharedDownloadManager>,
) -> Result<u64, String> {
    let mgr = manager.read().await;
    Ok(mgr.get_speed_limit().await)
}

/// Set max concurrent downloads
#[tauri::command]
pub async fn download_set_max_concurrent(
    max: usize,
    manager: State<'_, SharedDownloadManager>,
) -> Result<(), String> {
    let mgr = manager.read().await;
    mgr.set_max_concurrent(max).await;
    Ok(())
}

// ===== Download History Commands =====

/// History record info for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryRecordInfo {
    pub id: String,
    pub url: String,
    pub filename: String,
    pub destination: String,
    pub size: u64,
    pub size_human: String,
    pub checksum: Option<String>,
    pub started_at: String,
    pub completed_at: String,
    pub duration_secs: u64,
    pub duration_human: String,
    pub average_speed: f64,
    pub speed_human: String,
    pub status: String,
    pub error: Option<String>,
    pub provider: Option<String>,
}

impl From<&DownloadRecord> for HistoryRecordInfo {
    fn from(record: &DownloadRecord) -> Self {
        Self {
            id: record.id.clone(),
            url: record.url.clone(),
            filename: record.filename.clone(),
            destination: record.destination.display().to_string(),
            size: record.size,
            size_human: record.size_human(),
            checksum: record.checksum.clone(),
            started_at: record.started_at.to_rfc3339(),
            completed_at: record.completed_at.to_rfc3339(),
            duration_secs: record.duration_secs,
            duration_human: record.duration_human(),
            average_speed: record.average_speed,
            speed_human: record.speed_human(),
            status: match record.status {
                DownloadStatus::Completed => "completed".to_string(),
                DownloadStatus::Failed => "failed".to_string(),
                DownloadStatus::Cancelled => "cancelled".to_string(),
            },
            error: record.error.clone(),
            provider: record.provider.clone(),
        }
    }
}

/// History stats for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryStatsInfo {
    pub total_count: usize,
    pub completed_count: usize,
    pub failed_count: usize,
    pub cancelled_count: usize,
    pub total_bytes: u64,
    pub total_bytes_human: String,
    pub average_speed: f64,
    pub average_speed_human: String,
    pub success_rate: f32,
}

impl From<HistoryStats> for HistoryStatsInfo {
    fn from(stats: HistoryStats) -> Self {
        Self {
            total_count: stats.total_count,
            completed_count: stats.completed_count,
            failed_count: stats.failed_count,
            cancelled_count: stats.cancelled_count,
            total_bytes: stats.total_bytes,
            total_bytes_human: stats.total_bytes_human(),
            average_speed: stats.average_speed,
            average_speed_human: stats.average_speed_human(),
            success_rate: stats.success_rate(),
        }
    }
}

/// Get download history list
#[tauri::command]
pub async fn download_history_list(
    limit: Option<usize>,
    settings: State<'_, SharedSettings>,
) -> Result<Vec<HistoryRecordInfo>, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    drop(s);

    let history = DownloadHistory::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    let records: Vec<_> = history
        .list()
        .into_iter()
        .take(limit.unwrap_or(100))
        .map(HistoryRecordInfo::from)
        .collect();

    Ok(records)
}

/// Search download history
#[tauri::command]
pub async fn download_history_search(
    query: String,
    settings: State<'_, SharedSettings>,
) -> Result<Vec<HistoryRecordInfo>, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    drop(s);

    let history = DownloadHistory::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    let records: Vec<_> = history
        .search(&query)
        .into_iter()
        .map(HistoryRecordInfo::from)
        .collect();

    Ok(records)
}

/// Get download history statistics
#[tauri::command]
pub async fn download_history_stats(
    settings: State<'_, SharedSettings>,
) -> Result<HistoryStatsInfo, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    drop(s);

    let history = DownloadHistory::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    Ok(HistoryStatsInfo::from(history.stats()))
}

/// Clear download history
#[tauri::command]
pub async fn download_history_clear(
    days: Option<i64>,
    settings: State<'_, SharedSettings>,
) -> Result<usize, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    drop(s);

    let mut history = DownloadHistory::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(days) = days {
        history
            .clear_older_than(days)
            .await
            .map_err(|e| e.to_string())
    } else {
        history.clear().await.map_err(|e| e.to_string())
    }
}

/// Remove a specific history record
#[tauri::command]
pub async fn download_history_remove(
    id: String,
    settings: State<'_, SharedSettings>,
) -> Result<bool, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    drop(s);

    let mut history = DownloadHistory::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    history.remove(&id).await.map_err(|e| e.to_string())
}

// ===== Disk Space Commands =====

/// Disk space info for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskSpaceInfo {
    pub total: u64,
    pub available: u64,
    pub used: u64,
    pub usage_percent: f32,
    pub total_human: String,
    pub available_human: String,
    pub used_human: String,
}

impl From<DiskSpace> for DiskSpaceInfo {
    fn from(space: DiskSpace) -> Self {
        Self {
            total: space.total,
            available: space.available,
            used: space.used,
            usage_percent: space.usage_percent,
            total_human: space.total_human(),
            available_human: space.available_human(),
            used_human: space.used_human(),
        }
    }
}

/// Get disk space for a path
#[tauri::command]
pub async fn disk_space_get(path: String) -> Result<DiskSpaceInfo, String> {
    let space = disk::get_disk_space(std::path::Path::new(&path))
        .await
        .map_err(|e| e.to_string())?;

    Ok(DiskSpaceInfo::from(space))
}

/// Check if there's enough disk space
#[tauri::command]
pub async fn disk_space_check(path: String, required: u64) -> Result<bool, String> {
    disk::check_available_space(std::path::Path::new(&path), required)
        .await
        .map_err(|e| e.to_string())
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
    fn test_format_size() {
        assert_eq!(format_size(0), "0 B");
        assert_eq!(format_size(1024), "1.00 KB");
        assert_eq!(format_size(1024 * 1024), "1.00 MB");
        assert_eq!(format_size(1024 * 1024 * 1024), "1.00 GB");
    }
}
