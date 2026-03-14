//! Environment profiles module.
//!
//! Manage environment configuration snapshots for quick switching.

use crate::host;
use crate::types::*;
use extism_pdk::*;

/// List all profiles. Requires: profiles_read
pub fn list() -> Result<Vec<Profile>, Error> {
    let result = unsafe { host::cognia_profile_list(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// Get a profile by ID. Requires: profiles_read
pub fn get(id: &str) -> Result<Option<Profile>, Error> {
    let input = serde_json::json!({ "id": id }).to_string();
    let result = unsafe { host::cognia_profile_get(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Create a profile from the current environment state. Returns profile ID. Requires: profiles_write
pub fn create_from_current(name: &str, description: Option<&str>) -> Result<String, Error> {
    let input = serde_json::json!({ "name": name, "description": description }).to_string();
    let result = unsafe { host::cognia_profile_create_from_current(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Create a profile with explicit entries. Returns profile ID. Requires: profiles_write
pub fn create(profile: &ProfileCreateInput) -> Result<String, Error> {
    let input = serde_json::to_string(profile).map_err(|e| Error::msg(e.to_string()))?;
    let result = unsafe { host::cognia_profile_create(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Apply (activate) a profile. Requires: profiles_write
pub fn apply(id: &str) -> Result<(), Error> {
    let input = serde_json::json!({ "id": id }).to_string();
    unsafe { host::cognia_profile_apply(input)?; }
    Ok(())
}

/// Export a profile as JSON string. Requires: profiles_read
pub fn export_profile(id: &str) -> Result<String, Error> {
    let input = serde_json::json!({ "id": id }).to_string();
    let result = unsafe { host::cognia_profile_export(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Import a profile from JSON string. Returns profile ID. Requires: profiles_write
pub fn import_profile(json: &str) -> Result<String, Error> {
    let input = serde_json::json!({ "json": json }).to_string();
    let result = unsafe { host::cognia_profile_import(input)? };
    Ok(serde_json::from_str(&result)?)
}
