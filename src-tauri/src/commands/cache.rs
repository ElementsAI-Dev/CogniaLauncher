use crate::cache::{
    external, migration, CacheAccessStats, CacheEntryType, CleanupHistory, CleanupRecord,
    CleanupRecordBuilder, CombinedCacheStats, DownloadCache, DownloadResumer,
    ExternalCacheCleanResult, ExternalCacheInfo, MetadataCache, MigrationMode, MigrationResult,
    MigrationValidation,
};
use crate::config::Settings;
use crate::platform::{disk, disk::format_size, fs};
use chrono::{TimeZone, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::RwLock;

/// Event payload for cache state changes
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CacheChangedEvent {
    action: String,
    freed_bytes: u64,
    freed_human: String,
}

fn emit_cache_changed(app: &AppHandle, action: &str, freed_bytes: u64) {
    let _ = app.emit(
        "cache-changed",
        CacheChangedEvent {
            action: action.to_string(),
            freed_bytes,
            freed_human: format_size(freed_bytes),
        },
    );
}

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
    app: AppHandle,
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

    let clean_type_str = clean_type.as_deref().unwrap_or("all");
    let max_age = Duration::from_secs(max_age_days as u64 * 86400);

    let mut resumer = DownloadResumer::new(&cache_dir.join("downloads"))
        .await
        .map_err(|e| e.to_string())?;

    // Build history record before cleaning
    let mut builder = CleanupRecordBuilder::new(clean_type_str, false);
    build_cleanup_record(
        &mut builder,
        &download_cache,
        &metadata_cache,
        &mut resumer,
        clean_type_str,
        max_age,
    )
    .await?;
    let record = builder.build();
    let deleted_count = record.file_count;

    let (dl_freed, md_freed) = match clean_type_str {
        "downloads" => {
            let freed = download_cache.clean().await.map_err(|e| e.to_string())?;
            (freed, 0)
        }
        "metadata" => {
            let md_size_before = metadata_cache
                .stats()
                .await
                .map_err(|e| e.to_string())?
                .total_size;
            let _count = metadata_cache
                .clean_all()
                .await
                .map_err(|e| e.to_string())?;
            (0, md_size_before)
        }
        "expired" => {
            let md_freed = measure_metadata_expired_size(&metadata_cache).await?;
            let dl_freed = download_cache
                .clean_expired(max_age)
                .await
                .map_err(|e| e.to_string())?;
            let _count = metadata_cache
                .clean_expired()
                .await
                .map_err(|e| e.to_string())?;
            (dl_freed, md_freed)
        }
        _ => {
            let dl = download_cache.clean().await.map_err(|e| e.to_string())?;
            let md_size_before = metadata_cache
                .stats()
                .await
                .map_err(|e| e.to_string())?
                .total_size;
            let _md = metadata_cache
                .clean_all()
                .await
                .map_err(|e| e.to_string())?;
            (dl, md_size_before)
        }
    };

    let partial_freed = match clean_type_str {
        "metadata" => 0,
        "expired" => clean_partials(&mut resumer, max_age).await?,
        _ => clean_partials(&mut resumer, Duration::from_secs(0)).await?,
    };

    let total_freed = dl_freed + md_freed + partial_freed;

    // Record in cleanup history (was previously missing)
    if deleted_count > 0 {
        if let Ok(mut history) = CleanupHistory::open(&cache_dir).await {
            let _ = history.add(record).await;
        }
    }

    emit_cache_changed(&app, "clean", total_freed);

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
    let metadata_cache_ttl = s.general.metadata_cache_ttl as i64;
    drop(s);

    let download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;
    let metadata_cache = MetadataCache::open_with_ttl(&cache_dir, metadata_cache_ttl)
        .await
        .map_err(|e| e.to_string())?;

    let dl_entries = download_cache
        .preview_clean()
        .await
        .map_err(|e| e.to_string())?;
    let md_entries = metadata_cache
        .preview_clean()
        .await
        .map_err(|e| e.to_string())?;

    let mut details: Vec<CacheIssue> = Vec::new();
    let mut valid_entries = 0usize;
    let mut missing_files = 0usize;
    let mut corrupted_files = 0usize;
    let mut size_mismatches = 0usize;

    // Verify download cache entries (full checksum verification)
    for entry in dl_entries {
        if !fs::exists(&entry.file_path).await {
            missing_files += 1;
            details.push(CacheIssue {
                entry_key: entry.key,
                issue_type: "missing".to_string(),
                description: "File not found on disk".to_string(),
            });
            continue;
        }

        let actual_size = fs::file_size(&entry.file_path).await.unwrap_or(entry.size);
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

    // Verify metadata cache entries (existence + size check)
    for entry in md_entries {
        if !fs::exists(&entry.file_path).await {
            missing_files += 1;
            details.push(CacheIssue {
                entry_key: format!("metadata:{}", entry.key),
                issue_type: "missing".to_string(),
                description: "Metadata file not found on disk".to_string(),
            });
            continue;
        }

        let actual_size = fs::file_size(&entry.file_path).await.unwrap_or(entry.size);
        if actual_size != entry.size {
            size_mismatches += 1;
            details.push(CacheIssue {
                entry_key: format!("metadata:{}", entry.key),
                issue_type: "size_mismatch".to_string(),
                description: format!("Expected {} bytes, got {} bytes", entry.size, actual_size),
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
    app: AppHandle,
    settings: State<'_, SharedSettings>,
) -> Result<CacheRepairResult, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    let metadata_cache_ttl = s.general.metadata_cache_ttl as i64;
    drop(s);

    let mut download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;
    let mut metadata_cache = MetadataCache::open_with_ttl(&cache_dir, metadata_cache_ttl)
        .await
        .map_err(|e| e.to_string())?;

    let dl_entries = download_cache
        .preview_clean()
        .await
        .map_err(|e| e.to_string())?;
    let md_entries = metadata_cache
        .preview_clean()
        .await
        .map_err(|e| e.to_string())?;

    let mut removed_entries = 0usize;
    let mut recovered_entries = 0usize;
    let mut freed_bytes = 0u64;

    // Repair download cache entries
    for entry in dl_entries {
        let exists = fs::exists(&entry.file_path).await;
        let actual_size = if exists {
            fs::file_size(&entry.file_path).await.unwrap_or(entry.size)
        } else {
            0
        };

        if !exists {
            // File missing: remove orphaned DB record
            let _ = download_cache
                .remove(&entry.checksum)
                .await
                .map_err(|e| e.to_string())?;
            removed_entries += 1;
            continue;
        }

        if actual_size != entry.size {
            // Size mismatch: remove entry and corrupted file
            freed_bytes += actual_size;
            let _ = download_cache
                .remove(&entry.checksum)
                .await
                .map_err(|e| e.to_string())?;
            removed_entries += 1;
            continue;
        }

        // Verify checksum
        match fs::calculate_sha256(&entry.file_path).await {
            Ok(actual_checksum) if actual_checksum != entry.checksum => {
                // Corrupted checksum in DB: re-register with correct checksum so the entry stays valid
                let _ = download_cache.remove(&entry.checksum).await;
                match download_cache
                    .add_file(&entry.file_path, &actual_checksum)
                    .await
                {
                    Ok(_) => {
                        recovered_entries += 1;
                    }
                    Err(_) => {
                        removed_entries += 1;
                        freed_bytes += actual_size;
                    }
                }
            }
            Err(_) => {
                // Cannot verify: remove
                freed_bytes += actual_size;
                let _ = download_cache
                    .remove(&entry.checksum)
                    .await
                    .map_err(|e| e.to_string())?;
                removed_entries += 1;
            }
            _ => {
                // Valid entry, no action needed
            }
        }
    }

    // Repair metadata cache entries (remove orphaned records where file is missing)
    for entry in md_entries {
        if !fs::exists(&entry.file_path).await {
            // preview_clean returns keys with "metadata:" prefix; remove() adds it again,
            // so we strip the prefix to avoid double-prefixing
            let raw_key = entry.key.strip_prefix("metadata:").unwrap_or(&entry.key);
            let _ = metadata_cache
                .remove(raw_key)
                .await
                .map_err(|e| e.to_string())?;
            removed_entries += 1;
        }
    }

    emit_cache_changed(&app, "repair", freed_bytes);

    Ok(CacheRepairResult {
        removed_entries,
        recovered_entries,
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
    #[serde(default = "default_threshold")]
    pub auto_clean_threshold: u8,
    #[serde(default = "default_monitor_interval")]
    pub monitor_interval: u64,
    #[serde(default)]
    pub monitor_external: bool,
}

fn default_threshold() -> u8 {
    80
}
fn default_monitor_interval() -> u64 {
    300
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
        auto_clean_threshold: s.general.cache_auto_clean_threshold,
        monitor_interval: s.general.cache_monitor_interval,
        monitor_external: s.general.cache_monitor_external,
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
    s.general.cache_auto_clean_threshold = new_settings.auto_clean_threshold;
    s.general.cache_monitor_interval = new_settings.monitor_interval;
    s.general.cache_monitor_external = new_settings.monitor_external;
    s.save().await.map_err(|e| e.to_string())?;
    Ok(())
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
        builder.add_file(partial.file_path.display().to_string(), size, "partial");
    }
    Ok(())
}

async fn fs_clean_path(
    cache_path: &Option<PathBuf>,
    preserve_dir: bool,
    use_trash: bool,
) -> Result<(), String> {
    if let Some(ref path) = cache_path {
        if !path.exists() {
            return Ok(());
        }
        if preserve_dir {
            external::clean_cache_contents_public(path, use_trash)
                .await
                .map_err(|e| e.to_string())
        } else if use_trash {
            fs::remove_dir_with_option(path, true)
                .await
                .map_err(|e| e.to_string())
        } else {
            fs::remove_dir_all(path).await.map_err(|e| e.to_string())
        }
    } else {
        Ok(())
    }
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

/// Shared helper: build cleanup record for any clean type (avoids duplication across cache_clean / cache_clean_enhanced / cache_force_clean)
async fn build_cleanup_record(
    builder: &mut CleanupRecordBuilder,
    download_cache: &DownloadCache,
    metadata_cache: &MetadataCache,
    resumer: &mut DownloadResumer,
    clean_type: &str,
    max_age: Duration,
) -> Result<(), String> {
    match clean_type {
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
            append_partial_record(builder, resumer, Duration::from_secs(0)).await?;
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
            append_partial_record(builder, resumer, max_age).await?;
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
            append_partial_record(builder, resumer, Duration::from_secs(0)).await?;
        }
    }
    Ok(())
}

/// Accurately measure expired metadata size by summing actual entry sizes (replaces inaccurate proportional estimation)
async fn measure_metadata_expired_size(metadata_cache: &MetadataCache) -> Result<u64, String> {
    let expired_entries = metadata_cache
        .preview_expired()
        .await
        .map_err(|e| e.to_string())?;
    Ok(expired_entries.iter().map(|e| e.size).sum())
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
            total_size +=
                append_partial_preview(&mut files, &mut resumer, Duration::from_secs(0)).await?;
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
            total_size +=
                append_partial_preview(&mut files, &mut resumer, Duration::from_secs(0)).await?;
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
    app: AppHandle,
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

    // Open caches once (no double-open)
    let mut download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;
    let mut metadata_cache = MetadataCache::open_with_ttl(&cache_dir, metadata_cache_ttl)
        .await
        .map_err(|e| e.to_string())?;
    let mut resumer = DownloadResumer::new(&cache_dir.join("downloads"))
        .await
        .map_err(|e| e.to_string())?;

    // Build history record using shared helper
    let mut builder = CleanupRecordBuilder::new(clean_type_str, use_trash);
    build_cleanup_record(
        &mut builder,
        &download_cache,
        &metadata_cache,
        &mut resumer,
        clean_type_str,
        max_age,
    )
    .await?;
    let record = builder.build();
    let history_id = record.id.clone();
    let deleted_count = record.file_count;

    let (dl_freed, md_freed) = match clean_type_str {
        "downloads" => {
            let freed = download_cache
                .clean_with_option(use_trash)
                .await
                .map_err(|e| e.to_string())?;
            (freed, 0)
        }
        "metadata" => {
            let md_size_before = metadata_cache
                .stats()
                .await
                .map_err(|e| e.to_string())?
                .total_size;
            let _count = metadata_cache
                .clean_all_with_option(use_trash)
                .await
                .map_err(|e| e.to_string())?;
            (0, md_size_before)
        }
        "expired" => {
            let md_freed = measure_metadata_expired_size(&metadata_cache).await?;
            let dl_freed = download_cache
                .clean_expired_with_option(max_age, use_trash)
                .await
                .map_err(|e| e.to_string())?;
            let _count = metadata_cache
                .clean_expired_with_option(use_trash)
                .await
                .map_err(|e| e.to_string())?;
            (dl_freed, md_freed)
        }
        _ => {
            let dl = download_cache
                .clean_with_option(use_trash)
                .await
                .map_err(|e| e.to_string())?;
            let md_size_before = metadata_cache
                .stats()
                .await
                .map_err(|e| e.to_string())?
                .total_size;
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

    emit_cache_changed(&app, "clean_enhanced", total_freed);

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
pub async fn clear_cleanup_history(settings: State<'_, SharedSettings>) -> Result<usize, String> {
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

// ==================== Cache Access Stats ====================

/// Get cache access statistics (hit rate, hits, misses)
#[tauri::command]
pub async fn get_cache_access_stats(
    settings: State<'_, SharedSettings>,
) -> Result<CacheAccessStats, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    drop(s);

    let download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    Ok(download_cache.get_access_stats())
}

/// Reset cache access statistics
#[tauri::command]
pub async fn reset_cache_access_stats(settings: State<'_, SharedSettings>) -> Result<(), String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    drop(s);

    let download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    download_cache
        .reset_access_stats()
        .await
        .map_err(|e| e.to_string())
}

// ==================== Cache Entry Browser ====================

/// A cache entry item for the browser view
#[derive(Serialize)]
pub struct CacheEntryItem {
    pub key: String,
    pub file_path: String,
    pub size: u64,
    pub size_human: String,
    pub checksum: String,
    pub entry_type: String,
    pub created_at: String,
    pub last_accessed: Option<String>,
    pub hit_count: u32,
}

/// Result of listing cache entries
#[derive(Serialize)]
pub struct CacheEntryList {
    pub entries: Vec<CacheEntryItem>,
    pub total_count: usize,
    pub has_more: bool,
}

/// List cache entries with filtering, sorting, and pagination
#[tauri::command]
pub async fn list_cache_entries(
    entry_type: Option<String>,
    search: Option<String>,
    sort_by: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
    settings: State<'_, SharedSettings>,
) -> Result<CacheEntryList, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    drop(s);

    let download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    let entry_type_filter = entry_type.as_deref().and_then(|t| match t {
        "download" => Some(CacheEntryType::Download),
        "metadata" => Some(CacheEntryType::Metadata),
        "partial" => Some(CacheEntryType::Partial),
        "index" => Some(CacheEntryType::Index),
        _ => None,
    });

    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);

    let (entries, total_count) = download_cache
        .list_filtered(
            entry_type_filter,
            search.as_deref(),
            sort_by.as_deref(),
            limit,
            offset,
        )
        .await
        .map_err(|e| e.to_string())?;

    let items: Vec<CacheEntryItem> = entries
        .into_iter()
        .map(|e| CacheEntryItem {
            key: e.key,
            file_path: e.file_path.display().to_string(),
            size: e.size,
            size_human: format_size(e.size),
            checksum: e.checksum,
            entry_type: match e.entry_type {
                CacheEntryType::Download => "download".to_string(),
                CacheEntryType::Metadata => "metadata".to_string(),
                CacheEntryType::Partial => "partial".to_string(),
                CacheEntryType::Index => "index".to_string(),
            },
            created_at: e.created_at.to_rfc3339(),
            last_accessed: e.last_accessed.map(|d| d.to_rfc3339()),
            hit_count: e.hit_count,
        })
        .collect();

    Ok(CacheEntryList {
        has_more: offset + items.len() < total_count,
        entries: items,
        total_count,
    })
}

/// Delete a single cache entry by key
#[tauri::command]
pub async fn delete_cache_entry(
    key: String,
    use_trash: Option<bool>,
    settings: State<'_, SharedSettings>,
) -> Result<bool, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    drop(s);

    let mut download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    download_cache
        .remove_with_option(&key, use_trash.unwrap_or(false))
        .await
        .map_err(|e| e.to_string())
}

/// Delete multiple cache entries by keys
#[tauri::command]
pub async fn delete_cache_entries(
    keys: Vec<String>,
    use_trash: Option<bool>,
    settings: State<'_, SharedSettings>,
) -> Result<usize, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    drop(s);

    let mut download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    let use_trash = use_trash.unwrap_or(false);
    let mut deleted = 0;

    for key in keys {
        if download_cache
            .remove_with_option(&key, use_trash)
            .await
            .is_ok()
        {
            deleted += 1;
        }
    }

    Ok(deleted)
}

// ==================== Hot Files (Top Accessed) ====================

/// Get top accessed cache entries
#[tauri::command]
pub async fn get_top_accessed_entries(
    limit: Option<usize>,
    settings: State<'_, SharedSettings>,
) -> Result<Vec<CacheEntryItem>, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    drop(s);

    let download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    let entries = download_cache
        .get_top_accessed(limit.unwrap_or(10))
        .await
        .map_err(|e| e.to_string())?;

    let items: Vec<CacheEntryItem> = entries
        .into_iter()
        .map(|e| CacheEntryItem {
            key: e.key,
            file_path: e.file_path.display().to_string(),
            size: e.size,
            size_human: format_size(e.size),
            checksum: e.checksum,
            entry_type: match e.entry_type {
                CacheEntryType::Download => "download".to_string(),
                CacheEntryType::Metadata => "metadata".to_string(),
                CacheEntryType::Partial => "partial".to_string(),
                CacheEntryType::Index => "index".to_string(),
            },
            created_at: e.created_at.to_rfc3339(),
            last_accessed: e.last_accessed.map(|d| d.to_rfc3339()),
            hit_count: e.hit_count,
        })
        .collect();

    Ok(items)
}

// ============================================================================
// External Cache Management Commands
// ============================================================================

/// Discover all external package manager caches on the system
#[tauri::command]
pub async fn discover_external_caches() -> Result<Vec<ExternalCacheInfo>, String> {
    external::discover_all_caches()
        .await
        .map_err(|e| e.to_string())
}

/// Clean cache for a specific external package manager
#[tauri::command]
pub async fn clean_external_cache(
    provider: String,
    use_trash: bool,
) -> Result<ExternalCacheCleanResult, String> {
    external::clean_cache(&provider, use_trash)
        .await
        .map_err(|e| e.to_string())
}

/// Clean all external package manager caches
#[tauri::command]
pub async fn clean_all_external_caches(
    use_trash: bool,
) -> Result<Vec<ExternalCacheCleanResult>, String> {
    external::clean_all_caches(use_trash)
        .await
        .map_err(|e| e.to_string())
}

/// Get combined cache statistics (internal + external)
#[tauri::command]
pub async fn get_combined_cache_stats(
    settings: State<'_, SharedSettings>,
) -> Result<CombinedCacheStats, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    drop(s);

    // Get internal cache size
    let download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    let download_stats = download_cache.stats().await.map_err(|e| e.to_string())?;
    let internal_size = download_stats.total_size;

    // Get combined stats
    external::get_combined_stats(internal_size)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Cache Size Monitoring
// ============================================================================

/// Real-time cache size monitoring result
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheSizeMonitor {
    pub internal_size: u64,
    pub internal_size_human: String,
    pub external_size: u64,
    pub external_size_human: String,
    pub total_size: u64,
    pub total_size_human: String,
    pub max_size: u64,
    pub max_size_human: String,
    pub usage_percent: f32,
    pub threshold: u8,
    pub exceeds_threshold: bool,
    pub disk_total: u64,
    pub disk_available: u64,
    pub disk_available_human: String,
    pub external_caches: Vec<ExternalCacheSizeInfo>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalCacheSizeInfo {
    pub provider: String,
    pub display_name: String,
    pub size: u64,
    pub size_human: String,
    pub cache_path: String,
}

/// Get comprehensive cache size monitoring data
#[tauri::command]
pub async fn cache_size_monitor(
    include_external: Option<bool>,
    settings: State<'_, SharedSettings>,
) -> Result<CacheSizeMonitor, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    let max_size = s.general.cache_max_size;
    let threshold = s.general.cache_auto_clean_threshold;
    let include_ext = include_external.unwrap_or(s.general.cache_monitor_external);
    drop(s);

    // Get internal cache size
    let download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;
    let dl_stats = download_cache.stats().await.map_err(|e| e.to_string())?;
    let internal_size = dl_stats.total_size;

    // Get external cache sizes if requested
    let (external_size, external_caches) = if include_ext {
        let caches = external::discover_all_caches()
            .await
            .map_err(|e| e.to_string())?;
        let ext_size: u64 = caches.iter().map(|c| c.size).sum();
        let ext_info: Vec<ExternalCacheSizeInfo> = caches
            .into_iter()
            .filter(|c| c.size > 0)
            .map(|c| ExternalCacheSizeInfo {
                provider: c.provider,
                display_name: c.display_name,
                size: c.size,
                size_human: c.size_human,
                cache_path: c.cache_path,
            })
            .collect();
        (ext_size, ext_info)
    } else {
        (0, Vec::new())
    };

    let total_size = internal_size + external_size;
    let usage_percent = if max_size > 0 {
        (internal_size as f64 / max_size as f64 * 100.0) as f32
    } else {
        0.0
    };

    let exceeds_threshold = threshold > 0 && usage_percent >= threshold as f32;

    // Get disk space info
    let (disk_total, disk_available) = match disk::get_disk_space(&cache_dir).await {
        Ok(space) => (space.total, space.available),
        Err(_) => (0, 0),
    };

    Ok(CacheSizeMonitor {
        internal_size,
        internal_size_human: format_size(internal_size),
        external_size,
        external_size_human: format_size(external_size),
        total_size,
        total_size_human: format_size(total_size),
        max_size,
        max_size_human: format_size(max_size),
        usage_percent,
        threshold,
        exceeds_threshold,
        disk_total,
        disk_available,
        disk_available_human: format_size(disk_available),
        external_caches,
    })
}

// ============================================================================
// Cache Path Management
// ============================================================================

/// Get current cache path info
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CachePathInfo {
    pub current_path: String,
    pub default_path: String,
    pub is_custom: bool,
    pub is_symlink: bool,
    pub symlink_target: Option<String>,
    pub exists: bool,
    pub writable: bool,
    pub disk_total: u64,
    pub disk_available: u64,
    pub disk_available_human: String,
}

#[tauri::command]
pub async fn get_cache_path_info(
    settings: State<'_, SharedSettings>,
) -> Result<CachePathInfo, String> {
    let s = settings.read().await;
    let current_path = s.get_cache_dir();
    let default_path = s.get_root_dir().join("cache");
    let is_custom = s.paths.cache.is_some();
    drop(s);

    let exists = fs::exists(&current_path).await;

    // Check if it's a symlink
    let (is_symlink, symlink_target) = if exists {
        match tokio::fs::symlink_metadata(&current_path).await {
            Ok(meta) if meta.file_type().is_symlink() => {
                let target = tokio::fs::read_link(&current_path)
                    .await
                    .ok()
                    .map(|p| p.display().to_string());
                (true, target)
            }
            _ => (false, None),
        }
    } else {
        (false, None)
    };

    // Check writability
    let writable = if exists {
        let test_file = current_path.join(".cognia_write_test");
        match tokio::fs::write(&test_file, b"test").await {
            Ok(_) => {
                let _ = tokio::fs::remove_file(&test_file).await;
                true
            }
            Err(_) => false,
        }
    } else {
        false
    };

    // Disk space
    let (disk_total, disk_available) = if exists {
        match disk::get_disk_space(&current_path).await {
            Ok(space) => (space.total, space.available),
            Err(_) => (0, 0),
        }
    } else {
        (0, 0)
    };

    Ok(CachePathInfo {
        current_path: current_path.display().to_string(),
        default_path: default_path.display().to_string(),
        is_custom,
        is_symlink,
        symlink_target,
        exists,
        writable,
        disk_total,
        disk_available,
        disk_available_human: format_size(disk_available),
    })
}

/// Change cache directory path (does NOT migrate data)
#[tauri::command]
pub async fn set_cache_path(
    new_path: String,
    settings: State<'_, SharedSettings>,
) -> Result<(), String> {
    let path = PathBuf::from(&new_path);

    // Validate the path
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            return Err("Parent directory does not exist".to_string());
        }
    }

    // Create the directory if it doesn't exist
    fs::create_dir_all(&path)
        .await
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    // Test writability
    let test_file = path.join(".cognia_write_test");
    tokio::fs::write(&test_file, b"test")
        .await
        .map_err(|_| "Destination path is not writable".to_string())?;
    let _ = tokio::fs::remove_file(&test_file).await;

    // Update settings
    let mut s = settings.write().await;
    s.paths.cache = if new_path.is_empty() {
        None
    } else {
        Some(path)
    };
    s.save().await.map_err(|e| e.to_string())?;

    Ok(())
}

/// Reset cache path to default
#[tauri::command]
pub async fn reset_cache_path(settings: State<'_, SharedSettings>) -> Result<String, String> {
    let mut s = settings.write().await;
    s.paths.cache = None;
    s.save().await.map_err(|e| e.to_string())?;
    let default_path = s.get_cache_dir();
    Ok(default_path.display().to_string())
}

// ============================================================================
// Cache Migration Commands
// ============================================================================

/// Validate migration before executing
#[tauri::command]
pub async fn cache_migration_validate(
    destination: String,
    settings: State<'_, SharedSettings>,
) -> Result<MigrationValidation, String> {
    let s = settings.read().await;
    let source = s.get_cache_dir();
    drop(s);

    let dest = PathBuf::from(&destination);
    migration::validate_migration(&source, &dest)
        .await
        .map_err(|e| e.to_string())
}

/// Execute cache migration
#[tauri::command]
pub async fn cache_migrate(
    destination: String,
    mode: String,
    app: AppHandle,
    settings: State<'_, SharedSettings>,
) -> Result<MigrationResult, String> {
    let s = settings.read().await;
    let source = s.get_cache_dir();
    drop(s);

    let dest = PathBuf::from(&destination);
    let migration_mode = match mode.as_str() {
        "move" => MigrationMode::Move,
        "move_and_link" => MigrationMode::MoveAndLink,
        _ => {
            return Err(format!(
                "Invalid migration mode: {}. Use 'move' or 'move_and_link'",
                mode
            ))
        }
    };

    let result = migration::migrate_cache(&source, &dest, migration_mode)
        .await
        .map_err(|e| e.to_string())?;

    // If migration succeeded with Move mode, update the config to point to new path
    if result.success && migration_mode == MigrationMode::Move {
        let mut s = settings.write().await;
        s.paths.cache = Some(dest);
        if let Err(e) = s.save().await {
            // Migration succeeded but config save failed - warn but don't fail
            log::warn!("Cache migrated but config update failed: {}", e);
        }
    }
    // For MoveAndLink mode, the old path still works via symlink, no config change needed

    if result.success {
        emit_cache_changed(&app, "migrate", result.bytes_migrated);
    }

    Ok(result)
}

// ============================================================================
// Force Clean Commands
// ============================================================================

/// Force clean all internal caches (ignores age/size limits, deletes everything)
#[tauri::command]
pub async fn cache_force_clean(
    use_trash: Option<bool>,
    app: AppHandle,
    settings: State<'_, SharedSettings>,
) -> Result<EnhancedCleanResult, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    let metadata_cache_ttl = s.general.metadata_cache_ttl as i64;
    drop(s);

    let use_trash = use_trash.unwrap_or(false);

    // Open caches once (no double-open)
    let mut download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;
    let mut metadata_cache = MetadataCache::open_with_ttl(&cache_dir, metadata_cache_ttl)
        .await
        .map_err(|e| e.to_string())?;
    let mut resumer = DownloadResumer::new(&cache_dir.join("downloads"))
        .await
        .map_err(|e| e.to_string())?;

    // Build history record using shared helper
    let mut builder = CleanupRecordBuilder::new("force_all", use_trash);
    build_cleanup_record(
        &mut builder,
        &download_cache,
        &metadata_cache,
        &mut resumer,
        "all",
        Duration::from_secs(0),
    )
    .await?;
    let record = builder.build();
    let history_id = record.id.clone();
    let deleted_count = record.file_count;

    let dl_freed = download_cache
        .clean_with_option(use_trash)
        .await
        .map_err(|e| e.to_string())?;

    let md_size_before = metadata_cache
        .stats()
        .await
        .map_err(|e| e.to_string())?
        .total_size;
    let _md = metadata_cache
        .clean_all_with_option(use_trash)
        .await
        .map_err(|e| e.to_string())?;

    // Clean all partial downloads (resumer already opened above)
    let partial_freed =
        clean_partials_with_option(&mut resumer, Duration::from_secs(0), use_trash).await?;

    let total_freed = dl_freed + md_size_before + partial_freed;

    // Save history
    let mut history = CleanupHistory::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;
    history.add(record).await.map_err(|e| e.to_string())?;

    emit_cache_changed(&app, "force_clean", total_freed);

    Ok(EnhancedCleanResult {
        freed_bytes: total_freed,
        freed_human: format_size(total_freed),
        deleted_count,
        use_trash,
        history_id,
    })
}

/// Force clean a specific external cache provider via command or direct delete
#[tauri::command]
pub async fn cache_force_clean_external(
    provider: String,
    use_command: Option<bool>,
    use_trash: Option<bool>,
) -> Result<ExternalCacheCleanResult, String> {
    let provider_enum = external::ExternalCacheProvider::from_str(&provider)
        .ok_or_else(|| format!("Unknown provider: {}", provider))?;

    let use_command = use_command.unwrap_or(true);
    let use_trash = use_trash.unwrap_or(false);

    let cache_path = provider_enum.cache_path();
    let size_before = if let Some(ref path) = cache_path {
        external::calculate_dir_size(path).await
    } else {
        0
    };

    let preserve_dir = provider_enum.should_preserve_dir();

    // Use command if requested and available, otherwise filesystem clean
    let clean_result = if use_command {
        if let Some((cmd, args)) = provider_enum.clean_command() {
            match crate::platform::process::execute(cmd, args, None).await {
                Ok(output) if output.success => Ok(()),
                Ok(output) => Err(format!("Command failed: {}", output.stderr)),
                Err(e) => Err(format!("Command error: {}", e)),
            }
        } else {
            fs_clean_path(&cache_path, preserve_dir, use_trash).await
        }
    } else {
        fs_clean_path(&cache_path, preserve_dir, use_trash).await
    };

    let size_after = if let Some(ref path) = cache_path {
        external::calculate_dir_size(path).await
    } else {
        0
    };
    let freed = size_before.saturating_sub(size_after);

    match clean_result {
        Ok(()) => Ok(ExternalCacheCleanResult {
            provider: provider_enum.id().to_string(),
            display_name: provider_enum.display_name().to_string(),
            freed_bytes: freed,
            freed_human: format_size(freed),
            success: true,
            error: None,
        }),
        Err(e) => Ok(ExternalCacheCleanResult {
            provider: provider_enum.id().to_string(),
            display_name: provider_enum.display_name().to_string(),
            freed_bytes: freed,
            freed_human: format_size(freed),
            success: false,
            error: Some(e),
        }),
    }
}

// ============================================================================
// External Cache Path Query
// ============================================================================

/// Get detailed path info for a specific external cache provider
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalCachePathInfo {
    pub provider: String,
    pub display_name: String,
    pub cache_path: Option<String>,
    pub exists: bool,
    pub size: u64,
    pub size_human: String,
    pub is_available: bool,
    pub has_clean_command: bool,
    pub clean_command: Option<String>,
    pub env_vars_checked: Vec<String>,
}

/// Get path info for all external cache providers
#[tauri::command]
pub async fn get_external_cache_paths() -> Result<Vec<ExternalCachePathInfo>, String> {
    let mut results = Vec::new();

    for provider in external::ExternalCacheProvider::all() {
        let cache_path = provider.cache_path();
        let exists = cache_path.as_ref().map(|p| p.exists()).unwrap_or(false);
        let size = if let Some(ref p) = cache_path {
            if exists {
                external::calculate_dir_size(p).await
            } else {
                0
            }
        } else {
            0
        };

        let is_available = external::is_provider_available(provider).await;

        let clean_cmd = provider
            .clean_command()
            .map(|(cmd, args)| format!("{} {}", cmd, args.join(" ")));
        let has_clean_command = clean_cmd.is_some();

        // Get environment variables that were checked for this provider
        let env_vars = get_provider_env_vars(provider);

        results.push(ExternalCachePathInfo {
            provider: provider.id().to_string(),
            display_name: provider.display_name().to_string(),
            cache_path: cache_path.map(|p| p.display().to_string()),
            exists,
            size,
            size_human: format_size(size),
            is_available,
            has_clean_command,
            clean_command: clean_cmd,
            env_vars_checked: env_vars,
        });
    }

    Ok(results)
}

/// Get environment variables checked for a provider's cache path
fn get_provider_env_vars(provider: external::ExternalCacheProvider) -> Vec<String> {
    match provider {
        external::ExternalCacheProvider::Npm => vec!["npm_config_cache".into()],
        external::ExternalCacheProvider::Pnpm => vec!["PNPM_STORE_DIR".into()],
        external::ExternalCacheProvider::Yarn => vec!["YARN_CACHE_FOLDER".into()],
        external::ExternalCacheProvider::Pip => vec!["PIP_CACHE_DIR".into()],
        external::ExternalCacheProvider::Uv => vec!["UV_CACHE_DIR".into()],
        external::ExternalCacheProvider::Cargo => vec!["CARGO_HOME".into()],
        external::ExternalCacheProvider::Bundler => vec!["BUNDLE_PATH".into()],
        external::ExternalCacheProvider::Go => vec!["GOMODCACHE".into(), "GOPATH".into()],
        external::ExternalCacheProvider::Dotnet => vec!["NUGET_PACKAGES".into()],
        external::ExternalCacheProvider::Composer => vec!["COMPOSER_CACHE_DIR".into()],
        external::ExternalCacheProvider::Poetry => vec!["POETRY_CACHE_DIR".into()],
        external::ExternalCacheProvider::Conda => vec!["CONDA_PKGS_DIRS".into()],
        external::ExternalCacheProvider::Deno => vec!["DENO_DIR".into()],
        external::ExternalCacheProvider::Bun => {
            vec!["BUN_INSTALL_CACHE_DIR".into(), "BUN_INSTALL".into()]
        }
        external::ExternalCacheProvider::Gradle => vec!["GRADLE_USER_HOME".into()],
        external::ExternalCacheProvider::Maven => vec!["MAVEN_REPO_LOCAL".into()],
        external::ExternalCacheProvider::Gem => vec!["GEM_HOME".into()],
        external::ExternalCacheProvider::Rustup => vec!["RUSTUP_HOME".into()],
        #[cfg(not(windows))]
        external::ExternalCacheProvider::Brew => vec!["HOMEBREW_CACHE".into()],
        #[cfg(windows)]
        external::ExternalCacheProvider::Scoop => vec!["SCOOP".into()],
        #[cfg(windows)]
        external::ExternalCacheProvider::Chocolatey => vec!["ChocolateyInstall".into()],
        external::ExternalCacheProvider::Flutter => vec!["PUB_CACHE".into()],
        external::ExternalCacheProvider::Cypress => vec!["CYPRESS_CACHE_FOLDER".into()],
        external::ExternalCacheProvider::Electron => vec!["ELECTRON_CACHE".into()],
        external::ExternalCacheProvider::Vcpkg => vec!["VCPKG_DEFAULT_BINARY_CACHE".into()],
        external::ExternalCacheProvider::Sbt => vec!["SBT_IVY_HOME".into()],
        _ => vec![],
    }
}

// ============================================================================
// Enhanced Cache Settings (with threshold & monitoring)
// ============================================================================

/// Enhanced cache settings with monitoring fields
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnhancedCacheSettings {
    pub max_size: u64,
    pub max_age_days: u32,
    pub metadata_cache_ttl: u64,
    pub auto_clean: bool,
    pub auto_clean_threshold: u8,
    pub monitor_interval: u64,
    pub monitor_external: bool,
}

#[tauri::command]
pub async fn get_enhanced_cache_settings(
    settings: State<'_, SharedSettings>,
) -> Result<EnhancedCacheSettings, String> {
    let s = settings.read().await;
    Ok(EnhancedCacheSettings {
        max_size: s.general.cache_max_size,
        max_age_days: s.general.cache_max_age_days,
        metadata_cache_ttl: s.general.metadata_cache_ttl,
        auto_clean: s.general.auto_clean_cache,
        auto_clean_threshold: s.general.cache_auto_clean_threshold,
        monitor_interval: s.general.cache_monitor_interval,
        monitor_external: s.general.cache_monitor_external,
    })
}

#[tauri::command]
pub async fn set_enhanced_cache_settings(
    new_settings: EnhancedCacheSettings,
    settings: State<'_, SharedSettings>,
) -> Result<(), String> {
    let mut s = settings.write().await;
    s.general.cache_max_size = new_settings.max_size;
    s.general.cache_max_age_days = new_settings.max_age_days;
    s.general.metadata_cache_ttl = new_settings.metadata_cache_ttl;
    s.general.auto_clean_cache = new_settings.auto_clean;
    s.general.cache_auto_clean_threshold = new_settings.auto_clean_threshold;
    s.general.cache_monitor_interval = new_settings.monitor_interval;
    s.general.cache_monitor_external = new_settings.monitor_external;
    s.save().await.map_err(|e| e.to_string())?;
    Ok(())
}
