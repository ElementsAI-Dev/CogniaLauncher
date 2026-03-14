use crate::host;
use crate::types::{
    ProcessAvailabilityResult, ProcessLookupResult, ProcessOptions, ProcessResult,
};
use extism_pdk::*;
use serde::Serialize;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProcessExecRequest {
    command: String,
    args: Vec<String>,
    cwd: Option<String>,
    #[serde(default)]
    env: HashMap<String, String>,
    timeout_ms: Option<u64>,
    capture_output: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProcessShellRequest {
    command: String,
    cwd: Option<String>,
    #[serde(default)]
    env: HashMap<String, String>,
    timeout_ms: Option<u64>,
    capture_output: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
struct ProcessLookupRequest {
    command: String,
}

fn build_exec_request(
    command: &str,
    args: &[&str],
    options: Option<&ProcessOptions>,
) -> ProcessExecRequest {
    let options = options.cloned().unwrap_or_default();
    ProcessExecRequest {
        command: command.to_string(),
        args: args.iter().map(|value| (*value).to_string()).collect(),
        cwd: options.cwd,
        env: options.env,
        timeout_ms: options.timeout_ms,
        capture_output: options.capture_output,
    }
}

fn build_shell_request(command: &str, options: Option<&ProcessOptions>) -> ProcessShellRequest {
    let options = options.cloned().unwrap_or_default();
    ProcessShellRequest {
        command: command.to_string(),
        cwd: options.cwd,
        env: options.env,
        timeout_ms: options.timeout_ms,
        capture_output: options.capture_output,
    }
}

fn build_lookup_request(command: &str) -> ProcessLookupRequest {
    ProcessLookupRequest {
        command: command.to_string(),
    }
}

/// Execute a direct process command (requires `process_exec` permission).
/// This remains backward compatible with the legacy `exec(command, args?, cwd?)` shape.
pub fn exec(command: &str, args: &[&str], cwd: Option<&str>) -> Result<ProcessResult, Error> {
    let options = cwd
        .map(|value| ProcessOptions::new().with_cwd(value))
        .unwrap_or_default();
    exec_with_options(command, args, Some(&options))
}

/// Execute a direct process command with structured options.
pub fn exec_with_options(
    command: &str,
    args: &[&str],
    options: Option<&ProcessOptions>,
) -> Result<ProcessResult, Error> {
    let input = serde_json::to_string(&build_exec_request(command, args, options))?;
    let result = unsafe { host::cognia_process_exec(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Execute a command through the host shell.
pub fn exec_shell(
    command: &str,
    options: Option<&ProcessOptions>,
) -> Result<ProcessResult, Error> {
    let input = serde_json::to_string(&build_shell_request(command, options))?;
    let result = unsafe { host::cognia_process_exec_shell(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Resolve a program on the host PATH.
pub fn which(command: &str) -> Result<ProcessLookupResult, Error> {
    let input = serde_json::to_string(&build_lookup_request(command))?;
    let result = unsafe { host::cognia_process_which(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Check whether a program is available on the host PATH.
pub fn is_available(command: &str) -> Result<ProcessAvailabilityResult, Error> {
    let input = serde_json::to_string(&build_lookup_request(command))?;
    let result = unsafe { host::cognia_process_is_available(input)? };
    Ok(serde_json::from_str(&result)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_exec_request_preserves_legacy_shape() {
        let request = build_exec_request("node", &["--version"], None);

        assert_eq!(request.command, "node");
        assert_eq!(request.args, vec!["--version"]);
        assert_eq!(request.cwd, None);
        assert!(request.env.is_empty());
        assert_eq!(request.timeout_ms, None);
        assert_eq!(request.capture_output, None);
    }

    #[test]
    fn test_build_exec_request_includes_structured_options() {
        let options = ProcessOptions::new()
            .with_cwd("/tmp/demo")
            .with_env("DEMO_FLAG", "1")
            .with_timeout_ms(2_000)
            .with_capture_output(false);

        let request = build_exec_request("node", &["--version"], Some(&options));

        assert_eq!(request.cwd.as_deref(), Some("/tmp/demo"));
        assert_eq!(request.env.get("DEMO_FLAG").map(String::as_str), Some("1"));
        assert_eq!(request.timeout_ms, Some(2_000));
        assert_eq!(request.capture_output, Some(false));
    }

    #[test]
    fn test_build_shell_request_omits_args_and_keeps_options() {
        let options = ProcessOptions::new()
            .with_cwd("/tmp/demo")
            .with_timeout_ms(500);

        let request = build_shell_request("echo hello", Some(&options));

        assert_eq!(request.command, "echo hello");
        assert_eq!(request.cwd.as_deref(), Some("/tmp/demo"));
        assert_eq!(request.timeout_ms, Some(500));
    }
}
