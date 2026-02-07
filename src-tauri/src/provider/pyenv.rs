use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::{dirs_home, EnvModifications, Platform},
    process,
};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

pub struct PyenvProvider {
    pyenv_root: Option<PathBuf>,
}

impl PyenvProvider {
    pub fn new() -> Self {
        let pyenv_root = std::env::var("PYENV_ROOT")
            .ok()
            .map(PathBuf::from)
            .or_else(|| dirs_home().map(|h| h.join(".pyenv")));

        Self { pyenv_root }
    }

    fn pyenv_root(&self) -> CogniaResult<&PathBuf> {
        self.pyenv_root
            .as_ref()
            .ok_or_else(|| CogniaError::Provider("PYENV_ROOT not found".into()))
    }

    async fn run_pyenv(&self, args: &[&str]) -> CogniaResult<String> {
        let output = process::execute("pyenv", args, None).await?;
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }
}

impl Default for PyenvProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for PyenvProvider {
    fn id(&self) -> &str {
        "pyenv"
    }

    fn display_name(&self) -> &str {
        "Python Version Manager"
    }

    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::List,
            Capability::VersionSwitch,
            Capability::MultiVersion,
            Capability::ProjectLocal,
        ])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Linux, Platform::MacOS, Platform::Windows]
    }

    fn priority(&self) -> i32 {
        100
    }

    async fn is_available(&self) -> bool {
        if process::which("pyenv").await.is_none() {
            return false;
        }
        // Verify pyenv actually works
        match process::execute("pyenv", &["--version"], None).await {
            Ok(output) => output.success,
            Err(_) => false,
        }
    }

    async fn search(
        &self,
        query: &str,
        _options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let output = self.run_pyenv(&["install", "--list"]).await?;

        let versions: Vec<PackageSummary> = output
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty() && !line.starts_with('#'))
            .filter(|line| line.contains(query) || query.is_empty())
            .filter(|line| {
                line.chars()
                    .next()
                    .map(|c| c.is_ascii_digit())
                    .unwrap_or(false)
            })
            .map(|version| PackageSummary {
                name: format!("python@{}", version),
                description: Some("Python programming language".into()),
                latest_version: Some(version.to_string()),
                provider: self.id().to_string(),
            })
            .collect();

        Ok(versions)
    }

    async fn get_package_info(&self, _name: &str) -> CogniaResult<PackageInfo> {
        let versions = self.get_versions("python").await?;

        Ok(PackageInfo {
            name: "python".to_string(),
            display_name: Some("Python".to_string()),
            description: Some("Python programming language".to_string()),
            homepage: Some("https://python.org".to_string()),
            license: Some("PSF".to_string()),
            repository: Some("https://github.com/python/cpython".to_string()),
            versions,
            provider: self.id().to_string(),
        })
    }

    async fn get_versions(&self, _name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let output = self.run_pyenv(&["install", "--list"]).await?;

        let versions: Vec<VersionInfo> = output
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty() && !line.starts_with('#'))
            .filter(|line| {
                line.chars()
                    .next()
                    .map(|c| c.is_ascii_digit())
                    .unwrap_or(false)
            })
            .map(|version| VersionInfo {
                version: version.to_string(),
                release_date: None,
                deprecated: false,
                yanked: false,
            })
            .collect();

        Ok(versions)
    }

    async fn install(&self, request: InstallRequest) -> CogniaResult<InstallReceipt> {
        self.install_with_progress(request, None).await
    }

    async fn install_with_progress(
        &self,
        request: InstallRequest,
        progress: Option<ProgressSender>,
    ) -> CogniaResult<InstallReceipt> {
        let version = request
            .version
            .clone()
            .ok_or_else(|| CogniaError::Provider("Version required for install".into()))?;
        
        let package_name = format!("python@{}", version);

        // Stage 1: Fetching metadata
        if let Some(ref tx) = progress {
            let _ = tx.send(InstallProgressEvent::fetching(&package_name)).await;
        }

        // Stage 2: Downloading/compiling (pyenv compiles from source)
        if let Some(ref tx) = progress {
            let _ = tx.send(InstallProgressEvent::configuring(&package_name, "Downloading and compiling Python (this may take several minutes)")).await;
        }

        // Run the actual installation
        let result = self.run_pyenv(&["install", &version]).await;

        if let Err(ref e) = result {
            if let Some(ref tx) = progress {
                let _ = tx.send(InstallProgressEvent::failed(&package_name, &e.to_string())).await;
            }
            return Err(result.unwrap_err());
        }

        // Stage 3: Verify installation
        if let Some(ref tx) = progress {
            let _ = tx.send(InstallProgressEvent::configuring(&package_name, "Verifying installation")).await;
        }

        let pyenv_root = self.pyenv_root()?;
        let install_path = pyenv_root.join("versions").join(&version);

        // Verify the installation directory exists
        if !install_path.exists() {
            let err_msg = format!("Installation path not found: {:?}", install_path);
            if let Some(ref tx) = progress {
                let _ = tx.send(InstallProgressEvent::failed(&package_name, &err_msg)).await;
            }
            return Err(CogniaError::Installation(err_msg));
        }

        // Stage 4: Done
        if let Some(ref tx) = progress {
            let _ = tx.send(InstallProgressEvent::done(&package_name, &version)).await;
        }

        Ok(InstallReceipt {
            name: "python".to_string(),
            version,
            provider: self.id().to_string(),
            install_path,
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, request: UninstallRequest) -> CogniaResult<()> {
        let version = request
            .version
            .ok_or_else(|| CogniaError::Provider("Version required for uninstall".into()))?;

        self.run_pyenv(&["uninstall", "-f", &version]).await?;
        Ok(())
    }

    async fn list_installed(
        &self,
        _filter: InstalledFilter,
    ) -> CogniaResult<Vec<InstalledPackage>> {
        let output = self.run_pyenv(&["versions", "--bare"]).await?;
        let pyenv_root = self.pyenv_root()?;

        let packages: Vec<InstalledPackage> = output
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .map(|version| InstalledPackage {
                name: "python".to_string(),
                version: version.to_string(),
                provider: self.id().to_string(),
                install_path: pyenv_root.join("versions").join(version),
                installed_at: String::new(),
                is_global: true,
            })
            .collect();

        Ok(packages)
    }

    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        // Compare installed pyenv versions with latest available
        let installed = self.run_pyenv(&["versions", "--bare"]).await.unwrap_or_default();
        let available = self.run_pyenv(&["install", "--list"]).await.unwrap_or_default();

        // Find latest stable CPython version (e.g., "3.13.2", not "3.13.2t" or "miniconda")
        let latest = available
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .filter(|l| {
                // Only match pure version numbers like "3.x.y"
                l.chars().next().map_or(false, |c| c.is_ascii_digit())
                    && !l.contains('-')
                    && !l.contains('a')
                    && !l.contains('b')
                    && !l.contains("rc")
                    && !l.ends_with('t')
            })
            .last()
            .unwrap_or("")
            .to_string();

        if latest.is_empty() {
            return Ok(vec![]);
        }

        let mut updates = Vec::new();
        for line in installed.lines() {
            let version = line.trim();
            if version.is_empty() || !version.chars().next().map_or(false, |c| c.is_ascii_digit()) {
                continue;
            }
            // Compare major.minor: only suggest update if same major.minor has newer patch
            let installed_parts: Vec<&str> = version.splitn(3, '.').collect();
            let latest_parts: Vec<&str> = latest.splitn(3, '.').collect();

            if installed_parts.len() >= 2
                && latest_parts.len() >= 2
                && installed_parts[0] == latest_parts[0]
                && installed_parts[1] == latest_parts[1]
                && version != latest
            {
                updates.push(UpdateInfo {
                    name: "python".into(),
                    current_version: version.to_string(),
                    latest_version: latest.clone(),
                    provider: self.id().into(),
                });
            }
        }

        Ok(updates)
    }
}

#[async_trait]
impl EnvironmentProvider for PyenvProvider {
    async fn list_installed_versions(&self) -> CogniaResult<Vec<InstalledVersion>> {
        let output = self.run_pyenv(&["versions", "--bare"]).await?;
        let current = self.get_current_version().await?.unwrap_or_default();
        let pyenv_root = self.pyenv_root()?;

        let versions: Vec<InstalledVersion> = output
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .map(|version| InstalledVersion {
                version: version.to_string(),
                install_path: pyenv_root.join("versions").join(version),
                size: None,
                installed_at: None,
                is_current: version == current,
            })
            .collect();

        Ok(versions)
    }

    async fn get_current_version(&self) -> CogniaResult<Option<String>> {
        let output = self.run_pyenv(&["version-name"]).await?;
        let version = output.trim();

        if version == "system" || version.is_empty() {
            Ok(None)
        } else {
            Ok(Some(version.to_string()))
        }
    }

    async fn set_global_version(&self, version: &str) -> CogniaResult<()> {
        self.run_pyenv(&["global", version]).await?;
        Ok(())
    }

    async fn set_local_version(&self, project_path: &Path, version: &str) -> CogniaResult<()> {
        let version_file = project_path.join(self.version_file_name());
        crate::platform::fs::write_file_string(&version_file, version).await?;
        Ok(())
    }

    async fn detect_version(&self, start_path: &Path) -> CogniaResult<Option<VersionDetection>> {
        let mut current = start_path.to_path_buf();

        // Walk up directory tree looking for version files
        loop {
            // 1. Check .python-version file (highest priority)
            let version_file = current.join(self.version_file_name());
            if version_file.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&version_file).await {
                    let version = content.trim().to_string();
                    if !version.is_empty() {
                        return Ok(Some(VersionDetection {
                            version,
                            source: VersionSource::LocalFile,
                            source_path: Some(version_file),
                        }));
                    }
                }
            }

            // 2. Check .tool-versions file (asdf-style)
            let tool_versions = current.join(".tool-versions");
            if tool_versions.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&tool_versions).await {
                    for line in content.lines() {
                        let line = line.trim();
                        if line.starts_with("python ") {
                            let version = line.strip_prefix("python ").unwrap_or("").trim();
                            if !version.is_empty() {
                                return Ok(Some(VersionDetection {
                                    version: version.to_string(),
                                    source: VersionSource::LocalFile,
                                    source_path: Some(tool_versions),
                                }));
                            }
                        }
                    }
                }
            }

            if !current.pop() {
                break;
            }
        }

        // 3. Check pyproject.toml for requires-python
        let pyproject = start_path.join("pyproject.toml");
        if pyproject.exists() {
            if let Ok(content) = crate::platform::fs::read_file_string(&pyproject).await {
                // Parse requires-python from [project] section
                // Format: requires-python = ">=3.8" or requires-python = "3.11"
                for line in content.lines() {
                    let line = line.trim();
                    if line.starts_with("requires-python") {
                        if let Some(value) = line.split('=').nth(1) {
                            let version = value
                                .trim()
                                .trim_matches('"')
                                .trim_matches('\'')
                                .trim_start_matches(">=")
                                .trim_start_matches("^")
                                .trim_start_matches("~=")
                                .trim();
                            if !version.is_empty() {
                                return Ok(Some(VersionDetection {
                                    version: version.to_string(),
                                    source: VersionSource::Manifest,
                                    source_path: Some(pyproject),
                                }));
                            }
                        }
                    }
                }
            }
        }

        // 4. Check runtime.txt (Heroku-style)
        let runtime_txt = start_path.join("runtime.txt");
        if runtime_txt.exists() {
            if let Ok(content) = crate::platform::fs::read_file_string(&runtime_txt).await {
                let line = content.trim();
                // Format: python-3.11.4
                if let Some(version) = line.strip_prefix("python-") {
                    if !version.is_empty() {
                        return Ok(Some(VersionDetection {
                            version: version.to_string(),
                            source: VersionSource::LocalFile,
                            source_path: Some(runtime_txt),
                        }));
                    }
                }
            }
        }

        // 5. Fall back to current pyenv version
        if let Some(version) = self.get_current_version().await? {
            return Ok(Some(VersionDetection {
                version,
                source: VersionSource::SystemDefault,
                source_path: None,
            }));
        }

        Ok(None)
    }

    fn get_env_modifications(&self, version: &str) -> CogniaResult<EnvModifications> {
        let pyenv_root = self.pyenv_root()?;
        let python_path = pyenv_root.join("versions").join(version).join("bin");

        Ok(EnvModifications::new().prepend_path(python_path))
    }

    fn version_file_name(&self) -> &str {
        ".python-version"
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}
