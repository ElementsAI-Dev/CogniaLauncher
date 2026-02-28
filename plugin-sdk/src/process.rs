use crate::host;
use crate::types::ProcessResult;
use extism_pdk::*;

/// Execute a shell command (requires process_exec permission).
pub fn exec(command: &str, args: &[&str], cwd: Option<&str>) -> Result<ProcessResult, Error> {
    let input = serde_json::json!({
        "command": command,
        "args": args,
        "cwd": cwd,
    }).to_string();
    let result = unsafe { host::cognia_process_exec(input)? };
    Ok(serde_json::from_str(&result)?)
}
