use crate::core::DetectedEnvironment;
use crate::error::CogniaResult;
use std::path::{Path, PathBuf};

/// Default detection sources for a logical environment type.
///
/// These labels MUST match frontend `DEFAULT_DETECTION_FILES` and the persisted
/// `detection_files[*].file_name` values.
pub fn default_detection_sources(env_type: &str) -> &'static [&'static str] {
    match env_type {
        "node" => &[
            ".nvmrc",
            ".node-version",
            ".tool-versions",
            "package.json (volta.node)",
            "package.json (engines.node)",
        ],
        "python" => &[
            ".python-version",
            "pyproject.toml (project.requires-python)",
            "pyproject.toml (tool.poetry.dependencies.python)",
            "Pipfile (requires.python_version)",
            "runtime.txt",
            ".tool-versions",
        ],
        "go" => &[
            "go.mod (toolchain)",
            "go.mod (go)",
            ".go-version",
            ".tool-versions",
        ],
        // rustup precedence: rust-toolchain wins if both files exist.
        "rust" => &["rust-toolchain", "rust-toolchain.toml", ".tool-versions"],
        "ruby" => &[".ruby-version", "Gemfile", ".tool-versions"],
        "java" => &[".java-version", ".sdkmanrc", ".tool-versions"],
        "kotlin" => &[".kotlin-version", ".sdkmanrc", ".tool-versions"],
        "php" => &[
            ".php-version",
            "composer.json (require.php)",
            ".tool-versions",
        ],
        "dotnet" => &["global.json (sdk.version)", ".tool-versions"],
        "deno" => &[".deno-version", ".dvmrc", ".tool-versions"],
        // `.bun-version` is an ecosystem convention used by version managers; keep engines.bun optional.
        "bun" => &[
            ".bun-version",
            ".tool-versions",
            "package.json (engines.bun)",
        ],
        _ => &[],
    }
}

/// Default enabled sources (first two) used when the user has no saved settings yet.
pub fn default_enabled_detection_sources(env_type: &str) -> Vec<String> {
    default_detection_sources(env_type)
        .iter()
        .take(2)
        .map(|s| (*s).to_string())
        .collect()
}

/// Detect a pinned version for a logical environment type by traversing the directory tree
/// upwards from `start_path`.
///
/// `sources_in_priority` is an ordered list of enabled detection sources (labels) for this
/// environment type. The nearest directory wins; within a directory, the first matching source
/// wins.
pub async fn detect_env_version(
    env_type: &str,
    start_path: &Path,
    sources_in_priority: &[String],
) -> CogniaResult<Option<DetectedEnvironment>> {
    let start_dir = normalize_start_dir(start_path);

    let mut current = start_dir;
    loop {
        for source in sources_in_priority {
            if let Some(version) = detect_from_source(env_type, &current, source).await? {
                return Ok(Some(DetectedEnvironment {
                    env_type: env_type.to_string(),
                    version: version.value,
                    source: version.source,
                    source_path: Some(version.path),
                }));
            }
        }

        if !current.pop() {
            break;
        }
    }

    Ok(None)
}

#[derive(Debug, Clone)]
struct DetectedValue {
    value: String,
    source: String,
    path: PathBuf,
}

fn normalize_start_dir(start_path: &Path) -> PathBuf {
    if start_path.is_file() {
        start_path
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| start_path.to_path_buf())
    } else {
        start_path.to_path_buf()
    }
}

async fn detect_from_source(
    env_type: &str,
    dir: &Path,
    source: &str,
) -> CogniaResult<Option<DetectedValue>> {
    match env_type {
        "node" => detect_node(dir, source).await,
        "python" => detect_python(dir, source).await,
        "go" => detect_go(dir, source).await,
        "rust" => detect_rust(dir, source).await,
        "ruby" => detect_ruby(dir, source).await,
        "java" => detect_java(dir, source).await,
        "kotlin" => detect_kotlin(dir, source).await,
        "php" => detect_php(dir, source).await,
        "dotnet" => detect_dotnet(dir, source).await,
        "deno" => detect_deno(dir, source).await,
        "bun" => detect_bun(dir, source).await,
        _ => Ok(None),
    }
}

async fn detect_node(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".nvmrc" => read_version_file(dir.join(".nvmrc"), ".nvmrc").await,
        ".node-version" => read_version_file(dir.join(".node-version"), ".node-version").await,
        ".tool-versions" => {
            read_tool_versions(
                dir.join(".tool-versions"),
                &["nodejs", "node"],
                ".tool-versions",
            )
            .await
        }
        "package.json (volta.node)" => {
            read_package_json_field(dir.join("package.json"), &["volta", "node"], source).await
        }
        "package.json (engines.node)" => {
            read_package_json_field(dir.join("package.json"), &["engines", "node"], source).await
        }
        _ => Ok(None),
    }
}

async fn detect_python(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".python-version" => {
            read_version_file(dir.join(".python-version"), ".python-version").await
        }
        "pyproject.toml" => read_pyproject_python(dir.join("pyproject.toml")).await,
        "pyproject.toml (project.requires-python)" => {
            read_pyproject_requires_python(dir.join("pyproject.toml")).await
        }
        "pyproject.toml (tool.poetry.dependencies.python)" => {
            read_pyproject_poetry_python(dir.join("pyproject.toml")).await
        }
        "Pipfile" | "Pipfile (requires.python_version)" => {
            read_pipfile_python(dir.join("Pipfile")).await
        }
        "runtime.txt" => read_runtime_txt_python(dir.join("runtime.txt")).await,
        ".tool-versions" => {
            read_tool_versions(dir.join(".tool-versions"), &["python"], ".tool-versions").await
        }
        _ => Ok(None),
    }
}

async fn detect_go(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".go-version" => read_version_file(dir.join(".go-version"), ".go-version").await,
        // Legacy label: parse toolchain first, then go directive.
        "go.mod" => read_go_mod(dir.join("go.mod")).await,
        "go.mod (toolchain)" => read_go_mod_toolchain(dir.join("go.mod")).await,
        "go.mod (go)" => read_go_mod_go(dir.join("go.mod")).await,
        ".tool-versions" => {
            read_tool_versions(
                dir.join(".tool-versions"),
                &["golang", "go"],
                ".tool-versions",
            )
            .await
        }
        _ => Ok(None),
    }
}

async fn detect_rust(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        // rustup precedence: rust-toolchain wins over rust-toolchain.toml if both exist.
        "rust-toolchain" => read_rust_toolchain(dir.join("rust-toolchain")).await,
        "rust-toolchain.toml" => read_rust_toolchain_toml(dir.join("rust-toolchain.toml")).await,
        ".tool-versions" => {
            read_tool_versions(dir.join(".tool-versions"), &["rust"], ".tool-versions").await
        }
        _ => Ok(None),
    }
}

async fn detect_ruby(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".ruby-version" => read_version_file(dir.join(".ruby-version"), ".ruby-version").await,
        "Gemfile" => read_gemfile_ruby_version(dir.join("Gemfile")).await,
        ".tool-versions" => {
            read_tool_versions(dir.join(".tool-versions"), &["ruby"], ".tool-versions").await
        }
        _ => Ok(None),
    }
}

async fn detect_java(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".java-version" => read_version_file(dir.join(".java-version"), ".java-version").await,
        ".sdkmanrc" => read_sdkmanrc_version(dir.join(".sdkmanrc"), "java").await,
        ".tool-versions" => {
            read_tool_versions(dir.join(".tool-versions"), &["java"], ".tool-versions").await
        }
        _ => Ok(None),
    }
}

async fn detect_kotlin(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".kotlin-version" => {
            read_version_file(dir.join(".kotlin-version"), ".kotlin-version").await
        }
        ".sdkmanrc" => read_sdkmanrc_version(dir.join(".sdkmanrc"), "kotlin").await,
        ".tool-versions" => {
            read_tool_versions(dir.join(".tool-versions"), &["kotlin"], ".tool-versions").await
        }
        _ => Ok(None),
    }
}

async fn detect_php(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".php-version" => read_version_file(dir.join(".php-version"), ".php-version").await,
        "composer.json (require.php)" => read_composer_json_php(dir.join("composer.json")).await,
        ".tool-versions" => {
            read_tool_versions(dir.join(".tool-versions"), &["php"], ".tool-versions").await
        }
        _ => Ok(None),
    }
}

async fn detect_dotnet(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        // Legacy label: keep for compatibility.
        "global.json" | "global.json (sdk.version)" => {
            read_global_json_sdk_version(dir.join("global.json")).await
        }
        ".tool-versions" => {
            read_tool_versions(
                dir.join(".tool-versions"),
                &["dotnet", "dotnet-core"],
                ".tool-versions",
            )
            .await
        }
        _ => Ok(None),
    }
}

async fn detect_deno(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".deno-version" => read_version_file(dir.join(".deno-version"), ".deno-version").await,
        ".dvmrc" => read_version_file(dir.join(".dvmrc"), ".dvmrc").await,
        ".tool-versions" => {
            read_tool_versions(dir.join(".tool-versions"), &["deno"], ".tool-versions").await
        }
        // Intentionally unsupported: `deno.json`'s `"version"` is package publishing metadata,
        // not a runtime pin. If this label appears in old settings, return None.
        "deno.json" | "deno.jsonc" => Ok(None),
        _ => Ok(None),
    }
}

async fn detect_bun(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".bun-version" => read_version_file(dir.join(".bun-version"), ".bun-version").await,
        ".tool-versions" => {
            read_tool_versions(dir.join(".tool-versions"), &["bun"], ".tool-versions").await
        }
        "package.json (engines.bun)" => {
            read_package_json_field(dir.join("package.json"), &["engines", "bun"], source).await
        }
        // Intentionally unsupported: bunfig.toml is behavior config, not runtime pinning.
        "bunfig.toml" => Ok(None),
        _ => Ok(None),
    }
}

async fn read_version_file(
    path: PathBuf,
    source_label: &str,
) -> CogniaResult<Option<DetectedValue>> {
    if !path.is_file() {
        return Ok(None);
    }

    let content = match crate::platform::fs::read_file_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    let version = first_nonempty_noncomment_line(&content, '#').unwrap_or_default();
    if version.is_empty() {
        return Ok(None);
    }

    Ok(Some(DetectedValue {
        value: version,
        source: source_label.to_string(),
        path,
    }))
}

async fn read_tool_versions(
    path: PathBuf,
    keys: &[&str],
    source_label: &str,
) -> CogniaResult<Option<DetectedValue>> {
    if !path.is_file() {
        return Ok(None);
    }

    let content = match crate::platform::fs::read_file_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    for line in content.lines() {
        let line = strip_hash_comment(line).trim();
        if line.is_empty() {
            continue;
        }

        let mut parts = line.split_whitespace();
        let tool = match parts.next() {
            Some(t) => t,
            None => continue,
        };
        if !keys.iter().any(|k| *k == tool) {
            continue;
        }

        let version = parts.next().unwrap_or("").trim();
        if version.is_empty() {
            continue;
        }

        return Ok(Some(DetectedValue {
            value: version.to_string(),
            source: source_label.to_string(),
            path,
        }));
    }

    Ok(None)
}

async fn read_package_json_field(
    path: PathBuf,
    json_path: &[&str],
    source_label: &str,
) -> CogniaResult<Option<DetectedValue>> {
    if !path.is_file() {
        return Ok(None);
    }

    let content = match crate::platform::fs::read_file_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    let json: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return Ok(None),
    };

    let mut current = &json;
    for segment in json_path {
        match current.get(*segment) {
            Some(next) => current = next,
            None => return Ok(None),
        }
    }

    let value = match current.as_str() {
        Some(s) => s.trim(),
        None => return Ok(None),
    };

    if value.is_empty() {
        return Ok(None);
    }

    Ok(Some(DetectedValue {
        value: value.to_string(),
        source: source_label.to_string(),
        path,
    }))
}

async fn read_composer_json_php(path: PathBuf) -> CogniaResult<Option<DetectedValue>> {
    if !path.is_file() {
        return Ok(None);
    }

    let content = match crate::platform::fs::read_file_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    let json: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return Ok(None),
    };

    let php_req = json
        .get("require")
        .and_then(|v| v.get("php"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .unwrap_or("");

    if php_req.is_empty() {
        return Ok(None);
    }

    Ok(Some(DetectedValue {
        value: php_req.to_string(),
        source: "composer.json (require.php)".to_string(),
        path,
    }))
}

async fn read_pyproject_python(path: PathBuf) -> CogniaResult<Option<DetectedValue>> {
    if !path.is_file() {
        return Ok(None);
    }

    let content = match crate::platform::fs::read_file_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    let doc: toml::Value = match toml::from_str(&content) {
        Ok(v) => v,
        Err(_) => return Ok(None),
    };

    // PEP 621: project.requires-python
    if let Some(requires) = doc
        .get("project")
        .and_then(|v| v.get("requires-python"))
        .and_then(|v| v.as_str())
    {
        let requires = requires.trim();
        if !requires.is_empty() {
            return Ok(Some(DetectedValue {
                value: requires.to_string(),
                source: "pyproject.toml (project.requires-python)".to_string(),
                path: path.clone(),
            }));
        }
    }

    // Poetry: tool.poetry.dependencies.python
    if let Some(py) = doc
        .get("tool")
        .and_then(|v| v.get("poetry"))
        .and_then(|v| v.get("dependencies"))
        .and_then(|v| v.get("python"))
        .and_then(|v| v.as_str())
    {
        let py = py.trim();
        if !py.is_empty() {
            return Ok(Some(DetectedValue {
                value: py.to_string(),
                source: "pyproject.toml (tool.poetry.dependencies.python)".to_string(),
                path,
            }));
        }
    }

    Ok(None)
}

async fn read_pyproject_requires_python(path: PathBuf) -> CogniaResult<Option<DetectedValue>> {
    if !path.is_file() {
        return Ok(None);
    }

    let content = match crate::platform::fs::read_file_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    let doc: toml::Value = match toml::from_str(&content) {
        Ok(v) => v,
        Err(_) => return Ok(None),
    };

    if let Some(requires) = doc
        .get("project")
        .and_then(|v| v.get("requires-python"))
        .and_then(|v| v.as_str())
        .map(str::trim)
    {
        if !requires.is_empty() {
            return Ok(Some(DetectedValue {
                value: requires.to_string(),
                source: "pyproject.toml (project.requires-python)".to_string(),
                path,
            }));
        }
    }

    Ok(None)
}

async fn read_pyproject_poetry_python(path: PathBuf) -> CogniaResult<Option<DetectedValue>> {
    if !path.is_file() {
        return Ok(None);
    }

    let content = match crate::platform::fs::read_file_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    let doc: toml::Value = match toml::from_str(&content) {
        Ok(v) => v,
        Err(_) => return Ok(None),
    };

    if let Some(py) = doc
        .get("tool")
        .and_then(|v| v.get("poetry"))
        .and_then(|v| v.get("dependencies"))
        .and_then(|v| v.get("python"))
        .and_then(|v| v.as_str())
        .map(str::trim)
    {
        if !py.is_empty() {
            return Ok(Some(DetectedValue {
                value: py.to_string(),
                source: "pyproject.toml (tool.poetry.dependencies.python)".to_string(),
                path,
            }));
        }
    }

    Ok(None)
}

async fn read_pipfile_python(path: PathBuf) -> CogniaResult<Option<DetectedValue>> {
    if !path.is_file() {
        return Ok(None);
    }

    let content = match crate::platform::fs::read_file_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    let doc: toml::Value = match toml::from_str(&content) {
        Ok(v) => v,
        Err(_) => return Ok(None),
    };

    let version = doc
        .get("requires")
        .and_then(|v| v.get("python_version"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .unwrap_or("");

    if version.is_empty() {
        return Ok(None);
    }

    Ok(Some(DetectedValue {
        value: version.to_string(),
        source: "Pipfile (requires.python_version)".to_string(),
        path,
    }))
}

async fn read_runtime_txt_python(path: PathBuf) -> CogniaResult<Option<DetectedValue>> {
    if !path.is_file() {
        return Ok(None);
    }

    let content = match crate::platform::fs::read_file_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    let raw = content.lines().next().unwrap_or("").trim();
    if raw.is_empty() {
        return Ok(None);
    }

    let version = raw
        .strip_prefix("python-")
        .unwrap_or(raw)
        .trim()
        .to_string();

    if version.is_empty() {
        return Ok(None);
    }

    Ok(Some(DetectedValue {
        value: version,
        source: "runtime.txt".to_string(),
        path,
    }))
}

async fn read_gemfile_ruby_version(path: PathBuf) -> CogniaResult<Option<DetectedValue>> {
    if !path.is_file() {
        return Ok(None);
    }

    let content = match crate::platform::fs::read_file_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    for line in content.lines() {
        let line = strip_hash_comment(line).trim();
        if line.is_empty() {
            continue;
        }
        // Common forms:
        //   ruby "3.2.2"
        //   ruby '3.2.2'
        if let Some(rest) = line.strip_prefix("ruby ") {
            let value = rest.trim().trim_matches('"').trim_matches('\'');
            if !value.is_empty() {
                return Ok(Some(DetectedValue {
                    value: value.to_string(),
                    source: "Gemfile".to_string(),
                    path,
                }));
            }
        }
    }

    Ok(None)
}

async fn read_sdkmanrc_version(path: PathBuf, key: &str) -> CogniaResult<Option<DetectedValue>> {
    if !path.is_file() {
        return Ok(None);
    }

    let content = match crate::platform::fs::read_file_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    for line in content.lines() {
        let line = strip_hash_comment(line).trim();
        if line.is_empty() {
            continue;
        }
        if let Some((k, v)) = line.split_once('=') {
            if k.trim() != key {
                continue;
            }
            let value = v.trim();
            if !value.is_empty() {
                return Ok(Some(DetectedValue {
                    value: value.to_string(),
                    source: ".sdkmanrc".to_string(),
                    path,
                }));
            }
        }
    }

    Ok(None)
}

async fn read_go_mod(path: PathBuf) -> CogniaResult<Option<DetectedValue>> {
    if !path.is_file() {
        return Ok(None);
    }

    let content = match crate::platform::fs::read_file_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    // Prefer toolchain directive if present.
    if let Some(toolchain) = find_go_mod_directive(&content, "toolchain") {
        if let Some(value) = normalize_go_toolchain_name(&toolchain) {
            return Ok(Some(DetectedValue {
                value,
                source: "go.mod (toolchain)".to_string(),
                path,
            }));
        }
    }

    if let Some(go) = find_go_mod_directive(&content, "go") {
        let go = go.trim();
        if !go.is_empty() {
            return Ok(Some(DetectedValue {
                value: go.to_string(),
                source: "go.mod (go)".to_string(),
                path,
            }));
        }
    }

    Ok(None)
}

async fn read_go_mod_toolchain(path: PathBuf) -> CogniaResult<Option<DetectedValue>> {
    if !path.is_file() {
        return Ok(None);
    }

    let content = match crate::platform::fs::read_file_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    if let Some(toolchain) = find_go_mod_directive(&content, "toolchain") {
        if let Some(value) = normalize_go_toolchain_name(&toolchain) {
            return Ok(Some(DetectedValue {
                value,
                source: "go.mod (toolchain)".to_string(),
                path,
            }));
        }
    }

    Ok(None)
}

fn normalize_go_toolchain_name(raw: &str) -> Option<String> {
    let raw = raw.trim();
    if raw.is_empty() {
        return None;
    }

    // Special values: treat as "no specific toolchain pinned".
    if raw.eq_ignore_ascii_case("local") || raw.eq_ignore_ascii_case("default") {
        return None;
    }

    // Most toolchain names are `go1.x.y`. Keep `gotip` intact.
    let mut value = raw.to_string();
    if let Some(stripped) = value.strip_prefix("go") {
        if stripped
            .chars()
            .next()
            .map(|c| c.is_ascii_digit())
            .unwrap_or(false)
        {
            value = stripped.to_string();
        }
    }

    let value = value.trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

async fn read_go_mod_go(path: PathBuf) -> CogniaResult<Option<DetectedValue>> {
    if !path.is_file() {
        return Ok(None);
    }

    let content = match crate::platform::fs::read_file_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    if let Some(go) = find_go_mod_directive(&content, "go") {
        let go = go.trim();
        if !go.is_empty() {
            return Ok(Some(DetectedValue {
                value: go.to_string(),
                source: "go.mod (go)".to_string(),
                path,
            }));
        }
    }

    Ok(None)
}

fn find_go_mod_directive(content: &str, directive: &str) -> Option<String> {
    for line in content.lines() {
        let line = strip_double_slash_comment(line).trim();
        if line.is_empty() {
            continue;
        }

        let prefix = format!("{directive} ");
        if let Some(rest) = line.strip_prefix(&prefix) {
            return Some(rest.trim().to_string());
        }
    }

    None
}

async fn read_rust_toolchain(path: PathBuf) -> CogniaResult<Option<DetectedValue>> {
    if !path.is_file() {
        return Ok(None);
    }

    let content = match crate::platform::fs::read_file_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    // rust-toolchain can be TOML or legacy single-line. Try TOML first.
    if let Ok(doc) = toml::from_str::<toml::Value>(&content) {
        if let Some(channel) = doc
            .get("toolchain")
            .and_then(|v| v.get("channel"))
            .and_then(|v| v.as_str())
            .map(str::trim)
        {
            if !channel.is_empty() {
                return Ok(Some(DetectedValue {
                    value: channel.to_string(),
                    source: "rust-toolchain".to_string(),
                    path: path.clone(),
                }));
            }
        }
    }

    let value = first_nonempty_noncomment_line(&content, '#').unwrap_or_default();
    if value.is_empty() {
        return Ok(None);
    }

    Ok(Some(DetectedValue {
        value,
        source: "rust-toolchain".to_string(),
        path,
    }))
}

async fn read_rust_toolchain_toml(path: PathBuf) -> CogniaResult<Option<DetectedValue>> {
    if !path.is_file() {
        return Ok(None);
    }

    let content = match crate::platform::fs::read_file_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    let doc: toml::Value = match toml::from_str(&content) {
        Ok(v) => v,
        Err(_) => return Ok(None),
    };

    let channel = doc
        .get("toolchain")
        .and_then(|v| v.get("channel"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .unwrap_or("");

    if channel.is_empty() {
        return Ok(None);
    }

    Ok(Some(DetectedValue {
        value: channel.to_string(),
        source: "rust-toolchain.toml".to_string(),
        path,
    }))
}

async fn read_global_json_sdk_version(path: PathBuf) -> CogniaResult<Option<DetectedValue>> {
    if !path.is_file() {
        return Ok(None);
    }

    let content = match crate::platform::fs::read_file_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    let json: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return Ok(None),
    };

    let sdk_version = json
        .get("sdk")
        .and_then(|v| v.get("version"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .unwrap_or("");

    if sdk_version.is_empty() {
        return Ok(None);
    }

    Ok(Some(DetectedValue {
        value: sdk_version.to_string(),
        source: "global.json (sdk.version)".to_string(),
        path,
    }))
}

fn strip_hash_comment(line: &str) -> &str {
    line.split('#').next().unwrap_or(line)
}

fn strip_double_slash_comment(line: &str) -> &str {
    line.split("//").next().unwrap_or(line)
}

fn first_nonempty_noncomment_line(content: &str, comment_prefix: char) -> Option<String> {
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if line.starts_with(comment_prefix) {
            continue;
        }
        return Some(line.to_string());
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn detects_node_from_local_file_before_parent() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let child = root.join("child");
        tokio::fs::create_dir_all(&child).await.unwrap();

        crate::platform::fs::write_file_string(root.join(".nvmrc"), "20.10.0")
            .await
            .unwrap();
        crate::platform::fs::write_file_string(child.join(".node-version"), "18.19.0")
            .await
            .unwrap();

        let sources = vec![
            ".nvmrc".to_string(),
            ".node-version".to_string(),
            "package.json (engines.node)".to_string(),
        ];

        let detected = detect_env_version("node", &child, &sources)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(detected.env_type, "node");
        assert_eq!(detected.version, "18.19.0");
        assert_eq!(detected.source, ".node-version");
    }

    #[tokio::test]
    async fn detects_node_from_engines_when_enabled() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(
            root.join("package.json"),
            r#"{ "name": "x", "engines": { "node": ">=18" } }"#,
        )
        .await
        .unwrap();

        let sources = vec!["package.json (engines.node)".to_string()];
        let detected = detect_env_version("node", root, &sources)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(detected.version, ">=18");
        assert_eq!(detected.source, "package.json (engines.node)");
    }

    #[tokio::test]
    async fn go_mod_prefers_toolchain_over_go() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(
            root.join("go.mod"),
            r#"
module example.com/x
go 1.21.0
toolchain go1.22.1
"#,
        )
        .await
        .unwrap();

        let sources = vec!["go.mod (toolchain)".to_string(), "go.mod (go)".to_string()];
        let detected = detect_env_version("go", root, &sources)
            .await
            .unwrap()
            .unwrap();

        assert_eq!(detected.version, "1.22.1");
        assert_eq!(detected.source, "go.mod (toolchain)");
    }

    #[tokio::test]
    async fn go_mod_toolchain_default_falls_back_to_go() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(
            root.join("go.mod"),
            r#"
module example.com/x
go 1.21.0
toolchain default
"#,
        )
        .await
        .unwrap();

        let sources = vec!["go.mod (toolchain)".to_string(), "go.mod (go)".to_string()];
        let detected = detect_env_version("go", root, &sources)
            .await
            .unwrap()
            .unwrap();

        assert_eq!(detected.version, "1.21.0");
        assert_eq!(detected.source, "go.mod (go)");
    }

    #[tokio::test]
    async fn rust_toolchain_file_wins_over_rust_toolchain_toml() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(root.join("rust-toolchain"), "nightly-2025-01-01")
            .await
            .unwrap();
        crate::platform::fs::write_file_string(
            root.join("rust-toolchain.toml"),
            r#"[toolchain]
channel = "stable"
"#,
        )
        .await
        .unwrap();

        let sources = vec![
            "rust-toolchain".to_string(),
            "rust-toolchain.toml".to_string(),
        ];
        let detected = detect_env_version("rust", root, &sources)
            .await
            .unwrap()
            .unwrap();

        assert_eq!(detected.version, "nightly-2025-01-01");
        assert_eq!(detected.source, "rust-toolchain");
    }

    #[tokio::test]
    async fn dotnet_reads_global_json_sdk_version() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(
            root.join("global.json"),
            r#"{ "sdk": { "version": "8.0.100" } }"#,
        )
        .await
        .unwrap();

        let sources = vec!["global.json (sdk.version)".to_string()];
        let detected = detect_env_version("dotnet", root, &sources)
            .await
            .unwrap()
            .unwrap();

        assert_eq!(detected.version, "8.0.100");
        assert_eq!(detected.source, "global.json (sdk.version)");
    }

    #[tokio::test]
    async fn deno_detects_deno_version_file() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(root.join(".deno-version"), "1.40.0")
            .await
            .unwrap();

        let sources = vec![".deno-version".to_string(), ".dvmrc".to_string()];
        let detected = detect_env_version("deno", root, &sources)
            .await
            .unwrap()
            .unwrap();

        assert_eq!(detected.version, "1.40.0");
        assert_eq!(detected.source, ".deno-version");
    }

    #[tokio::test]
    async fn deno_does_not_use_deno_json_package_version() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(root.join("deno.json"), r#"{ "version": "0.1.0" }"#)
            .await
            .unwrap();

        let sources = vec!["deno.json".to_string()];
        let detected = detect_env_version("deno", root, &sources).await.unwrap();
        assert!(detected.is_none());
    }
}
