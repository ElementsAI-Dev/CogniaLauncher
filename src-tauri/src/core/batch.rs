use crate::config::Settings;
use crate::core::HistoryManager;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::disk;
use crate::provider::{InstallRequest, InstalledFilter, ProviderRegistry, UninstallRequest};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Batch operation for installing multiple packages
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchInstallRequest {
    pub packages: Vec<String>,
    pub dry_run: bool,
    pub parallel: bool,
    pub force: bool,
    pub global: bool,
}

impl Default for BatchInstallRequest {
    fn default() -> Self {
        Self {
            packages: Vec::new(),
            dry_run: false,
            parallel: true,
            force: false,
            global: true,
        }
    }
}

/// Result of a batch operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchResult {
    pub successful: Vec<BatchItemResult>,
    pub failed: Vec<BatchItemError>,
    pub skipped: Vec<BatchItemSkipped>,
    pub total_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchItemResult {
    pub name: String,
    pub version: String,
    pub provider: String,
    pub action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchItemError {
    pub name: String,
    pub error: String,
    pub recoverable: bool,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchItemSkipped {
    pub name: String,
    pub reason: String,
}

/// Progress events for batch operations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BatchProgress {
    Starting {
        total: usize,
    },
    Resolving {
        package: String,
        current: usize,
        total: usize,
    },
    Downloading {
        package: String,
        progress: f32,
        current: usize,
        total: usize,
    },
    Installing {
        package: String,
        current: usize,
        total: usize,
    },
    ItemCompleted {
        package: String,
        success: bool,
        current: usize,
        total: usize,
    },
    Completed {
        result: BatchResult,
    },
}

/// Cancellation token for batch operations
#[derive(Debug, Clone, Default)]
pub struct CancellationToken {
    cancelled: Arc<AtomicBool>,
}

impl CancellationToken {
    /// Create a new cancellation token
    pub fn new() -> Self {
        Self {
            cancelled: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Check if the operation has been cancelled
    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }

    /// Cancel the operation
    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
    }

    /// Reset the cancellation state
    pub fn reset(&self) {
        self.cancelled.store(false, Ordering::SeqCst);
    }
}

/// Batch operations manager
pub struct BatchManager {
    registry: Arc<RwLock<ProviderRegistry>>,
    #[allow(dead_code)]
    settings: Settings,
    max_parallel: usize,
    max_retries: u32,
    cancel_token: Option<CancellationToken>,
}

impl BatchManager {
    pub fn new(registry: Arc<RwLock<ProviderRegistry>>, settings: Settings) -> Self {
        let max_parallel = settings.general.parallel_downloads as usize;
        let max_retries = settings.network.retries;
        Self {
            registry,
            settings,
            max_parallel: if max_parallel > 0 { max_parallel } else { 4 },
            max_retries,
            cancel_token: None,
        }
    }

    /// Set a cancellation token for this batch manager
    pub fn with_cancel_token(mut self, token: CancellationToken) -> Self {
        self.cancel_token = Some(token);
        self
    }

    /// Check if the operation should be cancelled
    fn should_cancel(&self) -> bool {
        self.cancel_token
            .as_ref()
            .map(|t| t.is_cancelled())
            .unwrap_or(false)
    }

    /// Install multiple packages with optional parallelization
    pub async fn batch_install<F>(
        &self,
        request: BatchInstallRequest,
        mut on_progress: F,
    ) -> CogniaResult<BatchResult>
    where
        F: FnMut(BatchProgress) + Send,
    {
        let start_time = std::time::Instant::now();
        let total = request.packages.len();

        on_progress(BatchProgress::Starting { total });

        let mut successful = Vec::new();
        let mut failed = Vec::new();
        let mut skipped = Vec::new();

        // Parse package specifications
        let specs: Vec<PackageSpec> = request
            .packages
            .iter()
            .map(|p| PackageSpec::parse(p))
            .collect();

        // Ensure there is enough disk space for installations
        if !request.dry_run {
            let cache_dir = self.settings.get_cache_dir();
            let required = self
                .settings
                .general
                .min_install_space_mb
                .saturating_mul(1024 * 1024);
            disk::ensure_space(&cache_dir, required).await?;
        }

        // Check for already installed packages (if not forcing)
        let registry = self.registry.read().await;
        if !request.force {
            for spec in &specs {
                if self.is_installed(&registry, &spec.name).await {
                    skipped.push(BatchItemSkipped {
                        name: spec.name.clone(),
                        reason: "Already installed".into(),
                    });
                }
            }
        }
        drop(registry);

        // Filter out skipped packages
        let to_install: Vec<_> = specs
            .into_iter()
            .filter(|s| !skipped.iter().any(|sk| sk.name == s.name))
            .collect();

        if request.dry_run {
            // For dry run, just return what would be installed
            for spec in to_install {
                successful.push(BatchItemResult {
                    name: spec.name,
                    version: spec.version.unwrap_or_else(|| "latest".into()),
                    provider: spec.provider.unwrap_or_default(),
                    action: "would_install".into(),
                });
            }

            return Ok(BatchResult {
                successful,
                failed,
                skipped,
                total_time_ms: start_time.elapsed().as_millis() as u64,
            });
        }

        // Install packages
        if request.parallel && to_install.len() > 1 {
            let results = self
                .install_parallel(to_install, &mut on_progress, request.global, request.force)
                .await;
            for (spec, result) in results {
                match result {
                    Ok(item) => {
                        let _ = HistoryManager::record_install(
                            &item.name,
                            &item.version,
                            &item.provider,
                            true,
                            None,
                        )
                        .await;
                        successful.push(item);
                    }
                    Err(item) => {
                        let version = spec.version.unwrap_or_else(|| "latest".into());
                        let provider = spec.provider.unwrap_or_else(|| "unknown".into());
                        let _ = HistoryManager::record_install(
                            &spec.name,
                            &version,
                            &provider,
                            false,
                            Some(item.error.clone()),
                        )
                        .await;
                        failed.push(item);
                    }
                }
            }
        } else {
            for (idx, spec) in to_install.iter().enumerate() {
                // Check for cancellation before each package
                if self.should_cancel() {
                    return Err(CogniaError::Cancelled);
                }

                on_progress(BatchProgress::Installing {
                    package: spec.name.clone(),
                    current: idx + 1,
                    total,
                });

                match self
                    .install_single(spec, request.global, request.force)
                    .await
                {
                    Ok(item) => {
                        on_progress(BatchProgress::ItemCompleted {
                            package: spec.name.clone(),
                            success: true,
                            current: idx + 1,
                            total,
                        });
                        let _ = HistoryManager::record_install(
                            &item.name,
                            &item.version,
                            &item.provider,
                            true,
                            None,
                        )
                        .await;
                        successful.push(item);
                    }
                    Err(item) => {
                        on_progress(BatchProgress::ItemCompleted {
                            package: spec.name.clone(),
                            success: false,
                            current: idx + 1,
                            total,
                        });
                        let version = spec.version.clone().unwrap_or_else(|| "latest".into());
                        let provider = spec.provider.clone().unwrap_or_else(|| "unknown".into());
                        let _ = HistoryManager::record_install(
                            &spec.name,
                            &version,
                            &provider,
                            false,
                            Some(item.error.clone()),
                        )
                        .await;
                        failed.push(item);
                    }
                }
            }
        }

        let result = BatchResult {
            successful,
            failed,
            skipped,
            total_time_ms: start_time.elapsed().as_millis() as u64,
        };

        on_progress(BatchProgress::Completed {
            result: result.clone(),
        });

        Ok(result)
    }

    /// Uninstall multiple packages
    pub async fn batch_uninstall<F>(
        &self,
        packages: Vec<String>,
        force: bool,
        mut on_progress: F,
    ) -> CogniaResult<BatchResult>
    where
        F: FnMut(BatchProgress) + Send,
    {
        let start_time = std::time::Instant::now();
        let specs: Vec<PackageSpec> = packages.iter().map(|p| PackageSpec::parse(p)).collect();
        let total = specs.len();

        on_progress(BatchProgress::Starting { total });

        let mut successful = Vec::new();
        let mut failed = Vec::new();
        let skipped = Vec::new();

        for (idx, spec) in specs.iter().enumerate() {
            on_progress(BatchProgress::Installing {
                package: spec.name.clone(),
                current: idx + 1,
                total,
            });

            match self.uninstall_single(spec, force).await {
                Ok(item) => {
                    on_progress(BatchProgress::ItemCompleted {
                        package: spec.name.clone(),
                        success: true,
                        current: idx + 1,
                        total,
                    });
                    let _ = HistoryManager::record_uninstall(
                        &item.name,
                        &item.version,
                        &item.provider,
                        true,
                        None,
                    )
                    .await;
                    successful.push(item);
                }
                Err(item) => {
                    on_progress(BatchProgress::ItemCompleted {
                        package: spec.name.clone(),
                        success: false,
                        current: idx + 1,
                        total,
                    });
                    let provider = spec.provider.clone().unwrap_or_else(|| "unknown".into());
                    let _ = HistoryManager::record_uninstall(
                        &spec.name,
                        "unknown",
                        &provider,
                        false,
                        Some(item.error.clone()),
                    )
                    .await;
                    failed.push(item);
                }
            }
        }

        let result = BatchResult {
            successful,
            failed,
            skipped,
            total_time_ms: start_time.elapsed().as_millis() as u64,
        };

        on_progress(BatchProgress::Completed {
            result: result.clone(),
        });

        Ok(result)
    }

    /// Update multiple packages
    pub async fn batch_update<F>(
        &self,
        packages: Option<Vec<String>>,
        mut on_progress: F,
    ) -> CogniaResult<BatchResult>
    where
        F: FnMut(BatchProgress) + Send,
    {
        let start_time = std::time::Instant::now();
        let registry = self.registry.read().await;

        // Get list of packages to update
        let to_update: Vec<PackageSpec> = if let Some(pkgs) = packages {
            pkgs.iter().map(|p| PackageSpec::parse(p)).collect()
        } else {
            // Get all installed packages
            let mut all_installed = Vec::new();
            for provider_id in registry.list() {
                if let Some(p) = registry.get(provider_id) {
                    if p.is_available().await {
                        if let Ok(installed) = p
                            .list_installed(crate::provider::InstalledFilter::default())
                            .await
                        {
                            all_installed.extend(installed.into_iter().map(|i| PackageSpec {
                                name: i.name,
                                version: None,
                                provider: Some(i.provider),
                            }));
                        }
                    }
                }
            }
            all_installed
        };

        drop(registry);

        let total = to_update.len();
        on_progress(BatchProgress::Starting { total });

        let mut successful = Vec::new();
        let mut failed = Vec::new();
        let mut skipped = Vec::new();

        for (idx, spec) in to_update.iter().enumerate() {
            on_progress(BatchProgress::Resolving {
                package: spec.name.clone(),
                current: idx + 1,
                total,
            });

            // Check if update is available
            let registry = self.registry.read().await;
            let update_available = self
                .check_update_available(&registry, &spec.name, spec.provider.as_deref())
                .await;
            drop(registry);

            match update_available {
                Ok(Some((current, latest, provider))) => {
                    on_progress(BatchProgress::Installing {
                        package: spec.name.clone(),
                        current: idx + 1,
                        total,
                    });

                    let spec = PackageSpec {
                        name: spec.name.clone(),
                        version: Some(latest.clone()),
                        provider: Some(provider.clone()),
                    };

                    match self.install_single(&spec, true, true).await {
                        Ok(mut item) => {
                            item.action = format!("updated {} -> {}", current, latest);
                            let _ = HistoryManager::record_update(
                                &spec.name,
                                &current,
                                &latest,
                                &provider,
                                true,
                                None,
                            )
                            .await;
                            successful.push(item);
                        }
                        Err(item) => {
                            let _ = HistoryManager::record_update(
                                &spec.name,
                                &current,
                                &latest,
                                &provider,
                                false,
                                Some(item.error.clone()),
                            )
                            .await;
                            failed.push(item);
                        }
                    }
                }
                Ok(None) => {
                    skipped.push(BatchItemSkipped {
                        name: spec.name.clone(),
                        reason: "Already at latest version".into(),
                    });
                }
                Err(e) => {
                    failed.push(BatchItemError {
                        name: spec.name.clone(),
                        error: e,
                        recoverable: false,
                        suggestion: None,
                    });
                }
            }
        }

        let result = BatchResult {
            successful,
            failed,
            skipped,
            total_time_ms: start_time.elapsed().as_millis() as u64,
        };

        on_progress(BatchProgress::Completed {
            result: result.clone(),
        });

        Ok(result)
    }

    async fn install_parallel<F>(
        &self,
        specs: Vec<PackageSpec>,
        on_progress: &mut F,
        global: bool,
        force: bool,
    ) -> Vec<(PackageSpec, Result<BatchItemResult, BatchItemError>)>
    where
        F: FnMut(BatchProgress) + Send,
    {
        use futures::stream::{self, StreamExt};

        let total = specs.len();
        let registry = self.registry.clone();
        let max_retries = self.max_retries;

        let results: Vec<_> = stream::iter(specs.into_iter().enumerate())
            .map(|(idx, spec)| {
                let registry = registry.clone();
                async move {
                    let result =
                        Self::install_with_retry(registry, &spec, global, force, max_retries).await;
                    (idx, spec, result)
                }
            })
            .buffer_unordered(self.max_parallel)
            .collect()
            .await;

        // Sort by original index and convert to results
        let mut sorted_results: Vec<_> = results.into_iter().collect();
        sorted_results.sort_by_key(|(idx, _, _)| *idx);

        sorted_results
            .into_iter()
            .enumerate()
            .map(|(current, (_, spec, result))| {
                on_progress(BatchProgress::ItemCompleted {
                    package: spec.name.clone(),
                    success: result.is_ok(),
                    current: current + 1,
                    total,
                });
                (spec, result)
            })
            .collect()
    }

    async fn install_with_retry(
        registry: Arc<RwLock<ProviderRegistry>>,
        spec: &PackageSpec,
        global: bool,
        force: bool,
        max_retries: u32,
    ) -> Result<BatchItemResult, BatchItemError> {
        let mut last_error = String::new();

        for attempt in 0..=max_retries {
            let reg = registry.read().await;

            let provider = if let Some(ref pid) = spec.provider {
                reg.get(pid)
            } else {
                match reg.find_for_package(&spec.name).await {
                    Ok(p) => p,
                    Err(e) => {
                        last_error = e.to_string();
                        continue;
                    }
                }
            };

            let provider = match provider {
                Some(p) => p,
                None => {
                    return Err(BatchItemError {
                        name: spec.name.clone(),
                        error: format!("No provider found for package: {}", spec.name),
                        recoverable: false,
                        suggestion: Some("Try specifying a provider explicitly".into()),
                    });
                }
            };

            let request = InstallRequest {
                name: spec.name.clone(),
                version: spec.version.clone(),
                global,
                force,
            };

            match provider.install(request).await {
                Ok(receipt) => {
                    return Ok(BatchItemResult {
                        name: receipt.name,
                        version: receipt.version,
                        provider: provider.id().to_string(),
                        action: "installed".into(),
                    });
                }
                Err(e) => {
                    last_error = e.to_string();
                    if attempt < max_retries {
                        // Exponential backoff
                        let delay = std::time::Duration::from_millis(100 * 2u64.pow(attempt));
                        tokio::time::sleep(delay).await;
                    }
                }
            }
        }

        Err(BatchItemError {
            name: spec.name.clone(),
            error: last_error.clone(),
            recoverable: Self::is_recoverable_error(&last_error),
            suggestion: Self::get_error_suggestion(&last_error),
        })
    }

    async fn install_single(
        &self,
        spec: &PackageSpec,
        global: bool,
        force: bool,
    ) -> Result<BatchItemResult, BatchItemError> {
        Self::install_with_retry(
            self.registry.clone(),
            spec,
            global,
            force,
            self.max_retries,
        )
        .await
    }

    async fn uninstall_single(
        &self,
        spec: &PackageSpec,
        force: bool,
    ) -> Result<BatchItemResult, BatchItemError> {
        let registry = self.registry.read().await;

        let provider = if let Some(ref provider_id) = spec.provider {
            registry.get(provider_id).ok_or_else(|| BatchItemError {
                name: spec.name.clone(),
                error: format!("Provider not found: {}", provider_id),
                recoverable: false,
                suggestion: None,
            })?
        } else {
            match registry.find_for_package(&spec.name).await {
                Ok(Some(p)) => p,
                Ok(None) => {
                    return Err(BatchItemError {
                        name: spec.name.clone(),
                        error: format!("No provider found for package: {}", spec.name),
                        recoverable: false,
                        suggestion: None,
                    });
                }
                Err(e) => {
                    return Err(BatchItemError {
                        name: spec.name.clone(),
                        error: e.to_string(),
                        recoverable: false,
                        suggestion: None,
                    });
                }
            }
        };

        let installed_version = provider
            .list_installed(InstalledFilter {
                name_filter: Some(spec.name.clone()),
                ..Default::default()
            })
            .await
            .ok()
            .and_then(|packages| packages.first().map(|pkg| pkg.version.clone()))
            .unwrap_or_else(|| "unknown".to_string());

        let request = UninstallRequest {
            name: spec.name.clone(),
            version: None,
            force,
        };

        match provider.uninstall(request).await {
            Ok(_) => Ok(BatchItemResult {
                name: spec.name.clone(),
                version: installed_version,
                provider: provider.id().to_string(),
                action: "uninstalled".into(),
            }),
            Err(e) => Err(BatchItemError {
                name: spec.name.clone(),
                error: e.to_string(),
                recoverable: false,
                suggestion: None,
            }),
        }
    }

    async fn is_installed(&self, registry: &ProviderRegistry, name: &str) -> bool {
        for provider_id in registry.list() {
            if let Some(p) = registry.get(provider_id) {
                if p.is_available().await {
                    if let Ok(Some(_)) = p.get_installed_version(name).await {
                        return true;
                    }
                }
            }
        }
        false
    }

    async fn check_update_available(
        &self,
        registry: &ProviderRegistry,
        name: &str,
        provider_override: Option<&str>,
    ) -> Result<Option<(String, String, String)>, String> {
        let provider_ids: Vec<String> = if let Some(provider) = provider_override {
            vec![provider.to_string()]
        } else {
            registry.list().iter().map(|id| id.to_string()).collect()
        };

        for provider_id in provider_ids {
            if let Some(p) = registry.get(&provider_id) {
                if p.is_available().await {
                    if let Ok(Some(current_version)) = p.get_installed_version(name).await {
                        // Get latest version
                        if let Ok(versions) = p.get_versions(name).await {
                            if let Some(latest) = versions.first() {
                                if latest.version != current_version {
                                    return Ok(Some((
                                        current_version,
                                        latest.version.clone(),
                                        provider_id.to_string(),
                                    )));
                                }
                            }
                        }
                        return Ok(None);
                    }
                }
            }
        }
        Err(format!("Package not found: {}", name))
    }

    fn is_recoverable_error(error: &str) -> bool {
        let recoverable_patterns = [
            "timeout",
            "connection",
            "network",
            "temporary",
            "rate limit",
            "503",
            "502",
            "504",
        ];
        let error_lower = error.to_lowercase();
        recoverable_patterns.iter().any(|p| error_lower.contains(p))
    }

    fn get_error_suggestion(error: &str) -> Option<String> {
        let error_lower = error.to_lowercase();

        if error_lower.contains("permission") || error_lower.contains("access denied") {
            return Some("Try running with administrator/sudo privileges".into());
        }
        if error_lower.contains("not found") {
            return Some("Check package name spelling or try a different provider".into());
        }
        if error_lower.contains("network") || error_lower.contains("connection") {
            return Some("Check your internet connection and try again".into());
        }
        if error_lower.contains("rate limit") {
            return Some("Wait a few minutes and try again".into());
        }
        if error_lower.contains("checksum") || error_lower.contains("hash") {
            return Some("Try clearing the cache and downloading again".into());
        }
        if error_lower.contains("disk") || error_lower.contains("space") {
            return Some("Free up disk space and try again".into());
        }

        None
    }
}

/// Package specification parser
#[derive(Debug, Clone)]
pub struct PackageSpec {
    pub name: String,
    pub version: Option<String>,
    pub provider: Option<String>,
}

impl PackageSpec {
    /// Check if a string looks like a version specifier
    fn looks_like_version(s: &str) -> bool {
        if s.is_empty() {
            return false;
        }

        // Common dist tags
        let dist_tags = [
            "latest", "next", "beta", "alpha", "canary", "rc", "stable", "dev", "nightly",
        ];
        let s_lower = s.to_lowercase();
        if dist_tags.iter().any(|tag| s_lower == *tag || s_lower.starts_with(&format!("{}-", tag))) {
            return true;
        }

        let first_char = s.chars().next().unwrap();

        // Starts with digit: 1.0.0, 18.0.0
        if first_char.is_ascii_digit() {
            return true;
        }

        // Range prefixes: ^, ~, *, x, X
        if matches!(first_char, '^' | '~' | '*' | 'x' | 'X') {
            return true;
        }

        // Comparison operators followed by digit: >=1.0.0, <=2.0.0, >0.5, <3, =1.0
        if matches!(first_char, '>' | '<' | '=') {
            let rest = s.trim_start_matches(|c| c == '>' || c == '<' || c == '=');
            if rest.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) {
                return true;
            }
        }

        // Version prefix: v1.0.0, V1.0.0
        if matches!(first_char, 'v' | 'V') {
            if s.chars().nth(1).map(|c| c.is_ascii_digit()).unwrap_or(false) {
                return true;
            }
        }

        false
    }

    pub fn parse(input: &str) -> Self {
        let input = input.trim();

        // Check for provider prefix: provider:package@version
        let (provider, rest) = if let Some(idx) = input.find(':') {
            if !input[..idx].contains('@') && !input[..idx].contains('/') {
                (Some(input[..idx].to_string()), &input[idx + 1..])
            } else {
                (None, input)
            }
        } else {
            (None, input)
        };

        // Check for version suffix: package@version
        let (name, version) = if let Some(idx) = rest.rfind('@') {
            let potential_version = &rest[idx + 1..];
            // Check if it looks like a version:
            // - Digits: 1.0.0, 18.0.0
            // - Range prefixes: ^1.0.0, ~1.0.0, >=1.0.0, <=1.0.0, >1.0.0, <1.0.0, =1.0.0
            // - Wildcards: *, x, X
            // - Version prefix: v1.0.0
            // - Dist tags: latest, next, beta, alpha, canary, rc, stable, dev, nightly
            let looks_like_version = Self::looks_like_version(potential_version);
            if looks_like_version {
                (rest[..idx].to_string(), Some(potential_version.to_string()))
            } else {
                (rest.to_string(), None)
            }
        } else {
            (rest.to_string(), None)
        };

        Self {
            name,
            version,
            provider,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_package_spec_simple() {
        let spec = PackageSpec::parse("lodash");
        assert_eq!(spec.name, "lodash");
        assert!(spec.version.is_none());
        assert!(spec.provider.is_none());
    }

    #[test]
    fn test_package_spec_with_version() {
        let spec = PackageSpec::parse("lodash@4.17.21");
        assert_eq!(spec.name, "lodash");
        assert_eq!(spec.version, Some("4.17.21".into()));
        assert!(spec.provider.is_none());
    }

    #[test]
    fn test_package_spec_with_provider() {
        let spec = PackageSpec::parse("npm:lodash@^4.0.0");
        assert_eq!(spec.name, "lodash");
        assert_eq!(spec.version, Some("^4.0.0".into()));
        assert_eq!(spec.provider, Some("npm".into()));
    }

    #[test]
    fn test_package_spec_scoped() {
        let spec = PackageSpec::parse("@types/node@18.0.0");
        assert_eq!(spec.name, "@types/node");
        assert_eq!(spec.version, Some("18.0.0".into()));
    }

    #[test]
    fn test_package_spec_scoped_no_version() {
        let spec = PackageSpec::parse("@vue/cli-service");
        assert_eq!(spec.name, "@vue/cli-service");
        assert!(spec.version.is_none());
    }

    #[test]
    fn test_package_spec_with_provider_scoped() {
        let spec = PackageSpec::parse("npm:@types/node@18.0.0");
        assert_eq!(spec.name, "@types/node");
        assert_eq!(spec.version, Some("18.0.0".into()));
        assert_eq!(spec.provider, Some("npm".into()));
    }

    #[test]
    fn test_package_spec_comparison_operators() {
        let spec = PackageSpec::parse("lodash@>=4.0.0");
        assert_eq!(spec.name, "lodash");
        assert_eq!(spec.version, Some(">=4.0.0".into()));

        let spec = PackageSpec::parse("lodash@<=4.0.0");
        assert_eq!(spec.name, "lodash");
        assert_eq!(spec.version, Some("<=4.0.0".into()));

        let spec = PackageSpec::parse("lodash@>4.0.0");
        assert_eq!(spec.name, "lodash");
        assert_eq!(spec.version, Some(">4.0.0".into()));

        let spec = PackageSpec::parse("lodash@<4.0.0");
        assert_eq!(spec.name, "lodash");
        assert_eq!(spec.version, Some("<4.0.0".into()));

        let spec = PackageSpec::parse("lodash@=4.0.0");
        assert_eq!(spec.name, "lodash");
        assert_eq!(spec.version, Some("=4.0.0".into()));
    }

    #[test]
    fn test_package_spec_dist_tags() {
        let spec = PackageSpec::parse("lodash@latest");
        assert_eq!(spec.name, "lodash");
        assert_eq!(spec.version, Some("latest".into()));

        let spec = PackageSpec::parse("lodash@next");
        assert_eq!(spec.name, "lodash");
        assert_eq!(spec.version, Some("next".into()));

        let spec = PackageSpec::parse("lodash@beta");
        assert_eq!(spec.name, "lodash");
        assert_eq!(spec.version, Some("beta".into()));

        let spec = PackageSpec::parse("lodash@alpha");
        assert_eq!(spec.name, "lodash");
        assert_eq!(spec.version, Some("alpha".into()));
    }

    #[test]
    fn test_package_spec_version_prefix() {
        let spec = PackageSpec::parse("lodash@v4.17.21");
        assert_eq!(spec.name, "lodash");
        assert_eq!(spec.version, Some("v4.17.21".into()));
    }

    #[test]
    fn test_package_spec_wildcards() {
        let spec = PackageSpec::parse("lodash@*");
        assert_eq!(spec.name, "lodash");
        assert_eq!(spec.version, Some("*".into()));

        let spec = PackageSpec::parse("lodash@x");
        assert_eq!(spec.name, "lodash");
        assert_eq!(spec.version, Some("x".into()));
    }

    #[test]
    fn test_cancellation_token_new() {
        let token = CancellationToken::new();
        assert!(!token.is_cancelled());
    }

    #[test]
    fn test_cancellation_token_cancel() {
        let token = CancellationToken::new();
        assert!(!token.is_cancelled());
        
        token.cancel();
        assert!(token.is_cancelled());
    }

    #[test]
    fn test_cancellation_token_reset() {
        let token = CancellationToken::new();
        token.cancel();
        assert!(token.is_cancelled());
        
        token.reset();
        assert!(!token.is_cancelled());
    }

    #[test]
    fn test_cancellation_token_clone() {
        let token = CancellationToken::new();
        let cloned = token.clone();
        
        token.cancel();
        
        // Both should be cancelled since they share the same Arc
        assert!(token.is_cancelled());
        assert!(cloned.is_cancelled());
    }

    #[test]
    fn test_batch_install_request_default() {
        let request = BatchInstallRequest::default();
        assert!(request.packages.is_empty());
        assert!(!request.dry_run);
        assert!(request.parallel);
        assert!(!request.force);
        assert!(request.global);
    }

    #[test]
    fn test_batch_result_empty() {
        let result = BatchResult {
            successful: vec![],
            failed: vec![],
            skipped: vec![],
            total_time_ms: 0,
        };
        assert!(result.successful.is_empty());
        assert!(result.failed.is_empty());
        assert!(result.skipped.is_empty());
    }

    #[test]
    fn test_batch_item_result() {
        let item = BatchItemResult {
            name: "lodash".to_string(),
            version: "4.17.21".to_string(),
            provider: "npm".to_string(),
            action: "install".to_string(),
        };
        assert_eq!(item.name, "lodash");
        assert_eq!(item.version, "4.17.21");
        assert_eq!(item.provider, "npm");
        assert_eq!(item.action, "install");
    }

    #[test]
    fn test_batch_item_error() {
        let error = BatchItemError {
            name: "broken-pkg".to_string(),
            error: "Installation failed".to_string(),
            recoverable: true,
            suggestion: Some("Try again later".to_string()),
        };
        assert_eq!(error.name, "broken-pkg");
        assert!(error.recoverable);
        assert!(error.suggestion.is_some());
    }

    #[test]
    fn test_batch_item_skipped() {
        let skipped = BatchItemSkipped {
            name: "lodash".to_string(),
            reason: "Already installed".to_string(),
        };
        assert_eq!(skipped.name, "lodash");
        assert_eq!(skipped.reason, "Already installed");
    }

    #[test]
    fn test_batch_progress_starting() {
        let progress = BatchProgress::Starting { total: 5 };
        match progress {
            BatchProgress::Starting { total } => assert_eq!(total, 5),
            _ => panic!("Expected Starting variant"),
        }
    }

    #[test]
    fn test_batch_progress_installing() {
        let progress = BatchProgress::Installing {
            package: "lodash".to_string(),
            current: 1,
            total: 5,
        };
        match progress {
            BatchProgress::Installing { package, current, total } => {
                assert_eq!(package, "lodash");
                assert_eq!(current, 1);
                assert_eq!(total, 5);
            }
            _ => panic!("Expected Installing variant"),
        }
    }

    #[test]
    fn test_batch_progress_item_completed() {
        let progress = BatchProgress::ItemCompleted {
            package: "lodash".to_string(),
            success: true,
            current: 1,
            total: 5,
        };
        match progress {
            BatchProgress::ItemCompleted { package, success, current, total } => {
                assert_eq!(package, "lodash");
                assert!(success);
                assert_eq!(current, 1);
                assert_eq!(total, 5);
            }
            _ => panic!("Expected ItemCompleted variant"),
        }
    }
}
