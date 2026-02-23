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
            "uv.toml (requires-python)",
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
        "java" => &[
            ".java-version",
            ".sdkmanrc",
            ".tool-versions",
            "pom.xml (java.version)",
            "build.gradle (sourceCompatibility)",
        ],
        "kotlin" => &[".kotlin-version", ".sdkmanrc", ".tool-versions"],
        "scala" => &["build.sbt", ".scala-version", ".sdkmanrc", ".tool-versions"],
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
        "zig" => &[".zig-version", "build.zig.zon (minimum_zig_version)", ".tool-versions"],
        "dart" => &["pubspec.yaml (environment.sdk)", ".fvmrc", ".dart-version", ".tool-versions"],
        "lua" => &[".lua-version", ".tool-versions"],
        "groovy" => &[".sdkmanrc", ".tool-versions"],
        "elixir" => &[".elixir-version", "mix.exs (elixir)", ".tool-versions"],
        "erlang" => &[".erlang-version", ".tool-versions"],
        "swift" => &[".swift-version", "Package.swift (swift-tools-version)", ".tool-versions"],
        "julia" => &[".julia-version", "Project.toml (compat.julia)", ".tool-versions"],
        "perl" => &[".perl-version", ".tool-versions"],
        "r" => &[".Rversion", ".tool-versions"],
        "haskell" => &[".tool-versions"],
        "clojure" => &[".tool-versions"],
        "crystal" => &[".crystal-version", "shard.yml (crystal)", ".tool-versions"],
        "nim" => &[".nim-version", ".tool-versions"],
        "ocaml" => &[".ocaml-version", ".tool-versions"],
        "fortran" => &[".tool-versions"],
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
        "scala" => detect_scala(dir, source).await,
        "php" => detect_php(dir, source).await,
        "dotnet" => detect_dotnet(dir, source).await,
        "deno" => detect_deno(dir, source).await,
        "bun" => detect_bun(dir, source).await,
        "zig" => detect_zig(dir, source).await,
        "dart" => detect_dart(dir, source).await,
        "lua" => detect_lua(dir, source).await,
        "groovy" => detect_groovy(dir, source).await,
        "elixir" => detect_elixir(dir, source).await,
        "erlang" => detect_erlang(dir, source).await,
        "swift" => detect_swift(dir, source).await,
        "julia" => detect_julia(dir, source).await,
        "perl" => detect_perl(dir, source).await,
        "r" => detect_r(dir, source).await,
        "haskell" => detect_haskell(dir, source).await,
        "clojure" => detect_clojure(dir, source).await,
        "crystal" => detect_crystal(dir, source).await,
        "nim" => detect_nim(dir, source).await,
        "ocaml" => detect_ocaml(dir, source).await,
        "fortran" => detect_fortran(dir, source).await,
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
        "uv.toml (requires-python)" => {
            read_uv_toml_requires_python(dir.join("uv.toml")).await
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
        "pom.xml (java.version)" => {
            let path = dir.join("pom.xml");
            if !path.is_file() {
                return Ok(None);
            }
            let content = crate::platform::fs::read_file_string(&path).await?;
            match crate::provider::sdkman::extract_java_version_from_pom(&content) {
                Some(ver) => Ok(Some(DetectedValue {
                    value: ver,
                    source: source.to_string(),
                    path,
                })),
                None => Ok(None),
            }
        }
        "build.gradle (sourceCompatibility)" => {
            for name in &["build.gradle.kts", "build.gradle"] {
                let path = dir.join(name);
                if path.is_file() {
                    let content = crate::platform::fs::read_file_string(&path).await?;
                    if let Some(ver) =
                        crate::provider::sdkman::extract_java_version_from_gradle(&content)
                    {
                        return Ok(Some(DetectedValue {
                            value: ver,
                            source: source.to_string(),
                            path,
                        }));
                    }
                }
            }
            Ok(None)
        }
        _ => Ok(None),
    }
}

async fn detect_scala(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        "build.sbt" => read_build_sbt_scala_version(dir.join("build.sbt")).await,
        ".scala-version" => {
            read_version_file(dir.join(".scala-version"), ".scala-version").await
        }
        ".sdkmanrc" => read_sdkmanrc_version(dir.join(".sdkmanrc"), "scala").await,
        ".tool-versions" => {
            read_tool_versions(dir.join(".tool-versions"), &["scala"], ".tool-versions").await
        }
        _ => Ok(None),
    }
}

/// Extract Scala version from `build.sbt`.
/// Matches patterns like `scalaVersion := "3.3.1"` and `ThisBuild / scalaVersion := "2.13.12"`.
async fn read_build_sbt_scala_version(path: PathBuf) -> CogniaResult<Option<DetectedValue>> {
    if !path.is_file() {
        return Ok(None);
    }

    let content = match crate::platform::fs::read_file_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    let re = match regex::Regex::new(r#"scalaVersion\s*:=\s*"([^"]+)""#) {
        Ok(r) => r,
        Err(_) => return Ok(None),
    };

    if let Some(caps) = re.captures(&content) {
        if let Some(version) = caps.get(1) {
            let version = version.as_str().trim();
            if !version.is_empty() {
                return Ok(Some(DetectedValue {
                    value: version.to_string(),
                    source: "build.sbt".to_string(),
                    path,
                }));
            }
        }
    }

    Ok(None)
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

async fn detect_zig(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".zig-version" => read_version_file(dir.join(".zig-version"), ".zig-version").await,
        "build.zig.zon (minimum_zig_version)" => {
            read_build_zig_zon_min_version(dir.join("build.zig.zon")).await
        }
        ".tool-versions" => {
            read_tool_versions(dir.join(".tool-versions"), &["zig"], ".tool-versions").await
        }
        _ => Ok(None),
    }
}

async fn read_build_zig_zon_min_version(path: PathBuf) -> CogniaResult<Option<DetectedValue>> {
    if !path.is_file() {
        return Ok(None);
    }

    let content = match crate::platform::fs::read_file_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    // ZON is a Zig-specific format, not JSON/TOML. Use regex to extract the field.
    let re = match regex::Regex::new(r#"\.minimum_zig_version\s*=\s*"([^"]+)""#) {
        Ok(r) => r,
        Err(_) => return Ok(None),
    };

    if let Some(caps) = re.captures(&content) {
        if let Some(version) = caps.get(1) {
            let version = version.as_str().trim();
            if !version.is_empty() {
                return Ok(Some(DetectedValue {
                    value: version.to_string(),
                    source: "build.zig.zon (minimum_zig_version)".to_string(),
                    path,
                }));
            }
        }
    }

    Ok(None)
}

async fn detect_lua(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".lua-version" => read_version_file(dir.join(".lua-version"), ".lua-version").await,
        ".tool-versions" => {
            read_tool_versions(dir.join(".tool-versions"), &["lua"], ".tool-versions").await
        }
        _ => Ok(None),
    }
}

async fn detect_dart(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".dart-version" => read_version_file(dir.join(".dart-version"), ".dart-version").await,
        ".fvmrc" => read_fvmrc(dir.join(".fvmrc")).await,
        "pubspec.yaml (environment.sdk)" => read_pubspec_sdk(dir.join("pubspec.yaml")).await,
        ".tool-versions" => {
            read_tool_versions(
                dir.join(".tool-versions"),
                &["dart", "flutter"],
                ".tool-versions",
            )
            .await
        }
        _ => Ok(None),
    }
}

async fn read_fvmrc(path: PathBuf) -> CogniaResult<Option<DetectedValue>> {
    if !path.is_file() {
        return Ok(None);
    }

    let content = match crate::platform::fs::read_file_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    // Reuse the canonical .fvmrc parser from the FVM provider
    match crate::provider::fvm::parse_fvmrc(&content) {
        Some(version) => Ok(Some(DetectedValue {
            value: version,
            source: ".fvmrc".to_string(),
            path,
        })),
        None => Ok(None),
    }
}

async fn read_pubspec_sdk(path: PathBuf) -> CogniaResult<Option<DetectedValue>> {
    if !path.is_file() {
        return Ok(None);
    }

    let content = match crate::platform::fs::read_file_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    // pubspec.yaml uses YAML; the SDK constraint is under environment.sdk
    // Example: environment:\n  sdk: ">=3.0.0 <4.0.0"
    // We extract the first version-like number from the constraint.
    let doc: serde_json::Value = match serde_yaml::from_str(&content) {
        Ok(v) => v,
        Err(_) => return Ok(None),
    };

    let sdk = doc
        .get("environment")
        .and_then(|v| v.get("sdk"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .unwrap_or("");

    if sdk.is_empty() {
        return Ok(None);
    }

    Ok(Some(DetectedValue {
        value: sdk.to_string(),
        source: "pubspec.yaml (environment.sdk)".to_string(),
        path,
    }))
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

// ── uv.toml parser for Python ──

async fn read_uv_toml_requires_python(path: PathBuf) -> CogniaResult<Option<DetectedValue>> {
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
        .get("requires-python")
        .and_then(|v| v.as_str())
        .map(str::trim)
    {
        if !requires.is_empty() {
            return Ok(Some(DetectedValue {
                value: requires.to_string(),
                source: "uv.toml (requires-python)".to_string(),
                path,
            }));
        }
    }

    Ok(None)
}

// ── New language detect functions ──

async fn detect_groovy(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".sdkmanrc" => read_sdkmanrc_version(dir.join(".sdkmanrc"), "groovy").await,
        ".tool-versions" => {
            read_tool_versions(dir.join(".tool-versions"), &["groovy"], ".tool-versions").await
        }
        _ => Ok(None),
    }
}

async fn detect_elixir(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".elixir-version" => {
            read_version_file(dir.join(".elixir-version"), ".elixir-version").await
        }
        "mix.exs (elixir)" => read_mix_exs_elixir_version(dir.join("mix.exs")).await,
        ".tool-versions" => {
            read_tool_versions(dir.join(".tool-versions"), &["elixir"], ".tool-versions").await
        }
        _ => Ok(None),
    }
}

async fn detect_erlang(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".erlang-version" => {
            read_version_file(dir.join(".erlang-version"), ".erlang-version").await
        }
        ".tool-versions" => {
            read_tool_versions(dir.join(".tool-versions"), &["erlang"], ".tool-versions").await
        }
        _ => Ok(None),
    }
}

async fn detect_swift(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".swift-version" => {
            read_version_file(dir.join(".swift-version"), ".swift-version").await
        }
        "Package.swift (swift-tools-version)" => {
            read_package_swift_tools_version(dir.join("Package.swift")).await
        }
        ".tool-versions" => {
            read_tool_versions(dir.join(".tool-versions"), &["swift"], ".tool-versions").await
        }
        _ => Ok(None),
    }
}

async fn detect_julia(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".julia-version" => {
            read_version_file(dir.join(".julia-version"), ".julia-version").await
        }
        "Project.toml (compat.julia)" => {
            read_project_toml_julia_compat(dir.join("Project.toml")).await
        }
        ".tool-versions" => {
            read_tool_versions(dir.join(".tool-versions"), &["julia"], ".tool-versions").await
        }
        _ => Ok(None),
    }
}

async fn detect_perl(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".perl-version" => {
            read_version_file(dir.join(".perl-version"), ".perl-version").await
        }
        ".tool-versions" => {
            read_tool_versions(dir.join(".tool-versions"), &["perl"], ".tool-versions").await
        }
        _ => Ok(None),
    }
}

async fn detect_r(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".Rversion" => read_version_file(dir.join(".Rversion"), ".Rversion").await,
        ".tool-versions" => {
            read_tool_versions(dir.join(".tool-versions"), &["R"], ".tool-versions").await
        }
        _ => Ok(None),
    }
}

async fn detect_haskell(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".tool-versions" => {
            read_tool_versions(
                dir.join(".tool-versions"),
                &["haskell", "ghc"],
                ".tool-versions",
            )
            .await
        }
        _ => Ok(None),
    }
}

async fn detect_clojure(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".tool-versions" => {
            read_tool_versions(dir.join(".tool-versions"), &["clojure"], ".tool-versions").await
        }
        _ => Ok(None),
    }
}

async fn detect_crystal(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".crystal-version" => {
            read_version_file(dir.join(".crystal-version"), ".crystal-version").await
        }
        "shard.yml (crystal)" => read_shard_yml_crystal(dir.join("shard.yml")).await,
        ".tool-versions" => {
            read_tool_versions(dir.join(".tool-versions"), &["crystal"], ".tool-versions").await
        }
        _ => Ok(None),
    }
}

async fn detect_nim(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".nim-version" => read_version_file(dir.join(".nim-version"), ".nim-version").await,
        ".tool-versions" => {
            read_tool_versions(dir.join(".tool-versions"), &["nim"], ".tool-versions").await
        }
        _ => Ok(None),
    }
}

async fn detect_ocaml(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".ocaml-version" => {
            read_version_file(dir.join(".ocaml-version"), ".ocaml-version").await
        }
        ".tool-versions" => {
            read_tool_versions(dir.join(".tool-versions"), &["ocaml"], ".tool-versions").await
        }
        _ => Ok(None),
    }
}

async fn detect_fortran(dir: &Path, source: &str) -> CogniaResult<Option<DetectedValue>> {
    match source {
        ".tool-versions" => {
            read_tool_versions(dir.join(".tool-versions"), &["fortran"], ".tool-versions").await
        }
        _ => Ok(None),
    }
}

// ── New manifest parsers ──

async fn read_mix_exs_elixir_version(path: PathBuf) -> CogniaResult<Option<DetectedValue>> {
    if !path.is_file() {
        return Ok(None);
    }

    let content = match crate::platform::fs::read_file_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    let re = match regex::Regex::new(r#"elixir:\s*"([^"]+)""#) {
        Ok(r) => r,
        Err(_) => return Ok(None),
    };

    if let Some(caps) = re.captures(&content) {
        if let Some(version) = caps.get(1) {
            let version = version.as_str().trim();
            if !version.is_empty() {
                return Ok(Some(DetectedValue {
                    value: version.to_string(),
                    source: "mix.exs (elixir)".to_string(),
                    path,
                }));
            }
        }
    }

    Ok(None)
}

async fn read_package_swift_tools_version(path: PathBuf) -> CogniaResult<Option<DetectedValue>> {
    if !path.is_file() {
        return Ok(None);
    }

    let content = match crate::platform::fs::read_file_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    let re = match regex::Regex::new(r"swift-tools-version:\s*(\d+\.\d+(?:\.\d+)?)") {
        Ok(r) => r,
        Err(_) => return Ok(None),
    };

    if let Some(caps) = re.captures(&content) {
        if let Some(version) = caps.get(1) {
            let version = version.as_str().trim();
            if !version.is_empty() {
                return Ok(Some(DetectedValue {
                    value: version.to_string(),
                    source: "Package.swift (swift-tools-version)".to_string(),
                    path,
                }));
            }
        }
    }

    Ok(None)
}

async fn read_project_toml_julia_compat(path: PathBuf) -> CogniaResult<Option<DetectedValue>> {
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

    if let Some(julia) = doc
        .get("compat")
        .and_then(|v| v.get("julia"))
        .and_then(|v| v.as_str())
        .map(str::trim)
    {
        if !julia.is_empty() {
            return Ok(Some(DetectedValue {
                value: julia.to_string(),
                source: "Project.toml (compat.julia)".to_string(),
                path,
            }));
        }
    }

    Ok(None)
}

async fn read_shard_yml_crystal(path: PathBuf) -> CogniaResult<Option<DetectedValue>> {
    if !path.is_file() {
        return Ok(None);
    }

    let content = match crate::platform::fs::read_file_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    let doc: serde_json::Value = match serde_yaml::from_str(&content) {
        Ok(v) => v,
        Err(_) => return Ok(None),
    };

    let crystal = doc
        .get("crystal")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .unwrap_or("");

    if crystal.is_empty() {
        return Ok(None);
    }

    Ok(Some(DetectedValue {
        value: crystal.to_string(),
        source: "shard.yml (crystal)".to_string(),
        path,
    }))
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

    // ── Scala detection tests ──

    #[tokio::test]
    async fn scala_detects_scala_version_file() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(root.join(".scala-version"), "3.3.1")
            .await
            .unwrap();

        let sources = vec![".scala-version".to_string()];
        let detected = detect_env_version("scala", root, &sources)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(detected.env_type, "scala");
        assert_eq!(detected.version, "3.3.1");
        assert_eq!(detected.source, ".scala-version");
    }

    #[tokio::test]
    async fn scala_detects_sdkmanrc() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(root.join(".sdkmanrc"), "scala=3.4.0\njava=21.0.2-tem\n")
            .await
            .unwrap();

        let sources = vec![".sdkmanrc".to_string()];
        let detected = detect_env_version("scala", root, &sources)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(detected.env_type, "scala");
        assert_eq!(detected.version, "3.4.0");
        assert_eq!(detected.source, ".sdkmanrc");
    }

    #[tokio::test]
    async fn scala_detects_build_sbt() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(
            root.join("build.sbt"),
            r#"
name := "my-project"
version := "1.0.0"
scalaVersion := "2.13.12"
"#,
        )
        .await
        .unwrap();

        let sources = vec!["build.sbt".to_string()];
        let detected = detect_env_version("scala", root, &sources)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(detected.env_type, "scala");
        assert_eq!(detected.version, "2.13.12");
        assert_eq!(detected.source, "build.sbt");
    }

    #[tokio::test]
    async fn scala_detects_build_sbt_this_build_syntax() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(
            root.join("build.sbt"),
            r#"
ThisBuild / scalaVersion := "3.3.1"
ThisBuild / organization := "com.example"
"#,
        )
        .await
        .unwrap();

        let sources = vec!["build.sbt".to_string()];
        let detected = detect_env_version("scala", root, &sources)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(detected.version, "3.3.1");
    }

    #[tokio::test]
    async fn scala_build_sbt_returns_none_when_no_version() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(
            root.join("build.sbt"),
            r#"name := "my-project""#,
        )
        .await
        .unwrap();

        let sources = vec!["build.sbt".to_string()];
        let detected = detect_env_version("scala", root, &sources).await.unwrap();
        assert!(detected.is_none());
    }

    #[tokio::test]
    async fn scala_build_sbt_missing_file_returns_none() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        let sources = vec!["build.sbt".to_string()];
        let detected = detect_env_version("scala", root, &sources).await.unwrap();
        assert!(detected.is_none());
    }

    #[tokio::test]
    async fn scala_tool_versions_detection() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(root.join(".tool-versions"), "scala 3.4.2\njava 21.0.2\n")
            .await
            .unwrap();

        let sources = vec![".tool-versions".to_string()];
        let detected = detect_env_version("scala", root, &sources)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(detected.env_type, "scala");
        assert_eq!(detected.version, "3.4.2");
        assert_eq!(detected.source, ".tool-versions");
    }

    // ── Java pom.xml / build.gradle detection tests ──

    #[tokio::test]
    async fn java_detects_pom_xml_java_version() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(
            root.join("pom.xml"),
            r#"<project>
  <properties>
    <java.version>17</java.version>
  </properties>
</project>"#,
        )
        .await
        .unwrap();

        let sources = vec!["pom.xml (java.version)".to_string()];
        let detected = detect_env_version("java", root, &sources)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(detected.env_type, "java");
        assert_eq!(detected.version, "17");
        assert_eq!(detected.source, "pom.xml (java.version)");
    }

    #[tokio::test]
    async fn java_detects_pom_xml_compiler_release() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(
            root.join("pom.xml"),
            r#"<project>
  <properties>
    <maven.compiler.release>21</maven.compiler.release>
  </properties>
</project>"#,
        )
        .await
        .unwrap();

        let sources = vec!["pom.xml (java.version)".to_string()];
        let detected = detect_env_version("java", root, &sources)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(detected.version, "21");
    }

    #[tokio::test]
    async fn java_pom_xml_missing_returns_none() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        let sources = vec!["pom.xml (java.version)".to_string()];
        let detected = detect_env_version("java", root, &sources).await.unwrap();
        assert!(detected.is_none());
    }

    #[tokio::test]
    async fn java_detects_build_gradle_source_compat() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(
            root.join("build.gradle"),
            r#"
plugins {
    id 'java'
}
sourceCompatibility = '17'
"#,
        )
        .await
        .unwrap();

        let sources = vec!["build.gradle (sourceCompatibility)".to_string()];
        let detected = detect_env_version("java", root, &sources)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(detected.env_type, "java");
        assert_eq!(detected.version, "17");
        assert_eq!(detected.source, "build.gradle (sourceCompatibility)");
    }

    #[tokio::test]
    async fn java_detects_build_gradle_kts_over_gradle() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        // Both files exist, .kts should be checked first
        crate::platform::fs::write_file_string(
            root.join("build.gradle.kts"),
            r#"
java {
    sourceCompatibility = JavaVersion.VERSION_21
}
"#,
        )
        .await
        .unwrap();
        crate::platform::fs::write_file_string(
            root.join("build.gradle"),
            r#"sourceCompatibility = '11'"#,
        )
        .await
        .unwrap();

        let sources = vec!["build.gradle (sourceCompatibility)".to_string()];
        let detected = detect_env_version("java", root, &sources)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(detected.version, "21");
    }

    #[tokio::test]
    async fn java_build_gradle_missing_returns_none() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        let sources = vec!["build.gradle (sourceCompatibility)".to_string()];
        let detected = detect_env_version("java", root, &sources).await.unwrap();
        assert!(detected.is_none());
    }

    #[tokio::test]
    async fn java_traditional_sources_take_priority_over_manifest() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(root.join(".java-version"), "21")
            .await
            .unwrap();
        crate::platform::fs::write_file_string(
            root.join("pom.xml"),
            r#"<project><properties><java.version>17</java.version></properties></project>"#,
        )
        .await
        .unwrap();

        let sources = vec![
            ".java-version".to_string(),
            "pom.xml (java.version)".to_string(),
        ];
        let detected = detect_env_version("java", root, &sources)
            .await
            .unwrap()
            .unwrap();
        // .java-version is listed first, so it wins
        assert_eq!(detected.version, "21");
        assert_eq!(detected.source, ".java-version");
    }

    // ── Dart detection tests ──

    #[tokio::test]
    async fn dart_detects_from_dart_version_file() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(root.join(".dart-version"), "3.3.0")
            .await
            .unwrap();

        let sources = vec![".dart-version".to_string()];
        let detected = detect_env_version("dart", root, &sources)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(detected.env_type, "dart");
        assert_eq!(detected.version, "3.3.0");
        assert_eq!(detected.source, ".dart-version");
    }

    #[tokio::test]
    async fn dart_detects_from_fvmrc() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(
            root.join(".fvmrc"),
            r#"{"flutter": "3.19.0"}"#,
        )
        .await
        .unwrap();

        let sources = vec![".fvmrc".to_string()];
        let detected = detect_env_version("dart", root, &sources)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(detected.env_type, "dart");
        assert_eq!(detected.version, "3.19.0");
        assert_eq!(detected.source, ".fvmrc");
    }

    #[tokio::test]
    async fn dart_detects_from_fvmrc_channel() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(
            root.join(".fvmrc"),
            r#"{"flutter": "stable"}"#,
        )
        .await
        .unwrap();

        let sources = vec![".fvmrc".to_string()];
        let detected = detect_env_version("dart", root, &sources)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(detected.version, "stable");
    }

    #[tokio::test]
    async fn dart_fvmrc_invalid_json_returns_none() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(root.join(".fvmrc"), "not json at all")
            .await
            .unwrap();

        let sources = vec![".fvmrc".to_string()];
        let detected = detect_env_version("dart", root, &sources).await.unwrap();
        assert!(detected.is_none());
    }

    #[tokio::test]
    async fn dart_detects_from_pubspec_yaml() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(
            root.join("pubspec.yaml"),
            "name: my_app\nenvironment:\n  sdk: \">=3.0.0 <4.0.0\"\n",
        )
        .await
        .unwrap();

        let sources = vec!["pubspec.yaml (environment.sdk)".to_string()];
        let detected = detect_env_version("dart", root, &sources)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(detected.env_type, "dart");
        assert_eq!(detected.version, ">=3.0.0 <4.0.0");
        assert_eq!(detected.source, "pubspec.yaml (environment.sdk)");
    }

    #[tokio::test]
    async fn dart_pubspec_yaml_no_sdk_returns_none() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(
            root.join("pubspec.yaml"),
            "name: my_app\ndependencies:\n  http: ^1.0.0\n",
        )
        .await
        .unwrap();

        let sources = vec!["pubspec.yaml (environment.sdk)".to_string()];
        let detected = detect_env_version("dart", root, &sources).await.unwrap();
        assert!(detected.is_none());
    }

    #[tokio::test]
    async fn dart_detects_from_tool_versions_dart() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(
            root.join(".tool-versions"),
            "dart 3.3.0\nnode 20.10.0\n",
        )
        .await
        .unwrap();

        let sources = vec![".tool-versions".to_string()];
        let detected = detect_env_version("dart", root, &sources)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(detected.env_type, "dart");
        assert_eq!(detected.version, "3.3.0");
        assert_eq!(detected.source, ".tool-versions");
    }

    #[tokio::test]
    async fn dart_detects_from_tool_versions_flutter() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(
            root.join(".tool-versions"),
            "flutter 3.19.0\npython 3.12.0\n",
        )
        .await
        .unwrap();

        let sources = vec![".tool-versions".to_string()];
        let detected = detect_env_version("dart", root, &sources)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(detected.version, "3.19.0");
        assert_eq!(detected.source, ".tool-versions");
    }

    #[tokio::test]
    async fn dart_fvmrc_takes_priority_over_pubspec() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        crate::platform::fs::write_file_string(
            root.join(".fvmrc"),
            r#"{"flutter": "3.19.0"}"#,
        )
        .await
        .unwrap();
        crate::platform::fs::write_file_string(
            root.join("pubspec.yaml"),
            "name: my_app\nenvironment:\n  sdk: \">=3.0.0 <4.0.0\"\n",
        )
        .await
        .unwrap();

        let sources = vec![
            ".fvmrc".to_string(),
            "pubspec.yaml (environment.sdk)".to_string(),
        ];
        let detected = detect_env_version("dart", root, &sources)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(detected.version, "3.19.0");
        assert_eq!(detected.source, ".fvmrc");
    }
}
