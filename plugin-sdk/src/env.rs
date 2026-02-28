use crate::host;
use crate::types::{EnvDetectResult, EnvEntry, EnvVersionEntry};
use extism_pdk::*;

/// List all available environment providers.
pub fn list() -> Result<Vec<EnvEntry>, Error> {
    let result = unsafe { host::cognia_env_list(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// List all available package/environment providers with full info.
pub fn provider_list() -> Result<serde_json::Value, Error> {
    let result = unsafe { host::cognia_provider_list(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// Detect an environment by type (e.g. "node", "python", "rust").
pub fn detect(env_type: &str) -> Result<EnvDetectResult, Error> {
    let input = serde_json::json!({ "envType": env_type }).to_string();
    let result = unsafe { host::cognia_env_detect(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Get the current active version for an environment type.
pub fn get_current(env_type: &str) -> Result<Option<String>, Error> {
    let input = serde_json::json!({ "envType": env_type }).to_string();
    let result = unsafe { host::cognia_env_get_current(input)? };
    let parsed: serde_json::Value = serde_json::from_str(&result)?;
    Ok(parsed["version"].as_str().map(|s| s.to_string()))
}

/// List installed versions for an environment type.
pub fn list_versions(env_type: &str) -> Result<Vec<EnvVersionEntry>, Error> {
    let input = serde_json::json!({ "envType": env_type }).to_string();
    let result = unsafe { host::cognia_env_list_versions(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Install a specific version of an environment.
pub fn install_version(env_type: &str, version: &str) -> Result<(), Error> {
    let input = serde_json::json!({ "envType": env_type, "version": version }).to_string();
    unsafe { host::cognia_env_install_version(input)?; }
    Ok(())
}

/// Switch to a specific version of an environment.
pub fn set_version(env_type: &str, version: &str) -> Result<(), Error> {
    let input = serde_json::json!({ "envType": env_type, "version": version }).to_string();
    unsafe { host::cognia_env_set_version(input)?; }
    Ok(())
}
