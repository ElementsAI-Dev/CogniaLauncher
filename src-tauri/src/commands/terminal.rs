use crate::config::Settings;
use crate::core::terminal::{
    self, PSModuleInfo, PSProfileInfo, PSScriptInfo, ShellConfigEntries, ShellFrameworkInfo,
    ShellInfo, ShellPlugin, TerminalProfile, TerminalProfileManager,
};
use crate::core::EnvironmentManager;
use crate::platform::env::{EnvModifications, ShellType};
use crate::platform::process::ProcessOptions;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

use super::launch::LaunchResult;

pub type SharedSettings = Arc<RwLock<Settings>>;
pub type SharedTerminalProfileManager = Arc<RwLock<TerminalProfileManager>>;

/// Resolve the effective proxy URL based on terminal settings and global network settings.
/// Returns (proxy_url, no_proxy) tuple.
fn resolve_proxy(settings: &Settings) -> (Option<String>, Option<String>) {
    match settings.terminal.proxy_mode.as_str() {
        "none" => (None, None),
        "custom" => (
            settings.terminal.custom_proxy.clone(),
            settings.terminal.no_proxy.clone(),
        ),
        _ => (
            settings.network.proxy.clone(),
            settings.terminal.no_proxy.clone(),
        ),
    }
}

/// Build proxy environment variables from resolved proxy settings.
fn build_proxy_env_vars(
    proxy: &Option<String>,
    no_proxy: &Option<String>,
) -> HashMap<String, String> {
    let mut env = HashMap::new();
    if let Some(ref url) = proxy {
        if !url.is_empty() {
            env.insert("HTTP_PROXY".to_string(), url.clone());
            env.insert("http_proxy".to_string(), url.clone());
            env.insert("HTTPS_PROXY".to_string(), url.clone());
            env.insert("https_proxy".to_string(), url.clone());
        }
    }
    if let Some(ref np) = no_proxy {
        if !np.is_empty() {
            env.insert("NO_PROXY".to_string(), np.clone());
            env.insert("no_proxy".to_string(), np.clone());
        }
    }
    env
}

fn resolve_profile_shell_with_detected(
    profile: &TerminalProfile,
    detected_shells: &[ShellInfo],
) -> Result<(ShellType, String), String> {
    if let Some(shell) = detected_shells.iter().find(|s| s.id == profile.shell_id) {
        return Ok((shell.shell_type, shell.executable_path.clone()));
    }

    let shell_type = ShellType::from_id(&profile.shell_id)
        .ok_or_else(|| format!("Unknown shell type: {}", profile.shell_id))?;
    let executable = shell_type
        .executable_path()
        .ok_or_else(|| format!("Shell '{}' not found on system", profile.shell_id))?;

    Ok((shell_type, executable))
}

async fn resolve_profile_shell(profile: &TerminalProfile) -> Result<(ShellType, String), String> {
    let detected_shells = terminal::detect_installed_shells()
        .await
        .map_err(|e| e.to_string())?;
    resolve_profile_shell_with_detected(profile, &detected_shells)
}

fn build_profile_args(profile: &TerminalProfile, shell_type: ShellType) -> Vec<String> {
    let mut args = profile.args.clone();

    if let Some(cmd) = profile
        .startup_command
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        match shell_type {
            ShellType::Bash | ShellType::Zsh | ShellType::Fish => {
                args.push("-c".to_string());
                args.push(cmd.to_string());
            }
            ShellType::PowerShell => {
                args.push("-Command".to_string());
                args.push(cmd.to_string());
            }
            ShellType::Cmd => {
                args.push("/C".to_string());
                args.push(cmd.to_string());
            }
        }
    }

    args
}

fn apply_env_entries(mut options: ProcessOptions, env: &HashMap<String, String>) -> ProcessOptions {
    for (key, value) in env {
        options = options.with_env(key, value);
    }
    options
}

fn apply_env_modifications(
    mut options: ProcessOptions,
    env_modifications: &EnvModifications,
) -> ProcessOptions {
    if !env_modifications.path_prepend.is_empty() || !env_modifications.path_append.is_empty() {
        let mut path_segments: Vec<String> = env_modifications
            .path_prepend
            .iter()
            .map(|path| path.to_string_lossy().to_string())
            .collect();

        let current_path = std::env::var("PATH").unwrap_or_default();
        if !current_path.is_empty() {
            path_segments.push(current_path);
        }

        path_segments.extend(
            env_modifications
                .path_append
                .iter()
                .map(|path| path.to_string_lossy().to_string()),
        );

        let separator = if cfg!(windows) { ";" } else { ":" };
        options = options.with_env("PATH", path_segments.join(separator));
    }

    for (key, value) in &env_modifications.set_variables {
        options = options.with_env(key, value);
    }

    options
}

async fn build_launch_options(
    profile: &TerminalProfile,
    settings: &Settings,
    registry: crate::SharedRegistry,
) -> Result<ProcessOptions, String> {
    let mut options = ProcessOptions::new().with_timeout(std::time::Duration::from_secs(300));

    if let Some(cwd) = profile
        .cwd
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        options = options.with_cwd(cwd);
    }

    if let Some(env_type) = profile
        .env_type
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        let manager = EnvironmentManager::new(registry);
        let resolved_version = if let Some(version) = profile
            .env_version
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            version.to_string()
        } else {
            let cwd = profile
                .cwd
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| {
                    format!(
                        "Profile '{}' requires envVersion or cwd when envType is set",
                        profile.name
                    )
                })?;

            manager
                .detect_version(env_type, Path::new(cwd))
                .await
                .map_err(|e| e.to_string())?
                .map(|detected| detected.version)
                .ok_or_else(|| format!("No {} version detected for '{}'", env_type, cwd))?
        };

        let env_modifications = manager
            .get_env_modifications(env_type, &resolved_version, None)
            .await
            .map_err(|e| e.to_string())?;
        options = apply_env_modifications(options, &env_modifications);
    }

    let (proxy, no_proxy) = resolve_proxy(settings);
    let proxy_env = build_proxy_env_vars(&proxy, &no_proxy);

    options = apply_env_entries(options, &proxy_env);
    options = apply_env_entries(options, &profile.env_vars);

    Ok(options)
}

async fn launch_profile_internal(
    profile: &TerminalProfile,
    settings: &Settings,
    registry: crate::SharedRegistry,
) -> Result<LaunchResult, String> {
    let (shell_type, executable) = resolve_profile_shell(profile).await?;
    let args = build_profile_args(profile, shell_type);
    let options = build_launch_options(profile, settings, registry).await?;
    let args_ref: Vec<&str> = args.iter().map(|arg| arg.as_str()).collect();

    let output = crate::platform::process::execute(&executable, &args_ref, Some(options))
        .await
        .map_err(|e| e.to_string())?;

    Ok(output.into())
}

fn legacy_launch_stdout(result: LaunchResult) -> String {
    result.stdout
}

// ============================================================================
// Shell Detection
// ============================================================================

#[tauri::command]
pub async fn terminal_detect_shells() -> Result<Vec<ShellInfo>, String> {
    terminal::detect_installed_shells()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn terminal_get_shell_info(shell_id: String) -> Result<ShellInfo, String> {
    let shells = terminal::detect_installed_shells()
        .await
        .map_err(|e| e.to_string())?;

    shells
        .into_iter()
        .find(|s| s.id == shell_id)
        .ok_or_else(|| format!("Shell '{}' not found", shell_id))
}

// ============================================================================
// Terminal Profiles
// ============================================================================

#[tauri::command]
pub async fn terminal_list_profiles(
    manager: State<'_, SharedTerminalProfileManager>,
) -> Result<Vec<TerminalProfile>, String> {
    let mgr = manager.read().await;
    Ok(mgr.list_profiles().to_vec())
}

#[tauri::command]
pub async fn terminal_get_profile(
    id: String,
    manager: State<'_, SharedTerminalProfileManager>,
) -> Result<TerminalProfile, String> {
    let mgr = manager.read().await;
    mgr.get_profile(&id)
        .cloned()
        .ok_or_else(|| format!("Profile '{}' not found", id))
}

#[tauri::command]
pub async fn terminal_create_profile(
    profile: TerminalProfile,
    manager: State<'_, SharedTerminalProfileManager>,
) -> Result<String, String> {
    let mut mgr = manager.write().await;
    mgr.create_profile(profile).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn terminal_update_profile(
    profile: TerminalProfile,
    manager: State<'_, SharedTerminalProfileManager>,
) -> Result<(), String> {
    let mut mgr = manager.write().await;
    mgr.update_profile(profile).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn terminal_delete_profile(
    id: String,
    manager: State<'_, SharedTerminalProfileManager>,
) -> Result<bool, String> {
    let mut mgr = manager.write().await;
    mgr.delete_profile(&id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn terminal_get_default_profile(
    manager: State<'_, SharedTerminalProfileManager>,
) -> Result<Option<TerminalProfile>, String> {
    let mgr = manager.read().await;
    Ok(mgr.get_default_profile().cloned())
}

#[tauri::command]
pub async fn terminal_set_default_profile(
    id: String,
    manager: State<'_, SharedTerminalProfileManager>,
) -> Result<(), String> {
    let mut mgr = manager.write().await;
    mgr.set_default_profile(&id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn terminal_launch_profile(
    id: String,
    manager: State<'_, SharedTerminalProfileManager>,
    settings: State<'_, SharedSettings>,
    registry: State<'_, crate::SharedRegistry>,
) -> Result<String, String> {
    let profile = {
        let manager_guard = manager.read().await;
        manager_guard
            .get_profile(&id)
            .cloned()
            .ok_or_else(|| format!("Profile '{}' not found", id))?
    };
    let settings_snapshot = settings.read().await.clone();
    let result =
        launch_profile_internal(&profile, &settings_snapshot, registry.inner().clone()).await?;
    Ok(legacy_launch_stdout(result))
}

#[tauri::command]
pub async fn terminal_launch_profile_detailed(
    id: String,
    manager: State<'_, SharedTerminalProfileManager>,
    settings: State<'_, SharedSettings>,
    registry: State<'_, crate::SharedRegistry>,
) -> Result<LaunchResult, String> {
    let profile = {
        let manager_guard = manager.read().await;
        manager_guard
            .get_profile(&id)
            .cloned()
            .ok_or_else(|| format!("Profile '{}' not found", id))?
    };
    let settings_snapshot = settings.read().await.clone();
    launch_profile_internal(&profile, &settings_snapshot, registry.inner().clone()).await
}

#[tauri::command]
pub async fn terminal_get_proxy_env_vars(
    settings: State<'_, SharedSettings>,
) -> Result<Vec<(String, String)>, String> {
    let settings_guard = settings.read().await;
    let (proxy, no_proxy) = resolve_proxy(&settings_guard);
    let env = build_proxy_env_vars(&proxy, &no_proxy);
    let mut result: Vec<(String, String)> = env.into_iter().collect();
    result.sort_by(|a, b| a.0.cmp(&b.0));
    Ok(result)
}

// ============================================================================
// Shell Config
// ============================================================================

#[tauri::command]
pub async fn terminal_read_config(path: String) -> Result<String, String> {
    terminal::read_shell_config(&PathBuf::from(&path))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn terminal_backup_config(path: String) -> Result<String, String> {
    terminal::backup_shell_config(&PathBuf::from(&path))
        .await
        .map(|p| p.display().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn terminal_append_to_config(path: String, content: String) -> Result<(), String> {
    terminal::append_to_shell_config(&PathBuf::from(&path), &content)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn terminal_get_config_entries(
    path: String,
    shell_type: ShellType,
) -> Result<ShellConfigEntries, String> {
    let content = terminal::read_shell_config(&PathBuf::from(&path))
        .await
        .map_err(|e| e.to_string())?;
    Ok(terminal::parse_shell_config(&content, shell_type))
}

// ============================================================================
// PowerShell Management
// ============================================================================

#[tauri::command]
pub async fn terminal_ps_list_profiles() -> Result<Vec<PSProfileInfo>, String> {
    terminal::ps_list_profiles()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn terminal_ps_read_profile(scope: String) -> Result<String, String> {
    terminal::ps_read_profile(&scope)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn terminal_ps_write_profile(scope: String, content: String) -> Result<(), String> {
    terminal::ps_write_profile(&scope, &content)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn terminal_ps_get_execution_policy() -> Result<Vec<(String, String)>, String> {
    terminal::ps_get_execution_policy()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn terminal_ps_set_execution_policy(policy: String, scope: String) -> Result<(), String> {
    terminal::ps_set_execution_policy(&policy, &scope)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn terminal_ps_list_all_modules() -> Result<Vec<PSModuleInfo>, String> {
    terminal::ps_list_all_modules()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn terminal_ps_get_module_detail(name: String) -> Result<PSModuleInfo, String> {
    terminal::ps_get_module_detail(&name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn terminal_ps_list_installed_scripts() -> Result<Vec<PSScriptInfo>, String> {
    terminal::ps_list_installed_scripts()
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Shell Framework & Plugins
// ============================================================================

#[tauri::command]
pub async fn terminal_detect_framework(
    shell_type: ShellType,
) -> Result<Vec<ShellFrameworkInfo>, String> {
    Ok(terminal::detect_shell_framework(shell_type))
}

#[tauri::command]
pub async fn terminal_list_plugins(
    framework_name: String,
    framework_path: String,
    shell_type: ShellType,
) -> Result<Vec<ShellPlugin>, String> {
    let framework = ShellFrameworkInfo {
        name: framework_name,
        version: None,
        path: framework_path,
        shell_type,
    };
    Ok(terminal::list_shell_plugins(&framework, None))
}

#[tauri::command]
pub async fn terminal_get_shell_env_vars() -> Result<Vec<(String, String)>, String> {
    let mut vars: Vec<(String, String)> = std::env::vars()
        .filter(|(key, _)| {
            let k = key.to_uppercase();
            k == "PATH"
                || k == "HOME"
                || k == "SHELL"
                || k == "TERM"
                || k == "EDITOR"
                || k == "VISUAL"
                || k == "LANG"
                || k == "LC_ALL"
                || k.starts_with("XDG_")
                || k.starts_with("CARGO_")
                || k.starts_with("RUST")
                || k.starts_with("NODE_")
                || k.starts_with("NPM_")
                || k.starts_with("PYTHON")
                || k.starts_with("VIRTUAL_ENV")
                || k.starts_with("CONDA_")
                || k.starts_with("JAVA_")
                || k.starts_with("GO")
                || k.starts_with("RUBY")
                || k.starts_with("GEM_")
                || k == "NVM_DIR"
                || k == "PYENV_ROOT"
                || k == "SDKMAN_DIR"
                || k == "VOLTA_HOME"
                || k == "PNPM_HOME"
                || k == "BUN_INSTALL"
                || k == "DENO_DIR"
                || k.starts_with("PSMODULE")
                || k == "COMSPEC"
                || k == "USERPROFILE"
                || k == "APPDATA"
                || k == "LOCALAPPDATA"
        })
        .collect();
    vars.sort_by(|a, b| a.0.cmp(&b.0));
    Ok(vars)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::platform::env::ShellType;
    use std::path::PathBuf;

    fn make_profile(shell_id: &str) -> TerminalProfile {
        TerminalProfile {
            id: "profile-1".to_string(),
            name: "Test Profile".to_string(),
            shell_id: shell_id.to_string(),
            args: vec![],
            env_vars: HashMap::new(),
            cwd: None,
            startup_command: None,
            env_type: None,
            env_version: None,
            is_default: false,
            created_at: "".to_string(),
            updated_at: "".to_string(),
        }
    }

    #[test]
    fn resolve_profile_shell_prefers_detected_shell_ids() {
        let profile = make_profile("gitbash");
        let detected_shells = vec![ShellInfo {
            id: "gitbash".to_string(),
            name: "Git Bash".to_string(),
            shell_type: ShellType::Bash,
            version: Some("5.2.0".to_string()),
            executable_path: "C:\\Program Files\\Git\\bin\\bash.exe".to_string(),
            config_files: vec![],
            is_default: false,
        }];

        let (shell_type, executable) =
            resolve_profile_shell_with_detected(&profile, &detected_shells).unwrap();
        assert_eq!(shell_type, ShellType::Bash);
        assert_eq!(executable, "C:\\Program Files\\Git\\bin\\bash.exe");
    }

    #[test]
    fn build_launch_options_applies_cwd_and_env_precedence() {
        let mut settings = Settings::default();
        settings.terminal.proxy_mode = "custom".to_string();
        settings.terminal.custom_proxy = Some("http://127.0.0.1:7890".to_string());
        settings.terminal.no_proxy = Some("localhost".to_string());

        let mut profile = make_profile("powershell");
        profile.cwd = Some("C:\\workspace".to_string());
        profile.env_vars.insert(
            "HTTP_PROXY".to_string(),
            "http://profile-proxy:8080".to_string(),
        );

        let options = tokio_test::block_on(build_launch_options(
            &profile,
            &settings,
            Arc::new(RwLock::new(crate::provider::ProviderRegistry::new())),
        ))
        .unwrap();

        assert_eq!(options.cwd, Some("C:\\workspace".to_string()));
        assert_eq!(
            options.env.get("HTTP_PROXY").cloned(),
            Some("http://profile-proxy:8080".to_string())
        );
        assert_eq!(
            options.env.get("HTTPS_PROXY").cloned(),
            Some("http://127.0.0.1:7890".to_string())
        );
        assert_eq!(
            options.env.get("NO_PROXY").cloned(),
            Some("localhost".to_string())
        );
    }

    #[test]
    fn build_launch_options_requires_env_context_for_env_type() {
        let mut profile = make_profile("powershell");
        profile.env_type = Some("node".to_string());
        profile.env_version = None;
        profile.cwd = None;

        let error = tokio_test::block_on(build_launch_options(
            &profile,
            &Settings::default(),
            Arc::new(RwLock::new(crate::provider::ProviderRegistry::new())),
        ))
        .unwrap_err();

        assert!(error.contains("envVersion or cwd"));
    }

    #[test]
    fn build_launch_options_with_env_version_hits_env_manager_path() {
        let mut profile = make_profile("powershell");
        profile.env_type = Some("node".to_string());
        profile.env_version = Some("20.10.0".to_string());
        profile.cwd = Some("C:\\workspace".to_string());

        let error = tokio_test::block_on(build_launch_options(
            &profile,
            &Settings::default(),
            Arc::new(RwLock::new(crate::provider::ProviderRegistry::new())),
        ))
        .unwrap_err();

        assert!(error.to_lowercase().contains("node"));
    }

    #[test]
    fn legacy_launch_stdout_matches_detailed_stdout() {
        let detailed = LaunchResult {
            exit_code: 0,
            stdout: "hello".to_string(),
            stderr: "warn".to_string(),
            success: true,
        };
        assert_eq!(legacy_launch_stdout(detailed), "hello");
    }

    #[test]
    fn apply_env_modifications_sets_path_and_variables() {
        let mut env_modifications = EnvModifications::new();
        env_modifications
            .path_prepend
            .push(PathBuf::from("D:/tool/bin"));
        env_modifications
            .path_append
            .push(PathBuf::from("D:/extra/bin"));
        env_modifications
            .set_variables
            .insert("TEST_ENV".to_string(), "ok".to_string());

        let options = apply_env_modifications(ProcessOptions::new(), &env_modifications);
        let path_value = options.env.get("PATH").cloned().unwrap_or_default();
        let separator = if cfg!(windows) { ';' } else { ':' };
        let parts: Vec<&str> = path_value.split(separator).collect();
        assert!(!parts.is_empty());
        assert_eq!(parts[0], "D:/tool/bin");
        assert!(path_value.contains("D:/extra/bin"));
        assert_eq!(options.env.get("TEST_ENV"), Some(&"ok".to_string()));
    }
}
