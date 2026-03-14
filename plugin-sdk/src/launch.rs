//! Launch / environment activation module.
//!
//! Execute programs with specific environment configurations.

use crate::host;
use crate::types::*;
use extism_pdk::*;

/// Execute a command with a specific environment activated. Requires: launch + process_exec
pub fn with_env(command: &str, args: &[&str], env_type: &str, version: Option<&str>) -> Result<ProcessResult, Error> {
    let input = serde_json::json!({
        "command": command,
        "args": args,
        "envType": env_type,
        "version": version,
    }).to_string();
    let result = unsafe { host::cognia_launch_with_env(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Get environment activation info. Requires: env_read
pub fn get_env_info(env_type: &str) -> Result<EnvActivationInfo, Error> {
    let input = serde_json::json!({ "envType": env_type }).to_string();
    let result = unsafe { host::cognia_launch_get_env_info(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Locate a program in PATH with optional env context. Requires: env_read
pub fn which_program(command: &str, env_type: Option<&str>) -> Result<Option<String>, Error> {
    let input = serde_json::json!({ "command": command, "envType": env_type }).to_string();
    let result = unsafe { host::cognia_launch_which_program(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Activate a specific environment version. Requires: launch
pub fn activate(env_type: &str, version: &str) -> Result<ActivationResult, Error> {
    let input = serde_json::json!({ "envType": env_type, "version": version }).to_string();
    let result = unsafe { host::cognia_launch_activate(input)? };
    Ok(serde_json::from_str(&result)?)
}
