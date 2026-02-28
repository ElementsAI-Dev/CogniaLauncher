use crate::host;
use crate::types::LocaleInfo;
use extism_pdk::*;
use std::collections::HashMap;

/// Get the current application locale (e.g. "en", "zh").
pub fn get_locale() -> Result<String, Error> {
    let result = unsafe { host::cognia_get_locale(String::new())? };
    let parsed: serde_json::Value = serde_json::from_str(&result)?;
    Ok(parsed["locale"].as_str().unwrap_or("en").to_string())
}

/// Translate a key using the plugin's locale data.
/// Falls back: current locale -> "en" -> raw key.
/// Supports {param} interpolation.
pub fn translate(key: &str, params: &[(&str, &str)]) -> Result<String, Error> {
    let params_map: HashMap<&str, &str> = params.iter().cloned().collect();
    let input = serde_json::json!({ "key": key, "params": params_map }).to_string();
    let result = unsafe { host::cognia_i18n_translate(input)? };
    let parsed: serde_json::Value = serde_json::from_str(&result)?;
    Ok(parsed["text"].as_str().unwrap_or(key).to_string())
}

/// Shorthand for translate with no params.
pub fn t(key: &str) -> Result<String, Error> {
    translate(key, &[])
}

/// Get all locale strings for the current locale.
pub fn get_all() -> Result<LocaleInfo, Error> {
    let result = unsafe { host::cognia_i18n_get_all(String::new())? };
    Ok(serde_json::from_str(&result)?)
}
