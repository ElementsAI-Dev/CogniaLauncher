use crate::core::custom_detection::{
    create_preset_rules, CustomDetectionManager, CustomDetectionResult, CustomDetectionRule,
};
use crate::error::CogniaResult;
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

pub type SharedCustomDetectionManager = Arc<RwLock<CustomDetectionManager>>;

/// Create a shared custom detection manager
pub async fn create_shared_custom_detection_manager(
    config_dir: &std::path::Path,
) -> CogniaResult<SharedCustomDetectionManager> {
    let mut manager = CustomDetectionManager::new(config_dir);
    manager.load().await?;
    Ok(Arc::new(RwLock::new(manager)))
}

/// List all custom detection rules
#[tauri::command]
pub async fn custom_rule_list(
    manager: State<'_, SharedCustomDetectionManager>,
) -> Result<Vec<CustomDetectionRule>, String> {
    let manager = manager.read().await;
    Ok(manager.list_rules().to_vec())
}

/// Get a specific custom detection rule by ID
#[tauri::command]
pub async fn custom_rule_get(
    rule_id: String,
    manager: State<'_, SharedCustomDetectionManager>,
) -> Result<Option<CustomDetectionRule>, String> {
    let manager = manager.read().await;
    Ok(manager.get_rule(&rule_id).cloned())
}

/// Add a new custom detection rule
#[tauri::command]
pub async fn custom_rule_add(
    rule: CustomDetectionRule,
    manager: State<'_, SharedCustomDetectionManager>,
) -> Result<(), String> {
    let mut manager = manager.write().await;
    manager.add_rule(rule).map_err(|e| e.to_string())?;
    manager.save().await.map_err(|e| e.to_string())
}

/// Update an existing custom detection rule
#[tauri::command]
pub async fn custom_rule_update(
    rule: CustomDetectionRule,
    manager: State<'_, SharedCustomDetectionManager>,
) -> Result<(), String> {
    let mut manager = manager.write().await;
    manager.update_rule(rule).map_err(|e| e.to_string())?;
    manager.save().await.map_err(|e| e.to_string())
}

/// Delete a custom detection rule
#[tauri::command]
pub async fn custom_rule_delete(
    rule_id: String,
    manager: State<'_, SharedCustomDetectionManager>,
) -> Result<(), String> {
    let mut manager = manager.write().await;
    manager.delete_rule(&rule_id).map_err(|e| e.to_string())?;
    manager.save().await.map_err(|e| e.to_string())
}

/// Enable or disable a custom detection rule
#[tauri::command]
pub async fn custom_rule_toggle(
    rule_id: String,
    enabled: bool,
    manager: State<'_, SharedCustomDetectionManager>,
) -> Result<(), String> {
    let mut manager = manager.write().await;
    if let Some(rule) = manager.get_rule(&rule_id).cloned() {
        let mut updated_rule = rule;
        updated_rule.enabled = enabled;
        updated_rule.updated_at = Some(chrono::Utc::now().to_rfc3339());
        manager.update_rule(updated_rule).map_err(|e| e.to_string())?;
        manager.save().await.map_err(|e| e.to_string())
    } else {
        Err(format!("Rule '{}' not found", rule_id))
    }
}

/// Get preset rules (built-in templates)
#[tauri::command]
pub async fn custom_rule_presets() -> Result<Vec<CustomDetectionRule>, String> {
    Ok(create_preset_rules())
}

/// Import preset rules (add presets that don't already exist)
#[tauri::command]
pub async fn custom_rule_import_presets(
    preset_ids: Vec<String>,
    manager: State<'_, SharedCustomDetectionManager>,
) -> Result<Vec<String>, String> {
    let mut manager = manager.write().await;
    let presets = create_preset_rules();
    let mut imported = Vec::new();

    for preset in presets {
        if preset_ids.contains(&preset.id) {
            if manager.get_rule(&preset.id).is_none() {
                let mut rule = preset.clone();
                rule.enabled = true;
                rule.created_at = Some(chrono::Utc::now().to_rfc3339());
                if manager.add_rule(rule).is_ok() {
                    imported.push(preset.id);
                }
            }
        }
    }

    manager.save().await.map_err(|e| e.to_string())?;
    Ok(imported)
}

/// Detect version using custom rules for a specific environment
#[tauri::command]
pub async fn custom_rule_detect(
    env_type: String,
    start_path: String,
    manager: State<'_, SharedCustomDetectionManager>,
) -> Result<Option<CustomDetectionResult>, String> {
    let manager = manager.read().await;
    manager
        .detect(&env_type, std::path::Path::new(&start_path))
        .await
        .map_err(|e| e.to_string())
}

/// Detect all versions using custom rules
#[tauri::command]
pub async fn custom_rule_detect_all(
    start_path: String,
    manager: State<'_, SharedCustomDetectionManager>,
) -> Result<Vec<CustomDetectionResult>, String> {
    let manager = manager.read().await;
    manager
        .detect_all(std::path::Path::new(&start_path))
        .await
        .map_err(|e| e.to_string())
}

/// Test a rule against a specific file (for validation before saving)
#[tauri::command]
pub async fn custom_rule_test(
    rule: CustomDetectionRule,
    test_path: String,
) -> Result<TestRuleResult, String> {
    let manager = CustomDetectionManager::new(std::path::Path::new(""));
    
    // Create a temporary manager just for testing
    let start = std::time::Instant::now();
    
    match manager.detect(&rule.env_type, std::path::Path::new(&test_path)).await {
        Ok(Some(result)) => Ok(TestRuleResult {
            success: true,
            version: Some(result.version),
            source_file: Some(result.source_file.to_string_lossy().to_string()),
            raw_version: Some(result.raw_version),
            error: None,
            duration_ms: start.elapsed().as_millis() as u64,
        }),
        Ok(None) => Ok(TestRuleResult {
            success: false,
            version: None,
            source_file: None,
            raw_version: None,
            error: Some("No version detected with this rule".to_string()),
            duration_ms: start.elapsed().as_millis() as u64,
        }),
        Err(e) => Ok(TestRuleResult {
            success: false,
            version: None,
            source_file: None,
            raw_version: None,
            error: Some(e.to_string()),
            duration_ms: start.elapsed().as_millis() as u64,
        }),
    }
}

/// Validate a regex pattern
#[tauri::command]
pub async fn custom_rule_validate_regex(pattern: String) -> Result<RegexValidation, String> {
    match regex::Regex::new(&pattern) {
        Ok(_re) => {
            let has_version_group = pattern.contains("(?P<version>") || pattern.contains("(");
            Ok(RegexValidation {
                valid: true,
                error: None,
                has_capture_group: has_version_group,
                suggestion: if !has_version_group {
                    Some("Consider adding a capture group like (?P<version>...) to extract the version".to_string())
                } else {
                    None
                },
            })
        }
        Err(e) => Ok(RegexValidation {
            valid: false,
            error: Some(e.to_string()),
            has_capture_group: false,
            suggestion: None,
        }),
    }
}

/// Export rules to JSON
#[tauri::command]
pub async fn custom_rule_export(
    manager: State<'_, SharedCustomDetectionManager>,
) -> Result<String, String> {
    let manager = manager.read().await;
    serde_json::to_string_pretty(manager.list_rules()).map_err(|e| e.to_string())
}

/// Import rules from JSON
#[tauri::command]
pub async fn custom_rule_import(
    json: String,
    overwrite: bool,
    manager: State<'_, SharedCustomDetectionManager>,
) -> Result<ImportResult, String> {
    let rules: Vec<CustomDetectionRule> =
        serde_json::from_str(&json).map_err(|e| format!("Invalid JSON: {}", e))?;

    let mut manager = manager.write().await;
    let mut imported = 0;
    let mut skipped = 0;
    let mut updated = 0;

    for rule in rules {
        if manager.get_rule(&rule.id).is_some() {
            if overwrite {
                let mut updated_rule = rule;
                updated_rule.updated_at = Some(chrono::Utc::now().to_rfc3339());
                if manager.update_rule(updated_rule).is_ok() {
                    updated += 1;
                }
            } else {
                skipped += 1;
            }
        } else {
            let mut new_rule = rule;
            new_rule.created_at = Some(chrono::Utc::now().to_rfc3339());
            if manager.add_rule(new_rule).is_ok() {
                imported += 1;
            }
        }
    }

    manager.save().await.map_err(|e| e.to_string())?;

    Ok(ImportResult {
        imported,
        updated,
        skipped,
    })
}

/// Get rules by environment type
#[tauri::command]
pub async fn custom_rule_list_by_env(
    env_type: String,
    manager: State<'_, SharedCustomDetectionManager>,
) -> Result<Vec<CustomDetectionRule>, String> {
    let manager = manager.read().await;
    Ok(manager
        .get_rules_for_env(&env_type)
        .into_iter()
        .cloned()
        .collect())
}

/// Get supported extraction strategies
#[tauri::command]
pub async fn custom_rule_extraction_types() -> Result<Vec<ExtractionTypeInfo>, String> {
    Ok(vec![
        ExtractionTypeInfo {
            type_name: "regex".to_string(),
            display_name: "Regular Expression".to_string(),
            description: "Extract version using a regex pattern with capture groups".to_string(),
            example: r#"{"type": "regex", "pattern": "version[=:]\\s*[\"']?(?P<version>[\\d.]+)", "multiline": true}"#.to_string(),
        },
        ExtractionTypeInfo {
            type_name: "json_path".to_string(),
            display_name: "JSON Path".to_string(),
            description: "Extract value from JSON file using dot notation".to_string(),
            example: r#"{"type": "json_path", "path": "engines.node"}"#.to_string(),
        },
        ExtractionTypeInfo {
            type_name: "toml_path".to_string(),
            display_name: "TOML Path".to_string(),
            description: "Extract value from TOML file using dot notation".to_string(),
            example: r#"{"type": "toml_path", "path": "tool.python.version"}"#.to_string(),
        },
        ExtractionTypeInfo {
            type_name: "yaml_path".to_string(),
            display_name: "YAML Path".to_string(),
            description: "Extract value from YAML file using dot notation".to_string(),
            example: r#"{"type": "yaml_path", "path": "runtime.version"}"#.to_string(),
        },
        ExtractionTypeInfo {
            type_name: "xml_path".to_string(),
            display_name: "XML Tag Path".to_string(),
            description: "Extract value from XML file using tag path".to_string(),
            example: r#"{"type": "xml_path", "path": "project.properties.java.version"}"#.to_string(),
        },
        ExtractionTypeInfo {
            type_name: "plain_text".to_string(),
            display_name: "Plain Text".to_string(),
            description: "Read entire file as version, with optional prefix/suffix stripping".to_string(),
            example: r#"{"type": "plain_text", "strip_prefix": "python-"}"#.to_string(),
        },
        ExtractionTypeInfo {
            type_name: "tool_versions".to_string(),
            display_name: ".tool-versions Format".to_string(),
            description: "Extract from asdf-style .tool-versions file".to_string(),
            example: r#"{"type": "tool_versions", "tool_name": "nodejs"}"#.to_string(),
        },
        ExtractionTypeInfo {
            type_name: "ini_key".to_string(),
            display_name: "INI/Properties Key".to_string(),
            description: "Extract value from INI or properties file".to_string(),
            example: r#"{"type": "ini_key", "section": "metadata", "key": "version"}"#.to_string(),
        },
        ExtractionTypeInfo {
            type_name: "command".to_string(),
            display_name: "Command Output".to_string(),
            description: "Run a command and extract version from output".to_string(),
            example: r#"{"type": "command", "cmd": "node", "args": ["--version"], "output_pattern": "v(?P<version>[\\d.]+)"}"#.to_string(),
        },
    ])
}

// Response types

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TestRuleResult {
    pub success: bool,
    pub version: Option<String>,
    pub source_file: Option<String>,
    pub raw_version: Option<String>,
    pub error: Option<String>,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RegexValidation {
    pub valid: bool,
    pub error: Option<String>,
    pub has_capture_group: bool,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ImportResult {
    pub imported: usize,
    pub updated: usize,
    pub skipped: usize,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ExtractionTypeInfo {
    pub type_name: String,
    pub display_name: String,
    pub description: String,
    pub example: String,
}
