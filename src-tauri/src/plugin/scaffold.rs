use crate::error::{CogniaError, CogniaResult};
use crate::plugin::contract::TOOL_CONTRACT_VERSION;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Configuration for scaffolding a new plugin project
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScaffoldConfig {
    pub name: String,
    pub id: String,
    pub description: String,
    pub author: String,
    pub output_dir: String,
    #[serde(default)]
    pub license: Option<String>,
    #[serde(default)]
    pub repository: Option<String>,
    #[serde(default)]
    pub homepage: Option<String>,
    #[serde(default = "default_lifecycle_profile")]
    pub lifecycle_profile: ScaffoldLifecycleProfile,
    #[serde(default = "default_language")]
    pub language: PluginLanguage,
    #[serde(default)]
    pub permissions: ScaffoldPermissions,
    #[serde(default)]
    pub include_ci: bool,
    #[serde(default = "default_include_vscode")]
    pub include_vscode: bool,
    #[serde(default)]
    pub additional_keywords: Vec<String>,
    #[serde(default)]
    pub template_options: ScaffoldTemplateOptions,
}

fn default_language() -> PluginLanguage {
    PluginLanguage::Rust
}

fn default_include_vscode() -> bool {
    true
}

fn default_include_unified_contract_samples() -> bool {
    true
}

fn default_include_validation_guidance() -> bool {
    true
}

fn default_lifecycle_profile() -> ScaffoldLifecycleProfile {
    ScaffoldLifecycleProfile::External
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ScaffoldLifecycleProfile {
    External,
    BuiltIn,
}

impl Default for ScaffoldLifecycleProfile {
    fn default() -> Self {
        Self::External
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ScaffoldContractTemplate {
    Minimal,
    Advanced,
}

impl Default for ScaffoldContractTemplate {
    fn default() -> Self {
        Self::Minimal
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ScaffoldSchemaPreset {
    BasicForm,
    MultiStepFlow,
    RepeatableCollection,
}

impl Default for ScaffoldSchemaPreset {
    fn default() -> Self {
        Self::BasicForm
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScaffoldTemplateOptions {
    #[serde(default = "default_include_unified_contract_samples")]
    pub include_unified_contract_samples: bool,
    #[serde(default)]
    pub contract_template: ScaffoldContractTemplate,
    #[serde(default)]
    pub schema_preset: ScaffoldSchemaPreset,
    #[serde(default = "default_include_validation_guidance")]
    pub include_validation_guidance: bool,
    #[serde(default)]
    pub include_starter_tests: bool,
}

impl Default for ScaffoldTemplateOptions {
    fn default() -> Self {
        Self {
            include_unified_contract_samples: default_include_unified_contract_samples(),
            contract_template: ScaffoldContractTemplate::default(),
            schema_preset: ScaffoldSchemaPreset::default(),
            include_validation_guidance: default_include_validation_guidance(),
            include_starter_tests: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ScaffoldPermissions {
    #[serde(default)]
    pub config_read: bool,
    #[serde(default)]
    pub env_read: bool,
    #[serde(default)]
    pub pkg_search: bool,
    #[serde(default)]
    pub clipboard: bool,
    #[serde(default)]
    pub notification: bool,
    #[serde(default)]
    pub http: Vec<String>,
    #[serde(default)]
    pub fs_read: bool,
    #[serde(default)]
    pub fs_write: bool,
    #[serde(default)]
    pub process_exec: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PluginLanguage {
    Rust,
    JavaScript,
    TypeScript,
}

impl Default for PluginLanguage {
    fn default() -> Self {
        Self::Rust
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScaffoldHandoff {
    pub profile: ScaffoldLifecycleProfile,
    pub artifact_path: String,
    pub build_commands: Vec<String>,
    pub next_steps: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub import_path: Option<String>,
    pub import_requires_build: bool,
    pub lifecycle_manifest_path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub builtin_catalog_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub builtin_checksum_command: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub builtin_validation_command: Option<String>,
}

/// Result of scaffold operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScaffoldResult {
    pub plugin_dir: String,
    pub files_created: Vec<String>,
    pub lifecycle_profile: ScaffoldLifecycleProfile,
    pub handoff: ScaffoldHandoff,
}

/// Result of plugin validation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    pub valid: bool,
    #[serde(default)]
    pub can_import: bool,
    #[serde(default)]
    pub build_required: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub missing_artifact_path: Option<String>,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

/// Generate a new plugin project from a ScaffoldConfig
pub async fn scaffold_plugin(config: &ScaffoldConfig) -> CogniaResult<ScaffoldResult> {
    validate_scaffold_config(config)?;

    let output = PathBuf::from(config.output_dir.trim());
    let plugin_dir = resolve_scaffold_plugin_dir(config, &output);

    if plugin_dir.exists() {
        return Err(CogniaError::Plugin(format!(
            "Directory already exists: {}",
            plugin_dir.display()
        )));
    }

    tokio::fs::create_dir_all(&plugin_dir)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to create plugin directory: {}", e)))?;

    let mut files_created = Vec::new();

    // Generate plugin.toml
    let manifest = generate_manifest(config);
    let manifest_path = plugin_dir.join("plugin.toml");
    tokio::fs::write(&manifest_path, &manifest)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write plugin.toml: {}", e)))?;
    files_created.push("plugin.toml".to_string());

    // Generate locale files
    let locales_dir = plugin_dir.join("locales");
    tokio::fs::create_dir_all(&locales_dir)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to create locales dir: {}", e)))?;

    let en_json = serde_json::json!({
        "toolName": format!("{} Tool", config.name),
        "toolDesc": format!("A tool provided by {}", config.name),
        "greeting": "Hello from {name}!",
    });
    tokio::fs::write(
        locales_dir.join("en.json"),
        serde_json::to_string_pretty(&en_json).unwrap(),
    )
    .await
    .map_err(|e| CogniaError::Plugin(format!("Failed to write en.json: {}", e)))?;
    files_created.push("locales/en.json".to_string());

    let zh_json = serde_json::json!({
        "toolName": format!("{} 工具", config.name),
        "toolDesc": format!("由 {} 提供的工具", config.name),
        "greeting": "你好，来自 {name}！",
    });
    tokio::fs::write(
        locales_dir.join("zh.json"),
        serde_json::to_string_pretty(&zh_json).unwrap(),
    )
    .await
    .map_err(|e| CogniaError::Plugin(format!("Failed to write zh.json: {}", e)))?;
    files_created.push("locales/zh.json".to_string());

    // Generate .gitignore
    let gitignore = "target/\nnode_modules/\ndist/\n.tools/\n*.wasm\n";
    tokio::fs::write(plugin_dir.join(".gitignore"), gitignore)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write .gitignore: {}", e)))?;
    files_created.push(".gitignore".to_string());

    // Generate CHANGELOG.md for immediate contributor onboarding
    let changelog = "# Changelog\n\n## 0.1.0\n- Initial scaffold generated by CogniaLauncher.\n";
    tokio::fs::write(plugin_dir.join("CHANGELOG.md"), changelog)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write CHANGELOG.md: {}", e)))?;
    files_created.push("CHANGELOG.md".to_string());

    // Optionally generate VSCode workspace defaults
    if config.include_vscode {
        let vscode_dir = plugin_dir.join(".vscode");
        tokio::fs::create_dir_all(&vscode_dir)
            .await
            .map_err(|e| CogniaError::Plugin(format!("Failed to create .vscode dir: {}", e)))?;

        let settings = generate_vscode_settings();
        tokio::fs::write(vscode_dir.join("settings.json"), settings)
            .await
            .map_err(|e| {
                CogniaError::Plugin(format!("Failed to write .vscode/settings.json: {}", e))
            })?;
        files_created.push(".vscode/settings.json".to_string());

        let extensions = generate_vscode_extensions(config);
        tokio::fs::write(vscode_dir.join("extensions.json"), extensions)
            .await
            .map_err(|e| {
                CogniaError::Plugin(format!("Failed to write .vscode/extensions.json: {}", e))
            })?;
        files_created.push(".vscode/extensions.json".to_string());
    }

    // Optionally generate CI workflow skeleton
    if config.include_ci {
        let ci_dir = plugin_dir.join(".github").join("workflows");
        tokio::fs::create_dir_all(&ci_dir).await.map_err(|e| {
            CogniaError::Plugin(format!("Failed to create .github/workflows dir: {}", e))
        })?;

        let ci = generate_ci_workflow(config);
        tokio::fs::write(ci_dir.join("ci.yml"), ci)
            .await
            .map_err(|e| {
                CogniaError::Plugin(format!("Failed to write .github/workflows/ci.yml: {}", e))
            })?;
        files_created.push(".github/workflows/ci.yml".to_string());
    }

    // Generate language-specific and template-option files.
    files_created.extend(generate_language_project_files(config, &plugin_dir).await?);
    files_created.extend(generate_template_option_files(config, &plugin_dir).await?);

    let mut handoff = build_scaffold_handoff(config, &plugin_dir);
    let lifecycle_manifest = generate_lifecycle_manifest(config, &handoff);
    tokio::fs::write(plugin_dir.join("cognia.scaffold.json"), lifecycle_manifest)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write cognia.scaffold.json: {}", e)))?;
    files_created.push("cognia.scaffold.json".to_string());

    if matches!(config.lifecycle_profile, ScaffoldLifecycleProfile::BuiltIn) {
        let catalog_sample = generate_builtin_catalog_entry_sample(config, &plugin_dir);
        tokio::fs::write(
            plugin_dir.join("catalog-entry.sample.json"),
            serde_json::to_string_pretty(&catalog_sample).unwrap(),
        )
        .await
        .map_err(|e| {
            CogniaError::Plugin(format!("Failed to write catalog-entry.sample.json: {}", e))
        })?;
        files_created.push("catalog-entry.sample.json".to_string());
    }

    // Generate README.md
    handoff.lifecycle_manifest_path = plugin_dir
        .join("cognia.scaffold.json")
        .display()
        .to_string();
    let readme = generate_readme(config, &handoff);
    tokio::fs::write(plugin_dir.join("README.md"), &readme)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write README.md: {}", e)))?;
    files_created.push("README.md".to_string());

    Ok(ScaffoldResult {
        plugin_dir: plugin_dir.display().to_string(),
        files_created,
        lifecycle_profile: config.lifecycle_profile.clone(),
        handoff,
    })
}

async fn generate_language_project_files(
    config: &ScaffoldConfig,
    plugin_dir: &Path,
) -> CogniaResult<Vec<String>> {
    match config.language {
        PluginLanguage::Rust => generate_rust_project(config, plugin_dir).await,
        PluginLanguage::JavaScript => generate_js_project(config, plugin_dir).await,
        PluginLanguage::TypeScript => generate_ts_project(config, plugin_dir).await,
    }
}

async fn generate_template_option_files(
    config: &ScaffoldConfig,
    plugin_dir: &Path,
) -> CogniaResult<Vec<String>> {
    let mut files = Vec::new();

    if config.template_options.include_unified_contract_samples {
        files.extend(generate_unified_contract_artifacts(config, plugin_dir).await?);
    }

    if config.template_options.include_starter_tests {
        files.extend(generate_contract_starter_tests(config, plugin_dir).await?);
    }

    Ok(files)
}

/// Validate a plugin directory
pub async fn validate_plugin(path: &Path) -> CogniaResult<ValidationResult> {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // Check plugin.toml exists
    let manifest_path = path.join("plugin.toml");
    if !manifest_path.exists() {
        errors.push("Missing plugin.toml manifest file".to_string());
        return Ok(ValidationResult {
            valid: false,
            can_import: false,
            build_required: false,
            missing_artifact_path: None,
            errors,
            warnings,
        });
    }

    // Parse manifest
    match crate::plugin::manifest::PluginManifest::from_file(&manifest_path) {
        Ok(manifest) => {
            // Check WASM file
            let wasm_path = path.join("plugin.wasm");
            if !wasm_path.exists() {
                warnings.push("No plugin.wasm found — plugin needs to be built first".to_string());
            }

            // Validate plugin id format
            if manifest.plugin.id.contains(' ') {
                errors.push("Plugin ID must not contain spaces".to_string());
            }

            // Check version format
            if manifest.plugin.version.is_empty() {
                errors.push("Plugin version is empty".to_string());
            }

            // Check tools have entries
            for tool in &manifest.tools {
                if tool.entry.is_empty() {
                    errors.push(format!("Tool '{}' has empty entry function", tool.id));
                }
                if tool.name_en.is_empty() {
                    errors.push(format!("Tool '{}' has empty English name", tool.id));
                }
            }

            // Check locales
            let locales_dir = path.join("locales");
            if !locales_dir.exists() && manifest.locales.is_empty() {
                warnings.push("No locales found — plugin won't have i18n support".to_string());
            }

            // Check UI configuration for iframe-mode tools
            let has_iframe = manifest
                .tools
                .iter()
                .any(|t| t.ui_mode == crate::plugin::manifest::UiMode::Iframe);
            if has_iframe {
                if let Some(ref ui_config) = manifest.ui {
                    let ui_entry = path.join(&ui_config.entry);
                    if !ui_entry.exists() {
                        warnings.push(format!(
                            "UI entry file '{}' not found — iframe tools won't work until created",
                            ui_config.entry
                        ));
                    }
                }
            }

            // Warn about dangerous permissions
            if manifest.permissions.config_write {
                warnings.push(
                    "Plugin requests config_write (dangerous, requires explicit user grant)"
                        .to_string(),
                );
            }
            if manifest.permissions.pkg_install {
                warnings.push(
                    "Plugin requests pkg_install (dangerous, requires explicit user grant)"
                        .to_string(),
                );
            }
            if manifest.permissions.process_exec {
                warnings.push(
                    "Plugin requests process_exec (dangerous, requires explicit user grant)"
                        .to_string(),
                );
            }
        }
        Err(e) => {
            errors.push(format!("Invalid plugin.toml: {}", e));
        }
    }

    let missing_artifact_path = path.join("plugin.wasm").display().to_string();
    let build_required = warnings
        .iter()
        .any(|warning| warning.contains("No plugin.wasm found"));

    Ok(ValidationResult {
        valid: errors.is_empty(),
        can_import: errors.is_empty() && !build_required,
        build_required,
        missing_artifact_path: build_required.then_some(missing_artifact_path),
        errors,
        warnings,
    })
}

fn validate_scaffold_config(config: &ScaffoldConfig) -> CogniaResult<()> {
    if config.name.trim().is_empty() {
        return Err(CogniaError::Plugin(
            "Plugin scaffold name must not be empty".to_string(),
        ));
    }

    if config.id.trim().is_empty() {
        return Err(CogniaError::Plugin(
            "Plugin scaffold id must not be empty".to_string(),
        ));
    }

    if config.description.trim().is_empty() {
        return Err(CogniaError::Plugin(
            "Plugin scaffold description must not be empty".to_string(),
        ));
    }

    if config.author.trim().is_empty() {
        return Err(CogniaError::Plugin(
            "Plugin scaffold author must not be empty".to_string(),
        ));
    }

    if config.output_dir.trim().is_empty() {
        return Err(CogniaError::Plugin(
            "Plugin scaffold output_dir must not be empty".to_string(),
        ));
    }

    if !config
        .id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_')
    {
        return Err(CogniaError::Plugin(format!(
            "Invalid plugin id '{}': only alphanumeric, '.', '-', '_' are allowed",
            config.id
        )));
    }

    validate_optional_url("repository", config.repository.as_deref())?;
    validate_optional_url("homepage", config.homepage.as_deref())?;

    if matches!(config.lifecycle_profile, ScaffoldLifecycleProfile::BuiltIn)
        && matches!(config.language, PluginLanguage::JavaScript)
    {
        return Err(CogniaError::Plugin(
            "Built-in plugin scaffolds currently support Rust or TypeScript only".to_string(),
        ));
    }

    if matches!(config.lifecycle_profile, ScaffoldLifecycleProfile::BuiltIn) {
        let output_dir = config.output_dir.trim().replace('\\', "/");
        if output_dir.ends_with("/rust") || output_dir.ends_with("/typescript") {
            return Err(CogniaError::Plugin(
                "Built-in scaffold output_dir must point to the plugins workspace root, not a framework subdirectory"
                    .to_string(),
            ));
        }
    }

    Ok(())
}

fn resolve_scaffold_plugin_dir(config: &ScaffoldConfig, output: &Path) -> PathBuf {
    match config.lifecycle_profile {
        ScaffoldLifecycleProfile::External => output.join(config.id.trim()),
        ScaffoldLifecycleProfile::BuiltIn => output
            .join(builtin_framework_dir(&config.language))
            .join(scaffold_project_slug(config)),
    }
}

fn scaffold_project_slug(config: &ScaffoldConfig) -> String {
    config
        .id
        .split('.')
        .last()
        .unwrap_or(&config.id)
        .trim()
        .to_string()
}

fn builtin_framework_dir(language: &PluginLanguage) -> &'static str {
    match language {
        PluginLanguage::Rust => "rust",
        PluginLanguage::TypeScript => "typescript",
        PluginLanguage::JavaScript => "javascript",
    }
}

fn build_scaffold_handoff(config: &ScaffoldConfig, plugin_dir: &Path) -> ScaffoldHandoff {
    let artifact_path = plugin_dir.join("plugin.wasm").display().to_string();
    let lifecycle_manifest_path = plugin_dir
        .join("cognia.scaffold.json")
        .display()
        .to_string();
    match config.lifecycle_profile {
        ScaffoldLifecycleProfile::External => ScaffoldHandoff {
            profile: ScaffoldLifecycleProfile::External,
            artifact_path,
            build_commands: build_commands_for_language(&config.language),
            next_steps: vec![
                "Build plugin.wasm using the generated build entrypoint.".to_string(),
                "Validate the plugin directory in Toolbox > Plugins > Install > Local.".to_string(),
                "Import the same plugin directory after the build succeeds.".to_string(),
            ],
            import_path: Some(plugin_dir.display().to_string()),
            import_requires_build: true,
            lifecycle_manifest_path,
            builtin_catalog_path: None,
            builtin_checksum_command: None,
            builtin_validation_command: None,
        },
        ScaffoldLifecycleProfile::BuiltIn => ScaffoldHandoff {
            profile: ScaffoldLifecycleProfile::BuiltIn,
            artifact_path,
            build_commands: build_commands_for_language(&config.language),
            next_steps: vec![
                "Add the generated sample entry to plugins/manifest.json.".to_string(),
                "Run pnpm plugins:checksums to capture the built artifact checksum.".to_string(),
                "Run pnpm plugins:validate before treating the plugin as built-in ready."
                    .to_string(),
            ],
            import_path: None,
            import_requires_build: true,
            lifecycle_manifest_path,
            builtin_catalog_path: Some("plugins/manifest.json".to_string()),
            builtin_checksum_command: Some("pnpm plugins:checksums".to_string()),
            builtin_validation_command: Some("pnpm plugins:validate".to_string()),
        },
    }
}

fn build_commands_for_language(language: &PluginLanguage) -> Vec<String> {
    match language {
        PluginLanguage::Rust => vec![
            "rustup target add wasm32-unknown-unknown".to_string(),
            "cargo build --release".to_string(),
            "copy target/wasm32-unknown-unknown/release/*.wasm plugin.wasm".to_string(),
        ],
        PluginLanguage::JavaScript | PluginLanguage::TypeScript => vec![
            "pnpm install".to_string(),
            "pnpm setup:toolchain".to_string(),
            "pnpm build".to_string(),
        ],
    }
}

fn generate_lifecycle_manifest(config: &ScaffoldConfig, handoff: &ScaffoldHandoff) -> String {
    serde_json::to_string_pretty(&serde_json::json!({
        "schemaVersion": 1,
        "pluginId": config.id.clone(),
        "language": config.language,
        "profile": handoff.profile,
        "artifactPath": "plugin.wasm",
        "buildCommands": handoff.build_commands.clone(),
        "nextSteps": handoff.next_steps.clone(),
        "importPath": handoff.import_path.clone(),
        "importRequiresBuild": handoff.import_requires_build,
        "builtinCatalogPath": handoff.builtin_catalog_path.clone(),
        "builtinChecksumCommand": handoff.builtin_checksum_command.clone(),
        "builtinValidationCommand": handoff.builtin_validation_command.clone(),
    }))
    .unwrap()
}

fn builtin_catalog_package_name(config: &ScaffoldConfig) -> String {
    config.id.clone()
}

fn builtin_catalog_rust_crate(config: &ScaffoldConfig) -> String {
    config.id.replace(['.', '-'], "_")
}

fn generate_builtin_catalog_entry_sample(
    config: &ScaffoldConfig,
    plugin_dir: &Path,
) -> serde_json::Value {
    let fallback_slug = scaffold_project_slug(config);
    let plugin_dir_name = plugin_dir
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(fallback_slug.as_str());
    let plugin_dir_relative = format!(
        "{}/{}",
        builtin_framework_dir(&config.language),
        plugin_dir_name
    );

    let mut entry = serde_json::json!({
        "id": config.id.clone(),
        "name": config.name.clone(),
        "framework": match config.language {
            PluginLanguage::Rust => "rust",
            PluginLanguage::TypeScript => "typescript",
            PluginLanguage::JavaScript => "javascript",
        },
        "version": "0.1.0",
        "pluginDir": plugin_dir_relative,
        "artifact": "plugin.wasm",
        "checksumSha256": "<run-pnpm-plugins:checksums>",
        "channel": "stable",
        "minimumHostVersion": "0.1.0",
        "onboarding": {
            "profile": "builtin",
            "catalogPath": "plugins/manifest.json",
            "checksumCommand": "pnpm plugins:checksums",
            "validationCommand": "pnpm plugins:validate"
        }
    });

    match config.language {
        PluginLanguage::Rust => {
            entry["rustCrate"] = serde_json::Value::String(builtin_catalog_rust_crate(config));
        }
        PluginLanguage::TypeScript => {
            entry["packageName"] = serde_json::Value::String(builtin_catalog_package_name(config));
        }
        PluginLanguage::JavaScript => {}
    }

    entry
}

fn validate_optional_url(field: &str, value: Option<&str>) -> CogniaResult<()> {
    if let Some(url) = value.map(|v| v.trim()).filter(|v| !v.is_empty()) {
        if !url.starts_with("http://") && !url.starts_with("https://") {
            return Err(CogniaError::Plugin(format!(
                "Invalid {} URL '{}': must start with http:// or https://",
                field, url
            )));
        }
    }
    Ok(())
}

// ============================================================================
// Template generators
// ============================================================================

fn generate_manifest(config: &ScaffoldConfig) -> String {
    let mut perms = Vec::new();
    if config.permissions.config_read {
        perms.push("config_read = true".to_string());
    }
    if config.permissions.env_read {
        perms.push("env_read = true".to_string());
    }
    if config.permissions.pkg_search {
        perms.push("pkg_search = true".to_string());
    }
    if config.permissions.clipboard {
        perms.push("clipboard = true".to_string());
    }
    if config.permissions.notification {
        perms.push("notification = true".to_string());
    }
    if config.permissions.fs_read {
        perms.push("fs_read = [\"data/*\"]".to_string());
    }
    if config.permissions.fs_write {
        perms.push("fs_write = [\"data/*\"]".to_string());
    }
    if config.permissions.process_exec {
        perms.push("process_exec = true".to_string());
    }
    if !config.permissions.http.is_empty() {
        let domains: Vec<String> = config
            .permissions
            .http
            .iter()
            .map(|d| format!("\"{}\"", d))
            .collect();
        perms.push(format!("http = [{}]", domains.join(", ")));
    }

    let entry_fn = config.id.replace(['.', '-'], "_");
    let tool_id = config
        .id
        .split('.')
        .last()
        .unwrap_or(&config.id)
        .to_string();
    let keywords = build_keywords(&tool_id, &config.additional_keywords);
    let metadata = build_optional_plugin_metadata(config);
    let unified_contract_metadata = build_unified_contract_metadata(config);
    let ui_mode_line = build_ui_mode_line(config);
    let capabilities_line = build_tool_capabilities_line(config);

    format!(
        r#"[plugin]
id = "{id}"
name = "{name}"
version = "0.1.0"
description = "{desc}"
authors = ["{author}"]
{metadata}{unified_contract_metadata}

[[tools]]
id = "{tool_id}"
name_en = "{name} Tool"
name_zh = "{name} 工具"
description_en = "{desc}"
description_zh = "{desc}"
category = "developer"
keywords = [{keywords}]
icon = "Wrench"
entry = "{entry}"
{ui_mode_line}{capabilities_line}

[permissions]
{perms}
"#,
        id = escape_toml_string(&config.id),
        name = escape_toml_string(&config.name),
        desc = escape_toml_string(&config.description),
        author = escape_toml_string(&config.author),
        metadata = metadata,
        unified_contract_metadata = unified_contract_metadata,
        tool_id = escape_toml_string(&tool_id),
        keywords = keywords,
        entry = entry_fn,
        ui_mode_line = ui_mode_line,
        capabilities_line = capabilities_line,
        perms = perms.join("\n"),
    )
}

fn build_optional_plugin_metadata(config: &ScaffoldConfig) -> String {
    let mut lines = Vec::new();
    if let Some(license) = config
        .license
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
    {
        lines.push(format!("license = \"{}\"", escape_toml_string(license)));
    }
    if let Some(repository) = config
        .repository
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
    {
        lines.push(format!(
            "repository = \"{}\"",
            escape_toml_string(repository)
        ));
    }
    if let Some(homepage) = config
        .homepage
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
    {
        lines.push(format!("homepage = \"{}\"", escape_toml_string(homepage)));
    }

    if lines.is_empty() {
        String::new()
    } else {
        format!("{}\n", lines.join("\n"))
    }
}

fn build_unified_contract_metadata(config: &ScaffoldConfig) -> String {
    if !config.template_options.include_unified_contract_samples {
        return String::new();
    }

    let mut lines = vec![format!(
        "tool_contract_version = \"{}\"",
        TOOL_CONTRACT_VERSION
    )];
    lines.push("compatible_cognia_versions = \">=0.1.0\"".to_string());
    format!("{}\n", lines.join("\n"))
}

fn infer_capability_declarations(config: &ScaffoldConfig) -> Vec<String> {
    let mut caps = Vec::new();
    if config.permissions.config_read {
        caps.push("settings.read".to_string());
    }
    if config.permissions.env_read {
        caps.push("environment.read".to_string());
    }
    if config.permissions.pkg_search {
        caps.push("packages.search".to_string());
    }
    if config.permissions.clipboard {
        caps.push("clipboard.readwrite".to_string());
    }
    if config.permissions.notification {
        caps.push("notification.send".to_string());
    }
    if config.permissions.fs_read {
        caps.push("fs.read".to_string());
    }
    if config.permissions.fs_write {
        caps.push("fs.write".to_string());
    }
    if config.permissions.process_exec {
        caps.push("process.exec".to_string());
    }
    if !config.permissions.http.is_empty() {
        caps.push("http.request".to_string());
    }
    caps
}

fn build_ui_mode_line(config: &ScaffoldConfig) -> String {
    if !config.template_options.include_unified_contract_samples {
        return String::new();
    }

    let mode = match config.template_options.contract_template {
        ScaffoldContractTemplate::Minimal => "text",
        ScaffoldContractTemplate::Advanced => "declarative",
    };
    format!("ui_mode = \"{}\"\n", mode)
}

fn build_tool_capabilities_line(config: &ScaffoldConfig) -> String {
    if !config.template_options.include_unified_contract_samples {
        return String::new();
    }

    let caps = infer_capability_declarations(config);
    if caps.is_empty() {
        return String::new();
    }

    let serialized = caps
        .into_iter()
        .map(|cap| format!("\"{}\"", escape_toml_string(&cap)))
        .collect::<Vec<String>>()
        .join(", ");
    format!("capabilities = [{}]\n", serialized)
}

fn build_keywords(base_tool_id: &str, extras: &[String]) -> String {
    let mut values = vec![base_tool_id.trim().to_string()];
    for kw in extras {
        let trimmed = kw.trim();
        if trimmed.is_empty() {
            continue;
        }
        if !values.iter().any(|existing| existing == trimmed) {
            values.push(trimmed.to_string());
        }
    }

    values
        .into_iter()
        .map(|v| format!("\"{}\"", escape_toml_string(&v)))
        .collect::<Vec<String>>()
        .join(", ")
}

fn escape_toml_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn generate_vscode_settings() -> &'static str {
    r#"{
  "editor.formatOnSave": true,
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true
}
"#
}

fn generate_vscode_extensions(config: &ScaffoldConfig) -> String {
    let mut recommendations = vec![
        "EditorConfig.EditorConfig".to_string(),
        "esbenp.prettier-vscode".to_string(),
    ];
    match config.language {
        PluginLanguage::Rust => {
            recommendations.push("rust-lang.rust-analyzer".to_string());
        }
        PluginLanguage::JavaScript => {
            recommendations.push("dbaeumer.vscode-eslint".to_string());
        }
        PluginLanguage::TypeScript => {
            recommendations.push("dbaeumer.vscode-eslint".to_string());
            recommendations.push("ms-vscode.vscode-typescript-next".to_string());
        }
    }

    serde_json::json!({
        "recommendations": recommendations
    })
    .to_string()
}

fn generate_ci_workflow(config: &ScaffoldConfig) -> String {
    let build_step = match config.language {
        PluginLanguage::Rust => {
            r#"      - name: Install wasm target
        run: rustup target add wasm32-unknown-unknown
      - name: Build
        run: cargo build --target wasm32-unknown-unknown --release"#
        }
        PluginLanguage::JavaScript | PluginLanguage::TypeScript => {
            r#"      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - name: Install dependencies
        run: pnpm install
      - name: Build
        run: pnpm build"#
        }
    };

    format!(
        r#"name: plugin-ci

on:
  push:
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
{build_step}
"#
    )
}

async fn generate_unified_contract_artifacts(
    config: &ScaffoldConfig,
    plugin_dir: &Path,
) -> CogniaResult<Vec<String>> {
    let mut files = Vec::new();

    let contracts_dir = plugin_dir.join("contracts");
    tokio::fs::create_dir_all(&contracts_dir)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to create contracts dir: {}", e)))?;
    let unified_contract = generate_unified_contract_sample(config);
    tokio::fs::write(
        contracts_dir.join("unified-tool-contract.sample.json"),
        serde_json::to_string_pretty(&unified_contract).unwrap(),
    )
    .await
    .map_err(|e| {
        CogniaError::Plugin(format!(
            "Failed to write contracts/unified-tool-contract.sample.json: {}",
            e
        ))
    })?;
    files.push("contracts/unified-tool-contract.sample.json".to_string());

    let schemas_dir = plugin_dir.join("schemas");
    tokio::fs::create_dir_all(&schemas_dir)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to create schemas dir: {}", e)))?;

    let input_schema = generate_input_schema_stub(config);
    tokio::fs::write(
        schemas_dir.join("input.schema.json"),
        serde_json::to_string_pretty(&input_schema).unwrap(),
    )
    .await
    .map_err(|e| {
        CogniaError::Plugin(format!("Failed to write schemas/input.schema.json: {}", e))
    })?;
    files.push("schemas/input.schema.json".to_string());

    let output_schema = generate_output_schema_stub();
    tokio::fs::write(
        schemas_dir.join("output.schema.json"),
        serde_json::to_string_pretty(&output_schema).unwrap(),
    )
    .await
    .map_err(|e| {
        CogniaError::Plugin(format!("Failed to write schemas/output.schema.json: {}", e))
    })?;
    files.push("schemas/output.schema.json".to_string());

    let action_envelope_schema = generate_action_envelope_schema();
    tokio::fs::write(
        schemas_dir.join("action-envelope.schema.json"),
        serde_json::to_string_pretty(&action_envelope_schema).unwrap(),
    )
    .await
    .map_err(|e| {
        CogniaError::Plugin(format!(
            "Failed to write schemas/action-envelope.schema.json: {}",
            e
        ))
    })?;
    files.push("schemas/action-envelope.schema.json".to_string());

    if config.template_options.include_validation_guidance {
        let docs_dir = plugin_dir.join("docs");
        tokio::fs::create_dir_all(&docs_dir)
            .await
            .map_err(|e| CogniaError::Plugin(format!("Failed to create docs dir: {}", e)))?;
        let guide = generate_validation_guide(config);
        tokio::fs::write(docs_dir.join("validation-guide.md"), guide)
            .await
            .map_err(|e| {
                CogniaError::Plugin(format!("Failed to write docs/validation-guide.md: {}", e))
            })?;
        files.push("docs/validation-guide.md".to_string());
    }

    Ok(files)
}

fn generate_unified_contract_sample(config: &ScaffoldConfig) -> serde_json::Value {
    let entry_fn = config.id.replace(['.', '-'], "_");
    let tool_id = config
        .id
        .split('.')
        .last()
        .unwrap_or(&config.id)
        .to_string();
    let capabilities = infer_capability_declarations(config);
    let ui_mode = match config.template_options.contract_template {
        ScaffoldContractTemplate::Minimal => "text",
        ScaffoldContractTemplate::Advanced => "declarative",
    };

    serde_json::json!({
        "contractVersion": TOOL_CONTRACT_VERSION,
        "origin": "plugin",
        "plugin": {
            "id": config.id,
            "name": config.name,
            "version": "0.1.0",
            "compatibleCogniaVersions": ">=0.1.0"
        },
        "tool": {
            "toolId": format!("plugin:{}:{}", config.id, tool_id),
            "entry": entry_fn,
            "category": "developer",
            "uiMode": ui_mode,
            "capabilityDeclarations": capabilities,
            "inputSchema": "schemas/input.schema.json",
            "outputSchema": "schemas/output.schema.json",
            "actionEnvelopeSchema": "schemas/action-envelope.schema.json"
        }
    })
}

fn generate_input_schema_stub(config: &ScaffoldConfig) -> serde_json::Value {
    match config.template_options.schema_preset {
        ScaffoldSchemaPreset::BasicForm => serde_json::json!({
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "title": "ToolInput",
            "type": "object",
            "properties": {
                "query": { "type": "string", "title": "Query" },
                "includeLogs": { "type": "boolean", "default": false }
            },
            "required": ["query"],
            "x-cognia-ui": {
                "preset": "basic-form",
                "blocks": [
                    { "type": "input", "id": "query", "label": "Query", "required": true },
                    { "type": "switch", "id": "includeLogs", "label": "Include logs", "defaultChecked": false }
                ]
            }
        }),
        ScaffoldSchemaPreset::MultiStepFlow => serde_json::json!({
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "title": "ToolInput",
            "type": "object",
            "properties": {
                "target": { "type": "string" },
                "mode": { "type": "string", "enum": ["safe", "force"] },
                "confirm": { "type": "boolean" }
            },
            "required": ["target", "mode"],
            "x-cognia-ui": {
                "preset": "multi-step-flow",
                "blocks": [
                    {
                        "type": "stepper",
                        "id": "wizard",
                        "steps": [
                            {
                                "id": "target",
                                "label": "Target",
                                "children": [
                                    { "type": "input", "id": "target", "label": "Target path", "required": true }
                                ]
                            },
                            {
                                "id": "strategy",
                                "label": "Strategy",
                                "children": [
                                    {
                                        "type": "radio-group",
                                        "id": "mode",
                                        "label": "Mode",
                                        "options": [
                                            { "label": "Safe", "value": "safe" },
                                            { "label": "Force", "value": "force" }
                                        ],
                                        "required": true
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        }),
        ScaffoldSchemaPreset::RepeatableCollection => serde_json::json!({
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "title": "ToolInput",
            "type": "object",
            "properties": {
                "hosts": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": { "type": "string" },
                            "port": { "type": "integer", "minimum": 1, "maximum": 65535 }
                        },
                        "required": ["name"]
                    },
                    "minItems": 1
                }
            },
            "required": ["hosts"],
            "x-cognia-ui": {
                "preset": "repeatable-collection",
                "blocks": [
                    {
                        "type": "array",
                        "id": "hosts",
                        "label": "Hosts",
                        "itemLabel": "Host",
                        "placeholder": "localhost"
                    }
                ]
            }
        }),
    }
}

fn generate_output_schema_stub() -> serde_json::Value {
    serde_json::json!({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "ToolOutputChannels",
        "type": "object",
        "properties": {
            "outputChannels": {
                "type": "object",
                "properties": {
                    "structured": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "required": ["type"]
                        }
                    },
                    "stream": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "required": ["message"]
                        }
                    },
                    "artifacts": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "required": ["id", "label"]
                        }
                    },
                    "summary": {
                        "type": ["string", "object"]
                    }
                },
                "additionalProperties": false
            }
        },
        "required": ["outputChannels"]
    })
}

fn generate_action_envelope_schema() -> serde_json::Value {
    serde_json::json!({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "ActionEnvelopeV2",
        "type": "object",
        "properties": {
            "action": { "type": "string" },
            "version": { "type": "integer", "enum": [1, 2] },
            "sourceType": { "type": "string" },
            "sourceId": { "type": "string" },
            "correlationId": { "type": "string" },
            "runtimeContext": { "type": "object" },
            "formData": { "type": "object" },
            "formDataTypes": { "type": "object" }
        },
        "required": ["action"],
        "additionalProperties": true
    })
}

fn generate_validation_guide(config: &ScaffoldConfig) -> String {
    let schema_preset = match config.template_options.schema_preset {
        ScaffoldSchemaPreset::BasicForm => "basic-form",
        ScaffoldSchemaPreset::MultiStepFlow => "multi-step-flow",
        ScaffoldSchemaPreset::RepeatableCollection => "repeatable-collection",
    };

    format!(
        r#"# Validation And Migration Guide

This project was scaffolded with unified contract templates.

## Generated Artifacts

- `contracts/unified-tool-contract.sample.json`
- `schemas/input.schema.json`
- `schemas/output.schema.json`
- `schemas/action-envelope.schema.json`

Schema preset: `{schema_preset}`

## Recommended Checks

1. Keep `plugin.toml` contract fields in sync with `contracts/unified-tool-contract.sample.json`.
2. Validate input/output schema JSON before shipping.
3. Verify action payloads include deterministic metadata (`sourceId`, `correlationId`) for interactive flows.

## Strict Mode Migration Caveats

1. Every granted permission in strict mode must map to a declared capability in each tool.
2. Keep `tool_contract_version` aligned with host support and review compatibility ranges before release.
3. If a capability or contract field is deprecated, migrate to the suggested replacement before strict rollout.
4. Validate filesystem/http permission scopes carefully; strict mode enforces declared ranges.
"#
    )
}

async fn generate_contract_starter_tests(
    config: &ScaffoldConfig,
    plugin_dir: &Path,
) -> CogniaResult<Vec<String>> {
    let mut files = Vec::new();
    let tests_dir = plugin_dir.join("tests");
    tokio::fs::create_dir_all(&tests_dir)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to create tests dir: {}", e)))?;

    match config.language {
        PluginLanguage::Rust => {
            let content = generate_rust_contract_test_template();
            tokio::fs::write(tests_dir.join("contract_validation.rs"), content)
                .await
                .map_err(|e| {
                    CogniaError::Plugin(format!(
                        "Failed to write tests/contract_validation.rs: {}",
                        e
                    ))
                })?;
            files.push("tests/contract_validation.rs".to_string());
        }
        PluginLanguage::JavaScript | PluginLanguage::TypeScript => {
            let content = generate_js_contract_test_template();
            tokio::fs::write(tests_dir.join("contract-validation.test.js"), content)
                .await
                .map_err(|e| {
                    CogniaError::Plugin(format!(
                        "Failed to write tests/contract-validation.test.js: {}",
                        e
                    ))
                })?;
            files.push("tests/contract-validation.test.js".to_string());
        }
    }

    Ok(files)
}

fn generate_rust_contract_test_template() -> &'static str {
    r#"use std::fs;
use std::path::Path;

#[test]
fn manifest_declares_unified_contract_defaults() {
    let manifest = fs::read_to_string("plugin.toml").expect("plugin.toml should exist");
    assert!(manifest.contains("tool_contract_version"));
    assert!(manifest.contains("compatible_cognia_versions"));
}

#[test]
fn generated_schema_files_are_valid_json() {
    for relative in [
        "contracts/unified-tool-contract.sample.json",
        "schemas/input.schema.json",
        "schemas/output.schema.json",
        "schemas/action-envelope.schema.json",
    ] {
        let content = fs::read_to_string(relative).unwrap_or_else(|_| panic!("missing {}", relative));
        let _: serde_json::Value = serde_json::from_str(&content)
            .unwrap_or_else(|_| panic!("invalid JSON in {}", relative));
    }
}

#[test]
fn action_envelope_schema_has_correlation_metadata() {
    let content = fs::read_to_string("schemas/action-envelope.schema.json")
        .expect("action-envelope schema should exist");
    let parsed: serde_json::Value = serde_json::from_str(&content).expect("schema should parse");
    let props = parsed
        .get("properties")
        .and_then(serde_json::Value::as_object)
        .expect("schema should include properties");
    assert!(props.contains_key("sourceId"));
    assert!(props.contains_key("correlationId"));
}

#[test]
fn validation_guide_exists_when_enabled() {
    if Path::new("docs/validation-guide.md").exists() {
        let guide = fs::read_to_string("docs/validation-guide.md").expect("guide should be readable");
        assert!(guide.contains("Strict Mode Migration Caveats"));
    }
}
"#
}

fn generate_js_contract_test_template() -> &'static str {
    r#"import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const readJson = (relativePath) => {
  const content = readFileSync(join(process.cwd(), relativePath), 'utf8');
  return JSON.parse(content);
};

test('manifest declares unified contract defaults', () => {
  const manifest = readFileSync(join(process.cwd(), 'plugin.toml'), 'utf8');
  assert.match(manifest, /tool_contract_version\s*=/);
  assert.match(manifest, /compatible_cognia_versions\s*=/);
});

test('generated schema files are valid JSON', () => {
  const files = [
    'contracts/unified-tool-contract.sample.json',
    'schemas/input.schema.json',
    'schemas/output.schema.json',
    'schemas/action-envelope.schema.json',
  ];
  for (const file of files) {
    assert.doesNotThrow(() => readJson(file));
  }
});

test('action envelope schema keeps correlation metadata fields', () => {
  const schema = readJson('schemas/action-envelope.schema.json');
  assert.ok(schema.properties.sourceId);
  assert.ok(schema.properties.correlationId);
});

test('validation guide includes strict migration caveats when present', () => {
  const path = join(process.cwd(), 'docs/validation-guide.md');
  if (!existsSync(path)) return;
  const guide = readFileSync(path, 'utf8');
  assert.match(guide, /Strict Mode Migration Caveats/);
});
"#
}

async fn generate_rust_project(
    config: &ScaffoldConfig,
    plugin_dir: &Path,
) -> CogniaResult<Vec<String>> {
    let mut files = Vec::new();

    // Cargo.toml
    let cargo_toml = format!(
        r#"[package]
name = "{}"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
cognia-plugin-sdk = {{ git = "https://github.com/AstroAir/CogniaLauncher", path = "plugin-sdk" }}
extism-pdk = "1.3"
serde = {{ version = "1", features = ["derive"] }}
serde_json = "1"
"#,
        config.id.replace('.', "-"),
    );
    tokio::fs::write(plugin_dir.join("Cargo.toml"), &cargo_toml)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write Cargo.toml: {}", e)))?;
    files.push("Cargo.toml".to_string());

    // .cargo/config.toml
    let cargo_dir = plugin_dir.join(".cargo");
    tokio::fs::create_dir_all(&cargo_dir)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to create .cargo dir: {}", e)))?;
    let cargo_config = r#"[build]
target = "wasm32-unknown-unknown"
"#;
    tokio::fs::write(cargo_dir.join("config.toml"), cargo_config)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write .cargo/config.toml: {}", e)))?;
    files.push(".cargo/config.toml".to_string());

    // src/lib.rs
    let src_dir = plugin_dir.join("src");
    tokio::fs::create_dir_all(&src_dir)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to create src dir: {}", e)))?;

    let entry_fn = config.id.replace(['.', '-'], "_");
    let lib_rs = format!(
        r#"use cognia_plugin_sdk::prelude::*;

#[plugin_fn]
pub fn {entry}(input: String) -> FnResult<String> {{
    // Get platform information
    let platform = cognia::platform::info()?;
    cognia::log::info(&format!("Plugin running on {{}} {{}}", platform.os, platform.arch))?;

    // Get current locale and translate a greeting
    let greeting = cognia::i18n::translate("greeting", &[("name", &platform.hostname)])?;

    // Return JSON result
    Ok(serde_json::json!({{
        "greeting": greeting,
        "platform": platform.os,
        "input": input,
    }}).to_string())
}}
"#,
        entry = entry_fn,
    );
    tokio::fs::write(src_dir.join("lib.rs"), &lib_rs)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write src/lib.rs: {}", e)))?;
    files.push("src/lib.rs".to_string());

    Ok(files)
}

async fn generate_js_project(
    config: &ScaffoldConfig,
    plugin_dir: &Path,
) -> CogniaResult<Vec<String>> {
    let mut files = Vec::new();

    // package.json
    let mut scripts = serde_json::Map::from_iter([
        (
            "build".to_string(),
            serde_json::Value::String("node scripts/build.mjs".to_string()),
        ),
        (
            "setup:toolchain".to_string(),
            serde_json::Value::String("node scripts/build.mjs --setup-only".to_string()),
        ),
    ]);
    if config.template_options.include_starter_tests {
        scripts.insert(
            "test:contract".to_string(),
            serde_json::Value::String("node --test tests/contract-validation.test.js".to_string()),
        );
    }

    let package_json = serde_json::json!({
        "name": config.id,
        "version": "0.1.0",
        "description": config.description,
        "author": config.author,
        "scripts": serde_json::Value::Object(scripts),
        "devDependencies": {
            "@extism/js-pdk": "^1.1.1"
        }
    });
    tokio::fs::write(
        plugin_dir.join("package.json"),
        serde_json::to_string_pretty(&package_json).unwrap(),
    )
    .await
    .map_err(|e| CogniaError::Plugin(format!("Failed to write package.json: {}", e)))?;
    files.push("package.json".to_string());

    // scripts/build.mjs
    let scripts_dir = plugin_dir.join("scripts");
    tokio::fs::create_dir_all(&scripts_dir)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to create scripts dir: {}", e)))?;
    let build_script = generate_wasm_build_script(false, false);
    tokio::fs::write(scripts_dir.join("build.mjs"), &build_script)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write scripts/build.mjs: {}", e)))?;
    files.push("scripts/build.mjs".to_string());

    // src/index.js
    let src_dir = plugin_dir.join("src");
    tokio::fs::create_dir_all(&src_dir)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to create src dir: {}", e)))?;

    let entry_fn = config.id.replace(['.', '-'], "_");
    let index_js = format!(
        r#"// {name} - CogniaLauncher Plugin (JavaScript)

function {entry}() {{
    const input = Host.inputString();

    // Call host function: get platform info
    const platformJson = Host.getFunctions().cognia_platform_info("");
    const platform = JSON.parse(platformJson);

    // Call host function: log
    Host.getFunctions().cognia_log(JSON.stringify({{
        level: "info",
        message: "Plugin running on " + platform.os
    }}));

    // Return result
    Host.outputString(JSON.stringify({{
        greeting: "Hello from {name}!",
        platform: platform.os,
        input: input,
    }}));
}}

module.exports = {{ {entry} }};
"#,
        name = config.name,
        entry = entry_fn,
    );
    tokio::fs::write(src_dir.join("index.js"), &index_js)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write src/index.js: {}", e)))?;
    files.push("src/index.js".to_string());

    Ok(files)
}

async fn generate_ts_project(
    config: &ScaffoldConfig,
    plugin_dir: &Path,
) -> CogniaResult<Vec<String>> {
    let mut files = Vec::new();

    // package.json
    let mut scripts = serde_json::Map::from_iter([
        (
            "build".to_string(),
            serde_json::Value::String("node scripts/build.mjs".to_string()),
        ),
        (
            "bundle".to_string(),
            serde_json::Value::String("node esbuild.config.mjs".to_string()),
        ),
        (
            "setup:toolchain".to_string(),
            serde_json::Value::String("node scripts/build.mjs --setup-only".to_string()),
        ),
    ]);
    if config.template_options.include_starter_tests {
        scripts.insert(
            "test:contract".to_string(),
            serde_json::Value::String("node --test tests/contract-validation.test.js".to_string()),
        );
    }

    let package_json = serde_json::json!({
        "name": config.id,
        "version": "0.1.0",
        "description": config.description,
        "author": config.author,
        "scripts": serde_json::Value::Object(scripts),
        "dependencies": {
            "@cognia/plugin-sdk": "workspace:*"
        },
        "devDependencies": {
            "@extism/js-pdk": "^1.1.1",
            "esbuild": "^0.20.0"
        }
    });
    tokio::fs::write(
        plugin_dir.join("package.json"),
        serde_json::to_string_pretty(&package_json).unwrap(),
    )
    .await
    .map_err(|e| CogniaError::Plugin(format!("Failed to write package.json: {}", e)))?;
    files.push("package.json".to_string());

    // tsconfig.json
    let tsconfig = serde_json::json!({
        "compilerOptions": {
            "target": "es2020",
            "module": "commonjs",
            "lib": [],
            "types": ["@extism/js-pdk"],
            "strict": true,
            "esModuleInterop": true,
            "skipLibCheck": true,
            "noEmit": true
        },
        "include": ["src/**/*.ts", "plugin.d.ts", "node_modules/@cognia/plugin-sdk/cognia.d.ts"]
    });
    tokio::fs::write(
        plugin_dir.join("tsconfig.json"),
        serde_json::to_string_pretty(&tsconfig).unwrap(),
    )
    .await
    .map_err(|e| CogniaError::Plugin(format!("Failed to write tsconfig.json: {}", e)))?;
    files.push("tsconfig.json".to_string());

    // esbuild.config.mjs
    let esbuild_config = r#"import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/plugin.js',
  format: 'cjs',
  target: 'es2020',
  platform: 'neutral',
  mainFields: ['main', 'module'],
  external: [],
});
"#;
    tokio::fs::write(plugin_dir.join("esbuild.config.mjs"), esbuild_config)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write esbuild.config.mjs: {}", e)))?;
    files.push("esbuild.config.mjs".to_string());

    // scripts/build.mjs
    let scripts_dir = plugin_dir.join("scripts");
    tokio::fs::create_dir_all(&scripts_dir)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to create scripts dir: {}", e)))?;
    let build_script = generate_wasm_build_script(true, true);
    tokio::fs::write(scripts_dir.join("build.mjs"), &build_script)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write scripts/build.mjs: {}", e)))?;
    files.push("scripts/build.mjs".to_string());

    // plugin.d.ts — Extism export declarations + host function declarations
    let entry_fn = config.id.replace(['.', '-'], "_");
    let plugin_dts = format!(
        r#"declare module "main" {{
  export function {entry}(): I32;
}}

declare module "extism:host" {{
  interface user {{
    cognia_config_get(ptr: I64): I64;
    cognia_config_set(ptr: I64): I64;
    cognia_env_list(ptr: I64): I64;
    cognia_provider_list(ptr: I64): I64;
    cognia_env_detect(ptr: I64): I64;
    cognia_env_get_current(ptr: I64): I64;
    cognia_env_list_versions(ptr: I64): I64;
    cognia_env_install_version(ptr: I64): I64;
    cognia_env_set_version(ptr: I64): I64;
    cognia_pkg_search(ptr: I64): I64;
    cognia_pkg_info(ptr: I64): I64;
    cognia_pkg_versions(ptr: I64): I64;
    cognia_pkg_dependencies(ptr: I64): I64;
    cognia_pkg_list_installed(ptr: I64): I64;
    cognia_pkg_check_updates(ptr: I64): I64;
    cognia_pkg_install(ptr: I64): I64;
    cognia_pkg_uninstall(ptr: I64): I64;
    cognia_fs_read(ptr: I64): I64;
    cognia_fs_write(ptr: I64): I64;
    cognia_fs_list_dir(ptr: I64): I64;
    cognia_fs_exists(ptr: I64): I64;
    cognia_fs_delete(ptr: I64): I64;
    cognia_fs_mkdir(ptr: I64): I64;
    cognia_http_get(ptr: I64): I64;
    cognia_http_post(ptr: I64): I64;
    cognia_http_request(ptr: I64): I64;
    cognia_clipboard_read(ptr: I64): I64;
    cognia_clipboard_write(ptr: I64): I64;
    cognia_notification_send(ptr: I64): I64;
    cognia_process_exec(ptr: I64): I64;
    cognia_get_locale(ptr: I64): I64;
    cognia_i18n_translate(ptr: I64): I64;
    cognia_i18n_get_all(ptr: I64): I64;
    cognia_platform_info(ptr: I64): I64;
    cognia_cache_info(ptr: I64): I64;
    cognia_log(ptr: I64): I64;
    cognia_event_emit(ptr: I64): I64;
    cognia_get_plugin_id(ptr: I64): I64;
  }}
}}
"#,
        entry = entry_fn,
    );
    tokio::fs::write(plugin_dir.join("plugin.d.ts"), &plugin_dts)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write plugin.d.ts: {}", e)))?;
    files.push("plugin.d.ts".to_string());

    // src/index.ts — main plugin source
    let src_dir = plugin_dir.join("src");
    tokio::fs::create_dir_all(&src_dir)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to create src dir: {}", e)))?;

    let index_ts = format!(
        r#"// {name} - CogniaLauncher Plugin (TypeScript)
import {{ cognia }} from '@cognia/plugin-sdk';

function {entry}(): number {{
    const input = Host.inputString();

    // Get platform information
    const platform = cognia.platform.info();
    cognia.log.info(`Plugin running on ${{platform.os}} ${{platform.arch}}`);

    // Get current locale and translate a greeting
    const greeting = cognia.i18n.translate('greeting', {{ name: platform.hostname }});

    // Return JSON result
    Host.outputString(JSON.stringify({{
        greeting,
        platform: platform.os,
        input,
    }}));
    return 0;
}}

module.exports = {{ {entry} }};
"#,
        name = config.name,
        entry = entry_fn,
    );
    tokio::fs::write(src_dir.join("index.ts"), &index_ts)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write src/index.ts: {}", e)))?;
    files.push("src/index.ts".to_string());

    Ok(files)
}

fn generate_wasm_build_script(with_bundle: bool, with_interface: bool) -> String {
    let template = include_str!("templates/wasm_build_script.mjs");
    template
        .replace(
            "__WITH_BUNDLE__",
            if with_bundle { "true" } else { "false" },
        )
        .replace(
            "__WITH_INTERFACE__",
            if with_interface { "true" } else { "false" },
        )
}

fn generate_readme(config: &ScaffoldConfig, handoff: &ScaffoldHandoff) -> String {
    let build_instructions = match config.language {
        PluginLanguage::Rust => r#"## Build

```bash
# Install WASM target (first time only)
rustup target add wasm32-unknown-unknown

# Build the plugin
cargo build --release

# The plugin.wasm will be at target/wasm32-unknown-unknown/release/<name>.wasm
# Copy it to plugin.wasm in the project root
cp target/wasm32-unknown-unknown/release/*.wasm plugin.wasm
```"#
            .to_string(),
        PluginLanguage::JavaScript => r#"## Build

```bash
# Install dependencies
pnpm install

# Optional: pre-download extism-js + binaryen into .tools/
pnpm setup:toolchain

# Build the plugin
pnpm build
```

If your environment cannot access GitHub directly:

```bash
EXTISM_JS_PATH=/path/to/extism-js BINARYEN_BIN=/path/to/binaryen/bin pnpm build
```"#
            .to_string(),
        PluginLanguage::TypeScript => r#"## Build

```bash
# Install dependencies
pnpm install

# Optional: pre-download extism-js + binaryen into .tools/
pnpm setup:toolchain

# Bundle TypeScript and compile to WASM
pnpm build
```

If your environment cannot access GitHub directly:

```bash
EXTISM_JS_PATH=/path/to/extism-js BINARYEN_BIN=/path/to/binaryen/bin pnpm build
```"#
            .to_string(),
    };

    let mut project_links = String::new();
    if let Some(repository) = config
        .repository
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
    {
        project_links.push_str(&format!("- Repository: {}\n", repository));
    }
    if let Some(homepage) = config
        .homepage
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
    {
        project_links.push_str(&format!("- Homepage: {}\n", homepage));
    }

    let project_links_section = if project_links.is_empty() {
        String::new()
    } else {
        format!("\n## Project Links\n\n{}", project_links)
    };

    let schema_preset = match config.template_options.schema_preset {
        ScaffoldSchemaPreset::BasicForm => "basic-form",
        ScaffoldSchemaPreset::MultiStepFlow => "multi-step-flow",
        ScaffoldSchemaPreset::RepeatableCollection => "repeatable-collection",
    };
    let contract_template = match config.template_options.contract_template {
        ScaffoldContractTemplate::Minimal => "minimal",
        ScaffoldContractTemplate::Advanced => "advanced",
    };
    let starter_test_command = if config.template_options.include_starter_tests {
        match config.language {
            PluginLanguage::Rust => "cargo test",
            PluginLanguage::JavaScript | PluginLanguage::TypeScript => "pnpm run test:contract",
        }
    } else {
        "(not generated)"
    };
    let contract_section = if config.template_options.include_unified_contract_samples {
        format!(
            r#"
## Unified Contract Artifacts

- `contracts/unified-tool-contract.sample.json`
- `schemas/input.schema.json` (preset: `{schema_preset}`)
- `schemas/output.schema.json`
- `schemas/action-envelope.schema.json`
- Contract template: `{contract_template}`
"#
        )
    } else {
        String::new()
    };

    let development_section = format!(
        r#"
## Development Extras

- VSCode defaults: {}
- CI workflow scaffold: {}
- Unified contract samples: {}
- Validation guide: {}
- Starter contract tests: {}
- Contract test command: {}
"#,
        if config.include_vscode {
            "included (`.vscode/`)"
        } else {
            "not included"
        },
        if config.include_ci {
            "included (`.github/workflows/ci.yml`)"
        } else {
            "not included"
        },
        if config.template_options.include_unified_contract_samples {
            "included"
        } else {
            "not included"
        },
        if config.template_options.include_validation_guidance
            && config.template_options.include_unified_contract_samples
        {
            "included (`docs/validation-guide.md`)"
        } else {
            "not included"
        },
        if config.template_options.include_starter_tests {
            "included (`tests/`)"
        } else {
            "not included"
        },
        starter_test_command,
    );

    let lifecycle_title = match handoff.profile {
        ScaffoldLifecycleProfile::External => "## Lifecycle Handoff",
        ScaffoldLifecycleProfile::BuiltIn => "## Built-in Onboarding",
    };
    let lifecycle_steps = handoff
        .next_steps
        .iter()
        .map(|step| format!("- {}", step))
        .collect::<Vec<_>>()
        .join("\n");
    let lifecycle_commands = handoff
        .build_commands
        .iter()
        .map(|command| format!("- `{}`", command))
        .collect::<Vec<_>>()
        .join("\n");
    let lifecycle_import = handoff
        .import_path
        .as_ref()
        .map(|path| format!("- Import path: `{}`\n", path))
        .unwrap_or_default();
    let builtin_onboarding = match handoff.profile {
        ScaffoldLifecycleProfile::External => String::new(),
        ScaffoldLifecycleProfile::BuiltIn => format!(
            "- Catalog handoff sample: `catalog-entry.sample.json`\n- Catalog path: `{}`\n- Checksum command: `{}`\n- Validation command: `{}`\n",
            handoff
                .builtin_catalog_path
                .as_deref()
                .unwrap_or("plugins/manifest.json"),
            handoff
                .builtin_checksum_command
                .as_deref()
                .unwrap_or("pnpm plugins:checksums"),
            handoff
                .builtin_validation_command
                .as_deref()
                .unwrap_or("pnpm plugins:validate"),
        ),
    };
    let lifecycle_section = format!(
        r#"
{lifecycle_title}

- Lifecycle metadata: `cognia.scaffold.json`
- Expected artifact: `{artifact_path}`
{lifecycle_import}{builtin_onboarding}
### Recommended Commands

{lifecycle_commands}

### Next Steps

{lifecycle_steps}
"#,
        lifecycle_title = lifecycle_title,
        artifact_path = handoff.artifact_path,
        lifecycle_import = lifecycle_import,
        builtin_onboarding = builtin_onboarding,
        lifecycle_commands = lifecycle_commands,
        lifecycle_steps = lifecycle_steps,
    );

    format!(
        r#"# {name}

{desc}

{build}

## Install

Copy this entire directory into CogniaLauncher's plugins folder, or use the
"Install Plugin" button in the Toolbox > Plugins page.

## Permissions

This plugin uses the following permissions (declared in `plugin.toml`):
- See `[permissions]` section in `plugin.toml`

## Locales

Translation files are in the `locales/` directory:
- `locales/en.json` — English
- `locales/zh.json` — Chinese
{contract_section}
{lifecycle_section}
{project_links_section}
{development_section}
"#,
        name = config.name,
        desc = config.description,
        build = build_instructions,
        contract_section = contract_section,
        lifecycle_section = lifecycle_section,
        project_links_section = project_links_section,
        development_section = development_section,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_path(prefix: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time went backwards")
            .as_nanos();
        std::env::temp_dir().join(format!("{}_{}", prefix, nanos))
    }

    fn base_scaffold_config(output_dir: &str) -> ScaffoldConfig {
        ScaffoldConfig {
            name: "Sample Plugin".to_string(),
            id: "com.example.sample".to_string(),
            description: "desc".to_string(),
            author: "author".to_string(),
            output_dir: output_dir.to_string(),
            license: None,
            repository: None,
            homepage: None,
            lifecycle_profile: ScaffoldLifecycleProfile::External,
            language: PluginLanguage::TypeScript,
            permissions: ScaffoldPermissions::default(),
            include_ci: false,
            include_vscode: true,
            additional_keywords: Vec::new(),
            template_options: ScaffoldTemplateOptions::default(),
        }
    }

    #[test]
    fn test_generate_manifest() {
        let config = ScaffoldConfig {
            name: "Test Plugin".to_string(),
            id: "com.example.test".to_string(),
            description: "A test plugin".to_string(),
            author: "Test Author".to_string(),
            output_dir: "/tmp".to_string(),
            license: Some("MIT".to_string()),
            repository: Some("https://github.com/example/test-plugin".to_string()),
            homepage: Some("https://example.com/test-plugin".to_string()),
            lifecycle_profile: ScaffoldLifecycleProfile::External,
            language: PluginLanguage::Rust,
            permissions: ScaffoldPermissions {
                config_read: true,
                env_read: true,
                ..Default::default()
            },
            include_ci: true,
            include_vscode: true,
            additional_keywords: vec!["utility".to_string(), "rust".to_string()],
            template_options: ScaffoldTemplateOptions::default(),
        };
        let manifest = generate_manifest(&config);
        assert!(manifest.contains("id = \"com.example.test\""));
        assert!(manifest.contains("config_read = true"));
        assert!(manifest.contains("env_read = true"));
        assert!(manifest.contains("entry = \"com_example_test\""));
        assert!(manifest.contains("license = \"MIT\""));
        assert!(manifest.contains("repository = \"https://github.com/example/test-plugin\""));
        assert!(manifest.contains("homepage = \"https://example.com/test-plugin\""));
        assert!(manifest.contains("keywords = [\"test\", \"utility\", \"rust\"]"));
        assert!(manifest.contains("tool_contract_version = \"1.0.0\""));
        assert!(manifest.contains("compatible_cognia_versions = \">=0.1.0\""));
        assert!(manifest.contains("ui_mode = \"text\""));
        assert!(manifest.contains("capabilities = [\"settings.read\", \"environment.read\"]"));
    }

    #[test]
    fn test_generate_manifest_advanced_contract_template_updates_ui_defaults() {
        let mut config = base_scaffold_config("/tmp");
        config.language = PluginLanguage::TypeScript;
        config.id = "com.example.advanced".to_string();
        config.permissions.config_read = true;
        config.permissions.env_read = true;
        config.template_options.contract_template = ScaffoldContractTemplate::Advanced;

        let manifest = generate_manifest(&config);
        assert!(manifest.contains("ui_mode = \"declarative\""));
        assert!(manifest.contains("capabilities = [\"settings.read\", \"environment.read\"]"));
        assert!(manifest.contains("tool_contract_version = \"1.0.0\""));
    }

    #[test]
    fn test_scaffold_config_default_language() {
        let json = r#"{"name":"T","id":"t","description":"d","author":"a","outputDir":"/tmp"}"#;
        let config: ScaffoldConfig = serde_json::from_str(json).unwrap();
        assert!(matches!(config.language, PluginLanguage::Rust));
        assert!(matches!(
            config.lifecycle_profile,
            ScaffoldLifecycleProfile::External
        ));
        assert!(config.include_vscode);
        assert!(!config.include_ci);
        assert!(config.additional_keywords.is_empty());
        assert!(config.template_options.include_unified_contract_samples);
        assert!(matches!(
            config.template_options.contract_template,
            ScaffoldContractTemplate::Minimal
        ));
        assert!(matches!(
            config.template_options.schema_preset,
            ScaffoldSchemaPreset::BasicForm
        ));
        assert!(config.template_options.include_validation_guidance);
        assert!(!config.template_options.include_starter_tests);
    }

    #[test]
    fn test_generate_readme_rust() {
        let config = ScaffoldConfig {
            name: "My Plugin".to_string(),
            id: "com.example.my".to_string(),
            description: "desc".to_string(),
            author: "auth".to_string(),
            output_dir: "/tmp".to_string(),
            license: None,
            repository: None,
            homepage: None,
            lifecycle_profile: ScaffoldLifecycleProfile::External,
            language: PluginLanguage::Rust,
            permissions: ScaffoldPermissions::default(),
            include_ci: false,
            include_vscode: true,
            additional_keywords: Vec::new(),
            template_options: ScaffoldTemplateOptions::default(),
        };
        let plugin_dir = PathBuf::from("/tmp/com.example.my");
        let handoff = build_scaffold_handoff(&config, &plugin_dir);
        let readme = generate_readme(&config, &handoff);
        assert!(readme.contains("# My Plugin"));
        assert!(readme.contains("cargo build"));
    }

    #[test]
    fn test_scaffold_config_typescript_language() {
        let json = r#"{"name":"T","id":"t","description":"d","author":"a","outputDir":"/tmp","language":"typescript"}"#;
        let config: ScaffoldConfig = serde_json::from_str(json).unwrap();
        assert!(matches!(config.language, PluginLanguage::TypeScript));
    }

    #[test]
    fn test_generate_readme_ts() {
        let config = ScaffoldConfig {
            name: "TS Plugin".to_string(),
            id: "com.example.ts".to_string(),
            description: "desc".to_string(),
            author: "auth".to_string(),
            output_dir: "/tmp".to_string(),
            license: None,
            repository: None,
            homepage: None,
            lifecycle_profile: ScaffoldLifecycleProfile::External,
            language: PluginLanguage::TypeScript,
            permissions: ScaffoldPermissions::default(),
            include_ci: false,
            include_vscode: true,
            additional_keywords: Vec::new(),
            template_options: ScaffoldTemplateOptions::default(),
        };
        let plugin_dir = PathBuf::from("/tmp/com.example.ts");
        let handoff = build_scaffold_handoff(&config, &plugin_dir);
        let readme = generate_readme(&config, &handoff);
        assert!(readme.contains("pnpm build"));
        assert!(readme.contains("TypeScript"));
    }

    #[test]
    fn test_generate_readme_builtin_mentions_onboarding_flow() {
        let config = ScaffoldConfig {
            name: "Built-in Plugin".to_string(),
            id: "com.cognia.builtin.sample".to_string(),
            description: "desc".to_string(),
            author: "auth".to_string(),
            output_dir: "/repo/plugins".to_string(),
            license: None,
            repository: None,
            homepage: None,
            lifecycle_profile: ScaffoldLifecycleProfile::BuiltIn,
            language: PluginLanguage::TypeScript,
            permissions: ScaffoldPermissions::default(),
            include_ci: false,
            include_vscode: true,
            additional_keywords: Vec::new(),
            template_options: ScaffoldTemplateOptions::default(),
        };
        let plugin_dir = PathBuf::from("/repo/plugins/typescript/sample");
        let handoff = build_scaffold_handoff(&config, &plugin_dir);
        let readme = generate_readme(&config, &handoff);
        assert!(readme.contains("pnpm plugins:validate"));
        assert!(readme.contains("plugins/manifest.json"));
        assert!(readme.contains("catalog-entry.sample.json"));
    }

    #[test]
    fn test_generate_readme_js() {
        let config = ScaffoldConfig {
            name: "JS Plugin".to_string(),
            id: "com.example.js".to_string(),
            description: "desc".to_string(),
            author: "auth".to_string(),
            output_dir: "/tmp".to_string(),
            license: None,
            repository: None,
            homepage: None,
            lifecycle_profile: ScaffoldLifecycleProfile::External,
            language: PluginLanguage::JavaScript,
            permissions: ScaffoldPermissions::default(),
            include_ci: false,
            include_vscode: true,
            additional_keywords: Vec::new(),
            template_options: ScaffoldTemplateOptions::default(),
        };
        let plugin_dir = PathBuf::from("/tmp/com.example.js");
        let handoff = build_scaffold_handoff(&config, &plugin_dir);
        let readme = generate_readme(&config, &handoff);
        assert!(readme.contains("pnpm build"));
    }

    #[test]
    fn test_scaffold_config_optional_fields_deserialize() {
        let json = r#"{
          "name":"Plugin",
          "id":"com.example.plugin",
          "description":"desc",
          "author":"author",
          "outputDir":"/tmp",
          "license":"MIT",
          "repository":"https://github.com/example/repo",
          "homepage":"https://example.com",
          "includeCi":true,
          "includeVscode":false,
          "additionalKeywords":["foo","bar"]
        }"#;
        let config: ScaffoldConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.license.as_deref(), Some("MIT"));
        assert_eq!(
            config.repository.as_deref(),
            Some("https://github.com/example/repo")
        );
        assert_eq!(config.homepage.as_deref(), Some("https://example.com"));
        assert!(config.include_ci);
        assert!(!config.include_vscode);
        assert_eq!(config.additional_keywords, vec!["foo", "bar"]);
        assert!(config.template_options.include_unified_contract_samples);
        assert!(matches!(
            config.template_options.schema_preset,
            ScaffoldSchemaPreset::BasicForm
        ));
    }

    #[test]
    fn test_scaffold_config_template_options_deserialize() {
        let json = r#"{
          "name":"Plugin",
          "id":"com.example.plugin",
          "description":"desc",
          "author":"author",
          "outputDir":"/tmp",
          "templateOptions":{
            "includeUnifiedContractSamples":true,
            "contractTemplate":"advanced",
            "schemaPreset":"multi-step-flow",
            "includeValidationGuidance":true,
            "includeStarterTests":true
          }
        }"#;
        let config: ScaffoldConfig = serde_json::from_str(json).unwrap();
        assert!(matches!(
            config.template_options.contract_template,
            ScaffoldContractTemplate::Advanced
        ));
        assert!(matches!(
            config.template_options.schema_preset,
            ScaffoldSchemaPreset::MultiStepFlow
        ));
        assert!(config.template_options.include_starter_tests);
    }

    #[test]
    fn test_generate_input_schema_stub_respects_schema_preset() {
        let mut config: ScaffoldConfig = serde_json::from_str(
            r#"{"name":"Plugin","id":"com.example.plugin","description":"desc","author":"author","outputDir":"/tmp"}"#,
        )
        .unwrap();

        config.template_options.schema_preset = ScaffoldSchemaPreset::RepeatableCollection;
        let schema = generate_input_schema_stub(&config);
        assert_eq!(schema["x-cognia-ui"]["preset"], "repeatable-collection");

        config.template_options.schema_preset = ScaffoldSchemaPreset::MultiStepFlow;
        let schema = generate_input_schema_stub(&config);
        assert_eq!(schema["x-cognia-ui"]["preset"], "multi-step-flow");
    }

    #[test]
    fn test_generate_validation_guide_contains_strict_mode_caveats() {
        let config: ScaffoldConfig = serde_json::from_str(
            r#"{"name":"Plugin","id":"com.example.plugin","description":"desc","author":"author","outputDir":"/tmp"}"#,
        )
        .unwrap();
        let guide = generate_validation_guide(&config);
        assert!(guide.contains("Strict Mode Migration Caveats"));
        assert!(guide.contains("tool_contract_version"));
        assert!(guide.contains("correlationId"));
    }

    #[test]
    fn test_validate_scaffold_config_rejects_invalid_url() {
        let config = ScaffoldConfig {
            name: "Test".to_string(),
            id: "com.example.test".to_string(),
            description: "desc".to_string(),
            author: "auth".to_string(),
            output_dir: "/tmp".to_string(),
            license: None,
            repository: Some("github.com/example".to_string()),
            homepage: None,
            lifecycle_profile: ScaffoldLifecycleProfile::External,
            language: PluginLanguage::Rust,
            permissions: ScaffoldPermissions::default(),
            include_ci: false,
            include_vscode: true,
            additional_keywords: Vec::new(),
            template_options: ScaffoldTemplateOptions::default(),
        };
        let result = validate_scaffold_config(&config);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_scaffold_config_rejects_builtin_javascript_profile() {
        let config = ScaffoldConfig {
            name: "Built-in JS".to_string(),
            id: "com.cognia.builtin.js".to_string(),
            description: "desc".to_string(),
            author: "auth".to_string(),
            output_dir: "/repo/plugins".to_string(),
            license: None,
            repository: None,
            homepage: None,
            lifecycle_profile: ScaffoldLifecycleProfile::BuiltIn,
            language: PluginLanguage::JavaScript,
            permissions: ScaffoldPermissions::default(),
            include_ci: false,
            include_vscode: true,
            additional_keywords: Vec::new(),
            template_options: ScaffoldTemplateOptions::default(),
        };
        let result = validate_scaffold_config(&config);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_scaffold_config_rejects_builtin_framework_subdirectory_output() {
        let config = ScaffoldConfig {
            name: "Built-in TS".to_string(),
            id: "com.cognia.builtin.ts".to_string(),
            description: "desc".to_string(),
            author: "auth".to_string(),
            output_dir: "/repo/plugins/typescript".to_string(),
            license: None,
            repository: None,
            homepage: None,
            lifecycle_profile: ScaffoldLifecycleProfile::BuiltIn,
            language: PluginLanguage::TypeScript,
            permissions: ScaffoldPermissions::default(),
            include_ci: false,
            include_vscode: true,
            additional_keywords: Vec::new(),
            template_options: ScaffoldTemplateOptions::default(),
        };
        let result = validate_scaffold_config(&config);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("workspace root"));
    }

    #[test]
    fn test_validate_scaffold_config_rejects_invalid_id_characters() {
        let config = ScaffoldConfig {
            name: "Invalid ID".to_string(),
            id: "com.example.bad id".to_string(),
            description: "desc".to_string(),
            author: "auth".to_string(),
            output_dir: "/tmp".to_string(),
            license: None,
            repository: None,
            homepage: None,
            lifecycle_profile: ScaffoldLifecycleProfile::External,
            language: PluginLanguage::Rust,
            permissions: ScaffoldPermissions::default(),
            include_ci: false,
            include_vscode: true,
            additional_keywords: Vec::new(),
            template_options: ScaffoldTemplateOptions::default(),
        };
        let result = validate_scaffold_config(&config);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Invalid plugin id"));
    }

    #[test]
    fn test_build_scaffold_handoff_external_includes_import_path() {
        let config = ScaffoldConfig {
            name: "External".to_string(),
            id: "com.example.external".to_string(),
            description: "desc".to_string(),
            author: "auth".to_string(),
            output_dir: "/tmp".to_string(),
            license: None,
            repository: None,
            homepage: None,
            lifecycle_profile: ScaffoldLifecycleProfile::External,
            language: PluginLanguage::TypeScript,
            permissions: ScaffoldPermissions::default(),
            include_ci: false,
            include_vscode: true,
            additional_keywords: Vec::new(),
            template_options: ScaffoldTemplateOptions::default(),
        };

        let plugin_dir = PathBuf::from("/tmp/com.example.external");
        let handoff = build_scaffold_handoff(&config, &plugin_dir);
        assert!(matches!(
            handoff.profile,
            ScaffoldLifecycleProfile::External
        ));
        assert_eq!(
            handoff.import_path.as_deref(),
            Some("/tmp/com.example.external")
        );
        assert!(handoff.import_requires_build);
        assert!(handoff
            .build_commands
            .iter()
            .any(|cmd| cmd.contains("pnpm build")));
    }

    #[test]
    fn test_build_scaffold_handoff_builtin_includes_onboarding_metadata() {
        let config = ScaffoldConfig {
            name: "Built-in".to_string(),
            id: "com.cognia.builtin.sample".to_string(),
            description: "desc".to_string(),
            author: "auth".to_string(),
            output_dir: "/repo/plugins".to_string(),
            license: None,
            repository: None,
            homepage: None,
            lifecycle_profile: ScaffoldLifecycleProfile::BuiltIn,
            language: PluginLanguage::Rust,
            permissions: ScaffoldPermissions::default(),
            include_ci: false,
            include_vscode: true,
            additional_keywords: Vec::new(),
            template_options: ScaffoldTemplateOptions::default(),
        };

        let plugin_dir = PathBuf::from("/repo/plugins/rust/sample");
        let handoff = build_scaffold_handoff(&config, &plugin_dir);
        assert!(matches!(handoff.profile, ScaffoldLifecycleProfile::BuiltIn));
        assert!(handoff.import_path.is_none());
        assert_eq!(
            handoff.builtin_catalog_path.as_deref(),
            Some("plugins/manifest.json")
        );
        assert_eq!(
            handoff.builtin_validation_command.as_deref(),
            Some("pnpm plugins:validate")
        );
        assert!(handoff
            .next_steps
            .iter()
            .any(|step| step.contains("pnpm plugins:checksums")));
    }

    #[test]
    fn test_generate_wasm_build_script_replaces_flags() {
        let ts_script = generate_wasm_build_script(true, true);
        assert!(ts_script.contains("const WITH_BUNDLE = true;"));
        assert!(ts_script.contains("const WITH_INTERFACE = true;"));
        assert!(!ts_script.contains("__WITH_BUNDLE__"));
        assert!(!ts_script.contains("__WITH_INTERFACE__"));

        let js_script = generate_wasm_build_script(false, false);
        assert!(js_script.contains("const WITH_BUNDLE = false;"));
        assert!(js_script.contains("const WITH_INTERFACE = false;"));
    }

    #[tokio::test]
    async fn test_validate_plugin_reports_build_required_when_wasm_missing() {
        let dir = unique_temp_path("cognia_scaffold_validate_missing_wasm");
        fs::create_dir_all(&dir).expect("create temp dir");

        let mut config = base_scaffold_config(dir.to_string_lossy().as_ref());
        config.language = PluginLanguage::Rust;
        config.id = "com.example.validate".to_string();
        let manifest = generate_manifest(&config);
        fs::write(dir.join("plugin.toml"), manifest).expect("write manifest");

        let result = validate_plugin(&dir).await.expect("validate plugin");
        assert!(result.valid, "manifest is valid, only wasm is missing");
        assert!(!result.can_import);
        assert!(result.build_required);
        let expected_missing_path = dir.join("plugin.wasm").display().to_string();
        assert_eq!(
            result.missing_artifact_path.as_deref(),
            Some(expected_missing_path.as_str())
        );

        let _ = fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_scaffold_plugin_external_template_option_matrix() {
        let output_root = unique_temp_path("cognia_scaffold_matrix_external");
        fs::create_dir_all(&output_root).expect("create output root");

        let mut config = base_scaffold_config(output_root.to_string_lossy().as_ref());
        config.id = "com.example.matrix.external".to_string();
        config.template_options.include_unified_contract_samples = false;
        config.template_options.include_validation_guidance = false;
        config.template_options.include_starter_tests = false;

        let result = scaffold_plugin(&config).await.expect("scaffold plugin");
        let plugin_dir = PathBuf::from(&result.plugin_dir);

        assert!(plugin_dir.join("plugin.toml").exists());
        assert!(plugin_dir.join("README.md").exists());
        assert!(plugin_dir.join("cognia.scaffold.json").exists());
        assert!(!plugin_dir.join("contracts").exists());
        assert!(!plugin_dir.join("schemas").exists());
        assert!(!plugin_dir.join("docs").join("validation-guide.md").exists());
        assert!(!plugin_dir.join("tests").join("contract-validation.test.js").exists());
        assert!(result
            .files_created
            .iter()
            .all(|path| !path.starts_with("contracts/")));

        let _ = fs::remove_dir_all(&output_root);
    }

    #[tokio::test]
    async fn test_scaffold_plugin_builtin_handoff_and_catalog_artifacts() {
        let output_root = unique_temp_path("cognia_scaffold_matrix_builtin");
        fs::create_dir_all(&output_root).expect("create output root");

        let mut config = base_scaffold_config(output_root.to_string_lossy().as_ref());
        config.id = "com.cognia.builtin.matrix".to_string();
        config.lifecycle_profile = ScaffoldLifecycleProfile::BuiltIn;
        config.language = PluginLanguage::TypeScript;

        let result = scaffold_plugin(&config).await.expect("scaffold built-in plugin");
        let plugin_dir = PathBuf::from(&result.plugin_dir);

        assert!(plugin_dir.join("catalog-entry.sample.json").exists());
        assert!(plugin_dir.join("cognia.scaffold.json").exists());
        assert_eq!(
            result.handoff.builtin_catalog_path.as_deref(),
            Some("plugins/manifest.json")
        );
        assert_eq!(
            result.handoff.builtin_checksum_command.as_deref(),
            Some("pnpm plugins:checksums")
        );
        assert_eq!(
            result.handoff.builtin_validation_command.as_deref(),
            Some("pnpm plugins:validate")
        );
        assert!(result.handoff.import_path.is_none());
        assert!(result
            .handoff
            .next_steps
            .iter()
            .any(|step| step.contains("plugins/manifest.json")));

        let _ = fs::remove_dir_all(&output_root);
    }
}
