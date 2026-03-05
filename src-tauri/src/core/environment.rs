use crate::error::{CogniaError, CogniaResult};
use crate::platform::env::{current_platform, EnvModifications};
use crate::provider::{
    EnvironmentProvider, InstalledVersion, ProviderRegistry, SystemEnvironmentType, VersionInfo,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{RwLock, Semaphore};

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
    /// Total disk usage across all installed versions (bytes).
    #[serde(default)]
    pub total_size: u64,
    /// Number of installed versions.
    #[serde(default)]
    pub version_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedEnvironment {
    /// Logical environment type (e.g. `node`, `python`, `go`).
    pub env_type: String,
    pub version: String,
    /// Concrete source label (e.g. `.nvmrc`, `global.json (sdk.version)`).
    pub source: String,
    pub source_path: Option<PathBuf>,
    /// Stable source category used by frontend mapping (`local`, `manifest`, `global`).
    #[serde(default = "default_detected_source_type")]
    pub source_type: String,
}

fn default_detected_source_type() -> String {
    "local".to_string()
}

/// TTL-cached available versions to avoid repeated network requests.
pub struct VersionCache {
    entries: RwLock<HashMap<String, (Instant, Vec<VersionInfo>)>>,
    ttl: Duration,
}

impl VersionCache {
    pub fn new(ttl: Duration) -> Self {
        Self {
            entries: RwLock::new(HashMap::new()),
            ttl,
        }
    }

    pub async fn get(&self, key: &str) -> Option<Vec<VersionInfo>> {
        let entries = self.entries.read().await;
        if let Some((cached_at, versions)) = entries.get(key) {
            if cached_at.elapsed() < self.ttl {
                return Some(versions.clone());
            }
        }
        None
    }

    pub async fn set(&self, key: String, versions: Vec<VersionInfo>) {
        let mut entries = self.entries.write().await;
        entries.insert(key, (Instant::now(), versions));
    }

    pub async fn invalidate(&self, key: &str) {
        let mut entries = self.entries.write().await;
        entries.remove(key);
    }

    pub async fn invalidate_all(&self) {
        let mut entries = self.entries.write().await;
        entries.clear();
    }
}

/// Default TTL for cached versions: 10 minutes.
pub const VERSION_CACHE_TTL: Duration = Duration::from_secs(600);

pub type SharedVersionCache = Arc<VersionCache>;

pub struct EnvironmentManager {
    registry: Arc<RwLock<ProviderRegistry>>,
}

const PROVIDER_ENV_TYPE_OVERRIDES: &[(&str, &str)] = &[
    // Node.js providers
    ("fnm", "node"),
    ("nvm", "node"),
    ("volta", "node"),
    ("system-node", "node"),
    // Python providers
    ("pyenv", "python"),
    ("uv", "python"),
    ("conda", "python"),
    ("pipx", "python"),
    ("system-python", "python"),
    // Go providers
    ("goenv", "go"),
    ("system-go", "go"),
    // Rust providers
    ("rustup", "rust"),
    ("system-rust", "rust"),
    // Ruby providers
    ("rbenv", "ruby"),
    ("system-ruby", "ruby"),
    // JVM providers
    ("sdkman", "java"),
    ("adoptium", "java"),
    ("system-java", "java"),
    ("sdkman-kotlin", "kotlin"),
    ("system-kotlin", "kotlin"),
    ("sdkman-scala", "scala"),
    ("system-scala", "scala"),
    ("sdkman-groovy", "groovy"),
    ("system-groovy", "groovy"),
    ("sdkman-gradle", "gradle"),
    ("sdkman-maven", "maven"),
    // PHP providers
    ("phpbrew", "php"),
    ("system-php", "php"),
    // .NET providers
    ("dotnet", "dotnet"),
    ("system-dotnet", "dotnet"),
    // Deno providers
    ("deno", "deno"),
    ("system-deno", "deno"),
    // Zig providers
    ("zig", "zig"),
    ("system-zig", "zig"),
    // Dart/Flutter providers
    ("fvm", "dart"),
    ("system-dart", "dart"),
    // Bun providers
    ("system-bun", "bun"),
    // Lua providers
    ("luarocks", "lua"),
    ("system-lua", "lua"),
    // C/C++ providers
    ("system-c", "c"),
    ("system-cpp", "cpp"),
    ("msvc", "cpp"),
    ("msys2", "cpp"),
    ("vcpkg", "cpp"),
    ("conan", "cpp"),
    ("xmake", "cpp"),
    // Polyglot managers
    ("mise", "polyglot"),
    ("asdf", "polyglot"),
    ("nix", "polyglot"),
];

fn provider_env_type_override(provider_id: &str) -> Option<&'static str> {
    PROVIDER_ENV_TYPE_OVERRIDES
        .iter()
        .find(|(id, _)| *id == provider_id)
        .map(|(_, env_type)| *env_type)
}

pub fn provider_to_env_type(input: &str) -> String {
    let normalized = input.trim().to_ascii_lowercase();

    if let Some(mapped) = provider_env_type_override(&normalized) {
        return mapped.to_string();
    }

    if let Some(stripped) = normalized.strip_prefix("system-") {
        return stripped.to_string();
    }

    normalized
}

pub fn provider_env_type_mapping() -> HashMap<String, String> {
    let mut mapping = HashMap::new();
    for (provider_id, env_type) in PROVIDER_ENV_TYPE_OVERRIDES {
        mapping.insert((*provider_id).to_string(), (*env_type).to_string());
    }

    for env in SystemEnvironmentType::all() {
        let env_type = env.env_type().to_string();
        mapping
            .entry(format!("system-{}", env_type))
            .or_insert_with(|| env.env_type().to_string());
    }

    mapping
}

pub fn env_type_to_default_provider(env_type: &str) -> String {
    let logical = provider_to_env_type(env_type);
    match logical.as_str() {
        "node" => "fnm".to_string(),
        "python" => "pyenv".to_string(),
        "go" => "goenv".to_string(),
        "rust" => "rustup".to_string(),
        "ruby" => "rbenv".to_string(),
        "java" => "sdkman".to_string(),
        "kotlin" => "sdkman-kotlin".to_string(),
        "scala" => "sdkman-scala".to_string(),
        "groovy" => "sdkman-groovy".to_string(),
        "gradle" => "sdkman-gradle".to_string(),
        "maven" => "sdkman-maven".to_string(),
        "php" => "phpbrew".to_string(),
        "dotnet" => "dotnet".to_string(),
        "deno" => "deno".to_string(),
        "zig" => "zig".to_string(),
        "dart" => "fvm".to_string(),
        "c" => "system-c".to_string(),
        "cpp" => "system-cpp".to_string(),
        "bun" => "system-bun".to_string(),
        _ => logical,
    }
}

fn normalize_env_type(input: &str) -> String {
    provider_to_env_type(input)
}

pub(crate) fn candidate_provider_ids(env_type: &str) -> &'static [&'static str] {
    match env_type {
        // Dedicated managers first, then polyglot managers, then system fallback.
        "node" => &["volta", "fnm", "nvm", "mise", "asdf", "nix", "system-node"],
        "python" => &[
            "uv",
            "pyenv",
            "conda",
            "pipx",
            "mise",
            "asdf",
            "nix",
            "system-python",
        ],
        "go" => &["goenv", "mise", "asdf", "nix", "system-go"],
        "rust" => &["rustup", "mise", "asdf", "nix", "system-rust"],
        "ruby" => &["rbenv", "mise", "asdf", "nix", "system-ruby"],
        "java" => &["adoptium", "sdkman", "mise", "asdf", "nix", "system-java"],
        "kotlin" => &["sdkman-kotlin", "mise", "asdf", "nix", "system-kotlin"],
        "scala" => &["sdkman-scala", "mise", "asdf", "nix", "system-scala"],
        "groovy" => &["sdkman-groovy", "mise", "asdf", "nix", "system-groovy"],
        "gradle" => &["sdkman-gradle", "mise", "asdf", "nix"],
        "maven" => &["sdkman-maven", "mise", "asdf", "nix"],
        "php" => &["phpbrew", "mise", "asdf", "nix", "system-php"],
        "dotnet" => &["dotnet", "mise", "asdf", "nix", "system-dotnet"],
        "deno" => &["deno", "mise", "asdf", "nix", "system-deno"],
        "zig" => &["zig", "mise", "asdf", "nix", "system-zig"],
        "dart" => &["fvm", "mise", "asdf", "nix", "system-dart"],
        "bun" => &["system-bun"],
        "lua" => &["mise", "asdf", "nix", "system-lua"],
        "elixir" => &["mise", "asdf", "nix", "system-elixir"],
        "erlang" => &["mise", "asdf", "nix", "system-erlang"],
        "swift" => &["mise", "asdf", "nix", "system-swift"],
        "julia" => &["mise", "asdf", "nix", "system-julia"],
        "perl" => &["mise", "asdf", "nix", "system-perl"],
        "r" => &["mise", "asdf", "nix", "system-r"],
        "haskell" => &["mise", "asdf", "nix", "system-haskell"],
        "clojure" => &["mise", "asdf", "nix", "system-clojure"],
        "crystal" => &["mise", "asdf", "nix", "system-crystal"],
        "nim" => &["mise", "asdf", "nix", "system-nim"],
        "ocaml" => &["mise", "asdf", "nix", "system-ocaml"],
        "polyglot" => &["mise", "asdf", "nix"],
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
        self.list_environments_with_concurrency(6).await
    }

    pub async fn list_environments_with_concurrency(
        &self,
        max_concurrency: u32,
    ) -> CogniaResult<Vec<EnvironmentInfo>> {
        let all_types = SystemEnvironmentType::all();
        let mut futures = Vec::with_capacity(all_types.len());

        // Limit concurrent provider checks to avoid subprocess storms.
        // Each check may spawn 2-3 subprocesses (which, is_available, --version).
        let permits = (max_concurrency as usize).max(1).min(32);
        let semaphore = Arc::new(Semaphore::new(permits));

        for env in &all_types {
            let env_type = env.env_type().to_string();
            let registry = self.registry.clone();
            let sem = semaphore.clone();
            futures.push(tokio::spawn(async move {
                let _permit = sem.acquire().await.ok();
                let manager = EnvironmentManager::new(registry);
                let timeout = tokio::time::timeout(
                    std::time::Duration::from_secs(5),
                    manager.get_environment(&env_type),
                );
                match timeout.await {
                    Ok(Ok(info)) => Some(info),
                    Ok(Err(_)) | Err(_) => Some(EnvironmentInfo {
                        env_type,
                        provider_id: String::new(),
                        provider: String::new(),
                        current_version: None,
                        installed_versions: vec![],
                        available: false,
                        total_size: 0,
                        version_count: 0,
                    }),
                }
            }));
        }

        let results = futures::future::join_all(futures).await;
        let envs: Vec<EnvironmentInfo> = results
            .into_iter()
            .filter_map(|r| r.ok().flatten())
            .collect();

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

        let total_size: u64 = installed.iter().filter_map(|v| v.size).sum();
        let version_count = installed.len();

        Ok(EnvironmentInfo {
            env_type: logical,
            provider_id,
            provider: provider.display_name().to_string(),
            current_version: current,
            installed_versions: installed,
            available,
            total_size,
            version_count,
        })
    }

    pub async fn detect_version(
        &self,
        env_type: &str,
        start_path: &Path,
    ) -> CogniaResult<Option<DetectedEnvironment>> {
        let logical = normalize_env_type(env_type);
        let sources = super::project_env_detect::default_enabled_detection_sources(&logical);
        self.detect_version_with_sources(&logical, start_path, &sources)
            .await
    }

    pub async fn detect_version_with_sources(
        &self,
        env_type: &str,
        start_path: &Path,
        sources_in_priority: &[String],
    ) -> CogniaResult<Option<DetectedEnvironment>> {
        let logical = normalize_env_type(env_type);
        if let Some(mut detected) =
            super::project_env_detect::detect_env_version(&logical, start_path, sources_in_priority)
                .await?
        {
            if detected.source_type.is_empty() {
                detected.source_type =
                    super::project_env_detect::classify_detection_source(&logical, &detected.source);
            }
            return Ok(Some(detected));
        }

        // Deterministic fallback: when no project-local or manifest pin is found,
        // fall back to the provider's global/default current version.
        if let Ok((_logical, _provider_id, provider)) = self.resolve_provider(&logical, None, None).await
        {
            if let Ok(Some(version)) = provider.get_current_version().await {
                return Ok(Some(DetectedEnvironment {
                    env_type: logical,
                    version,
                    source: "global".to_string(),
                    source_path: None,
                    source_type: "global".to_string(),
                }));
            }
        }

        Ok(None)
    }

    pub async fn detect_all_versions(
        &self,
        start_path: &Path,
    ) -> CogniaResult<Vec<DetectedEnvironment>> {
        let all_types = SystemEnvironmentType::all();
        let mut detected = Vec::with_capacity(all_types.len());
        for env in &all_types {
            let env_type = env.env_type();
            let logical = normalize_env_type(env_type);
            let sources = super::project_env_detect::default_enabled_detection_sources(&logical);
            if let Some(item) = self
                .detect_version_with_sources(&logical, start_path, &sources)
                .await?
            {
                detected.push(item);
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
        let all_types = SystemEnvironmentType::all();
        let mut futures = Vec::with_capacity(all_types.len());

        for env in &all_types {
            let env_type = env.env_type().to_string();
            let registry = self.registry.clone();
            futures.push(tokio::spawn(async move {
                let manager = EnvironmentManager::new(registry);
                let timeout = tokio::time::timeout(
                    std::time::Duration::from_secs(15),
                    manager.check_env_updates(&env_type),
                );
                match timeout.await {
                    Ok(Ok(result)) => Some(result),
                    Ok(Err(_)) | Err(_) => None,
                }
            }));
        }

        let joined = futures::future::join_all(futures).await;
        let results: Vec<EnvUpdateCheckResult> = joined
            .into_iter()
            .filter_map(|r| r.ok().flatten())
            .collect();

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
///
/// Tries the `semver` crate first (handles pre-release, build metadata correctly).
/// Falls back to numeric-only comparison for non-semver strings (e.g. `nightly-2025-01-01`).
fn compare_semver(a: &str, b: &str) -> i32 {
    fn clean(s: &str) -> &str {
        let s = s.trim();
        s.strip_prefix('v').unwrap_or(s)
    }

    let ca = clean(a);
    let cb = clean(b);

    // Try semver crate first — handles pre-release ordering correctly
    if let (Ok(va), Ok(vb)) = (semver::Version::parse(ca), semver::Version::parse(cb)) {
        return match va.cmp(&vb) {
            std::cmp::Ordering::Greater => 1,
            std::cmp::Ordering::Less => -1,
            std::cmp::Ordering::Equal => 0,
        };
    }

    // Lenient: try parsing as semver::VersionReq won't help here, so fall back to
    // numeric-only comparison for non-semver strings.
    let parse =
        |s: &str| -> Vec<u64> { s.split('.').filter_map(|p| p.parse::<u64>().ok()).collect() };
    let a_parts = parse(ca);
    let b_parts = parse(cb);
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
    use tempfile::tempdir;

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
        current_version: Option<String>,
    }

    impl DummyEnvProvider {
        fn new(id: &'static str, available: bool) -> Self {
            Self {
                id,
                available,
                current_version: None,
            }
        }

        fn with_current_version(mut self, version: &str) -> Self {
            self.current_version = Some(version.to_string());
            self
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
            Ok(self.current_version.clone())
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
        assert_eq!(normalize_env_type("adoptium"), "java");
        assert_eq!(normalize_env_type("sdkman-kotlin"), "kotlin");
        assert_eq!(normalize_env_type("sdkman-scala"), "scala");
        assert_eq!(normalize_env_type("sdkman-gradle"), "gradle");
        assert_eq!(normalize_env_type("sdkman-maven"), "maven");
        assert_eq!(normalize_env_type("system-java"), "java");
        assert_eq!(normalize_env_type("system-kotlin"), "kotlin");
    }

    #[test]
    fn normalize_env_type_maps_python_and_polyglot_providers() {
        assert_eq!(normalize_env_type("uv"), "python");
        assert_eq!(normalize_env_type("conda"), "python");
        assert_eq!(normalize_env_type("pipx"), "python");
        assert_eq!(normalize_env_type("mise"), "polyglot");
        assert_eq!(normalize_env_type("asdf"), "polyglot");
        assert_eq!(normalize_env_type("nix"), "polyglot");
    }

    #[test]
    fn provider_env_type_mapping_includes_extended_entries() {
        let mapping = provider_env_type_mapping();
        assert_eq!(mapping.get("uv"), Some(&"python".to_string()));
        assert_eq!(mapping.get("pipx"), Some(&"python".to_string()));
        assert_eq!(mapping.get("adoptium"), Some(&"java".to_string()));
        assert_eq!(mapping.get("sdkman-gradle"), Some(&"gradle".to_string()));
        assert_eq!(mapping.get("sdkman-maven"), Some(&"maven".to_string()));
        assert_eq!(mapping.get("mise"), Some(&"polyglot".to_string()));
        assert_eq!(mapping.get("asdf"), Some(&"polyglot".to_string()));
        assert_eq!(mapping.get("nix"), Some(&"polyglot".to_string()));
    }

    #[test]
    fn env_type_to_default_provider_returns_expected_values() {
        assert_eq!(env_type_to_default_provider("fnm"), "fnm");
        assert_eq!(env_type_to_default_provider("python"), "pyenv");
        assert_eq!(env_type_to_default_provider("kotlin"), "sdkman-kotlin");
        assert_eq!(
            env_type_to_default_provider("sdkman-gradle"),
            "sdkman-gradle"
        );
        assert_eq!(env_type_to_default_provider("sdkman-maven"), "sdkman-maven");
        assert_eq!(env_type_to_default_provider("unknown"), "unknown");
    }

    #[test]
    fn candidate_provider_ids_includes_scala() {
        let candidates = candidate_provider_ids("scala");
        assert!(candidates.contains(&"sdkman-scala"));
        assert!(candidates.contains(&"mise"));
        assert!(candidates.contains(&"asdf"));
    }

    #[test]
    fn candidate_provider_ids_include_extended_python_candidates() {
        let candidates = candidate_provider_ids("python");
        assert!(candidates.contains(&"uv"));
        assert!(candidates.contains(&"pyenv"));
        assert!(candidates.contains(&"system-python"));
    }

    #[test]
    fn candidate_provider_ids_include_gradle_and_maven() {
        let gradle_candidates = candidate_provider_ids("gradle");
        let maven_candidates = candidate_provider_ids("maven");
        assert!(gradle_candidates.contains(&"sdkman-gradle"));
        assert!(maven_candidates.contains(&"sdkman-maven"));
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

    #[tokio::test]
    async fn detect_version_falls_back_to_global_when_no_project_source_matches() {
        let mut registry = ProviderRegistry::new();
        registry.register_environment_provider(Arc::new(
            DummyEnvProvider::new("deno", true).with_current_version("1.40.5"),
        ));

        let manager = EnvironmentManager::new(Arc::new(RwLock::new(registry)));
        let dir = tempdir().unwrap();

        let detected = manager.detect_version("deno", dir.path()).await.unwrap().unwrap();
        assert_eq!(detected.env_type, "deno");
        assert_eq!(detected.version, "1.40.5");
        assert_eq!(detected.source, "global");
        assert_eq!(detected.source_type, "global");
        assert!(detected.source_path.is_none());
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
