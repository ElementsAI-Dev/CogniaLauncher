use crate::error::{CogniaError, CogniaResult};
use crate::platform::fs;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Custom detection rule for environment version detection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomDetectionRule {
    /// Unique identifier for the rule
    pub id: String,
    /// Human-readable name
    pub name: String,
    /// Description of what this rule detects
    pub description: Option<String>,
    /// Environment type this rule applies to (node, python, go, rust, ruby, java, etc.)
    pub env_type: String,
    /// Priority (higher = checked first, default = 0)
    #[serde(default)]
    pub priority: i32,
    /// Whether this rule is enabled
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// File patterns to match (glob patterns)
    pub file_patterns: Vec<String>,
    /// Extraction strategy
    pub extraction: ExtractionStrategy,
    /// Optional version transformation/normalization
    pub version_transform: Option<VersionTransform>,
    /// Tags for organization
    #[serde(default)]
    pub tags: Vec<String>,
    /// Created timestamp
    pub created_at: Option<String>,
    /// Last modified timestamp
    pub updated_at: Option<String>,
}

fn default_true() -> bool {
    true
}

/// Strategy for extracting version from matched file
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ExtractionStrategy {
    /// Extract version using regex pattern with named capture group "version"
    Regex {
        /// Regex pattern with (?P<version>...) capture group
        pattern: String,
        /// If true, search entire file; if false, only first match
        #[serde(default)]
        multiline: bool,
    },
    /// Extract from JSON file using JSONPath-like expression
    JsonPath {
        /// Path expression like "engines.node" or "dependencies.typescript"
        path: String,
    },
    /// Extract from TOML file using dotted path
    TomlPath {
        /// Path expression like "tool.python.version" or "package.version"
        path: String,
    },
    /// Extract from YAML file using dotted path
    YamlPath {
        /// Path expression like "runtime.version"
        path: String,
    },
    /// Extract from XML using simple tag path
    XmlPath {
        /// Tag path like "project.properties.java.version"
        path: String,
    },
    /// Read entire file content as version (for simple version files)
    PlainText {
        /// Optional prefix to strip (e.g., "python-" for runtime.txt)
        strip_prefix: Option<String>,
        /// Optional suffix to strip
        strip_suffix: Option<String>,
    },
    /// Extract from .tool-versions format
    ToolVersions {
        /// Tool name to look for (e.g., "nodejs", "python")
        tool_name: String,
    },
    /// Extract from INI/properties file
    IniKey {
        /// Section name (optional)
        section: Option<String>,
        /// Key name
        key: String,
    },
    /// Run a command and extract version from output
    Command {
        /// Command to run
        cmd: String,
        /// Arguments
        args: Vec<String>,
        /// Regex to extract version from output
        output_pattern: String,
    },
}

/// Optional version transformation after extraction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionTransform {
    /// Regex to match parts of the version
    pub match_pattern: Option<String>,
    /// Replacement template using $1, $2, etc. or named groups
    pub replace_template: Option<String>,
    /// Strip common prefixes like "v", "V", "version-"
    #[serde(default)]
    pub strip_version_prefix: bool,
    /// Normalize to semver format if possible
    #[serde(default)]
    pub normalize_semver: bool,
}

/// Result of custom rule evaluation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomDetectionResult {
    pub rule_id: String,
    pub rule_name: String,
    pub env_type: String,
    pub version: String,
    pub source_file: PathBuf,
    pub raw_version: String,
}

/// Manager for custom detection rules
pub struct CustomDetectionManager {
    rules: Vec<CustomDetectionRule>,
    config_path: PathBuf,
}

impl CustomDetectionManager {
    pub fn new(config_dir: &Path) -> Self {
        Self {
            rules: Vec::new(),
            config_path: config_dir.join("custom_detection_rules.json"),
        }
    }

    /// Load rules from config file
    pub async fn load(&mut self) -> CogniaResult<()> {
        if self.config_path.exists() {
            let content = fs::read_file_string(&self.config_path).await?;
            self.rules = serde_json::from_str(&content)
                .map_err(|e| CogniaError::Config(format!("Failed to parse custom rules: {}", e)))?;
        }
        Ok(())
    }

    /// Save rules to config file
    pub async fn save(&self) -> CogniaResult<()> {
        let content = serde_json::to_string_pretty(&self.rules)
            .map_err(|e| CogniaError::Config(format!("Failed to serialize rules: {}", e)))?;
        fs::write_file_string(&self.config_path, &content).await?;
        Ok(())
    }

    /// Get all rules
    pub fn list_rules(&self) -> &[CustomDetectionRule] {
        &self.rules
    }

    /// Get rules for a specific environment type
    pub fn get_rules_for_env(&self, env_type: &str) -> Vec<&CustomDetectionRule> {
        let mut rules: Vec<_> = self
            .rules
            .iter()
            .filter(|r| r.enabled && r.env_type == env_type)
            .collect();
        rules.sort_by(|a, b| b.priority.cmp(&a.priority));
        rules
    }

    /// Add a new rule
    pub fn add_rule(&mut self, rule: CustomDetectionRule) -> CogniaResult<()> {
        if self.rules.iter().any(|r| r.id == rule.id) {
            return Err(CogniaError::Config(format!(
                "Rule with ID '{}' already exists",
                rule.id
            )));
        }
        self.rules.push(rule);
        Ok(())
    }

    /// Update an existing rule
    pub fn update_rule(&mut self, rule: CustomDetectionRule) -> CogniaResult<()> {
        if let Some(existing) = self.rules.iter_mut().find(|r| r.id == rule.id) {
            *existing = rule;
            Ok(())
        } else {
            Err(CogniaError::Config(format!("Rule '{}' not found", rule.id)))
        }
    }

    /// Delete a rule
    pub fn delete_rule(&mut self, rule_id: &str) -> CogniaResult<()> {
        let initial_len = self.rules.len();
        self.rules.retain(|r| r.id != rule_id);
        if self.rules.len() == initial_len {
            Err(CogniaError::Config(format!("Rule '{}' not found", rule_id)))
        } else {
            Ok(())
        }
    }

    /// Get a rule by ID
    pub fn get_rule(&self, rule_id: &str) -> Option<&CustomDetectionRule> {
        self.rules.iter().find(|r| r.id == rule_id)
    }

    /// Detect version using custom rules for a specific environment
    pub async fn detect(
        &self,
        env_type: &str,
        start_path: &Path,
    ) -> CogniaResult<Option<CustomDetectionResult>> {
        let rules = self.get_rules_for_env(env_type);

        for rule in rules {
            if let Some(result) = self.evaluate_rule(rule, start_path).await? {
                return Ok(Some(result));
            }
        }

        Ok(None)
    }

    /// Detect all versions in a directory using custom rules
    pub async fn detect_all(&self, start_path: &Path) -> CogniaResult<Vec<CustomDetectionResult>> {
        let mut results = Vec::new();
        let mut detected_envs = std::collections::HashSet::new();

        // Sort all rules by priority
        let mut all_rules: Vec<_> = self.rules.iter().filter(|r| r.enabled).collect();
        all_rules.sort_by(|a, b| b.priority.cmp(&a.priority));

        for rule in all_rules {
            // Skip if we already detected this env type
            if detected_envs.contains(&rule.env_type) {
                continue;
            }

            if let Some(result) = self.evaluate_rule(rule, start_path).await? {
                detected_envs.insert(rule.env_type.clone());
                results.push(result);
            }
        }

        Ok(results)
    }

    /// Evaluate a single rule against a path
    async fn evaluate_rule(
        &self,
        rule: &CustomDetectionRule,
        start_path: &Path,
    ) -> CogniaResult<Option<CustomDetectionResult>> {
        // Walk up directory tree
        let mut current = start_path.to_path_buf();

        loop {
            for pattern in &rule.file_patterns {
                // Check if file matches pattern
                if let Some(matched_file) = self.match_file_pattern(&current, pattern).await? {
                    // Try to extract version
                    if let Some(raw_version) = self
                        .extract_version(&matched_file, &rule.extraction)
                        .await?
                    {
                        let version = self.transform_version(&raw_version, &rule.version_transform);

                        if !version.is_empty() {
                            return Ok(Some(CustomDetectionResult {
                                rule_id: rule.id.clone(),
                                rule_name: rule.name.clone(),
                                env_type: rule.env_type.clone(),
                                version,
                                source_file: matched_file,
                                raw_version,
                            }));
                        }
                    }
                }
            }

            if !current.pop() {
                break;
            }
        }

        Ok(None)
    }

    /// Match file pattern in directory
    async fn match_file_pattern(&self, dir: &Path, pattern: &str) -> CogniaResult<Option<PathBuf>> {
        // Handle simple filename patterns
        let file_path = dir.join(pattern);
        if file_path.exists() {
            return Ok(Some(file_path));
        }

        // Handle glob patterns (basic support)
        if pattern.contains('*') || pattern.contains('?') {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let file_name = entry.file_name().to_string_lossy().to_string();
                    if glob_match(pattern, &file_name) {
                        return Ok(Some(entry.path()));
                    }
                }
            }
        }

        Ok(None)
    }

    /// Extract version using the specified strategy
    async fn extract_version(
        &self,
        file_path: &Path,
        strategy: &ExtractionStrategy,
    ) -> CogniaResult<Option<String>> {
        match strategy {
            ExtractionStrategy::Regex { pattern, multiline } => {
                self.extract_regex(file_path, pattern, *multiline).await
            }
            ExtractionStrategy::JsonPath { path } => self.extract_json_path(file_path, path).await,
            ExtractionStrategy::TomlPath { path } => self.extract_toml_path(file_path, path).await,
            ExtractionStrategy::YamlPath { path } => self.extract_yaml_path(file_path, path).await,
            ExtractionStrategy::XmlPath { path } => self.extract_xml_path(file_path, path).await,
            ExtractionStrategy::PlainText {
                strip_prefix,
                strip_suffix,
            } => {
                self.extract_plain_text(file_path, strip_prefix.as_deref(), strip_suffix.as_deref())
                    .await
            }
            ExtractionStrategy::ToolVersions { tool_name } => {
                self.extract_tool_versions(file_path, tool_name).await
            }
            ExtractionStrategy::IniKey { section, key } => {
                self.extract_ini_key(file_path, section.as_deref(), key)
                    .await
            }
            ExtractionStrategy::Command {
                cmd,
                args,
                output_pattern,
            } => self.extract_command(cmd, args, output_pattern).await,
        }
    }

    async fn extract_regex(
        &self,
        file_path: &Path,
        pattern: &str,
        multiline: bool,
    ) -> CogniaResult<Option<String>> {
        let content = fs::read_file_string(file_path).await?;

        let regex = if multiline {
            Regex::new(&format!("(?m){}", pattern))
        } else {
            Regex::new(pattern)
        };

        let re = regex.map_err(|e| CogniaError::Config(format!("Invalid regex: {}", e)))?;

        if let Some(caps) = re.captures(&content) {
            // Try named group "version" first
            if let Some(m) = caps.name("version") {
                return Ok(Some(m.as_str().to_string()));
            }
            // Fall back to first capture group
            if let Some(m) = caps.get(1) {
                return Ok(Some(m.as_str().to_string()));
            }
        }

        Ok(None)
    }

    async fn extract_json_path(
        &self,
        file_path: &Path,
        path: &str,
    ) -> CogniaResult<Option<String>> {
        let content = fs::read_file_string(file_path).await?;
        let json: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| CogniaError::Config(format!("Invalid JSON: {}", e)))?;

        let mut current = &json;
        for key in path.split('.') {
            current = match current.get(key) {
                Some(v) => v,
                None => return Ok(None),
            };
        }

        match current {
            serde_json::Value::String(s) => Ok(Some(s.clone())),
            serde_json::Value::Number(n) => Ok(Some(n.to_string())),
            _ => Ok(None),
        }
    }

    async fn extract_toml_path(
        &self,
        file_path: &Path,
        path: &str,
    ) -> CogniaResult<Option<String>> {
        let content = fs::read_file_string(file_path).await?;
        let toml: toml::Value = content
            .parse()
            .map_err(|e| CogniaError::Config(format!("Invalid TOML: {}", e)))?;

        let mut current = &toml;
        for key in path.split('.') {
            current = match current.get(key) {
                Some(v) => v,
                None => return Ok(None),
            };
        }

        match current {
            toml::Value::String(s) => Ok(Some(s.clone())),
            toml::Value::Integer(n) => Ok(Some(n.to_string())),
            toml::Value::Float(f) => Ok(Some(f.to_string())),
            _ => Ok(None),
        }
    }

    async fn extract_yaml_path(
        &self,
        file_path: &Path,
        path: &str,
    ) -> CogniaResult<Option<String>> {
        let content = fs::read_file_string(file_path).await?;
        let yaml: serde_yaml::Value = serde_yaml::from_str(&content)
            .map_err(|e| CogniaError::Config(format!("Invalid YAML: {}", e)))?;

        let mut current = &yaml;
        for key in path.split('.') {
            current = match current.get(key) {
                Some(v) => v,
                None => return Ok(None),
            };
        }

        match current {
            serde_yaml::Value::String(s) => Ok(Some(s.clone())),
            serde_yaml::Value::Number(n) => Ok(Some(n.to_string())),
            _ => Ok(None),
        }
    }

    async fn extract_xml_path(&self, file_path: &Path, path: &str) -> CogniaResult<Option<String>> {
        let content = fs::read_file_string(file_path).await?;

        // Simple XML extraction using regex (for basic cases)
        let tags: Vec<&str> = path.split('.').collect();
        if let Some(last_tag) = tags.last() {
            let pattern = format!(r"<{}>([^<]+)</{}>", last_tag, last_tag);
            if let Ok(re) = Regex::new(&pattern) {
                if let Some(caps) = re.captures(&content) {
                    if let Some(m) = caps.get(1) {
                        return Ok(Some(m.as_str().trim().to_string()));
                    }
                }
            }
        }

        Ok(None)
    }

    async fn extract_plain_text(
        &self,
        file_path: &Path,
        strip_prefix: Option<&str>,
        strip_suffix: Option<&str>,
    ) -> CogniaResult<Option<String>> {
        let content = fs::read_file_string(file_path).await?;
        let mut version = content.trim().to_string();

        if let Some(prefix) = strip_prefix {
            if let Some(stripped) = version.strip_prefix(prefix) {
                version = stripped.to_string();
            }
        }

        if let Some(suffix) = strip_suffix {
            if let Some(stripped) = version.strip_suffix(suffix) {
                version = stripped.to_string();
            }
        }

        if version.is_empty() {
            Ok(None)
        } else {
            Ok(Some(version))
        }
    }

    async fn extract_tool_versions(
        &self,
        file_path: &Path,
        tool_name: &str,
    ) -> CogniaResult<Option<String>> {
        let content = fs::read_file_string(file_path).await?;

        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }

            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 && parts[0] == tool_name {
                return Ok(Some(parts[1].to_string()));
            }
        }

        Ok(None)
    }

    async fn extract_ini_key(
        &self,
        file_path: &Path,
        section: Option<&str>,
        key: &str,
    ) -> CogniaResult<Option<String>> {
        let content = fs::read_file_string(file_path).await?;
        let mut in_section = section.is_none();

        for line in content.lines() {
            let line = line.trim();

            // Check for section header
            if line.starts_with('[') && line.ends_with(']') {
                let current_section = &line[1..line.len() - 1];
                in_section = section.map_or(true, |s| s == current_section);
                continue;
            }

            if in_section && line.contains('=') {
                let parts: Vec<&str> = line.splitn(2, '=').collect();
                if parts.len() == 2 && parts[0].trim() == key {
                    return Ok(Some(parts[1].trim().to_string()));
                }
            }
        }

        Ok(None)
    }

    async fn extract_command(
        &self,
        cmd: &str,
        args: &[String],
        output_pattern: &str,
    ) -> CogniaResult<Option<String>> {
        use crate::platform::process;

        let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        let output = process::execute(cmd, &args_ref, None).await?;

        let text = if output.stdout.is_empty() {
            &output.stderr
        } else {
            &output.stdout
        };

        let re = Regex::new(output_pattern)
            .map_err(|e| CogniaError::Config(format!("Invalid output pattern: {}", e)))?;

        if let Some(caps) = re.captures(text) {
            if let Some(m) = caps.name("version").or_else(|| caps.get(1)) {
                return Ok(Some(m.as_str().to_string()));
            }
        }

        Ok(None)
    }

    /// Transform extracted version
    fn transform_version(&self, version: &str, transform: &Option<VersionTransform>) -> String {
        let mut result = version.trim().to_string();

        if let Some(t) = transform {
            // Strip version prefix
            if t.strip_version_prefix {
                result = result
                    .strip_prefix('v')
                    .or_else(|| result.strip_prefix('V'))
                    .or_else(|| result.strip_prefix("version-"))
                    .or_else(|| result.strip_prefix("version "))
                    .unwrap_or(&result)
                    .to_string();
            }

            // Apply regex transformation
            if let (Some(pattern), Some(template)) = (&t.match_pattern, &t.replace_template) {
                if let Ok(re) = Regex::new(pattern) {
                    result = re.replace(&result, template).to_string();
                }
            }

            // Normalize to semver (basic)
            if t.normalize_semver {
                result = normalize_semver(&result);
            }
        }

        result
    }
}

/// Simple glob pattern matching
fn glob_match(pattern: &str, text: &str) -> bool {
    let pattern = pattern.replace('.', "\\.");
    let pattern = pattern.replace('*', ".*");
    let pattern = pattern.replace('?', ".");
    let pattern = format!("^{}$", pattern);

    Regex::new(&pattern)
        .map(|re| re.is_match(text))
        .unwrap_or(false)
}

/// Basic semver normalization
fn normalize_semver(version: &str) -> String {
    let re = Regex::new(r"^(\d+)(?:\.(\d+))?(?:\.(\d+))?").unwrap();

    if let Some(caps) = re.captures(version) {
        let major = caps.get(1).map_or("0", |m| m.as_str());
        let minor = caps.get(2).map_or("0", |m| m.as_str());
        let patch = caps.get(3).map_or("0", |m| m.as_str());
        format!("{}.{}.{}", major, minor, patch)
    } else {
        version.to_string()
    }
}

/// Create default/preset rules for common use cases
pub fn create_preset_rules() -> Vec<CustomDetectionRule> {
    vec![
        // Dockerfile ARG/ENV version
        CustomDetectionRule {
            id: "dockerfile-node".to_string(),
            name: "Dockerfile Node Version".to_string(),
            description: Some("Extract Node.js version from Dockerfile ARG/ENV".to_string()),
            env_type: "node".to_string(),
            priority: 5,
            enabled: false,
            file_patterns: vec!["Dockerfile".to_string(), "Dockerfile.*".to_string()],
            extraction: ExtractionStrategy::Regex {
                pattern: r#"(?:ARG|ENV)\s+NODE_VERSION[=\s]+["']?(?P<version>[\d.]+)"#.to_string(),
                multiline: true,
            },
            version_transform: Some(VersionTransform {
                match_pattern: None,
                replace_template: None,
                strip_version_prefix: true,
                normalize_semver: false,
            }),
            tags: vec!["docker".to_string(), "preset".to_string()],
            created_at: None,
            updated_at: None,
        },
        // .nvmrc with lts/* format
        CustomDetectionRule {
            id: "nvmrc-lts".to_string(),
            name: "nvmrc LTS Version".to_string(),
            description: Some("Handle .nvmrc files with lts/* or lts/name format".to_string()),
            env_type: "node".to_string(),
            priority: 10,
            enabled: false,
            file_patterns: vec![".nvmrc".to_string()],
            extraction: ExtractionStrategy::Regex {
                pattern: r"^lts/(?P<version>\w+)".to_string(),
                multiline: false,
            },
            version_transform: None,
            tags: vec!["nvm".to_string(), "preset".to_string()],
            created_at: None,
            updated_at: None,
        },
        // GitHub Actions workflow Node version
        CustomDetectionRule {
            id: "github-actions-node".to_string(),
            name: "GitHub Actions Node Version".to_string(),
            description: Some("Extract Node.js version from GitHub Actions workflow".to_string()),
            env_type: "node".to_string(),
            priority: 3,
            enabled: false,
            file_patterns: vec![".github/workflows/*.yml".to_string(), ".github/workflows/*.yaml".to_string()],
            extraction: ExtractionStrategy::Regex {
                pattern: r#"node-version:\s*["']?(?P<version>[\d.x]+)"#.to_string(),
                multiline: true,
            },
            version_transform: Some(VersionTransform {
                match_pattern: None,
                replace_template: None,
                strip_version_prefix: true,
                normalize_semver: false,
            }),
            tags: vec!["github-actions".to_string(), "ci".to_string(), "preset".to_string()],
            created_at: None,
            updated_at: None,
        },
        // Pipfile python_version
        CustomDetectionRule {
            id: "pipfile-python".to_string(),
            name: "Pipfile Python Version".to_string(),
            description: Some("Extract Python version from Pipfile".to_string()),
            env_type: "python".to_string(),
            priority: 8,
            enabled: false,
            file_patterns: vec!["Pipfile".to_string()],
            extraction: ExtractionStrategy::Regex {
                pattern: r#"python_version\s*=\s*["'](?P<version>[\d.]+)["']"#.to_string(),
                multiline: true,
            },
            version_transform: None,
            tags: vec!["pipenv".to_string(), "preset".to_string()],
            created_at: None,
            updated_at: None,
        },
        // .python-version with multiple versions
        CustomDetectionRule {
            id: "python-version-first".to_string(),
            name: "Python Version (First)".to_string(),
            description: Some("Extract first Python version from .python-version".to_string()),
            env_type: "python".to_string(),
            priority: 15,
            enabled: false,
            file_patterns: vec![".python-version".to_string()],
            extraction: ExtractionStrategy::Regex {
                pattern: r"^(?P<version>[\d.]+)".to_string(),
                multiline: false,
            },
            version_transform: None,
            tags: vec!["pyenv".to_string(), "preset".to_string()],
            created_at: None,
            updated_at: None,
        },
        // Cargo.toml rust-version
        CustomDetectionRule {
            id: "cargo-rust-version".to_string(),
            name: "Cargo.toml Rust Version".to_string(),
            description: Some("Extract minimum Rust version from Cargo.toml".to_string()),
            env_type: "rust".to_string(),
            priority: 5,
            enabled: false,
            file_patterns: vec!["Cargo.toml".to_string()],
            extraction: ExtractionStrategy::TomlPath {
                path: "package.rust-version".to_string(),
            },
            version_transform: None,
            tags: vec!["cargo".to_string(), "preset".to_string()],
            created_at: None,
            updated_at: None,
        },
        // gradle.properties java version
        CustomDetectionRule {
            id: "gradle-java".to_string(),
            name: "Gradle Java Version".to_string(),
            description: Some("Extract Java version from gradle.properties".to_string()),
            env_type: "java".to_string(),
            priority: 5,
            enabled: false,
            file_patterns: vec!["gradle.properties".to_string()],
            extraction: ExtractionStrategy::IniKey {
                section: None,
                key: "java.version".to_string(),
            },
            version_transform: None,
            tags: vec!["gradle".to_string(), "preset".to_string()],
            created_at: None,
            updated_at: None,
        },
        // build.gradle sourceCompatibility
        CustomDetectionRule {
            id: "gradle-source-compat".to_string(),
            name: "Gradle Source Compatibility".to_string(),
            description: Some("Extract Java version from build.gradle sourceCompatibility".to_string()),
            env_type: "java".to_string(),
            priority: 4,
            enabled: false,
            file_patterns: vec!["build.gradle".to_string(), "build.gradle.kts".to_string()],
            extraction: ExtractionStrategy::Regex {
                pattern: r#"sourceCompatibility\s*=\s*["']?(?:JavaVersion\.VERSION_)?(?P<version>[\d._]+)"#.to_string(),
                multiline: true,
            },
            version_transform: Some(VersionTransform {
                match_pattern: Some(r"_".to_string()),
                replace_template: Some(".".to_string()),
                strip_version_prefix: false,
                normalize_semver: false,
            }),
            tags: vec!["gradle".to_string(), "preset".to_string()],
            created_at: None,
            updated_at: None,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_glob_match() {
        assert!(glob_match("*.json", "package.json"));
        assert!(glob_match("Dockerfile*", "Dockerfile.dev"));
        assert!(glob_match(".?nvmrc", ".nvmrc"));
        assert!(!glob_match("*.json", "package.yaml"));
    }

    #[test]
    fn test_normalize_semver() {
        assert_eq!(normalize_semver("18"), "18.0.0");
        assert_eq!(normalize_semver("18.17"), "18.17.0");
        assert_eq!(normalize_semver("18.17.1"), "18.17.1");
        assert_eq!(normalize_semver("v3.11"), "3.11.0");
    }

    #[test]
    fn test_preset_rules() {
        let presets = create_preset_rules();
        assert!(!presets.is_empty());

        // Check that all presets have required fields
        for rule in presets {
            assert!(!rule.id.is_empty());
            assert!(!rule.name.is_empty());
            assert!(!rule.env_type.is_empty());
            assert!(!rule.file_patterns.is_empty());
        }
    }
}
