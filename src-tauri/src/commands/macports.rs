use crate::error::{CogniaError, CogniaResult};
use crate::platform::process::{self, ProcessOptions};
use serde::{Deserialize, Serialize};
use std::time::Duration;

// ── Helpers ──────────────────────────────────────────────────────────────────

async fn run_port(args: &[&str]) -> CogniaResult<String> {
    let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
    let out = process::execute("port", args, Some(opts)).await?;
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

async fn run_sudo_port(args: &[&str]) -> CogniaResult<String> {
    let opts = ProcessOptions::new().with_timeout(Duration::from_secs(300));
    let mut cmd_args = vec!["port"];
    cmd_args.extend_from_slice(args);
    let out = process::execute("sudo", &cmd_args, Some(opts)).await?;
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
pub struct PortVariant {
    pub name: String,
    pub description: String,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortDependent {
    pub name: String,
    pub dep_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortFileEntry {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortSelectGroup {
    pub group: String,
    pub options: Vec<String>,
    pub selected: Option<String>,
}

// ── Variant Management ───────────────────────────────────────────────────────

fn parse_variants(output: &str) -> Vec<PortVariant> {
    // `port variants <name>` output: "name has the variants:\n  variant1: description\n  +variant2: description (default)"
    let mut variants = Vec::new();
    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() || line.contains("has the variants") || line.contains("has no variants") {
            continue;
        }
        let is_default = line.starts_with('+');
        let line = line.trim_start_matches('+');

        if let Some((name, desc)) = line.split_once(':') {
            variants.push(PortVariant {
                name: name.trim().to_string(),
                description: desc.trim().to_string(),
                is_default,
            });
        } else if !line.is_empty() {
            variants.push(PortVariant {
                name: line.trim_end_matches(',').to_string(),
                description: String::new(),
                is_default,
            });
        }
    }
    variants
}

#[tauri::command]
pub async fn macports_list_variants(name: String) -> CogniaResult<Vec<PortVariant>> {
    let out = run_port(&["variants", &name]).await?;
    Ok(parse_variants(&out))
}

// ── Contents ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn macports_port_contents(name: String) -> CogniaResult<Vec<PortFileEntry>> {
    let out = run_port(&["contents", &name]).await?;
    Ok(out
        .lines()
        .skip(1) // skip "Port <name> contains:" header
        .filter(|l| !l.is_empty())
        .map(|l| PortFileEntry {
            path: l.trim().to_string(),
        })
        .collect())
}

// ── Dependents ───────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn macports_port_dependents(name: String) -> CogniaResult<Vec<PortDependent>> {
    let out = run_port(&["dependents", &name]).await?;
    Ok(out
        .lines()
        .filter(|l| !l.is_empty() && !l.contains("has no dependents"))
        .map(|l| PortDependent {
            name: l.trim().to_string(),
            dep_type: "runtime".to_string(),
        })
        .collect())
}

// ── Clean ────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn macports_port_clean(name: String) -> CogniaResult<String> {
    run_sudo_port(&["clean", "--all", &name]).await
}

#[tauri::command]
pub async fn macports_clean_all() -> CogniaResult<String> {
    run_sudo_port(&["clean", "--all", "all"]).await
}

// ── Self-update ──────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn macports_selfupdate() -> CogniaResult<String> {
    run_sudo_port(&["selfupdate"]).await
}

// ── Select (alternative versions) ────────────────────────────────────────────

#[tauri::command]
pub async fn macports_list_select_groups() -> CogniaResult<Vec<PortSelectGroup>> {
    let out = run_port(&["select", "--summary"]).await?;
    let mut groups = Vec::new();

    for line in out.lines().skip(1) {
        // skip header
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            let group = parts[0].to_string();
            let selected = if parts[1] == "none" {
                None
            } else {
                Some(parts[1].to_string())
            };
            groups.push(PortSelectGroup {
                group,
                options: Vec::new(), // populated on detail query
                selected,
            });
        }
    }

    Ok(groups)
}

#[tauri::command]
pub async fn macports_select_options(group: String) -> CogniaResult<PortSelectGroup> {
    let out = run_port(&["select", "--list", &group]).await?;
    let options: Vec<String> = out
        .lines()
        .skip(1) // skip header "Available versions for <group>:"
        .filter(|l| !l.is_empty())
        .map(|l| l.trim().to_string())
        .collect();

    // Get current selection
    let current = run_port(&["select", "--show", &group])
        .await
        .ok()
        .and_then(|o| {
            o.lines()
                .find(|l| l.contains("currently selected"))
                .and_then(|l| l.split_whitespace().last())
                .map(|s| s.trim_end_matches('.').to_string())
        })
        .filter(|s| s != "none");

    Ok(PortSelectGroup {
        group,
        options,
        selected: current,
    })
}

#[tauri::command]
pub async fn macports_select_set(group: String, option: String) -> CogniaResult<String> {
    run_sudo_port(&["select", "--set", &group, &option]).await
}

// ── Reclaim (disk space) ─────────────────────────────────────────────────────

#[tauri::command]
pub async fn macports_reclaim() -> CogniaResult<String> {
    // port reclaim removes inactive ports and cleans distfiles
    run_sudo_port(&["reclaim", "--enable-reminders"]).await
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_variants_with_default() {
        let output = "curl has the variants:\n  gss: Enable GSS authentication\n  +ssl: Enable SSL support\n  sftp_scp: Enable SFTP/SCP support\n";
        let variants = parse_variants(output);
        assert_eq!(variants.len(), 3);
        assert_eq!(variants[0].name, "gss");
        assert!(!variants[0].is_default);
        assert_eq!(variants[1].name, "ssl");
        assert!(variants[1].is_default);
        assert_eq!(variants[2].name, "sftp_scp");
    }

    #[test]
    fn test_parse_variants_no_variants() {
        let output = "curl has no variants\n";
        let variants = parse_variants(output);
        assert!(variants.is_empty());
    }

    #[test]
    fn test_parse_variants_empty() {
        let variants = parse_variants("");
        assert!(variants.is_empty());
    }
}
