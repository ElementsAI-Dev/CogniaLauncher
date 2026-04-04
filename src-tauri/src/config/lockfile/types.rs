use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const LOCKFILE_FILENAME: &str = "CogniaLauncher-lock.yaml";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Lockfile {
    pub lockfile_version: u32,
    pub generated_at: DateTime<Utc>,
    pub generated_by: String,
    #[serde(default)]
    pub environments: HashMap<String, LockedEnvironment>,
    #[serde(default)]
    pub packages: Vec<LockedPackage>,
    pub dependency_graph_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockedEnvironment {
    pub version: String,
    pub provider: String,
    pub resolved_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockedPackage {
    pub name: String,
    pub version: String,
    pub provider: String,
    pub checksum: Option<ChecksumInfo>,
    pub source: Option<LockedSource>,
    #[serde(default)]
    pub artifacts: HashMap<String, LockedArtifact>,
    pub resolved_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChecksumInfo {
    pub sha256: Option<String>,
    pub sha512: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockedSource {
    pub github: Option<String>,
    pub tag: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockedArtifact {
    pub url: String,
    pub checksum: ChecksumInfo,
}
