use crate::error::{CogniaError, CogniaResult};
use crate::plugin::manifest::PluginManifest;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// A plugin that has been discovered and registered
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedPlugin {
    pub manifest: PluginManifest,
    pub wasm_path: PathBuf,
    pub plugin_dir: PathBuf,
    pub enabled: bool,
    pub installed_at: DateTime<Utc>,
    pub source: PluginSource,
}

/// Where a plugin was installed from
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum PluginSource {
    Local { path: String },
    Url { url: String },
    Store { store_id: String },
    BuiltIn,
}

/// Serializable plugin info for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub authors: Vec<String>,
    pub tool_count: usize,
    pub enabled: bool,
    pub installed_at: String,
    pub source: PluginSource,
}

/// A tool from a plugin, with plugin context
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginToolInfo {
    pub plugin_id: String,
    pub plugin_name: String,
    pub tool_id: String,
    pub name_en: String,
    pub name_zh: Option<String>,
    pub description_en: String,
    pub description_zh: Option<String>,
    pub category: String,
    pub keywords: Vec<String>,
    pub icon: String,
    pub entry: String,
    pub ui_mode: String,
}

/// Registry that tracks all discovered and loaded plugins
pub struct PluginRegistry {
    plugins: HashMap<String, LoadedPlugin>,
    plugins_dir: PathBuf,
}

impl PluginRegistry {
    pub fn new(plugins_dir: PathBuf) -> Self {
        Self {
            plugins: HashMap::new(),
            plugins_dir,
        }
    }

    /// Discover all plugins in the plugins directory
    pub async fn discover(&mut self) -> CogniaResult<Vec<String>> {
        let mut discovered = Vec::new();

        if !self.plugins_dir.exists() {
            tokio::fs::create_dir_all(&self.plugins_dir)
                .await
                .map_err(|e| CogniaError::Plugin(format!("Failed to create plugins dir: {}", e)))?;
            return Ok(discovered);
        }

        let mut entries = tokio::fs::read_dir(&self.plugins_dir)
            .await
            .map_err(|e| CogniaError::Plugin(format!("Failed to read plugins dir: {}", e)))?;

        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let manifest_path = path.join("plugin.toml");
            if !manifest_path.exists() {
                continue;
            }

            match PluginManifest::from_file(&manifest_path) {
                Ok(mut manifest) => {
                    let wasm_path = path.join("plugin.wasm");
                    if !wasm_path.exists() {
                        log::warn!(
                            "Plugin '{}' has manifest but no plugin.wasm, skipping",
                            manifest.plugin.id
                        );
                        continue;
                    }

                    // Load locale files from plugin's locales/ directory
                    let locales_dir = path.join("locales");
                    if locales_dir.is_dir() {
                        if let Ok(mut locale_entries) = tokio::fs::read_dir(&locales_dir).await {
                            while let Ok(Some(locale_entry)) = locale_entries.next_entry().await {
                                let locale_path = locale_entry.path();
                                if locale_path.extension().map_or(false, |e| e == "json") {
                                    if let Some(locale_name) = locale_path.file_stem().and_then(|s| s.to_str()) {
                                        if let Ok(content) = tokio::fs::read_to_string(&locale_path).await {
                                            if let Ok(map) = serde_json::from_str::<std::collections::HashMap<String, String>>(&content) {
                                                manifest.locales.insert(locale_name.to_string(), map);
                                                log::debug!("Loaded locale '{}' for plugin '{}'", locale_name, manifest.plugin.id);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    let plugin_id = manifest.plugin.id.clone();
                    let loaded = LoadedPlugin {
                        manifest,
                        wasm_path,
                        plugin_dir: path.clone(),
                        enabled: true,
                        installed_at: Utc::now(),
                        source: PluginSource::Local {
                            path: path.display().to_string(),
                        },
                    };

                    self.plugins.insert(plugin_id.clone(), loaded);
                    discovered.push(plugin_id);
                }
                Err(e) => {
                    log::warn!(
                        "Failed to parse plugin manifest at {}: {}",
                        manifest_path.display(),
                        e
                    );
                }
            }
        }

        log::info!("Discovered {} plugins", discovered.len());
        Ok(discovered)
    }

    /// Register a plugin from a manifest and WASM file
    pub fn register(
        &mut self,
        manifest: PluginManifest,
        wasm_path: PathBuf,
        plugin_dir: PathBuf,
        source: PluginSource,
    ) {
        let id = manifest.plugin.id.clone();
        self.plugins.insert(
            id,
            LoadedPlugin {
                manifest,
                wasm_path,
                plugin_dir,
                enabled: true,
                installed_at: Utc::now(),
                source,
            },
        );
    }

    /// Unregister a plugin
    pub fn unregister(&mut self, plugin_id: &str) -> Option<LoadedPlugin> {
        self.plugins.remove(plugin_id)
    }

    /// Get a loaded plugin by ID
    pub fn get(&self, plugin_id: &str) -> Option<&LoadedPlugin> {
        self.plugins.get(plugin_id)
    }

    /// Get mutable reference to a loaded plugin
    pub fn get_mut(&mut self, plugin_id: &str) -> Option<&mut LoadedPlugin> {
        self.plugins.get_mut(plugin_id)
    }

    /// List all registered plugins
    pub fn list(&self) -> Vec<PluginInfo> {
        self.plugins
            .values()
            .map(|p| PluginInfo {
                id: p.manifest.plugin.id.clone(),
                name: p.manifest.plugin.name.clone(),
                version: p.manifest.plugin.version.clone(),
                description: p.manifest.plugin.description.clone(),
                authors: p.manifest.plugin.authors.clone(),
                tool_count: p.manifest.tools.len(),
                enabled: p.enabled,
                installed_at: p.installed_at.to_rfc3339(),
                source: p.source.clone(),
            })
            .collect()
    }

    /// List all tools from all enabled plugins
    pub fn list_all_tools(&self) -> Vec<PluginToolInfo> {
        let mut tools = Vec::new();
        for plugin in self.plugins.values() {
            if !plugin.enabled {
                continue;
            }
            for tool in &plugin.manifest.tools {
                tools.push(PluginToolInfo {
                    plugin_id: plugin.manifest.plugin.id.clone(),
                    plugin_name: plugin.manifest.plugin.name.clone(),
                    tool_id: tool.id.clone(),
                    name_en: tool.name_en.clone(),
                    name_zh: tool.name_zh.clone(),
                    description_en: tool.description_en.clone(),
                    description_zh: tool.description_zh.clone(),
                    category: tool.category.clone(),
                    keywords: tool.keywords.clone(),
                    icon: tool.icon.clone(),
                    entry: tool.entry.clone(),
                    ui_mode: format!("{:?}", tool.ui_mode).to_lowercase(),
                });
            }
        }
        tools
    }

    /// Get plugins directory path
    pub fn plugins_dir(&self) -> &Path {
        &self.plugins_dir
    }

    /// Check if a plugin exists
    pub fn contains(&self, plugin_id: &str) -> bool {
        self.plugins.contains_key(plugin_id)
    }

    /// Iterate over all registered plugins
    pub fn iter(&self) -> impl Iterator<Item = (&String, &LoadedPlugin)> {
        self.plugins.iter()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugin::manifest::{PluginManifest, PluginMeta, ToolDeclaration, PluginPermissions};

    fn make_manifest(id: &str, name: &str, tools: Vec<ToolDeclaration>) -> PluginManifest {
        PluginManifest {
            plugin: PluginMeta {
                id: id.to_string(),
                name: name.to_string(),
                version: "1.0.0".to_string(),
                description: "Test plugin".to_string(),
                authors: vec!["test".to_string()],
                license: None,
                repository: None,
                homepage: None,
                min_cognia_version: None,
                icon: None,
            },
            tools,
            permissions: PluginPermissions::default(),
            locales: std::collections::HashMap::new(),
            ui: None,
        }
    }

    fn make_tool(id: &str, entry: &str) -> ToolDeclaration {
        ToolDeclaration {
            id: id.to_string(),
            name_en: format!("Tool {}", id),
            name_zh: None,
            description_en: "A test tool".to_string(),
            description_zh: None,
            category: "developer".to_string(),
            keywords: vec![],
            icon: "Wrench".to_string(),
            entry: entry.to_string(),
            ui_mode: crate::plugin::manifest::UiMode::default(),
        }
    }

    #[test]
    fn test_new_registry_is_empty() {
        let reg = PluginRegistry::new(PathBuf::from("/tmp/plugins"));
        assert!(reg.list().is_empty());
        assert!(reg.list_all_tools().is_empty());
        assert!(!reg.contains("anything"));
    }

    #[test]
    fn test_register_and_get() {
        let mut reg = PluginRegistry::new(PathBuf::from("/tmp/plugins"));
        let manifest = make_manifest("p1", "Plugin One", vec![]);
        reg.register(
            manifest,
            PathBuf::from("/tmp/plugins/p1/plugin.wasm"),
            PathBuf::from("/tmp/plugins/p1"),
            PluginSource::BuiltIn,
        );

        assert!(reg.contains("p1"));
        let loaded = reg.get("p1").unwrap();
        assert_eq!(loaded.manifest.plugin.name, "Plugin One");
        assert!(loaded.enabled);
    }

    #[test]
    fn test_unregister() {
        let mut reg = PluginRegistry::new(PathBuf::from("/tmp/plugins"));
        reg.register(
            make_manifest("p1", "P1", vec![]),
            PathBuf::from("p1.wasm"),
            PathBuf::from("p1"),
            PluginSource::BuiltIn,
        );
        assert!(reg.contains("p1"));

        let removed = reg.unregister("p1");
        assert!(removed.is_some());
        assert!(!reg.contains("p1"));

        // Double unregister returns None
        assert!(reg.unregister("p1").is_none());
    }

    #[test]
    fn test_list_plugins() {
        let mut reg = PluginRegistry::new(PathBuf::from("/tmp/plugins"));
        reg.register(
            make_manifest("p1", "Plugin One", vec![make_tool("t1", "fn1")]),
            PathBuf::from("p1.wasm"),
            PathBuf::from("p1"),
            PluginSource::BuiltIn,
        );
        reg.register(
            make_manifest("p2", "Plugin Two", vec![]),
            PathBuf::from("p2.wasm"),
            PathBuf::from("p2"),
            PluginSource::Local { path: "/src".into() },
        );

        let list = reg.list();
        assert_eq!(list.len(), 2);

        let p1 = list.iter().find(|p| p.id == "p1").unwrap();
        assert_eq!(p1.name, "Plugin One");
        assert_eq!(p1.tool_count, 1);
        assert!(p1.enabled);
    }

    #[test]
    fn test_list_all_tools() {
        let mut reg = PluginRegistry::new(PathBuf::from("/tmp/plugins"));
        reg.register(
            make_manifest("p1", "P1", vec![
                make_tool("t1", "fn1"),
                make_tool("t2", "fn2"),
            ]),
            PathBuf::from("p1.wasm"),
            PathBuf::from("p1"),
            PluginSource::BuiltIn,
        );
        reg.register(
            make_manifest("p2", "P2", vec![make_tool("t3", "fn3")]),
            PathBuf::from("p2.wasm"),
            PathBuf::from("p2"),
            PluginSource::BuiltIn,
        );

        let tools = reg.list_all_tools();
        assert_eq!(tools.len(), 3);
        assert!(tools.iter().any(|t| t.tool_id == "t1" && t.plugin_id == "p1"));
        assert!(tools.iter().any(|t| t.tool_id == "t3" && t.plugin_id == "p2"));
    }

    #[test]
    fn test_disabled_plugin_tools_excluded() {
        let mut reg = PluginRegistry::new(PathBuf::from("/tmp/plugins"));
        reg.register(
            make_manifest("p1", "P1", vec![make_tool("t1", "fn1")]),
            PathBuf::from("p1.wasm"),
            PathBuf::from("p1"),
            PluginSource::BuiltIn,
        );
        // Disable plugin
        reg.get_mut("p1").unwrap().enabled = false;

        let tools = reg.list_all_tools();
        assert!(tools.is_empty());
    }

    #[test]
    fn test_get_mut_and_modify() {
        let mut reg = PluginRegistry::new(PathBuf::from("/tmp/plugins"));
        reg.register(
            make_manifest("p1", "P1", vec![]),
            PathBuf::from("p1.wasm"),
            PathBuf::from("p1"),
            PluginSource::BuiltIn,
        );

        let p = reg.get_mut("p1").unwrap();
        p.enabled = false;
        assert!(!reg.get("p1").unwrap().enabled);
    }

    #[test]
    fn test_plugins_dir() {
        let reg = PluginRegistry::new(PathBuf::from("/custom/path"));
        assert_eq!(reg.plugins_dir(), Path::new("/custom/path"));
    }

    #[test]
    fn test_iter() {
        let mut reg = PluginRegistry::new(PathBuf::from("/tmp/plugins"));
        reg.register(
            make_manifest("p1", "P1", vec![make_tool("t1", "fn1")]),
            PathBuf::from("p1.wasm"),
            PathBuf::from("p1"),
            PluginSource::BuiltIn,
        );
        reg.register(
            make_manifest("p2", "P2", vec![]),
            PathBuf::from("p2.wasm"),
            PathBuf::from("p2"),
            PluginSource::BuiltIn,
        );

        let ids: Vec<&String> = reg.iter().map(|(id, _)| id).collect();
        assert_eq!(ids.len(), 2);
        assert!(ids.contains(&&"p1".to_string()));
        assert!(ids.contains(&&"p2".to_string()));
    }

    #[test]
    fn test_get_nonexistent_returns_none() {
        let mut reg = PluginRegistry::new(PathBuf::from("/tmp"));
        assert!(reg.get("no-such-plugin").is_none());
        assert!(reg.get_mut("no-such-plugin").is_none());
    }

    #[test]
    fn test_tool_ui_mode_default_is_text() {
        let mut reg = PluginRegistry::new(PathBuf::from("/tmp/plugins"));
        reg.register(
            make_manifest("p1", "P1", vec![make_tool("t1", "fn1")]),
            PathBuf::from("p1.wasm"),
            PathBuf::from("p1"),
            PluginSource::BuiltIn,
        );
        let tools = reg.list_all_tools();
        assert_eq!(tools[0].ui_mode, "text");
    }

    #[test]
    fn test_tool_ui_mode_declarative() {
        let mut reg = PluginRegistry::new(PathBuf::from("/tmp/plugins"));
        let mut tool = make_tool("t1", "fn1");
        tool.ui_mode = crate::plugin::manifest::UiMode::Declarative;
        reg.register(
            make_manifest("p1", "P1", vec![tool]),
            PathBuf::from("p1.wasm"),
            PathBuf::from("p1"),
            PluginSource::BuiltIn,
        );
        let tools = reg.list_all_tools();
        assert_eq!(tools[0].ui_mode, "declarative");
    }

    #[test]
    fn test_tool_ui_mode_iframe() {
        let mut reg = PluginRegistry::new(PathBuf::from("/tmp/plugins"));
        let mut tool = make_tool("t1", "fn1");
        tool.ui_mode = crate::plugin::manifest::UiMode::Iframe;
        reg.register(
            make_manifest("p1", "P1", vec![tool]),
            PathBuf::from("p1.wasm"),
            PathBuf::from("p1"),
            PluginSource::BuiltIn,
        );
        let tools = reg.list_all_tools();
        assert_eq!(tools[0].ui_mode, "iframe");
    }

    #[test]
    fn test_mixed_ui_mode_tools() {
        let mut reg = PluginRegistry::new(PathBuf::from("/tmp/plugins"));
        let text_tool = make_tool("t1", "fn1");
        let mut decl_tool = make_tool("t2", "fn2");
        decl_tool.ui_mode = crate::plugin::manifest::UiMode::Declarative;
        let mut iframe_tool = make_tool("t3", "fn3");
        iframe_tool.ui_mode = crate::plugin::manifest::UiMode::Iframe;
        reg.register(
            make_manifest("p1", "P1", vec![text_tool, decl_tool, iframe_tool]),
            PathBuf::from("p1.wasm"),
            PathBuf::from("p1"),
            PluginSource::BuiltIn,
        );
        let tools = reg.list_all_tools();
        assert_eq!(tools.len(), 3);
        let modes: Vec<&str> = tools.iter().map(|t| t.ui_mode.as_str()).collect();
        assert!(modes.contains(&"text"));
        assert!(modes.contains(&"declarative"));
        assert!(modes.contains(&"iframe"));
    }
}
