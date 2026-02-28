use crate::error::{CogniaError, CogniaResult};
use crate::platform::process::{self, ProcessOptions};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PipxRunResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

// ── Helper ──

fn make_opts(timeout_secs: u64) -> ProcessOptions {
    ProcessOptions::new().with_timeout(Duration::from_secs(timeout_secs))
}

async fn run_pipx(args: &[&str], timeout: u64) -> CogniaResult<String> {
    let opts = make_opts(timeout);
    let out = process::execute("pipx", args, Some(opts)).await?;
    if out.success {
        Ok(out.stdout)
    } else {
        Err(CogniaError::Provider(if out.stderr.is_empty() {
            out.stdout
        } else {
            out.stderr
        }))
    }
}

// ── Commands ──

#[tauri::command]
pub async fn pipx_inject(app_name: String, packages: Vec<String>) -> Result<String, String> {
    let mut args = vec!["inject", app_name.as_str()];
    let pkg_refs: Vec<&str> = packages.iter().map(|s| s.as_str()).collect();
    args.extend(pkg_refs);
    run_pipx(&args, 180)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pipx_run(
    package: String,
    run_args: Vec<String>,
) -> Result<PipxRunResult, String> {
    let mut args = vec!["run", package.as_str()];
    let arg_refs: Vec<&str> = run_args.iter().map(|s| s.as_str()).collect();
    args.extend(arg_refs);
    let opts = make_opts(300);
    let out = process::execute("pipx", &args, Some(opts))
        .await
        .map_err(|e| e.to_string())?;
    Ok(PipxRunResult {
        exit_code: if out.success { 0 } else { 1 },
        stdout: out.stdout,
        stderr: out.stderr,
    })
}

#[tauri::command]
pub async fn pipx_upgrade(package: String) -> Result<String, String> {
    run_pipx(&["upgrade", &package], 180)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pipx_upgrade_all() -> Result<String, String> {
    run_pipx(&["upgrade-all"], 300)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pipx_ensurepath() -> Result<String, String> {
    run_pipx(&["ensurepath"], 30)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pipx_reinstall_all() -> Result<String, String> {
    run_pipx(&["reinstall-all"], 600)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pipx_list_json() -> Result<String, String> {
    run_pipx(&["list", "--json"], 30)
        .await
        .map_err(|e| e.to_string())
}
