//! Download management commands

use crate::cache::download_history::{DownloadHistory, DownloadRecord, DownloadStatus, HistoryStats};
use crate::config::Settings;
use crate::download::{
    DownloadConfig, DownloadEvent, DownloadManager, DownloadManagerConfig, DownloadTask,
};
use crate::platform::disk::{self, format_size, DiskSpace};
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
        speed_limit: settings.general.download_speed_limit,
        default_task_config: DownloadConfig::default(),
        partials_dir: settings.get_cache_dir().join("partials"),
        auto_start: true,
    };

    let cache_dir = settings.get_cache_dir();

    let proxy = settings.network.proxy.clone();
    let mut manager = DownloadManager::new(config, proxy);
    let mut rx = manager.create_event_channel();

    // Clean up stale partial downloads on startup (older than 7 days)
    let cleaned = manager
        .cleanup_stale_partials(std::time::Duration::from_secs(7 * 86400))
        .await;
    if cleaned > 0 {
        log::info!("Cleaned {} stale partial download files on startup", cleaned);
    }

    // Start the manager
    manager.start().await;

    let shared_manager = Arc::new(RwLock::new(manager));

    // Spawn event forwarding task (also records download history)
    let app_clone = app.clone();
    let manager_clone = shared_manager.clone();
    let cache_dir_clone = cache_dir.clone();
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            // Emit events to frontend with enriched payloads where needed
            match &event {
                DownloadEvent::TaskProgress { task_id, progress } => {
                    // Enrich with human-readable fields the frontend expects
                    // Note: task_id stays snake_case to match existing frontend event listeners
                    #[derive(Serialize)]
                    struct ProgressPayload {
                        task_id: String,
                        progress: DownloadProgressInfo,
                    }
                    let payload = ProgressPayload {
                        task_id: task_id.clone(),
                        progress: DownloadProgressInfo {
                            downloaded_bytes: progress.downloaded_bytes,
                            total_bytes: progress.total_bytes,
                            speed: progress.speed,
                            speed_human: progress.speed_human(),
                            percent: progress.percent,
                            eta_secs: progress.eta_secs,
                            eta_human: progress.eta_human(),
                            downloaded_human: progress.downloaded_human(),
                            total_human: progress.total_human(),
                        },
                    };
                    let _ = app_clone.emit("download-task-progress", &payload);
                }
                DownloadEvent::QueueUpdated { stats } => {
                    // Enrich with human-readable fields
                    let total = stats.total_bytes;
                    let downloaded = stats.downloaded_bytes;
                    let overall_progress = if total > 0 {
                        (downloaded as f64 / total as f64 * 100.0) as f32
                    } else {
                        0.0
                    };
                    let enriched = QueueStatsInfo {
                        total_tasks: stats.total_tasks,
                        queued: stats.queued,
                        downloading: stats.downloading,
                        paused: stats.paused,
                        completed: stats.completed,
                        failed: stats.failed,
                        cancelled: stats.cancelled,
                        total_bytes: total,
                        downloaded_bytes: downloaded,
                        total_human: format_size(total),
                        downloaded_human: format_size(downloaded),
                        overall_progress,
                    };
                    #[derive(Serialize)]
                    struct QueuePayload {
                        stats: QueueStatsInfo,
                    }
                    let _ = app_clone.emit("download-queue-updated", &QueuePayload { stats: enriched });
                }
                _ => {
                    // Other events emit as-is (they only contain task_id / error strings)
                    let event_name = match &event {
                        DownloadEvent::TaskAdded { .. } => "download-task-added",
                        DownloadEvent::TaskStarted { .. } => "download-task-started",
                        DownloadEvent::TaskCompleted { .. } => "download-task-completed",
                        DownloadEvent::TaskFailed { .. } => "download-task-failed",
                        DownloadEvent::TaskPaused { .. } => "download-task-paused",
                        DownloadEvent::TaskResumed { .. } => "download-task-resumed",
                        DownloadEvent::TaskCancelled { .. } => "download-task-cancelled",
                        _ => unreachable!(),
                    };
                    let _ = app_clone.emit(event_name, &event);
                }
            }

            // Record completed/failed/cancelled downloads to history
            match &event {
                DownloadEvent::TaskCompleted { task_id } => {
                    let mgr = manager_clone.read().await;
                    if let Some(task) = mgr.get_task(task_id).await {
                        let record = DownloadRecord::completed(
                            task.url.clone(),
                            task.name.clone(),
                            task.destination.clone(),
                            task.progress.downloaded_bytes,
                            task.expected_checksum.clone(),
                            task.started_at.unwrap_or(task.created_at),
                            task.provider.clone(),
                        );
                        let dest = task.destination.clone();
                        let checksum = task.expected_checksum.clone();
                        drop(mgr);

                        // Record to history
                        if let Ok(mut history) = DownloadHistory::open(&cache_dir_clone).await {
                            if let Err(e) = history.add(record).await {
                                log::warn!("Failed to record download history: {}", e);
                            }
                        }

                        // Add to download cache for deduplication (only if checksum is available)
                        if let Some(ref checksum_val) = checksum {
                            if let Ok(mut dl_cache) =
                                crate::cache::DownloadCache::open(&cache_dir_clone).await
                            {
                                match dl_cache.add_file(&dest, checksum_val).await {
                                    Ok(cached_path) => {
                                        log::info!(
                                            "Cached completed download: {} -> {:?}",
                                            checksum_val,
                                            cached_path
                                        );
                                    }
                                    Err(e) => {
                                        log::warn!("Failed to cache download: {}", e);
                                    }
                                }
                            }
                        }
                    }
                }
                DownloadEvent::TaskFailed { task_id, error } => {
                    let mgr = manager_clone.read().await;
                    if let Some(task) = mgr.get_task(task_id).await {
                        let record = DownloadRecord::failed(
                            task.url.clone(),
                            task.name.clone(),
                            task.destination.clone(),
                            task.started_at.unwrap_or(task.created_at),
                            error.clone(),
                            task.provider.clone(),
                        );
                        drop(mgr);
                        if let Ok(mut history) = DownloadHistory::open(&cache_dir_clone).await {
                            if let Err(e) = history.add(record).await {
                                log::warn!("Failed to record download history: {}", e);
                            }
                        }
                    }
                }
                DownloadEvent::TaskCancelled { task_id } => {
                    let mgr = manager_clone.read().await;
                    if let Some(task) = mgr.get_task(task_id).await {
                        let record = DownloadRecord::cancelled(
                            task.url.clone(),
                            task.name.clone(),
                            task.destination.clone(),
                            task.progress.downloaded_bytes,
                            task.started_at.unwrap_or(task.created_at),
                            task.provider.clone(),
                        );
                        drop(mgr);
                        if let Ok(mut history) = DownloadHistory::open(&cache_dir_clone).await {
                            if let Err(e) = history.add(record).await {
                                log::warn!("Failed to record download history: {}", e);
                            }
                        }
                    }
                }
                _ => {}
            }
        }
    });

    shared_manager
}

/// Add a new download task
///
/// If the request includes a checksum and the file already exists in the download cache,
/// the cached file is copied to the destination directly (cache-hit shortcut).
/// Returns the task ID on normal download, or `"cache-hit:<checksum>"` if served from cache.
#[tauri::command]
pub async fn download_add(
    request: DownloadRequest,
    manager: State<'_, SharedDownloadManager>,
    settings: State<'_, SharedSettings>,
) -> Result<String, String> {
    let destination = PathBuf::from(&request.destination);

    // Cache-hit shortcut: if checksum provided, check if already cached
    if let Some(ref checksum) = request.checksum {
        if !checksum.is_empty() {
            let s = settings.read().await;
            let cache_dir = s.get_cache_dir();
            drop(s);

            if let Ok(dl_cache) = crate::cache::DownloadCache::open(&cache_dir).await {
                if let Ok(Some(cached_path)) = dl_cache.get_by_checksum(checksum).await {
                    // File is in cache — copy to destination
                    if let Some(parent) = destination.parent() {
                        let _ = tokio::fs::create_dir_all(parent).await;
                    }
                    match tokio::fs::copy(&cached_path, &destination).await {
                        Ok(_) => {
                            log::info!(
                                "Download cache hit: {} -> {:?}",
                                checksum,
                                destination
                            );
                            return Ok(format!("cache-hit:{}", checksum));
                        }
                        Err(e) => {
                            log::warn!(
                                "Cache hit copy failed (falling back to download): {}",
                                e
                            );
                            // Fall through to normal download
                        }
                    }
                }
            }
        }
    }

    let mut builder = DownloadTask::builder(
        request.url,
        destination,
        request.name,
    )
    .with_priority(request.priority.unwrap_or(0));

    if let Some(ref checksum) = request.checksum {
        if !checksum.is_empty() {
            builder = builder.with_checksum(checksum.clone());
        }
    }
    if let Some(ref provider) = request.provider {
        if !provider.is_empty() {
            builder = builder.with_provider(provider.clone());
        }
    }

    let task = builder.build();

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
    settings: State<'_, crate::commands::config::SharedSettings>,
) -> Result<(), String> {
    let mgr = manager.read().await;
    mgr.set_speed_limit(bytes_per_second).await;
    // Persist to config.toml
    let mut s = settings.write().await;
    s.general.download_speed_limit = bytes_per_second;
    let _ = s.save().await;
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
    settings: State<'_, crate::commands::config::SharedSettings>,
) -> Result<(), String> {
    let mgr = manager.read().await;
    mgr.set_max_concurrent(max).await;
    // Persist to config.toml
    let mut s = settings.write().await;
    s.general.parallel_downloads = max as u32;
    let _ = s.save().await;
    Ok(())
}

/// Gracefully shut down the download manager (call on app exit)
#[tauri::command]
pub async fn download_shutdown(
    manager: State<'_, SharedDownloadManager>,
) -> Result<(), String> {
    let mgr = manager.read().await;
    mgr.shutdown().await;
    Ok(())
}

/// Get max concurrent downloads
#[tauri::command]
pub async fn download_get_max_concurrent(
    manager: State<'_, SharedDownloadManager>,
) -> Result<usize, String> {
    let mgr = manager.read().await;
    Ok(mgr.get_max_concurrent().await)
}

/// Verify a downloaded file's checksum
#[tauri::command]
pub async fn download_verify_file(
    path: String,
    expected_checksum: String,
) -> Result<VerifyResult, String> {
    use crate::platform::fs;

    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Ok(VerifyResult {
            valid: false,
            actual_checksum: None,
            expected_checksum: expected_checksum.clone(),
            error: Some("File not found".to_string()),
        });
    }

    match fs::calculate_sha256(&file_path).await {
        Ok(actual) => {
            let valid = actual == expected_checksum;
            Ok(VerifyResult {
                valid,
                actual_checksum: Some(actual),
                expected_checksum,
                error: if !valid {
                    Some("Checksum mismatch".to_string())
                } else {
                    None
                },
            })
        }
        Err(e) => Ok(VerifyResult {
            valid: false,
            actual_checksum: None,
            expected_checksum,
            error: Some(format!("Failed to calculate checksum: {}", e)),
        }),
    }
}

/// Result of file verification
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyResult {
    pub valid: bool,
    pub actual_checksum: Option<String>,
    pub expected_checksum: String,
    pub error: Option<String>,
}

/// Open a downloaded file with the system default application
#[tauri::command]
pub async fn download_open_file(path: String) -> Result<(), String> {
    tauri_plugin_opener::open_path(&path, None::<&str>)
        .map_err(|e| format!("Failed to open file: {}", e))
}

/// Reveal a downloaded file in the system file manager
#[tauri::command]
pub async fn download_reveal_file(path: String) -> Result<(), String> {
    tauri_plugin_opener::reveal_item_in_dir(path)
        .map_err(|e| format!("Failed to reveal file: {}", e))
}

/// Batch pause selected downloads
#[tauri::command]
pub async fn download_batch_pause(
    task_ids: Vec<String>,
    manager: State<'_, SharedDownloadManager>,
) -> Result<usize, String> {
    let mgr = manager.read().await;
    let mut count = 0;
    for task_id in &task_ids {
        if mgr.pause(task_id).await.is_ok() {
            count += 1;
        }
    }
    Ok(count)
}

/// Batch resume selected downloads
#[tauri::command]
pub async fn download_batch_resume(
    task_ids: Vec<String>,
    manager: State<'_, SharedDownloadManager>,
) -> Result<usize, String> {
    let mgr = manager.read().await;
    let mut count = 0;
    for task_id in &task_ids {
        if mgr.resume(task_id).await.is_ok() {
            count += 1;
        }
    }
    Ok(count)
}

/// Batch cancel selected downloads
#[tauri::command]
pub async fn download_batch_cancel(
    task_ids: Vec<String>,
    manager: State<'_, SharedDownloadManager>,
) -> Result<usize, String> {
    let mgr = manager.read().await;
    let mut count = 0;
    for task_id in &task_ids {
        if mgr.cancel(task_id).await.is_ok() {
            count += 1;
        }
    }
    Ok(count)
}

/// Batch remove selected downloads
#[tauri::command]
pub async fn download_batch_remove(
    task_ids: Vec<String>,
    manager: State<'_, SharedDownloadManager>,
) -> Result<usize, String> {
    let mgr = manager.read().await;
    let mut count = 0;
    for task_id in &task_ids {
        if mgr.remove(task_id).await.is_some() {
            count += 1;
        }
    }
    Ok(count)
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


#[cfg(test)]
mod tests {
    use super::*;
    use crate::download::DownloadTask;

    #[test]
    fn test_format_size() {
        assert_eq!(format_size(0), "0 B");
        assert_eq!(format_size(512), "512 B");
        assert_eq!(format_size(1024), "1.00 KB");
        assert_eq!(format_size(1024 * 1024), "1.00 MB");
        assert_eq!(format_size(1024 * 1024 * 1024), "1.00 GB");
        assert_eq!(format_size(2 * 1024 * 1024 * 1024), "2.00 GB");
    }

    #[test]
    fn test_download_task_info_from() {
        let task = DownloadTask::new(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test File".to_string(),
        );

        let info = DownloadTaskInfo::from(&task);

        assert_eq!(info.id, task.id);
        assert_eq!(info.url, "https://example.com/file.zip");
        assert_eq!(info.name, "Test File");
        assert_eq!(info.state, "queued");
        assert!(info.error.is_none());
        assert!(info.provider.is_none());
        assert!(!info.created_at.is_empty());
        assert!(info.started_at.is_none());
        assert!(info.completed_at.is_none());
    }

    #[test]
    fn test_download_task_info_from_with_progress() {
        let mut task = DownloadTask::new(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test File".to_string(),
        );
        task.mark_started();
        task.update_progress(500, Some(1000), 100.0);

        let info = DownloadTaskInfo::from(&task);

        assert_eq!(info.state, "downloading");
        assert_eq!(info.progress.downloaded_bytes, 500);
        assert_eq!(info.progress.total_bytes, Some(1000));
        assert_eq!(info.progress.percent, 50.0);
        assert!(info.started_at.is_some());
    }

    #[test]
    fn test_download_task_info_from_failed() {
        let mut task = DownloadTask::new(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test File".to_string(),
        );
        task.mark_failed(crate::download::DownloadError::Network {
            message: "Connection reset".to_string(),
        });

        let info = DownloadTaskInfo::from(&task);

        assert_eq!(info.state, "failed");
        assert!(info.error.is_some());
    }

    #[test]
    fn test_download_task_info_from_completed() {
        let mut task = DownloadTask::new(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test File".to_string(),
        );
        task.mark_started();
        task.mark_completed();

        let info = DownloadTaskInfo::from(&task);

        assert_eq!(info.state, "completed");
        assert!(info.started_at.is_some());
        assert!(info.completed_at.is_some());
    }

    #[test]
    fn test_download_task_info_from_with_provider() {
        let task = DownloadTask::builder(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test File".to_string(),
        )
        .with_provider("github:user/repo".to_string())
        .build();

        let info = DownloadTaskInfo::from(&task);
        assert_eq!(info.provider, Some("github:user/repo".to_string()));
    }

    #[test]
    fn test_verify_result_valid() {
        let result = VerifyResult {
            valid: true,
            actual_checksum: Some("abc123".to_string()),
            expected_checksum: "abc123".to_string(),
            error: None,
        };

        assert!(result.valid);
        assert_eq!(result.actual_checksum, Some("abc123".to_string()));
        assert!(result.error.is_none());
    }

    #[test]
    fn test_verify_result_invalid() {
        let result = VerifyResult {
            valid: false,
            actual_checksum: Some("def456".to_string()),
            expected_checksum: "abc123".to_string(),
            error: None,
        };

        assert!(!result.valid);
        assert_ne!(result.actual_checksum.as_deref(), Some("abc123"));
    }

    #[test]
    fn test_verify_result_error() {
        let result = VerifyResult {
            valid: false,
            actual_checksum: None,
            expected_checksum: "abc123".to_string(),
            error: Some("File not found".to_string()),
        };

        assert!(!result.valid);
        assert!(result.actual_checksum.is_none());
        assert!(result.error.is_some());
    }

    #[test]
    fn test_history_record_info_from() {
        let record = DownloadRecord {
            id: "rec-1".to_string(),
            url: "https://example.com/file.zip".to_string(),
            filename: "file.zip".to_string(),
            destination: PathBuf::from("/tmp/file.zip"),
            size: 1024 * 1024,
            checksum: Some("abc123".to_string()),
            started_at: chrono::Utc::now(),
            completed_at: chrono::Utc::now(),
            duration_secs: 10,
            average_speed: 102400.0,
            status: DownloadStatus::Completed,
            error: None,
            provider: Some("github".to_string()),
            metadata: std::collections::HashMap::new(),
        };

        let info = HistoryRecordInfo::from(&record);

        assert_eq!(info.id, "rec-1");
        assert_eq!(info.url, "https://example.com/file.zip");
        assert_eq!(info.filename, "file.zip");
        assert_eq!(info.size, 1024 * 1024);
        assert_eq!(info.checksum, Some("abc123".to_string()));
        assert_eq!(info.duration_secs, 10);
        assert_eq!(info.status, "completed");
        assert!(info.error.is_none());
        assert_eq!(info.provider, Some("github".to_string()));
        assert!(!info.size_human.is_empty());
        assert!(!info.speed_human.is_empty());
        assert!(!info.duration_human.is_empty());
    }

    #[test]
    fn test_history_record_info_from_failed() {
        let record = DownloadRecord {
            id: "rec-2".to_string(),
            url: "https://example.com/file.zip".to_string(),
            filename: "file.zip".to_string(),
            destination: PathBuf::from("/tmp/file.zip"),
            size: 0,
            checksum: None,
            started_at: chrono::Utc::now(),
            completed_at: chrono::Utc::now(),
            duration_secs: 5,
            average_speed: 0.0,
            status: DownloadStatus::Failed,
            error: Some("Network error".to_string()),
            provider: None,
            metadata: std::collections::HashMap::new(),
        };

        let info = HistoryRecordInfo::from(&record);

        assert_eq!(info.status, "failed");
        assert_eq!(info.error, Some("Network error".to_string()));
    }

    #[test]
    fn test_history_record_info_from_cancelled() {
        let record = DownloadRecord {
            id: "rec-3".to_string(),
            url: "https://example.com/file.zip".to_string(),
            filename: "file.zip".to_string(),
            destination: PathBuf::from("/tmp/file.zip"),
            size: 500,
            checksum: None,
            started_at: chrono::Utc::now(),
            completed_at: chrono::Utc::now(),
            duration_secs: 2,
            average_speed: 250.0,
            status: DownloadStatus::Cancelled,
            error: None,
            provider: None,
            metadata: std::collections::HashMap::new(),
        };

        let info = HistoryRecordInfo::from(&record);
        assert_eq!(info.status, "cancelled");
    }

    #[test]
    fn test_history_stats_info_from() {
        let stats = HistoryStats {
            total_count: 100,
            completed_count: 80,
            failed_count: 15,
            cancelled_count: 5,
            total_bytes: 1024 * 1024 * 500,
            average_speed: 1024.0 * 100.0,
        };

        let info = HistoryStatsInfo::from(stats);

        assert_eq!(info.total_count, 100);
        assert_eq!(info.completed_count, 80);
        assert_eq!(info.failed_count, 15);
        assert_eq!(info.cancelled_count, 5);
        assert_eq!(info.total_bytes, 1024 * 1024 * 500);
        assert!(!info.total_bytes_human.is_empty());
        assert!(!info.average_speed_human.is_empty());
        assert_eq!(info.success_rate, 80.0);
    }

    #[test]
    fn test_history_stats_info_from_empty() {
        let stats = HistoryStats {
            total_count: 0,
            completed_count: 0,
            failed_count: 0,
            cancelled_count: 0,
            total_bytes: 0,
            average_speed: 0.0,
        };

        let info = HistoryStatsInfo::from(stats);

        assert_eq!(info.total_count, 0);
        assert_eq!(info.success_rate, 0.0);
    }

    #[test]
    fn test_download_request_deserialization() {
        let json = r#"{
            "url": "https://example.com/file.zip",
            "destination": "/tmp/file.zip",
            "name": "Test File",
            "checksum": "abc123",
            "priority": 5,
            "provider": "github"
        }"#;

        let request: DownloadRequest = serde_json::from_str(json).unwrap();

        assert_eq!(request.url, "https://example.com/file.zip");
        assert_eq!(request.destination, "/tmp/file.zip");
        assert_eq!(request.name, "Test File");
        assert_eq!(request.checksum, Some("abc123".to_string()));
        assert_eq!(request.priority, Some(5));
        assert_eq!(request.provider, Some("github".to_string()));
    }

    #[test]
    fn test_download_request_minimal() {
        let json = r#"{
            "url": "https://example.com/file.zip",
            "destination": "/tmp/file.zip",
            "name": "Test File"
        }"#;

        let request: DownloadRequest = serde_json::from_str(json).unwrap();

        assert_eq!(request.url, "https://example.com/file.zip");
        assert!(request.checksum.is_none());
        assert!(request.priority.is_none());
        assert!(request.provider.is_none());
    }

    #[test]
    fn test_download_task_info_serialization() {
        let task = DownloadTask::new(
            "https://example.com/file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            "Test File".to_string(),
        );

        let info = DownloadTaskInfo::from(&task);
        let json = serde_json::to_string(&info).unwrap();
        let deserialized: DownloadTaskInfo = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.id, info.id);
        assert_eq!(deserialized.url, info.url);
        assert_eq!(deserialized.name, info.name);
        assert_eq!(deserialized.state, info.state);
    }

    #[test]
    fn test_queue_stats_info_serialization() {
        let info = QueueStatsInfo {
            total_tasks: 5,
            queued: 2,
            downloading: 1,
            paused: 1,
            completed: 1,
            failed: 0,
            cancelled: 0,
            total_bytes: 10000,
            downloaded_bytes: 5000,
            total_human: "10 KB".to_string(),
            downloaded_human: "5 KB".to_string(),
            overall_progress: 50.0,
        };

        let json = serde_json::to_string(&info).unwrap();
        let deserialized: QueueStatsInfo = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.total_tasks, 5);
        assert_eq!(deserialized.overall_progress, 50.0);
    }
}
