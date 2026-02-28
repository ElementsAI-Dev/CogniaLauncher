use crate::error::{CogniaError, CogniaResult};
use crate::platform::process::{self, ProcessOptions};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CondaEnvInfo {
    pub name: String,
    pub prefix: String,
    pub is_active: bool,
    pub is_base: bool,
    pub python_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CondaInfo {
    pub conda_version: Option<String>,
    pub python_version: Option<String>,
    pub platform: Option<String>,
    pub active_prefix: Option<String>,
    pub root_prefix: Option<String>,
    pub envs_dirs: Vec<String>,
    pub channels: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CondaExportResult {
    pub content: String,
    pub env_name: String,
}

// ── Helper ──

fn make_opts(timeout_secs: u64) -> ProcessOptions {
    ProcessOptions::new().with_timeout(Duration::from_secs(timeout_secs))
}

/// Detect conda or mamba command
async fn detect_command() -> String {
    if process::which("mamba").await.is_some() {
        "mamba".to_string()
    } else {
        "conda".to_string()
    }
}

async fn run_conda(args: &[&str], timeout: u64) -> CogniaResult<String> {
    let cmd = detect_command().await;
    let opts = make_opts(timeout);
    let out = process::execute(&cmd, args, Some(opts)).await?;
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

// ── Environment management commands ──

#[tauri::command]
pub async fn conda_env_list() -> Result<Vec<CondaEnvInfo>, String> {
    let out = run_conda(&["env", "list", "--json"], 60)
        .await
        .map_err(|e| e.to_string())?;

    // Also get active prefix
    let info_out = run_conda(&["info", "--json"], 30).await.unwrap_or_default();
    let active_prefix = serde_json::from_str::<serde_json::Value>(&info_out)
        .ok()
        .and_then(|v| v["active_prefix"].as_str().map(|s| s.to_string()));
    let root_prefix = serde_json::from_str::<serde_json::Value>(&info_out)
        .ok()
        .and_then(|v| v["root_prefix"].as_str().map(|s| s.to_string()));

    let json: serde_json::Value =
        serde_json::from_str(&out).map_err(|e| format!("Failed to parse conda env list: {}", e))?;

    let mut envs = Vec::new();
    if let Some(env_paths) = json["envs"].as_array() {
        for env_path in env_paths {
            if let Some(prefix) = env_path.as_str() {
                let name = std::path::Path::new(prefix)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| "base".to_string());

                let is_base = root_prefix.as_deref() == Some(prefix);
                let display_name = if is_base {
                    "base".to_string()
                } else {
                    name
                };

                let is_active = active_prefix.as_deref() == Some(prefix);

                // Try to detect Python version in the environment
                let python_version = detect_env_python(prefix).await;

                envs.push(CondaEnvInfo {
                    name: display_name,
                    prefix: prefix.to_string(),
                    is_active,
                    is_base,
                    python_version,
                });
            }
        }
    }

    Ok(envs)
}

async fn detect_env_python(prefix: &str) -> Option<String> {
    let python_bin = if cfg!(windows) {
        std::path::PathBuf::from(prefix).join("python.exe")
    } else {
        std::path::PathBuf::from(prefix).join("bin").join("python")
    };

    if !python_bin.exists() {
        return None;
    }

    let opts = ProcessOptions::new().with_timeout(Duration::from_secs(5));
    if let Ok(out) = process::execute(
        python_bin.to_string_lossy().as_ref(),
        &["--version"],
        Some(opts),
    )
    .await
    {
        if out.success {
            // "Python 3.12.3"
            return out
                .stdout
                .trim()
                .strip_prefix("Python ")
                .map(|v| v.to_string());
        }
    }
    None
}

#[tauri::command]
pub async fn conda_env_create(
    name: String,
    python_version: Option<String>,
    packages: Vec<String>,
) -> Result<String, String> {
    let mut args = vec!["create", "-n", &name, "-y"];

    let python_spec;
    if let Some(ref py) = python_version {
        python_spec = format!("python={}", py);
        args.push(&python_spec);
    }

    let pkg_refs: Vec<&str> = packages.iter().map(|s| s.as_str()).collect();
    args.extend(pkg_refs);

    run_conda(&args, 600)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn conda_env_remove(name: String) -> Result<String, String> {
    run_conda(&["env", "remove", "-n", &name, "-y"], 120)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn conda_env_clone(source: String, target: String) -> Result<String, String> {
    run_conda(&["create", "-n", &target, "--clone", &source, "-y"], 300)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn conda_env_export(name: String, no_builds: bool) -> Result<CondaExportResult, String> {
    let mut args = vec!["env", "export", "-n", &name];
    if no_builds {
        args.push("--no-builds");
    }
    let content = run_conda(&args, 60)
        .await
        .map_err(|e| e.to_string())?;

    Ok(CondaExportResult {
        content,
        env_name: name,
    })
}

#[tauri::command]
pub async fn conda_env_import(file_path: String, name: Option<String>) -> Result<String, String> {
    let mut args = vec!["env", "create", "-f", &file_path];
    let name_val;
    if let Some(ref n) = name {
        name_val = n.clone();
        args.push("-n");
        args.push(&name_val);
    }
    run_conda(&args, 600)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn conda_env_rename(old_name: String, new_name: String) -> Result<String, String> {
    run_conda(&["rename", "-n", &old_name, &new_name], 120)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn conda_info() -> Result<CondaInfo, String> {
    let out = run_conda(&["info", "--json"], 30)
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value =
        serde_json::from_str(&out).map_err(|e| format!("Failed to parse conda info: {}", e))?;

    Ok(CondaInfo {
        conda_version: json["conda_version"].as_str().map(|s| s.to_string()),
        python_version: json["python_version"].as_str().map(|s| s.to_string()),
        platform: json["platform"].as_str().map(|s| s.to_string()),
        active_prefix: json["active_prefix"].as_str().map(|s| s.to_string()),
        root_prefix: json["root_prefix"].as_str().map(|s| s.to_string()),
        envs_dirs: json["envs_dirs"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default(),
        channels: json["channels"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default(),
    })
}

#[tauri::command]
pub async fn conda_clean(all: bool, packages: bool, tarballs: bool) -> Result<String, String> {
    let mut args = vec!["clean", "-y"];
    if all {
        args.push("--all");
    } else {
        if packages {
            args.push("--packages");
        }
        if tarballs {
            args.push("--tarballs");
        }
    }
    run_conda(&args, 120)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn conda_config_show() -> Result<String, String> {
    run_conda(&["config", "--show"], 15)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn conda_config_set(key: String, value: String) -> Result<String, String> {
    run_conda(&["config", "--set", &key, &value], 15)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn conda_channel_add(channel: String) -> Result<String, String> {
    run_conda(&["config", "--add", "channels", &channel], 15)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn conda_channel_remove(channel: String) -> Result<String, String> {
    run_conda(&["config", "--remove", "channels", &channel], 15)
        .await
        .map_err(|e| e.to_string())
}
