use crate::error::{CogniaError, CogniaResult};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Plugin manifest parsed from plugin.toml
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub plugin: PluginMeta,
    #[serde(default)]
    pub tools: Vec<ToolDeclaration>,
    #[serde(default)]
    pub permissions: PluginPermissions,
    /// i18n locale map: { "en": { "key": "value" }, "zh": { "key": "值" } }
    /// Plugins can provide their own translations in the manifest or in separate files.
    #[serde(default)]
    pub locales: std::collections::HashMap<String, std::collections::HashMap<String, String>>,
    /// Optional UI configuration for iframe-mode plugins
    #[serde(default)]
    pub ui: Option<UiConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginMeta {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub authors: Vec<String>,
    pub license: Option<String>,
    pub repository: Option<String>,
    pub homepage: Option<String>,
    #[serde(alias = "min_cognia_version")]
    pub min_cognia_version: Option<String>,
    pub icon: Option<PluginIcon>,
    /// URL to check for updates (returns JSON with latest version + download URL)
    #[serde(alias = "update_url")]
    pub update_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginIcon {
    pub path: String,
}

/// A tool declared by a plugin
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolDeclaration {
    pub id: String,
    #[serde(alias = "name_en")]
    pub name_en: String,
    #[serde(alias = "name_zh")]
    pub name_zh: Option<String>,
    #[serde(alias = "description_en")]
    pub description_en: String,
    #[serde(alias = "description_zh")]
    pub description_zh: Option<String>,
    #[serde(default = "default_category")]
    pub category: String,
    #[serde(default)]
    pub keywords: Vec<String>,
    #[serde(default = "default_icon")]
    pub icon: String,
    pub entry: String,
    /// UI rendering mode: text (default), declarative (JSON UI blocks), or iframe (custom HTML)
    #[serde(default, alias = "ui_mode")]
    pub ui_mode: UiMode,
}

fn default_category() -> String {
    "developer".to_string()
}

fn default_icon() -> String {
    "Wrench".to_string()
}

/// UI rendering mode for a plugin tool
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum UiMode {
    #[default]
    Text,
    Declarative,
    Iframe,
}

/// UI configuration for iframe-mode plugins
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiConfig {
    /// Entry HTML file relative to plugin directory (e.g. "ui/index.html")
    pub entry: String,
    /// Preferred width in pixels
    #[serde(default = "default_ui_width")]
    pub width: u32,
    /// Preferred height in pixels
    #[serde(default = "default_ui_height")]
    pub height: u32,
    /// Whether the view is resizable
    #[serde(default = "default_ui_resizable")]
    pub resizable: bool,
}

fn default_ui_width() -> u32 {
    800
}
fn default_ui_height() -> u32 {
    600
}
fn default_ui_resizable() -> bool {
    true
}

/// Permissions declared by a plugin (capability-based)
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct PluginPermissions {
    #[serde(alias = "fs_read")]
    pub fs_read: Vec<String>,
    #[serde(alias = "fs_write")]
    pub fs_write: Vec<String>,
    pub http: Vec<String>,
    #[serde(alias = "config_read")]
    pub config_read: bool,
    #[serde(alias = "config_write")]
    pub config_write: bool,
    #[serde(alias = "env_read")]
    pub env_read: bool,
    #[serde(alias = "pkg_search")]
    pub pkg_search: bool,
    #[serde(alias = "pkg_install")]
    pub pkg_install: bool,
    pub clipboard: bool,
    pub notification: bool,
    #[serde(alias = "process_exec")]
    pub process_exec: bool,
}

impl PluginManifest {
    /// Parse a plugin.toml file
    pub fn from_file(path: &Path) -> CogniaResult<Self> {
        let content = std::fs::read_to_string(path).map_err(|e| {
            CogniaError::Plugin(format!("Failed to read plugin manifest at {}: {}", path.display(), e))
        })?;
        Self::from_str(&content)
    }

    /// Parse from TOML string
    pub fn from_str(content: &str) -> CogniaResult<Self> {
        let manifest: Self = toml::from_str(content).map_err(|e| {
            CogniaError::Plugin(format!("Invalid plugin manifest: {}", e))
        })?;
        manifest.validate()?;
        Ok(manifest)
    }

    /// Validate manifest fields
    fn validate(&self) -> CogniaResult<()> {
        if self.plugin.id.is_empty() {
            return Err(CogniaError::Plugin("Plugin id is required".into()));
        }
        if self.plugin.name.is_empty() {
            return Err(CogniaError::Plugin("Plugin name is required".into()));
        }
        if self.plugin.version.is_empty() {
            return Err(CogniaError::Plugin("Plugin version is required".into()));
        }
        // Validate plugin id format (reverse domain notation)
        if !self.plugin.id.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-' || c == '_') {
            return Err(CogniaError::Plugin(format!(
                "Invalid plugin id '{}': must contain only alphanumeric, '.', '-', '_'",
                self.plugin.id
            )));
        }
        // Validate tools have unique ids
        let mut seen = std::collections::HashSet::new();
        let mut has_iframe_tool = false;
        for tool in &self.tools {
            if !seen.insert(&tool.id) {
                return Err(CogniaError::Plugin(format!(
                    "Duplicate tool id '{}' in plugin '{}'",
                    tool.id, self.plugin.id
                )));
            }
            if tool.entry.is_empty() {
                return Err(CogniaError::Plugin(format!(
                    "Tool '{}' in plugin '{}' has empty entry function",
                    tool.id, self.plugin.id
                )));
            }
            if tool.ui_mode == UiMode::Iframe {
                has_iframe_tool = true;
            }
        }
        // If any tool uses iframe mode, a [ui] section with entry is required
        if has_iframe_tool {
            match &self.ui {
                None => {
                    return Err(CogniaError::Plugin(format!(
                        "Plugin '{}' has iframe-mode tools but no [ui] section",
                        self.plugin.id
                    )));
                }
                Some(ui_config) if ui_config.entry.is_empty() => {
                    return Err(CogniaError::Plugin(format!(
                        "Plugin '{}' has iframe-mode tools but [ui] entry is empty",
                        self.plugin.id
                    )));
                }
                _ => {}
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_valid_manifest() {
        let toml = r#"
[plugin]
id = "com.example.json-tools"
name = "JSON Tools"
version = "1.0.0"
description = "Advanced JSON tools"
authors = ["Test Author"]

[[tools]]
id = "json-format"
name_en = "JSON Formatter"
description_en = "Format JSON"
category = "formatters"
keywords = ["json", "format"]
icon = "Braces"
entry = "format_json"

[permissions]
config_read = true
clipboard = true
"#;
        let manifest = PluginManifest::from_str(toml).unwrap();
        assert_eq!(manifest.plugin.id, "com.example.json-tools");
        assert_eq!(manifest.tools.len(), 1);
        assert_eq!(manifest.tools[0].entry, "format_json");
        assert!(manifest.permissions.config_read);
        assert!(manifest.permissions.clipboard);
        assert!(!manifest.permissions.pkg_install);
    }

    #[test]
    fn test_reject_empty_id() {
        let toml = r#"
[plugin]
id = ""
name = "Test"
version = "1.0.0"
"#;
        assert!(PluginManifest::from_str(toml).is_err());
    }

    #[test]
    fn test_parse_process_exec_permission() {
        let toml = r#"
[plugin]
id = "com.example.exec"
name = "Exec Plugin"
version = "1.0.0"

[permissions]
process_exec = true
pkg_install = true
"#;
        let manifest = PluginManifest::from_str(toml).unwrap();
        assert!(manifest.permissions.process_exec);
        assert!(manifest.permissions.pkg_install);
        assert!(!manifest.permissions.config_read);
    }

    #[test]
    fn test_parse_inline_locales() {
        let toml = r#"
[plugin]
id = "com.example.i18n"
name = "i18n Plugin"
version = "1.0.0"

[locales.en]
greeting = "Hello"

[locales.zh]
greeting = "你好"
"#;
        let manifest = PluginManifest::from_str(toml).unwrap();
        assert_eq!(manifest.locales.len(), 2);
        assert_eq!(manifest.locales["en"]["greeting"], "Hello");
        assert_eq!(manifest.locales["zh"]["greeting"], "你好");
    }

    #[test]
    fn test_default_permissions_all_false() {
        let toml = r#"
[plugin]
id = "com.example.minimal"
name = "Minimal"
version = "1.0.0"
"#;
        let manifest = PluginManifest::from_str(toml).unwrap();
        assert!(!manifest.permissions.config_read);
        assert!(!manifest.permissions.config_write);
        assert!(!manifest.permissions.env_read);
        assert!(!manifest.permissions.pkg_search);
        assert!(!manifest.permissions.pkg_install);
        assert!(!manifest.permissions.clipboard);
        assert!(!manifest.permissions.notification);
        assert!(!manifest.permissions.process_exec);
        assert!(manifest.permissions.fs_read.is_empty());
        assert!(manifest.permissions.fs_write.is_empty());
        assert!(manifest.permissions.http.is_empty());
    }

    #[test]
    fn test_reject_duplicate_tool_ids() {
        let toml = r#"
[plugin]
id = "test"
name = "Test"
version = "1.0.0"

[[tools]]
id = "tool1"
name_en = "Tool 1"
description_en = "Test"
entry = "func1"

[[tools]]
id = "tool1"
name_en = "Tool 1 Dupe"
description_en = "Test"
entry = "func2"
"#;
        assert!(PluginManifest::from_str(toml).is_err());
    }

    #[test]
    fn test_ui_mode_defaults_to_text() {
        let toml = r#"
[plugin]
id = "com.example.test"
name = "Test"
version = "1.0.0"

[[tools]]
id = "t1"
name_en = "Tool"
description_en = "Test"
entry = "fn1"
"#;
        let manifest = PluginManifest::from_str(toml).unwrap();
        assert_eq!(manifest.tools[0].ui_mode, UiMode::Text);
    }

    #[test]
    fn test_ui_mode_declarative() {
        let toml = r#"
[plugin]
id = "com.example.decl"
name = "Declarative"
version = "1.0.0"

[[tools]]
id = "dash"
name_en = "Dashboard"
description_en = "Rich UI"
entry = "render_dash"
ui_mode = "declarative"
"#;
        let manifest = PluginManifest::from_str(toml).unwrap();
        assert_eq!(manifest.tools[0].ui_mode, UiMode::Declarative);
    }

    #[test]
    fn test_ui_mode_iframe_requires_ui_section() {
        let toml = r#"
[plugin]
id = "com.example.iframe"
name = "Iframe"
version = "1.0.0"

[[tools]]
id = "view"
name_en = "View"
description_en = "Custom UI"
entry = "render_view"
ui_mode = "iframe"
"#;
        let result = PluginManifest::from_str(toml);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("no [ui] section"));
    }

    #[test]
    fn test_ui_mode_iframe_with_ui_section_ok() {
        let toml = r#"
[plugin]
id = "com.example.iframe"
name = "Iframe"
version = "1.0.0"

[[tools]]
id = "view"
name_en = "View"
description_en = "Custom UI"
entry = "render_view"
ui_mode = "iframe"

[ui]
entry = "ui/index.html"
"#;
        let manifest = PluginManifest::from_str(toml).unwrap();
        assert_eq!(manifest.tools[0].ui_mode, UiMode::Iframe);
        let ui = manifest.ui.unwrap();
        assert_eq!(ui.entry, "ui/index.html");
        assert_eq!(ui.width, 800);
        assert_eq!(ui.height, 600);
        assert!(ui.resizable);
    }

    #[test]
    fn test_ui_mode_iframe_empty_entry_rejected() {
        let toml = r#"
[plugin]
id = "com.example.iframe"
name = "Iframe"
version = "1.0.0"

[[tools]]
id = "view"
name_en = "View"
description_en = "Custom UI"
entry = "render_view"
ui_mode = "iframe"

[ui]
entry = ""
"#;
        let result = PluginManifest::from_str(toml);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("[ui] entry is empty"));
    }

    #[test]
    fn test_ui_config_custom_dimensions() {
        let toml = r#"
[plugin]
id = "com.example.iframe"
name = "Iframe"
version = "1.0.0"

[[tools]]
id = "view"
name_en = "View"
description_en = "Custom UI"
entry = "render_view"
ui_mode = "iframe"

[ui]
entry = "ui/index.html"
width = 1024
height = 768
resizable = false
"#;
        let manifest = PluginManifest::from_str(toml).unwrap();
        let ui = manifest.ui.unwrap();
        assert_eq!(ui.width, 1024);
        assert_eq!(ui.height, 768);
        assert!(!ui.resizable);
    }

    #[test]
    fn test_ui_section_without_iframe_tool_ok() {
        let toml = r#"
[plugin]
id = "com.example.mixed"
name = "Mixed"
version = "1.0.0"

[[tools]]
id = "text-tool"
name_en = "Text Tool"
description_en = "Normal"
entry = "text_fn"

[ui]
entry = "ui/index.html"
"#;
        let manifest = PluginManifest::from_str(toml).unwrap();
        assert_eq!(manifest.tools[0].ui_mode, UiMode::Text);
        assert!(manifest.ui.is_some());
    }

    #[test]
    fn test_mixed_ui_modes() {
        let toml = r#"
[plugin]
id = "com.example.mixed"
name = "Mixed"
version = "1.0.0"

[[tools]]
id = "text-tool"
name_en = "Text Tool"
description_en = "Normal text"
entry = "text_fn"

[[tools]]
id = "rich-tool"
name_en = "Rich Tool"
description_en = "Declarative UI"
entry = "rich_fn"
ui_mode = "declarative"

[[tools]]
id = "custom-tool"
name_en = "Custom Tool"
description_en = "Custom UI"
entry = "custom_fn"
ui_mode = "iframe"

[ui]
entry = "ui/index.html"
"#;
        let manifest = PluginManifest::from_str(toml).unwrap();
        assert_eq!(manifest.tools.len(), 3);
        assert_eq!(manifest.tools[0].ui_mode, UiMode::Text);
        assert_eq!(manifest.tools[1].ui_mode, UiMode::Declarative);
        assert_eq!(manifest.tools[2].ui_mode, UiMode::Iframe);
    }

    #[test]
    fn test_ui_mode_serialization() {
        assert_eq!(serde_json::to_string(&UiMode::Text).unwrap(), "\"text\"");
        assert_eq!(serde_json::to_string(&UiMode::Declarative).unwrap(), "\"declarative\"");
        assert_eq!(serde_json::to_string(&UiMode::Iframe).unwrap(), "\"iframe\"");
    }

    #[test]
    fn test_ui_mode_deserialization() {
        assert_eq!(serde_json::from_str::<UiMode>("\"text\"").unwrap(), UiMode::Text);
        assert_eq!(serde_json::from_str::<UiMode>("\"declarative\"").unwrap(), UiMode::Declarative);
        assert_eq!(serde_json::from_str::<UiMode>("\"iframe\"").unwrap(), UiMode::Iframe);
    }
}
