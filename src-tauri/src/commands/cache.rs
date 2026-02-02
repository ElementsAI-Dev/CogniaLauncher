use crate::cache::{
    CleanupHistory, CleanupRecord, CleanupRecordBuilder,
    DownloadCache, EnhancedCache, MetadataCache,
};
use crate::config::Settings;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tauri::State;
use tokio::sync::RwLock;

pub type SharedSettings = Arc<RwLock<Settings>>;

#[derive(Serialize)]
pub struct CacheInfo {
    pub download_cache: CacheStatsInfo,
    pub metadata_cache: CacheStatsInfo,
    pub total_size: u64,
    pub total_size_human: String,
    pub max_size: Option<u64>,
    pub max_size_human: Option<String>,
    pub usage_percent: Option<u8>,
}

#[derive(Serialize)]
pub struct CacheStatsInfo {
    pub entry_count: usize,
    pub size: u64,
    pub size_human: String,
    pub location: String,
}

#[tauri::command]
pub async fn cache_info(settings: State<'_, SharedSettings>) -> Result<CacheInfo, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();

    let download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;
    let metadata_cache = MetadataCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    let dl_stats = download_cache.stats().await;
    let md_stats = metadata_cache.stats();

    let total = dl_stats.total_size + md_stats.total_size;

    Ok(CacheInfo {
        download_cache: CacheStatsInfo {
            entry_count: dl_stats.entry_count,
            size: dl_stats.total_size,
            size_human: dl_stats.size_human(),
            location: dl_stats.location.display().to_string(),
        },
        metadata_cache: CacheStatsInfo {
            entry_count: md_stats.entry_count,
            size: md_stats.total_size,
            size_human: format_size(md_stats.total_size),
            location: md_stats.location.display().to_string(),
        },
        total_size: total,
        total_size_human: format_size(total),
        max_size: Some(s.general.cache_max_size),
        max_size_human: Some(format_size(s.general.cache_max_size)),
        usage_percent: if s.general.cache_max_size > 0 {
            Some((total as f64 / s.general.cache_max_size as f64 * 100.0) as u8)
        } else {
            None
        },
    })
}

#[tauri::command]
pub async fn cache_clean(
    clean_type: Option<String>,
    settings: State<'_, SharedSettings>,
) -> Result<CleanResult, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();

    let mut download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;
    let mut metadata_cache = MetadataCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    let clean_type = clean_type.as_deref().unwrap_or("all");

    let (dl_freed, md_freed) = match clean_type {
        "downloads" => {
            let freed = download_cache.clean().await.map_err(|e| e.to_string())?;
            (freed, 0)
        }
        "metadata" => {
            let md_size_before = metadata_cache.stats().total_size;
            let _count = metadata_cache
                .clean_all()
                .await
                .map_err(|e| e.to_string())?;
            (0, md_size_before)
        }
        "expired" => {
            let md_stats = metadata_cache.stats();
            let expired_size = md_stats.total_size * md_stats.expired_count as u64 
                / md_stats.entry_count.max(1) as u64;
            let _count = metadata_cache
                .clean_expired()
                .await
                .map_err(|e| e.to_string())?;
            (0, expired_size)
        }
        _ => {
            let dl = download_cache.clean().await.map_err(|e| e.to_string())?;
            let md_size_before = metadata_cache.stats().total_size;
            let _md = metadata_cache
                .clean_all()
                .await
                .map_err(|e| e.to_string())?;
            (dl, md_size_before)
        }
    };

    let total_freed = dl_freed + md_freed;

    Ok(CleanResult {
        freed_bytes: total_freed,
        freed_human: format_size(total_freed),
    })
}

#[derive(Serialize)]
pub struct CleanResult {
    pub freed_bytes: u64,
    pub freed_human: String,
}

/// Verify cache integrity
#[derive(Serialize)]
pub struct CacheVerificationResult {
    pub valid_entries: usize,
    pub missing_files: usize,
    pub corrupted_files: usize,
    pub size_mismatches: usize,
    pub is_healthy: bool,
    pub details: Vec<CacheIssue>,
}

#[derive(Serialize)]
pub struct CacheIssue {
    pub entry_key: String,
    pub issue_type: String,
    pub description: String,
}

#[tauri::command]
pub async fn cache_verify(
    settings: State<'_, SharedSettings>,
) -> Result<CacheVerificationResult, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    let max_size = s.general.cache_max_size;
    let max_age_days = s.general.cache_max_age_days;
    drop(s);

    let mut enhanced_cache = EnhancedCache::open(
        &cache_dir.join("downloads"),
        max_size,
        Duration::from_secs(max_age_days as u64 * 86400),
    )
    .await
    .map_err(|e| e.to_string())?;

    let result = enhanced_cache.verify().await.map_err(|e| e.to_string())?;

    let mut details: Vec<CacheIssue> = Vec::new();

    for key in &result.missing {
        details.push(CacheIssue {
            entry_key: key.clone(),
            issue_type: "missing".to_string(),
            description: "File not found on disk".to_string(),
        });
    }

    for (key, expected, actual) in &result.size_mismatch {
        details.push(CacheIssue {
            entry_key: key.clone(),
            issue_type: "size_mismatch".to_string(),
            description: format!("Expected {} bytes, got {} bytes", expected, actual),
        });
    }

    for key in &result.checksum_mismatch {
        details.push(CacheIssue {
            entry_key: key.clone(),
            issue_type: "checksum_mismatch".to_string(),
            description: "File content has been corrupted".to_string(),
        });
    }

    Ok(CacheVerificationResult {
        valid_entries: result.valid,
        missing_files: result.missing.len(),
        corrupted_files: result.checksum_mismatch.len(),
        size_mismatches: result.size_mismatch.len(),
        is_healthy: result.is_valid(),
        details,
    })
}

/// Repair cache by removing invalid entries
#[derive(Serialize)]
pub struct CacheRepairResult {
    pub removed_entries: usize,
    pub recovered_entries: usize,
    pub freed_bytes: u64,
    pub freed_human: String,
}

#[tauri::command]
pub async fn cache_repair(
    settings: State<'_, SharedSettings>,
) -> Result<CacheRepairResult, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    let max_size = s.general.cache_max_size;
    let max_age_days = s.general.cache_max_age_days;
    drop(s);

    let mut enhanced_cache = EnhancedCache::open(
        &cache_dir.join("downloads"),
        max_size,
        Duration::from_secs(max_age_days as u64 * 86400),
    )
    .await
    .map_err(|e| e.to_string())?;

    let repair_result = enhanced_cache.repair().await.map_err(|e| e.to_string())?;

    Ok(CacheRepairResult {
        removed_entries: repair_result.removed,
        recovered_entries: repair_result.recovered,
        freed_bytes: repair_result.freed_bytes,
        freed_human: format_size(repair_result.freed_bytes),
    })
}

/// Get cache settings
#[derive(Serialize, Deserialize)]
pub struct CacheSettings {
    pub max_size: u64,
    pub max_age_days: u32,
    pub auto_clean: bool,
}

#[tauri::command]
pub async fn get_cache_settings(
    settings: State<'_, SharedSettings>,
) -> Result<CacheSettings, String> {
    let s = settings.read().await;
    Ok(CacheSettings {
        max_size: s.general.cache_max_size,
        max_age_days: s.general.cache_max_age_days,
        auto_clean: s.general.auto_clean_cache,
    })
}

#[tauri::command]
pub async fn set_cache_settings(
    new_settings: CacheSettings,
    settings: State<'_, SharedSettings>,
) -> Result<(), String> {
    let mut s = settings.write().await;
    s.general.cache_max_size = new_settings.max_size;
    s.general.cache_max_age_days = new_settings.max_age_days;
    s.general.auto_clean_cache = new_settings.auto_clean;
    s.save().await.map_err(|e| e.to_string())?;
    Ok(())
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

// ==================== Clean Preview ====================

/// Preview item for cache cleanup
#[derive(Serialize)]
pub struct CleanPreviewItem {
    pub path: String,
    pub size: u64,
    pub size_human: String,
    pub entry_type: String,
    pub created_at: String,
}

/// Preview result for cache cleanup
#[derive(Serialize)]
pub struct CleanPreview {
    pub files: Vec<CleanPreviewItem>,
    pub total_count: usize,
    pub total_size: u64,
    pub total_size_human: String,
}

/// Preview files that would be cleaned without actually deleting them
#[tauri::command]
pub async fn cache_clean_preview(
    clean_type: Option<String>,
    settings: State<'_, SharedSettings>,
) -> Result<CleanPreview, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    drop(s);

    let download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;
    let metadata_cache = MetadataCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    let clean_type = clean_type.as_deref().unwrap_or("all");
    let mut files = Vec::new();
    let mut total_size = 0u64;

    match clean_type {
        "downloads" => {
            for entry in download_cache.preview_clean() {
                total_size += entry.size;
                files.push(CleanPreviewItem {
                    path: entry.file_path.display().to_string(),
                    size: entry.size,
                    size_human: format_size(entry.size),
                    entry_type: "download".to_string(),
                    created_at: entry.created_at.to_rfc3339(),
                });
            }
        }
        "metadata" => {
            for entry in metadata_cache.preview_clean() {
                total_size += entry.size;
                files.push(CleanPreviewItem {
                    path: entry.file_path.display().to_string(),
                    size: entry.size,
                    size_human: format_size(entry.size),
                    entry_type: "metadata".to_string(),
                    created_at: entry.created_at.to_rfc3339(),
                });
            }
        }
        "expired" => {
            for entry in metadata_cache.preview_expired() {
                total_size += entry.size;
                files.push(CleanPreviewItem {
                    path: entry.file_path.display().to_string(),
                    size: entry.size,
                    size_human: format_size(entry.size),
                    entry_type: "metadata".to_string(),
                    created_at: entry.created_at.to_rfc3339(),
                });
            }
        }
        _ => {
            // All
            for entry in download_cache.preview_clean() {
                total_size += entry.size;
                files.push(CleanPreviewItem {
                    path: entry.file_path.display().to_string(),
                    size: entry.size,
                    size_human: format_size(entry.size),
                    entry_type: "download".to_string(),
                    created_at: entry.created_at.to_rfc3339(),
                });
            }
            for entry in metadata_cache.preview_clean() {
                total_size += entry.size;
                files.push(CleanPreviewItem {
                    path: entry.file_path.display().to_string(),
                    size: entry.size,
                    size_human: format_size(entry.size),
                    entry_type: "metadata".to_string(),
                    created_at: entry.created_at.to_rfc3339(),
                });
            }
        }
    }

    let total_count = files.len();

    Ok(CleanPreview {
        files,
        total_count,
        total_size,
        total_size_human: format_size(total_size),
    })
}

// ==================== Enhanced Clean with Trash Support ====================

/// Enhanced clean result with trash support
#[derive(Serialize)]
pub struct EnhancedCleanResult {
    pub freed_bytes: u64,
    pub freed_human: String,
    pub deleted_count: usize,
    pub use_trash: bool,
    pub history_id: String,
}

/// Clean cache with option to move to trash instead of permanent delete
#[tauri::command]
pub async fn cache_clean_enhanced(
    clean_type: Option<String>,
    use_trash: Option<bool>,
    settings: State<'_, SharedSettings>,
) -> Result<EnhancedCleanResult, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    drop(s);

    let use_trash = use_trash.unwrap_or(false);
    let clean_type_str = clean_type.as_deref().unwrap_or("all");

    // Collect files for history before cleaning
    let download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;
    let metadata_cache = MetadataCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    let mut builder = CleanupRecordBuilder::new(clean_type_str, use_trash);

    // Build record based on what will be cleaned
    match clean_type_str {
        "downloads" => {
            for entry in download_cache.preview_clean() {
                builder.add_file(
                    entry.file_path.display().to_string(),
                    entry.size,
                    "download",
                );
            }
        }
        "metadata" => {
            for entry in metadata_cache.preview_clean() {
                builder.add_file(
                    entry.file_path.display().to_string(),
                    entry.size,
                    "metadata",
                );
            }
        }
        "expired" => {
            for entry in metadata_cache.preview_expired() {
                builder.add_file(
                    entry.file_path.display().to_string(),
                    entry.size,
                    "metadata",
                );
            }
        }
        _ => {
            for entry in download_cache.preview_clean() {
                builder.add_file(
                    entry.file_path.display().to_string(),
                    entry.size,
                    "download",
                );
            }
            for entry in metadata_cache.preview_clean() {
                builder.add_file(
                    entry.file_path.display().to_string(),
                    entry.size,
                    "metadata",
                );
            }
        }
    }

    // Build the record before cleaning
    let record = builder.build();
    let history_id = record.id.clone();
    let deleted_count = record.file_count;

    // Now perform the actual cleaning
    let mut download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;
    let mut metadata_cache = MetadataCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    let (dl_freed, md_freed) = match clean_type_str {
        "downloads" => {
            let freed = download_cache
                .clean_with_option(use_trash)
                .await
                .map_err(|e| e.to_string())?;
            (freed, 0)
        }
        "metadata" => {
            let md_size_before = metadata_cache.stats().total_size;
            let _count = metadata_cache
                .clean_all_with_option(use_trash)
                .await
                .map_err(|e| e.to_string())?;
            (0, md_size_before)
        }
        "expired" => {
            let md_stats = metadata_cache.stats();
            let expired_size =
                md_stats.total_size * md_stats.expired_count as u64 / md_stats.entry_count.max(1) as u64;
            let _count = metadata_cache
                .clean_expired_with_option(use_trash)
                .await
                .map_err(|e| e.to_string())?;
            (0, expired_size)
        }
        _ => {
            let dl = download_cache
                .clean_with_option(use_trash)
                .await
                .map_err(|e| e.to_string())?;
            let md_size_before = metadata_cache.stats().total_size;
            let _md = metadata_cache
                .clean_all_with_option(use_trash)
                .await
                .map_err(|e| e.to_string())?;
            (dl, md_size_before)
        }
    };

    let total_freed = dl_freed + md_freed;

    // Save to history
    let mut history = CleanupHistory::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;
    history.add(record).await.map_err(|e| e.to_string())?;

    Ok(EnhancedCleanResult {
        freed_bytes: total_freed,
        freed_human: format_size(total_freed),
        deleted_count,
        use_trash,
        history_id,
    })
}

// ==================== Cleanup History ====================

/// Get cleanup history records
#[tauri::command]
pub async fn get_cleanup_history(
    limit: Option<usize>,
    settings: State<'_, SharedSettings>,
) -> Result<Vec<CleanupRecord>, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    drop(s);

    let history = CleanupHistory::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    Ok(history.list(limit).into_iter().cloned().collect())
}

/// Clear all cleanup history
#[tauri::command]
pub async fn clear_cleanup_history(
    settings: State<'_, SharedSettings>,
) -> Result<usize, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    drop(s);

    let mut history = CleanupHistory::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    history.clear().await.map_err(|e| e.to_string())
}

/// Get cleanup history summary
#[derive(Serialize)]
pub struct CleanupHistorySummary {
    pub total_cleanups: usize,
    pub total_freed_bytes: u64,
    pub total_freed_human: String,
    pub total_files_cleaned: usize,
    pub trash_cleanups: usize,
    pub permanent_cleanups: usize,
}

#[tauri::command]
pub async fn get_cleanup_summary(
    settings: State<'_, SharedSettings>,
) -> Result<CleanupHistorySummary, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    drop(s);

    let history = CleanupHistory::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    let summary = history.summary();

    Ok(CleanupHistorySummary {
        total_cleanups: summary.total_cleanups,
        total_freed_bytes: summary.total_freed_bytes,
        total_freed_human: summary.total_freed_human,
        total_files_cleaned: summary.total_files_cleaned,
        trash_cleanups: summary.trash_cleanups,
        permanent_cleanups: summary.permanent_cleanups,
    })
}
