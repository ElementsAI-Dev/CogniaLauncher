use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::env::{EnvModifications, Platform};
use crate::platform::process;
use crate::provider::cpp_compiler::{fingerprint_cpp_compiler, CppCompilerMetadata};
use crate::provider::support::SupportReason;
use async_trait::async_trait;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};

/// Environment type for system-installed runtimes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SystemEnvironmentType {
    Node,
    Python,
    Go,
    Rust,
    Ruby,
    Java,
    Kotlin,
    Php,
    Dotnet,
    Deno,
    Bun,
    Zig,
    Dart,
    Lua,
    Scala,
    Groovy,
    Elixir,
    Erlang,
    Swift,
    Julia,
    Perl,
    R,
    Haskell,
    Clojure,
    Crystal,
    Nim,
    Ocaml,
    Fortran,
    C,
    Cpp,
}

impl SystemEnvironmentType {
    pub fn id(&self) -> &'static str {
        match self {
            Self::Node => "system-node",
            Self::Python => "system-python",
            Self::Go => "system-go",
            Self::Rust => "system-rust",
            Self::Ruby => "system-ruby",
            Self::Java => "system-java",
            Self::Kotlin => "system-kotlin",
            Self::Php => "system-php",
            Self::Dotnet => "system-dotnet",
            Self::Deno => "system-deno",
            Self::Bun => "system-bun",
            Self::Zig => "system-zig",
            Self::Dart => "system-dart",
            Self::Lua => "system-lua",
            Self::Scala => "system-scala",
            Self::Groovy => "system-groovy",
            Self::Elixir => "system-elixir",
            Self::Erlang => "system-erlang",
            Self::Swift => "system-swift",
            Self::Julia => "system-julia",
            Self::Perl => "system-perl",
            Self::R => "system-r",
            Self::Haskell => "system-haskell",
            Self::Clojure => "system-clojure",
            Self::Crystal => "system-crystal",
            Self::Nim => "system-nim",
            Self::Ocaml => "system-ocaml",
            Self::Fortran => "system-fortran",
            Self::C => "system-c",
            Self::Cpp => "system-cpp",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Node => "Node.js (System)",
            Self::Python => "Python (System)",
            Self::Go => "Go (System)",
            Self::Rust => "Rust (System)",
            Self::Ruby => "Ruby (System)",
            Self::Java => "Java (System)",
            Self::Kotlin => "Kotlin (System)",
            Self::Php => "PHP (System)",
            Self::Dotnet => ".NET (System)",
            Self::Deno => "Deno (System)",
            Self::Bun => "Bun (System)",
            Self::Zig => "Zig (System)",
            Self::Dart => "Dart (System)",
            Self::Lua => "Lua (System)",
            Self::Scala => "Scala (System)",
            Self::Groovy => "Groovy (System)",
            Self::Elixir => "Elixir (System)",
            Self::Erlang => "Erlang/OTP (System)",
            Self::Swift => "Swift (System)",
            Self::Julia => "Julia (System)",
            Self::Perl => "Perl (System)",
            Self::R => "R (System)",
            Self::Haskell => "Haskell/GHC (System)",
            Self::Clojure => "Clojure (System)",
            Self::Crystal => "Crystal (System)",
            Self::Nim => "Nim (System)",
            Self::Ocaml => "OCaml (System)",
            Self::Fortran => "Fortran (System)",
            Self::C => "C (System)",
            Self::Cpp => "C++ (System)",
        }
    }

    pub fn env_type(&self) -> &'static str {
        match self {
            Self::Node => "node",
            Self::Python => "python",
            Self::Go => "go",
            Self::Rust => "rust",
            Self::Ruby => "ruby",
            Self::Java => "java",
            Self::Kotlin => "kotlin",
            Self::Php => "php",
            Self::Dotnet => "dotnet",
            Self::Deno => "deno",
            Self::Bun => "bun",
            Self::Zig => "zig",
            Self::Dart => "dart",
            Self::Lua => "lua",
            Self::Scala => "scala",
            Self::Groovy => "groovy",
            Self::Elixir => "elixir",
            Self::Erlang => "erlang",
            Self::Swift => "swift",
            Self::Julia => "julia",
            Self::Perl => "perl",
            Self::R => "r",
            Self::Haskell => "haskell",
            Self::Clojure => "clojure",
            Self::Crystal => "crystal",
            Self::Nim => "nim",
            Self::Ocaml => "ocaml",
            Self::Fortran => "fortran",
            Self::C => "c",
            Self::Cpp => "cpp",
        }
    }

    /// Get the detection configuration for this environment type
    pub fn detection_config(&self) -> SystemDetectionConfig {
        match self {
            Self::Node => SystemDetectionConfig {
                commands: vec!["node"],
                version_args: vec!["--version"],
                version_pattern: r"v?(\d+\.\d+\.\d+)",
                version_files: vec![".nvmrc", ".node-version", ".tool-versions"],
                manifest_files: vec![(
                    "package.json",
                    r#""engines"\s*:\s*\{[^}]*"node"\s*:\s*"([^"]+)""#,
                )],
            },
            Self::Python => SystemDetectionConfig {
                #[cfg(windows)]
                commands: vec!["python", "python3", "py"],
                #[cfg(not(windows))]
                commands: vec!["python3", "python"],
                version_args: vec!["--version"],
                version_pattern: r"Python (\d+\.\d+\.\d+)",
                version_files: vec![".python-version", ".tool-versions"],
                manifest_files: vec![
                    ("pyproject.toml", r#"python\s*=\s*"[^"]*(\d+\.\d+)"#),
                    ("Pipfile", r#"python_version\s*=\s*"(\d+\.\d+)"#),
                ],
            },
            Self::Go => SystemDetectionConfig {
                commands: vec!["go"],
                version_args: vec!["version"],
                version_pattern: r"go(\d+\.\d+(?:\.\d+)?)",
                version_files: vec![".go-version", ".tool-versions"],
                manifest_files: vec![("go.mod", r"^go\s+(\d+\.\d+(?:\.\d+)?)")],
            },
            Self::Rust => SystemDetectionConfig {
                commands: vec!["rustc"],
                version_args: vec!["--version"],
                version_pattern: r"rustc (\d+\.\d+\.\d+)",
                version_files: vec!["rust-toolchain", "rust-toolchain.toml", ".tool-versions"],
                manifest_files: vec![("Cargo.toml", r#"rust-version\s*=\s*"(\d+\.\d+(?:\.\d+)?)"#)],
            },
            Self::Ruby => SystemDetectionConfig {
                commands: vec!["ruby"],
                version_args: vec!["--version"],
                version_pattern: r"ruby (\d+\.\d+\.\d+)",
                version_files: vec![".ruby-version", ".tool-versions"],
                manifest_files: vec![("Gemfile", r#"ruby ['"](\d+\.\d+(?:\.\d+)?)"#)],
            },
            Self::Java => SystemDetectionConfig {
                commands: vec!["java"],
                version_args: vec!["-version"],
                version_pattern: r#"version "(\d+(?:[\._]\d+)*)""#,
                version_files: vec![".java-version", ".sdkmanrc", ".tool-versions"],
                manifest_files: vec![
                    ("pom.xml", ""),
                    ("build.gradle.kts", ""),
                    ("build.gradle", ""),
                    ("gradle/wrapper/gradle-wrapper.properties", ""),
                    (".mvn/wrapper/maven-wrapper.properties", ""),
                ],
            },
            Self::Kotlin => SystemDetectionConfig {
                commands: vec!["kotlinc"],
                version_args: vec!["-version"],
                version_pattern: r"kotlinc-jvm (\d+\.\d+\.\d+)",
                version_files: vec![".kotlin-version", ".tool-versions", ".sdkmanrc"],
                manifest_files: vec![],
            },
            Self::Php => SystemDetectionConfig {
                commands: vec!["php"],
                version_args: vec!["--version"],
                version_pattern: r"PHP (\d+\.\d+\.\d+)",
                version_files: vec![".php-version", ".tool-versions"],
                manifest_files: vec![("composer.json", r#""php"\s*:\s*"[^"]*(\d+\.\d+)"#)],
            },
            Self::Dotnet => SystemDetectionConfig {
                commands: vec!["dotnet"],
                version_args: vec!["--version"],
                version_pattern: r"(\d+\.\d+\.\d+)",
                version_files: vec!["global.json"],
                manifest_files: vec![],
            },
            Self::Deno => SystemDetectionConfig {
                commands: vec!["deno"],
                version_args: vec!["--version"],
                version_pattern: r"deno (\d+\.\d+\.\d+)",
                version_files: vec![".deno-version", ".tool-versions"],
                manifest_files: vec![],
            },
            Self::Bun => SystemDetectionConfig {
                commands: vec!["bun"],
                version_args: vec!["--version"],
                version_pattern: r"(\d+\.\d+\.\d+)",
                version_files: vec![".bun-version", ".tool-versions"],
                manifest_files: vec![],
            },
            Self::Zig => SystemDetectionConfig {
                commands: vec!["zig"],
                version_args: vec!["version"],
                version_pattern: r"(\d+\.\d+\.\d+(?:-dev\.\d+\+\w+)?)",
                version_files: vec![".zig-version", ".tool-versions"],
                manifest_files: vec![],
            },
            Self::Dart => SystemDetectionConfig {
                commands: vec!["dart"],
                version_args: vec!["--version"],
                version_pattern: r"Dart SDK version: (\d+\.\d+\.\d+)",
                version_files: vec![".dart-version", ".tool-versions"],
                manifest_files: vec![("pubspec.yaml", r#"sdk:\s*['"]?[>=<^]*\s*(\d+\.\d+\.\d+)"#)],
            },
            Self::Lua => SystemDetectionConfig {
                commands: vec!["lua"],
                version_args: vec!["-v"],
                version_pattern: r"Lua (\d+\.\d+(?:\.\d+)?)",
                version_files: vec![".lua-version", ".tool-versions"],
                manifest_files: vec![],
            },
            Self::Scala => SystemDetectionConfig {
                commands: vec!["scala"],
                version_args: vec!["-version"],
                version_pattern: r"version (\d+\.\d+\.\d+)",
                version_files: vec![".scala-version", ".tool-versions", ".sdkmanrc"],
                manifest_files: vec![],
            },
            Self::Groovy => SystemDetectionConfig {
                commands: vec!["groovy"],
                version_args: vec!["--version"],
                version_pattern: r"Groovy Version: (\d+\.\d+\.\d+)",
                version_files: vec![".tool-versions", ".sdkmanrc"],
                manifest_files: vec![],
            },
            Self::Elixir => SystemDetectionConfig {
                commands: vec!["elixir"],
                version_args: vec!["--version"],
                version_pattern: r"Elixir (\d+\.\d+\.\d+)",
                version_files: vec![".elixir-version", ".tool-versions"],
                manifest_files: vec![],
            },
            Self::Erlang => SystemDetectionConfig {
                commands: vec!["erl"],
                version_args: vec![
                    "-noshell",
                    "-eval",
                    r#"io:format("~s~n",[erlang:system_info(otp_release)]),halt()."#,
                ],
                version_pattern: r"(\d+)",
                version_files: vec![".erlang-version", ".tool-versions"],
                manifest_files: vec![],
            },
            Self::Swift => SystemDetectionConfig {
                commands: vec!["swift"],
                version_args: vec!["--version"],
                version_pattern: r"(?:Apple )?Swift version (\d+\.\d+(?:\.\d+)?)",
                version_files: vec![".swift-version", ".tool-versions"],
                manifest_files: vec![(
                    "Package.swift",
                    r"swift-tools-version:\s*(\d+\.\d+(?:\.\d+)?)",
                )],
            },
            Self::Julia => SystemDetectionConfig {
                commands: vec!["julia"],
                version_args: vec!["--version"],
                version_pattern: r"julia version (\d+\.\d+\.\d+)",
                version_files: vec![".julia-version", ".tool-versions"],
                manifest_files: vec![],
            },
            Self::Perl => SystemDetectionConfig {
                commands: vec!["perl"],
                version_args: vec!["-e", "print $^V"],
                version_pattern: r"v(\d+\.\d+\.\d+)",
                version_files: vec![".perl-version", ".tool-versions"],
                manifest_files: vec![],
            },
            Self::R => SystemDetectionConfig {
                commands: vec!["Rscript", "R"],
                version_args: vec!["--version"],
                version_pattern: r"(\d+\.\d+\.\d+)",
                version_files: vec![".Rversion", ".tool-versions"],
                manifest_files: vec![],
            },
            Self::Haskell => SystemDetectionConfig {
                commands: vec!["ghc"],
                version_args: vec!["--version"],
                version_pattern: r"version (\d+\.\d+\.\d+)",
                version_files: vec![".tool-versions"],
                manifest_files: vec![],
            },
            Self::Clojure => SystemDetectionConfig {
                #[cfg(windows)]
                commands: vec!["clojure", "clj"],
                #[cfg(not(windows))]
                commands: vec!["clj", "clojure"],
                version_args: vec!["--version"],
                version_pattern: r"version (\d+\.\d+\.\d+(?:\.\d+)?)",
                version_files: vec![".tool-versions"],
                manifest_files: vec![],
            },
            Self::Crystal => SystemDetectionConfig {
                commands: vec!["crystal"],
                version_args: vec!["--version"],
                version_pattern: r"Crystal (\d+\.\d+\.\d+)",
                version_files: vec![".crystal-version", ".tool-versions"],
                manifest_files: vec![],
            },
            Self::Nim => SystemDetectionConfig {
                commands: vec!["nim"],
                version_args: vec!["--version"],
                version_pattern: r"Version (\d+\.\d+\.\d+)",
                version_files: vec![".nim-version", ".tool-versions"],
                manifest_files: vec![],
            },
            Self::Ocaml => SystemDetectionConfig {
                commands: vec!["ocaml"],
                version_args: vec!["--version"],
                version_pattern: r"version (\d+\.\d+\.\d+)",
                version_files: vec![".ocaml-version", ".tool-versions"],
                manifest_files: vec![],
            },
            Self::Fortran => SystemDetectionConfig {
                commands: vec!["gfortran"],
                version_args: vec!["--version"],
                version_pattern: r"(\d+\.\d+\.\d+)",
                version_files: vec![".tool-versions"],
                manifest_files: vec![],
            },
            Self::C => SystemDetectionConfig {
                commands: vec!["gcc", "cc"],
                version_args: vec!["--version"],
                version_pattern: r"(\d+\.\d+\.\d+)",
                version_files: vec![".tool-versions"],
                manifest_files: vec![],
            },
            Self::Cpp => SystemDetectionConfig {
                #[cfg(windows)]
                commands: vec!["clang-cl", "clang++", "g++", "c++"],
                #[cfg(target_os = "macos")]
                commands: vec!["clang++", "c++", "g++"],
                #[cfg(all(not(windows), not(target_os = "macos")))]
                commands: vec!["g++", "clang++", "c++"],
                version_args: vec!["--version"],
                version_pattern: r"(\d+\.\d+\.\d+)",
                version_files: vec![".tool-versions"],
                manifest_files: vec![],
            },
        }
    }

    /// Get all environment types
    pub fn all() -> Vec<Self> {
        vec![
            Self::Node,
            Self::Python,
            Self::Go,
            Self::Rust,
            Self::Ruby,
            Self::Java,
            Self::Kotlin,
            Self::Php,
            Self::Dotnet,
            Self::Deno,
            Self::Bun,
            Self::Zig,
            Self::Dart,
            Self::Lua,
            Self::Scala,
            Self::Groovy,
            Self::Elixir,
            Self::Erlang,
            Self::Swift,
            Self::Julia,
            Self::Perl,
            Self::R,
            Self::Haskell,
            Self::Clojure,
            Self::Crystal,
            Self::Nim,
            Self::Ocaml,
            Self::Fortran,
            Self::C,
            Self::Cpp,
        ]
    }
}

/// Configuration for detecting a system-installed environment
#[derive(Debug, Clone)]
pub struct SystemDetectionConfig {
    pub commands: Vec<&'static str>,
    pub version_args: Vec<&'static str>,
    pub version_pattern: &'static str,
    pub version_files: Vec<&'static str>,
    pub manifest_files: Vec<(&'static str, &'static str)>,
}

#[derive(Debug, Clone)]
pub struct SystemExecutableDetection {
    pub version: String,
    pub path: PathBuf,
    pub compiler_metadata: Option<CppCompilerMetadata>,
}

/// Provider for detecting system-installed environments
/// This detects environments installed directly via official installers,
/// package managers (apt, brew, winget, scoop), or other means
pub struct SystemEnvironmentProvider {
    env_type: SystemEnvironmentType,
    cached_version: tokio::sync::RwLock<Option<String>>,
    cached_path: tokio::sync::RwLock<Option<PathBuf>>,
    cached_cpp_compiler: tokio::sync::RwLock<Option<CppCompilerMetadata>>,
}

impl SystemEnvironmentProvider {
    pub fn new(env_type: SystemEnvironmentType) -> Self {
        Self {
            env_type,
            cached_version: tokio::sync::RwLock::new(None),
            cached_path: tokio::sync::RwLock::new(None),
            cached_cpp_compiler: tokio::sync::RwLock::new(None),
        }
    }

    /// Detect version from system executable
    pub async fn detect_system_runtime(&self) -> CogniaResult<Option<SystemExecutableDetection>> {
        let config = self.env_type.detection_config();
        let version_re = Regex::new(config.version_pattern)
            .map_err(|error| CogniaError::Provider(error.to_string()))?;
        let mut detections: Vec<(usize, String, SystemExecutableDetection)> = Vec::new();

        for (priority, cmd) in config.commands.iter().enumerate() {
            // Check if command exists in PATH
            if let Some(path) = process::which(cmd).await {
                let path = PathBuf::from(&path);

                // Run version command
                let args: Vec<&str> = config.version_args.to_vec();
                if let Ok(output) = process::execute(cmd, &args, None).await {
                    if output.success {
                        let output_text = if output.stdout.is_empty() {
                            &output.stderr
                        } else {
                            &output.stdout
                        };

                        if let Some(caps) = version_re.captures(output_text) {
                            if let Some(version) = caps.get(1) {
                                let mut ver = version.as_str().to_string();
                                // Normalize Lua versions: "5.4" -> "5.4.0"
                                if matches!(self.env_type, SystemEnvironmentType::Lua) {
                                    if ver.matches('.').count() == 1 {
                                        ver.push_str(".0");
                                    }
                                }

                                detections.push((
                                    priority,
                                    path.to_string_lossy().to_string(),
                                    SystemExecutableDetection {
                                        version: ver,
                                        path: path.clone(),
                                        compiler_metadata: if matches!(
                                            self.env_type,
                                            SystemEnvironmentType::Cpp
                                        ) {
                                            fingerprint_cpp_compiler(
                                                cmd,
                                                &path,
                                                &output.stdout,
                                                &output.stderr,
                                                Some("path"),
                                            )
                                        } else {
                                            None
                                        },
                                    },
                                ));
                            }
                        }
                    }
                }
            }
        }

        detections.sort_by(|left, right| left.0.cmp(&right.0).then_with(|| left.1.cmp(&right.1)));

        Ok(detections
            .into_iter()
            .next()
            .map(|(_, _, detection)| detection))
    }

    async fn detect_system_version(&self) -> CogniaResult<Option<(String, PathBuf)>> {
        Ok(self
            .detect_system_runtime()
            .await?
            .map(|detection| (detection.version, detection.path)))
    }

    pub async fn current_cpp_compiler_metadata(&self) -> CogniaResult<Option<CppCompilerMetadata>> {
        if !matches!(self.env_type, SystemEnvironmentType::Cpp) {
            return Ok(None);
        }

        {
            let cache = self.cached_cpp_compiler.read().await;
            if let Some(metadata) = cache.clone() {
                return Ok(Some(metadata));
            }
        }

        let detected = self.detect_system_runtime().await?;
        if let Some(metadata) = detected.and_then(|detection| detection.compiler_metadata) {
            let mut cache = self.cached_cpp_compiler.write().await;
            *cache = Some(metadata.clone());
            return Ok(Some(metadata));
        }

        Ok(None)
    }

    /// Detect version from project files
    async fn detect_from_project_files(
        &self,
        start_path: &Path,
    ) -> CogniaResult<Option<VersionDetection>> {
        let config = self.env_type.detection_config();
        let mut current = start_path.to_path_buf();

        loop {
            // Check version files (e.g., .node-version, .python-version)
            for version_file in &config.version_files {
                let file_path = current.join(version_file);
                if file_path.exists() {
                    if *version_file == ".tool-versions" {
                        // Parse .tool-versions format (asdf-style)
                        if let Ok(content) = crate::platform::fs::read_file_string(&file_path).await
                        {
                            let env_type = self.env_type.env_type();
                            for line in content.lines() {
                                let line = line.trim();
                                if line.starts_with(env_type)
                                    || (env_type == "node" && line.starts_with("nodejs"))
                                    || (env_type == "go" && line.starts_with("golang"))
                                {
                                    let parts: Vec<&str> = line.split_whitespace().collect();
                                    if parts.len() >= 2 {
                                        return Ok(Some(VersionDetection {
                                            version: parts[1].to_string(),
                                            source: VersionSource::LocalFile,
                                            source_path: Some(file_path),
                                        }));
                                    }
                                }
                            }
                        }
                    } else if *version_file == ".sdkmanrc" {
                        if let Ok(content) = crate::platform::fs::read_file_string(&file_path).await
                        {
                            let env_type = self.env_type.env_type();
                            let entries = crate::provider::sdkman::parse_sdkmanrc(&content);
                            if let Some((_, value)) =
                                entries.iter().find(|(key, _)| key == env_type)
                            {
                                return Ok(Some(VersionDetection {
                                    version: value.clone(),
                                    source: VersionSource::LocalFile,
                                    source_path: Some(file_path),
                                }));
                            }
                        }
                    } else {
                        // Simple version file
                        if let Ok(content) = crate::platform::fs::read_file_string(&file_path).await
                        {
                            let version = content.trim().to_string();
                            if !version.is_empty() && !version.starts_with('#') {
                                return Ok(Some(VersionDetection {
                                    version,
                                    source: VersionSource::LocalFile,
                                    source_path: Some(file_path),
                                }));
                            }
                        }
                    }
                }
            }

            // Check manifest files
            for (manifest_file, pattern) in &config.manifest_files {
                let file_path = current.join(manifest_file);
                if file_path.exists() {
                    if let Ok(content) = crate::platform::fs::read_file_string(&file_path).await {
                        if self.env_type == SystemEnvironmentType::Java {
                            let detected = match *manifest_file {
                                "pom.xml" => {
                                    crate::provider::sdkman::extract_java_version_from_pom(&content)
                                }
                                "build.gradle" | "build.gradle.kts" => {
                                    crate::provider::sdkman::extract_java_version_from_gradle(
                                        &content,
                                    )
                                }
                                "gradle/wrapper/gradle-wrapper.properties" => {
                                    crate::provider::sdkman::extract_gradle_wrapper_version(
                                        &content,
                                    )
                                    .map(|version| format!("gradle@{}", version))
                                }
                                ".mvn/wrapper/maven-wrapper.properties" => {
                                    crate::provider::sdkman::extract_maven_wrapper_version(&content)
                                        .map(|version| format!("maven@{}", version))
                                }
                                _ => None,
                            };

                            if let Some(version) = detected {
                                return Ok(Some(VersionDetection {
                                    version,
                                    source: VersionSource::Manifest,
                                    source_path: Some(file_path),
                                }));
                            }
                            continue;
                        }

                        if !pattern.is_empty() {
                            if let Ok(re) = Regex::new(pattern) {
                                if let Some(caps) = re.captures(&content) {
                                    if let Some(version) = caps.get(1) {
                                        return Ok(Some(VersionDetection {
                                            version: version.as_str().to_string(),
                                            source: VersionSource::Manifest,
                                            source_path: Some(file_path),
                                        }));
                                    }
                                }
                            }
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
}

#[async_trait]
impl Provider for SystemEnvironmentProvider {
    fn id(&self) -> &str {
        self.env_type.id()
    }

    fn display_name(&self) -> &str {
        self.env_type.display_name()
    }

    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([Capability::List])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }

    fn priority(&self) -> i32 {
        // Lower priority than version managers
        50
    }

    async fn is_available(&self) -> bool {
        if let Ok(Some(_)) = self.detect_system_version().await {
            return true;
        }
        false
    }

    async fn unavailable_reason(&self) -> Option<SupportReason> {
        if !matches!(self.env_type, SystemEnvironmentType::Cpp) {
            return None;
        }

        let commands = self.env_type.detection_config().commands.join(", ");
        Some(SupportReason {
            code: "cpp-compiler-not-found",
            message: format!(
                "No runnable C++ compiler was found in PATH (checked {})",
                commands
            ),
        })
    }

    async fn search(
        &self,
        _query: &str,
        _options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        Ok(vec![])
    }

    async fn get_package_info(&self, _name: &str) -> CogniaResult<PackageInfo> {
        Err(CogniaError::Provider(
            "System provider does not support package info".into(),
        ))
    }

    async fn get_versions(&self, _name: &str) -> CogniaResult<Vec<VersionInfo>> {
        // Return the installed system version
        if let Ok(Some((version, _))) = self.detect_system_version().await {
            Ok(vec![VersionInfo {
                version,
                release_date: None,
                deprecated: false,
                yanked: false,
            }])
        } else {
            Ok(vec![])
        }
    }

    async fn install(&self, _request: InstallRequest) -> CogniaResult<InstallReceipt> {
        Err(CogniaError::Provider(
            "System provider does not support installation. Use a version manager or system package manager.".into(),
        ))
    }

    async fn uninstall(&self, _request: UninstallRequest) -> CogniaResult<()> {
        Err(CogniaError::Provider(
            "System provider does not support uninstallation. Use your system package manager."
                .into(),
        ))
    }

    async fn list_installed(
        &self,
        _filter: InstalledFilter,
    ) -> CogniaResult<Vec<InstalledPackage>> {
        if let Ok(Some((version, path))) = self.detect_system_version().await {
            Ok(vec![InstalledPackage {
                name: self.env_type.env_type().to_string(),
                version,
                provider: self.id().to_string(),
                install_path: path,
                installed_at: String::new(),
                is_global: true,
            }])
        } else {
            Ok(vec![])
        }
    }

    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        Ok(vec![])
    }
}

#[async_trait]
impl EnvironmentProvider for SystemEnvironmentProvider {
    async fn list_installed_versions(&self) -> CogniaResult<Vec<InstalledVersion>> {
        if let Ok(Some((version, path))) = self.detect_system_version().await {
            Ok(vec![InstalledVersion {
                version,
                install_path: path,
                size: None,
                installed_at: None,
                is_current: true,
            }])
        } else {
            Ok(vec![])
        }
    }

    async fn get_current_version(&self) -> CogniaResult<Option<String>> {
        // Check cache first
        {
            let cache = self.cached_version.read().await;
            if let Some(ref version) = *cache {
                return Ok(Some(version.clone()));
            }
        }

        // Detect and cache
        if let Ok(Some(detection)) = self.detect_system_runtime().await {
            let version = detection.version;
            {
                let mut cache = self.cached_version.write().await;
                *cache = Some(version.clone());
            }
            {
                let mut path_cache = self.cached_path.write().await;
                *path_cache = Some(detection.path);
            }
            {
                let mut compiler_cache = self.cached_cpp_compiler.write().await;
                *compiler_cache = detection.compiler_metadata;
            }
            return Ok(Some(version));
        }

        Ok(None)
    }

    async fn set_global_version(&self, _version: &str) -> CogniaResult<()> {
        Err(CogniaError::Provider(
            "System provider does not support version switching. Use a version manager like fnm, pyenv, or goenv.".into(),
        ))
    }

    async fn set_local_version(&self, _project_path: &Path, _version: &str) -> CogniaResult<()> {
        Err(CogniaError::Provider(
            "System provider does not support local version files. Use a version manager.".into(),
        ))
    }

    async fn detect_version(&self, start_path: &Path) -> CogniaResult<Option<VersionDetection>> {
        // First check for project-specific version files
        if let Ok(Some(detection)) = self.detect_from_project_files(start_path).await {
            return Ok(Some(detection));
        }

        // Fall back to system executable
        if let Ok(Some((version, path))) = self.detect_system_version().await {
            return Ok(Some(VersionDetection {
                version,
                source: VersionSource::SystemExecutable,
                source_path: Some(path),
            }));
        }

        Ok(None)
    }

    fn get_env_modifications(&self, _version: &str) -> CogniaResult<EnvModifications> {
        // System installations are already in PATH
        Ok(EnvModifications::new())
    }

    fn version_file_name(&self) -> &str {
        let config = self.env_type.detection_config();
        config.version_files.first().unwrap_or(&".version")
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_system_go_detection() {
        let provider = SystemEnvironmentProvider::new(SystemEnvironmentType::Go);
        let available = provider.is_available().await;
        println!("Go system available: {}", available);

        if available {
            let version = provider.get_current_version().await.unwrap();
            println!("Go version: {:?}", version);
        }
    }

    #[tokio::test]
    async fn test_system_node_detection() {
        let provider = SystemEnvironmentProvider::new(SystemEnvironmentType::Node);
        let available = provider.is_available().await;
        println!("Node system available: {}", available);

        if available {
            let version = provider.get_current_version().await.unwrap();
            println!("Node version: {:?}", version);
        }
    }

    #[tokio::test]
    async fn test_system_python_detection() {
        let provider = SystemEnvironmentProvider::new(SystemEnvironmentType::Python);
        let available = provider.is_available().await;
        println!("Python system available: {}", available);

        if available {
            let version = provider.get_current_version().await.unwrap();
            println!("Python version: {:?}", version);
        }
    }

    #[tokio::test]
    async fn test_system_dart_detection() {
        let provider = SystemEnvironmentProvider::new(SystemEnvironmentType::Dart);
        let available = provider.is_available().await;
        println!("Dart system available: {}", available);

        if available {
            let version = provider.get_current_version().await.unwrap();
            println!("Dart version: {:?}", version);
        }
    }

    #[tokio::test]
    async fn test_all_system_environments() {
        for env_type in SystemEnvironmentType::all() {
            let provider = SystemEnvironmentProvider::new(env_type);
            let available = provider.is_available().await;
            println!("{:?} available: {}", env_type, available);
        }
    }

    #[test]
    fn test_dart_system_config() {
        let provider = SystemEnvironmentProvider::new(SystemEnvironmentType::Dart);
        assert_eq!(provider.id(), "system-dart");
        assert_eq!(provider.display_name(), "Dart (System)");
        assert_eq!(provider.version_file_name(), ".dart-version");
    }

    #[test]
    fn test_c_system_config() {
        let provider = SystemEnvironmentProvider::new(SystemEnvironmentType::C);
        assert_eq!(provider.id(), "system-c");
        assert_eq!(provider.display_name(), "C (System)");
        let config = SystemEnvironmentType::C.detection_config();
        assert_eq!(config.commands, vec!["gcc", "cc"]);
        assert_eq!(config.version_args, vec!["--version"]);
        assert_eq!(config.version_pattern, r"(\d+\.\d+\.\d+)");
        assert_eq!(config.version_files, vec![".tool-versions"]);
        assert!(config.manifest_files.is_empty());
    }

    #[test]
    fn test_cpp_system_config() {
        let provider = SystemEnvironmentProvider::new(SystemEnvironmentType::Cpp);
        assert_eq!(provider.id(), "system-cpp");
        assert_eq!(provider.display_name(), "C++ (System)");
        let config = SystemEnvironmentType::Cpp.detection_config();
        #[cfg(windows)]
        assert_eq!(config.commands, vec!["clang-cl", "clang++", "g++", "c++"]);
        #[cfg(target_os = "macos")]
        assert_eq!(config.commands, vec!["clang++", "c++", "g++"]);
        #[cfg(all(not(windows), not(target_os = "macos")))]
        assert_eq!(config.commands, vec!["g++", "clang++", "c++"]);
        assert_eq!(config.version_args, vec!["--version"]);
        assert_eq!(config.version_pattern, r"(\d+\.\d+\.\d+)");
        assert_eq!(config.version_files, vec![".tool-versions"]);
        assert!(config.manifest_files.is_empty());
    }

    #[tokio::test]
    async fn test_java_project_detection_uses_sdkman_java_key() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        crate::platform::fs::write_file_string(
            root.join(".sdkmanrc"),
            "java=21.0.2-tem\ngradle=8.11.1\n",
        )
        .await
        .unwrap();

        let provider = SystemEnvironmentProvider::new(SystemEnvironmentType::Java);
        let detected = provider
            .detect_from_project_files(root)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(detected.version, "21.0.2-tem");
        assert!(matches!(detected.source, VersionSource::LocalFile));
        assert_eq!(
            detected
                .source_path
                .as_ref()
                .and_then(|p| p.file_name())
                .and_then(|n| n.to_str()),
            Some(".sdkmanrc")
        );
    }

    #[tokio::test]
    async fn test_java_project_detection_reads_gradle_wrapper_context() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let wrapper_dir = root.join("gradle").join("wrapper");
        std::fs::create_dir_all(&wrapper_dir).unwrap();
        crate::platform::fs::write_file_string(
            wrapper_dir.join("gradle-wrapper.properties"),
            "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.11.1-all.zip",
        )
        .await
        .unwrap();

        let provider = SystemEnvironmentProvider::new(SystemEnvironmentType::Java);
        let detected = provider
            .detect_from_project_files(root)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(detected.version, "gradle@8.11.1");
        assert!(matches!(detected.source, VersionSource::Manifest));
    }

    #[tokio::test]
    async fn test_java_project_detection_prefers_pom_over_wrapper_context() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let wrapper_dir = root.join("gradle").join("wrapper");
        std::fs::create_dir_all(&wrapper_dir).unwrap();
        crate::platform::fs::write_file_string(
            root.join("pom.xml"),
            "<project><properties><java.version>17</java.version></properties></project>",
        )
        .await
        .unwrap();
        crate::platform::fs::write_file_string(
            wrapper_dir.join("gradle-wrapper.properties"),
            "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.11.1-bin.zip",
        )
        .await
        .unwrap();

        let provider = SystemEnvironmentProvider::new(SystemEnvironmentType::Java);
        let detected = provider
            .detect_from_project_files(root)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(detected.version, "17");
        assert!(matches!(detected.source, VersionSource::Manifest));
        assert_eq!(
            detected
                .source_path
                .as_ref()
                .and_then(|p| p.file_name())
                .and_then(|n| n.to_str()),
            Some("pom.xml")
        );
    }

    #[tokio::test]
    async fn test_java_project_detection_ignores_invalid_sdkmanrc_value() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        crate::platform::fs::write_file_string(root.join(".sdkmanrc"), "java=${jdk.version}\n")
            .await
            .unwrap();

        let provider = SystemEnvironmentProvider::new(SystemEnvironmentType::Java);
        let detected = provider.detect_from_project_files(root).await.unwrap();
        assert!(detected.is_none());
    }

    #[tokio::test]
    async fn test_java_project_detection_prefers_java_version_file_over_wrapper_context() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let wrapper_dir = root.join(".mvn").join("wrapper");
        std::fs::create_dir_all(&wrapper_dir).unwrap();
        crate::platform::fs::write_file_string(root.join(".java-version"), "21")
            .await
            .unwrap();
        crate::platform::fs::write_file_string(
            wrapper_dir.join("maven-wrapper.properties"),
            "distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip",
        )
        .await
        .unwrap();

        let provider = SystemEnvironmentProvider::new(SystemEnvironmentType::Java);
        let detected = provider
            .detect_from_project_files(root)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(detected.version, "21");
        assert!(matches!(detected.source, VersionSource::LocalFile));
    }

    #[test]
    fn test_c_env_type() {
        assert_eq!(SystemEnvironmentType::C.env_type(), "c");
        assert_eq!(SystemEnvironmentType::Cpp.env_type(), "cpp");
    }

    #[test]
    fn test_c_cpp_in_all() {
        let all = SystemEnvironmentType::all();
        assert!(all.contains(&SystemEnvironmentType::C));
        assert!(all.contains(&SystemEnvironmentType::Cpp));
    }

    #[test]
    fn test_c_cpp_provider_traits() {
        let c_provider = SystemEnvironmentProvider::new(SystemEnvironmentType::C);
        assert_eq!(c_provider.priority(), 50);
        assert!(c_provider
            .capabilities()
            .contains(&crate::provider::traits::Capability::List));
        assert_eq!(c_provider.version_file_name(), ".tool-versions");

        let cpp_provider = SystemEnvironmentProvider::new(SystemEnvironmentType::Cpp);
        assert_eq!(cpp_provider.priority(), 50);
        assert!(cpp_provider
            .capabilities()
            .contains(&crate::provider::traits::Capability::List));
        assert_eq!(cpp_provider.version_file_name(), ".tool-versions");
    }

    #[test]
    fn test_c_cpp_version_pattern_matches_gcc_output() {
        let config = SystemEnvironmentType::C.detection_config();
        let re = regex::Regex::new(config.version_pattern).unwrap();

        // gcc output: "gcc (Ubuntu 13.2.0-23ubuntu4) 13.2.0"
        let caps = re.captures("gcc (Ubuntu 13.2.0-23ubuntu4) 13.2.0");
        assert!(caps.is_some());
        assert_eq!(caps.unwrap().get(1).unwrap().as_str(), "13.2.0");

        // clang output: "Apple clang version 15.0.0 (clang-1500.0.40.1)"
        let caps = re.captures("Apple clang version 15.0.0 (clang-1500.0.40.1)");
        assert!(caps.is_some());
        assert_eq!(caps.unwrap().get(1).unwrap().as_str(), "15.0.0");
    }

    #[test]
    fn test_cpp_version_pattern_matches_gpp_output() {
        let config = SystemEnvironmentType::Cpp.detection_config();
        let re = regex::Regex::new(config.version_pattern).unwrap();

        // g++ output: "g++ (GCC) 14.1.0"
        let caps = re.captures("g++ (GCC) 14.1.0");
        assert!(caps.is_some());
        assert_eq!(caps.unwrap().get(1).unwrap().as_str(), "14.1.0");

        // clang++ output: "clang version 18.1.3"
        let caps = re.captures("clang version 18.1.3");
        assert!(caps.is_some());
        assert_eq!(caps.unwrap().get(1).unwrap().as_str(), "18.1.3");
    }

    #[tokio::test]
    async fn test_system_c_detection() {
        let provider = SystemEnvironmentProvider::new(SystemEnvironmentType::C);
        let available = provider.is_available().await;
        println!("C system available: {}", available);

        if available {
            let version = provider.get_current_version().await.unwrap();
            println!("C compiler version: {:?}", version);
            assert!(version.is_some());
        }
    }

    #[tokio::test]
    async fn test_system_cpp_detection() {
        let provider = SystemEnvironmentProvider::new(SystemEnvironmentType::Cpp);
        let available = provider.is_available().await;
        println!("C++ system available: {}", available);

        if available {
            let version = provider.get_current_version().await.unwrap();
            println!("C++ compiler version: {:?}", version);
            assert!(version.is_some());
        }
    }

    #[tokio::test]
    async fn test_system_cpp_unavailable_reason_is_compiler_specific() {
        let provider = SystemEnvironmentProvider::new(SystemEnvironmentType::Cpp);
        let reason = provider.unavailable_reason().await.unwrap();

        assert_eq!(reason.code, "cpp-compiler-not-found");
        assert!(reason.message.contains("C++ compiler"));
    }

    #[test]
    fn test_all_version_patterns() {
        let test_cases: Vec<(SystemEnvironmentType, &str, &str)> = vec![
            (SystemEnvironmentType::Node, "v22.12.0", "22.12.0"),
            (SystemEnvironmentType::Python, "Python 3.12.4", "3.12.4"),
            (SystemEnvironmentType::Go, "go version go1.23.4 windows/amd64", "1.23.4"),
            (SystemEnvironmentType::Rust, "rustc 1.83.0 (90b35a623 2024-11-26)", "1.83.0"),
            (SystemEnvironmentType::Ruby, "ruby 3.3.6 (2024-11-05 revision 75015d4c1f) [x86_64-linux]", "3.3.6"),
            (SystemEnvironmentType::Java, "openjdk version \"21.0.5\" 2024-10-15", "21.0.5"),
            (SystemEnvironmentType::Java, "java version \"1.8.0_412\" 2024-04-16", "1.8.0_412"),
            (SystemEnvironmentType::Kotlin, "kotlinc-jvm 2.1.0 (JRE 21.0.5+11)", "2.1.0"),
            (SystemEnvironmentType::Php, "PHP 8.3.14 (cli) (built: Nov 21 2024 16:53:30) (NTS)", "8.3.14"),
            (SystemEnvironmentType::Dotnet, "9.0.101", "9.0.101"),
            (SystemEnvironmentType::Deno, "deno 2.1.4 (stable, release, x86_64-pc-windows-msvc)", "2.1.4"),
            (SystemEnvironmentType::Bun, "1.1.42", "1.1.42"),
            (SystemEnvironmentType::Zig, "0.13.0", "0.13.0"),
            (SystemEnvironmentType::Zig, "0.14.0-dev.2851+b074a1aea", "0.14.0-dev.2851+b074a1aea"),
            (SystemEnvironmentType::Dart, "Dart SDK version: 3.6.0 (stable) (Tue Dec 3 14:09:13 2024 +0000) on \"windows_x64\"", "3.6.0"),
            (SystemEnvironmentType::Lua, "Lua 5.4.7  Copyright (C) 1994-2024 Lua.org, PUC-Rio", "5.4.7"),
            (SystemEnvironmentType::Lua, "Lua 5.4  Copyright (C) 1994-2024 Lua.org, PUC-Rio", "5.4"),
            (SystemEnvironmentType::Scala, "Scala code runner version 3.6.2 -- Copyright 2002-2024, LAMP/EPFL", "3.6.2"),
            (SystemEnvironmentType::Groovy, "Groovy Version: 4.0.24 JVM: 21.0.5 Vendor: Eclipse Adoptium", "4.0.24"),
            (SystemEnvironmentType::Elixir, "Elixir 1.18.1 (compiled with Erlang/OTP 27)", "1.18.1"),
            (SystemEnvironmentType::Erlang, "27", "27"),
            (SystemEnvironmentType::Swift, "Swift version 6.0.3 (swift-6.0.3-RELEASE)", "6.0.3"),
            (SystemEnvironmentType::Swift, "Apple Swift version 6.0.3 (swiftlang-6.0.3.1.10 clang-1600.0.30.1)", "6.0.3"),
            (SystemEnvironmentType::Julia, "julia version 1.11.2", "1.11.2"),
            (SystemEnvironmentType::Perl, "v5.40.0", "5.40.0"),
            (SystemEnvironmentType::R, "R version 4.4.2 (2024-10-31)", "4.4.2"),
            (SystemEnvironmentType::R, "R scripting front-end version 4.4.2 (2024-10-31)", "4.4.2"),
            (SystemEnvironmentType::Haskell, "The Glorious Glasgow Haskell Compilation System, version 9.10.1", "9.10.1"),
            (SystemEnvironmentType::Clojure, "Clojure CLI version 1.12.0.1530", "1.12.0.1530"),
            (SystemEnvironmentType::Crystal, "Crystal 1.14.0 (2024-10-09)", "1.14.0"),
            (SystemEnvironmentType::Nim, "Nim Compiler Version 2.2.0 [Windows: amd64]", "2.2.0"),
            (SystemEnvironmentType::Ocaml, "The OCaml toplevel, version 5.2.1", "5.2.1"),
            (SystemEnvironmentType::Fortran, "GNU Fortran (Ubuntu 13.2.0-23ubuntu4) 13.2.0", "13.2.0"),
            (SystemEnvironmentType::C, "gcc (Ubuntu 13.2.0-23ubuntu4) 13.2.0", "13.2.0"),
            (SystemEnvironmentType::C, "Apple clang version 16.0.0 (clang-1600.0.26.6)", "16.0.0"),
            (SystemEnvironmentType::Cpp, "g++ (GCC) 14.2.0", "14.2.0"),
            (SystemEnvironmentType::Cpp, "clang version 19.1.0", "19.1.0"),
        ];

        for (env_type, output, expected) in test_cases {
            let config = env_type.detection_config();
            let re = regex::Regex::new(config.version_pattern).unwrap();
            if let Some(caps) = re.captures(output) {
                let version = caps.get(1).map(|m| m.as_str()).unwrap_or("");
                assert_eq!(
                    version, expected,
                    "Failed for {:?} with output: {}",
                    env_type, output
                );
            } else {
                panic!("No match for {:?} with output: {}", env_type, output);
            }
        }
    }

    #[test]
    fn test_manifest_version_patterns() {
        let test_cases: Vec<(&str, SystemEnvironmentType, &str, &str, &str)> = vec![
            // (label, env_type, manifest_file, content, expected_version)
            (
                "node_package_json",
                SystemEnvironmentType::Node,
                "package.json",
                r#"{ "engines": { "node": ">=18.0.0" } }"#,
                ">=18.0.0",
            ),
            (
                "python_pyproject",
                SystemEnvironmentType::Python,
                "pyproject.toml",
                r#"requires-python = ">=3.11""#,
                "3.11",
            ),
            (
                "python_pipfile",
                SystemEnvironmentType::Python,
                "Pipfile",
                r#"python_version = "3.11""#,
                "3.11",
            ),
            (
                "go_mod",
                SystemEnvironmentType::Go,
                "go.mod",
                "go 1.23\n\nrequire (\n)",
                "1.23",
            ),
            (
                "rust_cargo",
                SystemEnvironmentType::Rust,
                "Cargo.toml",
                "[package]\nname = \"myapp\"\nrust-version = \"1.75\"",
                "1.75",
            ),
            (
                "ruby_gemfile",
                SystemEnvironmentType::Ruby,
                "Gemfile",
                "source 'https://rubygems.org'\nruby '3.3.0'",
                "3.3.0",
            ),
            (
                "php_composer",
                SystemEnvironmentType::Php,
                "composer.json",
                r#"{ "require": { "php": "^8.2" } }"#,
                "8.2",
            ),
            (
                "dart_pubspec",
                SystemEnvironmentType::Dart,
                "pubspec.yaml",
                "environment:\n  sdk: \"^3.0.0\"",
                "3.0.0",
            ),
            (
                "swift_package",
                SystemEnvironmentType::Swift,
                "Package.swift",
                "// swift-tools-version: 5.10\nimport PackageDescription",
                "5.10",
            ),
        ];

        for (label, env_type, manifest_file, content, expected) in test_cases {
            let config = env_type.detection_config();
            let manifest = config
                .manifest_files
                .iter()
                .find(|(f, _)| *f == manifest_file);
            assert!(
                manifest.is_some(),
                "Manifest file '{}' not found in config for {:?} (label: {})",
                manifest_file,
                env_type,
                label
            );
            let (_, pattern) = manifest.unwrap();
            let pattern: &str = pattern;
            assert!(
                !pattern.is_empty(),
                "Pattern is empty for {} (label: {})",
                manifest_file,
                label
            );
            let re = regex::Regex::new(pattern).unwrap_or_else(|e| {
                panic!(
                    "Invalid regex for {} (label: {}): {}",
                    manifest_file, label, e
                )
            });
            if let Some(caps) = re.captures(content) {
                let version = caps.get(1).map(|m| m.as_str()).unwrap_or("");
                assert_eq!(
                    version, expected,
                    "Failed for manifest {} (label: {}) with content: {}",
                    manifest_file, label, content
                );
            } else {
                panic!(
                    "No match for manifest {} (label: {}) with content: {}",
                    manifest_file, label, content
                );
            }
        }
    }

    #[test]
    fn test_lua_version_normalization_logic() {
        // Verify the normalization logic: 2-part Lua versions get ".0" appended
        let two_part = "5.4";
        let three_part = "5.4.7";
        assert_eq!(two_part.matches('.').count(), 1);
        assert_eq!(three_part.matches('.').count(), 2);

        let mut ver = two_part.to_string();
        if ver.matches('.').count() == 1 {
            ver.push_str(".0");
        }
        assert_eq!(ver, "5.4.0");

        let mut ver = three_part.to_string();
        if ver.matches('.').count() == 1 {
            ver.push_str(".0");
        }
        assert_eq!(ver, "5.4.7");
    }

    #[test]
    fn test_java_version_pattern_handles_underscore() {
        let config = SystemEnvironmentType::Java.detection_config();
        let re = regex::Regex::new(config.version_pattern).unwrap();

        // OpenJDK modern
        let caps = re
            .captures("openjdk version \"21.0.5\" 2024-10-15")
            .unwrap();
        assert_eq!(caps.get(1).unwrap().as_str(), "21.0.5");

        // Oracle JDK 8 with underscore build number
        let caps = re
            .captures("java version \"1.8.0_412\" 2024-04-16")
            .unwrap();
        assert_eq!(caps.get(1).unwrap().as_str(), "1.8.0_412");

        // Simple major version
        let caps = re.captures("openjdk version \"17\" 2021-09-14").unwrap();
        assert_eq!(caps.get(1).unwrap().as_str(), "17");
    }
}
