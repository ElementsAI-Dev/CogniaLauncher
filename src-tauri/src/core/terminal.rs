use crate::error::{CogniaError, CogniaResult};
use crate::platform::env::{dirs_home, ShellType};
use crate::platform::{fs, process};
use chrono::Utc;
use log::debug;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

// ============================================================================
// Shell Detection
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellConfigFile {
    pub path: String,
    pub exists: bool,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellInfo {
    pub id: String,
    pub name: String,
    pub shell_type: ShellType,
    pub version: Option<String>,
    pub executable_path: String,
    pub config_files: Vec<ShellConfigFile>,
    pub is_default: bool,
}

/// Detect all installed shells on the current system
pub async fn detect_installed_shells() -> CogniaResult<Vec<ShellInfo>> {
    #[cfg(windows)]
    {
        detect_shells_windows().await
    }
    #[cfg(not(windows))]
    {
        detect_shells_unix().await
    }
}

#[cfg(windows)]
async fn detect_shells_windows() -> CogniaResult<Vec<ShellInfo>> {
    let mut shells = Vec::new();
    let default_shell = ShellType::detect();

    // cmd.exe — always available on Windows
    shells.push(
        build_shell_info(
            "cmd",
            "Command Prompt",
            ShellType::Cmd,
            "cmd.exe".to_string(),
            default_shell == ShellType::Cmd,
        )
        .await,
    );

    // Windows PowerShell (powershell.exe)
    if let Ok(output) = process::execute(
        "powershell",
        &[
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "$PSVersionTable.PSVersion.ToString()",
        ],
        Some(process::ProcessOptions::new().with_timeout(std::time::Duration::from_secs(5))),
    )
    .await
    {
        if output.success {
            let version = output.stdout.trim().to_string();
            let mut info = build_shell_info(
                "powershell",
                "Windows PowerShell",
                ShellType::PowerShell,
                "powershell.exe".to_string(),
                default_shell == ShellType::PowerShell,
            )
            .await;
            info.version = Some(version);
            shells.push(info);
        }
    }

    // PowerShell Core (pwsh.exe)
    if which::which("pwsh").is_ok() {
        if let Ok(output) = process::execute(
            "pwsh",
            &[
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "$PSVersionTable.PSVersion.ToString()",
            ],
            Some(process::ProcessOptions::new().with_timeout(std::time::Duration::from_secs(5))),
        )
        .await
        {
            if output.success {
                let version = output.stdout.trim().to_string();
                let mut info = build_shell_info(
                    "pwsh",
                    &format!("PowerShell {}", version.split('.').next().unwrap_or("7")),
                    ShellType::PowerShell,
                    which::which("pwsh").unwrap().display().to_string(),
                    false,
                )
                .await;
                info.version = Some(version);
                shells.push(info);
            }
        }
    }

    // Git Bash
    let git_bash_paths = [
        r"C:\Program Files\Git\bin\bash.exe",
        r"C:\Program Files (x86)\Git\bin\bash.exe",
    ];
    for path in &git_bash_paths {
        if Path::new(path).exists() {
            let version = get_shell_version(path, &["--version"]).await;
            let mut info = build_shell_info(
                "gitbash",
                "Git Bash",
                ShellType::Bash,
                path.to_string(),
                false,
            )
            .await;
            info.version = version;
            shells.push(info);
            break;
        }
    }

    Ok(shells)
}

#[cfg(not(windows))]
async fn detect_shells_unix() -> CogniaResult<Vec<ShellInfo>> {
    let mut shells = Vec::new();
    let default_shell = ShellType::detect();
    let mut seen = std::collections::HashSet::new();

    // Parse /etc/shells
    if let Ok(content) = tokio::fs::read_to_string("/etc/shells").await {
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            let path = PathBuf::from(line);
            if !path.exists() {
                continue;
            }

            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            let shell_type = match name {
                "bash" => ShellType::Bash,
                "zsh" => ShellType::Zsh,
                "fish" => ShellType::Fish,
                "pwsh" => ShellType::PowerShell,
                _ => continue,
            };

            let id = shell_type.id().to_string();
            if seen.contains(&id) {
                continue;
            }
            seen.insert(id.clone());

            let version_args: &[&str] = match shell_type {
                ShellType::Bash => &["--version"],
                ShellType::Zsh => &["--version"],
                ShellType::Fish => &["--version"],
                ShellType::PowerShell => &[
                    "-NoProfile",
                    "-NonInteractive",
                    "-Command",
                    "$PSVersionTable.PSVersion.ToString()",
                ],
                _ => &["--version"],
            };
            let version = get_shell_version(line, version_args).await;
            let is_default = shell_type == default_shell;

            let mut info = build_shell_info(
                &id,
                shell_type.display_name(),
                shell_type,
                line.to_string(),
                is_default,
            )
            .await;
            info.version = version;
            shells.push(info);
        }
    }

    // Check for pwsh if not found in /etc/shells
    if !seen.contains("powershell") {
        if let Ok(pwsh_path) = which::which("pwsh") {
            let version = get_shell_version(
                pwsh_path.to_str().unwrap_or("pwsh"),
                &[
                    "-NoProfile",
                    "-NonInteractive",
                    "-Command",
                    "$PSVersionTable.PSVersion.ToString()",
                ],
            )
            .await;
            let mut info = build_shell_info(
                "powershell",
                "PowerShell",
                ShellType::PowerShell,
                pwsh_path.display().to_string(),
                false,
            )
            .await;
            info.version = version;
            shells.push(info);
        }
    }

    Ok(shells)
}

async fn build_shell_info(
    id: &str,
    name: &str,
    shell_type: ShellType,
    executable_path: String,
    is_default: bool,
) -> ShellInfo {
    let config_files = shell_type
        .config_files()
        .into_iter()
        .map(|p| {
            let exists = p.exists();
            let size_bytes = if exists {
                std::fs::metadata(&p).map(|m| m.len()).unwrap_or(0)
            } else {
                0
            };
            ShellConfigFile {
                path: p.display().to_string(),
                exists,
                size_bytes,
            }
        })
        .collect();

    ShellInfo {
        id: id.to_string(),
        name: name.to_string(),
        shell_type,
        version: None,
        executable_path,
        config_files,
        is_default,
    }
}

async fn get_shell_version(executable: &str, args: &[&str]) -> Option<String> {
    let opts = Some(process::ProcessOptions::new().with_timeout(std::time::Duration::from_secs(5)));
    match process::execute(executable, args, opts).await {
        Ok(output) if output.success => {
            let text = output.stdout.trim().to_string();
            // Extract version number from common patterns
            // "GNU bash, version 5.2.15(1)-release" -> "5.2.15"
            // "zsh 5.9 (x86_64-pc-linux-gnu)" -> "5.9"
            // "fish, version 3.6.1" -> "3.6.1"
            let re = Regex::new(r"(\d+\.\d+[\.\d]*)").ok()?;
            re.find(&text)
                .map(|m| m.as_str().to_string())
                .or(Some(text))
        }
        _ => None,
    }
}

// ============================================================================
// Terminal Profiles
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalProfile {
    pub id: String,
    pub name: String,
    pub shell_id: String,
    pub args: Vec<String>,
    #[serde(default)]
    pub env_vars: HashMap<String, String>,
    pub cwd: Option<String>,
    pub startup_command: Option<String>,
    pub env_type: Option<String>,
    pub env_version: Option<String>,
    pub is_default: bool,
    pub created_at: String,
    pub updated_at: String,
}

pub struct TerminalProfileManager {
    profiles_path: PathBuf,
    profiles: Vec<TerminalProfile>,
}

impl TerminalProfileManager {
    pub async fn new(base_dir: &Path) -> CogniaResult<Self> {
        let profiles_dir = base_dir.join("terminal");
        fs::create_dir_all(&profiles_dir)
            .await
            .map_err(|e| CogniaError::Internal(format!("Failed to create terminal dir: {}", e)))?;
        let profiles_path = profiles_dir.join("profiles.json");

        let profiles = if fs::exists(&profiles_path).await {
            let content = fs::read_file_string(&profiles_path)
                .await
                .map_err(|e| CogniaError::Internal(format!("Failed to read profiles: {}", e)))?;
            serde_json::from_str(&content).map_err(|e| {
                CogniaError::Config(format!("Failed to parse terminal profiles: {}", e))
            })?
        } else {
            Vec::new()
        };

        Ok(Self {
            profiles_path,
            profiles,
        })
    }

    async fn save(&self) -> CogniaResult<()> {
        let content = serde_json::to_string_pretty(&self.profiles).map_err(|e| {
            CogniaError::Config(format!("Failed to serialize terminal profiles: {}", e))
        })?;
        fs::write_file_string(&self.profiles_path, &content)
            .await
            .map_err(|e| CogniaError::Internal(format!("Failed to save profiles: {}", e)))?;
        Ok(())
    }

    pub fn list_profiles(&self) -> &[TerminalProfile] {
        &self.profiles
    }

    pub fn get_profile(&self, id: &str) -> Option<&TerminalProfile> {
        self.profiles.iter().find(|p| p.id == id)
    }

    pub async fn create_profile(&mut self, mut profile: TerminalProfile) -> CogniaResult<String> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        profile.id = id.clone();
        profile.created_at = now.clone();
        profile.updated_at = now;

        if profile.is_default {
            for p in &mut self.profiles {
                p.is_default = false;
            }
        }

        self.profiles.push(profile);
        self.save().await?;
        Ok(id)
    }

    pub async fn update_profile(&mut self, profile: TerminalProfile) -> CogniaResult<()> {
        let idx = self
            .profiles
            .iter()
            .position(|p| p.id == profile.id)
            .ok_or_else(|| CogniaError::Config(format!("Profile '{}' not found", profile.id)))?;

        if profile.is_default {
            for p in &mut self.profiles {
                p.is_default = false;
            }
        }

        let mut updated = profile;
        updated.updated_at = Utc::now().to_rfc3339();
        updated.created_at = self.profiles[idx].created_at.clone();
        self.profiles[idx] = updated;
        self.save().await?;
        Ok(())
    }

    pub async fn delete_profile(&mut self, id: &str) -> CogniaResult<bool> {
        let len_before = self.profiles.len();
        self.profiles.retain(|p| p.id != id);
        let deleted = self.profiles.len() < len_before;
        if deleted {
            self.save().await?;
        }
        Ok(deleted)
    }

    pub fn get_default_profile(&self) -> Option<&TerminalProfile> {
        self.profiles.iter().find(|p| p.is_default)
    }

    pub async fn set_default_profile(&mut self, id: &str) -> CogniaResult<()> {
        let exists = self.profiles.iter().any(|p| p.id == id);
        if !exists {
            return Err(CogniaError::Config(format!("Profile '{}' not found", id)));
        }
        for p in &mut self.profiles {
            p.is_default = p.id == id;
        }
        self.save().await?;
        Ok(())
    }
}

// ============================================================================
// Shell Config Management
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellConfigEntries {
    pub aliases: Vec<(String, String)>,
    pub exports: Vec<(String, String)>,
    pub sources: Vec<String>,
}

/// Read a shell config file content
pub async fn read_shell_config(path: &Path) -> CogniaResult<String> {
    if !fs::exists(path).await {
        return Err(CogniaError::Config(format!(
            "Config file not found: {}",
            path.display()
        )));
    }
    fs::read_file_string(path)
        .await
        .map_err(|e| CogniaError::Internal(format!("Failed to read config: {}", e)))
}

/// Create a timestamped backup of a shell config file
pub async fn backup_shell_config(path: &Path) -> CogniaResult<PathBuf> {
    if !fs::exists(path).await {
        return Err(CogniaError::Config(format!(
            "Config file not found: {}",
            path.display()
        )));
    }

    let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
    let backup_name = format!(
        "{}.bak.{}",
        path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("config"),
        timestamp
    );
    let backup_path = path.parent().unwrap_or(path).join(backup_name);

    tokio::fs::copy(path, &backup_path)
        .await
        .map_err(|e| CogniaError::Internal(format!("Failed to backup config: {}", e)))?;

    debug!("Backed up {} to {}", path.display(), backup_path.display());
    Ok(backup_path)
}

/// Safely append content to a shell config file (with automatic backup)
pub async fn append_to_shell_config(path: &Path, content: &str) -> CogniaResult<()> {
    if fs::exists(path).await {
        backup_shell_config(path).await?;
    }

    use tokio::io::AsyncWriteExt;
    let mut file = tokio::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .await
        .map_err(|e| CogniaError::Internal(format!("Failed to open config file: {}", e)))?;

    file.write_all(format!("\n{}\n", content).as_bytes())
        .await
        .map_err(|e| CogniaError::Internal(format!("Failed to write to config file: {}", e)))?;

    Ok(())
}

/// Parse shell config content to extract aliases, exports, and source lines
pub fn parse_shell_config(content: &str, shell_type: ShellType) -> ShellConfigEntries {
    match shell_type {
        ShellType::Bash | ShellType::Zsh => parse_posix_config(content),
        ShellType::Fish => parse_fish_config(content),
        ShellType::PowerShell => parse_powershell_config(content),
        ShellType::Cmd => ShellConfigEntries {
            aliases: vec![],
            exports: vec![],
            sources: vec![],
        },
    }
}

fn parse_posix_config(content: &str) -> ShellConfigEntries {
    let mut aliases = Vec::new();
    let mut exports = Vec::new();
    let mut sources = Vec::new();

    // alias name='value' or alias name="value" or alias name=value
    let alias_re = Regex::new(r#"^\s*alias\s+([A-Za-z_][\w-]*)=["']?(.*?)["']?\s*$"#).unwrap();
    // export KEY=VALUE or export KEY="VALUE"
    let export_re = Regex::new(r#"^\s*export\s+([A-Za-z_]\w*)=["']?(.*?)["']?\s*$"#).unwrap();
    // source file or . file
    let source_re = Regex::new(r#"^\s*(?:source|\.) +["']?([^"'\s]+)["']?"#).unwrap();

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some(caps) = alias_re.captures(line) {
            aliases.push((caps[1].to_string(), caps[2].to_string()));
        } else if let Some(caps) = export_re.captures(line) {
            exports.push((caps[1].to_string(), caps[2].to_string()));
        } else if let Some(caps) = source_re.captures(line) {
            sources.push(caps[1].to_string());
        }
    }

    ShellConfigEntries {
        aliases,
        exports,
        sources,
    }
}

fn parse_fish_config(content: &str) -> ShellConfigEntries {
    let mut aliases = Vec::new();
    let mut exports = Vec::new();
    let mut sources = Vec::new();

    // alias name 'value' or alias name "value" or alias name=value
    let alias_re = Regex::new(r#"^\s*alias\s+(\w+)\s+["']?(.*?)["']?\s*$"#).unwrap();
    let alias_eq_re = Regex::new(r#"^\s*alias\s+(\w+)=["']?(.*?)["']?\s*$"#).unwrap();
    // set -gx KEY VALUE
    let export_re = Regex::new(r#"^\s*set\s+-[gx]+\s+(\w+)\s+["']?(.*?)["']?\s*$"#).unwrap();
    // source file
    let source_re = Regex::new(r#"^\s*source\s+["']?([^"'\s]+)["']?"#).unwrap();

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some(caps) = alias_re.captures(line) {
            aliases.push((caps[1].to_string(), caps[2].to_string()));
        } else if let Some(caps) = alias_eq_re.captures(line) {
            aliases.push((caps[1].to_string(), caps[2].to_string()));
        } else if let Some(caps) = export_re.captures(line) {
            exports.push((caps[1].to_string(), caps[2].to_string()));
        } else if let Some(caps) = source_re.captures(line) {
            sources.push(caps[1].to_string());
        }
    }

    ShellConfigEntries {
        aliases,
        exports,
        sources,
    }
}

fn parse_powershell_config(content: &str) -> ShellConfigEntries {
    let mut aliases = Vec::new();
    let mut exports = Vec::new();
    let mut sources = Vec::new();

    // Set-Alias -Name name -Value value or Set-Alias name value
    let alias_re = Regex::new(
        r#"(?i)^\s*Set-Alias\s+(?:-Name\s+)?(\w+)\s+(?:-Value\s+)?["']?([^"'\s]+)["']?"#,
    )
    .unwrap();
    // $env:KEY = "VALUE"
    let export_re = Regex::new(r#"^\s*\$env:(\w+)\s*=\s*["']?(.*?)["']?\s*$"#).unwrap();
    // . path or . "path"
    let source_re = Regex::new(r#"^\s*\.\s+["']?([^"'\s]+)["']?"#).unwrap();

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some(caps) = alias_re.captures(line) {
            aliases.push((caps[1].to_string(), caps[2].to_string()));
        } else if let Some(caps) = export_re.captures(line) {
            exports.push((caps[1].to_string(), caps[2].to_string()));
        } else if let Some(caps) = source_re.captures(line) {
            sources.push(caps[1].to_string());
        }
    }

    ShellConfigEntries {
        aliases,
        exports,
        sources,
    }
}

// ============================================================================
// PowerShell Management
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PSProfileInfo {
    pub scope: String,
    pub path: String,
    pub exists: bool,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PSModuleInfo {
    pub name: String,
    pub version: String,
    pub module_type: String,
    pub path: String,
    pub description: String,
    pub exported_commands_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PSScriptInfo {
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: String,
    pub install_path: String,
}

/// Get the PowerShell executable to use
fn get_ps_executable() -> &'static str {
    #[cfg(windows)]
    {
        "powershell"
    }
    #[cfg(not(windows))]
    {
        "pwsh"
    }
}

/// Run a PowerShell command and return stdout
async fn run_ps_command(command: &str) -> CogniaResult<String> {
    let ps = get_ps_executable();
    let opts =
        Some(process::ProcessOptions::new().with_timeout(std::time::Duration::from_secs(30)));
    let output = process::execute(
        ps,
        &["-NoProfile", "-NonInteractive", "-Command", command],
        opts,
    )
    .await
    .map_err(|e| CogniaError::Internal(format!("PowerShell execution failed: {}", e)))?;

    if !output.success {
        return Err(CogniaError::Internal(format!(
            "PowerShell command failed: {}",
            output.stderr
        )));
    }
    Ok(output.stdout)
}

/// List all 4 PowerShell profile paths and their existence status
pub async fn ps_list_profiles() -> CogniaResult<Vec<PSProfileInfo>> {
    let command = r#"
@(
    @{Scope='AllUsersAllHosts'; Path=$PROFILE.AllUsersAllHosts},
    @{Scope='AllUsersCurrentHost'; Path=$PROFILE.AllUsersCurrentHost},
    @{Scope='CurrentUserAllHosts'; Path=$PROFILE.CurrentUserAllHosts},
    @{Scope='CurrentUserCurrentHost'; Path=$PROFILE.CurrentUserCurrentHost}
) | ForEach-Object {
    $exists = Test-Path $_.Path
    $size = if ($exists) { (Get-Item $_.Path).Length } else { 0 }
    [PSCustomObject]@{
        Scope=$_.Scope
        Path=$_.Path
        Exists=$exists
        SizeBytes=$size
    }
} | ConvertTo-Json -Compress
"#;

    let output = run_ps_command(command).await?;
    let output = output.trim();
    if output.is_empty() {
        return Ok(vec![]);
    }

    // PowerShell may return a single object or array
    let profiles: Vec<PSProfileInfo> = if output.starts_with('[') {
        serde_json::from_str(output)
    } else {
        serde_json::from_str(&format!("[{}]", output))
    }
    .map_err(|e| {
        CogniaError::Parse(format!(
            "Failed to parse PS profiles: {} (output: {})",
            e, output
        ))
    })?;

    Ok(profiles)
}

/// Read a PowerShell profile content by scope
pub async fn ps_read_profile(scope: &str) -> CogniaResult<String> {
    let command = format!(
        r#"
$path = $PROFILE.{}
if (Test-Path $path) {{ Get-Content $path -Raw }} else {{ "" }}
"#,
        scope
    );
    run_ps_command(&command).await
}

/// Write content to a PowerShell profile (with backup)
pub async fn ps_write_profile(scope: &str, content: &str) -> CogniaResult<()> {
    // First get the profile path
    let path_cmd = format!("$PROFILE.{}", scope);
    let path_output = run_ps_command(&path_cmd).await?;
    let path = PathBuf::from(path_output.trim());

    // Backup if exists
    if path.exists() {
        backup_shell_config(&path).await?;
    }

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| CogniaError::Internal(format!("Failed to create profile dir: {}", e)))?;
    }

    // Write content
    tokio::fs::write(&path, content)
        .await
        .map_err(|e| CogniaError::Internal(format!("Failed to write profile: {}", e)))?;

    Ok(())
}

/// Get execution policy for all scopes
pub async fn ps_get_execution_policy() -> CogniaResult<Vec<(String, String)>> {
    let command =
        "Get-ExecutionPolicy -List | ForEach-Object { \"$($_.Scope)|$($_.ExecutionPolicy)\" }";
    let output = run_ps_command(command).await?;

    let policies: Vec<(String, String)> = output
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.trim().splitn(2, '|').collect();
            if parts.len() == 2 {
                Some((parts[0].to_string(), parts[1].to_string()))
            } else {
                None
            }
        })
        .collect();

    Ok(policies)
}

/// Set execution policy for a specific scope (CurrentUser only for safety)
pub async fn ps_set_execution_policy(policy: &str, scope: &str) -> CogniaResult<()> {
    // Only allow CurrentUser scope for safety (no elevation required)
    if scope != "CurrentUser" && scope != "Process" {
        return Err(CogniaError::Config(
            "Only CurrentUser and Process scopes are allowed without elevation".into(),
        ));
    }

    let valid_policies = [
        "Restricted",
        "AllSigned",
        "RemoteSigned",
        "Unrestricted",
        "Bypass",
    ];
    if !valid_policies.contains(&policy) {
        return Err(CogniaError::Config(format!(
            "Invalid execution policy: {}. Valid: {:?}",
            policy, valid_policies
        )));
    }

    let command = format!(
        "Set-ExecutionPolicy -ExecutionPolicy {} -Scope {} -Force",
        policy, scope
    );
    run_ps_command(&command).await?;
    Ok(())
}

/// List all available PowerShell modules (not just PSGallery-installed)
pub async fn ps_list_all_modules() -> CogniaResult<Vec<PSModuleInfo>> {
    let command = r#"
Get-Module -ListAvailable | Select-Object -Property Name,
    @{N='Version';E={$_.Version.ToString()}},
    @{N='ModuleType';E={$_.ModuleType.ToString()}},
    @{N='Path';E={$_.Path}},
    @{N='Description';E={$_.Description}},
    @{N='ExportedCommandsCount';E={$_.ExportedCommands.Count}}
| ConvertTo-Json -Compress
"#;

    let output = run_ps_command(command).await?;
    let output = output.trim();
    if output.is_empty() {
        return Ok(vec![]);
    }

    let modules: Vec<PSModuleInfo> = if output.starts_with('[') {
        serde_json::from_str(output)
    } else {
        serde_json::from_str(&format!("[{}]", output))
    }
    .map_err(|e| CogniaError::Parse(format!("Failed to parse PS modules: {}", e)))?;

    Ok(modules)
}

/// Get detailed info for a specific PowerShell module
pub async fn ps_get_module_detail(name: &str) -> CogniaResult<PSModuleInfo> {
    let command = format!(
        r#"
Get-Module -Name '{}' -ListAvailable | Select-Object -First 1 -Property Name,
    @{{N='Version';E={{$_.Version.ToString()}}}},
    @{{N='ModuleType';E={{$_.ModuleType.ToString()}}}},
    @{{N='Path';E={{$_.Path}}}},
    @{{N='Description';E={{$_.Description}}}},
    @{{N='ExportedCommandsCount';E={{$_.ExportedCommands.Count}}}}
| ConvertTo-Json -Compress
"#,
        name
    );

    let output = run_ps_command(&command).await?;
    let output = output.trim();
    if output.is_empty() {
        return Err(CogniaError::Config(format!("Module '{}' not found", name)));
    }

    serde_json::from_str(output)
        .map_err(|e| CogniaError::Parse(format!("Failed to parse module detail: {}", e)))
}

/// List installed PowerShell scripts
pub async fn ps_list_installed_scripts() -> CogniaResult<Vec<PSScriptInfo>> {
    let command = r#"
Get-InstalledScript 2>$null | Select-Object -Property Name,
    @{N='Version';E={$_.Version.ToString()}},
    @{N='Author';E={$_.Author}},
    @{N='Description';E={$_.Description}},
    @{N='InstallPath';E={$_.InstalledLocation}}
| ConvertTo-Json -Compress
"#;

    let output = run_ps_command(command).await?;
    let output = output.trim();
    if output.is_empty() {
        return Ok(vec![]);
    }

    let scripts: Vec<PSScriptInfo> = if output.starts_with('[') {
        serde_json::from_str(output)
    } else {
        serde_json::from_str(&format!("[{}]", output))
    }
    .map_err(|e| CogniaError::Parse(format!("Failed to parse PS scripts: {}", e)))?;

    Ok(scripts)
}

// ============================================================================
// Shell Framework & Plugin Detection
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellFrameworkInfo {
    pub name: String,
    pub version: Option<String>,
    pub path: String,
    pub shell_type: ShellType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellPlugin {
    pub name: String,
    pub enabled: bool,
    pub source: String,
}

/// Detect installed shell framework for a given shell type
pub fn detect_shell_framework(shell_type: ShellType) -> Vec<ShellFrameworkInfo> {
    let home = match dirs_home() {
        Some(h) => h,
        None => return vec![],
    };

    let mut frameworks = Vec::new();

    match shell_type {
        ShellType::Zsh => {
            // oh-my-zsh
            let omz_path = home.join(".oh-my-zsh");
            if omz_path.exists() {
                let version = std::fs::read_to_string(omz_path.join("VERSION"))
                    .ok()
                    .map(|v| v.trim().to_string());
                frameworks.push(ShellFrameworkInfo {
                    name: "Oh My Zsh".to_string(),
                    version,
                    path: omz_path.display().to_string(),
                    shell_type,
                });
            }

            // prezto
            let prezto_path = home.join(".zprezto");
            if prezto_path.exists() {
                frameworks.push(ShellFrameworkInfo {
                    name: "Prezto".to_string(),
                    version: None,
                    path: prezto_path.display().to_string(),
                    shell_type,
                });
            }

            // zinit
            for zinit_path in &[home.join(".zinit"), home.join(".local/share/zinit")] {
                if zinit_path.exists() {
                    frameworks.push(ShellFrameworkInfo {
                        name: "Zinit".to_string(),
                        version: None,
                        path: zinit_path.display().to_string(),
                        shell_type,
                    });
                    break;
                }
            }

            // antidote
            for antidote_path in &[home.join(".antidote"), home.join(".cache/antidote")] {
                if antidote_path.exists() {
                    frameworks.push(ShellFrameworkInfo {
                        name: "Antidote".to_string(),
                        version: None,
                        path: antidote_path.display().to_string(),
                        shell_type,
                    });
                    break;
                }
            }
        }
        ShellType::Bash => {
            // bash-it
            let bashit_path = home.join(".bash_it");
            if bashit_path.exists() {
                frameworks.push(ShellFrameworkInfo {
                    name: "Bash-it".to_string(),
                    version: None,
                    path: bashit_path.display().to_string(),
                    shell_type,
                });
            }

            // oh-my-bash
            let omb_path = home.join(".oh-my-bash");
            if omb_path.exists() {
                frameworks.push(ShellFrameworkInfo {
                    name: "Oh My Bash".to_string(),
                    version: None,
                    path: omb_path.display().to_string(),
                    shell_type,
                });
            }
        }
        ShellType::Fish => {
            // Fisher
            let fisher_plugins = home.join(".config/fish/fish_plugins");
            if fisher_plugins.exists() {
                frameworks.push(ShellFrameworkInfo {
                    name: "Fisher".to_string(),
                    version: None,
                    path: fisher_plugins.display().to_string(),
                    shell_type,
                });
            }

            // Oh My Fish
            let omf_path = home.join(".local/share/omf");
            if omf_path.exists() {
                frameworks.push(ShellFrameworkInfo {
                    name: "Oh My Fish".to_string(),
                    version: None,
                    path: omf_path.display().to_string(),
                    shell_type,
                });
            }
        }
        _ => {}
    }

    frameworks
}

/// List plugins for a detected shell framework
pub fn list_shell_plugins(
    framework: &ShellFrameworkInfo,
    config_content: Option<&str>,
) -> Vec<ShellPlugin> {
    match framework.name.as_str() {
        "Oh My Zsh" => list_omz_plugins(config_content),
        "Bash-it" => list_bashit_plugins(&framework.path),
        "Fisher" => list_fisher_plugins(&framework.path),
        "Oh My Fish" => list_omf_plugins(&framework.path),
        _ => vec![],
    }
}

fn list_omz_plugins(config_content: Option<&str>) -> Vec<ShellPlugin> {
    let content = match config_content {
        Some(c) => c.to_string(),
        None => {
            let home = match dirs_home() {
                Some(h) => h,
                None => return vec![],
            };
            std::fs::read_to_string(home.join(".zshrc")).unwrap_or_default()
        }
    };

    // Match plugins=(...) — may span multiple lines
    let re = Regex::new(r"(?s)plugins=\(\s*(.*?)\s*\)").unwrap();
    if let Some(caps) = re.captures(&content) {
        let plugins_str = &caps[1];
        plugins_str
            .split_whitespace()
            .filter(|s| !s.is_empty() && !s.starts_with('#'))
            .map(|name| ShellPlugin {
                name: name.to_string(),
                enabled: true,
                source: "oh-my-zsh".to_string(),
            })
            .collect()
    } else {
        vec![]
    }
}

fn list_bashit_plugins(bashit_path: &str) -> Vec<ShellPlugin> {
    let enabled_dir = PathBuf::from(bashit_path)
        .parent()
        .unwrap_or(Path::new(bashit_path))
        .join(if bashit_path.ends_with(".bash_it") {
            format!("{}/enabled", bashit_path)
        } else {
            "enabled".to_string()
        });

    let enabled_path = PathBuf::from(bashit_path).join("enabled");
    if !enabled_path.exists() {
        return vec![];
    }

    let mut plugins = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&enabled_path) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.ends_with(".bash") {
                plugins.push(ShellPlugin {
                    name: name.trim_end_matches(".bash").to_string(),
                    enabled: true,
                    source: "bash-it".to_string(),
                });
            }
        }
    }
    let _ = enabled_dir; // suppress unused variable
    plugins
}

fn list_fisher_plugins(fisher_file: &str) -> Vec<ShellPlugin> {
    match std::fs::read_to_string(fisher_file) {
        Ok(content) => content
            .lines()
            .filter(|line| !line.trim().is_empty())
            .map(|line| ShellPlugin {
                name: line.trim().to_string(),
                enabled: true,
                source: "fisher".to_string(),
            })
            .collect(),
        Err(_) => vec![],
    }
}

fn list_omf_plugins(omf_path: &str) -> Vec<ShellPlugin> {
    let pkg_dir = PathBuf::from(omf_path).join("pkg");
    if !pkg_dir.exists() {
        return vec![];
    }

    let mut plugins = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&pkg_dir) {
        for entry in entries.flatten() {
            if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                plugins.push(ShellPlugin {
                    name: entry.file_name().to_string_lossy().to_string(),
                    enabled: true,
                    source: "oh-my-fish".to_string(),
                });
            }
        }
    }
    plugins
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_posix_aliases() {
        let content = r#"
# comment
alias ll='ls -la'
alias gs="git status"
export PATH="/usr/local/bin:$PATH"
export EDITOR="vim"
source ~/.bashrc_local
. ~/.profile_extra
"#;
        let entries = parse_posix_config(content);
        assert_eq!(entries.aliases.len(), 2);
        assert_eq!(entries.aliases[0], ("ll".to_string(), "ls -la".to_string()));
        assert_eq!(
            entries.aliases[1],
            ("gs".to_string(), "git status".to_string())
        );
        assert_eq!(entries.exports.len(), 2);
        assert_eq!(entries.exports[0].0, "PATH");
        assert_eq!(entries.exports[1].0, "EDITOR");
        assert_eq!(entries.sources.len(), 2);
        assert!(entries.sources[0].contains("bashrc_local"));
        assert!(entries.sources[1].contains("profile_extra"));
    }

    #[test]
    fn test_parse_powershell_config() {
        let content = r#"
# PowerShell Profile
Set-Alias -Name ll -Value Get-ChildItem
$env:EDITOR = "code"
. C:\Users\test\scripts\helpers.ps1
"#;
        let entries = parse_powershell_config(content);
        assert_eq!(entries.aliases.len(), 1);
        assert_eq!(
            entries.aliases[0],
            ("ll".to_string(), "Get-ChildItem".to_string())
        );
        assert_eq!(entries.exports.len(), 1);
        assert_eq!(
            entries.exports[0],
            ("EDITOR".to_string(), "code".to_string())
        );
        assert_eq!(entries.sources.len(), 1);
    }

    #[test]
    fn test_parse_fish_config() {
        let content = r#"
# Fish config
alias ll 'ls -la'
set -gx EDITOR vim
source ~/.config/fish/local.fish
"#;
        let entries = parse_fish_config(content);
        assert_eq!(entries.aliases.len(), 1);
        assert_eq!(entries.aliases[0].0, "ll");
        assert_eq!(entries.exports.len(), 1);
        assert_eq!(entries.exports[0].0, "EDITOR");
        assert_eq!(entries.sources.len(), 1);
    }

    #[test]
    fn test_parse_omz_plugins() {
        let content = r#"
# Oh My Zsh config
plugins=(
  git
  docker
  kubectl
  zsh-autosuggestions
)
"#;
        let plugins = list_omz_plugins(Some(content));
        assert_eq!(plugins.len(), 4);
        assert_eq!(plugins[0].name, "git");
        assert_eq!(plugins[1].name, "docker");
        assert_eq!(plugins[2].name, "kubectl");
        assert_eq!(plugins[3].name, "zsh-autosuggestions");
        assert!(plugins.iter().all(|p| p.enabled));
    }

    #[test]
    fn test_shell_type_id_roundtrip() {
        for shell in &[
            ShellType::Bash,
            ShellType::Zsh,
            ShellType::Fish,
            ShellType::PowerShell,
            ShellType::Cmd,
        ] {
            let id = shell.id();
            let parsed = ShellType::from_id(id);
            assert_eq!(parsed, Some(*shell), "Roundtrip failed for {:?}", shell);
        }
    }

    #[test]
    fn test_shell_config_entries_empty_content() {
        let entries = parse_shell_config("", ShellType::Bash);
        assert!(entries.aliases.is_empty());
        assert!(entries.exports.is_empty());
        assert!(entries.sources.is_empty());
    }

    #[test]
    fn test_shell_config_entries_cmd() {
        let entries = parse_shell_config("anything", ShellType::Cmd);
        assert!(entries.aliases.is_empty());
        assert!(entries.exports.is_empty());
        assert!(entries.sources.is_empty());
    }

    #[test]
    fn test_detect_framework_returns_empty_for_cmd() {
        let frameworks = detect_shell_framework(ShellType::Cmd);
        assert!(frameworks.is_empty());
    }

    #[test]
    fn test_detect_framework_returns_empty_for_powershell() {
        let frameworks = detect_shell_framework(ShellType::PowerShell);
        assert!(frameworks.is_empty());
    }
}
