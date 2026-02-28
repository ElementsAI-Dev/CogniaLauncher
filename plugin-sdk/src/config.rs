use crate::host;
use extism_pdk::*;

/// Read a configuration value by key.
pub fn get(key: &str) -> Result<Option<String>, Error> {
    let input = serde_json::json!({ "key": key }).to_string();
    let result = unsafe { host::cognia_config_get(input)? };
    let parsed: serde_json::Value = serde_json::from_str(&result)?;
    Ok(parsed["value"].as_str().map(|s| s.to_string()))
}

/// Write a configuration value.
pub fn set(key: &str, value: &str) -> Result<(), Error> {
    let input = serde_json::json!({ "key": key, "value": value }).to_string();
    unsafe { host::cognia_config_set(input)?; }
    Ok(())
}
