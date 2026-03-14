//! Batch operations module.
//!
//! Provides batch install, uninstall, update, history, and pinning.

use crate::host;
use crate::types::*;
use extism_pdk::*;

/// Batch install packages. Requires: pkg_install
pub fn batch_install(items: &[BatchItem]) -> Result<BatchResult, Error> {
    let input = serde_json::json!({ "items": items }).to_string();
    let result = unsafe { host::cognia_batch_install(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Batch uninstall packages. Requires: pkg_install
pub fn batch_uninstall(items: &[BatchItem]) -> Result<BatchResult, Error> {
    let input = serde_json::json!({ "items": items }).to_string();
    let result = unsafe { host::cognia_batch_uninstall(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Batch update packages. Requires: pkg_install
pub fn batch_update(items: &[BatchItem]) -> Result<BatchResult, Error> {
    let input = serde_json::json!({ "items": items }).to_string();
    let result = unsafe { host::cognia_batch_update(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Check for updates across packages. Requires: pkg_search
pub fn check_updates(packages: &[&str], provider: &str) -> Result<Vec<UpdateInfo>, Error> {
    let input = serde_json::json!({ "packages": packages, "provider": provider }).to_string();
    let result = unsafe { host::cognia_batch_check_updates(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Get package operation history. Requires: pkg_search
pub fn get_history(limit: Option<u32>) -> Result<Vec<PackageHistoryEntry>, Error> {
    let input = serde_json::json!({ "limit": limit }).to_string();
    let result = unsafe { host::cognia_batch_get_history(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Get list of pinned packages. Requires: pkg_search
pub fn get_pinned_packages() -> Result<Vec<PinnedPackage>, Error> {
    let result = unsafe { host::cognia_batch_get_pinned(String::new())? };
    Ok(serde_json::from_str(&result)?)
}
