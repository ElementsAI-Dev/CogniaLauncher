use crate::host;
use crate::types::{CacheInfo, PlatformInfo};
use extism_pdk::*;

/// Get platform information (OS, arch, hostname, version).
pub fn info() -> Result<PlatformInfo, Error> {
    let result = unsafe { host::cognia_platform_info(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// Get cache directory info and total size.
pub fn cache_info() -> Result<CacheInfo, Error> {
    let result = unsafe { host::cognia_cache_info(String::new())? };
    Ok(serde_json::from_str(&result)?)
}
