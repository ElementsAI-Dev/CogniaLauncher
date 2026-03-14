//! Shell / terminal information module.
//!
//! Provides read-only access to shell detection, profiles, and framework information.

use crate::host;
use crate::types::*;
use extism_pdk::*;
use std::collections::HashMap;

/// Detect installed shells. Requires: shell_read
pub fn detect_shells() -> Result<Vec<DetectedShell>, Error> {
    let result = unsafe { host::cognia_shell_detect_shells(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// List terminal profiles. Requires: shell_read
pub fn list_profiles() -> Result<Vec<ShellProfile>, Error> {
    let result = unsafe { host::cognia_shell_list_profiles(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// Get the default terminal profile. Requires: shell_read
pub fn get_default_profile() -> Result<Option<ShellProfile>, Error> {
    let result = unsafe { host::cognia_shell_get_default_profile(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// Get a terminal profile by ID. Requires: shell_read
pub fn get_profile(id: &str) -> Result<Option<ShellProfile>, Error> {
    let input = serde_json::json!({ "id": id }).to_string();
    let result = unsafe { host::cognia_shell_get_profile(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Get detailed shell information. Requires: shell_read
pub fn get_shell_info(shell: &str) -> Result<ShellInfo, Error> {
    let input = serde_json::json!({ "shell": shell }).to_string();
    let result = unsafe { host::cognia_shell_get_info(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Get environment variables for a shell. Requires: shell_read
pub fn get_env_vars(shell: Option<&str>) -> Result<HashMap<String, String>, Error> {
    let input = serde_json::json!({ "shell": shell }).to_string();
    let result = unsafe { host::cognia_shell_get_env_vars(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Check shell health. Requires: shell_read
pub fn check_health(shell: Option<&str>) -> Result<ShellHealthReport, Error> {
    let input = serde_json::json!({ "shell": shell }).to_string();
    let result = unsafe { host::cognia_shell_check_health(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Detect shell framework (oh-my-zsh, etc). Requires: shell_read
pub fn detect_framework(shell: &str) -> Result<Option<ShellFramework>, Error> {
    let input = serde_json::json!({ "shell": shell }).to_string();
    let result = unsafe { host::cognia_shell_detect_framework(input)? };
    Ok(serde_json::from_str(&result)?)
}
