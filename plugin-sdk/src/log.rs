use crate::host;
use extism_pdk::*;

fn log_with_level(level: &str, message: &str) -> Result<(), Error> {
    let input = serde_json::json!({ "level": level, "message": message }).to_string();
    unsafe { host::cognia_log(input)?; }
    Ok(())
}

/// Log an info message.
pub fn info(message: &str) -> Result<(), Error> {
    log_with_level("info", message)
}

/// Log a warning message.
pub fn warn(message: &str) -> Result<(), Error> {
    log_with_level("warn", message)
}

/// Log an error message.
pub fn error(message: &str) -> Result<(), Error> {
    log_with_level("error", message)
}

/// Log a debug message.
pub fn debug(message: &str) -> Result<(), Error> {
    log_with_level("debug", message)
}
