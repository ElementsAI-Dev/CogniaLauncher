use crate::error::{CogniaError, CogniaResult};
use crate::platform::process::{self, ProcessOptions};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PoetryEnvInfo {
    pub path: String,
    pub python_version: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PoetryRunResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

// ── Helper ──

fn make_opts(timeout_secs: u64) -> ProcessOptions {
    ProcessOptions::new().with_timeout(Duration::from_secs(timeout_secs))
}

async fn run_poetry(args: &[&str], cwd: Option<&str>, timeout: u64) -> CogniaResult<String> {
    let mut opts = make_opts(timeout);
    if let Some(dir) = cwd {
        opts = opts.with_cwd(dir);
    }
    let out = process::execute("poetry", args, Some(opts)).await?;
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

// ── Project management commands ──

#[tauri::command]
pub async fn poetry_lock(path: String, no_update: bool) -> Result<String, String> {
    let mut args = vec!["lock"];
    if no_update {
        args.push("--no-update");
    }
    run_poetry(&args, Some(&path), 300)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn poetry_update(path: String, packages: Vec<String>) -> Result<String, String> {
    let mut args = vec!["update"];
    let pkg_refs: Vec<&str> = packages.iter().map(|s| s.as_str()).collect();
    args.extend(pkg_refs);
    run_poetry(&args, Some(&path), 300)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn poetry_run(path: String, command: Vec<String>) -> Result<PoetryRunResult, String> {
    let mut opts = make_opts(300);
    opts = opts.with_cwd(&path);
    let mut args = vec!["run"];
    let cmd_refs: Vec<&str> = command.iter().map(|s| s.as_str()).collect();
    args.extend(cmd_refs);
    let out = process::execute("poetry", &args, Some(opts))
        .await
        .map_err(|e| e.to_string())?;
    Ok(PoetryRunResult {
        exit_code: if out.success { 0 } else { 1 },
        stdout: out.stdout,
        stderr: out.stderr,
    })
}

#[tauri::command]
pub async fn poetry_env_list(path: String) -> Result<Vec<PoetryEnvInfo>, String> {
    let out = run_poetry(&["env", "list", "--full-path"], Some(&path), 30)
        .await
        .map_err(|e| e.to_string())?;

    let mut envs = Vec::new();
    for line in out.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let is_active = line.contains("(Activated)");
        let env_path = line
            .replace("(Activated)", "")
            .trim()
            .to_string();

        envs.push(PoetryEnvInfo {
            path: env_path,
            python_version: None,
            is_active,
        });
    }

    Ok(envs)
}

#[tauri::command]
pub async fn poetry_env_remove(path: String, python: String) -> Result<String, String> {
    run_poetry(&["env", "remove", &python], Some(&path), 60)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn poetry_env_use(path: String, python: String) -> Result<String, String> {
    run_poetry(&["env", "use", &python], Some(&path), 60)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn poetry_export(
    path: String,
    format: Option<String>,
    with_hashes: bool,
) -> Result<String, String> {
    let mut args = vec!["export"];
    let fmt_val;
    if let Some(ref fmt) = format {
        fmt_val = fmt.clone();
        args.push("-f");
        args.push(&fmt_val);
    }
    if !with_hashes {
        args.push("--without-hashes");
    }
    run_poetry(&args, Some(&path), 60)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn poetry_check(path: String) -> Result<String, String> {
    run_poetry(&["check"], Some(&path), 30)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn poetry_version(path: String) -> Result<String, String> {
    run_poetry(&["--version"], Some(&path), 10)
        .await
        .map(|s| s.trim().to_string())
        .map_err(|e| e.to_string())
}
