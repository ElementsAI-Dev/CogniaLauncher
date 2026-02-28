use crate::host;
use extism_pdk::*;

/// Emit an event that can be observed by the host and other plugins.
pub fn emit(name: &str, payload: &serde_json::Value) -> Result<(), Error> {
    let input = serde_json::json!({ "name": name, "payload": payload }).to_string();
    unsafe { host::cognia_event_emit(input)?; }
    Ok(())
}

/// Emit an event with a simple string payload.
pub fn emit_str(name: &str, message: &str) -> Result<(), Error> {
    emit(name, &serde_json::json!(message))
}

/// Get the current plugin's own ID.
pub fn get_plugin_id() -> Result<String, Error> {
    let result = unsafe { host::cognia_get_plugin_id(String::new())? };
    let parsed: serde_json::Value = serde_json::from_str(&result)?;
    Ok(parsed["pluginId"].as_str().unwrap_or("").to_string())
}
