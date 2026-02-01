use crate::error::{CogniaError, CogniaResult};
use crate::platform::fs;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub const MANIFEST_FILENAME: &str = "CogniaLauncher.yaml";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Manifest {
    #[serde(default)]
    pub project: ProjectInfo,
    #[serde(default)]
    pub environments: HashMap<String, EnvironmentSpec>,
    #[serde(default)]
    pub packages: Vec<PackageDep>,
    #[serde(default)]
    pub custom_packages: Vec<CustomPackageDep>,
    #[serde(default)]
    pub platforms: HashMap<String, PlatformOverride>,
    #[serde(default)]
    pub profiles: HashMap<String, ProfileConfig>,
    #[serde(default)]
    pub hooks: HooksConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProjectInfo {
    pub name: Option<String>,
    pub version: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentSpec {
    pub version: String,
    pub provider: Option<String>,
    #[serde(default)]
    pub components: Vec<String>,
    #[serde(default)]
    pub targets: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum PackageDep {
    Simple(String),
    Detailed(DetailedPackageDep),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetailedPackageDep {
    pub name: String,
    pub version: Option<String>,
    pub provider: Option<String>,
    #[serde(default)]
    pub optional: bool,
    #[serde(default)]
    pub platforms: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomPackageDep {
    pub name: String,
    pub source: PackageSource,
    pub version: Option<String>,
    #[serde(default)]
    pub binaries: Vec<String>,
    pub checksum: Option<ChecksumSpec>,
    #[serde(default)]
    pub post_install: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageSource {
    pub github: Option<String>,
    pub url: Option<String>,
    pub asset_pattern: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChecksumSpec {
    pub sha256: Option<String>,
    pub sha512: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PlatformOverride {
    #[serde(default)]
    pub environments: HashMap<String, EnvironmentSpec>,
    #[serde(default)]
    pub packages: Vec<PackageDep>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProfileConfig {
    #[serde(default)]
    pub packages: Vec<PackageDep>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HooksConfig {
    #[serde(default)]
    pub post_install: Vec<HookCommand>,
    #[serde(default)]
    pub pre_update: Vec<HookCommand>,
    #[serde(default)]
    pub post_update: Vec<HookCommand>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookCommand {
    pub run: String,
    #[serde(default)]
    pub platforms: Vec<String>,
}

impl Manifest {
    pub fn find_manifest(start_path: &Path) -> Option<PathBuf> {
        let mut current = start_path.to_path_buf();

        loop {
            let manifest_path = current.join(MANIFEST_FILENAME);
            if manifest_path.exists() {
                return Some(manifest_path);
            }

            if !current.pop() {
                break;
            }
        }

        None
    }

    pub async fn load(path: &Path) -> CogniaResult<Self> {
        let content = fs::read_file_string(path).await?;
        let manifest: Manifest = serde_yaml::from_str(&content)
            .map_err(|e| CogniaError::Parse(format!("Failed to parse manifest: {}", e)))?;
        Ok(manifest)
    }

    pub async fn load_from_dir(dir: &Path) -> CogniaResult<Option<Self>> {
        let manifest_path = dir.join(MANIFEST_FILENAME);

        if !fs::exists(&manifest_path).await {
            return Ok(None);
        }

        let manifest = Self::load(&manifest_path).await?;
        Ok(Some(manifest))
    }

    pub async fn save(&self, path: &Path) -> CogniaResult<()> {
        let content = serde_yaml::to_string(self)
            .map_err(|e| CogniaError::Config(format!("Failed to serialize manifest: {}", e)))?;
        fs::write_file_atomic(path, content.as_bytes()).await?;
        Ok(())
    }

    pub fn get_environment_version(&self, env_type: &str) -> Option<&str> {
        self.environments
            .get(env_type)
            .map(|spec| spec.version.as_str())
    }

    pub fn get_effective_packages(&self, platform: &str, profile: Option<&str>) -> Vec<PackageDep> {
        let mut packages = self.packages.clone();

        if let Some(platform_override) = self.platforms.get(platform) {
            packages.extend(platform_override.packages.clone());
        }

        if let Some(profile_name) = profile {
            if let Some(profile_config) = self.profiles.get(profile_name) {
                packages.extend(profile_config.packages.clone());
            }
        }

        packages
    }
}

impl PackageDep {
    pub fn name(&self) -> &str {
        match self {
            PackageDep::Simple(name) => name,
            PackageDep::Detailed(dep) => &dep.name,
        }
    }

    pub fn version(&self) -> Option<&str> {
        match self {
            PackageDep::Simple(_) => None,
            PackageDep::Detailed(dep) => dep.version.as_deref(),
        }
    }

    pub fn provider(&self) -> Option<&str> {
        match self {
            PackageDep::Simple(_) => None,
            PackageDep::Detailed(dep) => dep.provider.as_deref(),
        }
    }

    pub fn is_optional(&self) -> bool {
        match self {
            PackageDep::Simple(_) => false,
            PackageDep::Detailed(dep) => dep.optional,
        }
    }

    pub fn supports_platform(&self, platform: &str) -> bool {
        match self {
            PackageDep::Simple(_) => true,
            PackageDep::Detailed(dep) => {
                dep.platforms.is_empty() || dep.platforms.iter().any(|p| p == platform)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_manifest() {
        let yaml = r#"
project:
  name: test-project
  version: 1.0.0

environments:
  node:
    version: ">=18.0.0"
  python:
    version: "~3.11"

packages:
  - git
  - name: docker
    optional: true
"#;

        let manifest: Manifest = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(manifest.project.name, Some("test-project".to_string()));
        assert_eq!(manifest.environments.len(), 2);
        assert_eq!(manifest.packages.len(), 2);
    }

    #[test]
    fn test_package_dep_methods() {
        let simple = PackageDep::Simple("git".to_string());
        assert_eq!(simple.name(), "git");
        assert!(simple.version().is_none());
        assert!(!simple.is_optional());

        let detailed = PackageDep::Detailed(DetailedPackageDep {
            name: "docker".to_string(),
            version: Some(">=20.0".to_string()),
            provider: Some("brew".to_string()),
            optional: true,
            platforms: vec!["macos".to_string()],
        });
        assert_eq!(detailed.name(), "docker");
        assert_eq!(detailed.version(), Some(">=20.0"));
        assert!(detailed.is_optional());
        assert!(detailed.supports_platform("macos"));
        assert!(!detailed.supports_platform("windows"));
    }
}
