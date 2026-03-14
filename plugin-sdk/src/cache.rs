//! Cache management module.
//!
//! Provides access to cache inspection, statistics, and cleanup.

use crate::host;
use crate::types::*;
use extism_pdk::*;

/// Get detailed cache info. Requires: cache_read
pub fn info() -> Result<CacheDetailInfo, Error> {
    let result = unsafe { host::cognia_cache_detail_info(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// List cache entries. Requires: cache_read
pub fn list_entries(cache_type: Option<&str>) -> Result<Vec<CacheEntry>, Error> {
    let input = serde_json::json!({ "cacheType": cache_type }).to_string();
    let result = unsafe { host::cognia_cache_list_entries(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Get cache access statistics. Requires: cache_read
pub fn get_access_stats() -> Result<CacheAccessStats, Error> {
    let result = unsafe { host::cognia_cache_get_access_stats(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// Get cleanup history records. Requires: cache_read
pub fn get_cleanup_history() -> Result<Vec<CacheCleanupRecord>, Error> {
    let result = unsafe { host::cognia_cache_get_cleanup_history(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// Discover external caches. Requires: cache_read
pub fn discover_external() -> Result<Vec<ExternalCache>, Error> {
    let result = unsafe { host::cognia_cache_discover_external(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// Get paths for all known external caches. Requires: cache_read
pub fn get_external_paths() -> Result<Vec<ExternalCachePath>, Error> {
    let result = unsafe { host::cognia_cache_get_external_paths(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// Preview what a cache clean operation would remove. Requires: cache_read
pub fn clean_preview(cache_type: &str) -> Result<CacheCleanPreview, Error> {
    let input = serde_json::json!({ "cacheType": cache_type }).to_string();
    let result = unsafe { host::cognia_cache_clean_preview(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Clean cache by type. Requires: cache_write
pub fn clean(cache_type: &str) -> Result<CacheCleanResult, Error> {
    let input = serde_json::json!({ "cacheType": cache_type }).to_string();
    let result = unsafe { host::cognia_cache_clean(input)? };
    Ok(serde_json::from_str(&result)?)
}
