use crate::core::EnvironmentManager;
use crate::platform::env::ShellType;
use crate::platform::process::{self, ProcessOptions, ProcessOutput};
use crate::provider::ProviderRegistry;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::RwLock;
use uuid::Uuid;

pub type SharedRegistry = Arc<RwLock<ProviderRegistry>>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchRequest {
    pub program: String,
    pub args: Vec<String>,
    pub cwd: Option<String>,
    pub env_type: Option<String>,
    pub env_version: Option<String>,
    pub extra_env: Option<HashMap<String, String>>,
    pub timeout_secs: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub success: bool,
}

impl From<ProcessOutput> for LaunchResult {
    fn from(output: ProcessOutput) -> Self {
        Self {
            exit_code: output.exit_code,
            stdout: output.stdout,
            stderr: output.stderr,
            success: output.success,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandOutputEvent {
    pub command_id: String,
    pub stream: String,
    pub data: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivationScript {
    pub shell: String,
    pub script: String,
    pub env_vars: HashMap<String, String>,
    pub path_additions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvInfo {
    pub env_type: String,
    pub version: String,
    pub bin_path: Option<String>,
    pub env_vars: HashMap<String, String>,
}

/// Launch a program with a specific environment version
#[tauri::command]
pub async fn launch_with_env(
    request: LaunchRequest,
    registry: State<'_, SharedRegistry>,
) -> Result<LaunchResult, String> {
    let mut opts = ProcessOptions::new();

    // Set working directory if specified
    if let Some(cwd) = &request.cwd {
        opts = opts.with_cwd(cwd);
    }

    // Set timeout if specified
    if let Some(timeout) = request.timeout_secs {
        opts = opts.with_timeout(Duration::from_secs(timeout));
    }

    // Apply environment modifications if env_type is specified
    if let Some(env_type) = &request.env_type {
        let manager = EnvironmentManager::new(registry.inner().clone());

        // Detect version if not specified
        let version = if let Some(v) = &request.env_version {
            v.clone()
        } else if let Some(cwd) = &request.cwd {
            manager
                .detect_version(env_type, std::path::Path::new(cwd))
                .await
                .map_err(|e| e.to_string())?
                .map(|d| d.version)
                .ok_or_else(|| format!("No {} version detected for project", env_type))?
        } else {
            return Err("Either env_version or cwd must be specified".into());
        };

        // Get environment modifications
        let env_mods = manager
            .get_env_modifications(env_type, &version)
            .await
            .map_err(|e| e.to_string())?;

        // Apply PATH modifications
        for path in &env_mods.path_prepend {
            if let Some(path_str) = path.to_str() {
                let current_path = std::env::var("PATH").unwrap_or_default();
                let separator = if cfg!(windows) { ";" } else { ":" };
                opts = opts.with_env("PATH", format!("{}{}{}", path_str, separator, current_path));
            }
        }

        // Apply environment variables
        for (key, value) in &env_mods.set_variables {
            opts = opts.with_env(key, value);
        }
    }

    // Apply extra environment variables
    if let Some(extra_env) = &request.extra_env {
        for (key, value) in extra_env {
            opts = opts.with_env(key, value);
        }
    }

    // Execute the program
    let args: Vec<&str> = request.args.iter().map(|s| s.as_str()).collect();
    let output = process::execute(&request.program, &args, Some(opts))
        .await
        .map_err(|e| e.to_string())?;

    Ok(output.into())
}

/// Launch a program and capture streaming output via Tauri events
#[tauri::command]
pub async fn launch_with_streaming(
    request: LaunchRequest,
    app: AppHandle,
    registry: State<'_, SharedRegistry>,
) -> Result<LaunchResult, String> {
    let command_id = Uuid::new_v4().to_string();
    let mut opts = ProcessOptions::new();

    // Set working directory if specified
    if let Some(cwd) = &request.cwd {
        opts = opts.with_cwd(cwd);
    }

    // Set timeout if specified
    if let Some(timeout) = request.timeout_secs {
        opts = opts.with_timeout(Duration::from_secs(timeout));
    }

    // Apply environment modifications if env_type is specified
    if let Some(env_type) = &request.env_type {
        let manager = EnvironmentManager::new(registry.inner().clone());

        // Detect version if not specified
        let version = if let Some(v) = &request.env_version {
            v.clone()
        } else if let Some(cwd) = &request.cwd {
            manager
                .detect_version(env_type, std::path::Path::new(cwd))
                .await
                .map_err(|e| e.to_string())?
                .map(|d| d.version)
                .ok_or_else(|| format!("No {} version detected for project", env_type))?
        } else {
            return Err("Either env_version or cwd must be specified".into());
        };

        // Get environment modifications
        let env_mods = manager
            .get_env_modifications(env_type, &version)
            .await
            .map_err(|e| e.to_string())?;

        // Apply PATH modifications
        for path in &env_mods.path_prepend {
            if let Some(path_str) = path.to_str() {
                let current_path = std::env::var("PATH").unwrap_or_default();
                let separator = if cfg!(windows) { ";" } else { ":" };
                opts = opts.with_env("PATH", format!("{}{}{}", path_str, separator, current_path));
            }
        }

        // Apply environment variables
        for (key, value) in &env_mods.set_variables {
            opts = opts.with_env(key, value);
        }
    }

    // Apply extra environment variables
    if let Some(extra_env) = &request.extra_env {
        for (key, value) in extra_env {
            opts = opts.with_env(key, value);
        }
    }

    // Execute the program with streaming output
    let args: Vec<&str> = request.args.iter().map(|s| s.as_str()).collect();
    let app_handle_stdout = app.clone();
    let app_handle_stderr = app.clone();
    let cmd_id_stdout = command_id.clone();
    let cmd_id_stderr = command_id.clone();

    let output = process::execute_with_streaming(
        &request.program,
        &args,
        Some(opts),
        move |line| {
            let _ = app_handle_stdout.emit(
                "command-output",
                CommandOutputEvent {
                    command_id: cmd_id_stdout.clone(),
                    stream: "stdout".to_string(),
                    data: line.to_string(),
                    timestamp: Utc::now().timestamp_millis(),
                },
            );
        },
        move |line| {
            let _ = app_handle_stderr.emit(
                "command-output",
                CommandOutputEvent {
                    command_id: cmd_id_stderr.clone(),
                    stream: "stderr".to_string(),
                    data: line.to_string(),
                    timestamp: Utc::now().timestamp_millis(),
                },
            );
        },
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(output.into())
}

/// Get shell activation script for a specific environment
#[tauri::command]
pub async fn env_activate(
    env_type: String,
    version: Option<String>,
    project_path: Option<String>,
    shell: Option<String>,
    registry: State<'_, SharedRegistry>,
) -> Result<ActivationScript, String> {
    let manager = EnvironmentManager::new(registry.inner().clone());

    // Detect or use specified version
    let resolved_version = if let Some(v) = version {
        v
    } else if let Some(path) = &project_path {
        manager
            .detect_version(&env_type, std::path::Path::new(path))
            .await
            .map_err(|e| e.to_string())?
            .map(|d| d.version)
            .ok_or_else(|| format!("No {} version detected", env_type))?
    } else {
        // Try to get current global version
        let reg = registry.read().await;
        let provider = reg
            .get_environment_provider(&env_type)
            .ok_or_else(|| format!("Environment provider not found: {}", env_type))?;

        provider
            .get_current_version()
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("No current {} version set", env_type))?
    };

    // Get environment modifications
    let env_mods = manager
        .get_env_modifications(&env_type, &resolved_version)
        .await
        .map_err(|e| e.to_string())?;

    // Determine shell type
    let shell_type = match shell.as_deref() {
        Some("bash") => ShellType::Bash,
        Some("zsh") => ShellType::Zsh,
        Some("fish") => ShellType::Fish,
        Some("powershell") | Some("pwsh") => ShellType::PowerShell,
        _ => ShellType::detect(),
    };

    // Generate activation script
    let script = env_mods.to_shell_commands(shell_type);

    // Extract env vars and paths for structured response
    let mut env_vars = HashMap::new();
    for (key, value) in &env_mods.set_variables {
        env_vars.insert(key.clone(), value.clone());
    }

    let path_additions: Vec<String> = env_mods
        .path_prepend
        .iter()
        .chain(env_mods.path_append.iter())
        .filter_map(|p| p.to_str().map(|s| s.to_string()))
        .collect();

    Ok(ActivationScript {
        shell: format!("{:?}", shell_type).to_lowercase(),
        script,
        env_vars,
        path_additions,
    })
}

/// Get environment info for display
#[tauri::command]
pub async fn env_get_info(
    env_type: String,
    version: String,
    registry: State<'_, SharedRegistry>,
) -> Result<EnvInfo, String> {
    let manager = EnvironmentManager::new(registry.inner().clone());

    let env_mods = manager
        .get_env_modifications(&env_type, &version)
        .await
        .map_err(|e| e.to_string())?;

    let bin_path = env_mods
        .path_prepend
        .first()
        .and_then(|p| p.to_str().map(|s| s.to_string()));

    let mut env_vars = HashMap::new();
    for (key, value) in env_mods.set_variables {
        env_vars.insert(key, value);
    }

    Ok(EnvInfo {
        env_type,
        version,
        bin_path,
        env_vars,
    })
}

/// Execute a shell command with environment
#[tauri::command]
pub async fn exec_shell_with_env(
    command: String,
    env_type: Option<String>,
    env_version: Option<String>,
    cwd: Option<String>,
    registry: State<'_, SharedRegistry>,
) -> Result<LaunchResult, String> {
    let mut opts = ProcessOptions::new();

    if let Some(cwd) = &cwd {
        opts = opts.with_cwd(cwd);
    }

    // Apply environment modifications if specified
    if let Some(env_type) = &env_type {
        let manager = EnvironmentManager::new(registry.inner().clone());

        let version = if let Some(v) = env_version {
            v
        } else if let Some(cwd) = &cwd {
            manager
                .detect_version(env_type, std::path::Path::new(cwd))
                .await
                .map_err(|e| e.to_string())?
                .map(|d| d.version)
                .ok_or_else(|| format!("No {} version detected", env_type))?
        } else {
            return Err("Either env_version or cwd required when env_type is specified".into());
        };

        let env_mods = manager
            .get_env_modifications(env_type, &version)
            .await
            .map_err(|e| e.to_string())?;

        for path in &env_mods.path_prepend {
            if let Some(path_str) = path.to_str() {
                let current_path = std::env::var("PATH").unwrap_or_default();
                let separator = if cfg!(windows) { ";" } else { ":" };
                opts = opts.with_env("PATH", format!("{}{}{}", path_str, separator, current_path));
            }
        }

        for (key, value) in &env_mods.set_variables {
            opts = opts.with_env(key, value);
        }
    }

    let output = process::execute_shell(&command, Some(opts))
        .await
        .map_err(|e| e.to_string())?;

    Ok(output.into())
}

/// Check which version of a program would be used
#[tauri::command]
pub async fn which_program(
    program: String,
    env_type: Option<String>,
    env_version: Option<String>,
    cwd: Option<String>,
    registry: State<'_, SharedRegistry>,
) -> Result<Option<String>, String> {
    // If no env_type, just use system which
    if env_type.is_none() {
        return Ok(process::which(&program).await);
    }

    let env_type = env_type.unwrap();
    let manager = EnvironmentManager::new(registry.inner().clone());

    let version = if let Some(v) = env_version {
        v
    } else if let Some(cwd) = &cwd {
        manager
            .detect_version(&env_type, std::path::Path::new(cwd))
            .await
            .map_err(|e| e.to_string())?
            .map(|d| d.version)
            .ok_or_else(|| format!("No {} version detected", env_type))?
    } else {
        return Err("Either env_version or cwd required".into());
    };

    let env_mods = manager
        .get_env_modifications(&env_type, &version)
        .await
        .map_err(|e| e.to_string())?;

    // Check in the environment's bin path first
    for bin_path in &env_mods.path_prepend {
        #[cfg(windows)]
        let extensions = vec!["", ".exe", ".cmd", ".bat"];
        #[cfg(not(windows))]
        let extensions = vec![""];

        for ext in &extensions {
            let full_path = bin_path.join(format!("{}{}", program, ext));
            if full_path.exists() {
                return Ok(full_path.to_str().map(|s| s.to_string()));
            }
        }
    }

    // Fallback to system which
    Ok(process::which(&program).await)
}
