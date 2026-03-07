use crate::plugin::manifest::PluginManifest;
use semver::{Version, VersionReq};
use serde::{Deserialize, Serialize};

pub const TOOL_CONTRACT_VERSION: &str = "1.0.0";

/// Tool provider origin in unified toolbox contract.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ToolOrigin {
    BuiltIn,
    Plugin,
}

/// Compatibility diagnostics attached to tools/plugins in unified contract.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCompatibility {
    pub compatible: bool,
    pub reason: Option<String>,
    pub host_version: String,
    pub declared_contract_version: String,
    pub supported_contract_version: String,
    pub required_host_range: Option<String>,
    pub min_host_version: Option<String>,
}

/// Evaluate plugin compatibility against current host and supported tool contract.
pub fn evaluate_manifest_compatibility(manifest: &PluginManifest) -> ToolCompatibility {
    let host_version = env!("CARGO_PKG_VERSION").to_string();
    let declared_contract_version = manifest
        .plugin
        .tool_contract_version
        .clone()
        .unwrap_or_else(|| TOOL_CONTRACT_VERSION.to_string());
    let required_host_range = manifest.plugin.compatible_cognia_versions.clone();
    let min_host_version = manifest.plugin.min_cognia_version.clone();

    let mut reason: Option<String> = None;

    if declared_contract_version != TOOL_CONTRACT_VERSION {
        reason = Some(format!(
            "Unsupported tool contract version '{}' (supported '{}')",
            declared_contract_version, TOOL_CONTRACT_VERSION
        ));
    }

    if reason.is_none() {
        if let Some(min_required) = &min_host_version {
            match (
                Version::parse(&host_version),
                Version::parse(min_required.as_str()),
            ) {
                (Ok(host), Ok(minimum)) => {
                    if host < minimum {
                        reason = Some(format!(
                            "Host version '{}' is lower than required minimum '{}'",
                            host, minimum
                        ));
                    }
                }
                (_, Err(_)) => {
                    reason = Some(format!(
                        "Invalid min_cognia_version value '{}'",
                        min_required
                    ));
                }
                (Err(_), _) => {
                    reason = Some(format!("Invalid host version '{}'", host_version));
                }
            }
        }
    }

    if reason.is_none() {
        if let Some(range) = &required_host_range {
            match (VersionReq::parse(range), Version::parse(&host_version)) {
                (Ok(req), Ok(host)) => {
                    if !req.matches(&host) {
                        reason = Some(format!(
                            "Host version '{}' does not satisfy required range '{}'",
                            host, range
                        ));
                    }
                }
                (Err(_), _) => {
                    reason = Some(format!(
                        "Invalid compatible_cognia_versions range '{}'",
                        range
                    ));
                }
                (_, Err(_)) => {
                    reason = Some(format!("Invalid host version '{}'", host_version));
                }
            }
        }
    }

    ToolCompatibility {
        compatible: reason.is_none(),
        reason,
        host_version,
        declared_contract_version,
        supported_contract_version: TOOL_CONTRACT_VERSION.to_string(),
        required_host_range,
        min_host_version,
    }
}
