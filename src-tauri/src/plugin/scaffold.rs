use crate::error::{CogniaError, CogniaResult};
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
    #[serde(default = "default_language")]
    pub language: PluginLanguage,
    #[serde(default)]
    pub permissions: ScaffoldPermissions,
}

fn default_language() -> PluginLanguage {
    PluginLanguage::Rust
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

#[derive(Debug, Clone, Serialize, Deserialize)]
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

/// Result of scaffold operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScaffoldResult {
    pub plugin_dir: String,
    pub files_created: Vec<String>,
}

/// Result of plugin validation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

/// Generate a new plugin project from a ScaffoldConfig
pub async fn scaffold_plugin(config: &ScaffoldConfig) -> CogniaResult<ScaffoldResult> {
    let output = PathBuf::from(&config.output_dir);
    let plugin_dir = output.join(&config.id);

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
    tokio::fs::write(&manifest_path, &manifest).await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write plugin.toml: {}", e)))?;
    files_created.push("plugin.toml".to_string());

    // Generate locale files
    let locales_dir = plugin_dir.join("locales");
    tokio::fs::create_dir_all(&locales_dir).await
        .map_err(|e| CogniaError::Plugin(format!("Failed to create locales dir: {}", e)))?;

    let en_json = serde_json::json!({
        "toolName": format!("{} Tool", config.name),
        "toolDesc": format!("A tool provided by {}", config.name),
        "greeting": "Hello from {name}!",
    });
    tokio::fs::write(locales_dir.join("en.json"), serde_json::to_string_pretty(&en_json).unwrap()).await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write en.json: {}", e)))?;
    files_created.push("locales/en.json".to_string());

    let zh_json = serde_json::json!({
        "toolName": format!("{} 工具", config.name),
        "toolDesc": format!("由 {} 提供的工具", config.name),
        "greeting": "你好，来自 {name}！",
    });
    tokio::fs::write(locales_dir.join("zh.json"), serde_json::to_string_pretty(&zh_json).unwrap()).await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write zh.json: {}", e)))?;
    files_created.push("locales/zh.json".to_string());

    // Generate .gitignore
    let gitignore = "target/\n*.wasm\n";
    tokio::fs::write(plugin_dir.join(".gitignore"), gitignore).await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write .gitignore: {}", e)))?;
    files_created.push(".gitignore".to_string());

    // Generate language-specific files
    match config.language {
        PluginLanguage::Rust => {
            let extra = generate_rust_project(config, &plugin_dir).await?;
            files_created.extend(extra);
        }
        PluginLanguage::JavaScript => {
            let extra = generate_js_project(config, &plugin_dir).await?;
            files_created.extend(extra);
        }
        PluginLanguage::TypeScript => {
            let extra = generate_ts_project(config, &plugin_dir).await?;
            files_created.extend(extra);
        }
    }

    // Generate README.md
    let readme = generate_readme(config);
    tokio::fs::write(plugin_dir.join("README.md"), &readme).await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write README.md: {}", e)))?;
    files_created.push("README.md".to_string());

    Ok(ScaffoldResult {
        plugin_dir: plugin_dir.display().to_string(),
        files_created,
    })
}

/// Validate a plugin directory
pub async fn validate_plugin(path: &Path) -> CogniaResult<ValidationResult> {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // Check plugin.toml exists
    let manifest_path = path.join("plugin.toml");
    if !manifest_path.exists() {
        errors.push("Missing plugin.toml manifest file".to_string());
        return Ok(ValidationResult { valid: false, errors, warnings });
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
            let has_iframe = manifest.tools.iter().any(|t| {
                t.ui_mode == crate::plugin::manifest::UiMode::Iframe
            });
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
                warnings.push("Plugin requests config_write (dangerous, requires explicit user grant)".to_string());
            }
            if manifest.permissions.pkg_install {
                warnings.push("Plugin requests pkg_install (dangerous, requires explicit user grant)".to_string());
            }
            if manifest.permissions.process_exec {
                warnings.push("Plugin requests process_exec (dangerous, requires explicit user grant)".to_string());
            }
        }
        Err(e) => {
            errors.push(format!("Invalid plugin.toml: {}", e));
        }
    }

    Ok(ValidationResult {
        valid: errors.is_empty(),
        errors,
        warnings,
    })
}

// ============================================================================
// Template generators
// ============================================================================

fn generate_manifest(config: &ScaffoldConfig) -> String {
    let mut perms = Vec::new();
    if config.permissions.config_read { perms.push("config_read = true".to_string()); }
    if config.permissions.env_read { perms.push("env_read = true".to_string()); }
    if config.permissions.pkg_search { perms.push("pkg_search = true".to_string()); }
    if config.permissions.clipboard { perms.push("clipboard = true".to_string()); }
    if config.permissions.notification { perms.push("notification = true".to_string()); }
    if config.permissions.fs_read { perms.push("fs_read = [\"data/*\"]".to_string()); }
    if config.permissions.fs_write { perms.push("fs_write = [\"data/*\"]".to_string()); }
    if config.permissions.process_exec { perms.push("process_exec = true".to_string()); }
    if !config.permissions.http.is_empty() {
        let domains: Vec<String> = config.permissions.http.iter().map(|d| format!("\"{}\"", d)).collect();
        perms.push(format!("http = [{}]", domains.join(", ")));
    }

    let entry_fn = config.id.replace(['.', '-'], "_");
    format!(
        r#"[plugin]
id = "{id}"
name = "{name}"
version = "0.1.0"
description = "{desc}"
authors = ["{author}"]

[[tools]]
id = "{tool_id}"
name_en = "{name} Tool"
name_zh = "{name} 工具"
description_en = "{desc}"
description_zh = "{desc}"
category = "developer"
keywords = ["{tool_id}"]
icon = "Wrench"
entry = "{entry}"

[permissions]
{perms}
"#,
        id = config.id,
        name = config.name,
        desc = config.description,
        author = config.author,
        tool_id = config.id.split('.').last().unwrap_or(&config.id),
        entry = entry_fn,
        perms = perms.join("\n"),
    )
}

async fn generate_rust_project(config: &ScaffoldConfig, plugin_dir: &Path) -> CogniaResult<Vec<String>> {
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
    tokio::fs::write(plugin_dir.join("Cargo.toml"), &cargo_toml).await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write Cargo.toml: {}", e)))?;
    files.push("Cargo.toml".to_string());

    // .cargo/config.toml
    let cargo_dir = plugin_dir.join(".cargo");
    tokio::fs::create_dir_all(&cargo_dir).await
        .map_err(|e| CogniaError::Plugin(format!("Failed to create .cargo dir: {}", e)))?;
    let cargo_config = r#"[build]
target = "wasm32-unknown-unknown"
"#;
    tokio::fs::write(cargo_dir.join("config.toml"), cargo_config).await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write .cargo/config.toml: {}", e)))?;
    files.push(".cargo/config.toml".to_string());

    // src/lib.rs
    let src_dir = plugin_dir.join("src");
    tokio::fs::create_dir_all(&src_dir).await
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
    tokio::fs::write(src_dir.join("lib.rs"), &lib_rs).await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write src/lib.rs: {}", e)))?;
    files.push("src/lib.rs".to_string());

    Ok(files)
}

async fn generate_js_project(config: &ScaffoldConfig, plugin_dir: &Path) -> CogniaResult<Vec<String>> {
    let mut files = Vec::new();

    // package.json
    let package_json = serde_json::json!({
        "name": config.id,
        "version": "0.1.0",
        "description": config.description,
        "author": config.author,
        "scripts": {
            "build": "extism-js src/index.js -o plugin.wasm"
        },
        "devDependencies": {
            "@extism/js-pdk": "^1.1.1"
        }
    });
    tokio::fs::write(
        plugin_dir.join("package.json"),
        serde_json::to_string_pretty(&package_json).unwrap(),
    ).await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write package.json: {}", e)))?;
    files.push("package.json".to_string());

    // src/index.js
    let src_dir = plugin_dir.join("src");
    tokio::fs::create_dir_all(&src_dir).await
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
    tokio::fs::write(src_dir.join("index.js"), &index_js).await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write src/index.js: {}", e)))?;
    files.push("src/index.js".to_string());

    Ok(files)
}

async fn generate_ts_project(config: &ScaffoldConfig, plugin_dir: &Path) -> CogniaResult<Vec<String>> {
    let mut files = Vec::new();

    // package.json
    let package_json = serde_json::json!({
        "name": config.id,
        "version": "0.1.0",
        "description": config.description,
        "author": config.author,
        "scripts": {
            "build": "node esbuild.config.mjs && extism-js dist/plugin.js -i plugin.d.ts -o plugin.wasm",
            "bundle": "node esbuild.config.mjs"
        },
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
    ).await
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
    ).await
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
  external: [],
});
"#;
    tokio::fs::write(plugin_dir.join("esbuild.config.mjs"), esbuild_config).await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write esbuild.config.mjs: {}", e)))?;
    files.push("esbuild.config.mjs".to_string());

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
    tokio::fs::write(plugin_dir.join("plugin.d.ts"), &plugin_dts).await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write plugin.d.ts: {}", e)))?;
    files.push("plugin.d.ts".to_string());

    // src/index.ts — main plugin source
    let src_dir = plugin_dir.join("src");
    tokio::fs::create_dir_all(&src_dir).await
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
    tokio::fs::write(src_dir.join("index.ts"), &index_ts).await
        .map_err(|e| CogniaError::Plugin(format!("Failed to write src/index.ts: {}", e)))?;
    files.push("src/index.ts".to_string());

    Ok(files)
}

fn generate_readme(config: &ScaffoldConfig) -> String {
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
```"#.to_string(),
        PluginLanguage::JavaScript => r#"## Build

```bash
# Install dependencies
pnpm install

# Build the plugin
pnpm build
```"#.to_string(),
        PluginLanguage::TypeScript => r#"## Build

```bash
# Install dependencies
pnpm install

# Bundle TypeScript and compile to WASM
pnpm build
```"#.to_string(),
    };

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
"#,
        name = config.name,
        desc = config.description,
        build = build_instructions,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_manifest() {
        let config = ScaffoldConfig {
            name: "Test Plugin".to_string(),
            id: "com.example.test".to_string(),
            description: "A test plugin".to_string(),
            author: "Test Author".to_string(),
            output_dir: "/tmp".to_string(),
            language: PluginLanguage::Rust,
            permissions: ScaffoldPermissions {
                config_read: true,
                env_read: true,
                ..Default::default()
            },
        };
        let manifest = generate_manifest(&config);
        assert!(manifest.contains("id = \"com.example.test\""));
        assert!(manifest.contains("config_read = true"));
        assert!(manifest.contains("env_read = true"));
        assert!(manifest.contains("entry = \"com_example_test\""));
    }

    #[test]
    fn test_scaffold_config_default_language() {
        let json = r#"{"name":"T","id":"t","description":"d","author":"a","outputDir":"/tmp"}"#;
        let config: ScaffoldConfig = serde_json::from_str(json).unwrap();
        matches!(config.language, PluginLanguage::Rust);
    }

    #[test]
    fn test_generate_readme_rust() {
        let config = ScaffoldConfig {
            name: "My Plugin".to_string(),
            id: "com.example.my".to_string(),
            description: "desc".to_string(),
            author: "auth".to_string(),
            output_dir: "/tmp".to_string(),
            language: PluginLanguage::Rust,
            permissions: ScaffoldPermissions::default(),
        };
        let readme = generate_readme(&config);
        assert!(readme.contains("# My Plugin"));
        assert!(readme.contains("cargo build"));
    }

    #[test]
    fn test_scaffold_config_typescript_language() {
        let json = r#"{"name":"T","id":"t","description":"d","author":"a","outputDir":"/tmp","language":"typescript"}"#;
        let config: ScaffoldConfig = serde_json::from_str(json).unwrap();
        matches!(config.language, PluginLanguage::TypeScript);
    }

    #[test]
    fn test_generate_readme_ts() {
        let config = ScaffoldConfig {
            name: "TS Plugin".to_string(),
            id: "com.example.ts".to_string(),
            description: "desc".to_string(),
            author: "auth".to_string(),
            output_dir: "/tmp".to_string(),
            language: PluginLanguage::TypeScript,
            permissions: ScaffoldPermissions::default(),
        };
        let readme = generate_readme(&config);
        assert!(readme.contains("pnpm build"));
        assert!(readme.contains("TypeScript"));
    }

    #[test]
    fn test_generate_readme_js() {
        let config = ScaffoldConfig {
            name: "JS Plugin".to_string(),
            id: "com.example.js".to_string(),
            description: "desc".to_string(),
            author: "auth".to_string(),
            output_dir: "/tmp".to_string(),
            language: PluginLanguage::JavaScript,
            permissions: ScaffoldPermissions::default(),
        };
        let readme = generate_readme(&config);
        assert!(readme.contains("pnpm build"));
    }
}
