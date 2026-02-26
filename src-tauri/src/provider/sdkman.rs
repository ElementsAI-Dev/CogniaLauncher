use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::{dirs_home, EnvModifications, Platform},
    process::{self, ProcessOptions},
};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::Duration;

// ──────────────────────────────────────────────────────
// Shared SDKMAN infrastructure
// ──────────────────────────────────────────────────────

/// Detect the SDKMAN installation directory
fn detect_sdkman_dir() -> Option<PathBuf> {
    // Check SDKMAN_DIR environment variable first
    if let Ok(dir) = std::env::var("SDKMAN_DIR") {
        let p = PathBuf::from(&dir);
        if p.exists() {
            return Some(p);
        }
    }
    // Default location
    dirs_home().map(|h| h.join(".sdkman"))
}

/// Run an `sdk` subcommand via shell sourcing
async fn run_sdk(sdkman_dir: &Path, args: &[&str]) -> CogniaResult<String> {
    let init_script = sdkman_dir.join("bin").join("sdkman-init.sh");

    // SDKMAN_COLOUR_ENABLE=false suppresses ANSI codes in output
    let cmd = format!(
        "export SDKMAN_COLOUR_ENABLE=false && source \"{}\" && sdk {}",
        init_script.display(),
        args.join(" ")
    );

    let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
    let output = process::execute_shell(&cmd, Some(opts)).await?;

    if output.success {
        Ok(clean_sdk_output(&output.stdout))
    } else {
        // Some sdk commands write useful text to stderr (e.g. `java -version`)
        let combined = if output.stdout.is_empty() {
            output.stderr.clone()
        } else {
            output.stdout.clone()
        };
        Err(CogniaError::Provider(if combined.is_empty() {
            output.stderr
        } else {
            combined
        }))
    }
}

/// Strip ANSI escape sequences and trailing whitespace from SDKMAN output
fn clean_sdk_output(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == 0x1b && i + 1 < bytes.len() && bytes[i + 1] == b'[' {
            // Skip ESC [ ... final byte
            i += 2;
            while i < bytes.len() && !(0x40..=0x7E).contains(&bytes[i]) {
                i += 1;
            }
            if i < bytes.len() {
                i += 1; // skip final byte
            }
        } else {
            result.push(bytes[i] as char);
            i += 1;
        }
    }
    result
}

/// Parse the pipe-delimited `sdk list java` output into (vendor, version_str, dist, status, identifier) tuples.
/// Lines look like: ` Vendor        | Use | Version      | Dist    | Status     | Identifier`
pub fn parse_sdk_list_java(output: &str) -> Vec<SdkListEntry> {
    output
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.is_empty()
                || trimmed.starts_with('=')
                || trimmed.starts_with("Available")
                || trimmed.starts_with("Vendor")
                || trimmed.starts_with("Use the")
                || trimmed.starts_with("---")
            {
                return None;
            }
            let parts: Vec<&str> = line.split('|').map(|s| s.trim()).collect();
            if parts.len() >= 6 {
                let vendor = parts[0].to_string();
                let identifier = parts[5].to_string();
                let status = parts[4].to_string();
                let version_str = parts[2].to_string();
                Some(SdkListEntry {
                    vendor,
                    version: version_str,
                    identifier,
                    installed: status.contains("installed") || status.contains("local"),
                    in_use: status.contains(">>>") || parts[1].contains(">>>"),
                })
            } else {
                None
            }
        })
        .collect()
}

/// Parse the simpler `sdk list <candidate>` output for non-java candidates (Kotlin, Gradle, etc.)
/// These produce a grid of version strings separated by whitespace.
pub fn parse_sdk_list_versions(output: &str) -> Vec<String> {
    let mut versions = Vec::new();
    let mut in_versions = false;
    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("=") || trimmed.starts_with("Available") {
            in_versions = true;
            continue;
        }
        if !in_versions {
            continue;
        }
        if trimmed.is_empty() || trimmed.starts_with("Use the") {
            continue;
        }
        // Versions are separated by whitespace, with optional > marker and * for installed
        for tok in trimmed.split_whitespace() {
            let v = tok.trim_start_matches('>').trim_end_matches('*').trim();
            if !v.is_empty() && v.chars().next().is_some_and(|c| c.is_ascii_digit()) {
                versions.push(v.to_string());
            }
        }
    }
    versions
}

/// Parse `.sdkmanrc` file content and return a map of candidate → version
pub fn parse_sdkmanrc(content: &str) -> Vec<(String, String)> {
    content
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                return None;
            }
            let (key, value) = line.split_once('=')?;
            let key = key.trim().to_string();
            let value = value.trim().to_string();
            if key.is_empty() || value.is_empty() {
                return None;
            }
            Some((key, value))
        })
        .collect()
}

/// Extract Java version from pom.xml content.
/// Checks: java.version, maven.compiler.source, maven.compiler.target, maven.compiler.release
pub fn extract_java_version_from_pom(content: &str) -> Option<String> {
    // Priority order: java.version > maven.compiler.release > maven.compiler.source > maven.compiler.target
    let tags = [
        ("<java.version>", "</java.version>"),
        ("<maven.compiler.release>", "</maven.compiler.release>"),
        ("<maven.compiler.source>", "</maven.compiler.source>"),
        ("<maven.compiler.target>", "</maven.compiler.target>"),
    ];
    for (open, close) in &tags {
        for line in content.lines() {
            let trimmed = line.trim();
            if let Some(rest) = trimmed.strip_prefix(open) {
                if let Some(ver) = rest.strip_suffix(close) {
                    let ver = ver.trim();
                    if !ver.is_empty() && !ver.starts_with('$') {
                        return Some(ver.to_string());
                    }
                }
            }
        }
    }
    None
}

/// Extract Java version from build.gradle or build.gradle.kts content.
/// Checks: sourceCompatibility, targetCompatibility, jvmTarget, toolchain languageVersion
pub fn extract_java_version_from_gradle(content: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        // sourceCompatibility = JavaVersion.VERSION_17 or sourceCompatibility = '17'
        if trimmed.starts_with("sourceCompatibility") || trimmed.starts_with("targetCompatibility")
        {
            if let Some(ver) = extract_gradle_version_value(trimmed) {
                return Some(ver);
            }
        }
        // jvmTarget = "17" (Kotlin)
        if trimmed.starts_with("jvmTarget") {
            if let Some(ver) = extract_gradle_quoted_value(trimmed) {
                return Some(ver);
            }
        }
        // languageVersion.set(JavaLanguageVersion.of(17))
        if trimmed.contains("JavaLanguageVersion.of(") {
            if let Some(start) = trimmed.find("JavaLanguageVersion.of(") {
                let rest = &trimmed[start + "JavaLanguageVersion.of(".len()..];
                if let Some(end) = rest.find(')') {
                    let ver = rest[..end].trim().trim_matches('"').trim_matches('\'');
                    if !ver.is_empty() {
                        return Some(ver.to_string());
                    }
                }
            }
        }
    }
    None
}

/// Extract Kotlin version from build.gradle or build.gradle.kts content.
/// Checks: kotlin plugin version, kotlin("jvm") version
pub fn extract_kotlin_version_from_gradle(content: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        // id("org.jetbrains.kotlin.jvm") version "2.0.0"
        // id 'org.jetbrains.kotlin.jvm' version '2.0.0'
        if trimmed.contains("org.jetbrains.kotlin") && trimmed.contains("version") {
            if let Some(ver) = extract_gradle_version_after_keyword(trimmed) {
                return Some(ver);
            }
        }
        // kotlin_version = '2.0.0' or ext.kotlin_version = '2.0.0'
        if (trimmed.starts_with("kotlin_version") || trimmed.contains("kotlin_version"))
            && trimmed.contains('=')
        {
            if let Some(ver) = extract_gradle_quoted_value(trimmed) {
                return Some(ver);
            }
        }
    }
    None
}

/// Extract Gradle version from gradle/wrapper/gradle-wrapper.properties
pub fn extract_gradle_wrapper_version(content: &str) -> Option<String> {
    // distributionUrl=https\://services.gradle.org/distributions/gradle-8.5-bin.zip
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("distributionUrl") {
            // Extract version from gradle-X.Y.Z- pattern
            if let Some(pos) = trimmed.find("gradle-") {
                let rest = &trimmed[pos + "gradle-".len()..];
                if let Some(end) = rest.find('-') {
                    let ver = &rest[..end];
                    if !ver.is_empty() {
                        return Some(ver.to_string());
                    }
                }
            }
        }
    }
    None
}

fn extract_gradle_version_value(line: &str) -> Option<String> {
    // Handle: JavaVersion.VERSION_17
    if let Some(pos) = line.find("VERSION_") {
        let rest = &line[pos + "VERSION_".len()..];
        let ver: String = rest
            .chars()
            .take_while(|c| c.is_ascii_digit() || *c == '_')
            .collect();
        let ver = ver.replace('_', ".");
        if !ver.is_empty() {
            return Some(ver);
        }
    }
    // Handle: = '17' or = "17" or = 17
    extract_gradle_quoted_value(line)
}

fn extract_gradle_quoted_value(line: &str) -> Option<String> {
    if let Some(eq_pos) = line.find('=') {
        let rhs = line[eq_pos + 1..].trim();
        let ver = rhs
            .trim_matches(|c: char| c == '\'' || c == '"' || c.is_whitespace())
            .to_string();
        if !ver.is_empty() && ver.chars().next().is_some_and(|c| c.is_ascii_digit()) {
            return Some(ver);
        }
    }
    None
}

fn extract_gradle_version_after_keyword(line: &str) -> Option<String> {
    // ... version "X.Y.Z" or version 'X.Y.Z'
    if let Some(pos) = line.rfind("version") {
        let rest = line[pos + "version".len()..].trim();
        let ver = rest
            .trim_matches(|c: char| c == '\'' || c == '"' || c.is_whitespace() || c == '(')
            .trim_end_matches(')')
            .to_string();
        if !ver.is_empty() && ver.chars().next().is_some_and(|c| c.is_ascii_digit()) {
            return Some(ver);
        }
    }
    None
}

#[derive(Debug, Clone)]
pub struct SdkListEntry {
    pub vendor: String,
    pub version: String,
    pub identifier: String,
    pub installed: bool,
    pub in_use: bool,
}

// ──────────────────────────────────────────────────────
// SdkmanProvider — parameterized by candidate name
// ──────────────────────────────────────────────────────

/// SDKMAN! provider parameterized by candidate name.
/// Can manage Java, Kotlin, Gradle, Maven, Scala, and any other SDKMAN candidate.
pub struct SdkmanProvider {
    candidate: String,
    sdkman_dir: Option<PathBuf>,
}

impl SdkmanProvider {
    /// Create a provider for the given SDKMAN candidate (e.g. "java", "kotlin", "gradle")
    pub fn new(candidate: &str) -> Self {
        Self {
            candidate: candidate.to_string(),
            sdkman_dir: detect_sdkman_dir(),
        }
    }

    /// Create the default Java SDKMAN provider
    pub fn java() -> Self {
        Self::new("java")
    }

    /// Create a Kotlin SDKMAN provider
    pub fn kotlin() -> Self {
        Self::new("kotlin")
    }

    fn sdkman_dir(&self) -> CogniaResult<PathBuf> {
        self.sdkman_dir
            .clone()
            .ok_or_else(|| CogniaError::Provider("SDKMAN_DIR not found".into()))
    }

    async fn run_sdk(&self, args: &[&str]) -> CogniaResult<String> {
        let dir = self.sdkman_dir()?;
        run_sdk(&dir, args).await
    }

    fn candidates_dir(&self) -> CogniaResult<PathBuf> {
        Ok(self.sdkman_dir()?.join("candidates").join(&self.candidate))
    }

    fn is_java(&self) -> bool {
        self.candidate == "java"
    }

    fn is_kotlin(&self) -> bool {
        self.candidate == "kotlin"
    }

    fn provider_id(&self) -> String {
        if self.is_java() {
            "sdkman".to_string()
        } else {
            format!("sdkman-{}", self.candidate)
        }
    }

    fn provider_display_name(&self) -> String {
        match self.candidate.as_str() {
            "java" => "SDKMAN! (Java SDK Manager)".to_string(),
            "kotlin" => "SDKMAN! (Kotlin)".to_string(),
            "gradle" => "SDKMAN! (Gradle)".to_string(),
            "maven" => "SDKMAN! (Maven)".to_string(),
            "scala" => "SDKMAN! (Scala)".to_string(),
            other => format!("SDKMAN! ({})", other),
        }
    }

    /// List SDKMAN candidates for this candidate type including remote versions
    pub async fn list_remote_versions(&self) -> CogniaResult<Vec<String>> {
        let output = self.run_sdk(&["list", &self.candidate]).await?;
        if self.is_java() {
            Ok(parse_sdk_list_java(&output)
                .into_iter()
                .map(|e| e.identifier)
                .collect())
        } else {
            Ok(parse_sdk_list_versions(&output))
        }
    }

    /// List all SDKMAN candidates supported by this installation
    pub async fn list_candidates(&self) -> CogniaResult<Vec<String>> {
        let output = self.run_sdk(&["list"]).await?;
        let mut candidates = Vec::new();
        for line in output.lines() {
            let trimmed = line.trim();
            // sdk list output shows candidate names followed by descriptions
            if let Some(first_word) = trimmed.split_whitespace().next() {
                if first_word
                    .chars()
                    .all(|c| c.is_ascii_lowercase() || c == '-')
                    && !first_word.is_empty()
                    && first_word.len() < 30
                {
                    candidates.push(first_word.to_string());
                }
            }
        }
        Ok(candidates)
    }
}

impl Default for SdkmanProvider {
    fn default() -> Self {
        Self::java()
    }
}

#[async_trait]
impl Provider for SdkmanProvider {
    fn id(&self) -> &str {
        // Return a static str for the primary providers; for dynamic ones we leak
        // This is safe because provider IDs are long-lived singletons
        match self.candidate.as_str() {
            "java" => "sdkman",
            "kotlin" => "sdkman-kotlin",
            "gradle" => "sdkman-gradle",
            "maven" => "sdkman-maven",
            "scala" => "sdkman-scala",
            _ => Box::leak(self.provider_id().into_boxed_str()),
        }
    }

    fn display_name(&self) -> &str {
        match self.candidate.as_str() {
            "java" => "SDKMAN! (Java SDK Manager)",
            "kotlin" => "SDKMAN! (Kotlin)",
            "gradle" => "SDKMAN! (Gradle)",
            "maven" => "SDKMAN! (Maven)",
            "groovy" => "SDKMAN! (Groovy)",
            "scala" => "SDKMAN! (Scala)",
            _ => Box::leak(self.provider_display_name().into_boxed_str()),
        }
    }

    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
            Capability::Update,
            Capability::Upgrade,
            Capability::VersionSwitch,
            Capability::MultiVersion,
            Capability::ProjectLocal,
        ])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::MacOS, Platform::Linux]
    }

    fn priority(&self) -> i32 {
        match self.candidate.as_str() {
            "java" => 80,
            "kotlin" => 78,
            _ => 75,
        }
    }

    async fn is_available(&self) -> bool {
        let Some(sdkman_dir) = &self.sdkman_dir else {
            return false;
        };
        // Check init script exists
        if !sdkman_dir.join("bin").join("sdkman-init.sh").exists() {
            return false;
        }
        // Verify sdk command actually works
        match run_sdk(sdkman_dir, &["version"]).await {
            Ok(out) => !out.is_empty(),
            Err(_) => {
                // Fallback: if run_sdk fails but init script exists, it's still available
                true
            }
        }
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let output = self.run_sdk(&["list", &self.candidate]).await?;
        let limit = options.limit.unwrap_or(30);

        if self.is_java() {
            let entries = parse_sdk_list_java(&output);
            Ok(entries
                .into_iter()
                .filter(|e| {
                    query.is_empty()
                        || e.identifier.contains(query)
                        || e.vendor.to_lowercase().contains(&query.to_lowercase())
                })
                .take(limit)
                .map(|e| PackageSummary {
                    name: e.identifier.clone(),
                    description: Some(format!("{} Java {}", e.vendor, e.version)),
                    latest_version: Some(e.identifier),
                    provider: self.id().to_string(),
                })
                .collect())
        } else {
            let versions = parse_sdk_list_versions(&output);
            Ok(versions
                .into_iter()
                .filter(|v| query.is_empty() || v.contains(query))
                .take(limit)
                .map(|v| PackageSummary {
                    name: v.clone(),
                    description: Some(format!("{} {}", self.candidate, v)),
                    latest_version: Some(v),
                    provider: self.id().to_string(),
                })
                .collect())
        }
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let version = name
            .strip_prefix(&format!("{}@", self.candidate))
            .unwrap_or(name);

        let display = match self.candidate.as_str() {
            "java" => format!("Java {}", version),
            "kotlin" => format!("Kotlin {}", version),
            "gradle" => format!("Gradle {}", version),
            "maven" => format!("Maven {}", version),
            other => format!("{} {}", other, version),
        };

        let homepage = match self.candidate.as_str() {
            "java" => "https://adoptium.net",
            "kotlin" => "https://kotlinlang.org",
            "gradle" => "https://gradle.org",
            "maven" => "https://maven.apache.org",
            "scala" => "https://scala-lang.org",
            _ => "https://sdkman.io",
        };

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(display),
            description: Some(format!("{} managed by SDKMAN!", self.candidate)),
            homepage: Some(homepage.to_string()),
            license: Some("Various".into()),
            repository: None,
            versions: vec![VersionInfo {
                version: version.to_string(),
                release_date: None,
                deprecated: false,
                yanked: false,
            }],
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, _name: &str) -> CogniaResult<Vec<VersionInfo>> {
        // First try to list remote versions for comprehensive results
        match self.run_sdk(&["list", &self.candidate]).await {
            Ok(output) => {
                let versions = if self.is_java() {
                    parse_sdk_list_java(&output)
                        .into_iter()
                        .map(|e| VersionInfo {
                            version: e.identifier,
                            release_date: None,
                            deprecated: false,
                            yanked: false,
                        })
                        .collect()
                } else {
                    parse_sdk_list_versions(&output)
                        .into_iter()
                        .map(|v| VersionInfo {
                            version: v,
                            release_date: None,
                            deprecated: false,
                            yanked: false,
                        })
                        .collect()
                };
                Ok(versions)
            }
            Err(_) => {
                // Fallback: list locally installed versions from filesystem
                let dir = self.candidates_dir()?;
                if !dir.exists() {
                    return Ok(vec![]);
                }
                let mut versions = Vec::new();
                if let Ok(entries) = std::fs::read_dir(&dir) {
                    for entry in entries.flatten() {
                        if entry.path().is_dir() {
                            if let Some(name) = entry.file_name().to_str() {
                                if name != "current" {
                                    versions.push(VersionInfo {
                                        version: name.to_string(),
                                        release_date: None,
                                        deprecated: false,
                                        yanked: false,
                                    });
                                }
                            }
                        }
                    }
                }
                Ok(versions)
            }
        }
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let version = req
            .version
            .ok_or_else(|| CogniaError::Provider("Version required for SDKMAN install".into()))?;

        self.run_sdk(&["install", &self.candidate, &version])
            .await?;

        let dir = self.candidates_dir()?;
        let install_path = dir.join(&version);

        Ok(InstallReceipt {
            name: self.candidate.clone(),
            version,
            provider: self.id().to_string(),
            install_path,
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let version = req
            .version
            .ok_or_else(|| CogniaError::Provider("Version required for SDKMAN uninstall".into()))?;

        self.run_sdk(&["uninstall", &self.candidate, &version])
            .await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let dir = self.candidates_dir()?;

        if !dir.exists() {
            return Ok(vec![]);
        }

        let mut packages = Vec::new();
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    if let Some(version) = entry.file_name().to_str() {
                        if version == "current" {
                            continue;
                        }

                        let name = format!("{}@{}", self.candidate, version);

                        if let Some(ref name_filter) = filter.name_filter {
                            if !name.contains(name_filter) && !version.contains(name_filter) {
                                continue;
                            }
                        }

                        packages.push(InstalledPackage {
                            name,
                            version: version.to_string(),
                            provider: self.id().into(),
                            install_path: entry.path(),
                            installed_at: String::new(),
                            is_global: true,
                        });
                    }
                }
            }
        }

        Ok(packages)
    }

    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        // Use `sdk upgrade <candidate>` dry-run by parsing list output
        let dir = self.candidates_dir()?;
        if !dir.exists() {
            return Ok(vec![]);
        }

        // Get current version
        let current_link = dir.join("current");
        let current_version = if current_link.exists() {
            std::fs::read_link(&current_link)
                .ok()
                .and_then(|t| t.file_name().map(|n| n.to_string_lossy().to_string()))
        } else {
            None
        };

        let Some(current) = current_version else {
            return Ok(vec![]);
        };

        // Try to get latest available version
        match self.run_sdk(&["list", &self.candidate]).await {
            Ok(output) => {
                let latest = if self.is_java() {
                    parse_sdk_list_java(&output)
                        .first()
                        .map(|e| e.identifier.clone())
                } else {
                    parse_sdk_list_versions(&output).first().cloned()
                };

                if let Some(latest) = latest {
                    if latest != current {
                        return Ok(vec![UpdateInfo {
                            name: self.candidate.clone(),
                            current_version: current,
                            latest_version: latest,
                            provider: self.id().to_string(),
                        }]);
                    }
                }
                Ok(vec![])
            }
            Err(_) => Ok(vec![]),
        }
    }
}

// ──────────────────────────────────────────────────────
// EnvironmentProvider implementation
// ──────────────────────────────────────────────────────

#[async_trait]
impl EnvironmentProvider for SdkmanProvider {
    async fn list_installed_versions(&self) -> CogniaResult<Vec<InstalledVersion>> {
        let dir = self.candidates_dir()?;
        let current = self.get_current_version().await?.unwrap_or_default();

        if !dir.exists() {
            return Ok(vec![]);
        }

        let mut versions = Vec::new();
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    if let Some(version) = entry.file_name().to_str() {
                        if version == "current" {
                            continue;
                        }
                        // Get install timestamp from dir metadata
                        let installed_at = entry
                            .metadata()
                            .ok()
                            .and_then(|m| m.modified().ok())
                            .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339());
                        versions.push(InstalledVersion {
                            version: version.to_string(),
                            install_path: entry.path(),
                            size: None,
                            installed_at,
                            is_current: version == current,
                        });
                    }
                }
            }
        }

        Ok(versions)
    }

    async fn get_current_version(&self) -> CogniaResult<Option<String>> {
        let dir = self.candidates_dir()?;
        let current_link = dir.join("current");

        if current_link.exists() {
            if let Ok(target) = std::fs::read_link(&current_link) {
                if let Some(version) = target.file_name().and_then(|n| n.to_str()) {
                    return Ok(Some(version.to_string()));
                }
            }
        }

        // Fallback: try `sdk current <candidate>`
        if let Ok(output) = self.run_sdk(&["current", &self.candidate]).await {
            // Output like "Using java version 21.0.4-tem"
            for line in output.lines() {
                let trimmed = line.trim();
                if trimmed.contains("version") || trimmed.contains(&self.candidate) {
                    if let Some(ver) = trimmed.split_whitespace().last() {
                        if !ver.is_empty() && ver != "version" {
                            return Ok(Some(ver.to_string()));
                        }
                    }
                }
            }
        }

        Ok(None)
    }

    async fn set_global_version(&self, version: &str) -> CogniaResult<()> {
        self.run_sdk(&["default", &self.candidate, version]).await?;
        Ok(())
    }

    async fn set_local_version(&self, project_path: &Path, version: &str) -> CogniaResult<()> {
        // Update or create .sdkmanrc file preserving other candidates
        let sdkmanrc = project_path.join(".sdkmanrc");
        let mut entries: Vec<(String, String)> = if sdkmanrc.exists() {
            if let Ok(content) = crate::platform::fs::read_file_string(&sdkmanrc).await {
                parse_sdkmanrc(&content)
            } else {
                vec![]
            }
        } else {
            vec![]
        };

        // Update or insert our candidate
        let mut found = false;
        for (k, v) in entries.iter_mut() {
            if k == &self.candidate {
                *v = version.to_string();
                found = true;
                break;
            }
        }
        if !found {
            entries.push((self.candidate.clone(), version.to_string()));
        }

        // Write back
        let mut content = String::from("# Enable auto-env through the sdkman_auto_env config\n# Add key=value pairs of SDKs to use below\n");
        for (k, v) in &entries {
            content.push_str(&format!("{}={}\n", k, v));
        }
        crate::platform::fs::write_file_string(&sdkmanrc, &content).await?;
        Ok(())
    }

    async fn detect_version(&self, start_path: &Path) -> CogniaResult<Option<VersionDetection>> {
        let mut current = start_path.to_path_buf();

        // Walk up directory tree looking for version files
        loop {
            // 1. Check candidate-specific version file
            let version_file_name = self.version_file_name();
            let version_file = current.join(version_file_name);
            if version_file.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&version_file).await {
                    let version = content.trim().to_string();
                    if !version.is_empty() && !version.starts_with('#') {
                        return Ok(Some(VersionDetection {
                            version,
                            source: VersionSource::LocalFile,
                            source_path: Some(version_file),
                        }));
                    }
                }
            }

            // 2. Check .sdkmanrc file (supports all candidates)
            let sdkmanrc = current.join(".sdkmanrc");
            if sdkmanrc.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&sdkmanrc).await {
                    let entries = parse_sdkmanrc(&content);
                    for (key, value) in &entries {
                        if key == &self.candidate {
                            return Ok(Some(VersionDetection {
                                version: value.clone(),
                                source: VersionSource::LocalFile,
                                source_path: Some(sdkmanrc),
                            }));
                        }
                    }
                }
            }

            // 3. Check .tool-versions file (asdf/mise style)
            let tool_versions = current.join(".tool-versions");
            if tool_versions.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&tool_versions).await {
                    for line in content.lines() {
                        let line = line.trim();
                        if line.starts_with(&format!("{} ", self.candidate)) {
                            let version = line.strip_prefix(&self.candidate).unwrap_or("").trim();
                            if !version.is_empty() {
                                return Ok(Some(VersionDetection {
                                    version: version.to_string(),
                                    source: VersionSource::LocalFile,
                                    source_path: Some(tool_versions),
                                }));
                            }
                        }
                    }
                }
            }

            if !current.pop() {
                break;
            }
        }

        // 4. Check project manifest files (only at start_path, not walking up)
        if self.is_java() {
            // pom.xml
            let pom_xml = start_path.join("pom.xml");
            if pom_xml.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&pom_xml).await {
                    if let Some(ver) = extract_java_version_from_pom(&content) {
                        return Ok(Some(VersionDetection {
                            version: ver,
                            source: VersionSource::Manifest,
                            source_path: Some(pom_xml),
                        }));
                    }
                }
            }

            // build.gradle / build.gradle.kts
            for gradle_file in &["build.gradle.kts", "build.gradle"] {
                let gradle_path = start_path.join(gradle_file);
                if gradle_path.exists() {
                    if let Ok(content) = crate::platform::fs::read_file_string(&gradle_path).await {
                        if let Some(ver) = extract_java_version_from_gradle(&content) {
                            return Ok(Some(VersionDetection {
                                version: ver,
                                source: VersionSource::Manifest,
                                source_path: Some(gradle_path),
                            }));
                        }
                    }
                }
            }
        }

        if self.is_kotlin() {
            // build.gradle.kts / build.gradle
            for gradle_file in &["build.gradle.kts", "build.gradle"] {
                let gradle_path = start_path.join(gradle_file);
                if gradle_path.exists() {
                    if let Ok(content) = crate::platform::fs::read_file_string(&gradle_path).await {
                        if let Some(ver) = extract_kotlin_version_from_gradle(&content) {
                            return Ok(Some(VersionDetection {
                                version: ver,
                                source: VersionSource::Manifest,
                                source_path: Some(gradle_path),
                            }));
                        }
                    }
                }
            }
        }

        // 5. Fall back to current SDKMAN version
        if let Some(version) = self.get_current_version().await? {
            return Ok(Some(VersionDetection {
                version,
                source: VersionSource::SystemDefault,
                source_path: None,
            }));
        }

        Ok(None)
    }

    fn get_env_modifications(&self, version: &str) -> CogniaResult<EnvModifications> {
        let dir = self.candidates_dir()?;
        let home = dir.join(version);
        let bin_path = home.join("bin");

        let mut mods = EnvModifications::new().prepend_path(bin_path);

        match self.candidate.as_str() {
            "java" => {
                mods = mods.set_var("JAVA_HOME", home.to_string_lossy().to_string());
            }
            "kotlin" => {
                mods = mods.set_var("KOTLIN_HOME", home.to_string_lossy().to_string());
            }
            "gradle" => {
                mods = mods.set_var("GRADLE_HOME", home.to_string_lossy().to_string());
            }
            "maven" => {
                mods = mods
                    .set_var("MAVEN_HOME", home.to_string_lossy().to_string())
                    .set_var("M2_HOME", home.to_string_lossy().to_string());
            }
            _ => {}
        }

        Ok(mods)
    }

    fn version_file_name(&self) -> &str {
        match self.candidate.as_str() {
            "java" => ".java-version",
            "kotlin" => ".kotlin-version",
            "gradle" => ".gradle-version",
            "maven" => ".maven-version",
            "scala" => ".scala-version",
            _ => ".sdkmanrc",
        }
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

// ──────────────────────────────────────────────────────
// SystemPackageProvider implementation
// ──────────────────────────────────────────────────────

#[async_trait]
impl SystemPackageProvider for SdkmanProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        // SDKMAN requires: curl, zip, unzip, bash
        for cmd in &["curl", "zip", "unzip", "bash"] {
            if process::which(cmd).await.is_none() {
                return Ok(false);
            }
        }
        Ok(true)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false // SDKMAN installs to user home directory
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let output = self.run_sdk(&["version"]).await?;
        // Output like "SDKMAN! script: 5.18.2\nnative: 0.4.6"
        for line in output.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("SDKMAN") || trimmed.contains("script") {
                if let Some(ver) = trimmed.rsplit(':').next() {
                    let ver = ver.trim();
                    if !ver.is_empty() {
                        return Ok(ver.to_string());
                    }
                }
            }
        }
        // Return first non-empty line as fallback
        output
            .lines()
            .find(|l| !l.trim().is_empty())
            .map(|l| l.trim().to_string())
            .ok_or_else(|| CogniaError::Provider("Could not determine SDKMAN version".into()))
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        let dir = self.sdkman_dir()?;
        Ok(dir.join("bin").join("sdkman-init.sh"))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("curl -s \"https://get.sdkman.io\" | bash".to_string())
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let dir = self.candidates_dir()?;
        let version = name
            .strip_prefix(&format!("{}@", self.candidate))
            .unwrap_or(name);
        Ok(dir.join(version).exists())
    }
}

// ──────────────────────────────────────────────────────
// Unit tests
// ──────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_sdk_output() {
        assert_eq!(clean_sdk_output("hello"), "hello");
        assert_eq!(clean_sdk_output("hello\x1b[0mworld"), "helloworld");
        assert_eq!(clean_sdk_output("\x1b[32mgreen\x1b[0m"), "green");
        assert_eq!(clean_sdk_output("no escapes here"), "no escapes here");
    }

    #[test]
    fn test_parse_sdk_list_java() {
        let output = r#"
================================================================================
Available Java Versions for macOS ARM 64bit
================================================================================
 Vendor        | Use | Version      | Dist    | Status     | Identifier
--------------------------------------------------------------------------------
 Temurin       |     | 21.0.4       | tem     |            | 21.0.4-tem
 Temurin       | >>> | 17.0.9       | tem     | installed  | 17.0.9-tem
 Corretto      |     | 21.0.4       | amzn    | installed  | 21.0.4-amzn
================================================================================
Use the Identifier for installation:

    $ sdk install java 11.0.12-open
"#;
        let entries = parse_sdk_list_java(output);
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].identifier, "21.0.4-tem");
        assert_eq!(entries[0].vendor, "Temurin");
        assert!(!entries[0].installed);
        assert_eq!(entries[1].identifier, "17.0.9-tem");
        assert!(entries[1].installed);
        assert!(entries[1].in_use);
        assert_eq!(entries[2].identifier, "21.0.4-amzn");
        assert!(entries[2].installed);
    }

    #[test]
    fn test_parse_sdk_list_java_empty() {
        let entries = parse_sdk_list_java("");
        assert!(entries.is_empty());
    }

    #[test]
    fn test_parse_sdk_list_versions() {
        let output = r#"
================================================================================
Available Kotlin Versions
================================================================================
     2.0.0               1.9.24              1.9.23
     1.9.22              1.9.21              1.9.20
================================================================================
"#;
        let versions = parse_sdk_list_versions(output);
        assert_eq!(versions.len(), 6);
        assert_eq!(versions[0], "2.0.0");
        assert_eq!(versions[5], "1.9.20");
    }

    #[test]
    fn test_parse_sdk_list_versions_with_markers() {
        let output = r#"
================================================================================
Available Gradle Versions
================================================================================
   > 8.5                 8.4                * 8.3
================================================================================
"#;
        let versions = parse_sdk_list_versions(output);
        assert!(versions.contains(&"8.5".to_string()));
        assert!(versions.contains(&"8.4".to_string()));
        assert!(versions.contains(&"8.3".to_string()));
    }

    #[test]
    fn test_parse_sdkmanrc() {
        let content = r#"
# Enable auto-env through the sdkman_auto_env config
# Add key=value pairs of SDKs to use below
java=17.0.9-tem
kotlin=2.0.0
gradle=8.5
"#;
        let entries = parse_sdkmanrc(content);
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0], ("java".to_string(), "17.0.9-tem".to_string()));
        assert_eq!(entries[1], ("kotlin".to_string(), "2.0.0".to_string()));
        assert_eq!(entries[2], ("gradle".to_string(), "8.5".to_string()));
    }

    #[test]
    fn test_parse_sdkmanrc_empty() {
        let entries = parse_sdkmanrc("");
        assert!(entries.is_empty());
    }

    #[test]
    fn test_parse_sdkmanrc_comments_only() {
        let entries = parse_sdkmanrc("# just a comment\n# another comment\n");
        assert!(entries.is_empty());
    }

    #[test]
    fn test_extract_java_version_from_pom_java_version() {
        let pom = r#"
<project>
  <properties>
    <java.version>17</java.version>
  </properties>
</project>"#;
        assert_eq!(extract_java_version_from_pom(pom), Some("17".to_string()));
    }

    #[test]
    fn test_extract_java_version_from_pom_compiler_release() {
        let pom = r#"
<project>
  <properties>
    <maven.compiler.release>21</maven.compiler.release>
  </properties>
</project>"#;
        assert_eq!(extract_java_version_from_pom(pom), Some("21".to_string()));
    }

    #[test]
    fn test_extract_java_version_from_pom_compiler_source() {
        let pom = r#"
<project>
  <properties>
    <maven.compiler.source>11</maven.compiler.source>
    <maven.compiler.target>11</maven.compiler.target>
  </properties>
</project>"#;
        assert_eq!(extract_java_version_from_pom(pom), Some("11".to_string()));
    }

    #[test]
    fn test_extract_java_version_from_pom_variable_skipped() {
        let pom = r#"
<project>
  <properties>
    <java.version>${jdk.version}</java.version>
    <maven.compiler.source>17</maven.compiler.source>
  </properties>
</project>"#;
        // Should skip the ${variable} and use maven.compiler.source instead
        assert_eq!(extract_java_version_from_pom(pom), Some("17".to_string()));
    }

    #[test]
    fn test_extract_java_version_from_pom_none() {
        let pom = "<project></project>";
        assert_eq!(extract_java_version_from_pom(pom), None);
    }

    #[test]
    fn test_extract_java_version_from_gradle_source_compat() {
        let gradle = r#"
plugins {
    id 'java'
}
sourceCompatibility = '17'
"#;
        assert_eq!(
            extract_java_version_from_gradle(gradle),
            Some("17".to_string())
        );
    }

    #[test]
    fn test_extract_java_version_from_gradle_java_version_enum() {
        let gradle = r#"
sourceCompatibility = JavaVersion.VERSION_21
"#;
        assert_eq!(
            extract_java_version_from_gradle(gradle),
            Some("21".to_string())
        );
    }

    #[test]
    fn test_extract_java_version_from_gradle_toolchain() {
        let gradle = r#"
java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(17))
    }
}
"#;
        assert_eq!(
            extract_java_version_from_gradle(gradle),
            Some("17".to_string())
        );
    }

    #[test]
    fn test_extract_java_version_from_gradle_jvm_target() {
        let gradle = r#"
tasks.withType<KotlinCompile> {
    kotlinOptions {
        jvmTarget = "17"
    }
}
"#;
        assert_eq!(
            extract_java_version_from_gradle(gradle),
            Some("17".to_string())
        );
    }

    #[test]
    fn test_extract_kotlin_version_from_gradle() {
        let gradle = r#"
plugins {
    id("org.jetbrains.kotlin.jvm") version "2.0.0"
}
"#;
        assert_eq!(
            extract_kotlin_version_from_gradle(gradle),
            Some("2.0.0".to_string())
        );
    }

    #[test]
    fn test_extract_kotlin_version_from_gradle_ext() {
        let gradle = r#"
ext.kotlin_version = '1.9.24'
"#;
        assert_eq!(
            extract_kotlin_version_from_gradle(gradle),
            Some("1.9.24".to_string())
        );
    }

    #[test]
    fn test_extract_gradle_wrapper_version() {
        let props = r#"
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-8.5-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
"#;
        assert_eq!(
            extract_gradle_wrapper_version(props),
            Some("8.5".to_string())
        );
    }

    #[test]
    fn test_extract_gradle_wrapper_version_all() {
        let props =
            "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.11.1-all.zip";
        assert_eq!(
            extract_gradle_wrapper_version(props),
            Some("8.11.1".to_string())
        );
    }

    #[test]
    fn test_provider_id_java() {
        let p = SdkmanProvider::java();
        assert_eq!(p.id(), "sdkman");
    }

    #[test]
    fn test_provider_id_kotlin() {
        let p = SdkmanProvider::kotlin();
        assert_eq!(p.id(), "sdkman-kotlin");
    }

    #[test]
    fn test_capabilities_include_update_and_upgrade() {
        let p = SdkmanProvider::java();
        let caps = p.capabilities();
        assert!(caps.contains(&Capability::Update));
        assert!(caps.contains(&Capability::Upgrade));
        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::VersionSwitch));
        assert!(caps.contains(&Capability::MultiVersion));
        assert!(caps.contains(&Capability::ProjectLocal));
    }

    #[test]
    fn test_supported_platforms() {
        let p = SdkmanProvider::java();
        let platforms = p.supported_platforms();
        assert!(platforms.contains(&Platform::MacOS));
        assert!(platforms.contains(&Platform::Linux));
        assert!(!platforms.contains(&Platform::Windows));
    }

    #[test]
    fn test_priority_java_higher_than_kotlin() {
        let java = SdkmanProvider::java();
        let kotlin = SdkmanProvider::kotlin();
        assert!(java.priority() > kotlin.priority());
    }

    #[test]
    fn test_version_file_names() {
        assert_eq!(SdkmanProvider::java().version_file_name(), ".java-version");
        assert_eq!(
            SdkmanProvider::kotlin().version_file_name(),
            ".kotlin-version"
        );
        assert_eq!(
            SdkmanProvider::new("gradle").version_file_name(),
            ".gradle-version"
        );
        assert_eq!(
            SdkmanProvider::new("maven").version_file_name(),
            ".maven-version"
        );
    }

    #[test]
    fn test_requires_elevation() {
        let p = SdkmanProvider::java();
        assert!(!p.requires_elevation("install"));
        assert!(!p.requires_elevation("uninstall"));
    }

    #[test]
    fn test_default_creates_java() {
        let p = SdkmanProvider::default();
        assert_eq!(p.id(), "sdkman");
        assert_eq!(p.candidate, "java");
    }

    #[test]
    fn test_provider_id_gradle() {
        let p = SdkmanProvider::new("gradle");
        assert_eq!(p.id(), "sdkman-gradle");
        assert_eq!(p.candidate, "gradle");
    }

    #[test]
    fn test_provider_id_maven() {
        let p = SdkmanProvider::new("maven");
        assert_eq!(p.id(), "sdkman-maven");
        assert_eq!(p.candidate, "maven");
    }

    #[test]
    fn test_provider_id_groovy() {
        let p = SdkmanProvider::new("groovy");
        assert_eq!(p.id(), "sdkman-groovy");
        assert_eq!(p.candidate, "groovy");
    }

    #[test]
    fn test_provider_id_scala() {
        let p = SdkmanProvider::new("scala");
        assert_eq!(p.id(), "sdkman-scala");
        assert_eq!(p.candidate, "scala");
    }

    #[test]
    fn test_display_name_for_tools() {
        assert_eq!(SdkmanProvider::new("gradle").display_name(), "SDKMAN! (Gradle)");
        assert_eq!(SdkmanProvider::new("maven").display_name(), "SDKMAN! (Maven)");
        assert_eq!(SdkmanProvider::new("groovy").display_name(), "SDKMAN! (Groovy)");
        assert_eq!(SdkmanProvider::new("scala").display_name(), "SDKMAN! (Scala)");
    }
}
