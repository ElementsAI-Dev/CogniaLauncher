use crate::error::{CogniaError, CogniaResult};
use crate::platform::env::{current_platform, EnvModifications};
use crate::provider::{
    EnvironmentProvider, InstalledVersion, ProviderRegistry, SystemEnvironmentType, VersionInfo,
};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentInfo {
    /// Logical environment type (e.g. `node`, `python`, `go`).
    pub env_type: String,
    /// Selected provider id for this environment (e.g. `fnm`, `pyenv`, `system-node`).
    pub provider_id: String,
    pub provider: String,
    pub current_version: Option<String>,
    pub installed_versions: Vec<InstalledVersion>,
    pub available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedEnvironment {
    /// Logical environment type (e.g. `node`, `python`, `go`).
    pub env_type: String,
    pub version: String,
    /// Concrete source label (e.g. `.nvmrc`, `global.json (sdk.version)`).
    pub source: String,
    pub source_path: Option<PathBuf>,
}

pub struct EnvironmentManager {
    registry: Arc<RwLock<ProviderRegistry>>,
}

fn normalize_env_type(input: &str) -> String {
    match input {
        // Node.js providers
        "fnm" | "nvm" | "volta" | "system-node" => "node".to_string(),
        // Python providers
        "pyenv" | "system-python" => "python".to_string(),
        // Go providers
        "goenv" | "system-go" => "go".to_string(),
        // Rust providers
        "rustup" | "system-rust" => "rust".to_string(),
        // Ruby providers
        "rbenv" | "system-ruby" => "ruby".to_string(),
        // Java/Kotlin providers
        "sdkman" | "system-java" => "java".to_string(),
        "sdkman-kotlin" | "system-kotlin" => "kotlin".to_string(),
        // Scala providers
        "sdkman-scala" => "scala".to_string(),
        // Groovy providers
        "sdkman-groovy" => "groovy".to_string(),
        // PHP providers
        "phpbrew" | "system-php" => "php".to_string(),
        // .NET providers
        "dotnet" | "system-dotnet" => "dotnet".to_string(),
        // Deno providers
        "deno" | "system-deno" => "deno".to_string(),
        // Zig providers
        "zig" | "system-zig" => "zig".to_string(),
        // Dart/Flutter providers
        "fvm" | "system-dart" => "dart".to_string(),
        // Bun providers
        "system-bun" => "bun".to_string(),
        // Lua providers
        "system-lua" => "lua".to_string(),
        // C/C++ providers
        "system-c" => "c".to_string(),
        "system-cpp" | "msvc" | "msys2" | "vcpkg" | "conan" | "xmake" => "cpp".to_string(),
        _ if input.starts_with("system-") => {
            input.strip_prefix("system-").unwrap_or(input).to_string()
        }
        _ => input.to_string(),
    }
}

fn candidate_provider_ids(env_type: &str) -> &'static [&'static str] {
    match env_type {
        // Dedicated managers first, then polyglot managers, then system fallback.
        "node" => &["volta", "fnm", "nvm", "mise", "asdf", "system-node"],
        "python" => &["pyenv", "mise", "asdf", "system-python"],
        "go" => &["goenv", "mise", "asdf", "system-go"],
        "rust" => &["rustup", "mise", "asdf", "system-rust"],
        "ruby" => &["rbenv", "mise", "asdf", "system-ruby"],
        "java" => &["sdkman", "mise", "asdf", "system-java"],
        "kotlin" => &["sdkman-kotlin", "mise", "asdf", "system-kotlin"],
        "scala" => &["sdkman-scala", "mise", "asdf", "system-scala"],
        "php" => &["phpbrew", "mise", "asdf", "system-php"],
        "dotnet" => &["dotnet", "mise", "asdf", "system-dotnet"],
        "deno" => &["deno", "mise", "asdf", "system-deno"],
        "zig" => &["zig", "mise", "asdf", "system-zig"],
        "dart" => &["fvm", "mise", "asdf", "system-dart"],
        "bun" => &["system-bun"],
        "lua" => &["mise", "asdf", "system-lua"],
        "groovy" => &["sdkman-groovy", "mise", "asdf", "system-groovy"],
        "elixir" => &["mise", "asdf", "system-elixir"],
        "erlang" => &["mise", "asdf", "system-erlang"],
        "swift" => &["mise", "asdf", "system-swift"],
        "julia" => &["mise", "asdf", "system-julia"],
        "perl" => &["mise", "asdf", "system-perl"],
        "r" => &["mise", "asdf", "system-r"],
        "haskell" => &["mise", "asdf", "system-haskell"],
        "clojure" => &["mise", "asdf", "system-clojure"],
        "crystal" => &["mise", "asdf", "system-crystal"],
        "nim" => &["mise", "asdf", "system-nim"],
        "ocaml" => &["mise", "asdf", "system-ocaml"],
        "fortran" => &["system-fortran"],
        "c" => &["system-c"],
        "cpp" => &["system-cpp"],
        _ => &[],
    }
}

fn version_matches(installed: &str, requested: &str) -> bool {
    let mut installed = installed.trim();
    let mut requested = requested.trim();
    if installed.is_empty() || requested.is_empty() {
        return false;
    }

    installed = installed.trim_start_matches('v');
    requested = requested.trim_start_matches('v');

    // Normalize common toolchain prefixes.
    // - go: toolchains may be represented as `go1.x.y`
    if let Some(stripped) = installed.strip_prefix("go") {
        if stripped
            .chars()
            .next()
            .map(|c| c.is_ascii_digit())
            .unwrap_or(false)
        {
            installed = stripped;
        }
    }

    if let Some(stripped) = requested.strip_prefix("go") {
        if stripped
            .chars()
            .next()
            .map(|c| c.is_ascii_digit())
            .unwrap_or(false)
        {
            requested = stripped;
        }
    }

    if installed == requested {
        return true;
    }

    fn boundary_prefix_match(full: &str, prefix: &str) -> bool {
        if !full.starts_with(prefix) {
            return false;
        }
        if full.len() == prefix.len() {
            return true;
        }
        matches!(full[prefix.len()..].chars().next(), Some('.' | '-'))
    }

    boundary_prefix_match(installed, requested) || boundary_prefix_match(requested, installed)
}

impl EnvironmentManager {
    pub fn new(registry: Arc<RwLock<ProviderRegistry>>) -> Self {
        Self { registry }
    }

    /// Convert legacy provider ids (e.g. `fnm`) to logical environment types (e.g. `node`).
    pub fn logical_env_type(input: &str) -> String {
        normalize_env_type(input)
    }

    /// Resolve an environment provider for a logical env type (e.g. `node`) or a legacy provider id
    /// (e.g. `fnm`).
    ///
    /// - If `provider_id` is provided, it is used directly (even if disabled).
    /// - If `env_type` matches a provider id, it is treated as a legacy provider-id input.
    /// - Otherwise `env_type` is treated as a logical env type and a provider is selected.
    pub async fn resolve_provider(
        &self,
        env_type: &str,
        provider_id: Option<&str>,
        version_hint: Option<&str>,
    ) -> CogniaResult<(String, String, Arc<dyn EnvironmentProvider>)> {
        let normalized_env_type = normalize_env_type(env_type);
        let platform = current_platform();

        #[allow(clippy::type_complexity)]
        let (direct_provider, candidates): (
            Option<Arc<dyn EnvironmentProvider>>,
            Vec<(String, bool, Arc<dyn EnvironmentProvider>)>,
        ) = {
            let registry = self.registry.read().await;

            if let Some(provider_id) = provider_id {
                let provider = registry
                    .get_environment_provider(provider_id)
                    .ok_or_else(|| CogniaError::ProviderNotFound(provider_id.into()))?;
                return Ok((normalized_env_type, provider_id.to_string(), provider));
            }

            // Back-compat: allow passing provider id as env_type.
            let direct_provider = registry
                .get_environment_provider(env_type)
                .filter(|_| registry.is_provider_enabled(env_type));

            let candidates = candidate_provider_ids(&normalized_env_type)
                .iter()
                .filter_map(|id| {
                    registry
                        .get_environment_provider(id)
                        .map(|p| ((*id).to_string(), registry.is_provider_enabled(id), p))
                })
                .filter(|(_, _, p)| p.supported_platforms().contains(&platform))
                .collect::<Vec<_>>();

            (direct_provider, candidates)
        };

        if let Some(provider) = direct_provider {
            return Ok((normalize_env_type(env_type), env_type.to_string(), provider));
        }

        if candidates.is_empty() {
            return Err(CogniaError::ProviderNotFound(normalized_env_type));
        }

        let mut enabled = Vec::new();
        let mut disabled = Vec::new();
        for (id, is_enabled, provider) in candidates {
            if is_enabled {
                enabled.push((id, provider));
            } else {
                disabled.push((id, provider));
            }
        }

        for group in [&enabled, &disabled] {
            if let Some(version_hint) = version_hint {
                for (id, provider) in group.iter() {
                    if provider.is_available().await {
                        if let Ok(installed) = provider.list_installed_versions().await {
                            if installed
                                .iter()
                                .any(|v| version_matches(&v.version, version_hint))
                            {
                                return Ok((
                                    normalized_env_type.clone(),
                                    id.clone(),
                                    provider.clone(),
                                ));
                            }
                        }
                    }
                }
            }

            for (id, provider) in group.iter() {
                if provider.is_available().await {
                    return Ok((normalized_env_type.clone(), id.clone(), provider.clone()));
                }
            }
        }

        let (id, provider) = enabled
            .into_iter()
            .next()
            .or_else(|| disabled.into_iter().next())
            .expect("candidates is not empty");

        Ok((normalized_env_type, id, provider))
    }

    pub async fn list_environments(&self) -> CogniaResult<Vec<EnvironmentInfo>> {
        let mut envs = Vec::new();

        for env in SystemEnvironmentType::all() {
            let env_type = env.env_type();
            let (logical, provider_id, provider) =
                self.resolve_provider(env_type, None, None).await?;

            let available = provider.is_available().await;

            let (current, installed) = if available {
                let current = provider.get_current_version().await.ok().flatten();
                let installed = provider.list_installed_versions().await.unwrap_or_default();
                (current, installed)
            } else {
                (None, vec![])
            };

            envs.push(EnvironmentInfo {
                env_type: logical,
                provider_id,
                provider: provider.display_name().to_string(),
                current_version: current,
                installed_versions: installed,
                available,
            });
        }

        Ok(envs)
    }

    pub async fn get_environment(&self, env_type: &str) -> CogniaResult<EnvironmentInfo> {
        let (logical, provider_id, provider) = self.resolve_provider(env_type, None, None).await?;

        let available = provider.is_available().await;
        let current = if available {
            provider.get_current_version().await.ok().flatten()
        } else {
            None
        };
        let installed = if available {
            provider.list_installed_versions().await.unwrap_or_default()
        } else {
            vec![]
        };

        Ok(EnvironmentInfo {
            env_type: logical,
            provider_id,
            provider: provider.display_name().to_string(),
            current_version: current,
            installed_versions: installed,
            available,
        })
    }

    pub async fn detect_version(
        &self,
        env_type: &str,
        start_path: &Path,
    ) -> CogniaResult<Option<DetectedEnvironment>> {
        let logical = normalize_env_type(env_type);
        let sources = super::project_env_detect::default_enabled_detection_sources(&logical);
        super::project_env_detect::detect_env_version(&logical, start_path, &sources).await
    }

    pub async fn detect_version_with_sources(
        &self,
        env_type: &str,
        start_path: &Path,
        sources_in_priority: &[String],
    ) -> CogniaResult<Option<DetectedEnvironment>> {
        let logical = normalize_env_type(env_type);
        super::project_env_detect::detect_env_version(&logical, start_path, sources_in_priority)
            .await
    }

    pub async fn detect_all_versions(
        &self,
        start_path: &Path,
    ) -> CogniaResult<Vec<DetectedEnvironment>> {
        let mut detected = Vec::new();

        for env in SystemEnvironmentType::all() {
            let env_type = env.env_type();
            match self.detect_version(env_type, start_path).await {
                Ok(Some(item)) => detected.push(item),
                Ok(None) => {}
                Err(_) => {
                    // Best-effort detection; ignore failures for unsupported / unavailable providers.
                }
            }
        }

        Ok(detected)
    }

    pub async fn install_version(
        &self,
        env_type: &str,
        version: &str,
        provider_id: Option<&str>,
    ) -> CogniaResult<()> {
        let (logical, _provider_id, provider) = self
            .resolve_provider(env_type, provider_id, Some(version))
            .await?;

        provider
            .install(crate::provider::InstallRequest {
                name: logical,
                version: Some(version.to_string()),
                global: true,
                force: false,
            })
            .await?;

        Ok(())
    }

    pub async fn uninstall_version(
        &self,
        env_type: &str,
        version: &str,
        provider_id: Option<&str>,
    ) -> CogniaResult<()> {
        let (logical, _provider_id, provider) = self
            .resolve_provider(env_type, provider_id, Some(version))
            .await?;

        provider
            .uninstall(crate::provider::UninstallRequest {
                name: logical,
                version: Some(version.to_string()),
                force: false,
            })
            .await?;

        Ok(())
    }

    pub async fn set_global_version(
        &self,
        env_type: &str,
        version: &str,
        provider_id: Option<&str>,
    ) -> CogniaResult<()> {
        let (_logical, _provider_id, provider) = self
            .resolve_provider(env_type, provider_id, Some(version))
            .await?;
        provider.set_global_version(version).await
    }

    pub async fn set_local_version(
        &self,
        env_type: &str,
        project_path: &Path,
        version: &str,
        provider_id: Option<&str>,
    ) -> CogniaResult<()> {
        let (_logical, _provider_id, provider) = self
            .resolve_provider(env_type, provider_id, Some(version))
            .await?;
        provider.set_local_version(project_path, version).await
    }

    pub async fn get_env_modifications(
        &self,
        env_type: &str,
        version: &str,
        provider_id: Option<&str>,
    ) -> CogniaResult<EnvModifications> {
        let (_logical, _provider_id, provider) = self
            .resolve_provider(env_type, provider_id, Some(version))
            .await?;
        provider.get_env_modifications(version)
    }

    pub async fn get_available_versions(
        &self,
        env_type: &str,
        provider_id: Option<&str>,
    ) -> CogniaResult<Vec<crate::provider::VersionInfo>> {
        let (logical, _provider_id, provider) =
            self.resolve_provider(env_type, provider_id, None).await?;
        provider.get_versions(&logical).await
    }

    /// Check whether a newer version is available for a specific environment.
    pub async fn check_env_updates(&self, env_type: &str) -> CogniaResult<EnvUpdateCheckResult> {
        let (logical, provider_id, provider) = self.resolve_provider(env_type, None, None).await?;

        let available = provider.is_available().await;
        if !available {
            return Ok(EnvUpdateCheckResult {
                env_type: logical,
                provider_id,
                current_version: None,
                latest_version: None,
                latest_lts: None,
                newer_count: 0,
                is_outdated: false,
            });
        }

        let current = provider.get_current_version().await.ok().flatten();
        let versions = provider.get_versions(&logical).await.unwrap_or_default();

        let stable_versions: Vec<&VersionInfo> = versions
            .iter()
            .filter(|v| !v.deprecated && !v.yanked)
            .collect();

        let latest_version = stable_versions.first().map(|v| v.version.clone());

        // For Node.js, LTS versions are even major versions
        let latest_lts = if logical == "node" {
            stable_versions
                .iter()
                .find(|v| {
                    v.version
                        .split('.')
                        .next()
                        .and_then(|m| m.trim_start_matches('v').parse::<u32>().ok())
                        .map(|num| num >= 4 && num % 2 == 0)
                        .unwrap_or(false)
                })
                .map(|v| v.version.clone())
        } else {
            // For other languages, LTS = latest stable
            latest_version.clone()
        };

        let newer_count = if let Some(ref cur) = current {
            stable_versions
                .iter()
                .filter(|v| compare_semver(&v.version, cur) > 0)
                .count()
        } else {
            0
        };

        let is_outdated = match (&current, &latest_version) {
            (Some(cur), Some(latest)) => compare_semver(latest, cur) > 0,
            _ => false,
        };

        Ok(EnvUpdateCheckResult {
            env_type: logical,
            provider_id,
            current_version: current,
            latest_version,
            latest_lts,
            newer_count,
            is_outdated,
        })
    }

    /// Check for updates across all known environment types.
    pub async fn check_all_env_updates(&self) -> CogniaResult<Vec<EnvUpdateCheckResult>> {
        let mut results = Vec::new();

        for env in SystemEnvironmentType::all() {
            let env_type = env.env_type();
            match self.check_env_updates(env_type).await {
                Ok(result) => results.push(result),
                Err(_) => {
                    // Best-effort: skip environments that fail
                }
            }
        }

        Ok(results)
    }

    /// Batch-remove old versions for an environment, returning freed bytes and errors.
    pub async fn cleanup_versions(
        &self,
        env_type: &str,
        versions_to_remove: &[String],
    ) -> CogniaResult<EnvCleanupResult> {
        let (logical, _provider_id, provider) = self.resolve_provider(env_type, None, None).await?;

        // Safety: refuse to remove the current version
        let current = provider.get_current_version().await.ok().flatten();
        let installed = provider.list_installed_versions().await.unwrap_or_default();

        let mut removed = Vec::new();
        let mut freed_bytes: u64 = 0;
        let mut errors = Vec::new();

        for version in versions_to_remove {
            if current.as_deref() == Some(version.as_str()) {
                errors.push(format!("Skipped {}: currently active version", version));
                continue;
            }

            let size = installed
                .iter()
                .find(|v| v.version == *version)
                .and_then(|v| v.size)
                .unwrap_or(0);

            match provider
                .uninstall(crate::provider::UninstallRequest {
                    name: logical.clone(),
                    version: Some(version.clone()),
                    force: false,
                })
                .await
            {
                Ok(()) => {
                    removed.push(CleanedVersion {
                        version: version.clone(),
                        size,
                    });
                    freed_bytes += size;
                }
                Err(e) => {
                    errors.push(format!("Failed to remove {}: {}", version, e));
                }
            }
        }

        Ok(EnvCleanupResult {
            removed,
            freed_bytes,
            errors,
        })
    }
}

/// Result of checking a single environment for version updates.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvUpdateCheckResult {
    pub env_type: String,
    pub provider_id: String,
    pub current_version: Option<String>,
    pub latest_version: Option<String>,
    pub latest_lts: Option<String>,
    pub newer_count: usize,
    pub is_outdated: bool,
}

/// Result of batch-cleaning old versions.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvCleanupResult {
    pub removed: Vec<CleanedVersion>,
    pub freed_bytes: u64,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanedVersion {
    pub version: String,
    pub size: u64,
}

/// Compare two semver-like version strings. Returns >0 if a > b, <0 if a < b.
fn compare_semver(a: &str, b: &str) -> i32 {
    let parse = |s: &str| -> Vec<u64> {
        s.trim_start_matches('v')
            .split('.')
            .filter_map(|p| p.parse::<u64>().ok())
            .collect()
    };
    let a_parts = parse(a);
    let b_parts = parse(b);
    let len = a_parts.len().max(b_parts.len());
    for i in 0..len {
        let av = a_parts.get(i).copied().unwrap_or(0);
        let bv = b_parts.get(i).copied().unwrap_or(0);
        if av > bv {
            return 1;
        }
        if av < bv {
            return -1;
        }
    }
    0
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::provider::{
        Capability, InstallReceipt, InstallRequest, InstalledFilter, InstalledPackage, PackageInfo,
        PackageSummary, Provider, SearchOptions, UpdateInfo, VersionDetection, VersionInfo,
    };
    use async_trait::async_trait;
    use std::collections::HashSet;

    #[test]
    fn version_matches_is_strict_enough_to_avoid_false_positives() {
        assert!(super::version_matches("v18.19.0", "18.19.0"));
        assert!(super::version_matches("18.19.0", "18"));
        assert!(super::version_matches("18.19.0", "18.19"));

        // Avoid substring false positives.
        assert!(!super::version_matches("3.12.0", "2"));
        assert!(!super::version_matches("10.0.0", "1"));

        // Normalize common prefixes.
        assert!(super::version_matches("go1.22.1", "1.22.1"));
        assert!(super::version_matches("1.22.1", "go1.22.1"));
        assert!(super::version_matches("nightly-2025-01-01", "nightly"));
    }

    #[derive(Debug)]
    struct DummyEnvProvider {
        id: &'static str,
        available: bool,
    }

    impl DummyEnvProvider {
        fn new(id: &'static str, available: bool) -> Self {
            Self { id, available }
        }
    }

    #[async_trait]
    impl Provider for DummyEnvProvider {
        fn id(&self) -> &str {
            self.id
        }

        fn display_name(&self) -> &str {
            self.id
        }

        fn capabilities(&self) -> HashSet<Capability> {
            HashSet::new()
        }

        fn supported_platforms(&self) -> Vec<crate::platform::env::Platform> {
            vec![
                crate::platform::env::Platform::Windows,
                crate::platform::env::Platform::MacOS,
                crate::platform::env::Platform::Linux,
            ]
        }

        async fn is_available(&self) -> bool {
            self.available
        }

        async fn search(
            &self,
            _query: &str,
            _options: SearchOptions,
        ) -> CogniaResult<Vec<PackageSummary>> {
            Err(CogniaError::Provider("not implemented".into()))
        }

        async fn get_package_info(&self, _name: &str) -> CogniaResult<PackageInfo> {
            Err(CogniaError::Provider("not implemented".into()))
        }

        async fn get_versions(&self, _name: &str) -> CogniaResult<Vec<VersionInfo>> {
            Err(CogniaError::Provider("not implemented".into()))
        }

        async fn install(&self, _request: InstallRequest) -> CogniaResult<InstallReceipt> {
            Err(CogniaError::Provider("not implemented".into()))
        }

        async fn uninstall(&self, _request: crate::provider::UninstallRequest) -> CogniaResult<()> {
            Err(CogniaError::Provider("not implemented".into()))
        }

        async fn list_installed(
            &self,
            _filter: InstalledFilter,
        ) -> CogniaResult<Vec<InstalledPackage>> {
            Err(CogniaError::Provider("not implemented".into()))
        }

        async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
            Err(CogniaError::Provider("not implemented".into()))
        }
    }

    #[async_trait]
    impl EnvironmentProvider for DummyEnvProvider {
        async fn list_installed_versions(&self) -> CogniaResult<Vec<InstalledVersion>> {
            Ok(vec![])
        }

        async fn get_current_version(&self) -> CogniaResult<Option<String>> {
            Ok(None)
        }

        async fn set_global_version(&self, _version: &str) -> CogniaResult<()> {
            Ok(())
        }

        async fn set_local_version(
            &self,
            _project_path: &std::path::Path,
            _version: &str,
        ) -> CogniaResult<()> {
            Ok(())
        }

        async fn detect_version(
            &self,
            _start_path: &std::path::Path,
        ) -> CogniaResult<Option<VersionDetection>> {
            Ok(None)
        }

        fn get_env_modifications(&self, _version: &str) -> CogniaResult<EnvModifications> {
            Err(CogniaError::Provider("not implemented".into()))
        }

        fn version_file_name(&self) -> &str {
            ".dummy-version"
        }

        fn as_any(&self) -> &dyn std::any::Any {
            self
        }
    }

    #[test]
    fn normalize_env_type_maps_sdkman_scala() {
        assert_eq!(normalize_env_type("sdkman-scala"), "scala");
    }

    #[test]
    fn normalize_env_type_maps_all_jvm_providers() {
        assert_eq!(normalize_env_type("sdkman"), "java");
        assert_eq!(normalize_env_type("sdkman-kotlin"), "kotlin");
        assert_eq!(normalize_env_type("sdkman-scala"), "scala");
        assert_eq!(normalize_env_type("system-java"), "java");
        assert_eq!(normalize_env_type("system-kotlin"), "kotlin");
    }

    #[test]
    fn candidate_provider_ids_includes_scala() {
        let candidates = candidate_provider_ids("scala");
        assert!(candidates.contains(&"sdkman-scala"));
        assert!(candidates.contains(&"mise"));
        assert!(candidates.contains(&"asdf"));
    }

    #[tokio::test]
    async fn resolve_provider_skips_disabled_direct_provider() {
        let mut registry = ProviderRegistry::new();
        registry.register_environment_provider(Arc::new(DummyEnvProvider::new("deno", true)));
        registry
            .register_environment_provider(Arc::new(DummyEnvProvider::new("system-deno", true)));
        registry.set_provider_enabled("deno", false);

        let manager = EnvironmentManager::new(Arc::new(RwLock::new(registry)));
        let (logical, provider_id, _provider) =
            manager.resolve_provider("deno", None, None).await.unwrap();
        assert_eq!(logical, "deno");
        assert_eq!(provider_id, "system-deno");
    }

    #[test]
    fn compare_semver_basic() {
        assert_eq!(compare_semver("1.0.0", "1.0.0"), 0);
        assert_eq!(compare_semver("2.0.0", "1.0.0"), 1);
        assert_eq!(compare_semver("1.0.0", "2.0.0"), -1);
    }

    #[test]
    fn compare_semver_with_v_prefix() {
        assert_eq!(compare_semver("v20.10.0", "20.10.0"), 0);
        assert_eq!(compare_semver("v22.0.0", "v20.10.0"), 1);
        assert_eq!(compare_semver("v18.0.0", "v20.0.0"), -1);
    }

    #[test]
    fn compare_semver_different_lengths() {
        assert_eq!(compare_semver("1.0", "1.0.0"), 0);
        assert_eq!(compare_semver("1.1", "1.0.0"), 1);
        assert_eq!(compare_semver("1", "1.0.0"), 0);
        assert_eq!(compare_semver("2", "1.9.9"), 1);
    }

    #[test]
    fn compare_semver_minor_and_patch() {
        assert!(compare_semver("20.11.0", "20.10.0") > 0);
        assert!(compare_semver("20.10.1", "20.10.0") > 0);
        assert!(compare_semver("20.10.0", "20.10.1") < 0);
    }

    #[test]
    fn env_update_check_result_serde() {
        let result = EnvUpdateCheckResult {
            env_type: "node".into(),
            provider_id: "fnm".into(),
            current_version: Some("20.10.0".into()),
            latest_version: Some("22.0.0".into()),
            latest_lts: Some("22.0.0".into()),
            newer_count: 5,
            is_outdated: true,
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"envType\":\"node\""));
        assert!(json.contains("\"isOutdated\":true"));
        assert!(json.contains("\"newerCount\":5"));

        let deser: EnvUpdateCheckResult = serde_json::from_str(&json).unwrap();
        assert_eq!(deser.env_type, "node");
        assert_eq!(deser.newer_count, 5);
    }

    #[test]
    fn env_cleanup_result_serde() {
        let result = EnvCleanupResult {
            removed: vec![
                CleanedVersion {
                    version: "18.0.0".into(),
                    size: 1024,
                },
                CleanedVersion {
                    version: "16.0.0".into(),
                    size: 2048,
                },
            ],
            freed_bytes: 3072,
            errors: vec![],
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"freedBytes\":3072"));
        assert!(json.contains("\"18.0.0\""));

        let deser: EnvCleanupResult = serde_json::from_str(&json).unwrap();
        assert_eq!(deser.removed.len(), 2);
        assert_eq!(deser.freed_bytes, 3072);
    }

    #[test]
    fn normalize_env_type_dart_providers() {
        assert_eq!(normalize_env_type("fvm"), "dart");
        assert_eq!(normalize_env_type("system-dart"), "dart");
        // dart itself should pass through
        assert_eq!(normalize_env_type("dart"), "dart");
    }

    #[test]
    fn candidate_provider_ids_dart() {
        let candidates = candidate_provider_ids("dart");
        assert!(
            candidates.contains(&"fvm"),
            "fvm should be a candidate for dart"
        );
        assert!(
            candidates.contains(&"system-dart"),
            "system-dart should be a candidate for dart"
        );
        // fvm should come before system-dart (dedicated manager first)
        let fvm_pos = candidates.iter().position(|&x| x == "fvm").unwrap();
        let sys_pos = candidates.iter().position(|&x| x == "system-dart").unwrap();
        assert!(fvm_pos < sys_pos, "fvm should be listed before system-dart");
    }

    #[test]
    fn candidate_provider_ids_unknown_returns_empty() {
        let candidates = candidate_provider_ids("unknown_language");
        assert!(candidates.is_empty());
    }

    #[test]
    fn normalize_env_type_c_cpp_providers() {
        assert_eq!(normalize_env_type("system-c"), "c");
        assert_eq!(normalize_env_type("system-cpp"), "cpp");
        assert_eq!(normalize_env_type("msvc"), "cpp");
        assert_eq!(normalize_env_type("msys2"), "cpp");
        assert_eq!(normalize_env_type("vcpkg"), "cpp");
        assert_eq!(normalize_env_type("conan"), "cpp");
        assert_eq!(normalize_env_type("xmake"), "cpp");
        // c and cpp themselves pass through
        assert_eq!(normalize_env_type("c"), "c");
        assert_eq!(normalize_env_type("cpp"), "cpp");
    }

    #[test]
    fn candidate_provider_ids_c() {
        let candidates = candidate_provider_ids("c");
        assert!(
            candidates.contains(&"system-c"),
            "system-c should be a candidate for c"
        );
    }

    #[test]
    fn candidate_provider_ids_cpp() {
        let candidates = candidate_provider_ids("cpp");
        assert!(
            candidates.contains(&"system-cpp"),
            "system-cpp should be a candidate for cpp"
        );
    }
}
