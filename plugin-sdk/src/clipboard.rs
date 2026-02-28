use crate::host;
use extism_pdk::*;

/// Read text from the system clipboard.
pub fn read() -> Result<String, Error> {
    let result = unsafe { host::cognia_clipboard_read(String::new())? };
    let parsed: serde_json::Value = serde_json::from_str(&result)?;
    Ok(parsed["text"].as_str().unwrap_or("").to_string())
}

/// Write text to the system clipboard.
pub fn write(text: &str) -> Result<(), Error> {
    let input = serde_json::json!({ "text": text }).to_string();
    unsafe { host::cognia_clipboard_write(input)?; }
    Ok(())
}
