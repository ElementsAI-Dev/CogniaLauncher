//! WSL (Windows Subsystem for Linux) module.
//!
//! Provides read-only access to WSL distribution information.
//! Only functional on Windows; returns empty/false on other platforms.

use crate::host;
use crate::types::*;
use extism_pdk::*;

/// Check if WSL is available. Requires: wsl_read
pub fn is_available() -> Result<bool, Error> {
    let result = unsafe { host::cognia_wsl_is_available(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// Get WSL status. Requires: wsl_read
pub fn status() -> Result<WslStatus, Error> {
    let result = unsafe { host::cognia_wsl_status(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// Get WSL version information. Requires: wsl_read
pub fn get_version_info() -> Result<WslVersionInfo, Error> {
    let result = unsafe { host::cognia_wsl_get_version_info(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// List installed WSL distributions. Requires: wsl_read
pub fn list_distros() -> Result<Vec<WslDistro>, Error> {
    let result = unsafe { host::cognia_wsl_list_distros(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// List running WSL distributions. Requires: wsl_read
pub fn list_running() -> Result<Vec<WslDistro>, Error> {
    let result = unsafe { host::cognia_wsl_list_running(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// List available online distributions. Requires: wsl_read
pub fn list_online() -> Result<Vec<WslOnlineDistro>, Error> {
    let result = unsafe { host::cognia_wsl_list_online(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// Get IP address for a distribution. Requires: wsl_read
pub fn get_ip(distro: &str) -> Result<Option<String>, Error> {
    let input = serde_json::json!({ "distro": distro }).to_string();
    let result = unsafe { host::cognia_wsl_get_ip(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Get disk usage for a distribution. Requires: wsl_read
pub fn disk_usage(distro: &str) -> Result<WslDiskUsage, Error> {
    let input = serde_json::json!({ "distro": distro }).to_string();
    let result = unsafe { host::cognia_wsl_disk_usage(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Execute a command in a WSL distribution. Requires: wsl_read + process_exec
pub fn exec(distro: &str, command: &str) -> Result<ProcessResult, Error> {
    let input = serde_json::json!({ "distro": distro, "command": command }).to_string();
    let result = unsafe { host::cognia_wsl_exec(input)? };
    Ok(serde_json::from_str(&result)?)
}
