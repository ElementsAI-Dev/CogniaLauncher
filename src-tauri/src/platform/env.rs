use std::collections::HashMap;
use std::env;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{CogniaError, CogniaResult};

#[derive(Debug, Clone, Default)]
pub struct EnvModifications {
    pub path_prepend: Vec<PathBuf>,
    pub path_append: Vec<PathBuf>,
    pub set_variables: HashMap<String, String>,
    pub unset_variables: Vec<String>,
}

impl EnvModifications {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn prepend_path(mut self, path: impl Into<PathBuf>) -> Self {
        self.path_prepend.push(path.into());
        self
    }

    pub fn append_path(mut self, path: impl Into<PathBuf>) -> Self {
        self.path_append.push(path.into());
        self
    }

    pub fn set_var(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.set_variables.insert(key.into(), value.into());
        self
    }

    pub fn unset_var(mut self, key: impl Into<String>) -> Self {
        self.unset_variables.push(key.into());
        self
    }

    pub fn apply(&self) {
        for var in &self.unset_variables {
            env::remove_var(var);
        }

        for (key, value) in &self.set_variables {
            env::set_var(key, value);
        }

        if !self.path_prepend.is_empty() || !self.path_append.is_empty() {
            let mut paths: Vec<PathBuf> = self.path_prepend.clone();

            if let Some(current_path) = env::var_os("PATH") {
                paths.extend(env::split_paths(&current_path));
            }

            paths.extend(self.path_append.clone());

            if let Ok(new_path) = env::join_paths(&paths) {
                env::set_var("PATH", new_path);
            }
        }
    }

    pub fn to_shell_commands(&self, shell: ShellType) -> String {
        let mut commands = Vec::new();

        for var in &self.unset_variables {
            commands.push(match shell {
                ShellType::Bash | ShellType::Zsh => format!("unset {}", var),
                ShellType::Fish => format!("set -e {}", var),
                ShellType::PowerShell => format!("Remove-Item Env:{}", var),
                ShellType::Cmd => format!("set {}=", var),
                ShellType::Nushell => format!("hide-env {}", var),
            });
        }

        for (key, value) in &self.set_variables {
            commands.push(match shell {
                ShellType::Bash | ShellType::Zsh => format!("export {}=\"{}\"", key, value),
                ShellType::Fish => format!("set -gx {} \"{}\"", key, value),
                ShellType::PowerShell => format!("$env:{} = \"{}\"", key, value),
                ShellType::Cmd => format!("set {}={}", key, value),
                ShellType::Nushell => format!("$env.{} = \"{}\"", key, value),
            });
        }

        if !self.path_prepend.is_empty() || !self.path_append.is_empty() {
            let prepend_str: Vec<String> = self
                .path_prepend
                .iter()
                .map(|p| p.display().to_string())
                .collect();
            let append_str: Vec<String> = self
                .path_append
                .iter()
                .map(|p| p.display().to_string())
                .collect();

            let path_cmd = match shell {
                ShellType::Bash | ShellType::Zsh => {
                    let mut parts = Vec::new();
                    if !prepend_str.is_empty() {
                        parts.push(prepend_str.join(":"));
                    }
                    parts.push("$PATH".to_string());
                    if !append_str.is_empty() {
                        parts.push(append_str.join(":"));
                    }
                    format!("export PATH=\"{}\"", parts.join(":"))
                }
                ShellType::Fish => {
                    let mut cmds = Vec::new();
                    for p in &prepend_str {
                        cmds.push(format!("fish_add_path --prepend \"{}\"", p));
                    }
                    for p in &append_str {
                        cmds.push(format!("fish_add_path --append \"{}\"", p));
                    }
                    cmds.join("\n")
                }
                ShellType::PowerShell => {
                    let mut parts = Vec::new();
                    if !prepend_str.is_empty() {
                        parts.push(prepend_str.join(";"));
                    }
                    parts.push("$env:PATH".to_string());
                    if !append_str.is_empty() {
                        parts.push(append_str.join(";"));
                    }
                    format!("$env:PATH = \"{}\"", parts.join(";"))
                }
                ShellType::Cmd => {
                    let mut parts = Vec::new();
                    if !prepend_str.is_empty() {
                        parts.push(prepend_str.join(";"));
                    }
                    parts.push("%PATH%".to_string());
                    if !append_str.is_empty() {
                        parts.push(append_str.join(";"));
                    }
                    format!("set PATH={}", parts.join(";"))
                }
                ShellType::Nushell => {
                    let mut cmds = Vec::new();
                    for p in &prepend_str {
                        cmds.push(format!("$env.PATH = ($env.PATH | prepend \"{}\")", p));
                    }
                    for p in &append_str {
                        cmds.push(format!("$env.PATH = ($env.PATH | append \"{}\")", p));
                    }
                    cmds.join("\n")
                }
            };
            commands.push(path_cmd);
        }

        commands.join("\n")
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ShellType {
    Bash,
    Zsh,
    Fish,
    PowerShell,
    Cmd,
    Nushell,
}

impl ShellType {
    pub fn detect() -> Self {
        if let Ok(shell) = env::var("SHELL") {
            if shell.contains("nu") && !shell.contains("bash") {
                return ShellType::Nushell;
            }
            if shell.contains("zsh") {
                return ShellType::Zsh;
            }
            if shell.contains("fish") {
                return ShellType::Fish;
            }
            if shell.contains("bash") {
                return ShellType::Bash;
            }
        }

        #[cfg(windows)]
        {
            if env::var("PSModulePath").is_ok() {
                return ShellType::PowerShell;
            }
            ShellType::Cmd
        }

        #[cfg(not(windows))]
        ShellType::Bash
    }

    /// Unique string identifier for this shell type
    pub fn id(&self) -> &'static str {
        match self {
            ShellType::Bash => "bash",
            ShellType::Zsh => "zsh",
            ShellType::Fish => "fish",
            ShellType::PowerShell => "powershell",
            ShellType::Cmd => "cmd",
            ShellType::Nushell => "nushell",
        }
    }

    /// Human-readable display name
    pub fn display_name(&self) -> &'static str {
        match self {
            ShellType::Bash => "Bash",
            ShellType::Zsh => "Zsh",
            ShellType::Fish => "Fish",
            ShellType::PowerShell => "PowerShell",
            ShellType::Cmd => "Command Prompt",
            ShellType::Nushell => "Nushell",
        }
    }

    /// Parse from string id
    pub fn from_id(id: &str) -> Option<Self> {
        match id {
            "bash" => Some(ShellType::Bash),
            "zsh" => Some(ShellType::Zsh),
            "fish" => Some(ShellType::Fish),
            "powershell" | "pwsh" => Some(ShellType::PowerShell),
            "cmd" => Some(ShellType::Cmd),
            "nushell" | "nu" => Some(ShellType::Nushell),
            _ => None,
        }
    }

    /// Primary config file path (backward-compatible)
    pub fn config_file(&self) -> Option<PathBuf> {
        self.config_files().into_iter().next()
    }

    /// All config files for this shell type
    pub fn config_files(&self) -> Vec<PathBuf> {
        let home = match dirs_home() {
            Some(h) => h,
            None => return vec![],
        };

        match self {
            ShellType::Bash => vec![
                home.join(".bashrc"),
                home.join(".bash_profile"),
                home.join(".profile"),
            ],
            ShellType::Zsh => vec![
                home.join(".zshrc"),
                home.join(".zprofile"),
                home.join(".zshenv"),
            ],
            ShellType::Fish => vec![home.join(".config/fish/config.fish")],
            ShellType::PowerShell => {
                #[cfg(windows)]
                {
                    vec![
                        home.join("Documents/PowerShell/Microsoft.PowerShell_profile.ps1"),
                        home.join("Documents/PowerShell/profile.ps1"),
                        home.join("Documents/WindowsPowerShell/Microsoft.PowerShell_profile.ps1"),
                    ]
                }
                #[cfg(not(windows))]
                {
                    vec![
                        home.join(".config/powershell/Microsoft.PowerShell_profile.ps1"),
                        home.join(".config/powershell/profile.ps1"),
                    ]
                }
            }
            ShellType::Cmd => vec![],
            ShellType::Nushell => {
                #[cfg(windows)]
                {
                    if let Ok(appdata) = env::var("APPDATA") {
                        vec![
                            PathBuf::from(&appdata).join("nushell").join("config.nu"),
                            PathBuf::from(&appdata).join("nushell").join("env.nu"),
                        ]
                    } else {
                        vec![]
                    }
                }
                #[cfg(not(windows))]
                {
                    vec![
                        home.join(".config/nushell/config.nu"),
                        home.join(".config/nushell/env.nu"),
                    ]
                }
            }
        }
    }

    /// Get the executable path for this shell type on the current platform
    pub fn executable_path(&self) -> Option<String> {
        match self {
            #[cfg(windows)]
            ShellType::Cmd => Some("cmd.exe".to_string()),
            #[cfg(windows)]
            ShellType::PowerShell => {
                // Prefer PowerShell Core (pwsh) over Windows PowerShell
                if which::which("pwsh").is_ok() {
                    Some("pwsh".to_string())
                } else {
                    Some("powershell".to_string())
                }
            }
            #[cfg(not(windows))]
            ShellType::PowerShell => which::which("pwsh").ok().map(|p| p.display().to_string()),
            #[cfg(not(windows))]
            ShellType::Cmd => None,
            ShellType::Bash => which::which("bash").ok().map(|p| p.display().to_string()),
            ShellType::Zsh => which::which("zsh").ok().map(|p| p.display().to_string()),
            ShellType::Fish => which::which("fish").ok().map(|p| p.display().to_string()),
            ShellType::Nushell => which::which("nu").ok().map(|p| p.display().to_string()),
        }
    }
}

pub fn get_var(key: &str) -> Option<String> {
    env::var(key).ok()
}

pub fn set_var(key: &str, value: &str) {
    env::set_var(key, value);
}

pub fn remove_var(key: &str) {
    env::remove_var(key);
}

pub fn get_path() -> Vec<PathBuf> {
    env::var_os("PATH")
        .map(|path| env::split_paths(&path).collect())
        .unwrap_or_default()
}

pub fn expand_path(path: &str) -> String {
    let mut result = path.to_string();

    if result.starts_with('~') {
        if let Some(home) = dirs_home() {
            result = result.replacen('~', &home.display().to_string(), 1);
        }
    }

    #[cfg(windows)]
    {
        let re = regex::Regex::new(r"%([^%]+)%").unwrap();
        result = re
            .replace_all(&result, |caps: &regex::Captures| {
                env::var(&caps[1]).unwrap_or_else(|_| caps[0].to_string())
            })
            .to_string();
    }

    #[cfg(not(windows))]
    {
        let re = regex::Regex::new(r"\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?").unwrap();
        result = re
            .replace_all(&result, |caps: &regex::Captures| {
                env::var(&caps[1]).unwrap_or_else(|_| caps[0].to_string())
            })
            .to_string();
    }

    result
}

// ============================================================================
// Environment Variable Scope & Types
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EnvVarScope {
    Process,
    User,
    System,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EnvFileFormat {
    Dotenv,
    Shell,
    Fish,
    #[serde(rename = "powershell")]
    PowerShell,
    Nushell,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellProfileInfo {
    pub shell: String,
    pub config_path: String,
    pub exists: bool,
    pub is_current: bool,
}

// ============================================================================
// Process-level helpers
// ============================================================================

pub fn get_all_vars() -> HashMap<String, String> {
    env::vars().collect()
}

// ============================================================================
// Persistent env var operations (cross-platform)
// ============================================================================

pub async fn get_persistent_var(key: &str, scope: EnvVarScope) -> CogniaResult<Option<String>> {
    match scope {
        EnvVarScope::Process => Ok(env::var(key).ok()),
        EnvVarScope::User | EnvVarScope::System => get_persistent_var_platform(key, scope).await,
    }
}

pub async fn set_persistent_var(key: &str, value: &str, scope: EnvVarScope) -> CogniaResult<()> {
    match scope {
        EnvVarScope::Process => {
            env::set_var(key, value);
            Ok(())
        }
        EnvVarScope::User | EnvVarScope::System => {
            set_persistent_var_platform(key, value, scope).await
        }
    }
}

pub async fn remove_persistent_var(key: &str, scope: EnvVarScope) -> CogniaResult<()> {
    match scope {
        EnvVarScope::Process => {
            env::remove_var(key);
            Ok(())
        }
        EnvVarScope::User | EnvVarScope::System => remove_persistent_var_platform(key, scope).await,
    }
}

// ============================================================================
// Persistent PATH operations
// ============================================================================

pub async fn get_persistent_path(scope: EnvVarScope) -> CogniaResult<Vec<String>> {
    match scope {
        EnvVarScope::Process => Ok(get_path().iter().map(|p| p.display().to_string()).collect()),
        EnvVarScope::User | EnvVarScope::System => get_persistent_path_platform(scope).await,
    }
}

pub async fn set_persistent_path(entries: &[String], scope: EnvVarScope) -> CogniaResult<()> {
    match scope {
        EnvVarScope::Process => {
            let sep = if cfg!(windows) { ";" } else { ":" };
            let joined = entries.join(sep);
            env::set_var("PATH", &joined);
            Ok(())
        }
        EnvVarScope::User | EnvVarScope::System => {
            set_persistent_path_platform(entries, scope).await
        }
    }
}

// ============================================================================
// List persistent vars (cross-platform)
// ============================================================================

pub async fn list_persistent_vars(scope: EnvVarScope) -> CogniaResult<Vec<(String, String)>> {
    match scope {
        EnvVarScope::Process => {
            let mut v: Vec<(String, String)> = get_all_vars().into_iter().collect();
            v.sort_by(|a, b| a.0.cmp(&b.0));
            Ok(v)
        }
        EnvVarScope::User | EnvVarScope::System => list_persistent_vars_platform(scope).await,
    }
}

#[cfg(windows)]
async fn list_persistent_vars_platform(
    scope: EnvVarScope,
) -> CogniaResult<Vec<(String, String)>> {
    let regkey = open_env_regkey(scope, false)?;
    let mut result = Vec::new();
    for item in regkey.enum_values() {
        match item {
            Ok((name, value)) => {
                let val_str = match value.vtype {
                    winreg::enums::RegType::REG_SZ | winreg::enums::RegType::REG_EXPAND_SZ => {
                        String::from_utf8_lossy(&value.bytes)
                            .trim_end_matches('\0')
                            .to_string()
                    }
                    _ => continue,
                };
                result.push((name, val_str));
            }
            Err(_) => continue,
        }
    }
    result.sort_by(|a, b| a.0.cmp(&b.0));
    Ok(result)
}

#[cfg(not(windows))]
async fn list_persistent_vars_platform(
    scope: EnvVarScope,
) -> CogniaResult<Vec<(String, String)>> {
    match scope {
        EnvVarScope::System => {
            // Linux: parse /etc/environment
            #[cfg(target_os = "linux")]
            {
                let content = tokio::fs::read_to_string("/etc/environment")
                    .await
                    .unwrap_or_default();
                let mut result: Vec<(String, String)> = parse_env_file(&content);
                result.sort_by(|a, b| a.0.cmp(&b.0));
                return Ok(result);
            }
            // macOS: no /etc/environment equivalent for arbitrary vars
            #[cfg(not(target_os = "linux"))]
            {
                Ok(Vec::new())
            }
        }
        EnvVarScope::User => {
            let shell = ShellType::detect();
            if let Some(rc_path) = shell.config_file() {
                if rc_path.exists() {
                    let content = tokio::fs::read_to_string(&rc_path)
                        .await
                        .map_err(CogniaError::Io)?;
                    let mut result = parse_env_file(&content);
                    result.sort_by(|a, b| a.0.cmp(&b.0));
                    return Ok(result);
                }
            }
            Ok(Vec::new())
        }
        _ => unreachable!(),
    }
}

// ============================================================================
// Shell profile detection
// ============================================================================

pub fn list_shell_profiles() -> Vec<ShellProfileInfo> {
    let current_shell = ShellType::detect();
    let mut profiles = Vec::new();

    let shells = [
        ShellType::Bash,
        ShellType::Zsh,
        ShellType::Fish,
        ShellType::PowerShell,
        ShellType::Cmd,
        ShellType::Nushell,
    ];

    for shell in &shells {
        if let Some(config_path) = shell.config_file() {
            let exists = config_path.exists();
            let name = shell.id();
            profiles.push(ShellProfileInfo {
                shell: name.to_string(),
                config_path: config_path.display().to_string(),
                exists,
                is_current: *shell == current_shell,
            });
        }
    }

    profiles
}

pub fn read_shell_profile(path: &str) -> CogniaResult<String> {
    let path = Path::new(path);

    // Security: only allow reading known shell config files
    let known_names = [
        ".bashrc",
        ".bash_profile",
        ".profile",
        ".zshrc",
        ".zprofile",
        ".zshenv",
        "config.fish",
        "Microsoft.PowerShell_profile.ps1",
        "profile.ps1",
        "config.nu",
        "env.nu",
    ];
    let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
    if !known_names.contains(&file_name) {
        return Err(CogniaError::PermissionDenied(
            "Only known shell configuration files can be read".to_string(),
        ));
    }

    if !path.exists() {
        return Ok(String::new());
    }

    std::fs::read_to_string(path).map_err(CogniaError::Io)
}

// ============================================================================
// .env file parsing & generation
// ============================================================================

pub fn parse_env_file(content: &str) -> Vec<(String, String)> {
    let mut result = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();

        // Skip empty lines and comments
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        // Strip optional "export " prefix
        let stripped = if let Some(rest) = trimmed.strip_prefix("export ") {
            rest
        } else if let Some(rest) = trimmed.strip_prefix("set -gx ") {
            // fish: set -gx KEY "VALUE"
            if let Some(space_pos) = rest.find(' ') {
                let key = &rest[..space_pos];
                let value = rest[space_pos + 1..].trim();
                let value = strip_quotes(value);
                result.push((key.to_string(), value.to_string()));
                continue;
            }
            continue;
        } else if let Some(rest) = trimmed.strip_prefix("$env:") {
            // PowerShell: $env:KEY = "VALUE"
            if let Some(eq_pos) = rest.find('=') {
                let key = rest[..eq_pos].trim().to_string();
                let value = rest[eq_pos + 1..].trim();
                let value = strip_quotes(value);
                result.push((key, value.to_string()));
                continue;
            }
            continue;
        } else {
            trimmed
        };

        // Split on first '='
        if let Some(eq_pos) = stripped.find('=') {
            let key = stripped[..eq_pos].trim().to_string();
            let value = stripped[eq_pos + 1..].trim();
            let value = strip_quotes(value);
            if !key.is_empty() {
                result.push((key, value.to_string()));
            }
        }
    }

    result
}

fn strip_quotes(s: &str) -> &str {
    if (s.starts_with('"') && s.ends_with('"')) || (s.starts_with('\'') && s.ends_with('\'')) {
        &s[1..s.len() - 1]
    } else {
        s
    }
}

pub fn generate_env_file(vars: &[(String, String)], format: EnvFileFormat) -> String {
    let mut lines = Vec::new();

    match format {
        EnvFileFormat::Dotenv => {
            for (key, value) in vars {
                if value.contains(' ') || value.contains('"') || value.contains('\'') {
                    let escaped = value.replace('\\', "\\\\").replace('"', "\\\"");
                    lines.push(format!("{}=\"{}\"", key, escaped));
                } else {
                    lines.push(format!("{}={}", key, value));
                }
            }
        }
        EnvFileFormat::Shell => {
            for (key, value) in vars {
                let escaped = value.replace('\\', "\\\\").replace('"', "\\\"");
                lines.push(format!("export {}=\"{}\"", key, escaped));
            }
        }
        EnvFileFormat::Fish => {
            for (key, value) in vars {
                let escaped = value.replace('\\', "\\\\").replace('"', "\\\"");
                lines.push(format!("set -gx {} \"{}\"", key, escaped));
            }
        }
        EnvFileFormat::PowerShell => {
            for (key, value) in vars {
                let escaped = value.replace('`', "``").replace('"', "`\"");
                lines.push(format!("$env:{} = \"{}\"", key, escaped));
            }
        }
        EnvFileFormat::Nushell => {
            for (key, value) in vars {
                let escaped = value.replace('\\', "\\\\").replace('"', "\\\"");
                lines.push(format!("$env.{} = \"{}\"", key, escaped));
            }
        }
    }

    lines.join("\n")
}

// ============================================================================
// Platform-specific implementations
// ============================================================================

#[cfg(windows)]
fn open_env_regkey(
    scope: EnvVarScope,
    write: bool,
) -> CogniaResult<winreg::RegKey> {
    use winreg::enums::*;
    use winreg::RegKey;

    let (hive, subkey) = match scope {
        EnvVarScope::User => (HKEY_CURRENT_USER, "Environment"),
        EnvVarScope::System => (
            HKEY_LOCAL_MACHINE,
            r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment",
        ),
        _ => unreachable!(),
    };

    let predefined = RegKey::predef(hive);
    if write {
        predefined
            .open_subkey_with_flags(subkey, KEY_READ | KEY_WRITE)
            .map_err(|e| CogniaError::Internal(format!("Registry open failed: {}", e)))
    } else {
        predefined
            .open_subkey(subkey)
            .map_err(|e| CogniaError::Internal(format!("Registry open failed: {}", e)))
    }
}

#[cfg(windows)]
fn broadcast_env_change() {
    use windows_sys::Win32::UI::WindowsAndMessaging::*;

    let env_wide: Vec<u16> = "Environment\0".encode_utf16().collect();
    unsafe {
        SendMessageTimeoutW(
            HWND_BROADCAST,
            WM_SETTINGCHANGE,
            0,
            env_wide.as_ptr() as isize,
            SMTO_ABORTIFHUNG,
            5000,
            std::ptr::null_mut(),
        );
    }
}

#[cfg(windows)]
async fn get_persistent_var_platform(
    key: &str,
    scope: EnvVarScope,
) -> CogniaResult<Option<String>> {
    let regkey = open_env_regkey(scope, false)?;
    match regkey.get_value::<String, _>(key) {
        Ok(val) => {
            if val.is_empty() {
                Ok(None)
            } else {
                Ok(Some(val))
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(CogniaError::Internal(format!(
            "Registry read failed: {}",
            e
        ))),
    }
}

#[cfg(not(windows))]
async fn get_persistent_var_platform(
    key: &str,
    scope: EnvVarScope,
) -> CogniaResult<Option<String>> {
    match scope {
        EnvVarScope::System => {
            // Read from /etc/environment
            let content = tokio::fs::read_to_string("/etc/environment")
                .await
                .unwrap_or_default();
            for line in content.lines() {
                let trimmed = line.trim();
                if let Some(eq_pos) = trimmed.find('=') {
                    let k = trimmed[..eq_pos].trim();
                    if k == key {
                        let v = trimmed[eq_pos + 1..].trim();
                        return Ok(Some(strip_quotes(v).to_string()));
                    }
                }
            }
            Ok(None)
        }
        EnvVarScope::User => {
            let shell = ShellType::detect();
            if let Some(rc_path) = shell.config_file() {
                if rc_path.exists() {
                    let content = tokio::fs::read_to_string(&rc_path)
                        .await
                        .map_err(CogniaError::Io)?;
                    return Ok(find_var_in_shell_content(&content, key, &shell));
                }
            }
            Ok(None)
        }
        _ => unreachable!(),
    }
}

#[cfg(not(windows))]
fn find_var_in_shell_content(content: &str, key: &str, shell: &ShellType) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        match shell {
            ShellType::Fish => {
                let pattern = format!("set -gx {} ", key);
                if trimmed.starts_with(&pattern) {
                    let val = &trimmed[pattern.len()..];
                    return Some(strip_quotes(val.trim()).to_string());
                }
            }
            ShellType::Nushell => {
                let pattern = format!("$env.{} = ", key);
                if trimmed.starts_with(&pattern) {
                    let val = &trimmed[pattern.len()..];
                    return Some(strip_quotes(val.trim()).to_string());
                }
            }
            ShellType::PowerShell => {
                let pattern = format!("$env:{} = ", key);
                if let Some(rest) = trimmed.strip_prefix(&pattern) {
                    return Some(strip_quotes(rest.trim()).to_string());
                }
                let pattern_nospace = format!("$env:{}=", key);
                if let Some(rest) = trimmed.strip_prefix(&pattern_nospace) {
                    return Some(strip_quotes(rest.trim()).to_string());
                }
            }
            _ => {
                // Bash/Zsh: export KEY=VALUE
                let pattern = format!("export {}=", key);
                if trimmed.starts_with(&pattern) {
                    let val = &trimmed[pattern.len()..];
                    return Some(strip_quotes(val.trim()).to_string());
                }
            }
        }
    }
    None
}

#[cfg(windows)]
async fn set_persistent_var_platform(
    key: &str,
    value: &str,
    scope: EnvVarScope,
) -> CogniaResult<()> {
    let regkey = open_env_regkey(scope, true)?;
    regkey
        .set_value(key, &value)
        .map_err(|e| CogniaError::Internal(format!("Registry write failed: {}", e)))?;
    broadcast_env_change();
    Ok(())
}

#[cfg(not(windows))]
async fn set_persistent_var_platform(
    key: &str,
    value: &str,
    scope: EnvVarScope,
) -> CogniaResult<()> {
    match scope {
        EnvVarScope::System => upsert_etc_environment(key, value).await,
        EnvVarScope::User => {
            let shell = ShellType::detect();
            let rc_path = shell.config_file().ok_or_else(|| {
                CogniaError::Internal("Cannot determine shell config file".into())
            })?;
            upsert_shell_rc_var(&rc_path, key, value, &shell).await
        }
        _ => unreachable!(),
    }
}

#[cfg(windows)]
async fn remove_persistent_var_platform(key: &str, scope: EnvVarScope) -> CogniaResult<()> {
    let regkey = open_env_regkey(scope, true)?;
    match regkey.delete_value(key) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => {
            return Err(CogniaError::Internal(format!(
                "Registry delete failed: {}",
                e
            )));
        }
    }
    broadcast_env_change();
    Ok(())
}

#[cfg(not(windows))]
async fn remove_persistent_var_platform(key: &str, scope: EnvVarScope) -> CogniaResult<()> {
    match scope {
        EnvVarScope::System => remove_etc_environment_var(key).await,
        EnvVarScope::User => {
            let shell = ShellType::detect();
            let rc_path = shell.config_file().ok_or_else(|| {
                CogniaError::Internal("Cannot determine shell config file".into())
            })?;
            remove_shell_rc_var(&rc_path, key, &shell).await
        }
        _ => unreachable!(),
    }
}

// ============================================================================
// Platform-specific PATH implementations
// ============================================================================

#[cfg(windows)]
async fn get_persistent_path_platform(scope: EnvVarScope) -> CogniaResult<Vec<String>> {
    let regkey = open_env_regkey(scope, false)?;
    match regkey.get_value::<String, _>("Path") {
        Ok(val) => {
            let val = val.trim();
            if val.is_empty() {
                Ok(Vec::new())
            } else {
                Ok(val
                    .split(';')
                    .filter(|s| !s.is_empty())
                    .map(|s| s.to_string())
                    .collect())
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(e) => Err(CogniaError::Internal(format!(
            "Registry read PATH failed: {}",
            e
        ))),
    }
}

#[cfg(not(windows))]
async fn get_persistent_path_platform(scope: EnvVarScope) -> CogniaResult<Vec<String>> {
    match scope {
        EnvVarScope::System => {
            let mut entries = Vec::new();
            // macOS: /etc/paths + /etc/paths.d/*
            #[cfg(target_os = "macos")]
            {
                if let Ok(content) = tokio::fs::read_to_string("/etc/paths").await {
                    for line in content.lines() {
                        let trimmed = line.trim();
                        if !trimmed.is_empty() {
                            entries.push(trimmed.to_string());
                        }
                    }
                }
                if let Ok(mut dir) = tokio::fs::read_dir("/etc/paths.d").await {
                    while let Ok(Some(entry)) = dir.next_entry().await {
                        if let Ok(content) = tokio::fs::read_to_string(entry.path()).await {
                            for line in content.lines() {
                                let trimmed = line.trim();
                                if !trimmed.is_empty() {
                                    entries.push(trimmed.to_string());
                                }
                            }
                        }
                    }
                }
            }
            // Linux: parse PATH from /etc/environment
            #[cfg(target_os = "linux")]
            {
                if let Ok(content) = tokio::fs::read_to_string("/etc/environment").await {
                    for line in content.lines() {
                        let trimmed = line.trim();
                        if trimmed.starts_with("PATH=") {
                            let val = strip_quotes(&trimmed[5..]);
                            entries.extend(
                                val.split(':')
                                    .filter(|s| !s.is_empty())
                                    .map(|s| s.to_string()),
                            );
                            break;
                        }
                    }
                }
            }
            Ok(entries)
        }
        EnvVarScope::User => {
            let shell = ShellType::detect();
            if let Some(rc_path) = shell.config_file() {
                if rc_path.exists() {
                    let content = tokio::fs::read_to_string(&rc_path)
                        .await
                        .map_err(CogniaError::Io)?;
                    if let Some(val) = find_var_in_shell_content(&content, "PATH", &shell) {
                        let sep = ':';
                        let parts: Vec<String> = val
                            .split(sep)
                            .filter(|s| {
                                !s.is_empty()
                                    && !s.contains("$PATH")
                                    && !s.contains("${PATH}")
                                    && !s.contains("$env.PATH")
                            })
                            .map(|s| s.to_string())
                            .collect();
                        return Ok(parts);
                    }
                }
            }
            Ok(Vec::new())
        }
        _ => unreachable!(),
    }
}

#[cfg(windows)]
async fn set_persistent_path_platform(entries: &[String], scope: EnvVarScope) -> CogniaResult<()> {
    let regkey = open_env_regkey(scope, true)?;
    let joined = entries.join(";");
    regkey
        .set_value("Path", &joined)
        .map_err(|e| CogniaError::Internal(format!("Registry write PATH failed: {}", e)))?;
    broadcast_env_change();
    Ok(())
}

#[cfg(not(windows))]
async fn set_persistent_path_platform(entries: &[String], scope: EnvVarScope) -> CogniaResult<()> {
    match scope {
        EnvVarScope::System => {
            #[cfg(target_os = "macos")]
            {
                let content = entries.join("\n") + "\n";
                tokio::fs::write("/etc/paths.d/cognia", content)
                    .await
                    .map_err(|e| {
                        CogniaError::PermissionDenied(format!(
                            "Cannot write /etc/paths.d/cognia: {}",
                            e
                        ))
                    })?;
            }
            #[cfg(target_os = "linux")]
            {
                let path_line = format!("PATH=\"{}\"", entries.join(":"));
                upsert_etc_environment("PATH", &entries.join(":")).await?;
                let _ = path_line; // suppress unused warning
            }
            Ok(())
        }
        EnvVarScope::User => {
            let shell = ShellType::detect();
            let rc_path = shell.config_file().ok_or_else(|| {
                CogniaError::Internal("Cannot determine shell config file".into())
            })?;
            let path_value = entries.join(":");
            upsert_shell_rc_var(&rc_path, "PATH", &format!("{}:$PATH", path_value), &shell).await
        }
        _ => unreachable!(),
    }
}

// ============================================================================
// Unix shell rc file helpers
// ============================================================================

#[cfg(not(windows))]
async fn upsert_shell_rc_var(
    rc_path: &Path,
    key: &str,
    value: &str,
    shell: &ShellType,
) -> CogniaResult<()> {
    let content = if rc_path.exists() {
        tokio::fs::read_to_string(rc_path)
            .await
            .map_err(CogniaError::Io)?
    } else {
        String::new()
    };

    let (pattern, new_line) = match shell {
        ShellType::Fish => {
            let escaped = value.replace('\\', "\\\\").replace('"', "\\\"");
            (
                format!("set -gx {} ", key),
                format!("set -gx {} \"{}\"", key, escaped),
            )
        }
        ShellType::Nushell => {
            let escaped = value.replace('\\', "\\\\").replace('"', "\\\"");
            (
                format!("$env.{} = ", key),
                format!("$env.{} = \"{}\"", key, escaped),
            )
        }
        ShellType::PowerShell => {
            let escaped = value.replace('`', "``").replace('"', "`\"");
            (
                format!("$env:{} = ", key),
                format!("$env:{} = \"{}\"", key, escaped),
            )
        }
        _ => {
            let escaped = value.replace('\\', "\\\\").replace('"', "\\\"");
            (
                format!("export {}=", key),
                format!("export {}=\"{}\"", key, escaped),
            )
        }
    };

    let mut lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();
    let mut found = false;
    for line in &mut lines {
        if line.trim().starts_with(&pattern) {
            *line = new_line.clone();
            found = true;
            break;
        }
    }
    if !found {
        lines.push(new_line);
    }

    let mut output = lines.join("\n");
    if !output.ends_with('\n') {
        output.push('\n');
    }
    tokio::fs::write(rc_path, output)
        .await
        .map_err(CogniaError::Io)
}

#[cfg(not(windows))]
async fn remove_shell_rc_var(rc_path: &Path, key: &str, shell: &ShellType) -> CogniaResult<()> {
    if !rc_path.exists() {
        return Ok(());
    }

    let content = tokio::fs::read_to_string(rc_path)
        .await
        .map_err(CogniaError::Io)?;

    let patterns: Vec<String> = match shell {
        ShellType::Fish => vec![format!("set -gx {} ", key)],
        ShellType::Nushell => vec![format!("$env.{} = ", key), format!("$env.{} =", key)],
        ShellType::PowerShell => vec![format!("$env:{} = ", key), format!("$env:{}=", key)],
        _ => vec![format!("export {}=", key)],
    };

    let lines: Vec<&str> = content
        .lines()
        .filter(|line| {
            let trimmed = line.trim();
            !patterns.iter().any(|p| trimmed.starts_with(p))
        })
        .collect();

    let mut output = lines.join("\n");
    if !output.ends_with('\n') && !output.is_empty() {
        output.push('\n');
    }
    tokio::fs::write(rc_path, output)
        .await
        .map_err(CogniaError::Io)
}

#[cfg(not(windows))]
async fn upsert_etc_environment(key: &str, value: &str) -> CogniaResult<()> {
    let etc_env = Path::new("/etc/environment");
    let content = if etc_env.exists() {
        tokio::fs::read_to_string(etc_env)
            .await
            .map_err(CogniaError::Io)?
    } else {
        String::new()
    };

    let pattern = format!("{}=", key);
    let new_line = if value.contains(' ') || value.contains(':') {
        format!("{}=\"{}\"", key, value)
    } else {
        format!("{}={}", key, value)
    };

    let mut lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();
    let mut found = false;
    for line in &mut lines {
        if line.trim().starts_with(&pattern) {
            *line = new_line.clone();
            found = true;
            break;
        }
    }
    if !found {
        lines.push(new_line);
    }

    let mut output = lines.join("\n");
    if !output.ends_with('\n') {
        output.push('\n');
    }
    tokio::fs::write(etc_env, output)
        .await
        .map_err(|e| CogniaError::PermissionDenied(format!("Cannot write /etc/environment: {}", e)))
}

#[cfg(not(windows))]
async fn remove_etc_environment_var(key: &str) -> CogniaResult<()> {
    let etc_env = Path::new("/etc/environment");
    if !etc_env.exists() {
        return Ok(());
    }

    let content = tokio::fs::read_to_string(etc_env)
        .await
        .map_err(CogniaError::Io)?;
    let pattern = format!("{}=", key);

    let lines: Vec<&str> = content
        .lines()
        .filter(|line| !line.trim().starts_with(&pattern))
        .collect();

    let mut output = lines.join("\n");
    if !output.ends_with('\n') && !output.is_empty() {
        output.push('\n');
    }
    tokio::fs::write(etc_env, output)
        .await
        .map_err(|e| CogniaError::PermissionDenied(format!("Cannot write /etc/environment: {}", e)))
}

pub fn dirs_home() -> Option<PathBuf> {
    directories::BaseDirs::new().map(|dirs| dirs.home_dir().to_path_buf())
}

pub fn current_platform() -> Platform {
    #[cfg(target_os = "windows")]
    return Platform::Windows;

    #[cfg(target_os = "macos")]
    return Platform::MacOS;

    #[cfg(target_os = "linux")]
    return Platform::Linux;

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    return Platform::Unknown;
}

pub fn current_arch() -> Architecture {
    #[cfg(target_arch = "x86_64")]
    return Architecture::X86_64;

    #[cfg(target_arch = "aarch64")]
    return Architecture::Aarch64;

    #[cfg(target_arch = "x86")]
    return Architecture::X86;

    #[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64", target_arch = "x86")))]
    return Architecture::Unknown;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Platform {
    Windows,
    MacOS,
    Linux,
    Unknown,
}

impl Platform {
    pub fn as_str(&self) -> &'static str {
        match self {
            Platform::Windows => "windows",
            Platform::MacOS => "macos",
            Platform::Linux => "linux",
            Platform::Unknown => "unknown",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Architecture {
    X86_64,
    Aarch64,
    X86,
    Unknown,
}

impl Architecture {
    pub fn as_str(&self) -> &'static str {
        match self {
            Architecture::X86_64 => "x86_64",
            Architecture::Aarch64 => "aarch64",
            Architecture::X86 => "x86",
            Architecture::Unknown => "unknown",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LibcType {
    Glibc,
    Musl,
    Unknown,
}

impl LibcType {
    pub fn as_str(&self) -> &'static str {
        match self {
            LibcType::Glibc => "glibc",
            LibcType::Musl => "musl",
            LibcType::Unknown => "unknown",
        }
    }
}

/// Detect the libc type on Linux systems
#[cfg(target_os = "linux")]
pub fn detect_libc() -> LibcType {
    use std::process::Command;

    // Method 1: Check ldd --version output
    if let Ok(output) = Command::new("ldd").arg("--version").output() {
        let combined = format!(
            "{}{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        if combined.contains("musl") {
            return LibcType::Musl;
        }
        if combined.contains("GLIBC") || combined.contains("GNU libc") {
            return LibcType::Glibc;
        }
    }

    // Method 2: Check for musl dynamic linker
    let musl_paths = [
        "/lib/ld-musl-x86_64.so.1",
        "/lib/ld-musl-aarch64.so.1",
        "/lib/ld-musl-armhf.so.1",
        "/lib/ld-musl-i386.so.1",
    ];
    for path in musl_paths {
        if std::path::Path::new(path).exists() {
            return LibcType::Musl;
        }
    }

    // Default to glibc on Linux
    LibcType::Glibc
}

/// Detect the libc type (non-Linux always returns Unknown)
#[cfg(not(target_os = "linux"))]
pub fn detect_libc() -> LibcType {
    LibcType::Unknown
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_env_modifications() {
        let mods = EnvModifications::new()
            .set_var("TEST_VAR", "test_value")
            .prepend_path("/test/path");

        assert_eq!(
            mods.set_variables.get("TEST_VAR"),
            Some(&"test_value".to_string())
        );
        assert_eq!(mods.path_prepend.len(), 1);
    }

    #[test]
    fn test_shell_commands() {
        let mods = EnvModifications::new().set_var("FOO", "bar");

        let bash_cmd = mods.to_shell_commands(ShellType::Bash);
        assert!(bash_cmd.contains("export FOO=\"bar\""));

        let fish_cmd = mods.to_shell_commands(ShellType::Fish);
        assert!(fish_cmd.contains("set -gx FOO \"bar\""));
    }

    #[test]
    fn test_expand_path() {
        let expanded = expand_path("~/test");
        assert!(!expanded.starts_with('~'));
    }

    #[test]
    fn test_platform_detection() {
        let platform = current_platform();
        assert_ne!(platform, Platform::Unknown);
    }

    #[test]
    fn test_get_all_vars() {
        let vars = get_all_vars();
        assert!(!vars.is_empty());
        // PATH (or Path on Windows) should always be present
        assert!(vars.contains_key("PATH") || vars.contains_key("Path"));
    }

    #[test]
    fn test_parse_env_file_standard() {
        let content = "FOO=bar\nBAZ=qux";
        let result = parse_env_file(content);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0], ("FOO".to_string(), "bar".to_string()));
        assert_eq!(result[1], ("BAZ".to_string(), "qux".to_string()));
    }

    #[test]
    fn test_parse_env_file_comments() {
        let content = "# This is a comment\nFOO=bar\n# Another comment\nBAZ=qux";
        let result = parse_env_file(content);
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_parse_env_file_quotes() {
        let content = "FOO=\"hello world\"\nBAR='single quoted'";
        let result = parse_env_file(content);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].1, "hello world");
        assert_eq!(result[1].1, "single quoted");
    }

    #[test]
    fn test_parse_env_file_empty_lines() {
        let content = "\nFOO=bar\n\n\nBAZ=qux\n";
        let result = parse_env_file(content);
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_parse_env_file_no_value() {
        let content = "FOO=";
        let result = parse_env_file(content);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].1, "");
    }

    #[test]
    fn test_parse_env_file_export_prefix() {
        let content = "export FOO=bar\nexport BAZ=\"hello\"";
        let result = parse_env_file(content);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0], ("FOO".to_string(), "bar".to_string()));
        assert_eq!(result[1], ("BAZ".to_string(), "hello".to_string()));
    }

    #[test]
    fn test_parse_env_file_powershell() {
        let content = "$env:FOO = \"bar\"";
        let result = parse_env_file(content);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0], ("FOO".to_string(), "bar".to_string()));
    }

    #[test]
    fn test_parse_env_file_fish() {
        let content = "set -gx FOO \"bar\"";
        let result = parse_env_file(content);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0], ("FOO".to_string(), "bar".to_string()));
    }

    #[test]
    fn test_generate_env_file_dotenv() {
        let vars = vec![
            ("FOO".to_string(), "bar".to_string()),
            ("BAZ".to_string(), "hello world".to_string()),
        ];
        let output = generate_env_file(&vars, EnvFileFormat::Dotenv);
        assert!(output.contains("FOO=bar"));
        assert!(output.contains("BAZ=\"hello world\""));
    }

    #[test]
    fn test_generate_env_file_shell() {
        let vars = vec![("FOO".to_string(), "bar".to_string())];
        let output = generate_env_file(&vars, EnvFileFormat::Shell);
        assert!(output.contains("export FOO=\"bar\""));
    }

    #[test]
    fn test_generate_env_file_fish() {
        let vars = vec![("FOO".to_string(), "bar".to_string())];
        let output = generate_env_file(&vars, EnvFileFormat::Fish);
        assert!(output.contains("set -gx FOO \"bar\""));
    }

    #[test]
    fn test_generate_env_file_powershell() {
        let vars = vec![("FOO".to_string(), "bar".to_string())];
        let output = generate_env_file(&vars, EnvFileFormat::PowerShell);
        assert!(output.contains("$env:FOO = \"bar\""));
    }

    #[test]
    fn test_list_shell_profiles() {
        let profiles = list_shell_profiles();
        // Should return at least one profile on any OS
        assert!(!profiles.is_empty());
        // Exactly one should be current
        let current_count = profiles.iter().filter(|p| p.is_current).count();
        assert_eq!(current_count, 1);
    }

    #[test]
    fn test_strip_quotes() {
        assert_eq!(strip_quotes("\"hello\""), "hello");
        assert_eq!(strip_quotes("'world'"), "world");
        assert_eq!(strip_quotes("no quotes"), "no quotes");
        assert_eq!(strip_quotes("\"mismatched'"), "\"mismatched'");
    }

    #[test]
    fn test_nushell_shell_type_roundtrip() {
        assert_eq!(ShellType::from_id("nushell"), Some(ShellType::Nushell));
        assert_eq!(ShellType::from_id("nu"), Some(ShellType::Nushell));
        assert_eq!(ShellType::Nushell.id(), "nushell");
        assert_eq!(ShellType::Nushell.display_name(), "Nushell");
    }

    #[test]
    fn test_nushell_shell_commands() {
        let mods = EnvModifications::new().set_var("FOO", "bar");
        let nu_cmd = mods.to_shell_commands(ShellType::Nushell);
        assert!(nu_cmd.contains("$env.FOO = \"bar\""));

        let mods2 = EnvModifications::new().unset_var("BAZ");
        let nu_unset = mods2.to_shell_commands(ShellType::Nushell);
        assert!(nu_unset.contains("hide-env BAZ"));
    }

    #[test]
    fn test_nushell_path_commands() {
        let mods = EnvModifications::new()
            .prepend_path("/usr/local/bin")
            .append_path("/opt/bin");
        let nu_cmd = mods.to_shell_commands(ShellType::Nushell);
        assert!(nu_cmd.contains("$env.PATH = ($env.PATH | prepend \"/usr/local/bin\")"));
        assert!(nu_cmd.contains("$env.PATH = ($env.PATH | append \"/opt/bin\")"));
    }

    #[test]
    fn test_generate_env_file_nushell() {
        let vars = vec![("FOO".to_string(), "bar".to_string())];
        let output = generate_env_file(&vars, EnvFileFormat::Nushell);
        assert!(output.contains("$env.FOO = \"bar\""));
    }

    #[cfg(not(windows))]
    #[test]
    fn test_find_var_in_shell_content_bash() {
        let content = "# comment\nexport MY_VAR=\"hello world\"\nexport OTHER=123";
        let result = find_var_in_shell_content(content, "MY_VAR", &ShellType::Bash);
        assert_eq!(result, Some("hello world".to_string()));

        let result2 = find_var_in_shell_content(content, "MISSING", &ShellType::Bash);
        assert_eq!(result2, None);
    }

    #[cfg(not(windows))]
    #[test]
    fn test_find_var_in_shell_content_fish() {
        let content = "set -gx MY_VAR \"hello\"\nset -gx PATH /usr/bin";
        let result = find_var_in_shell_content(content, "MY_VAR", &ShellType::Fish);
        assert_eq!(result, Some("hello".to_string()));
    }

    #[cfg(not(windows))]
    #[test]
    fn test_find_var_in_shell_content_nushell() {
        let content = "$env.MY_VAR = \"hello\"\n$env.PATH = \"/usr/bin\"";
        let result = find_var_in_shell_content(content, "MY_VAR", &ShellType::Nushell);
        assert_eq!(result, Some("hello".to_string()));
    }

    #[cfg(not(windows))]
    #[test]
    fn test_find_var_in_shell_content_powershell() {
        let content = "$env:MY_VAR = \"hello\"\n$env:PATH = \"/usr/bin\"";
        let result = find_var_in_shell_content(content, "MY_VAR", &ShellType::PowerShell);
        assert_eq!(result, Some("hello".to_string()));

        // Also test without spaces around =
        let content2 = "$env:FOO=\"bar\"";
        let result2 = find_var_in_shell_content(content2, "FOO", &ShellType::PowerShell);
        assert_eq!(result2, Some("bar".to_string()));
    }

    #[test]
    fn test_parse_env_file_etc_environment() {
        let content = "PATH=\"/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin\"\nLANG=en_US.UTF-8\n# comment\nFOO=\"bar baz\"";
        let result = parse_env_file(content);
        assert_eq!(result.len(), 3);
        assert_eq!(result[0].0, "PATH");
        assert!(result[0].1.contains("/usr/local/sbin"));
        assert_eq!(result[1], ("LANG".to_string(), "en_US.UTF-8".to_string()));
        assert_eq!(result[2], ("FOO".to_string(), "bar baz".to_string()));
    }

    #[test]
    fn test_deduplicate_path_logic() {
        use std::collections::HashSet;

        // Case-sensitive dedup (Unix)
        let entries = vec![
            "/usr/bin".to_string(),
            "/usr/local/bin".to_string(),
            "/usr/bin".to_string(),
            "/USR/BIN".to_string(),
        ];
        let mut seen = HashSet::new();
        let deduped: Vec<String> = entries
            .into_iter()
            .filter(|e| seen.insert(e.clone()))
            .collect();
        // On case-sensitive: /usr/bin and /USR/BIN are different
        assert_eq!(deduped.len(), 3);
        assert_eq!(deduped[0], "/usr/bin");
        assert_eq!(deduped[1], "/usr/local/bin");
        assert_eq!(deduped[2], "/USR/BIN");
    }

    #[test]
    fn test_deduplicate_path_case_insensitive() {
        use std::collections::HashSet;

        // Case-insensitive dedup (Windows-style)
        let entries = vec![
            "C:\\Windows".to_string(),
            "C:\\Users".to_string(),
            "c:\\windows".to_string(),
        ];
        let mut seen = HashSet::new();
        let deduped: Vec<String> = entries
            .into_iter()
            .filter(|e| seen.insert(e.to_lowercase()))
            .collect();
        assert_eq!(deduped.len(), 2);
        assert_eq!(deduped[0], "C:\\Windows");
        assert_eq!(deduped[1], "C:\\Users");
    }
}
