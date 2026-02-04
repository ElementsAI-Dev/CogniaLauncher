use crate::cache::{
    CleanupHistory, CleanupRecord, CleanupRecordBuilder,
    DownloadCache, DownloadResumer, MetadataCache,
};
use crate::platform::fs;
use crate::config::Settings;
use chrono::{TimeZone, Utc};
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
    let metadata_cache_ttl = s.general.metadata_cache_ttl as i64;

    let download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;
    let metadata_cache = MetadataCache::open_with_ttl(&cache_dir, metadata_cache_ttl)
        .await
        .map_err(|e| e.to_string())?;

    let dl_stats = download_cache.stats().await.map_err(|e| e.to_string())?;
    let md_stats = metadata_cache.stats().await.map_err(|e| e.to_string())?;

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
    let metadata_cache_ttl = s.general.metadata_cache_ttl as i64;
    let max_age_days = s.general.cache_max_age_days;
    drop(s);

    let mut download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;
    let mut metadata_cache = MetadataCache::open_with_ttl(&cache_dir, metadata_cache_ttl)
        .await
        .map_err(|e| e.to_string())?;

    let clean_type = clean_type.as_deref().unwrap_or("all");
    let max_age = Duration::from_secs(max_age_days as u64 * 86400);
    let mut partial_freed = 0u64;

    let mut resumer = DownloadResumer::new(&cache_dir.join("downloads"))
        .await
        .map_err(|e| e.to_string())?;

    let (dl_freed, md_freed) = match clean_type {
        "downloads" => {
            let freed = download_cache.clean().await.map_err(|e| e.to_string())?;
            partial_freed = clean_partials(&mut resumer, Duration::from_secs(0)).await?;
            (freed, 0)
        }
        "metadata" => {
            let md_size_before = metadata_cache.stats().await.map_err(|e| e.to_string())?.total_size;
            let _count = metadata_cache
                .clean_all()
                .await
                .map_err(|e| e.to_string())?;
            (0, md_size_before)
        }
        "expired" => {
            let md_stats = metadata_cache.stats().await.map_err(|e| e.to_string())?;
            let expired_size = md_stats.total_size * md_stats.expired_count as u64
                / md_stats.entry_count.max(1) as u64;
            let dl_freed = download_cache
                .clean_expired(max_age)
                .await
                .map_err(|e| e.to_string())?;
            let _count = metadata_cache
                .clean_expired()
                .await
                .map_err(|e| e.to_string())?;
            partial_freed = clean_partials(&mut resumer, max_age).await?;
            (dl_freed, expired_size)
        }
        _ => {
            let dl = download_cache.clean().await.map_err(|e| e.to_string())?;
            let md_size_before = metadata_cache.stats().await.map_err(|e| e.to_string())?.total_size;
            let _md = metadata_cache
                .clean_all()
                .await
                .map_err(|e| e.to_string())?;
            partial_freed = clean_partials(&mut resumer, Duration::from_secs(0)).await?;
            (dl, md_size_before)
        }
    };

    let total_freed = dl_freed + md_freed + partial_freed;

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
    drop(s);

    let download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;
    let entries = download_cache
        .preview_clean()
        .await
        .map_err(|e| e.to_string())?;

    let mut details: Vec<CacheIssue> = Vec::new();
    let mut valid_entries = 0usize;
    let mut missing_files = 0usize;
    let mut corrupted_files = 0usize;
    let mut size_mismatches = 0usize;

    for entry in entries {
        if !fs::exists(&entry.file_path).await {
            missing_files += 1;
            details.push(CacheIssue {
                entry_key: entry.key,
                issue_type: "missing".to_string(),
                description: "File not found on disk".to_string(),
            });
            continue;
        }

        let actual_size = fs::file_size(&entry.file_path)
            .await
            .unwrap_or(entry.size);
        if actual_size != entry.size {
            size_mismatches += 1;
            details.push(CacheIssue {
                entry_key: entry.key.clone(),
                issue_type: "size_mismatch".to_string(),
                description: format!("Expected {} bytes, got {} bytes", entry.size, actual_size),
            });
            continue;
        }

        let actual_checksum = fs::calculate_sha256(&entry.file_path)
            .await
            .map_err(|e| e.to_string())?;
        if actual_checksum != entry.checksum {
            corrupted_files += 1;
            details.push(CacheIssue {
                entry_key: entry.key,
                issue_type: "checksum_mismatch".to_string(),
                description: "File content has been corrupted".to_string(),
            });
            continue;
        }

        valid_entries += 1;
    }

    Ok(CacheVerificationResult {
        valid_entries,
        missing_files,
        corrupted_files,
        size_mismatches,
        is_healthy: missing_files == 0 && corrupted_files == 0 && size_mismatches == 0,
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
    drop(s);

    let mut download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;
    let entries = download_cache
        .preview_clean()
        .await
        .map_err(|e| e.to_string())?;

    let mut removed_entries = 0usize;
    let mut freed_bytes = 0u64;

    for entry in entries {
        let exists = fs::exists(&entry.file_path).await;
        let actual_size = if exists {
            fs::file_size(&entry.file_path).await.unwrap_or(entry.size)
        } else {
            0
        };

        let mut remove_entry = false;

        if !exists {
            remove_entry = true;
        } else if actual_size != entry.size {
            remove_entry = true;
        } else {
            let actual_checksum = fs::calculate_sha256(&entry.file_path)
                .await
                .map_err(|e| e.to_string())?;
            if actual_checksum != entry.checksum {
                remove_entry = true;
            }
        }

        if remove_entry {
            if exists {
                freed_bytes += actual_size.max(entry.size);
            }
            let _ = download_cache.remove(&entry.checksum).await.map_err(|e| e.to_string())?;
            removed_entries += 1;
        }
    }

    Ok(CacheRepairResult {
        removed_entries,
        recovered_entries: 0,
        freed_bytes,
        freed_human: format_size(freed_bytes),
    })
}

/// Get cache settings
#[derive(Serialize, Deserialize)]
pub struct CacheSettings {
    pub max_size: u64,
    pub max_age_days: u32,
    pub metadata_cache_ttl: u64,
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
        metadata_cache_ttl: s.general.metadata_cache_ttl,
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
    s.general.metadata_cache_ttl = new_settings.metadata_cache_ttl;
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

fn format_timestamp(timestamp: i64) -> String {
    Utc.timestamp_opt(timestamp, 0)
        .single()
        .unwrap_or_else(Utc::now)
        .to_rfc3339()
}

async fn append_partial_preview(
    files: &mut Vec<CleanPreviewItem>,
    resumer: &mut DownloadResumer,
    max_age: Duration,
) -> Result<u64, String> {
    let stale: Vec<_> = resumer.get_stale(max_age).into_iter().cloned().collect();
    let mut total_size = 0u64;

    for partial in stale {
        let size = if fs::exists(&partial.file_path).await {
            fs::file_size(&partial.file_path)
                .await
                .unwrap_or(partial.downloaded_size)
        } else {
            0
        };
        total_size += size;
        files.push(CleanPreviewItem {
            path: partial.file_path.display().to_string(),
            size,
            size_human: format_size(size),
            entry_type: "partial".to_string(),
            created_at: format_timestamp(partial.last_updated),
        });
    }

    Ok(total_size)
}

async fn append_partial_record(
    builder: &mut CleanupRecordBuilder,
    resumer: &mut DownloadResumer,
    max_age: Duration,
) -> Result<(), String> {
    let stale: Vec<_> = resumer.get_stale(max_age).into_iter().cloned().collect();
    for partial in stale {
        let size = if fs::exists(&partial.file_path).await {
            fs::file_size(&partial.file_path)
                .await
                .unwrap_or(partial.downloaded_size)
        } else {
            0
        };
        builder.add_file(
            partial.file_path.display().to_string(),
            size,
            "partial",
        );
    }
    Ok(())
}

async fn clean_partials(resumer: &mut DownloadResumer, max_age: Duration) -> Result<u64, String> {
    clean_partials_with_option(resumer, max_age, false).await
}

async fn clean_partials_with_option(
    resumer: &mut DownloadResumer,
    max_age: Duration,
    use_trash: bool,
) -> Result<u64, String> {
    let stale: Vec<_> = resumer.get_stale(max_age).into_iter().cloned().collect();
    let mut total_size = 0u64;
    for partial in stale {
        let size = if fs::exists(&partial.file_path).await {
            fs::file_size(&partial.file_path)
                .await
                .unwrap_or(partial.downloaded_size)
        } else {
            0
        };
        total_size += size;
    }

    resumer
        .clean_stale_with_option(max_age, use_trash)
        .await
        .map_err(|e| e.to_string())?;
    Ok(total_size)
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
    let max_age_days = s.general.cache_max_age_days;
    let metadata_cache_ttl = s.general.metadata_cache_ttl as i64;
    drop(s);

    let download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;
    let metadata_cache = MetadataCache::open_with_ttl(&cache_dir, metadata_cache_ttl)
        .await
        .map_err(|e| e.to_string())?;
    let max_age = Duration::from_secs(max_age_days as u64 * 86400);

    let mut resumer = DownloadResumer::new(&cache_dir.join("downloads"))
        .await
        .map_err(|e| e.to_string())?;

    let clean_type = clean_type.as_deref().unwrap_or("all");
    let mut files = Vec::new();
    let mut total_size = 0u64;

    match clean_type {
        "downloads" => {
            for entry in download_cache
                .preview_clean()
                .await
                .map_err(|e| e.to_string())?
            {
                total_size += entry.size;
                files.push(CleanPreviewItem {
                    path: entry.file_path.display().to_string(),
                    size: entry.size,
                    size_human: format_size(entry.size),
                    entry_type: "download".to_string(),
                    created_at: entry.created_at.to_rfc3339(),
                });
            }
            total_size += append_partial_preview(&mut files, &mut resumer, Duration::from_secs(0)).await?;
        }
        "metadata" => {
            for entry in metadata_cache
                .preview_clean()
                .await
                .map_err(|e| e.to_string())?
            {
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
            for entry in download_cache
                .preview_expired(max_age)
                .await
                .map_err(|e| e.to_string())?
            {
                total_size += entry.size;
                files.push(CleanPreviewItem {
                    path: entry.file_path.display().to_string(),
                    size: entry.size,
                    size_human: format_size(entry.size),
                    entry_type: "download".to_string(),
                    created_at: entry.created_at.to_rfc3339(),
                });
            }
            for entry in metadata_cache
                .preview_expired()
                .await
                .map_err(|e| e.to_string())?
            {
                total_size += entry.size;
                files.push(CleanPreviewItem {
                    path: entry.file_path.display().to_string(),
                    size: entry.size,
                    size_human: format_size(entry.size),
                    entry_type: "metadata".to_string(),
                    created_at: entry.created_at.to_rfc3339(),
                });
            }
            total_size += append_partial_preview(&mut files, &mut resumer, max_age).await?;
        }
        _ => {
            // All
            for entry in download_cache
                .preview_clean()
                .await
                .map_err(|e| e.to_string())?
            {
                total_size += entry.size;
                files.push(CleanPreviewItem {
                    path: entry.file_path.display().to_string(),
                    size: entry.size,
                    size_human: format_size(entry.size),
                    entry_type: "download".to_string(),
                    created_at: entry.created_at.to_rfc3339(),
                });
            }
            for entry in metadata_cache
                .preview_clean()
                .await
                .map_err(|e| e.to_string())?
            {
                total_size += entry.size;
                files.push(CleanPreviewItem {
                    path: entry.file_path.display().to_string(),
                    size: entry.size,
                    size_human: format_size(entry.size),
                    entry_type: "metadata".to_string(),
                    created_at: entry.created_at.to_rfc3339(),
                });
            }
            total_size += append_partial_preview(&mut files, &mut resumer, Duration::from_secs(0)).await?;
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
    let max_age_days = s.general.cache_max_age_days;
    let metadata_cache_ttl = s.general.metadata_cache_ttl as i64;
    drop(s);

    let use_trash = use_trash.unwrap_or(false);
    let clean_type_str = clean_type.as_deref().unwrap_or("all");
    let max_age = Duration::from_secs(max_age_days as u64 * 86400);

    // Collect files for history before cleaning
    let download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;
    let metadata_cache = MetadataCache::open_with_ttl(&cache_dir, metadata_cache_ttl)
        .await
        .map_err(|e| e.to_string())?;

    let mut resumer = DownloadResumer::new(&cache_dir.join("downloads"))
        .await
        .map_err(|e| e.to_string())?;

    let mut builder = CleanupRecordBuilder::new(clean_type_str, use_trash);

    // Build record based on what will be cleaned
    match clean_type_str {
        "downloads" => {
            for entry in download_cache
                .preview_clean()
                .await
                .map_err(|e| e.to_string())?
            {
                builder.add_file(
                    entry.file_path.display().to_string(),
                    entry.size,
                    "download",
                );
            }
            append_partial_record(&mut builder, &mut resumer, Duration::from_secs(0)).await?;
        }
        "metadata" => {
            for entry in metadata_cache
                .preview_clean()
                .await
                .map_err(|e| e.to_string())?
            {
                builder.add_file(
                    entry.file_path.display().to_string(),
                    entry.size,
                    "metadata",
                );
            }
        }
        "expired" => {
            for entry in download_cache
                .preview_expired(max_age)
                .await
                .map_err(|e| e.to_string())?
            {
                builder.add_file(
                    entry.file_path.display().to_string(),
                    entry.size,
                    "download",
                );
            }
            for entry in metadata_cache
                .preview_expired()
                .await
                .map_err(|e| e.to_string())?
            {
                builder.add_file(
                    entry.file_path.display().to_string(),
                    entry.size,
                    "metadata",
                );
            }
            append_partial_record(&mut builder, &mut resumer, max_age).await?;
        }
        _ => {
            for entry in download_cache
                .preview_clean()
                .await
                .map_err(|e| e.to_string())?
            {
                builder.add_file(
                    entry.file_path.display().to_string(),
                    entry.size,
                    "download",
                );
            }
            for entry in metadata_cache
                .preview_clean()
                .await
                .map_err(|e| e.to_string())?
            {
                builder.add_file(
                    entry.file_path.display().to_string(),
                    entry.size,
                    "metadata",
                );
            }
            append_partial_record(&mut builder, &mut resumer, Duration::from_secs(0)).await?;
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
    let mut metadata_cache = MetadataCache::open_with_ttl(&cache_dir, metadata_cache_ttl)
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
            let md_size_before = metadata_cache.stats().await.map_err(|e| e.to_string())?.total_size;
            let _count = metadata_cache
                .clean_all_with_option(use_trash)
                .await
                .map_err(|e| e.to_string())?;
            (0, md_size_before)
        }
        "expired" => {
            let md_stats = metadata_cache.stats().await.map_err(|e| e.to_string())?;
            let expired_size =
                md_stats.total_size * md_stats.expired_count as u64 / md_stats.entry_count.max(1) as u64;
            let dl_freed = download_cache
                .clean_expired_with_option(max_age, use_trash)
                .await
                .map_err(|e| e.to_string())?;
            let _count = metadata_cache
                .clean_expired_with_option(use_trash)
                .await
                .map_err(|e| e.to_string())?;
            (dl_freed, expired_size)
        }
        _ => {
            let dl = download_cache
                .clean_with_option(use_trash)
                .await
                .map_err(|e| e.to_string())?;
            let md_size_before = metadata_cache.stats().await.map_err(|e| e.to_string())?.total_size;
            let _md = metadata_cache
                .clean_all_with_option(use_trash)
                .await
                .map_err(|e| e.to_string())?;
            (dl, md_size_before)
        }
    };

    let partial_freed = match clean_type_str {
        "metadata" => 0,
        "expired" => clean_partials_with_option(&mut resumer, max_age, use_trash).await?,
        _ => clean_partials_with_option(&mut resumer, Duration::from_secs(0), use_trash).await?,
    };

    let total_freed = dl_freed + md_freed + partial_freed;

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
