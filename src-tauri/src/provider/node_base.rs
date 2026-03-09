use crate::error::{CogniaError, CogniaResult};
use crate::platform::process;
use crate::provider::InstallReceipt;
use std::collections::HashSet;
use std::path::PathBuf;

/// Common utilities for Node.js-based package managers (npm, pnpm, yarn)
pub struct NodeProviderUtils;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NodeOutdatedEntry {
    pub name: String,
    pub current: String,
    pub latest: String,
}

pub fn normalize_node_provider_id(input: &str) -> String {
    input.trim().to_ascii_lowercase()
}

pub fn normalize_node_package_name(input: &str) -> String {
    input.trim().to_ascii_lowercase()
}

/// Split a "name@version" string into (name, version), correctly handling
/// npm scoped packages like `@scope/name@version`.
///
/// Uses `rfind('@')` to locate the version separator (the LAST `@`).
/// For scoped packages, the first `@` is part of the scope, not a version separator.
///
/// # Examples
/// - `"lodash@4.17.21"` → `("lodash", Some("4.17.21"))`
/// - `"@types/node@18.0.0"` → `("@types/node", Some("18.0.0"))`
/// - `"@types/node"` → `("@types/node", None)`
/// - `"lodash"` → `("lodash", None)`
/// - `""` → `("", None)`
pub fn split_name_version(input: &str) -> (&str, Option<&str>) {
    let input = input.trim();
    if input.is_empty() {
        return ("", None);
    }

    // rfind('@') finds the LAST '@' — the version separator.
    // For "@scope/name@version", rfind returns the index of the second '@'.
    // For "@scope/name" (no version), rfind returns index 0 (the scope '@').
    // For "name@version", rfind returns the only '@'.
    if let Some(at_pos) = input.rfind('@') {
        // If at_pos == 0, the only '@' is the scope prefix → no version
        if at_pos == 0 {
            return (input, None);
        }
        let name = &input[..at_pos];
        let version = &input[at_pos + 1..];
        // If version is empty (trailing '@'), treat as no version
        if version.is_empty() {
            (input, None)
        } else {
            (name, Some(version))
        }
    } else {
        (input, None)
    }
}

/// Parse one line of Node package manager list output into `(name, version)`.
///
/// Supports tree-style entries like:
/// - `├── eslint@9.17.0`
/// - `└── @types/node@22.10.1`
///
/// Rejects noisy/non-package lines such as:
/// - banners (`bun pm ls v1.x`, `yarn global v1.x`)
/// - path/count rows (`C:\...\node_modules (174)`)
/// - rows without explicit `@version`
pub fn parse_node_list_entry(line: &str) -> Option<(String, String)> {
    let line = line.trim();
    if line.is_empty() {
        return None;
    }

    // Strip leading tree drawing / punctuation while preserving scoped-package '@'.
    let clean = line.trim_start_matches(|c: char| !c.is_alphanumeric() && c != '@');
    if clean.is_empty() {
        return None;
    }

    // Keep first token only; trailing annotations are not part of package spec.
    let token = clean.split_whitespace().next().unwrap_or("");
    let (pkg_name, pkg_version) = split_name_version(token);
    let version = pkg_version?;

    // Accept only valid package-name shapes:
    // - unscoped: `name`
    // - scoped: `@scope/name`
    let is_scoped_pkg = pkg_name.starts_with('@') && pkg_name.matches('/').count() == 1;
    let is_unscoped_pkg = !pkg_name.contains('/');
    if !(is_scoped_pkg || is_unscoped_pkg) {
        return None;
    }

    // Filter obvious path-like names.
    if pkg_name.contains('\\') || pkg_name.contains(':') {
        return None;
    }

    Some((pkg_name.to_string(), version.to_string()))
}

fn parse_installed_version_field(info: &serde_json::Value) -> Option<String> {
    if let Some(version) = info.get("version").and_then(|v| v.as_str()) {
        return Some(version.trim().to_string());
    }

    info.as_str().map(|s| s.trim().to_string())
}

fn collect_installed_dependency_maps<'a>(
    value: &'a serde_json::Value,
    maps: &mut Vec<&'a serde_json::Map<String, serde_json::Value>>,
) {
    match value {
        serde_json::Value::Object(obj) => {
            if let Some(deps) = obj.get("dependencies").and_then(|v| v.as_object()) {
                maps.push(deps);
            }

            if let Some(data) = obj.get("data") {
                collect_installed_dependency_maps(data, maps);
            }
            if let Some(result) = obj.get("result") {
                collect_installed_dependency_maps(result, maps);
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr {
                collect_installed_dependency_maps(item, maps);
            }
        }
        serde_json::Value::String(_) => {}
        _ => {}
    }
}

pub fn parse_installed_packages_from_value(value: &serde_json::Value) -> Vec<(String, String)> {
    let mut dependency_maps = Vec::new();
    collect_installed_dependency_maps(value, &mut dependency_maps);

    let mut entries = Vec::new();
    let mut seen = HashSet::new();

    for deps in dependency_maps {
        for (name, info) in deps {
            let Some(version) = parse_installed_version_field(info) else {
                continue;
            };
            if version.is_empty() {
                continue;
            }

            let key = format!("{}@{}", normalize_node_package_name(name), version);
            if seen.insert(key) {
                entries.push((name.to_string(), version));
            }
        }
    }

    entries
}

pub fn parse_installed_packages_from_json_output(
    output: &str,
) -> CogniaResult<Vec<(String, String)>> {
    let value = serde_json::from_str::<serde_json::Value>(output).map_err(|err| {
        CogniaError::Provider(format!(
            "failed to parse installed packages output as JSON: {}",
            err
        ))
    })?;

    Ok(parse_installed_packages_from_value(&value))
}

fn collect_dependency_pairs(value: &serde_json::Value, pairs: &mut Vec<(String, String)>) {
    match value {
        serde_json::Value::Object(obj) => {
            if let Some(deps) = obj.get("dependencies") {
                collect_dependency_pairs(deps, pairs);
                return;
            }

            let mut used_nested_payload = false;
            for nested in ["data", "result", "value"] {
                if let Some(next) = obj.get(nested) {
                    used_nested_payload = true;
                    collect_dependency_pairs(next, pairs);
                }
            }
            if used_nested_payload {
                return;
            }

            if !obj.is_empty() && obj.values().all(|v| v.is_string()) {
                for (dep_name, constraint) in obj {
                    if let Some(constraint_str) = constraint.as_str() {
                        let normalized = constraint_str.trim();
                        if !normalized.is_empty() {
                            pairs.push((dep_name.to_string(), normalized.to_string()));
                        }
                    }
                }
                return;
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr {
                collect_dependency_pairs(item, pairs);
            }
        }
        serde_json::Value::String(text) => {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(text) {
                collect_dependency_pairs(&parsed, pairs);
            }
        }
        _ => {}
    }
}

pub fn parse_dependency_constraints_from_value(value: &serde_json::Value) -> Vec<(String, String)> {
    let mut pairs = Vec::new();
    collect_dependency_pairs(value, &mut pairs);

    let mut deduped = Vec::new();
    let mut seen = HashSet::new();
    for (name, constraint) in pairs {
        let key = format!("{}::{}", normalize_node_package_name(&name), constraint);
        if seen.insert(key) {
            deduped.push((name, constraint));
        }
    }

    deduped
}

pub fn parse_dependency_constraints_from_json_output(
    output: &str,
) -> CogniaResult<Vec<(String, String)>> {
    let value = serde_json::from_str::<serde_json::Value>(output).map_err(|err| {
        CogniaError::Provider(format!(
            "failed to parse dependency output as JSON: {}",
            err
        ))
    })?;

    Ok(parse_dependency_constraints_from_value(&value))
}

fn parse_outdated_entry(
    name_hint: Option<&str>,
    value: &serde_json::Value,
) -> Option<NodeOutdatedEntry> {
    let obj = value.as_object()?;
    let name = name_hint.map(|s| s.to_string()).or_else(|| {
        obj.get("name")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    })?;
    let current = obj.get("current").and_then(|v| v.as_str())?;
    let latest = obj.get("latest").and_then(|v| v.as_str())?;

    Some(NodeOutdatedEntry {
        name,
        current: current.to_string(),
        latest: latest.to_string(),
    })
}

fn collect_outdated_entries(value: &serde_json::Value, entries: &mut Vec<NodeOutdatedEntry>) {
    match value {
        serde_json::Value::Object(obj) => {
            if let Some(entry) = parse_outdated_entry(None, value) {
                entries.push(entry);
                return;
            }

            for (name, info) in obj {
                if let Some(entry) = parse_outdated_entry(Some(name), info) {
                    entries.push(entry);
                }
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr {
                collect_outdated_entries(item, entries);
            }
        }
        serde_json::Value::String(text) => {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(text) {
                collect_outdated_entries(&parsed, entries);
            }
        }
        _ => {}
    }
}

pub fn parse_outdated_packages_from_json_output(
    output: &str,
) -> CogniaResult<Vec<NodeOutdatedEntry>> {
    let value = serde_json::from_str::<serde_json::Value>(output).map_err(|err| {
        CogniaError::Provider(format!("failed to parse outdated output as JSON: {}", err))
    })?;

    let mut entries = Vec::new();
    collect_outdated_entries(&value, &mut entries);

    let mut deduped = Vec::new();
    let mut seen = HashSet::new();
    for entry in entries {
        let key = format!(
            "{}::{}::{}",
            normalize_node_package_name(&entry.name),
            entry.current,
            entry.latest
        );
        if seen.insert(key) {
            deduped.push(entry);
        }
    }

    Ok(deduped)
}

pub fn parse_node_list_json_line(line: &str) -> Vec<(String, String)> {
    let mut entries = Vec::new();
    let mut seen = HashSet::new();

    let Ok(json) = serde_json::from_str::<serde_json::Value>(line) else {
        return entries;
    };
    let Some(data) = json.get("data") else {
        return entries;
    };

    if let Some(tree_text) = data.as_str() {
        for row in tree_text.lines() {
            for segment in row.split(',') {
                if let Some((name, version)) = parse_node_list_entry(segment) {
                    let key = format!("{}@{}", normalize_node_package_name(&name), version);
                    if seen.insert(key) {
                        entries.push((name, version));
                    }
                }
            }
        }
    }

    if let Some(trees) = data.get("trees").and_then(|t| t.as_array()) {
        for tree in trees {
            if let Some(tree_name) = tree.get("name").and_then(|n| n.as_str()) {
                if let Some((name, version)) = parse_node_list_entry(tree_name) {
                    let key = format!("{}@{}", normalize_node_package_name(&name), version);
                    if seen.insert(key) {
                        entries.push((name, version));
                    }
                    continue;
                }

                let (pkg_name, pkg_version) = split_name_version(tree_name.trim());
                if let Some(version) = pkg_version {
                    if !pkg_name.is_empty() {
                        let version = version.trim().to_string();
                        let key = format!("{}@{}", normalize_node_package_name(pkg_name), version);
                        if seen.insert(key) {
                            entries.push((pkg_name.to_string(), version));
                        }
                    }
                }
            }
        }
    }

    entries
}

pub fn parse_node_list_json_output(output: &str) -> Vec<(String, String)> {
    let mut entries = Vec::new();
    let mut seen = HashSet::new();

    for line in output.lines() {
        for (name, version) in parse_node_list_json_line(line) {
            let key = format!("{}@{}", normalize_node_package_name(&name), version);
            if seen.insert(key) {
                entries.push((name, version));
            }
        }
    }

    entries
}

impl NodeProviderUtils {
    /// Execute a command and return stdout on success
    pub async fn run_command(cmd: &str, args: &[&str]) -> CogniaResult<String> {
        let out = process::execute(cmd, args, None).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Build the package specifier with optional version
    pub fn build_package_spec(name: &str, version: Option<&str>, separator: &str) -> String {
        match version {
            Some(v) => format!("{}{}{}", name, separator, v),
            None => name.to_string(),
        }
    }

    /// Create an install receipt for a Node.js package
    pub fn create_install_receipt(
        name: String,
        version: Option<String>,
        provider_id: &str,
        install_path: PathBuf,
    ) -> InstallReceipt {
        InstallReceipt {
            name,
            version: version.unwrap_or_default(),
            provider: provider_id.to_string(),
            install_path,
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    /// Get the default node_modules path for local installs
    pub fn local_install_path(package_name: &str) -> PathBuf {
        PathBuf::from("node_modules").join(package_name)
    }
}

/// Macro for implementing common Node.js provider patterns
/// This reduces boilerplate across npm, pnpm, and yarn providers
#[macro_export]
macro_rules! impl_node_provider_install {
    (
        $provider:ty,
        $cmd:expr,
        global_args: $global_args:expr,
        local_args: $local_args:expr,
        version_separator: $sep:expr,
        global_dir_method: $global_dir:expr
    ) => {
        impl $provider {
            async fn install_package_common(
                &self,
                req: InstallRequest,
            ) -> CogniaResult<InstallReceipt> {
                use $crate::provider::node_base::NodeProviderUtils;

                let pkg =
                    NodeProviderUtils::build_package_spec(&req.name, req.version.as_deref(), $sep);

                let args: Vec<&str> = if req.global {
                    let mut base: Vec<&str> = $global_args.to_vec();
                    base.push(&pkg);
                    base
                } else {
                    let mut base: Vec<&str> = $local_args.to_vec();
                    base.push(&pkg);
                    base
                };

                NodeProviderUtils::run_command($cmd, &args).await?;

                let install_path = if req.global {
                    $global_dir(self).await.unwrap_or_default()
                } else {
                    NodeProviderUtils::local_install_path(&req.name)
                };

                Ok(NodeProviderUtils::create_install_receipt(
                    req.name,
                    req.version,
                    self.id(),
                    install_path,
                ))
            }
        }
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_package_spec() {
        assert_eq!(
            NodeProviderUtils::build_package_spec("lodash", Some("4.17.21"), "@"),
            "lodash@4.17.21"
        );
        assert_eq!(
            NodeProviderUtils::build_package_spec("lodash", None, "@"),
            "lodash"
        );
        assert_eq!(
            NodeProviderUtils::build_package_spec("requests", Some("2.28.0"), "=="),
            "requests==2.28.0"
        );
    }

    #[test]
    fn test_local_install_path() {
        let path = NodeProviderUtils::local_install_path("express");
        assert_eq!(path, PathBuf::from("node_modules/express"));
    }

    #[test]
    fn test_split_name_version_simple() {
        assert_eq!(split_name_version("lodash"), ("lodash", None));
        assert_eq!(split_name_version("express"), ("express", None));
        assert_eq!(split_name_version("cli-service"), ("cli-service", None));
    }

    #[test]
    fn test_split_name_version_with_version() {
        assert_eq!(
            split_name_version("lodash@4.17.21"),
            ("lodash", Some("4.17.21"))
        );
        assert_eq!(
            split_name_version("express@4.18.2"),
            ("express", Some("4.18.2"))
        );
        assert_eq!(
            split_name_version("react@18.0.0"),
            ("react", Some("18.0.0"))
        );
    }

    #[test]
    fn test_split_name_version_scoped_no_version() {
        assert_eq!(split_name_version("@types/node"), ("@types/node", None));
        assert_eq!(
            split_name_version("@vue/cli-service"),
            ("@vue/cli-service", None)
        );
        assert_eq!(split_name_version("@angular/core"), ("@angular/core", None));
    }

    #[test]
    fn test_split_name_version_scoped_with_version() {
        assert_eq!(
            split_name_version("@types/node@18.0.0"),
            ("@types/node", Some("18.0.0"))
        );
        assert_eq!(
            split_name_version("@vue/cli-service@5.0.8"),
            ("@vue/cli-service", Some("5.0.8"))
        );
        assert_eq!(
            split_name_version("@types/react@^18.0.0"),
            ("@types/react", Some("^18.0.0"))
        );
    }

    #[test]
    fn test_split_name_version_edge_cases() {
        assert_eq!(split_name_version(""), ("", None));
        assert_eq!(split_name_version("  "), ("", None));
        assert_eq!(split_name_version("lodash@"), ("lodash@", None));
        assert_eq!(
            split_name_version("  lodash@4.0.0  "),
            ("lodash", Some("4.0.0"))
        );
    }

    #[test]
    fn test_split_name_version_dist_tags() {
        assert_eq!(
            split_name_version("lodash@latest"),
            ("lodash", Some("latest"))
        );
        assert_eq!(
            split_name_version("@types/node@latest"),
            ("@types/node", Some("latest"))
        );
        assert_eq!(split_name_version("react@next"), ("react", Some("next")));
    }

    #[test]
    fn test_split_name_version_version_ranges() {
        assert_eq!(
            split_name_version("lodash@^4.0.0"),
            ("lodash", Some("^4.0.0"))
        );
        assert_eq!(
            split_name_version("lodash@~4.0.0"),
            ("lodash", Some("~4.0.0"))
        );
        assert_eq!(
            split_name_version("lodash@>=4.0.0"),
            ("lodash", Some(">=4.0.0"))
        );
        assert_eq!(
            split_name_version("@types/node@>=18.0.0"),
            ("@types/node", Some(">=18.0.0"))
        );
    }

    #[test]
    fn test_parse_node_list_entry_unscoped() {
        assert_eq!(
            parse_node_list_entry("├── eslint@9.17.0"),
            Some(("eslint".to_string(), "9.17.0".to_string()))
        );
    }

    #[test]
    fn test_parse_node_list_entry_scoped() {
        assert_eq!(
            parse_node_list_entry("└── @types/node@22.10.1"),
            Some(("@types/node".to_string(), "22.10.1".to_string()))
        );
    }

    #[test]
    fn test_parse_node_list_entry_rejects_banner_and_path() {
        assert_eq!(parse_node_list_entry("bun pm ls v1.1.34"), None);
        assert_eq!(
            parse_node_list_entry("C:\\Users\\Max Qian\\node_modules (174)"),
            None
        );
    }

    #[test]
    fn test_parse_node_list_entry_first_token_only() {
        assert_eq!(
            parse_node_list_entry("├── biome@1.9.4 (workspace root dependency)"),
            Some(("biome".to_string(), "1.9.4".to_string()))
        );
    }

    #[test]
    fn test_parse_installed_packages_supports_object_and_array_shapes() {
        let object_shape = serde_json::json!({
            "dependencies": {
                "eslint": { "version": "9.17.0" }
            }
        });
        let array_shape = serde_json::json!([
            {
                "dependencies": {
                    "@types/node": { "version": "22.10.1" }
                }
            }
        ]);

        let object_entries = parse_installed_packages_from_value(&object_shape);
        let array_entries = parse_installed_packages_from_value(&array_shape);

        assert_eq!(
            object_entries,
            vec![("eslint".to_string(), "9.17.0".to_string())]
        );
        assert_eq!(
            array_entries,
            vec![("@types/node".to_string(), "22.10.1".to_string())]
        );
    }

    #[test]
    fn test_parse_installed_packages_from_json_output_errors_for_invalid_json() {
        let result = parse_installed_packages_from_json_output("not-json");
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_dependency_constraints_supports_nested_and_stringified_payloads() {
        let direct = serde_json::json!({
            "chalk": "^5.3.0",
            "@types/node": ">=18.0.0"
        });
        let nested = serde_json::json!({
            "data": "{\"dependencies\":{\"lodash\":\"^4.17.21\"}}"
        });

        let direct_pairs = parse_dependency_constraints_from_value(&direct);
        let nested_pairs = parse_dependency_constraints_from_value(&nested);

        assert!(direct_pairs.contains(&("chalk".to_string(), "^5.3.0".to_string())));
        assert!(direct_pairs.contains(&("@types/node".to_string(), ">=18.0.0".to_string())));
        assert_eq!(
            nested_pairs,
            vec![("lodash".to_string(), "^4.17.21".to_string())]
        );
    }

    #[test]
    fn test_parse_dependency_constraints_from_json_output_errors_for_invalid_json() {
        let result = parse_dependency_constraints_from_json_output("{bad-json");
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_outdated_packages_supports_object_and_array_shapes() {
        let object_output = r#"{"eslint":{"current":"9.0.0","latest":"9.17.0"}}"#;
        let array_output = r#"[{"name":"typescript","current":"5.0.0","latest":"5.1.0"}]"#;

        let object_entries = parse_outdated_packages_from_json_output(object_output).unwrap();
        let array_entries = parse_outdated_packages_from_json_output(array_output).unwrap();

        assert_eq!(
            object_entries,
            vec![NodeOutdatedEntry {
                name: "eslint".to_string(),
                current: "9.0.0".to_string(),
                latest: "9.17.0".to_string()
            }]
        );
        assert_eq!(
            array_entries,
            vec![NodeOutdatedEntry {
                name: "typescript".to_string(),
                current: "5.0.0".to_string(),
                latest: "5.1.0".to_string()
            }]
        );
    }

    #[test]
    fn test_parse_node_list_json_line_parses_tree_text_and_trees_array() {
        let tree_text_line =
            r#"{"type":"tree","data":"├── lodash@4.17.21\n└── @types/node@22.10.1"}"#;
        let trees_array_line = r#"{"type":"tree","data":{"trees":[{"name":"eslint@9.17.0"}]}}"#;

        let tree_text_entries = parse_node_list_json_line(tree_text_line);
        let trees_array_entries = parse_node_list_json_line(trees_array_line);

        assert!(tree_text_entries.contains(&("lodash".to_string(), "4.17.21".to_string())));
        assert!(tree_text_entries.contains(&("@types/node".to_string(), "22.10.1".to_string())));
        assert_eq!(
            trees_array_entries,
            vec![("eslint".to_string(), "9.17.0".to_string())]
        );
    }

    #[test]
    fn test_normalize_node_provider_and_package_name() {
        assert_eq!(normalize_node_provider_id("  NPM "), "npm");
        assert_eq!(normalize_node_package_name("  @Types/Node "), "@types/node");
    }
}
