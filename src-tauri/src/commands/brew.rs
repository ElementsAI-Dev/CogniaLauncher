use crate::error::{CogniaError, CogniaResult};
use crate::platform::process::{self, ProcessOptions};
use serde::{Deserialize, Serialize};
use std::time::Duration;

// ── Helpers ──────────────────────────────────────────────────────────────────

async fn run_brew(args: &[&str]) -> CogniaResult<String> {
    let opts = ProcessOptions::new().with_timeout(Duration::from_secs(300));
    let out = process::execute("brew", args, Some(opts)).await?;
    if out.success {
        Ok(out.stdout)
    } else {
        let msg = if out.stderr.trim().is_empty() {
            out.stdout
        } else {
            out.stderr
        };
        Err(CogniaError::Provider(msg))
    }
}

// ── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrewTap {
    pub name: String,
    pub remote: String,
    pub formula_count: u32,
    pub cask_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrewService {
    pub name: String,
    pub status: String,
    pub user: Option<String>,
    pub file: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrewDoctorResult {
    pub healthy: bool,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrewCleanupResult {
    pub freed_bytes: u64,
    pub removed_items: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrewPinnedPackage {
    pub name: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrewConfigInfo {
    pub homebrew_version: String,
    pub origin: String,
    pub core_tap: String,
    pub homebrew_prefix: String,
    pub homebrew_cellar: String,
    pub homebrew_caskroom: String,
    pub entries: Vec<BrewConfigEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrewConfigEntry {
    pub key: String,
    pub value: String,
}

// ── Tap Management ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn brew_list_taps() -> CogniaResult<Vec<BrewTap>> {
    let out = run_brew(&["tap-info", "--installed", "--json"]).await?;
    if let Ok(arr) = serde_json::from_str::<Vec<serde_json::Value>>(&out) {
        return Ok(arr
            .iter()
            .filter_map(|t| {
                Some(BrewTap {
                    name: t["name"].as_str()?.to_string(),
                    remote: t["remote"].as_str().unwrap_or("").to_string(),
                    formula_count: t["formula_count"].as_u64().unwrap_or(0) as u32,
                    cask_count: t["cask_count"].as_u64().unwrap_or(0) as u32,
                })
            })
            .collect());
    }
    // Fallback: plain text
    let out = run_brew(&["tap"]).await?;
    Ok(out
        .lines()
        .filter(|l| !l.is_empty())
        .map(|l| BrewTap {
            name: l.trim().to_string(),
            remote: String::new(),
            formula_count: 0,
            cask_count: 0,
        })
        .collect())
}

#[tauri::command]
pub async fn brew_add_tap(name: String) -> CogniaResult<String> {
    run_brew(&["tap", &name]).await
}

#[tauri::command]
pub async fn brew_remove_tap(name: String) -> CogniaResult<String> {
    run_brew(&["untap", &name]).await
}

// ── Services Management ──────────────────────────────────────────────────────

fn parse_services_output(output: &str) -> Vec<BrewService> {
    output
        .lines()
        .skip(1) // skip header
        .filter(|l| !l.is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.is_empty() {
                return None;
            }
            Some(BrewService {
                name: parts[0].to_string(),
                status: parts.get(1).unwrap_or(&"unknown").to_string(),
                user: parts.get(2).map(|s| s.to_string()),
                file: parts.get(3).map(|s| s.to_string()),
            })
        })
        .collect()
}

#[tauri::command]
pub async fn brew_list_services() -> CogniaResult<Vec<BrewService>> {
    let out = run_brew(&["services", "list"]).await?;
    Ok(parse_services_output(&out))
}

#[tauri::command]
pub async fn brew_service_start(name: String) -> CogniaResult<String> {
    run_brew(&["services", "start", &name]).await
}

#[tauri::command]
pub async fn brew_service_stop(name: String) -> CogniaResult<String> {
    run_brew(&["services", "stop", &name]).await
}

#[tauri::command]
pub async fn brew_service_restart(name: String) -> CogniaResult<String> {
    run_brew(&["services", "restart", &name]).await
}

// ── Maintenance ──────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn brew_cleanup(dry_run: bool) -> CogniaResult<BrewCleanupResult> {
    let args = if dry_run {
        vec!["cleanup", "--dry-run"]
    } else {
        vec!["cleanup"]
    };
    let out = run_brew(&args).await.unwrap_or_default();

    let removed_items: Vec<String> = out
        .lines()
        .filter(|l| !l.is_empty() && !l.starts_with("==>"))
        .map(|l| l.trim().to_string())
        .collect();

    // Try to extract freed bytes from cleanup output
    let freed_bytes = out
        .lines()
        .find(|l| l.contains("freed"))
        .and_then(|l| {
            // e.g., "==> This operation has freed approximately 1.2GB of disk space."
            let num_part = l
                .split_whitespace()
                .find(|w| w.parse::<f64>().is_ok() || w.contains('.'))?;
            let value: f64 = num_part.parse().ok()?;
            if l.contains("GB") {
                Some((value * 1_073_741_824.0) as u64)
            } else if l.contains("MB") {
                Some((value * 1_048_576.0) as u64)
            } else if l.contains("KB") {
                Some((value * 1024.0) as u64)
            } else {
                Some(value as u64)
            }
        })
        .unwrap_or(0);

    Ok(BrewCleanupResult {
        freed_bytes,
        removed_items,
    })
}

#[tauri::command]
pub async fn brew_doctor() -> CogniaResult<BrewDoctorResult> {
    let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
    let out = process::execute("brew", &["doctor"], Some(opts)).await?;

    let warnings: Vec<String> = out
        .stdout
        .lines()
        .chain(out.stderr.lines())
        .filter(|l| !l.is_empty() && !l.starts_with("Your system is ready"))
        .map(|l| l.trim().to_string())
        .collect();

    let healthy = out.success && warnings.is_empty();

    Ok(BrewDoctorResult { healthy, warnings })
}

#[tauri::command]
pub async fn brew_autoremove() -> CogniaResult<Vec<String>> {
    let out = run_brew(&["autoremove"]).await?;
    Ok(out
        .lines()
        .filter(|l| !l.is_empty() && !l.starts_with("==>"))
        .map(|l| l.trim().to_string())
        .collect())
}

// ── Pin Management ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn brew_list_pinned() -> CogniaResult<Vec<BrewPinnedPackage>> {
    let out = run_brew(&["list", "--pinned", "--versions"]).await?;
    Ok(out
        .lines()
        .filter(|l| !l.is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                Some(BrewPinnedPackage {
                    name: parts[0].to_string(),
                    version: parts[1].to_string(),
                })
            } else if !parts.is_empty() {
                Some(BrewPinnedPackage {
                    name: parts[0].to_string(),
                    version: String::new(),
                })
            } else {
                None
            }
        })
        .collect())
}

#[tauri::command]
pub async fn brew_pin(name: String) -> CogniaResult<String> {
    run_brew(&["pin", &name]).await
}

#[tauri::command]
pub async fn brew_unpin(name: String) -> CogniaResult<String> {
    run_brew(&["unpin", &name]).await
}

// ── Config / Info ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn brew_get_config() -> CogniaResult<BrewConfigInfo> {
    let out = run_brew(&["config"]).await?;

    let mut entries = Vec::new();
    let mut homebrew_version = String::new();
    let mut origin = String::new();
    let mut core_tap = String::new();
    let mut homebrew_prefix = String::new();
    let mut homebrew_cellar = String::new();
    let mut homebrew_caskroom = String::new();

    for line in out.lines() {
        if let Some((key, value)) = line.split_once(':') {
            let key = key.trim();
            let value = value.trim().to_string();
            match key {
                "HOMEBREW_VERSION" => homebrew_version = value.clone(),
                "ORIGIN" => origin = value.clone(),
                "Core tap HEAD" | "Core tap JSON" => core_tap = value.clone(),
                "HOMEBREW_PREFIX" => homebrew_prefix = value.clone(),
                "HOMEBREW_CELLAR" => homebrew_cellar = value.clone(),
                "HOMEBREW_CASKROOM" => homebrew_caskroom = value.clone(),
                _ => {}
            }
            entries.push(BrewConfigEntry {
                key: key.to_string(),
                value,
            });
        }
    }

    Ok(BrewConfigInfo {
        homebrew_version,
        origin,
        core_tap,
        homebrew_prefix,
        homebrew_cellar,
        homebrew_caskroom,
        entries,
    })
}

// ── Analytics ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn brew_analytics_status() -> CogniaResult<bool> {
    let out = run_brew(&["analytics"]).await?;
    Ok(!out.to_lowercase().contains("disabled"))
}

#[tauri::command]
pub async fn brew_analytics_toggle(enabled: bool) -> CogniaResult<String> {
    let cmd = if enabled { "on" } else { "off" };
    run_brew(&["analytics", cmd]).await
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_services_output() {
        let output = "Name          Status  User     File\nnginx         started max      ~/Library/LaunchAgents/homebrew.mxcl.nginx.plist\npostgresql@14 stopped\nredis         started max      ~/Library/LaunchAgents/homebrew.mxcl.redis.plist\n";

        let services = parse_services_output(output);
        assert_eq!(services.len(), 3);
        assert_eq!(services[0].name, "nginx");
        assert_eq!(services[0].status, "started");
        assert_eq!(services[0].user, Some("max".into()));
        assert!(services[0].file.is_some());
        assert_eq!(services[1].name, "postgresql@14");
        assert_eq!(services[1].status, "stopped");
        assert_eq!(services[1].user, None);
    }

    #[test]
    fn test_parse_services_empty() {
        let output = "Name  Status  User  File\n";
        let services = parse_services_output(output);
        assert!(services.is_empty());
    }
}
