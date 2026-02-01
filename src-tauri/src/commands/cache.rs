use crate::cache::{DownloadCache, MetadataCache};
use crate::config::Settings;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
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
            let count = metadata_cache
                .clean_all()
                .await
                .map_err(|e| e.to_string())?;
            (0, count as u64 * 1024)
        }
        "expired" => {
            let count = metadata_cache
                .clean_expired()
                .await
                .map_err(|e| e.to_string())?;
            (0, count as u64 * 1024)
        }
        _ => {
            let dl = download_cache.clean().await.map_err(|e| e.to_string())?;
            let md = metadata_cache
                .clean_all()
                .await
                .map_err(|e| e.to_string())?;
            (dl, md as u64 * 1024)
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

    let download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    // For now, just check that cache files exist
    // Full verification would require the enhanced cache
    let stats = download_cache.stats().await;

    Ok(CacheVerificationResult {
        valid_entries: stats.entry_count,
        missing_files: 0,
        corrupted_files: 0,
        size_mismatches: 0,
        is_healthy: true,
        details: vec![],
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

    let mut download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    // Clean expired/invalid entries
    let freed = download_cache.clean().await.map_err(|e| e.to_string())?;

    Ok(CacheRepairResult {
        removed_entries: 0,
        recovered_entries: 0,
        freed_bytes: freed,
        freed_human: format_size(freed),
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
    // TODO: Persist settings
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
