use crate::error::{CogniaError, CogniaResult};
use crate::platform::process::{self, ProcessOptions};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UvProjectInfo {
    pub name: Option<String>,
    pub version: Option<String>,
    pub python_version: Option<String>,
    pub venv_path: Option<String>,
    pub lock_file_exists: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UvDependencyNode {
    pub name: String,
    pub version: String,
    pub children: Vec<UvDependencyNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UvPythonEntry {
    pub key: String,
    pub version: String,
    pub path: Option<String>,
    pub managed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UvCacheInfo {
    pub path: String,
    pub size: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UvRunResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

// ── Helper ──

fn make_opts(timeout_secs: u64) -> ProcessOptions {
    ProcessOptions::new().with_timeout(Duration::from_secs(timeout_secs))
}

async fn run_uv(args: &[&str], cwd: Option<&str>, timeout: u64) -> CogniaResult<String> {
    let mut opts = make_opts(timeout);
    if let Some(dir) = cwd {
        opts = opts.with_cwd(dir);
    }
    let out = process::execute("uv", args, Some(opts)).await?;
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

#[allow(dead_code)]
async fn run_uv_lenient(args: &[&str], cwd: Option<&str>, timeout: u64) -> CogniaResult<String> {
    let mut opts = make_opts(timeout);
    if let Some(dir) = cwd {
        opts = opts.with_cwd(dir);
    }
    let out = process::execute("uv", args, Some(opts)).await?;
    Ok(out.stdout)
}

// ── Project management commands ──

#[tauri::command]
pub async fn uv_init(path: String, name: Option<String>) -> Result<String, String> {
    let mut args = vec!["init"];
    let name_val;
    if let Some(ref n) = name {
        name_val = n.clone();
        args.push("--name");
        args.push(&name_val);
    }
    run_uv(&args, Some(&path), 60)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn uv_add(
    path: String,
    packages: Vec<String>,
    dev: bool,
    optional: Option<String>,
) -> Result<String, String> {
    let mut args = vec!["add"];
    if dev {
        args.push("--dev");
    }
    let opt_val;
    if let Some(ref group) = optional {
        opt_val = group.clone();
        args.push("--optional");
        args.push(&opt_val);
    }
    let pkg_refs: Vec<&str> = packages.iter().map(|s| s.as_str()).collect();
    args.extend(pkg_refs);
    run_uv(&args, Some(&path), 180)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn uv_remove(path: String, packages: Vec<String>, dev: bool) -> Result<String, String> {
    let mut args = vec!["remove"];
    if dev {
        args.push("--dev");
    }
    let pkg_refs: Vec<&str> = packages.iter().map(|s| s.as_str()).collect();
    args.extend(pkg_refs);
    run_uv(&args, Some(&path), 120)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn uv_sync(path: String, frozen: bool) -> Result<String, String> {
    let mut args = vec!["sync"];
    if frozen {
        args.push("--frozen");
    }
    run_uv(&args, Some(&path), 300)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn uv_lock(path: String, upgrade: bool) -> Result<String, String> {
    let mut args = vec!["lock"];
    if upgrade {
        args.push("--upgrade");
    }
    run_uv(&args, Some(&path), 300)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn uv_run(path: String, command: Vec<String>) -> Result<UvRunResult, String> {
    let mut opts = make_opts(300);
    opts = opts.with_cwd(&path);
    let mut args = vec!["run"];
    let cmd_refs: Vec<&str> = command.iter().map(|s| s.as_str()).collect();
    args.extend(cmd_refs);
    let out = process::execute("uv", &args, Some(opts))
        .await
        .map_err(|e| e.to_string())?;
    Ok(UvRunResult {
        exit_code: if out.success { 0 } else { 1 },
        stdout: out.stdout,
        stderr: out.stderr,
    })
}

#[tauri::command]
pub async fn uv_tree(path: String) -> Result<String, String> {
    run_uv(&["tree"], Some(&path), 60)
        .await
        .map_err(|e| e.to_string())
}

// ── Virtual environment commands ──

#[tauri::command]
pub async fn uv_venv_create(
    path: String,
    python: Option<String>,
) -> Result<String, String> {
    let mut args = vec!["venv"];
    let py_val;
    if let Some(ref py) = python {
        py_val = py.clone();
        args.push("--python");
        args.push(&py_val);
    }
    run_uv(&args, Some(&path), 120)
        .await
        .map_err(|e| e.to_string())
}

// ── Python version management commands ──

#[tauri::command]
pub async fn uv_python_install(version: String) -> Result<String, String> {
    run_uv(&["python", "install", &version], None, 600)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn uv_python_uninstall(version: String) -> Result<String, String> {
    run_uv(&["python", "uninstall", &version], None, 120)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn uv_python_list(only_installed: bool) -> Result<Vec<UvPythonEntry>, String> {
    let mut args = vec!["python", "list"];
    if only_installed {
        args.push("--only-installed");
    }
    let out = run_uv(&args, None, 30)
        .await
        .map_err(|e| e.to_string())?;

    let mut entries = Vec::new();
    for line in out.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.is_empty() {
            continue;
        }
        let key = parts[0].to_string();
        // Extract version from key like "cpython-3.12.3-linux-x86_64-gnu"
        let version = key
            .strip_prefix("cpython-")
            .or_else(|| key.strip_prefix("pypy-"))
            .and_then(|rest| {
                let end = rest
                    .find(|c: char| c != '.' && !c.is_ascii_digit())
                    .unwrap_or(rest.len());
                let v = &rest[..end];
                if v.is_empty() { None } else { Some(v.to_string()) }
            })
            .unwrap_or_else(|| key.clone());
        let path = parts.get(1).map(|s| s.to_string());
        let managed = path
            .as_ref()
            .map(|p| p.contains("uv") || p.contains(".local/share"))
            .unwrap_or(false);

        entries.push(UvPythonEntry {
            key,
            version,
            path,
            managed,
        });
    }

    Ok(entries)
}

#[tauri::command]
pub async fn uv_python_pin(path: String, version: String) -> Result<String, String> {
    run_uv(&["python", "pin", &version], Some(&path), 30)
        .await
        .map_err(|e| e.to_string())
}

// ── pip compile (requirements) ──

#[tauri::command]
pub async fn uv_pip_compile(
    path: String,
    input: String,
    output: Option<String>,
) -> Result<String, String> {
    let mut args = vec!["pip", "compile", input.as_str()];
    let out_val;
    if let Some(ref o) = output {
        out_val = o.clone();
        args.push("-o");
        args.push(&out_val);
    }
    run_uv(&args, Some(&path), 120)
        .await
        .map_err(|e| e.to_string())
}

// ── Self management ──

#[tauri::command]
pub async fn uv_self_update() -> Result<String, String> {
    run_uv(&["self", "update"], None, 120)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn uv_version() -> Result<String, String> {
    run_uv(&["--version"], None, 10)
        .await
        .map(|s| s.trim().to_string())
        .map_err(|e| e.to_string())
}

// ── Cache management ──

#[tauri::command]
pub async fn uv_cache_clean() -> Result<String, String> {
    run_uv(&["cache", "clean"], None, 120)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn uv_cache_dir() -> Result<String, String> {
    run_uv(&["cache", "dir"], None, 10)
        .await
        .map(|s| s.trim().to_string())
        .map_err(|e| e.to_string())
}

// ── Tool management (uv tool) ──

#[tauri::command]
pub async fn uv_tool_install(name: String, python: Option<String>) -> Result<String, String> {
    let mut args = vec!["tool", "install", name.as_str()];
    let py_val;
    if let Some(ref py) = python {
        py_val = py.clone();
        args.push("--python");
        args.push(&py_val);
    }
    run_uv(&args, None, 180)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn uv_tool_uninstall(name: String) -> Result<String, String> {
    run_uv(&["tool", "uninstall", &name], None, 60)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn uv_tool_list() -> Result<String, String> {
    run_uv(&["tool", "list"], None, 30)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn uv_tool_run(name: String, tool_args: Vec<String>) -> Result<UvRunResult, String> {
    let mut args = vec!["tool", "run", name.as_str()];
    let arg_refs: Vec<&str> = tool_args.iter().map(|s| s.as_str()).collect();
    args.extend(arg_refs);
    let opts = make_opts(300);
    let out = process::execute("uv", &args, Some(opts))
        .await
        .map_err(|e| e.to_string())?;
    Ok(UvRunResult {
        exit_code: if out.success { 0 } else { 1 },
        stdout: out.stdout,
        stderr: out.stderr,
    })
}
