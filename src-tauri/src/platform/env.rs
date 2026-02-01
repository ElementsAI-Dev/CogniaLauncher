use std::collections::HashMap;
use std::env;
use std::path::PathBuf;

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
            });
        }

        for (key, value) in &self.set_variables {
            commands.push(match shell {
                ShellType::Bash | ShellType::Zsh => format!("export {}=\"{}\"", key, value),
                ShellType::Fish => format!("set -gx {} \"{}\"", key, value),
                ShellType::PowerShell => format!("$env:{} = \"{}\"", key, value),
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
            };
            commands.push(path_cmd);
        }

        commands.join("\n")
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShellType {
    Bash,
    Zsh,
    Fish,
    PowerShell,
}

impl ShellType {
    pub fn detect() -> Self {
        if let Ok(shell) = env::var("SHELL") {
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
        if env::var("PSModulePath").is_ok() {
            return ShellType::PowerShell;
        }

        ShellType::Bash
    }

    pub fn config_file(&self) -> Option<PathBuf> {
        let home = dirs_home()?;

        Some(match self {
            ShellType::Bash => home.join(".bashrc"),
            ShellType::Zsh => home.join(".zshrc"),
            ShellType::Fish => home.join(".config/fish/config.fish"),
            ShellType::PowerShell => {
                #[cfg(windows)]
                {
                    home.join("Documents/PowerShell/Microsoft.PowerShell_profile.ps1")
                }
                #[cfg(not(windows))]
                {
                    home.join(".config/powershell/Microsoft.PowerShell_profile.ps1")
                }
            }
        })
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
}
