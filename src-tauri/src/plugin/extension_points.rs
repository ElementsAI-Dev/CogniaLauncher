use crate::error::{CogniaError, CogniaResult};
use crate::plugin::manifest::{
    is_supported_log_listen_filter, PluginManifest, UiMode,
};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

const EXTENSION_POINT_MATRIX_JSON: &str =
    include_str!("../../../plugins/extension-point-matrix.json");

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginPointSdkSupport {
    pub rust: bool,
    pub typescript: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginPointScaffoldSupport {
    pub builtin: bool,
    pub external: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginPointDefinition {
    pub id: String,
    pub kind: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub ui_mode: Option<String>,
    #[serde(default)]
    pub manifest_prerequisites: Vec<String>,
    pub sdk_support: PluginPointSdkSupport,
    pub scaffold_support: PluginPointScaffoldSupport,
    #[serde(default)]
    pub reference_examples: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginPointMatrix {
    pub schema_version: u32,
    pub generated_at: Option<String>,
    pub plugin_points: Vec<PluginPointDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginPointInventoryEntry {
    pub point_id: String,
    pub kind: String,
    pub source_type: String,
    pub source_id: Option<String>,
    pub entry: Option<String>,
    #[serde(default)]
    pub manifest_prerequisites: Vec<String>,
    #[serde(default)]
    pub capability_declarations: Vec<String>,
    pub discoverable: bool,
    pub blocking_reason: Option<String>,
}

static EXTENSION_POINT_MATRIX: Lazy<Result<PluginPointMatrix, String>> = Lazy::new(|| {
    let matrix: PluginPointMatrix = serde_json::from_str(EXTENSION_POINT_MATRIX_JSON)
        .map_err(|error| format!("Invalid plugins/extension-point-matrix.json: {}", error))?;
    validate_plugin_point_matrix(&matrix).map_err(|error| error.to_string())?;
    Ok(matrix)
});

pub fn load_plugin_point_matrix() -> CogniaResult<&'static PluginPointMatrix> {
    EXTENSION_POINT_MATRIX
        .as_ref()
        .map_err(|error| CogniaError::Plugin(error.clone()))
}

pub fn find_plugin_point_definition(point_id: &str) -> CogniaResult<Option<&'static PluginPointDefinition>> {
    Ok(load_plugin_point_matrix()?
        .plugin_points
        .iter()
        .find(|definition| definition.id == point_id))
}

pub fn derive_plugin_point_inventory(
    manifest: &PluginManifest,
) -> CogniaResult<Vec<PluginPointInventoryEntry>> {
    let matrix = load_plugin_point_matrix()?;
    let mut inventory = Vec::new();

    for tool in &manifest.tools {
        let point_id = match tool.ui_mode {
            UiMode::Text => "tool-text",
            UiMode::Declarative => "tool-declarative-ui",
            UiMode::Iframe => "tool-iframe-ui",
        };
        let definition = find_required_definition(matrix, point_id)?;
        let blocking_reason = validate_tool_plugin_point(manifest, tool);
        inventory.push(PluginPointInventoryEntry {
            point_id: definition.id.clone(),
            kind: definition.kind.clone(),
            source_type: "tool".to_string(),
            source_id: Some(tool.id.clone()),
            entry: Some(tool.entry.clone()),
            manifest_prerequisites: definition.manifest_prerequisites.clone(),
            capability_declarations: tool.capabilities.clone(),
            discoverable: blocking_reason.is_none(),
            blocking_reason,
        });
    }

    if !manifest.plugin.listen_events.is_empty() {
        let definition = find_required_definition(matrix, "event-listener")?;
        let blocking_reason = validate_listener_plugin_point(manifest);
        inventory.push(PluginPointInventoryEntry {
            point_id: definition.id.clone(),
            kind: definition.kind.clone(),
            source_type: "plugin".to_string(),
            source_id: Some(manifest.plugin.id.clone()),
            entry: Some("cognia_on_event".to_string()),
            manifest_prerequisites: definition.manifest_prerequisites.clone(),
            capability_declarations: Vec::new(),
            discoverable: blocking_reason.is_none(),
            blocking_reason,
        });
    }

    if !manifest.plugin.listen_logs.is_empty() {
        let definition = find_required_definition(matrix, "log-listener")?;
        let blocking_reason = validate_log_listener_plugin_point(manifest);
        inventory.push(PluginPointInventoryEntry {
            point_id: definition.id.clone(),
            kind: definition.kind.clone(),
            source_type: "plugin".to_string(),
            source_id: Some(manifest.plugin.id.clone()),
            entry: Some("cognia_on_log".to_string()),
            manifest_prerequisites: definition.manifest_prerequisites.clone(),
            capability_declarations: Vec::new(),
            discoverable: blocking_reason.is_none(),
            blocking_reason,
        });
    }

    if !manifest.settings.is_empty() {
        let definition = find_required_definition(matrix, "settings-schema")?;
        let blocking_reason = validate_settings_plugin_point(manifest);
        inventory.push(PluginPointInventoryEntry {
            point_id: definition.id.clone(),
            kind: definition.kind.clone(),
            source_type: "plugin".to_string(),
            source_id: Some(manifest.plugin.id.clone()),
            entry: None,
            manifest_prerequisites: definition.manifest_prerequisites.clone(),
            capability_declarations: Vec::new(),
            discoverable: blocking_reason.is_none(),
            blocking_reason,
        });
    }

    Ok(inventory)
}

pub fn validate_manifest_plugin_points(manifest: &PluginManifest) -> CogniaResult<()> {
    for entry in derive_plugin_point_inventory(manifest)? {
        if let Some(reason) = entry.blocking_reason {
            return Err(CogniaError::Plugin(format!(
                "Plugin point '{}' is not publishable: {}",
                entry.point_id, reason
            )));
        }
    }
    Ok(())
}

pub fn get_tool_plugin_point(
    manifest: &PluginManifest,
    tool_entry: &str,
) -> CogniaResult<Option<PluginPointInventoryEntry>> {
    Ok(derive_plugin_point_inventory(manifest)?
        .into_iter()
        .find(|entry| entry.source_type == "tool" && entry.entry.as_deref() == Some(tool_entry)))
}

fn find_required_definition<'a>(
    matrix: &'a PluginPointMatrix,
    point_id: &str,
) -> CogniaResult<&'a PluginPointDefinition> {
    matrix
        .plugin_points
        .iter()
        .find(|definition| definition.id == point_id)
        .ok_or_else(|| CogniaError::Plugin(format!("Unknown plugin point definition '{}'", point_id)))
}

fn validate_plugin_point_matrix(matrix: &PluginPointMatrix) -> CogniaResult<()> {
    if matrix.schema_version != 1 {
        return Err(CogniaError::Plugin(format!(
            "Unsupported plugin-point matrix schemaVersion: {}",
            matrix.schema_version
        )));
    }
    if matrix.plugin_points.is_empty() {
        return Err(CogniaError::Plugin(
            "Plugin-point matrix must contain pluginPoints[] entries".to_string(),
        ));
    }

    let mut seen = HashSet::new();
    for point in &matrix.plugin_points {
        if point.id.trim().is_empty() {
            return Err(CogniaError::Plugin(
                "Plugin-point matrix entries must declare non-empty id".to_string(),
            ));
        }
        if !seen.insert(point.id.clone()) {
            return Err(CogniaError::Plugin(format!(
                "Duplicate plugin-point matrix id '{}'",
                point.id
            )));
        }
        if point.kind.trim().is_empty() {
            return Err(CogniaError::Plugin(format!(
                "Plugin-point matrix entry '{}' has empty kind",
                point.id
            )));
        }
        if point.manifest_prerequisites.is_empty() {
            return Err(CogniaError::Plugin(format!(
                "Plugin-point matrix entry '{}' must declare manifestPrerequisites",
                point.id
            )));
        }
        if !point.sdk_support.rust && !point.sdk_support.typescript {
            return Err(CogniaError::Plugin(format!(
                "Plugin-point matrix entry '{}' must support at least one official SDK",
                point.id
            )));
        }
        if !point.scaffold_support.builtin && !point.scaffold_support.external {
            return Err(CogniaError::Plugin(format!(
                "Plugin-point matrix entry '{}' must support at least one scaffold mode",
                point.id
            )));
        }
    }
    Ok(())
}

fn validate_tool_plugin_point(
    manifest: &PluginManifest,
    tool: &crate::plugin::manifest::ToolDeclaration,
) -> Option<String> {
    if tool.id.trim().is_empty() {
        return Some("tool id must not be empty".to_string());
    }
    if tool.entry.trim().is_empty() {
        return Some(format!("tool '{}' has empty entry function", tool.id));
    }
    if tool.capabilities.iter().any(|cap| cap.trim().is_empty()) {
        return Some(format!("tool '{}' declares an empty capability", tool.id));
    }
    if tool.ui_mode == UiMode::Iframe {
        match &manifest.ui {
            None => {
                return Some(format!(
                    "tool '{}' uses iframe UI but plugin has no [ui] section",
                    tool.id
                ));
            }
            Some(ui) if ui.entry.trim().is_empty() => {
                return Some(format!(
                    "tool '{}' uses iframe UI but [ui].entry is empty",
                    tool.id
                ));
            }
            _ => {}
        }
    }
    None
}

fn validate_listener_plugin_point(manifest: &PluginManifest) -> Option<String> {
    let mut seen = HashSet::new();
    for event_name in &manifest.plugin.listen_events {
        let trimmed = event_name.trim();
        if trimmed.is_empty() {
            return Some("plugin.listen_events must not contain empty values".to_string());
        }
        if !seen.insert(trimmed.to_string()) {
            return Some(format!(
                "plugin.listen_events contains duplicate event '{}'",
                trimmed
            ));
        }
    }
    None
}

fn validate_log_listener_plugin_point(manifest: &PluginManifest) -> Option<String> {
    let mut seen = HashSet::new();
    for filter in &manifest.plugin.listen_logs {
        let trimmed = filter.trim();
        if trimmed.is_empty() {
            return Some("plugin.listen_logs must not contain empty values".to_string());
        }
        if !is_supported_log_listen_filter(trimmed) {
            return Some(format!(
                "plugin.listen_logs contains unsupported filter '{}'",
                trimmed
            ));
        }
        if !seen.insert(trimmed.to_string()) {
            return Some(format!(
                "plugin.listen_logs contains duplicate filter '{}'",
                trimmed
            ));
        }
    }
    None
}

fn validate_settings_plugin_point(manifest: &PluginManifest) -> Option<String> {
    let mut seen = HashSet::new();
    for setting in &manifest.settings {
        let setting_id = setting.id.trim();
        if setting_id.is_empty() {
            return Some("settings[].id must not be empty".to_string());
        }
        if !seen.insert(setting_id.to_string()) {
            return Some(format!("duplicate settings id '{}'", setting_id));
        }
        match setting.setting_type.as_str() {
            "string" | "number" | "boolean" | "select" => {}
            other => {
                return Some(format!(
                    "setting '{}' has unsupported type '{}'",
                    setting_id, other
                ));
            }
        }
        if setting.setting_type == "number" {
            if let (Some(min), Some(max)) = (setting.min, setting.max) {
                if min > max {
                    return Some(format!(
                        "setting '{}' has min greater than max",
                        setting_id
                    ));
                }
            }
        }
        if setting.setting_type == "select" {
            if setting.options.is_empty() {
                return Some(format!(
                    "setting '{}' must declare select options",
                    setting_id
                ));
            }
            let mut option_values = HashSet::new();
            for option in &setting.options {
                let value = option.value.trim();
                if value.is_empty() {
                    return Some(format!(
                        "setting '{}' contains empty select option value",
                        setting_id
                    ));
                }
                if !option_values.insert(value.to_string()) {
                    return Some(format!(
                        "setting '{}' contains duplicate option value '{}'",
                        setting_id, value
                    ));
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugin::manifest::PluginManifest;

    fn parse_manifest(raw: &str) -> PluginManifest {
        PluginManifest::from_str(raw).expect("valid manifest")
    }

    fn parse_manifest_unchecked(raw: &str) -> PluginManifest {
        toml::from_str(raw).expect("manifest parses without validation")
    }

    #[test]
    fn test_load_plugin_point_matrix() {
        let matrix = load_plugin_point_matrix().expect("matrix loads");
        assert_eq!(matrix.schema_version, 1);
        assert!(matrix.plugin_points.len() >= 6);
        assert!(matrix.plugin_points.iter().any(|point| point.id == "tool-iframe-ui"));
        assert!(matrix.plugin_points.iter().any(|point| point.id == "log-listener"));
    }

    #[test]
    fn test_derive_inventory_for_representative_manifest() {
        let manifest = parse_manifest(
            r#"
[plugin]
id = "com.example.inventory"
name = "Inventory"
version = "1.0.0"
description = "inventory"
authors = ["test"]
listen_events = ["package_installed"]
listen_logs = ["plugin"]

[[tools]]
id = "inspect"
name_en = "Inspect"
description_en = "Inspect"
entry = "inspect"
ui_mode = "declarative"
capabilities = ["environment.read"]

[[settings]]
id = "profile"
type = "select"
label_en = "Profile"
required = true
options = [{ value = "default", labelEn = "Default" }]
"#,
        );

        let inventory = derive_plugin_point_inventory(&manifest).expect("inventory derives");
        assert_eq!(inventory.len(), 4);
        assert!(inventory.iter().any(|entry| entry.point_id == "tool-declarative-ui" && entry.discoverable));
        assert!(inventory.iter().any(|entry| entry.point_id == "event-listener" && entry.discoverable));
        assert!(inventory.iter().any(|entry| entry.point_id == "log-listener" && entry.discoverable));
        assert!(inventory.iter().any(|entry| entry.point_id == "settings-schema" && entry.discoverable));
    }

    #[test]
    fn test_derive_inventory_blocks_invalid_listen_logs_filter() {
        let manifest = parse_manifest_unchecked(
            r#"
[plugin]
id = "com.example.logs"
name = "Logs"
version = "1.0.0"
description = "logs"
authors = ["test"]
listen_logs = ["launcher"]
"#,
        );

        let inventory = derive_plugin_point_inventory(&manifest).expect("inventory derives");
        let log_listener = inventory
            .iter()
            .find(|entry| entry.point_id == "log-listener")
            .expect("log listener inventory entry");
        assert!(!log_listener.discoverable);
        assert!(log_listener
            .blocking_reason
            .as_deref()
            .unwrap_or_default()
            .contains("plugin.listen_logs contains unsupported filter 'launcher'"));
    }

    #[test]
    fn test_derive_inventory_blocks_iframe_without_ui_section() {
        let manifest = parse_manifest_unchecked(
            r#"
[plugin]
id = "com.example.iframe"
name = "Iframe"
version = "1.0.0"
description = "iframe"
authors = ["test"]

[[tools]]
id = "inspect"
name_en = "Inspect"
description_en = "Inspect"
entry = "inspect"
ui_mode = "iframe"

[ui]
entry = ""
"#,
        );

        let inventory = derive_plugin_point_inventory(&manifest).expect("inventory derives");
        let iframe = inventory
            .iter()
            .find(|entry| entry.point_id == "tool-iframe-ui")
            .expect("iframe inventory entry");
        assert!(!iframe.discoverable);
        assert!(iframe
            .blocking_reason
            .as_deref()
            .unwrap_or_default()
            .contains("[ui].entry"));
    }
}
