use crate::error::{CogniaError, CogniaResult};
use crate::platform::fs;
use crate::platform::process;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Shim configuration for a specific environment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShimConfig {
    pub env_type: String,
    pub binary_name: String,
    pub version: Option<String>,
    pub target_path: PathBuf,
}

/// Shim manager for handling executable shims
pub struct ShimManager {
    shim_dir: PathBuf,
    configs: HashMap<String, ShimConfig>,
}

impl ShimManager {
    pub async fn new(base_dir: &Path) -> CogniaResult<Self> {
        let shim_dir = base_dir.join("shims");
        fs::create_dir_all(&shim_dir).await?;

        let mut manager = Self {
            shim_dir,
            configs: HashMap::new(),
        };

        manager.load_configs().await?;

        Ok(manager)
    }

    async fn load_configs(&mut self) -> CogniaResult<()> {
        let config_path = self.shim_dir.join("shims.json");
        if fs::exists(&config_path).await {
            let content = fs::read_file_string(&config_path).await?;
            self.configs = serde_json::from_str(&content)
                .map_err(|e| CogniaError::Config(format!("Failed to parse shim config: {}", e)))?;
        }
        Ok(())
    }

    async fn save_configs(&self) -> CogniaResult<()> {
        let config_path = self.shim_dir.join("shims.json");
        let content = serde_json::to_string_pretty(&self.configs)
            .map_err(|e| CogniaError::Config(format!("Failed to serialize shim config: {}", e)))?;
        fs::write_file_string(&config_path, &content).await?;
        Ok(())
    }

    /// Create a shim for a binary
    pub async fn create_shim(&mut self, config: ShimConfig) -> CogniaResult<PathBuf> {
        let shim_path = self.get_shim_path(&config.binary_name);

        #[cfg(windows)]
        {
            self.create_windows_shim(&shim_path, &config).await?;
        }

        #[cfg(unix)]
        {
            self.create_unix_shim(&shim_path, &config).await?;
        }

        self.configs.insert(config.binary_name.clone(), config);
        self.save_configs().await?;

        Ok(shim_path)
    }

    #[cfg(windows)]
    async fn create_windows_shim(&self, shim_path: &Path, config: &ShimConfig) -> CogniaResult<()> {
        // Create a CMD wrapper script
        let cmd_content = format!(
            r#"@echo off
setlocal
set "COGNIA_SHIM=1"
set "COGNIA_ENV_TYPE={}"
{}
"%~dp0\..\versions\{}\{}\{}" %*
"#,
            config.env_type,
            config
                .version
                .as_ref()
                .map(|v| format!("set \"COGNIA_VERSION={}\"", v))
                .unwrap_or_default(),
            config.env_type,
            config.version.as_deref().unwrap_or("current"),
            config.binary_name,
        );

        let cmd_path = shim_path.with_extension("cmd");
        fs::write_file_string(&cmd_path, &cmd_content).await?;

        // Also create a PowerShell wrapper for better compatibility
        let ps1_content = format!(
            r#"#!/usr/bin/env pwsh
$env:COGNIA_SHIM = "1"
$env:COGNIA_ENV_TYPE = "{}"
{}
$targetPath = Join-Path $PSScriptRoot "..\versions\{}\{}\{}"
& $targetPath @args
exit $LASTEXITCODE
"#,
            config.env_type,
            config
                .version
                .as_ref()
                .map(|v| format!("$env:COGNIA_VERSION = \"{}\"", v))
                .unwrap_or_default(),
            config.env_type,
            config.version.as_deref().unwrap_or("current"),
            config.binary_name,
        );

        let ps1_path = shim_path.with_extension("ps1");
        fs::write_file_string(&ps1_path, &ps1_content).await?;

        Ok(())
    }

    #[cfg(unix)]
    async fn create_unix_shim(&self, shim_path: &Path, config: &ShimConfig) -> CogniaResult<()> {
        let content = format!(
            r#"#!/bin/bash
export COGNIA_SHIM=1
export COGNIA_ENV_TYPE="{}"
{}
exec "${{BASH_SOURCE%/*}}/../versions/{}/{}/{}" "$@"
"#,
            config.env_type,
            config
                .version
                .as_ref()
                .map(|v| format!("export COGNIA_VERSION=\"{}\"", v))
                .unwrap_or_default(),
            config.env_type,
            config.version.as_deref().unwrap_or("current"),
            config.binary_name,
        );

        fs::write_file_string(shim_path, &content).await?;

        // Make executable
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o755);
        std::fs::set_permissions(shim_path, perms)?;

        Ok(())
    }

    /// Remove a shim
    pub async fn remove_shim(&mut self, binary_name: &str) -> CogniaResult<bool> {
        let shim_path = self.get_shim_path(binary_name);

        let mut removed = false;

        if fs::exists(&shim_path).await {
            fs::remove_file(&shim_path).await?;
            removed = true;
        }

        #[cfg(windows)]
        {
            let cmd_path = shim_path.with_extension("cmd");
            if fs::exists(&cmd_path).await {
                fs::remove_file(&cmd_path).await?;
                removed = true;
            }

            let ps1_path = shim_path.with_extension("ps1");
            if fs::exists(&ps1_path).await {
                fs::remove_file(&ps1_path).await?;
                removed = true;
            }
        }

        self.configs.remove(binary_name);
        self.save_configs().await?;

        Ok(removed)
    }

    /// Update a shim to point to a new version
    pub async fn update_shim_version(
        &mut self,
        binary_name: &str,
        version: Option<String>,
    ) -> CogniaResult<()> {
        let config = self
            .configs
            .get(binary_name)
            .cloned()
            .ok_or_else(|| CogniaError::Internal(format!("Shim not found: {}", binary_name)))?;

        let new_config = ShimConfig { version, ..config };

        self.create_shim(new_config).await?;
        Ok(())
    }

    /// List all shims
    pub fn list_shims(&self) -> Vec<&ShimConfig> {
        self.configs.values().collect()
    }

    /// Get the path where shims are stored
    pub fn shim_dir(&self) -> &Path {
        &self.shim_dir
    }

    fn get_shim_path(&self, binary_name: &str) -> PathBuf {
        #[cfg(windows)]
        {
            self.shim_dir.join(binary_name)
        }

        #[cfg(unix)]
        {
            self.shim_dir.join(binary_name)
        }
    }

    /// Regenerate all shims
    pub async fn regenerate_all(&mut self) -> CogniaResult<()> {
        let configs: Vec<_> = self.configs.values().cloned().collect();
        for config in configs {
            self.create_shim(config).await?;
        }
        Ok(())
    }
}

/// PATH manager for adding/removing shim directory from system PATH
pub struct PathManager {
    shim_dir: PathBuf,
}

impl PathManager {
    pub fn new(shim_dir: PathBuf) -> Self {
        Self { shim_dir }
    }

    /// Check if shim directory is in PATH
    pub fn is_in_path(&self) -> bool {
        if let Ok(path) = std::env::var("PATH") {
            let separator = if cfg!(windows) { ';' } else { ':' };
            let shim_str = self.shim_dir.to_string_lossy();
            path.split(separator).any(|p| {
                let p_normalized = p.replace('\\', "/").to_lowercase();
                let shim_normalized = shim_str.replace('\\', "/").to_lowercase();
                p_normalized == shim_normalized
            })
        } else {
            false
        }
    }

    /// Get the command to add shim directory to PATH
    pub fn get_add_to_path_command(&self) -> String {
        #[cfg(windows)]
        {
            format!(
                r#"[Environment]::SetEnvironmentVariable("Path", $env:Path + ";{}", "User")"#,
                self.shim_dir.display()
            )
        }

        #[cfg(target_os = "macos")]
        {
            format!(
                r#"echo 'export PATH="{}:$PATH"' >> ~/.zshrc && source ~/.zshrc"#,
                self.shim_dir.display()
            )
        }

        #[cfg(all(unix, not(target_os = "macos")))]
        {
            format!(
                r#"echo 'export PATH="{}:$PATH"' >> ~/.bashrc && source ~/.bashrc"#,
                self.shim_dir.display()
            )
        }
    }

    /// Add shim directory to PATH (requires appropriate permissions)
    #[cfg(windows)]
    pub async fn add_to_path(&self) -> CogniaResult<()> {
        let output = process::execute(
            "powershell",
            &[
                "-Command",
                &format!(
                    r#"$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*{}*") {{
    [Environment]::SetEnvironmentVariable("Path", $currentPath + ";{}", "User")
}}"#,
                    self.shim_dir.display(),
                    self.shim_dir.display()
                ),
            ],
            None,
        )
        .await?;

        if !output.success {
            return Err(CogniaError::Internal(format!(
                "Failed to add to PATH: {}",
                output.stderr
            )));
        }

        Ok(())
    }

    #[cfg(unix)]
    pub async fn add_to_path(&self) -> CogniaResult<()> {
        let shell_rc = Self::get_shell_rc();
        let export_line = format!("export PATH=\"{}:$PATH\"", self.shim_dir.display());

        // Check if already in rc file
        if let Ok(content) = std::fs::read_to_string(&shell_rc) {
            if content.contains(&export_line) {
                return Ok(());
            }
        }

        // Append to rc file
        use std::io::Write;
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&shell_rc)?;

        writeln!(file, "\n# Cognia Launcher")?;
        writeln!(file, "{}", export_line)?;

        Ok(())
    }

    #[cfg(unix)]
    fn get_shell_rc() -> PathBuf {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));

        // Try to detect shell
        if let Ok(shell) = std::env::var("SHELL") {
            if shell.contains("zsh") {
                return home.join(".zshrc");
            } else if shell.contains("fish") {
                return home.join(".config/fish/config.fish");
            }
        }

        home.join(".bashrc")
    }

    /// Remove shim directory from PATH
    #[cfg(windows)]
    pub async fn remove_from_path(&self) -> CogniaResult<()> {
        let output = process::execute(
            "powershell",
            &[
                "-Command",
                &format!(
                    r#"$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
$newPath = ($currentPath -split ';' | Where-Object {{ $_ -ne "{}" }}) -join ';'
[Environment]::SetEnvironmentVariable("Path", $newPath, "User")"#,
                    self.shim_dir.display()
                ),
            ],
            None,
        )
        .await?;

        if !output.success {
            return Err(CogniaError::Internal(format!(
                "Failed to remove from PATH: {}",
                output.stderr
            )));
        }

        Ok(())
    }

    #[cfg(unix)]
    pub async fn remove_from_path(&self) -> CogniaResult<()> {
        let shell_rc = Self::get_shell_rc();
        let export_line = format!("export PATH=\"{}:$PATH\"", self.shim_dir.display());

        if let Ok(content) = std::fs::read_to_string(&shell_rc) {
            let new_content: Vec<_> = content
                .lines()
                .filter(|line| !line.contains(&export_line) && !line.contains("# Cognia Launcher"))
                .collect();

            std::fs::write(&shell_rc, new_content.join("\n"))?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shim_config() {
        let config = ShimConfig {
            env_type: "node".into(),
            binary_name: "node".into(),
            version: Some("18.0.0".into()),
            target_path: PathBuf::from("/usr/local/bin/node"),
        };

        assert_eq!(config.env_type, "node");
        assert_eq!(config.version, Some("18.0.0".into()));
    }
}
