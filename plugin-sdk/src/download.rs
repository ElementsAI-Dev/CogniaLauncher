//! Download management module.
//!
//! Provides access to the download manager for adding, tracking, and controlling downloads.

use crate::host;
use crate::types::*;
use extism_pdk::*;

/// List all active download tasks. Requires: download_read
pub fn list() -> Result<Vec<DownloadTask>, Error> {
    let result = unsafe { host::cognia_download_list(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// Get a specific download task by ID. Requires: download_read
pub fn get(id: &str) -> Result<Option<DownloadTask>, Error> {
    let input = serde_json::json!({ "id": id }).to_string();
    let result = unsafe { host::cognia_download_get(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Get download queue statistics. Requires: download_read
pub fn stats() -> Result<DownloadStats, Error> {
    let result = unsafe { host::cognia_download_stats(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// List download history entries. Requires: download_read
pub fn history_list(limit: Option<u32>, offset: Option<u32>) -> Result<Vec<DownloadHistoryEntry>, Error> {
    let input = serde_json::json!({ "limit": limit, "offset": offset }).to_string();
    let result = unsafe { host::cognia_download_history_list(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Search download history. Requires: download_read
pub fn history_search(query: &str) -> Result<Vec<DownloadHistoryEntry>, Error> {
    let input = serde_json::json!({ "query": query }).to_string();
    let result = unsafe { host::cognia_download_history_search(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Get download history statistics. Requires: download_read
pub fn history_stats() -> Result<DownloadHistoryStats, Error> {
    let result = unsafe { host::cognia_download_history_stats(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// Add a new download task. Returns task ID. Requires: download_write + http domain check
pub fn add(url: &str, filename: Option<&str>, directory: Option<&str>) -> Result<String, Error> {
    let input = serde_json::json!({
        "url": url,
        "filename": filename,
        "directory": directory,
    }).to_string();
    let result = unsafe { host::cognia_download_add(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Pause a download task. Requires: download_write
pub fn pause(id: &str) -> Result<(), Error> {
    let input = serde_json::json!({ "id": id }).to_string();
    unsafe { host::cognia_download_pause(input)?; }
    Ok(())
}

/// Resume a download task. Requires: download_write
pub fn resume(id: &str) -> Result<(), Error> {
    let input = serde_json::json!({ "id": id }).to_string();
    unsafe { host::cognia_download_resume(input)?; }
    Ok(())
}

/// Cancel a download task. Requires: download_write
pub fn cancel(id: &str) -> Result<(), Error> {
    let input = serde_json::json!({ "id": id }).to_string();
    unsafe { host::cognia_download_cancel(input)?; }
    Ok(())
}

/// Verify a downloaded file's checksum. Requires: download_read
pub fn verify_file(path: &str, expected_hash: &str, algorithm: Option<&str>) -> Result<DownloadVerifyResult, Error> {
    let input = serde_json::json!({
        "path": path,
        "expectedHash": expected_hash,
        "algorithm": algorithm.unwrap_or("sha256"),
    }).to_string();
    let result = unsafe { host::cognia_download_verify(input)? };
    Ok(serde_json::from_str(&result)?)
}
