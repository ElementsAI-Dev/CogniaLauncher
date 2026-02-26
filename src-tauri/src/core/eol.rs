use crate::error::{CogniaError, CogniaResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

const EOL_API_BASE: &str = "https://endoflife.date/api";
const CACHE_TTL: Duration = Duration::from_secs(24 * 60 * 60); // 24 hours

/// Maps logical environment type to endoflife.date product name.
fn env_type_to_product(env_type: &str) -> Option<&'static str> {
    match env_type {
        "node" | "nodejs" => Some("nodejs"),
        "python" | "python3" => Some("python"),
        "go" | "golang" => Some("go"),
        "ruby" => Some("ruby"),
        "java" => Some("eclipse-temurin"),
        "php" => Some("php"),
        "dotnet" | ".net" => Some("dotnet"),
        // These languages don't have EOL tracking on endoflife.date
        "rust" | "kotlin" | "deno" | "bun" => None,
        _ => None,
    }
}

/// Raw JSON response from endoflife.date API v1.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EolApiCycle {
    #[serde(default)]
    cycle: String,
    #[serde(default)]
    release_date: Option<String>,
    #[serde(default)]
    eol: Option<serde_json::Value>, // Can be string date or boolean false
    #[serde(default)]
    latest: Option<String>,
    #[serde(default)]
    lts: Option<serde_json::Value>, // Can be string codename or boolean false
    #[serde(default)]
    support: Option<serde_json::Value>, // Can be string date or boolean false
}

/// Processed EOL cycle information.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EolCycleInfo {
    pub cycle: String,
    pub release_date: Option<String>,
    pub eol: Option<String>,
    pub latest: Option<String>,
    pub lts: Option<String>,
    pub support: Option<String>,
    pub is_eol: bool,
    pub eol_approaching: bool,
}

impl From<EolApiCycle> for EolCycleInfo {
    fn from(raw: EolApiCycle) -> Self {
        let eol_str = value_to_date_string(&raw.eol);
        let support_str = value_to_date_string(&raw.support);
        let lts_str = match &raw.lts {
            Some(serde_json::Value::String(s)) => Some(s.clone()),
            _ => None,
        };

        let is_eol = match &raw.eol {
            Some(serde_json::Value::Bool(true)) => true,
            Some(serde_json::Value::String(date)) => is_date_past(date),
            _ => false,
        };

        let eol_approaching = if is_eol {
            false
        } else {
            match &raw.eol {
                Some(serde_json::Value::String(date)) => is_within_months(date, 6),
                _ => false,
            }
        };

        Self {
            cycle: raw.cycle,
            release_date: raw.release_date,
            eol: eol_str,
            latest: raw.latest,
            lts: lts_str,
            support: support_str,
            is_eol,
            eol_approaching,
        }
    }
}

fn value_to_date_string(val: &Option<serde_json::Value>) -> Option<String> {
    match val {
        Some(serde_json::Value::String(s)) => Some(s.clone()),
        Some(serde_json::Value::Bool(false)) => None,
        _ => None,
    }
}

fn is_date_past(date_str: &str) -> bool {
    if let Ok(date) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        let today = chrono::Utc::now().date_naive();
        date < today
    } else {
        false
    }
}

fn is_within_months(date_str: &str, months: i64) -> bool {
    if let Ok(date) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        let today = chrono::Utc::now().date_naive();
        if date <= today {
            return false;
        }
        let diff = date.signed_duration_since(today);
        diff.num_days() <= months * 30
    } else {
        false
    }
}

/// In-memory cache for EOL data.
pub struct EolCache {
    data: Arc<RwLock<HashMap<String, (Vec<EolCycleInfo>, Instant)>>>,
}

impl EolCache {
    pub fn new() -> Self {
        Self {
            data: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Fetch EOL data for a product, using cache when available.
    pub async fn get_eol_data(&self, env_type: &str) -> CogniaResult<Vec<EolCycleInfo>> {
        let product = env_type_to_product(env_type).ok_or_else(|| {
            CogniaError::Provider(format!(
                "No EOL data available for environment type: {}",
                env_type
            ))
        })?;

        // Check cache first
        {
            let cache = self.data.read().await;
            if let Some((data, fetched_at)) = cache.get(product) {
                if fetched_at.elapsed() < CACHE_TTL {
                    return Ok(data.clone());
                }
            }
        }

        // Fetch from API
        let cycles = fetch_eol_from_api(product).await?;

        // Update cache
        {
            let mut cache = self.data.write().await;
            cache.insert(product.to_string(), (cycles.clone(), Instant::now()));
        }

        Ok(cycles)
    }

    /// Match a specific version to its EOL cycle.
    pub async fn get_version_eol(
        &self,
        env_type: &str,
        version: &str,
    ) -> CogniaResult<Option<EolCycleInfo>> {
        let cycles = self.get_eol_data(env_type).await?;
        Ok(match_version_to_cycle(version, &cycles))
    }
}

impl Default for EolCache {
    fn default() -> Self {
        Self::new()
    }
}

/// Fetch EOL data from the endoflife.date API.
async fn fetch_eol_from_api(product: &str) -> CogniaResult<Vec<EolCycleInfo>> {
    let url = format!("{}/{}.json", EOL_API_BASE, product);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| CogniaError::Provider(format!("Failed to create HTTP client: {}", e)))?;

    let response = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| {
            CogniaError::Provider(format!("Failed to fetch EOL data from {}: {}", url, e))
        })?;

    if !response.status().is_success() {
        return Err(CogniaError::Provider(format!(
            "EOL API returned status {} for {}",
            response.status(),
            product
        )));
    }

    let raw_cycles: Vec<EolApiCycle> = response
        .json()
        .await
        .map_err(|e| CogniaError::Provider(format!("Failed to parse EOL data: {}", e)))?;

    Ok(raw_cycles.into_iter().map(EolCycleInfo::from).collect())
}

/// Match a version string (e.g. "22.11.0") to the best matching cycle (e.g. cycle "22").
pub fn match_version_to_cycle(version: &str, cycles: &[EolCycleInfo]) -> Option<EolCycleInfo> {
    let version_clean = version.trim_start_matches('v');

    // Try exact cycle match first (e.g. version "3.12.1" matches cycle "3.12")
    let major_minor = {
        let parts: Vec<&str> = version_clean.split('.').collect();
        match parts.len() {
            0 => return None,
            1 => parts[0].to_string(),
            _ => format!("{}.{}", parts[0], parts[1]),
        }
    };

    // Try major.minor match
    if let Some(cycle) = cycles.iter().find(|c| c.cycle == major_minor) {
        return Some(cycle.clone());
    }

    // Try major-only match
    let major = version_clean.split('.').next().unwrap_or("");
    if let Some(cycle) = cycles.iter().find(|c| c.cycle == major) {
        return Some(cycle.clone());
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_env_type_to_product_mapping() {
        assert_eq!(env_type_to_product("node"), Some("nodejs"));
        assert_eq!(env_type_to_product("python"), Some("python"));
        assert_eq!(env_type_to_product("go"), Some("go"));
        assert_eq!(env_type_to_product("ruby"), Some("ruby"));
        assert_eq!(env_type_to_product("java"), Some("eclipse-temurin"));
        assert_eq!(env_type_to_product("php"), Some("php"));
        assert_eq!(env_type_to_product("dotnet"), Some("dotnet"));
        assert_eq!(env_type_to_product("rust"), None);
        assert_eq!(env_type_to_product("kotlin"), None);
        assert_eq!(env_type_to_product("deno"), None);
    }

    #[test]
    fn test_match_version_to_cycle() {
        let cycles = vec![
            EolCycleInfo {
                cycle: "22".into(),
                release_date: Some("2024-04-24".into()),
                eol: Some("2027-04-30".into()),
                latest: Some("22.22.0".into()),
                lts: Some("2024-10-29".into()),
                support: Some("2025-10-21".into()),
                is_eol: false,
                eol_approaching: false,
            },
            EolCycleInfo {
                cycle: "20".into(),
                release_date: Some("2023-04-18".into()),
                eol: Some("2026-04-30".into()),
                latest: Some("20.20.0".into()),
                lts: Some("2023-10-24".into()),
                support: Some("2024-10-22".into()),
                is_eol: false,
                eol_approaching: true,
            },
        ];

        let result = match_version_to_cycle("22.11.0", &cycles);
        assert!(result.is_some());
        assert_eq!(result.unwrap().cycle, "22");

        let result = match_version_to_cycle("v20.5.1", &cycles);
        assert!(result.is_some());
        assert_eq!(result.unwrap().cycle, "20");

        let result = match_version_to_cycle("18.0.0", &cycles);
        assert!(result.is_none());
    }

    #[test]
    fn test_is_date_past() {
        assert!(is_date_past("2020-01-01"));
        assert!(!is_date_past("2099-01-01"));
        assert!(!is_date_past("invalid"));
    }

    #[test]
    fn test_value_to_date_string() {
        assert_eq!(
            value_to_date_string(&Some(serde_json::Value::String("2027-04-30".into()))),
            Some("2027-04-30".into())
        );
        assert_eq!(
            value_to_date_string(&Some(serde_json::Value::Bool(false))),
            None
        );
        assert_eq!(value_to_date_string(&None), None);
    }

    #[test]
    fn test_eol_api_cycle_conversion_eol_past() {
        let raw = EolApiCycle {
            cycle: "16".into(),
            release_date: Some("2021-04-20".into()),
            eol: Some(serde_json::Value::String("2023-09-11".into())),
            latest: Some("16.20.2".into()),
            lts: Some(serde_json::Value::String("2021-10-26".into())),
            support: Some(serde_json::Value::String("2022-10-18".into())),
        };
        let info = EolCycleInfo::from(raw);
        assert_eq!(info.cycle, "16");
        assert!(info.is_eol);
        assert!(!info.eol_approaching);
        assert_eq!(info.lts, Some("2021-10-26".into()));
        assert_eq!(info.eol, Some("2023-09-11".into()));
    }

    #[test]
    fn test_eol_api_cycle_conversion_not_lts() {
        let raw = EolApiCycle {
            cycle: "23".into(),
            release_date: Some("2024-10-16".into()),
            eol: Some(serde_json::Value::String("2025-06-01".into())),
            latest: Some("23.11.1".into()),
            lts: Some(serde_json::Value::Bool(false)),
            support: Some(serde_json::Value::String("2025-04-01".into())),
        };
        let info = EolCycleInfo::from(raw);
        assert_eq!(info.cycle, "23");
        assert!(info.lts.is_none());
    }

    #[test]
    fn test_eol_api_cycle_conversion_eol_bool_true() {
        let raw = EolApiCycle {
            cycle: "0.10".into(),
            release_date: Some("2013-03-11".into()),
            eol: Some(serde_json::Value::Bool(true)),
            latest: Some("0.10.48".into()),
            lts: Some(serde_json::Value::Bool(false)),
            support: Some(serde_json::Value::Bool(false)),
        };
        let info = EolCycleInfo::from(raw);
        assert!(info.is_eol);
        assert!(info.eol.is_none());
        assert!(info.lts.is_none());
        assert!(info.support.is_none());
    }

    #[test]
    fn test_eol_api_cycle_conversion_future_eol() {
        let raw = EolApiCycle {
            cycle: "24".into(),
            release_date: Some("2025-05-06".into()),
            eol: Some(serde_json::Value::String("2028-04-30".into())),
            latest: Some("24.13.1".into()),
            lts: Some(serde_json::Value::String("2025-10-28".into())),
            support: Some(serde_json::Value::String("2026-10-20".into())),
        };
        let info = EolCycleInfo::from(raw);
        assert!(!info.is_eol);
        assert!(!info.eol_approaching);
        assert_eq!(info.lts, Some("2025-10-28".into()));
    }

    #[test]
    fn test_match_version_to_cycle_major_minor() {
        let cycles = vec![
            EolCycleInfo {
                cycle: "3.12".into(),
                release_date: Some("2023-10-02".into()),
                eol: Some("2028-10-01".into()),
                latest: Some("3.12.8".into()),
                lts: None,
                support: Some("2025-04-01".into()),
                is_eol: false,
                eol_approaching: false,
            },
            EolCycleInfo {
                cycle: "3.11".into(),
                release_date: Some("2022-10-24".into()),
                eol: Some("2027-10-01".into()),
                latest: Some("3.11.11".into()),
                lts: None,
                support: Some("2024-04-01".into()),
                is_eol: false,
                eol_approaching: false,
            },
        ];

        let result = match_version_to_cycle("3.12.5", &cycles);
        assert!(result.is_some());
        assert_eq!(result.unwrap().cycle, "3.12");

        let result = match_version_to_cycle("3.11.0", &cycles);
        assert!(result.is_some());
        assert_eq!(result.unwrap().cycle, "3.11");

        let result = match_version_to_cycle("3.10.0", &cycles);
        assert!(result.is_none());
    }

    #[test]
    fn test_eol_cycle_info_serde() {
        let info = EolCycleInfo {
            cycle: "22".into(),
            release_date: Some("2024-04-24".into()),
            eol: Some("2027-04-30".into()),
            latest: Some("22.22.0".into()),
            lts: Some("2024-10-29".into()),
            support: Some("2025-10-21".into()),
            is_eol: false,
            eol_approaching: false,
        };
        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"isEol\":false"));
        assert!(json.contains("\"eolApproaching\":false"));

        let deser: EolCycleInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(deser.cycle, "22");
        assert_eq!(deser.lts, Some("2024-10-29".into()));
    }

    #[test]
    fn test_env_type_to_product_aliases() {
        assert_eq!(env_type_to_product("nodejs"), Some("nodejs"));
        assert_eq!(env_type_to_product("python3"), Some("python"));
        assert_eq!(env_type_to_product("golang"), Some("go"));
        assert_eq!(env_type_to_product(".net"), Some("dotnet"));
        assert_eq!(env_type_to_product("bun"), None);
        assert_eq!(env_type_to_product("unknown"), None);
    }
}
