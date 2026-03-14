use crate::host;
use crate::types::{PluginLogEnvelope, PluginLogRecord};
use extism_pdk::*;

fn log_with_level(level: &str, message: &str) -> Result<(), Error> {
    write(&PluginLogRecord::<std::collections::HashMap<String, serde_json::Value>> {
        level: level.to_string(),
        message: message.to_string(),
        target: None,
        fields: None,
        tags: Vec::new(),
        correlation_id: None,
    })
}

/// Write a structured log record.
pub fn write<TFields>(record: &PluginLogRecord<TFields>) -> Result<(), Error>
where
    TFields: serde::Serialize,
{
    let input = serde_json::to_string(record)?;
    unsafe {
        host::cognia_log(input)?;
    }
    Ok(())
}

/// Parse the host log-listener callback envelope received by `cognia_on_log`.
pub fn parse_envelope<TFields>(input: &str) -> Result<PluginLogEnvelope<TFields>, Error>
where
    TFields: serde::de::DeserializeOwned,
{
    Ok(serde_json::from_str(input)?)
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
