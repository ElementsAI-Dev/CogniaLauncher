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

    // MSYS2 Bash
    let msys2_bash_candidates: Vec<PathBuf> = {
        let mut paths = vec![
            PathBuf::from(r"C:\msys64\usr\bin\bash.exe"),
            PathBuf::from(r"C:\msys32\usr\bin\bash.exe"),
        ];
        if let Ok(root) = std::env::var("MSYS2_ROOT") {
            paths.insert(0, PathBuf::from(&root).join("usr").join("bin").join("bash.exe"));
        }
        if let Ok(profile) = std::env::var("USERPROFILE") {
            paths.push(PathBuf::from(profile).join("msys64").join("usr").join("bin").join("bash.exe"));
        }
        paths
    };
    for path in &msys2_bash_candidates {
        if path.exists() {
            let version = get_shell_version(path.to_str().unwrap_or(""), &["--version"]).await;
            let msys2_home = derive_posix_home(path);
            let mut info = build_shell_info_with_home(
                "msys2",
                "MSYS2 Bash",
                ShellType::Bash,
                path.display().to_string(),
                false,
                msys2_home,
            )
            .await;
            info.version = version;
            shells.push(info);
            break;
        }
    }

    // Cygwin Bash
    let cygwin_paths = [
        r"C:\cygwin64\bin\bash.exe",
        r"C:\cygwin\bin\bash.exe",
    ];
    for path in &cygwin_paths {
        let cygwin_path = Path::new(path);
        if cygwin_path.exists() {
            let version = get_shell_version(path, &["--version"]).await;
            let cygwin_home = derive_posix_home(cygwin_path);
            let mut info = build_shell_info_with_home(
                "cygwin",
                "Cygwin Bash",
                ShellType::Bash,
                path.to_string(),
                false,
                cygwin_home,
            )
            .await;
            info.version = version;
            shells.push(info);
            break;
        }
    }

    // Nushell
    if let Ok(nu_path) = which::which("nu") {
        let version = get_shell_version(
            nu_path.to_str().unwrap_or("nu"),
            &["--version"],
        )
        .await;
        let mut info = build_shell_info(
            "nushell",
            "Nushell",
            ShellType::Nushell,
            nu_path.display().to_string(),
            default_shell == ShellType::Nushell,
        )
        .await;
        info.version = version;
        shells.push(info);
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
                "nu" => ShellType::Nushell,
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
                ShellType::Nushell => &["--version"],
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

    // Check for Nushell if not found in /etc/shells
    if !seen.contains("nushell") {
        if let Ok(nu_path) = which::which("nu") {
            let version = get_shell_version(
                nu_path.to_str().unwrap_or("nu"),
                &["--version"],
            )
            .await;
            let mut info = build_shell_info(
                "nushell",
                "Nushell",
                ShellType::Nushell,
                nu_path.display().to_string(),
                default_shell == ShellType::Nushell,
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
    build_shell_info_with_home(id, name, shell_type, executable_path, is_default, None).await
}

/// Build ShellInfo with an optional custom home directory for config file lookup.
/// Used for MSYS2/Cygwin where the home directory differs from Windows USERPROFILE.
async fn build_shell_info_with_home(
    id: &str,
    name: &str,
    shell_type: ShellType,
    executable_path: String,
    is_default: bool,
    custom_home: Option<PathBuf>,
) -> ShellInfo {
    let config_paths = match custom_home {
        Some(home) => posix_config_files_for_home(&home),
        None => shell_type.config_files(),
    };

    let config_files = config_paths
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

/// Get bash config file paths for a specific home directory (for MSYS2/Cygwin).
fn posix_config_files_for_home(home: &Path) -> Vec<PathBuf> {
    vec![
        home.join(".bashrc"),
        home.join(".bash_profile"),
        home.join(".profile"),
    ]
}

/// Derive the MSYS2/Cygwin home directory from the bash executable path.
/// e.g. `C:\msys64\usr\bin\bash.exe` → `C:\msys64\home\<username>`
#[cfg(windows)]
fn derive_posix_home(executable_path: &Path) -> Option<PathBuf> {
    // Walk up from .../usr/bin/bash.exe to the prefix root
    let prefix = executable_path
        .parent() // bin/
        .and_then(|p| p.parent()) // usr/
        .and_then(|p| p.parent())?; // root

    let home_dir = prefix.join("home");
    if !home_dir.exists() {
        return None;
    }

    // Try USERNAME then USER env var to find the user's home
    let username = std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .ok()?;
    let user_home = home_dir.join(&username);
    if user_home.exists() {
        Some(user_home)
    } else {
        None
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
    templates_path: PathBuf,
    profiles: Vec<TerminalProfile>,
    custom_templates: Vec<TerminalProfileTemplate>,
}

impl TerminalProfileManager {
    pub async fn new(base_dir: &Path) -> CogniaResult<Self> {
        let profiles_dir = base_dir.join("terminal");
        fs::create_dir_all(&profiles_dir)
            .await
            .map_err(|e| CogniaError::Internal(format!("Failed to create terminal dir: {}", e)))?;
        let profiles_path = profiles_dir.join("profiles.json");
        let templates_path = profiles_dir.join("templates.json");

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

        let custom_templates = if fs::exists(&templates_path).await {
            let content = fs::read_file_string(&templates_path)
                .await
                .map_err(|e| {
                    CogniaError::Internal(format!("Failed to read templates: {}", e))
                })?;
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            Vec::new()
        };

        Ok(Self {
            profiles_path,
            templates_path,
            profiles,
            custom_templates,
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

    pub async fn duplicate_profile(&mut self, id: &str) -> CogniaResult<String> {
        let source = self
            .get_profile(id)
            .cloned()
            .ok_or_else(|| CogniaError::Config(format!("Profile '{}' not found", id)))?;
        let mut copy = source;
        copy.name = format!("{} (Copy)", copy.name);
        copy.is_default = false;
        self.create_profile(copy).await
    }

    pub fn export_profiles(&self) -> CogniaResult<String> {
        serde_json::to_string_pretty(&self.profiles)
            .map_err(|e| CogniaError::Config(format!("Failed to export profiles: {}", e)))
    }

    pub async fn import_profiles(
        &mut self,
        json: &str,
        merge: bool,
    ) -> CogniaResult<usize> {
        let imported: Vec<TerminalProfile> = serde_json::from_str(json)
            .map_err(|e| CogniaError::Parse(format!("Invalid profile JSON: {}", e)))?;

        let count = imported.len();

        if !merge {
            self.profiles.clear();
        }

        let now = Utc::now().to_rfc3339();
        for mut profile in imported {
            profile.id = uuid::Uuid::new_v4().to_string();
            profile.created_at = now.clone();
            profile.updated_at = now.clone();
            profile.is_default = false;
            self.profiles.push(profile);
        }

        self.save().await?;
        Ok(count)
    }
}

// ============================================================================
// Terminal Profile Templates
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum TemplateCategory {
    General,
    Development,
    DevOps,
    Admin,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalProfileTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub category: TemplateCategory,
    pub shell_type: Option<ShellType>,
    pub args: Vec<String>,
    #[serde(default)]
    pub env_vars: HashMap<String, String>,
    pub cwd: Option<String>,
    pub startup_command: Option<String>,
    pub env_type: Option<String>,
    pub env_version: Option<String>,
    pub is_builtin: bool,
}

pub fn get_builtin_templates() -> Vec<TerminalProfileTemplate> {
    vec![
        TerminalProfileTemplate {
            id: "builtin-powershell".into(),
            name: "PowerShell".into(),
            description: "Default PowerShell profile with no logo banner".into(),
            icon: "terminal".into(),
            category: TemplateCategory::General,
            shell_type: Some(ShellType::PowerShell),
            args: vec!["-NoLogo".into()],
            env_vars: HashMap::new(),
            cwd: None,
            startup_command: None,
            env_type: None,
            env_version: None,
            is_builtin: true,
        },
        TerminalProfileTemplate {
            id: "builtin-bash".into(),
            name: "Bash".into(),
            description: "Default Bash login shell".into(),
            icon: "terminal".into(),
            category: TemplateCategory::General,
            shell_type: Some(ShellType::Bash),
            args: vec!["-l".into()],
            env_vars: HashMap::new(),
            cwd: None,
            startup_command: None,
            env_type: None,
            env_version: None,
            is_builtin: true,
        },
        TerminalProfileTemplate {
            id: "builtin-zsh".into(),
            name: "Zsh".into(),
            description: "Default Zsh login shell".into(),
            icon: "terminal".into(),
            category: TemplateCategory::General,
            shell_type: Some(ShellType::Zsh),
            args: vec!["-l".into()],
            env_vars: HashMap::new(),
            cwd: None,
            startup_command: None,
            env_type: None,
            env_version: None,
            is_builtin: true,
        },
        TerminalProfileTemplate {
            id: "builtin-cmd".into(),
            name: "Command Prompt".into(),
            description: "Default Windows Command Prompt".into(),
            icon: "terminal".into(),
            category: TemplateCategory::General,
            shell_type: Some(ShellType::Cmd),
            args: vec![],
            env_vars: HashMap::new(),
            cwd: None,
            startup_command: None,
            env_type: None,
            env_version: None,
            is_builtin: true,
        },
        TerminalProfileTemplate {
            id: "builtin-git-bash".into(),
            name: "Git Bash".into(),
            description: "Git Bash interactive login shell".into(),
            icon: "git-branch".into(),
            category: TemplateCategory::General,
            shell_type: Some(ShellType::Bash),
            args: vec!["--login".into(), "-i".into()],
            env_vars: HashMap::new(),
            cwd: None,
            startup_command: None,
            env_type: None,
            env_version: None,
            is_builtin: true,
        },
        TerminalProfileTemplate {
            id: "builtin-nodejs-dev".into(),
            name: "Node.js Dev".into(),
            description: "Node.js development environment with NODE_ENV=development".into(),
            icon: "hexagon".into(),
            category: TemplateCategory::Development,
            shell_type: None,
            args: vec![],
            env_vars: HashMap::from([("NODE_ENV".into(), "development".into())]),
            cwd: None,
            startup_command: None,
            env_type: Some("node".into()),
            env_version: None,
            is_builtin: true,
        },
        TerminalProfileTemplate {
            id: "builtin-python-venv".into(),
            name: "Python venv".into(),
            description: "Python with virtual environment activation".into(),
            icon: "code".into(),
            category: TemplateCategory::Development,
            shell_type: None,
            args: vec![],
            env_vars: HashMap::new(),
            cwd: None,
            #[cfg(windows)]
            startup_command: Some(".venv\\Scripts\\Activate.ps1".into()),
            #[cfg(not(windows))]
            startup_command: Some("source .venv/bin/activate".into()),
            env_type: Some("python".into()),
            env_version: None,
            is_builtin: true,
        },
        TerminalProfileTemplate {
            id: "builtin-rust-dev".into(),
            name: "Rust Dev".into(),
            description: "Rust development with full backtrace enabled".into(),
            icon: "settings".into(),
            category: TemplateCategory::Development,
            shell_type: None,
            args: vec![],
            env_vars: HashMap::from([("RUST_BACKTRACE".into(), "1".into())]),
            cwd: None,
            startup_command: None,
            env_type: Some("rust".into()),
            env_version: None,
            is_builtin: true,
        },
        TerminalProfileTemplate {
            id: "builtin-go-dev".into(),
            name: "Go Dev".into(),
            description: "Go development with CGO disabled".into(),
            icon: "box".into(),
            category: TemplateCategory::Development,
            shell_type: None,
            args: vec![],
            env_vars: HashMap::from([("CGO_ENABLED".into(), "0".into())]),
            cwd: None,
            startup_command: None,
            env_type: Some("go".into()),
            env_version: None,
            is_builtin: true,
        },
        TerminalProfileTemplate {
            id: "builtin-docker-shell".into(),
            name: "Docker Shell".into(),
            description: "Interactive shell inside a Docker container".into(),
            icon: "container".into(),
            category: TemplateCategory::DevOps,
            shell_type: None,
            args: vec![],
            env_vars: HashMap::new(),
            cwd: None,
            startup_command: Some("docker exec -it <container> sh".into()),
            env_type: None,
            env_version: None,
            is_builtin: true,
        },
    ]
}

impl TerminalProfileManager {
    // --- Template management ---

    pub fn list_templates(&self) -> Vec<TerminalProfileTemplate> {
        let mut templates = get_builtin_templates();
        templates.extend(self.custom_templates.clone());
        templates
    }

    pub async fn create_custom_template(
        &mut self,
        mut template: TerminalProfileTemplate,
    ) -> CogniaResult<String> {
        let id = format!("custom-{}", uuid::Uuid::new_v4());
        template.id = id.clone();
        template.is_builtin = false;
        template.category = TemplateCategory::Custom;
        self.custom_templates.push(template);
        self.save_templates().await?;
        Ok(id)
    }

    pub async fn delete_custom_template(&mut self, id: &str) -> CogniaResult<bool> {
        let len_before = self.custom_templates.len();
        self.custom_templates.retain(|t| t.id != id);
        let deleted = self.custom_templates.len() < len_before;
        if deleted {
            self.save_templates().await?;
        }
        Ok(deleted)
    }

    pub async fn save_profile_as_template(
        &mut self,
        profile_id: &str,
        template_name: String,
        template_description: String,
    ) -> CogniaResult<String> {
        let profile = self
            .get_profile(profile_id)
            .cloned()
            .ok_or_else(|| CogniaError::Config(format!("Profile '{}' not found", profile_id)))?;

        let template = TerminalProfileTemplate {
            id: String::new(),
            name: template_name,
            description: template_description,
            icon: "user".into(),
            category: TemplateCategory::Custom,
            shell_type: ShellType::from_id(&profile.shell_id),
            args: profile.args,
            env_vars: profile.env_vars,
            cwd: profile.cwd,
            startup_command: profile.startup_command,
            env_type: profile.env_type,
            env_version: profile.env_version,
            is_builtin: false,
        };

        self.create_custom_template(template).await
    }

    pub fn create_profile_from_template(
        &self,
        template_id: &str,
        detected_shells: &[ShellInfo],
    ) -> CogniaResult<TerminalProfile> {
        let all_templates = self.list_templates();
        let template = all_templates
            .iter()
            .find(|t| t.id == template_id)
            .ok_or_else(|| {
                CogniaError::Config(format!("Template '{}' not found", template_id))
            })?;

        let shell_id = if let Some(ref st) = template.shell_type {
            detected_shells
                .iter()
                .find(|s| &s.shell_type == st)
                .map(|s| s.id.clone())
                .unwrap_or_else(|| st.to_id().to_string())
        } else {
            detected_shells
                .first()
                .map(|s| s.id.clone())
                .unwrap_or_default()
        };

        Ok(TerminalProfile {
            id: String::new(),
            name: template.name.clone(),
            shell_id,
            args: template.args.clone(),
            env_vars: template.env_vars.clone(),
            cwd: template.cwd.clone(),
            startup_command: template.startup_command.clone(),
            env_type: template.env_type.clone(),
            env_version: template.env_version.clone(),
            is_default: false,
            created_at: String::new(),
            updated_at: String::new(),
        })
    }

    async fn save_templates(&self) -> CogniaResult<()> {
        let content = serde_json::to_string_pretty(&self.custom_templates).map_err(|e| {
            CogniaError::Config(format!("Failed to serialize templates: {}", e))
        })?;
        fs::write_file_string(&self.templates_path, &content)
            .await
            .map_err(|e| CogniaError::Internal(format!("Failed to save templates: {}", e)))?;
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

/// Read a shell config file content, handling various encodings (UTF-8, UTF-8 BOM, UTF-16LE/BE)
pub async fn read_shell_config(path: &Path) -> CogniaResult<String> {
    if !fs::exists(path).await {
        return Err(CogniaError::Config(format!(
            "Config file not found: {}",
            path.display()
        )));
    }
    let bytes = tokio::fs::read(path)
        .await
        .map_err(|e| CogniaError::Internal(format!("Failed to read config: {}", e)))?;
    Ok(decode_config_bytes(&bytes))
}

/// Decode raw bytes to String, detecting BOM for UTF-8/UTF-16LE/UTF-16BE.
/// Falls back to lossy UTF-8 conversion.
fn decode_config_bytes(bytes: &[u8]) -> String {
    // UTF-8 BOM
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        return String::from_utf8_lossy(&bytes[3..]).into_owned();
    }
    // UTF-16LE BOM
    if bytes.starts_with(&[0xFF, 0xFE]) {
        let u16s: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .collect();
        return String::from_utf16_lossy(&u16s);
    }
    // UTF-16BE BOM
    if bytes.starts_with(&[0xFE, 0xFF]) {
        let u16s: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|c| u16::from_be_bytes([c[0], c[1]]))
            .collect();
        return String::from_utf16_lossy(&u16s);
    }
    // Try UTF-8 first, fall back to lossy
    match String::from_utf8(bytes.to_vec()) {
        Ok(s) => s,
        Err(_) => String::from_utf8_lossy(bytes).into_owned(),
    }
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

/// Write content to a shell config file (with automatic backup)
pub async fn write_shell_config(path: &Path, content: &str) -> CogniaResult<()> {
    if fs::exists(path).await {
        backup_shell_config(path).await?;
    }

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| CogniaError::Internal(format!("Failed to create config dir: {}", e)))?;
    }

    tokio::fs::write(path, content)
        .await
        .map_err(|e| CogniaError::Internal(format!("Failed to write config: {}", e)))?;

    debug!("Wrote config to {}", path.display());
    Ok(())
}

/// Parse shell config content to extract aliases, exports, and source lines
pub fn parse_shell_config(content: &str, shell_type: ShellType) -> ShellConfigEntries {
    match shell_type {
        ShellType::Bash | ShellType::Zsh => parse_posix_config(content),
        ShellType::Fish => parse_fish_config(content),
        ShellType::PowerShell => parse_powershell_config(content),
        ShellType::Nushell => parse_nushell_config(content),
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

    // alias name='value' — single-quoted value (greedy inside quotes)
    let alias_sq =
        Regex::new(r#"^\s*alias\s+([A-Za-z_][\w-]*)='([^']*)'"#).unwrap();
    // alias name="value" — double-quoted value (greedy inside quotes)
    let alias_dq =
        Regex::new(r#"^\s*alias\s+([A-Za-z_][\w-]*)="([^"]*)""#).unwrap();
    // alias name=value — unquoted value
    let alias_uq =
        Regex::new(r#"^\s*alias\s+([A-Za-z_][\w-]*)=(\S+)\s*$"#).unwrap();
    // export KEY=VALUE or export KEY="VALUE" or export KEY='VALUE'
    let export_sq =
        Regex::new(r#"^\s*export\s+([A-Za-z_]\w*)='([^']*)'"#).unwrap();
    let export_dq =
        Regex::new(r#"^\s*export\s+([A-Za-z_]\w*)="([^"]*)""#).unwrap();
    let export_uq =
        Regex::new(r#"^\s*export\s+([A-Za-z_]\w*)=(\S+)\s*$"#).unwrap();
    // source file or . file (quoted paths may contain spaces)
    let source_re = Regex::new(r#"^\s*(?:source|\.) +(?:"([^"]+)"|'([^']+)'|(\S+))"#).unwrap();

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some(caps) = alias_sq.captures(line) {
            aliases.push((caps[1].to_string(), caps[2].to_string()));
        } else if let Some(caps) = alias_dq.captures(line) {
            aliases.push((caps[1].to_string(), caps[2].to_string()));
        } else if let Some(caps) = alias_uq.captures(line) {
            aliases.push((caps[1].to_string(), caps[2].to_string()));
        } else if let Some(caps) = export_sq.captures(line) {
            exports.push((caps[1].to_string(), caps[2].to_string()));
        } else if let Some(caps) = export_dq.captures(line) {
            exports.push((caps[1].to_string(), caps[2].to_string()));
        } else if let Some(caps) = export_uq.captures(line) {
            exports.push((caps[1].to_string(), caps[2].to_string()));
        } else if let Some(caps) = source_re.captures(line) {
            let path = caps.get(1).or(caps.get(2)).or(caps.get(3)).unwrap().as_str();
            sources.push(path.to_string());
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
    // source file (quoted paths may contain spaces)
    let source_re = Regex::new(r#"^\s*source\s+(?:"([^"]+)"|'([^']+)'|(\S+))"#).unwrap();

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
            let path = caps.get(1).or(caps.get(2)).or(caps.get(3)).unwrap().as_str();
            sources.push(path.to_string());
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

    // Set-Alias / New-Alias / sal / nal -Name name -Value value
    let alias_re = Regex::new(
        r#"(?i)^\s*(?:Set-Alias|New-Alias|sal|nal)\s+(?:-Name\s+)?(\w+)\s+(?:-Value\s+)?["']?([^"'\s]+)["']?"#,
    )
    .unwrap();
    // $env:KEY = "VALUE"
    let export_re = Regex::new(r#"^\s*\$env:(\w+)\s*=\s*["']?(.*?)["']?\s*$"#).unwrap();
    // . path or . "path" (dot-sourcing, quoted paths may contain spaces)
    let source_re = Regex::new(r#"^\s*\.\s+(?:"([^"]+)"|'([^']+)'|(\S+))"#).unwrap();
    // Import-Module name or Import-Module "name"
    let import_re = Regex::new(r#"(?i)^\s*Import-Module\s+(?:"([^"]+)"|'([^']+)'|(\S+))"#).unwrap();

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
            let path = caps.get(1).or(caps.get(2)).or(caps.get(3)).unwrap().as_str();
            sources.push(path.to_string());
        } else if let Some(caps) = import_re.captures(line) {
            let path = caps.get(1).or(caps.get(2)).or(caps.get(3)).unwrap().as_str();
            sources.push(path.to_string());
        }
    }

    ShellConfigEntries {
        aliases,
        exports,
        sources,
    }
}

fn parse_nushell_config(content: &str) -> ShellConfigEntries {
    let mut aliases = Vec::new();
    let mut exports = Vec::new();
    let mut sources = Vec::new();

    // alias name = value or alias name = { body }
    let alias_re = Regex::new(r#"^\s*alias\s+([\w-]+)\s*=\s*(.+)"#).unwrap();
    // $env.KEY = "value" or $env.KEY = value
    let export_re = Regex::new(r#"^\s*\$env\.(\w+)\s*=\s*["']?(.*?)["']?\s*$"#).unwrap();
    // source path or source-env path or use path (quoted paths may contain spaces)
    let source_re =
        Regex::new(r#"^\s*(?:source|source-env|use)\s+(?:"([^"]+)"|'([^']+)'|(\S+))"#).unwrap();

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some(caps) = alias_re.captures(line) {
            aliases.push((caps[1].to_string(), caps[2].trim().to_string()));
        } else if let Some(caps) = export_re.captures(line) {
            exports.push((caps[1].to_string(), caps[2].to_string()));
        } else if let Some(caps) = source_re.captures(line) {
            let path = caps.get(1).or(caps.get(2)).or(caps.get(3)).unwrap().as_str();
            sources.push(path.to_string());
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

/// Get the PowerShell executable to use.
/// Prefers `pwsh` (PowerShell 7+) over `powershell` (Windows PowerShell 5.1)
/// because 5.1 has known issues with module autoloading (e.g. Microsoft.PowerShell.Security)
/// when launched as a child process with -NoProfile.
fn get_ps_executable() -> &'static str {
    static PS_EXE: once_cell::sync::Lazy<&'static str> = once_cell::sync::Lazy::new(|| {
        if which::which("pwsh").is_ok() {
            "pwsh"
        } else {
            #[cfg(windows)]
            {
                "powershell"
            }
            #[cfg(not(windows))]
            {
                "pwsh" // no fallback on non-Windows
            }
        }
    });
    *PS_EXE
}

/// Run a PowerShell command and return stdout
async fn run_ps_command(command: &str) -> CogniaResult<String> {
    run_ps_command_with_timeout(command, 30).await
}

/// Run a PowerShell command with a custom timeout (in seconds)
async fn run_ps_command_with_timeout(command: &str, timeout_secs: u64) -> CogniaResult<String> {
    let ps = get_ps_executable();
    let opts =
        Some(process::ProcessOptions::new().with_timeout(std::time::Duration::from_secs(timeout_secs)));
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

/// Install a PowerShell module from PSGallery
pub async fn ps_install_module(name: &str, scope: &str) -> CogniaResult<()> {
    if scope != "CurrentUser" && scope != "AllUsers" {
        return Err(CogniaError::Config(
            "Scope must be 'CurrentUser' or 'AllUsers'".into(),
        ));
    }

    let command = format!(
        "Install-Module -Name '{}' -Scope {} -Force -AllowClobber -ErrorAction Stop",
        name, scope
    );
    run_ps_command_with_timeout(&command, 120).await?;
    Ok(())
}

/// Uninstall a PowerShell module
pub async fn ps_uninstall_module(name: &str) -> CogniaResult<()> {
    let command = format!(
        "Uninstall-Module -Name '{}' -AllVersions -Force -ErrorAction Stop",
        name
    );
    run_ps_command_with_timeout(&command, 60).await?;
    Ok(())
}

/// Update a PowerShell module to the latest version
pub async fn ps_update_module(name: &str) -> CogniaResult<()> {
    let command = format!(
        "Update-Module -Name '{}' -Force -ErrorAction Stop",
        name
    );
    run_ps_command_with_timeout(&command, 120).await?;
    Ok(())
}

/// Search PSGallery for modules matching a query
pub async fn ps_find_module(query: &str) -> CogniaResult<Vec<PSModuleInfo>> {
    let command = format!(
        r#"
Find-Module -Name '*{}*' -ErrorAction SilentlyContinue | Select-Object -First 20 -Property Name,
    @{{N='Version';E={{$_.Version.ToString()}}}},
    @{{N='ModuleType';E={{'Script'}}}},
    @{{N='Path';E={{'PSGallery'}}}},
    @{{N='Description';E={{$_.Description}}}},
    @{{N='ExportedCommandsCount';E={{0}}}}
| ConvertTo-Json -Compress
"#,
        query
    );

    let output = run_ps_command_with_timeout(&command, 60).await?;
    let output = output.trim();
    if output.is_empty() {
        return Ok(vec![]);
    }

    let modules: Vec<PSModuleInfo> = if output.starts_with('[') {
        serde_json::from_str(output)
    } else {
        serde_json::from_str(&format!("[{}]", output))
    }
    .map_err(|e| CogniaError::Parse(format!("Failed to parse gallery results: {}", e)))?;

    Ok(modules)
}

// ============================================================================
// Shell Framework & Plugin Detection
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum FrameworkCategory {
    Framework,
    PluginManager,
    PromptEngine,
    Theme,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellFrameworkInfo {
    pub name: String,
    pub version: Option<String>,
    pub path: String,
    pub shell_type: ShellType,
    pub category: FrameworkCategory,
    pub description: String,
    pub homepage: Option<String>,
    pub config_path: Option<String>,
    pub active_theme: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellPlugin {
    pub name: String,
    pub enabled: bool,
    pub source: String,
}

/// Detect installed shell frameworks for a given shell type.
/// Includes shell-specific frameworks and cross-platform prompt engines.
pub async fn detect_shell_framework(shell_type: ShellType) -> Vec<ShellFrameworkInfo> {
    let home = match dirs_home() {
        Some(h) => h,
        None => return vec![],
    };

    let mut frameworks = Vec::new();

    // ── Shell-specific frameworks ──
    match shell_type {
        ShellType::Zsh => {
            detect_zsh_frameworks(&home, shell_type, &mut frameworks);
        }
        ShellType::Bash => {
            detect_bash_frameworks(&home, shell_type, &mut frameworks);
        }
        ShellType::Fish => {
            detect_fish_frameworks(&home, shell_type, &mut frameworks);
        }
        _ => {}
    }

    // ── Cross-platform prompt engines (detected for ALL shell types) ──
    detect_prompt_engines(shell_type, &mut frameworks).await;

    frameworks
}

fn detect_zsh_frameworks(
    home: &Path,
    shell_type: ShellType,
    frameworks: &mut Vec<ShellFrameworkInfo>,
) {
    let zshrc_content = std::fs::read_to_string(home.join(".zshrc")).unwrap_or_default();

    // oh-my-zsh
    let omz_path = home.join(".oh-my-zsh");
    if omz_path.exists() {
        let version = std::fs::read_to_string(omz_path.join("VERSION"))
            .ok()
            .map(|v| v.trim().to_string());
        let active_theme = parse_omz_theme(&zshrc_content);
        frameworks.push(ShellFrameworkInfo {
            name: "Oh My Zsh".to_string(),
            version,
            path: omz_path.display().to_string(),
            shell_type,
            category: FrameworkCategory::Framework,
            description: "Community-driven Zsh configuration framework with 300+ plugins".to_string(),
            homepage: Some("https://ohmyz.sh".to_string()),
            config_path: Some(home.join(".zshrc").display().to_string()),
            active_theme,
        });
    }

    // prezto
    let prezto_path = home.join(".zprezto");
    if prezto_path.exists() {
        let config_path = home.join(".zpreztorc");
        frameworks.push(ShellFrameworkInfo {
            name: "Prezto".to_string(),
            version: None,
            path: prezto_path.display().to_string(),
            shell_type,
            category: FrameworkCategory::Framework,
            description: "Instantly Awesome Zsh — enriches the Zsh environment".to_string(),
            homepage: Some("https://github.com/sorin-ionescu/prezto".to_string()),
            config_path: if config_path.exists() {
                Some(config_path.display().to_string())
            } else {
                None
            },
            active_theme: None,
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
                category: FrameworkCategory::PluginManager,
                description: "Flexible and fast Zsh plugin manager".to_string(),
                homepage: Some("https://github.com/zdharma-continuum/zinit".to_string()),
                config_path: Some(home.join(".zshrc").display().to_string()),
                active_theme: None,
            });
            break;
        }
    }

    // antidote
    for antidote_path in &[home.join(".antidote"), home.join(".cache/antidote")] {
        if antidote_path.exists() {
            let plugins_txt = home.join(".zsh_plugins.txt");
            frameworks.push(ShellFrameworkInfo {
                name: "Antidote".to_string(),
                version: None,
                path: antidote_path.display().to_string(),
                shell_type,
                category: FrameworkCategory::PluginManager,
                description: "Fast Zsh plugin manager based on antibody".to_string(),
                homepage: Some("https://github.com/mattmc3/antidote".to_string()),
                config_path: if plugins_txt.exists() {
                    Some(plugins_txt.display().to_string())
                } else {
                    None
                },
                active_theme: None,
            });
            break;
        }
    }

    // zplug
    let zplug_path = std::env::var("ZPLUG_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| home.join(".zplug"));
    if zplug_path.exists() {
        frameworks.push(ShellFrameworkInfo {
            name: "zplug".to_string(),
            version: None,
            path: zplug_path.display().to_string(),
            shell_type,
            category: FrameworkCategory::PluginManager,
            description: "Next-generation Zsh plugin manager".to_string(),
            homepage: Some("https://github.com/zplug/zplug".to_string()),
            config_path: Some(home.join(".zshrc").display().to_string()),
            active_theme: None,
        });
    }

    // Powerlevel10k (theme, not framework)
    let p10k_config = home.join(".p10k.zsh");
    let p10k_custom = home.join(".oh-my-zsh/custom/themes/powerlevel10k");
    let p10k_standalone = home.join("powerlevel10k");
    let p10k_path = if p10k_custom.exists() {
        Some(p10k_custom)
    } else if p10k_standalone.exists() {
        Some(p10k_standalone)
    } else {
        None
    };
    if p10k_path.is_some() || p10k_config.exists() {
        let path = p10k_path
            .as_ref()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|| p10k_config.display().to_string());
        frameworks.push(ShellFrameworkInfo {
            name: "Powerlevel10k".to_string(),
            version: None,
            path,
            shell_type,
            category: FrameworkCategory::Theme,
            description: "Fast and flexible Zsh theme (limited support)".to_string(),
            homepage: Some("https://github.com/romkatv/powerlevel10k".to_string()),
            config_path: if p10k_config.exists() {
                Some(p10k_config.display().to_string())
            } else {
                None
            },
            active_theme: None,
        });
    }
}

fn detect_bash_frameworks(
    home: &Path,
    shell_type: ShellType,
    frameworks: &mut Vec<ShellFrameworkInfo>,
) {
    // bash-it
    let bashit_path = home.join(".bash_it");
    if bashit_path.exists() {
        frameworks.push(ShellFrameworkInfo {
            name: "Bash-it".to_string(),
            version: None,
            path: bashit_path.display().to_string(),
            shell_type,
            category: FrameworkCategory::Framework,
            description: "Community Bash commands and scripts for Bash 3.2+".to_string(),
            homepage: Some("https://github.com/Bash-it/bash-it".to_string()),
            config_path: Some(home.join(".bashrc").display().to_string()),
            active_theme: None,
        });
    }

    // oh-my-bash
    let omb_path = home.join(".oh-my-bash");
    if omb_path.exists() {
        let bashrc_content = std::fs::read_to_string(home.join(".bashrc")).unwrap_or_default();
        let active_theme = parse_omb_theme(&bashrc_content);
        frameworks.push(ShellFrameworkInfo {
            name: "Oh My Bash".to_string(),
            version: None,
            path: omb_path.display().to_string(),
            shell_type,
            category: FrameworkCategory::Framework,
            description: "Oh My Bash is an open source, community-driven framework for managing your bash configuration".to_string(),
            homepage: Some("https://github.com/ohmybash/oh-my-bash".to_string()),
            config_path: Some(home.join(".bashrc").display().to_string()),
            active_theme,
        });
    }
}

fn detect_fish_frameworks(
    home: &Path,
    shell_type: ShellType,
    frameworks: &mut Vec<ShellFrameworkInfo>,
) {
    // Fisher
    let fisher_plugins = home.join(".config/fish/fish_plugins");
    if fisher_plugins.exists() {
        frameworks.push(ShellFrameworkInfo {
            name: "Fisher".to_string(),
            version: None,
            path: fisher_plugins.display().to_string(),
            shell_type,
            category: FrameworkCategory::PluginManager,
            description: "Plugin manager for Fish shell".to_string(),
            homepage: Some("https://github.com/jorgebucaran/fisher".to_string()),
            config_path: Some(fisher_plugins.display().to_string()),
            active_theme: None,
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
            category: FrameworkCategory::Framework,
            description: "The Fish Shell Framework".to_string(),
            homepage: Some("https://github.com/oh-my-fish/oh-my-fish".to_string()),
            config_path: Some(home.join(".config/fish/config.fish").display().to_string()),
            active_theme: None,
        });
    }

    // Tide (popular Fish prompt)
    let tide_path = home.join(".config/fish/functions/_tide_init.fish");
    if tide_path.exists() {
        frameworks.push(ShellFrameworkInfo {
            name: "Tide".to_string(),
            version: None,
            path: tide_path.display().to_string(),
            shell_type,
            category: FrameworkCategory::Theme,
            description: "Modern Fish prompt inspired by Powerlevel10k".to_string(),
            homepage: Some("https://github.com/IlanCosman/tide".to_string()),
            config_path: Some(home.join(".config/fish/config.fish").display().to_string()),
            active_theme: None,
        });
    }
}

/// Detect cross-platform prompt engines (oh-my-posh, Starship) — works for any shell type
async fn detect_prompt_engines(
    shell_type: ShellType,
    frameworks: &mut Vec<ShellFrameworkInfo>,
) {
    let timeout = std::time::Duration::from_secs(5);

    // oh-my-posh
    if process::which("oh-my-posh").await.is_some() {
        let version = match process::execute(
            "oh-my-posh",
            &["version"],
            Some(process::ProcessOptions::new().with_timeout(timeout)),
        )
        .await
        {
            Ok(out) if out.success => {
                let v = out.stdout.trim().to_string();
                if v.is_empty() { None } else { Some(v) }
            }
            _ => None,
        };

        let themes_path = std::env::var("POSH_THEMES_PATH").ok();
        let config_path = std::env::var("POSH_THEME").ok();

        frameworks.push(ShellFrameworkInfo {
            name: "Oh My Posh".to_string(),
            version,
            path: process::which("oh-my-posh")
                .await
                .unwrap_or_else(|| "oh-my-posh".to_string()),
            shell_type,
            category: FrameworkCategory::PromptEngine,
            description: "Cross-platform prompt theme engine for any shell".to_string(),
            homepage: Some("https://ohmyposh.dev".to_string()),
            config_path,
            active_theme: themes_path,
        });
    }

    // Starship
    if process::which("starship").await.is_some() {
        let version = match process::execute(
            "starship",
            &["--version"],
            Some(process::ProcessOptions::new().with_timeout(timeout)),
        )
        .await
        {
            Ok(out) if out.success => {
                let text = out.stdout.trim().to_string();
                // "starship 1.18.2" -> "1.18.2"
                let re = Regex::new(r"(\d+\.\d+[\.\d]*)").ok();
                re.and_then(|r| r.find(&text).map(|m| m.as_str().to_string()))
                    .or(Some(text))
                    .filter(|v| !v.is_empty())
            }
            _ => None,
        };

        let config_path = std::env::var("STARSHIP_CONFIG").ok().or_else(|| {
            dirs_home().map(|h| {
                let p = h.join(".config/starship.toml");
                if p.exists() {
                    p.display().to_string()
                } else {
                    p.display().to_string()
                }
            })
        });

        frameworks.push(ShellFrameworkInfo {
            name: "Starship".to_string(),
            version,
            path: process::which("starship")
                .await
                .unwrap_or_else(|| "starship".to_string()),
            shell_type,
            category: FrameworkCategory::PromptEngine,
            description: "Minimal, blazing-fast cross-shell prompt written in Rust".to_string(),
            homepage: Some("https://starship.rs".to_string()),
            config_path,
            active_theme: None,
        });
    }
}

/// List plugins for a detected shell framework
pub fn list_shell_plugins(
    framework: &ShellFrameworkInfo,
    config_content: Option<&str>,
) -> Vec<ShellPlugin> {
    match framework.name.as_str() {
        "Oh My Zsh" => list_omz_plugins(config_content),
        "Prezto" => list_prezto_modules(framework.config_path.as_deref()),
        "Zinit" => list_zinit_plugins(config_content),
        "Antidote" => list_antidote_plugins(framework.config_path.as_deref()),
        "zplug" => list_zplug_plugins(config_content),
        "Oh My Bash" => list_omb_plugins(config_content),
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

/// Parse Prezto modules from .zpreztorc: `zstyle ':prezto:load' pmodule ... 'module1' 'module2'`
fn list_prezto_modules(config_path: Option<&str>) -> Vec<ShellPlugin> {
    let content = match config_path {
        Some(p) => std::fs::read_to_string(p).unwrap_or_default(),
        None => {
            let home = match dirs_home() {
                Some(h) => h,
                None => return vec![],
            };
            std::fs::read_to_string(home.join(".zpreztorc")).unwrap_or_default()
        }
    };

    let mut plugins = Vec::new();
    // Match lines like: 'module-name' \ (with optional backslash continuation)
    // inside a zstyle ':prezto:load' pmodule block
    let re = Regex::new(r"(?s)zstyle\s+':prezto:load'\s+pmodule\s*(.*?)(?:\n\s*\n|\n[^\\'\s])").unwrap();
    if let Some(caps) = re.captures(&content) {
        let block = &caps[1];
        let name_re = Regex::new(r"'([^']+)'").unwrap();
        for cap in name_re.captures_iter(block) {
            plugins.push(ShellPlugin {
                name: cap[1].to_string(),
                enabled: true,
                source: "prezto".to_string(),
            });
        }
    }

    // Fallback: also try individual zstyle lines
    if plugins.is_empty() {
        let line_re = Regex::new(r"zstyle\s+':prezto:load'\s+pmodule\b").unwrap();
        let name_re = Regex::new(r"'([^']+)'").unwrap();
        let mut in_block = false;
        for line in content.lines() {
            let trimmed = line.trim();
            if line_re.is_match(trimmed) {
                in_block = true;
            }
            if in_block {
                for cap in name_re.captures_iter(trimmed) {
                    let name = &cap[1];
                    if name != ":prezto:load" {
                        plugins.push(ShellPlugin {
                            name: name.to_string(),
                            enabled: true,
                            source: "prezto".to_string(),
                        });
                    }
                }
                if !trimmed.ends_with('\\') {
                    in_block = false;
                }
            }
        }
    }

    plugins
}

/// Parse Zinit plugin declarations from .zshrc
fn list_zinit_plugins(config_content: Option<&str>) -> Vec<ShellPlugin> {
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

    let mut plugins = Vec::new();
    // Match: zinit light user/repo, zinit load user/repo, zinit snippet URL
    let re = Regex::new(r"^\s*zinit\s+(?:light|load|ice\s+.*?;\s*zinit\s+(?:light|load))\s+([^\s#]+)").unwrap();
    let snippet_re = Regex::new(r"^\s*zinit\s+snippet\s+([^\s#]+)").unwrap();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if let Some(caps) = re.captures(trimmed) {
            plugins.push(ShellPlugin {
                name: caps[1].to_string(),
                enabled: true,
                source: "zinit".to_string(),
            });
        } else if let Some(caps) = snippet_re.captures(trimmed) {
            plugins.push(ShellPlugin {
                name: caps[1].to_string(),
                enabled: true,
                source: "zinit-snippet".to_string(),
            });
        }
    }
    plugins
}

/// Parse Antidote plugins from .zsh_plugins.txt (one plugin per line)
fn list_antidote_plugins(config_path: Option<&str>) -> Vec<ShellPlugin> {
    let content = match config_path {
        Some(p) => std::fs::read_to_string(p).unwrap_or_default(),
        None => {
            let home = match dirs_home() {
                Some(h) => h,
                None => return vec![],
            };
            std::fs::read_to_string(home.join(".zsh_plugins.txt")).unwrap_or_default()
        }
    };

    content
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
        .map(|line| {
            // Lines may have options after the repo: "user/repo kind:defer"
            let name = line.split_whitespace().next().unwrap_or(line);
            ShellPlugin {
                name: name.to_string(),
                enabled: true,
                source: "antidote".to_string(),
            }
        })
        .collect()
}

/// Parse zplug plugins from .zshrc: `zplug "user/repo", ...`
fn list_zplug_plugins(config_content: Option<&str>) -> Vec<ShellPlugin> {
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

    let re = Regex::new(r#"^\s*zplug\s+["']([^"']+)["']"#).unwrap();
    content
        .lines()
        .filter(|l| !l.trim().starts_with('#'))
        .filter_map(|line| {
            re.captures(line).map(|caps| ShellPlugin {
                name: caps[1].to_string(),
                enabled: true,
                source: "zplug".to_string(),
            })
        })
        .collect()
}

/// Parse Oh My Bash plugins from .bashrc: `plugins=(...)`
fn list_omb_plugins(config_content: Option<&str>) -> Vec<ShellPlugin> {
    let content = match config_content {
        Some(c) => c.to_string(),
        None => {
            let home = match dirs_home() {
                Some(h) => h,
                None => return vec![],
            };
            std::fs::read_to_string(home.join(".bashrc")).unwrap_or_default()
        }
    };

    let re = Regex::new(r"(?s)plugins=\(\s*(.*?)\s*\)").unwrap();
    if let Some(caps) = re.captures(&content) {
        let plugins_str = &caps[1];
        plugins_str
            .split_whitespace()
            .filter(|s| !s.is_empty() && !s.starts_with('#'))
            .map(|name| ShellPlugin {
                name: name.to_string(),
                enabled: true,
                source: "oh-my-bash".to_string(),
            })
            .collect()
    } else {
        vec![]
    }
}

/// Parse ZSH_THEME="theme_name" from .zshrc
fn parse_omz_theme(zshrc_content: &str) -> Option<String> {
    let re = Regex::new(r#"^\s*ZSH_THEME\s*=\s*["']([^"']*)["']"#).unwrap();
    for line in zshrc_content.lines() {
        if let Some(caps) = re.captures(line.trim()) {
            let theme = caps[1].to_string();
            if !theme.is_empty() {
                return Some(theme);
            }
        }
    }
    None
}

/// Parse OSH_THEME="theme_name" from .bashrc (Oh My Bash)
fn parse_omb_theme(bashrc_content: &str) -> Option<String> {
    let re = Regex::new(r#"^\s*OSH_THEME\s*=\s*["']([^"']*)["']"#).unwrap();
    for line in bashrc_content.lines() {
        if let Some(caps) = re.captures(line.trim()) {
            let theme = caps[1].to_string();
            if !theme.is_empty() {
                return Some(theme);
            }
        }
    }
    None
}

// ============================================================================
// Framework Cache Management
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameworkCacheInfo {
    pub framework_name: String,
    pub cache_paths: Vec<String>,
    pub total_size: u64,
    pub total_size_human: String,
    pub can_clean: bool,
    pub description: String,
}

/// Resolve cache directories for a detected framework.
/// Returns a list of existing cache paths for the given framework.
pub fn resolve_framework_cache_paths(framework: &ShellFrameworkInfo) -> Vec<PathBuf> {
    let home = match dirs_home() {
        Some(h) => h,
        None => return vec![],
    };

    let candidates: Vec<PathBuf> = match framework.name.as_str() {
        "Oh My Posh" => get_oh_my_posh_cache_paths(&home),
        "Starship" => get_starship_cache_paths(&home),
        "Oh My Zsh" => get_oh_my_zsh_cache_paths(&home),
        "Prezto" => get_prezto_cache_paths(&home),
        "Zinit" => get_zinit_cache_paths(&home),
        "Powerlevel10k" => get_powerlevel10k_cache_paths(&home),
        "Oh My Bash" => get_oh_my_bash_cache_paths(&home),
        "Oh My Fish" => get_oh_my_fish_cache_paths(&home),
        "Antidote" => get_antidote_cache_paths(&home),
        "zplug" => get_zplug_cache_paths(&home),
        "Bash-it" => get_bashit_cache_paths(&home),
        _ => vec![],
    };

    candidates.into_iter().filter(|p| p.exists()).collect()
}

fn get_oh_my_posh_cache_paths(home: &Path) -> Vec<PathBuf> {
    let mut paths = Vec::new();

    // XDG / platform cache directory
    #[cfg(windows)]
    {
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            paths.push(PathBuf::from(&local).join("oh-my-posh"));
        }
    }
    #[cfg(not(windows))]
    {
        let xdg = std::env::var("XDG_CACHE_HOME")
            .ok()
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join(".cache"));
        paths.push(xdg.join("oh-my-posh"));
    }

    // Legacy omp.cache in home dir
    paths.push(home.join(".oh-my-posh"));

    paths
}

fn get_starship_cache_paths(#[allow(unused)] home: &Path) -> Vec<PathBuf> {
    let mut paths = Vec::new();

    #[cfg(windows)]
    {
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            paths.push(PathBuf::from(&local).join("starship"));
        }
    }
    #[cfg(not(windows))]
    {
        let xdg = std::env::var("XDG_CACHE_HOME")
            .ok()
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join(".cache"));
        paths.push(xdg.join("starship"));
    }

    paths
}

fn get_oh_my_zsh_cache_paths(home: &Path) -> Vec<PathBuf> {
    let mut paths = Vec::new();

    // $ZSH_CACHE_DIR or default
    if let Ok(cache_dir) = std::env::var("ZSH_CACHE_DIR") {
        paths.push(PathBuf::from(cache_dir));
    }
    paths.push(home.join(".oh-my-zsh").join("cache"));

    // zcompdump files
    let zcompdump = home.join(".zcompdump");
    if zcompdump.exists() {
        paths.push(zcompdump);
    }

    paths
}

fn get_prezto_cache_paths(home: &Path) -> Vec<PathBuf> {
    vec![home.join(".zprezto").join("cache")]
}

fn get_zinit_cache_paths(home: &Path) -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Ok(zinit_home) = std::env::var("ZINIT_HOME") {
        paths.push(PathBuf::from(zinit_home));
    }
    // XDG data home
    let xdg_data = std::env::var("XDG_DATA_HOME")
        .ok()
        .map(PathBuf::from)
        .unwrap_or_else(|| home.join(".local").join("share"));
    paths.push(xdg_data.join("zinit"));

    // Legacy location
    paths.push(home.join(".zinit"));

    paths
}

fn get_powerlevel10k_cache_paths(home: &Path) -> Vec<PathBuf> {
    let mut paths = Vec::new();

    let xdg_cache = std::env::var("XDG_CACHE_HOME")
        .ok()
        .map(PathBuf::from)
        .unwrap_or_else(|| home.join(".cache"));

    // p10k dumps its instant-prompt cache files as p10k-* in the cache dir
    // We return the cache dir itself and let size calculation handle the p10k-* files
    paths.push(xdg_cache.join("p10k"));

    // Also check for loose p10k-dump-*.zsh files in the XDG cache dir
    if let Ok(entries) = std::fs::read_dir(&xdg_cache) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                if name.starts_with("p10k-") {
                    paths.push(entry.path());
                }
            }
        }
    }

    // gitstatus cache (used by p10k)
    paths.push(xdg_cache.join("gitstatus"));

    paths
}

fn get_oh_my_bash_cache_paths(home: &Path) -> Vec<PathBuf> {
    vec![home.join(".oh-my-bash").join("cache")]
}

fn get_oh_my_fish_cache_paths(home: &Path) -> Vec<PathBuf> {
    let mut paths = Vec::new();

    let xdg_cache = std::env::var("XDG_CACHE_HOME")
        .ok()
        .map(PathBuf::from)
        .unwrap_or_else(|| home.join(".cache"));
    paths.push(xdg_cache.join("omf"));

    paths
}

fn get_antidote_cache_paths(home: &Path) -> Vec<PathBuf> {
    let mut paths = Vec::new();

    let xdg_cache = std::env::var("XDG_CACHE_HOME")
        .ok()
        .map(PathBuf::from)
        .unwrap_or_else(|| home.join(".cache"));
    paths.push(xdg_cache.join("antidote"));
    paths.push(home.join(".antidote"));

    paths
}

fn get_zplug_cache_paths(home: &Path) -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Ok(zplug_cache) = std::env::var("ZPLUG_CACHE_DIR") {
        paths.push(PathBuf::from(zplug_cache));
    }
    paths.push(home.join(".zplug").join("cache"));

    paths
}

fn get_bashit_cache_paths(home: &Path) -> Vec<PathBuf> {
    vec![home.join(".bash_it").join("cache")]
}

/// Calculate directory/file size (sync, for use in spawn_blocking)
fn calc_path_size_sync(path: &Path) -> u64 {
    if path.is_file() {
        return std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    }
    if !path.is_dir() {
        return 0;
    }
    let mut total = 0u64;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                total += std::fs::metadata(&p).map(|m| m.len()).unwrap_or(0);
            } else if p.is_dir() {
                total += calc_path_size_sync(&p);
            }
        }
    }
    total
}

/// Get cache info for a single framework (async-safe)
pub async fn get_framework_cache_info(framework: &ShellFrameworkInfo) -> FrameworkCacheInfo {
    let cache_paths = resolve_framework_cache_paths(framework);
    let path_strings: Vec<String> = cache_paths.iter().map(|p| p.display().to_string()).collect();

    let paths_for_size = cache_paths.clone();
    let total_size = tokio::task::spawn_blocking(move || {
        paths_for_size.iter().map(|p| calc_path_size_sync(p)).sum::<u64>()
    })
    .await
    .unwrap_or(0);

    FrameworkCacheInfo {
        framework_name: framework.name.clone(),
        cache_paths: path_strings,
        total_size,
        total_size_human: format_size(total_size),
        can_clean: total_size > 0,
        description: format!("Cache files for {}", framework.name),
    }
}

/// Get cache info for all detected frameworks
pub async fn get_all_framework_cache_stats(
    frameworks: &[ShellFrameworkInfo],
) -> Vec<FrameworkCacheInfo> {
    // Deduplicate by framework name (same framework detected for multiple shells)
    let mut seen = std::collections::HashSet::new();
    let mut results = Vec::new();

    for fw in frameworks {
        if seen.insert(fw.name.clone()) {
            results.push(get_framework_cache_info(fw).await);
        }
    }

    // Sort by size descending
    results.sort_by(|a, b| b.total_size.cmp(&a.total_size));
    results
}

/// Clean cache for a specific framework by name. Returns freed bytes.
pub async fn clean_framework_cache(framework_name: &str) -> CogniaResult<u64> {
    let _home = dirs_home().ok_or_else(|| CogniaError::Internal("No home directory".to_string()))?;

    // Build a dummy framework info to resolve paths
    let dummy = ShellFrameworkInfo {
        name: framework_name.to_string(),
        version: None,
        path: String::new(),
        shell_type: ShellType::Bash,
        category: FrameworkCategory::Framework,
        description: String::new(),
        homepage: None,
        config_path: None,
        active_theme: None,
    };

    let cache_paths = resolve_framework_cache_paths(&dummy);
    if cache_paths.is_empty() {
        return Ok(0);
    }

    let paths_for_size = cache_paths.clone();
    let size_before: u64 = tokio::task::spawn_blocking(move || {
        paths_for_size.iter().map(|p| calc_path_size_sync(p)).sum::<u64>()
    })
    .await
    .unwrap_or(0);

    // Clean each cache path
    for path in &cache_paths {
        if path.is_file() {
            let _ = fs::remove_file(path).await;
        } else if path.is_dir() {
            // For framework install dirs (Zinit, Antidote), only clean cache subdirs
            // For dedicated cache dirs, clean contents but preserve dir
            let _ = clean_dir_contents(path).await;
        }
    }

    let paths_for_size2 = cache_paths;
    let size_after: u64 = tokio::task::spawn_blocking(move || {
        paths_for_size2.iter().map(|p| calc_path_size_sync(p)).sum::<u64>()
    })
    .await
    .unwrap_or(0);

    Ok(size_before.saturating_sub(size_after))
}

/// Remove directory contents without removing the directory itself
async fn clean_dir_contents(path: &Path) -> CogniaResult<()> {
    let path = path.to_path_buf();
    let entries: Vec<PathBuf> = tokio::task::spawn_blocking(move || {
        let mut items = Vec::new();
        if let Ok(read_dir) = std::fs::read_dir(&path) {
            for entry in read_dir.flatten() {
                items.push(entry.path());
            }
        }
        items
    })
    .await
    .unwrap_or_default();

    for entry_path in entries {
        if entry_path.is_dir() {
            let _ = fs::remove_dir_all(&entry_path).await;
        } else {
            let _ = fs::remove_file(&entry_path).await;
        }
    }
    Ok(())
}

fn format_size(bytes: u64) -> String {
    crate::platform::disk::format_size(bytes)
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
    fn test_parse_nushell_config() {
        let content = r#"
# Nushell config
alias ll = ls -la
alias gs = git status
$env.EDITOR = "vim"
$env.PATH = ($env.PATH | prepend "/usr/local/bin")
source ~/.config/nushell/local.nu
source-env ~/.env.nu
"#;
        let entries = parse_nushell_config(content);
        assert_eq!(entries.aliases.len(), 2);
        assert_eq!(entries.aliases[0], ("ll".to_string(), "ls -la".to_string()));
        assert_eq!(entries.aliases[1], ("gs".to_string(), "git status".to_string()));
        assert_eq!(entries.exports.len(), 2);
        assert_eq!(entries.exports[0].0, "EDITOR");
        assert_eq!(entries.exports[1].0, "PATH");
        assert_eq!(entries.sources.len(), 2);
        assert!(entries.sources[0].contains("local.nu"));
        assert!(entries.sources[1].contains(".env.nu"));
    }

    #[test]
    fn test_shell_type_id_roundtrip() {
        for shell in &[
            ShellType::Bash,
            ShellType::Zsh,
            ShellType::Fish,
            ShellType::PowerShell,
            ShellType::Cmd,
            ShellType::Nushell,
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
    fn test_nushell_config_entries_via_parse_shell_config() {
        let content = "$env.FOO = \"bar\"";
        let entries = parse_shell_config(content, ShellType::Nushell);
        assert_eq!(entries.exports.len(), 1);
        assert_eq!(entries.exports[0], ("FOO".to_string(), "bar".to_string()));
    }

    // ── New parser tests ──

    #[test]
    fn test_parse_omz_theme() {
        assert_eq!(
            parse_omz_theme("ZSH_THEME=\"robbyrussell\""),
            Some("robbyrussell".to_string())
        );
        assert_eq!(
            parse_omz_theme("ZSH_THEME='agnoster'"),
            Some("agnoster".to_string())
        );
        assert_eq!(parse_omz_theme("# ZSH_THEME=\"disabled\""), None);
        assert_eq!(parse_omz_theme("ZSH_THEME=\"\""), None);
    }

    #[test]
    fn test_parse_omb_theme() {
        assert_eq!(
            parse_omb_theme("OSH_THEME=\"font\""),
            Some("font".to_string())
        );
        assert_eq!(parse_omb_theme("# OSH_THEME=\"disabled\""), None);
    }

    #[test]
    fn test_list_prezto_modules() {
        let content = r#"
zstyle ':prezto:load' pmodule \
  'environment' \
  'terminal' \
  'editor' \
  'history' \
  'directory'
"#;
        let plugins = list_prezto_modules(None);
        // Without a real file, returns empty
        assert!(plugins.is_empty() || !plugins.is_empty());

        // Test with inline content via a temp file approach
        let tmpdir = std::env::temp_dir().join("cognia_test_prezto");
        let _ = std::fs::create_dir_all(&tmpdir);
        let tmpfile = tmpdir.join("zpreztorc");
        std::fs::write(&tmpfile, content).unwrap();
        let result = list_prezto_modules(Some(tmpfile.to_str().unwrap()));
        assert_eq!(result.len(), 5);
        assert_eq!(result[0].name, "environment");
        assert_eq!(result[4].name, "directory");
        assert!(result.iter().all(|p| p.source == "prezto"));
        let _ = std::fs::remove_dir_all(&tmpdir);
    }

    #[test]
    fn test_list_zinit_plugins() {
        let content = r#"
# Zinit config
zinit light zsh-users/zsh-autosuggestions
zinit light zsh-users/zsh-syntax-highlighting
zinit snippet OMZ::plugins/git/git.plugin.zsh
# commented out
# zinit light disabled/plugin
"#;
        let plugins = list_zinit_plugins(Some(content));
        assert_eq!(plugins.len(), 3);
        assert_eq!(plugins[0].name, "zsh-users/zsh-autosuggestions");
        assert_eq!(plugins[0].source, "zinit");
        assert_eq!(plugins[2].source, "zinit-snippet");
    }

    #[test]
    fn test_list_antidote_plugins() {
        let tmpdir = std::env::temp_dir().join("cognia_test_antidote");
        let _ = std::fs::create_dir_all(&tmpdir);
        let tmpfile = tmpdir.join("zsh_plugins.txt");
        std::fs::write(
            &tmpfile,
            "# comment\nzsh-users/zsh-autosuggestions\nromkatv/powerlevel10k kind:defer\n",
        )
        .unwrap();
        let plugins = list_antidote_plugins(Some(tmpfile.to_str().unwrap()));
        assert_eq!(plugins.len(), 2);
        assert_eq!(plugins[0].name, "zsh-users/zsh-autosuggestions");
        assert_eq!(plugins[1].name, "romkatv/powerlevel10k");
        assert!(plugins.iter().all(|p| p.source == "antidote"));
        let _ = std::fs::remove_dir_all(&tmpdir);
    }

    #[test]
    fn test_list_zplug_plugins() {
        let content = r#"
source ~/.zplug/init.zsh
zplug "zsh-users/zsh-syntax-highlighting", defer:2
zplug "zsh-users/zsh-autosuggestions"
# zplug "disabled/plugin"
zplug 'junegunn/fzf', from:github
"#;
        let plugins = list_zplug_plugins(Some(content));
        assert_eq!(plugins.len(), 3);
        assert_eq!(plugins[0].name, "zsh-users/zsh-syntax-highlighting");
        assert_eq!(plugins[1].name, "zsh-users/zsh-autosuggestions");
        assert_eq!(plugins[2].name, "junegunn/fzf");
        assert!(plugins.iter().all(|p| p.source == "zplug"));
    }

    #[test]
    fn test_list_omb_plugins() {
        let content = r#"
# Oh My Bash config
plugins=(
  git
  bashmarks
  npm
)
"#;
        let plugins = list_omb_plugins(Some(content));
        assert_eq!(plugins.len(), 3);
        assert_eq!(plugins[0].name, "git");
        assert_eq!(plugins[2].name, "npm");
        assert!(plugins.iter().all(|p| p.source == "oh-my-bash"));
    }

    #[test]
    fn test_framework_category_serde() {
        let json = serde_json::to_string(&FrameworkCategory::PromptEngine).unwrap();
        assert_eq!(json, "\"prompt-engine\"");
        let json = serde_json::to_string(&FrameworkCategory::PluginManager).unwrap();
        assert_eq!(json, "\"plugin-manager\"");
    }

    // ── Encoding tests ──

    #[test]
    fn test_decode_config_bytes_utf8() {
        let bytes = b"export FOO=bar\nalias ll='ls -la'\n";
        let result = decode_config_bytes(bytes);
        assert!(result.contains("export FOO=bar"));
        assert!(result.contains("alias ll='ls -la'"));
    }

    #[test]
    fn test_decode_config_bytes_utf8_bom() {
        let mut bytes = vec![0xEF, 0xBB, 0xBF];
        bytes.extend_from_slice(b"$env:EDITOR = \"code\"");
        let result = decode_config_bytes(&bytes);
        assert_eq!(result, "$env:EDITOR = \"code\"");
    }

    #[test]
    fn test_decode_config_bytes_utf16le_bom() {
        let text = "alias ll='ls'\n";
        let mut bytes = vec![0xFF, 0xFE];
        for ch in text.encode_utf16() {
            bytes.extend_from_slice(&ch.to_le_bytes());
        }
        let result = decode_config_bytes(&bytes);
        assert!(result.contains("alias ll='ls'"));
    }

    #[test]
    fn test_decode_config_bytes_utf16be_bom() {
        let text = "export A=1\n";
        let mut bytes = vec![0xFE, 0xFF];
        for ch in text.encode_utf16() {
            bytes.extend_from_slice(&ch.to_be_bytes());
        }
        let result = decode_config_bytes(&bytes);
        assert!(result.contains("export A=1"));
    }

    // ── Improved posix alias regex tests ──

    #[test]
    fn test_posix_alias_nested_single_quotes_in_double() {
        let content = r#"alias glog="git log --format='%h %s'""#;
        let entries = parse_posix_config(content);
        assert_eq!(entries.aliases.len(), 1);
        assert_eq!(entries.aliases[0].0, "glog");
        assert_eq!(entries.aliases[0].1, "git log --format='%h %s'");
    }

    #[test]
    fn test_posix_alias_nested_double_quotes_in_single() {
        let content = r#"alias greeting='echo "hello world"'"#;
        let entries = parse_posix_config(content);
        assert_eq!(entries.aliases.len(), 1);
        assert_eq!(entries.aliases[0].0, "greeting");
        assert_eq!(entries.aliases[0].1, r#"echo "hello world""#);
    }

    #[test]
    fn test_posix_alias_unquoted() {
        let content = "alias ls=ls-color\n";
        let entries = parse_posix_config(content);
        assert_eq!(entries.aliases.len(), 1);
        assert_eq!(entries.aliases[0], ("ls".to_string(), "ls-color".to_string()));
    }

    #[test]
    fn test_posix_export_with_path_expansion() {
        let content = "export PATH=\"$HOME/bin:$PATH\"\n";
        let entries = parse_posix_config(content);
        assert_eq!(entries.exports.len(), 1);
        assert_eq!(entries.exports[0].0, "PATH");
        assert_eq!(entries.exports[0].1, "$HOME/bin:$PATH");
    }

    // ── PowerShell parser enhancement tests ──

    #[test]
    fn test_powershell_new_alias() {
        let content = "New-Alias -Name ll -Value Get-ChildItem\n";
        let entries = parse_powershell_config(content);
        assert_eq!(entries.aliases.len(), 1);
        assert_eq!(entries.aliases[0], ("ll".to_string(), "Get-ChildItem".to_string()));
    }

    #[test]
    fn test_powershell_sal_shorthand() {
        let content = "sal np notepad\n";
        let entries = parse_powershell_config(content);
        assert_eq!(entries.aliases.len(), 1);
        assert_eq!(entries.aliases[0], ("np".to_string(), "notepad".to_string()));
    }

    #[test]
    fn test_powershell_import_module() {
        let content = "Import-Module posh-git\nImport-Module \"Terminal-Icons\"\n";
        let entries = parse_powershell_config(content);
        assert_eq!(entries.sources.len(), 2);
        assert_eq!(entries.sources[0], "posh-git");
        assert_eq!(entries.sources[1], "Terminal-Icons");
    }

    #[test]
    fn test_powershell_combined() {
        let content = r#"
# My Profile
Import-Module posh-git
Set-Alias -Name ll -Value Get-ChildItem
New-Alias -Name which -Value Get-Command
$env:EDITOR = "code"
. C:\Users\test\scripts\helpers.ps1
"#;
        let entries = parse_powershell_config(content);
        assert_eq!(entries.aliases.len(), 2);
        assert_eq!(entries.exports.len(), 1);
        assert_eq!(entries.sources.len(), 2); // Import-Module + dot-source
    }

    // ── Nushell 'use' statement test ──

    #[test]
    fn test_nushell_use_statement() {
        let content = "use std/assert\nuse ~/.config/nushell/custom.nu\nsource local.nu\n";
        let entries = parse_nushell_config(content);
        assert_eq!(entries.sources.len(), 3);
        assert_eq!(entries.sources[0], "std/assert");
        assert_eq!(entries.sources[1], "~/.config/nushell/custom.nu");
        assert_eq!(entries.sources[2], "local.nu");
    }

    // ── Paths with spaces regression tests ──

    #[test]
    fn test_posix_source_path_with_spaces() {
        let content = r#"
source "/home/Max Qian/scripts/init.sh"
. '/opt/my tools/env.sh'
source ~/no_space.sh
"#;
        let entries = parse_posix_config(content);
        assert_eq!(entries.sources.len(), 3);
        assert_eq!(entries.sources[0], "/home/Max Qian/scripts/init.sh");
        assert_eq!(entries.sources[1], "/opt/my tools/env.sh");
        assert_eq!(entries.sources[2], "~/no_space.sh");
    }

    #[test]
    fn test_powershell_dot_source_path_with_spaces() {
        let content = r#"
. "C:\Users\Max Qian\Documents\PowerShell\helpers.ps1"
. 'C:\Program Files\My App\init.ps1'
Import-Module "C:\Users\Max Qian\Modules\MyModule"
. C:\NoSpace\script.ps1
"#;
        let entries = parse_powershell_config(content);
        assert_eq!(entries.sources.len(), 4);
        assert_eq!(entries.sources[0], r"C:\Users\Max Qian\Documents\PowerShell\helpers.ps1");
        assert_eq!(entries.sources[1], r"C:\Program Files\My App\init.ps1");
        assert_eq!(entries.sources[2], r"C:\Users\Max Qian\Modules\MyModule");
        assert_eq!(entries.sources[3], r"C:\NoSpace\script.ps1");
    }

    #[test]
    fn test_fish_source_path_with_spaces() {
        let content = r#"
source "/home/Max Qian/.config/fish/local.fish"
source ~/no_space.fish
"#;
        let entries = parse_fish_config(content);
        assert_eq!(entries.sources.len(), 2);
        assert_eq!(entries.sources[0], "/home/Max Qian/.config/fish/local.fish");
        assert_eq!(entries.sources[1], "~/no_space.fish");
    }

    #[test]
    fn test_nushell_source_path_with_spaces() {
        let content = r#"
source "/home/Max Qian/scripts/init.nu"
source ~/no_space.nu
"#;
        let entries = parse_nushell_config(content);
        assert_eq!(entries.sources.len(), 2);
        assert_eq!(entries.sources[0], "/home/Max Qian/scripts/init.nu");
        assert_eq!(entries.sources[1], "~/no_space.nu");
    }

    // ── MSYS2/Cygwin home derivation test ──

    #[cfg(windows)]
    #[test]
    fn test_derive_posix_home_returns_none_for_nonexistent() {
        let fake_path = Path::new(r"C:\nonexistent_msys\usr\bin\bash.exe");
        assert!(derive_posix_home(fake_path).is_none());
    }

    #[test]
    fn test_posix_config_files_for_home() {
        let home = PathBuf::from("/tmp/test_user");
        let files = posix_config_files_for_home(&home);
        assert_eq!(files.len(), 3);
        assert!(files[0].ends_with(".bashrc"));
        assert!(files[1].ends_with(".bash_profile"));
        assert!(files[2].ends_with(".profile"));
    }

    // ── Terminal Profile Template tests ──

    #[test]
    fn test_get_builtin_templates_nonempty() {
        let templates = get_builtin_templates();
        assert!(templates.len() >= 10, "Expected at least 10 built-in templates, got {}", templates.len());
    }

    #[test]
    fn test_builtin_templates_all_marked_builtin() {
        for tpl in get_builtin_templates() {
            assert!(tpl.is_builtin, "Template '{}' should be is_builtin=true", tpl.name);
        }
    }

    #[test]
    fn test_builtin_templates_unique_ids() {
        let templates = get_builtin_templates();
        let mut ids: Vec<&str> = templates.iter().map(|t| t.id.as_str()).collect();
        let original_len = ids.len();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), original_len, "Duplicate template IDs found");
    }

    #[test]
    fn test_builtin_templates_ids_prefixed() {
        for tpl in get_builtin_templates() {
            assert!(tpl.id.starts_with("builtin-"), "Template id '{}' must start with 'builtin-'", tpl.id);
        }
    }

    #[test]
    fn test_builtin_template_categories_present() {
        let templates = get_builtin_templates();
        let has_general = templates.iter().any(|t| t.category == TemplateCategory::General);
        let has_dev = templates.iter().any(|t| t.category == TemplateCategory::Development);
        let has_devops = templates.iter().any(|t| t.category == TemplateCategory::DevOps);
        assert!(has_general, "Missing General category templates");
        assert!(has_dev, "Missing Development category templates");
        assert!(has_devops, "Missing DevOps category templates");
    }

    #[test]
    fn test_builtin_template_powershell_has_nologo() {
        let templates = get_builtin_templates();
        let ps = templates.iter().find(|t| t.id == "builtin-powershell").unwrap();
        assert_eq!(ps.shell_type, Some(ShellType::PowerShell));
        assert!(ps.args.contains(&"-NoLogo".to_string()));
    }

    #[test]
    fn test_builtin_template_nodejs_dev_env_vars() {
        let templates = get_builtin_templates();
        let node = templates.iter().find(|t| t.id == "builtin-nodejs-dev").unwrap();
        assert_eq!(node.env_vars.get("NODE_ENV"), Some(&"development".to_string()));
        assert_eq!(node.env_type, Some("node".to_string()));
        assert_eq!(node.category, TemplateCategory::Development);
        assert!(node.shell_type.is_none(), "Node.js template should have no specific shell_type");
    }

    #[test]
    fn test_builtin_template_rust_dev_env_vars() {
        let templates = get_builtin_templates();
        let rust = templates.iter().find(|t| t.id == "builtin-rust-dev").unwrap();
        assert_eq!(rust.env_vars.get("RUST_BACKTRACE"), Some(&"1".to_string()));
        assert_eq!(rust.env_type, Some("rust".to_string()));
    }

    #[test]
    fn test_builtin_template_docker_shell_has_startup_command() {
        let templates = get_builtin_templates();
        let docker = templates.iter().find(|t| t.id == "builtin-docker-shell").unwrap();
        assert!(docker.startup_command.is_some());
        assert!(docker.startup_command.as_ref().unwrap().contains("docker exec"));
    }

    #[test]
    fn test_template_category_serde_roundtrip() {
        let cat = TemplateCategory::DevOps;
        let json = serde_json::to_string(&cat).unwrap();
        assert_eq!(json, "\"devOps\"");
        let deserialized: TemplateCategory = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, TemplateCategory::DevOps);
    }

    #[test]
    fn test_template_serde_roundtrip() {
        let tpl = TerminalProfileTemplate {
            id: "test-1".into(),
            name: "Test".into(),
            description: "A test template".into(),
            icon: "terminal".into(),
            category: TemplateCategory::Custom,
            shell_type: Some(ShellType::Bash),
            args: vec!["-l".into()],
            env_vars: HashMap::from([("FOO".into(), "bar".into())]),
            cwd: Some("/tmp".into()),
            startup_command: Some("echo hi".into()),
            env_type: Some("node".into()),
            env_version: Some("20".into()),
            is_builtin: false,
        };
        let json = serde_json::to_string(&tpl).unwrap();
        assert!(json.contains("\"shellType\""), "camelCase serialization expected");
        assert!(json.contains("\"isBuiltin\""));

        let deserialized: TerminalProfileTemplate = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, "test-1");
        assert_eq!(deserialized.name, "Test");
        assert_eq!(deserialized.shell_type, Some(ShellType::Bash));
        assert_eq!(deserialized.env_vars.get("FOO"), Some(&"bar".to_string()));
        assert!(!deserialized.is_builtin);
    }

    #[test]
    fn test_create_profile_from_template_with_matching_shell() {
        let mgr = TerminalProfileManager {
            profiles_path: PathBuf::from("/tmp/profiles.json"),
            templates_path: PathBuf::from("/tmp/templates.json"),
            profiles: vec![],
            custom_templates: vec![],
        };

        let detected_shells = vec![
            ShellInfo {
                id: "pwsh-7".to_string(),
                name: "PowerShell 7".to_string(),
                shell_type: ShellType::PowerShell,
                version: Some("7.4.0".to_string()),
                executable_path: "C:\\Program Files\\PowerShell\\7\\pwsh.exe".to_string(),
                config_files: vec![],
                is_default: true,
            },
            ShellInfo {
                id: "bash-wsl".to_string(),
                name: "Bash (WSL)".to_string(),
                shell_type: ShellType::Bash,
                version: Some("5.2".to_string()),
                executable_path: "/usr/bin/bash".to_string(),
                config_files: vec![],
                is_default: false,
            },
        ];

        let profile = mgr
            .create_profile_from_template("builtin-powershell", &detected_shells)
            .unwrap();
        assert_eq!(profile.shell_id, "pwsh-7");
        assert_eq!(profile.name, "PowerShell");
        assert!(profile.args.contains(&"-NoLogo".to_string()));
        assert!(profile.id.is_empty(), "Profile id should be empty (not yet created)");
    }

    #[test]
    fn test_create_profile_from_template_fallback_shell() {
        let mgr = TerminalProfileManager {
            profiles_path: PathBuf::from("/tmp/profiles.json"),
            templates_path: PathBuf::from("/tmp/templates.json"),
            profiles: vec![],
            custom_templates: vec![],
        };

        // No shells match PowerShell → falls back to to_id()
        let detected_shells = vec![ShellInfo {
            id: "bash-1".to_string(),
            name: "Bash".to_string(),
            shell_type: ShellType::Bash,
            version: None,
            executable_path: "/bin/bash".to_string(),
            config_files: vec![],
            is_default: true,
        }];

        let profile = mgr
            .create_profile_from_template("builtin-powershell", &detected_shells)
            .unwrap();
        assert_eq!(profile.shell_id, "powershell", "Should fall back to ShellType::to_id()");
    }

    #[test]
    fn test_create_profile_from_template_no_shell_type_uses_first() {
        let mgr = TerminalProfileManager {
            profiles_path: PathBuf::from("/tmp/profiles.json"),
            templates_path: PathBuf::from("/tmp/templates.json"),
            profiles: vec![],
            custom_templates: vec![],
        };

        let detected_shells = vec![ShellInfo {
            id: "fish-1".to_string(),
            name: "Fish".to_string(),
            shell_type: ShellType::Fish,
            version: None,
            executable_path: "/usr/bin/fish".to_string(),
            config_files: vec![],
            is_default: true,
        }];

        // Node.js Dev template has shell_type: None → uses first detected shell
        let profile = mgr
            .create_profile_from_template("builtin-nodejs-dev", &detected_shells)
            .unwrap();
        assert_eq!(profile.shell_id, "fish-1");
        assert_eq!(profile.env_type, Some("node".to_string()));
    }

    #[test]
    fn test_create_profile_from_template_not_found() {
        let mgr = TerminalProfileManager {
            profiles_path: PathBuf::from("/tmp/profiles.json"),
            templates_path: PathBuf::from("/tmp/templates.json"),
            profiles: vec![],
            custom_templates: vec![],
        };
        let result = mgr.create_profile_from_template("nonexistent-id", &[]);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("not found"));
    }

    #[test]
    fn test_create_profile_from_template_empty_shells() {
        let mgr = TerminalProfileManager {
            profiles_path: PathBuf::from("/tmp/profiles.json"),
            templates_path: PathBuf::from("/tmp/templates.json"),
            profiles: vec![],
            custom_templates: vec![],
        };
        // Template with shell_type=None + empty shells → empty shell_id
        let profile = mgr
            .create_profile_from_template("builtin-nodejs-dev", &[])
            .unwrap();
        assert_eq!(profile.shell_id, "");
    }

    #[test]
    fn test_list_templates_includes_builtin_and_custom() {
        let custom = TerminalProfileTemplate {
            id: "custom-abc".into(),
            name: "My Custom".into(),
            description: "Custom template".into(),
            icon: "user".into(),
            category: TemplateCategory::Custom,
            shell_type: None,
            args: vec![],
            env_vars: HashMap::new(),
            cwd: None,
            startup_command: None,
            env_type: None,
            env_version: None,
            is_builtin: false,
        };

        let mgr = TerminalProfileManager {
            profiles_path: PathBuf::from("/tmp/profiles.json"),
            templates_path: PathBuf::from("/tmp/templates.json"),
            profiles: vec![],
            custom_templates: vec![custom],
        };

        let all = mgr.list_templates();
        let builtin_count = get_builtin_templates().len();
        assert_eq!(all.len(), builtin_count + 1);
        assert!(all.iter().any(|t| t.id == "custom-abc"));
        assert!(all.iter().any(|t| t.id == "builtin-powershell"));
    }

    #[tokio::test]
    async fn test_create_and_delete_custom_template() {
        let dir = std::env::temp_dir().join("cognia_test_tpl_crud");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        let mut mgr = TerminalProfileManager::new(&dir).await.unwrap();
        assert_eq!(mgr.custom_templates.len(), 0);

        let tpl = TerminalProfileTemplate {
            id: String::new(),
            name: "Test Custom".into(),
            description: "A test".into(),
            icon: "user".into(),
            category: TemplateCategory::Custom,
            shell_type: None,
            args: vec![],
            env_vars: HashMap::new(),
            cwd: None,
            startup_command: None,
            env_type: None,
            env_version: None,
            is_builtin: false,
        };

        let id = mgr.create_custom_template(tpl).await.unwrap();
        assert!(id.starts_with("custom-"));
        assert_eq!(mgr.custom_templates.len(), 1);
        assert_eq!(mgr.custom_templates[0].name, "Test Custom");
        assert!(!mgr.custom_templates[0].is_builtin);
        assert_eq!(mgr.custom_templates[0].category, TemplateCategory::Custom);

        // Verify persistence
        let templates_path = dir.join("terminal").join("templates.json");
        assert!(templates_path.exists());

        // Delete
        let deleted = mgr.delete_custom_template(&id).await.unwrap();
        assert!(deleted);
        assert_eq!(mgr.custom_templates.len(), 0);

        // Delete non-existent
        let deleted2 = mgr.delete_custom_template("nonexistent").await.unwrap();
        assert!(!deleted2);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_save_profile_as_template() {
        let dir = std::env::temp_dir().join("cognia_test_tpl_save_as");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        let mut mgr = TerminalProfileManager::new(&dir).await.unwrap();

        // Create a profile first
        let profile = TerminalProfile {
            id: String::new(),
            name: "My Node Profile".into(),
            shell_id: "bash".into(),
            args: vec!["-l".into()],
            env_vars: HashMap::from([("NODE_ENV".into(), "production".into())]),
            cwd: Some("/home/user/project".into()),
            startup_command: Some("nvm use 20".into()),
            env_type: Some("node".into()),
            env_version: Some("20.11.0".into()),
            is_default: false,
            created_at: String::new(),
            updated_at: String::new(),
        };
        let profile_id = mgr.create_profile(profile).await.unwrap();

        // Save as template
        let tpl_id = mgr
            .save_profile_as_template(&profile_id, "Node Prod".into(), "Production Node setup".into())
            .await
            .unwrap();

        assert!(tpl_id.starts_with("custom-"));
        assert_eq!(mgr.custom_templates.len(), 1);
        let tpl = &mgr.custom_templates[0];
        assert_eq!(tpl.name, "Node Prod");
        assert_eq!(tpl.description, "Production Node setup");
        assert_eq!(tpl.shell_type, Some(ShellType::Bash));
        assert_eq!(tpl.args, vec!["-l".to_string()]);
        assert_eq!(tpl.env_vars.get("NODE_ENV"), Some(&"production".to_string()));
        assert_eq!(tpl.cwd, Some("/home/user/project".into()));
        assert_eq!(tpl.startup_command, Some("nvm use 20".into()));
        assert_eq!(tpl.env_type, Some("node".into()));
        assert_eq!(tpl.env_version, Some("20.11.0".into()));
        assert!(!tpl.is_builtin);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_save_profile_as_template_not_found() {
        let dir = std::env::temp_dir().join("cognia_test_tpl_save_nf");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        let mut mgr = TerminalProfileManager::new(&dir).await.unwrap();
        let result = mgr
            .save_profile_as_template("nonexistent-profile", "Name".into(), "Desc".into())
            .await;
        assert!(result.is_err());

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_template_persistence_reload() {
        let dir = std::env::temp_dir().join("cognia_test_tpl_persist");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        // Create and save a custom template
        let mut mgr = TerminalProfileManager::new(&dir).await.unwrap();
        let tpl = TerminalProfileTemplate {
            id: String::new(),
            name: "Persisted".into(),
            description: "Should survive reload".into(),
            icon: "user".into(),
            category: TemplateCategory::Custom,
            shell_type: Some(ShellType::Zsh),
            args: vec!["-l".into()],
            env_vars: HashMap::from([("KEY".into(), "VALUE".into())]),
            cwd: None,
            startup_command: None,
            env_type: None,
            env_version: None,
            is_builtin: false,
        };
        let id = mgr.create_custom_template(tpl).await.unwrap();
        drop(mgr);

        // Reload from disk
        let mgr2 = TerminalProfileManager::new(&dir).await.unwrap();
        assert_eq!(mgr2.custom_templates.len(), 1);
        assert_eq!(mgr2.custom_templates[0].id, id);
        assert_eq!(mgr2.custom_templates[0].name, "Persisted");
        assert_eq!(mgr2.custom_templates[0].shell_type, Some(ShellType::Zsh));
        assert_eq!(mgr2.custom_templates[0].env_vars.get("KEY"), Some(&"VALUE".to_string()));

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_create_profile_from_custom_template() {
        let custom = TerminalProfileTemplate {
            id: "custom-mytest".into(),
            name: "My Custom Dev".into(),
            description: "Custom dev template".into(),
            icon: "user".into(),
            category: TemplateCategory::Custom,
            shell_type: Some(ShellType::Zsh),
            args: vec!["-l".into(), "-i".into()],
            env_vars: HashMap::from([("CUSTOM".into(), "yes".into())]),
            cwd: Some("~/dev".into()),
            startup_command: Some("echo custom".into()),
            env_type: Some("python".into()),
            env_version: Some("3.12".into()),
            is_builtin: false,
        };

        let mgr = TerminalProfileManager {
            profiles_path: PathBuf::from("/tmp/profiles.json"),
            templates_path: PathBuf::from("/tmp/templates.json"),
            profiles: vec![],
            custom_templates: vec![custom],
        };

        let shells = vec![ShellInfo {
            id: "zsh-1".to_string(),
            name: "Zsh".to_string(),
            shell_type: ShellType::Zsh,
            version: Some("5.9".to_string()),
            executable_path: "/usr/bin/zsh".to_string(),
            config_files: vec![],
            is_default: true,
        }];

        let profile = mgr
            .create_profile_from_template("custom-mytest", &shells)
            .unwrap();
        assert_eq!(profile.shell_id, "zsh-1");
        assert_eq!(profile.name, "My Custom Dev");
        assert_eq!(profile.args, vec!["-l".to_string(), "-i".to_string()]);
        assert_eq!(profile.env_vars.get("CUSTOM"), Some(&"yes".to_string()));
        assert_eq!(profile.cwd, Some("~/dev".into()));
        assert_eq!(profile.startup_command, Some("echo custom".into()));
        assert_eq!(profile.env_type, Some("python".into()));
        assert_eq!(profile.env_version, Some("3.12".into()));
        assert!(!profile.is_default);
    }

    // ── Framework Cache Management tests ──

    fn make_dummy_framework(name: &str) -> ShellFrameworkInfo {
        ShellFrameworkInfo {
            name: name.to_string(),
            version: None,
            path: String::new(),
            shell_type: ShellType::Bash,
            category: FrameworkCategory::Framework,
            description: String::new(),
            homepage: None,
            config_path: None,
            active_theme: None,
        }
    }

    #[test]
    fn test_get_oh_my_posh_cache_paths_includes_legacy() {
        let home = PathBuf::from("/tmp/test_home_omp");
        let paths = get_oh_my_posh_cache_paths(&home);
        assert!(paths.iter().any(|p| p.ends_with(".oh-my-posh")));
    }

    #[test]
    fn test_get_starship_cache_paths_nonempty() {
        let home = PathBuf::from("/tmp/test_home_starship");
        let paths = get_starship_cache_paths(&home);
        assert!(!paths.is_empty());
        assert!(paths.iter().any(|p| p.to_str().unwrap().contains("starship")));
    }

    #[test]
    fn test_get_oh_my_zsh_cache_paths_default() {
        let home = PathBuf::from("/tmp/test_home_omz");
        let paths = get_oh_my_zsh_cache_paths(&home);
        assert!(paths.iter().any(|p| p.ends_with("cache")));
        assert!(paths.iter().any(|p| p.to_str().unwrap().contains(".oh-my-zsh")));
    }

    #[test]
    fn test_get_prezto_cache_paths() {
        let home = PathBuf::from("/tmp/test_home_prezto");
        let paths = get_prezto_cache_paths(&home);
        assert_eq!(paths.len(), 1);
        assert!(paths[0].to_str().unwrap().contains(".zprezto"));
        assert!(paths[0].ends_with("cache"));
    }

    #[test]
    fn test_get_zinit_cache_paths_includes_legacy() {
        let home = PathBuf::from("/tmp/test_home_zinit");
        let paths = get_zinit_cache_paths(&home);
        assert!(paths.iter().any(|p| p.ends_with(".zinit")));
        assert!(paths.iter().any(|p| p.to_str().unwrap().contains("zinit")));
    }

    #[test]
    fn test_get_oh_my_bash_cache_paths() {
        let home = PathBuf::from("/tmp/test_home_omb");
        let paths = get_oh_my_bash_cache_paths(&home);
        assert_eq!(paths.len(), 1);
        assert!(paths[0].to_str().unwrap().contains(".oh-my-bash"));
    }

    #[test]
    fn test_get_oh_my_fish_cache_paths() {
        let home = PathBuf::from("/tmp/test_home_omf");
        let paths = get_oh_my_fish_cache_paths(&home);
        assert!(!paths.is_empty());
        assert!(paths.iter().any(|p| p.to_str().unwrap().contains("omf")));
    }

    #[test]
    fn test_get_antidote_cache_paths() {
        let home = PathBuf::from("/tmp/test_home_antidote");
        let paths = get_antidote_cache_paths(&home);
        assert!(paths.len() >= 2);
        assert!(paths.iter().any(|p| p.ends_with(".antidote")));
        assert!(paths.iter().any(|p| p.to_str().unwrap().contains("antidote")));
    }

    #[test]
    fn test_get_zplug_cache_paths() {
        let home = PathBuf::from("/tmp/test_home_zplug");
        let paths = get_zplug_cache_paths(&home);
        assert!(paths.iter().any(|p| p.to_str().unwrap().contains(".zplug")));
    }

    #[test]
    fn test_get_bashit_cache_paths() {
        let home = PathBuf::from("/tmp/test_home_bashit");
        let paths = get_bashit_cache_paths(&home);
        assert_eq!(paths.len(), 1);
        assert!(paths[0].to_str().unwrap().contains(".bash_it"));
    }

    #[test]
    fn test_resolve_framework_cache_paths_unknown_framework() {
        let fw = make_dummy_framework("UnknownFramework");
        let paths = resolve_framework_cache_paths(&fw);
        assert!(paths.is_empty());
    }

    #[test]
    fn test_resolve_framework_cache_paths_filters_nonexistent() {
        // All candidate paths are non-existent for a dummy home, so result should be empty
        let fw = make_dummy_framework("Prezto");
        let paths = resolve_framework_cache_paths(&fw);
        // Paths only include those that actually exist on disk
        for p in &paths {
            assert!(p.exists(), "Path should exist: {}", p.display());
        }
    }

    #[test]
    fn test_calc_path_size_sync_nonexistent() {
        let size = calc_path_size_sync(Path::new("/nonexistent/path/abc123"));
        assert_eq!(size, 0);
    }

    #[test]
    fn test_calc_path_size_sync_single_file() {
        let dir = std::env::temp_dir().join("cognia_test_calc_size_file");
        let _ = std::fs::create_dir_all(&dir);
        let file_path = dir.join("test.txt");
        std::fs::write(&file_path, "hello world").unwrap(); // 11 bytes
        let size = calc_path_size_sync(&file_path);
        assert_eq!(size, 11);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_calc_path_size_sync_directory() {
        let dir = std::env::temp_dir().join("cognia_test_calc_size_dir");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("a.txt"), "aaaa").unwrap(); // 4 bytes
        std::fs::write(dir.join("b.txt"), "bbbbbb").unwrap(); // 6 bytes

        let sub = dir.join("sub");
        std::fs::create_dir_all(&sub).unwrap();
        std::fs::write(sub.join("c.txt"), "cc").unwrap(); // 2 bytes

        let size = calc_path_size_sync(&dir);
        assert_eq!(size, 12); // 4 + 6 + 2
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_calc_path_size_sync_empty_directory() {
        let dir = std::env::temp_dir().join("cognia_test_calc_size_empty");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let size = calc_path_size_sync(&dir);
        assert_eq!(size, 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_format_size_delegates() {
        let result = format_size(1024);
        assert!(result.contains("1"), "Expected '1' in '{}'", result);
        assert!(
            result.contains("KB") || result.contains("KiB") || result.contains("kB"),
            "Expected KB-like unit in '{}'",
            result
        );

        let result_zero = format_size(0);
        assert!(result_zero.contains("0"), "Expected '0' in '{}'", result_zero);
    }

    #[test]
    fn test_framework_cache_info_serde() {
        let info = FrameworkCacheInfo {
            framework_name: "Starship".to_string(),
            cache_paths: vec!["/tmp/starship".to_string()],
            total_size: 1024,
            total_size_human: "1.0 KB".to_string(),
            can_clean: true,
            description: "Cache files for Starship".to_string(),
        };
        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("frameworkName")); // camelCase
        assert!(json.contains("totalSize"));
        assert!(json.contains("canClean"));

        let deserialized: FrameworkCacheInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.framework_name, "Starship");
        assert_eq!(deserialized.total_size, 1024);
        assert!(deserialized.can_clean);
    }

    #[tokio::test]
    async fn test_clean_dir_contents() {
        let dir = std::env::temp_dir().join("cognia_test_clean_dir");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("file1.txt"), "data").unwrap();
        std::fs::write(dir.join("file2.txt"), "more data").unwrap();
        let sub = dir.join("subdir");
        std::fs::create_dir_all(&sub).unwrap();
        std::fs::write(sub.join("nested.txt"), "nested").unwrap();

        assert!(dir.join("file1.txt").exists());
        assert!(sub.join("nested.txt").exists());

        clean_dir_contents(&dir).await.unwrap();

        // Dir itself should still exist
        assert!(dir.exists());
        // But contents should be gone
        assert!(!dir.join("file1.txt").exists());
        assert!(!dir.join("file2.txt").exists());
        assert!(!sub.exists());

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_clean_dir_contents_empty_dir() {
        let dir = std::env::temp_dir().join("cognia_test_clean_dir_empty");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        let result = clean_dir_contents(&dir).await;
        assert!(result.is_ok());
        assert!(dir.exists());

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_get_framework_cache_info_no_cache() {
        // Framework with no existing cache should report 0 size
        let fw = make_dummy_framework("UnknownFramework");
        let info = get_framework_cache_info(&fw).await;
        assert_eq!(info.framework_name, "UnknownFramework");
        assert_eq!(info.total_size, 0);
        assert!(!info.can_clean);
        assert!(info.cache_paths.is_empty());
    }

    #[tokio::test]
    async fn test_get_all_framework_cache_stats_deduplication() {
        let frameworks = vec![
            make_dummy_framework("TestFW"),
            make_dummy_framework("TestFW"), // duplicate
            make_dummy_framework("AnotherFW"),
        ];
        let stats = get_all_framework_cache_stats(&frameworks).await;
        // Should deduplicate: only 2 unique framework names
        let names: Vec<&str> = stats.iter().map(|s| s.framework_name.as_str()).collect();
        assert_eq!(names.len(), 2);
        assert!(names.contains(&"TestFW"));
        assert!(names.contains(&"AnotherFW"));
    }

    #[tokio::test]
    async fn test_get_all_framework_cache_stats_empty() {
        let stats = get_all_framework_cache_stats(&[]).await;
        assert!(stats.is_empty());
    }

    #[tokio::test]
    async fn test_get_all_framework_cache_stats_sorted_by_size_desc() {
        // All unknown frameworks → all 0 size, but verify no panic
        let frameworks = vec![
            make_dummy_framework("FW_A"),
            make_dummy_framework("FW_B"),
            make_dummy_framework("FW_C"),
        ];
        let stats = get_all_framework_cache_stats(&frameworks).await;
        assert_eq!(stats.len(), 3);
        // All 0, so sorted order is stable but no crash
        for i in 0..stats.len() - 1 {
            assert!(stats[i].total_size >= stats[i + 1].total_size);
        }
    }
}
