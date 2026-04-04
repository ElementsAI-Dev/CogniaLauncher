use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
