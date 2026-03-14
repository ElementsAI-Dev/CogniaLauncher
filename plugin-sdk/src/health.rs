//! Health check module.
//!
//! Provides access to system and environment health diagnostics.

use crate::host;
use crate::types::*;
use extism_pdk::*;

/// Run a full system health check. Requires: health_read
pub fn check_all() -> Result<HealthReport, Error> {
    let result = unsafe { host::cognia_health_check_all(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// Check a specific environment type. Requires: health_read
pub fn check_environment(env_type: &str) -> Result<HealthReport, Error> {
    let input = serde_json::json!({ "envType": env_type }).to_string();
    let result = unsafe { host::cognia_health_check_environment(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Check all package managers. Requires: health_read
pub fn check_package_managers() -> Result<HealthReport, Error> {
    let result = unsafe { host::cognia_health_check_package_managers(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// Check a specific package manager. Requires: health_read
pub fn check_package_manager(provider: &str) -> Result<HealthReport, Error> {
    let input = serde_json::json!({ "provider": provider }).to_string();
    let result = unsafe { host::cognia_health_check_package_manager(input)? };
    Ok(serde_json::from_str(&result)?)
}
