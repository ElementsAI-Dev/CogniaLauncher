use crate::config::Settings;
use crate::error::CogniaResult;
use crate::provider::{InstallRequest, ProviderRegistry, UninstallRequest};
use serde::{Deserialize, Serialize};
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

/// Batch operations manager
pub struct BatchManager {
    registry: Arc<RwLock<ProviderRegistry>>,
    #[allow(dead_code)]
    settings: Settings,
    max_parallel: usize,
    max_retries: u32,
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
        }
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
            for result in results {
                match result {
                    Ok(item) => successful.push(item),
                    Err(item) => failed.push(item),
                }
            }
        } else {
            for (idx, spec) in to_install.iter().enumerate() {
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
                        successful.push(item);
                    }
                    Err(item) => {
                        on_progress(BatchProgress::ItemCompleted {
                            package: spec.name.clone(),
                            success: false,
                            current: idx + 1,
                            total,
                        });
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
        let total = packages.len();

        on_progress(BatchProgress::Starting { total });

        let mut successful = Vec::new();
        let mut failed = Vec::new();
        let skipped = Vec::new();

        for (idx, name) in packages.iter().enumerate() {
            on_progress(BatchProgress::Installing {
                package: name.clone(),
                current: idx + 1,
                total,
            });

            match self.uninstall_single(name, force).await {
                Ok(item) => {
                    on_progress(BatchProgress::ItemCompleted {
                        package: name.clone(),
                        success: true,
                        current: idx + 1,
                        total,
                    });
                    successful.push(item);
                }
                Err(item) => {
                    on_progress(BatchProgress::ItemCompleted {
                        package: name.clone(),
                        success: false,
                        current: idx + 1,
                        total,
                    });
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
        let to_update: Vec<String> = if let Some(pkgs) = packages {
            pkgs
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
                            all_installed.extend(installed.into_iter().map(|i| i.name));
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

        for (idx, name) in to_update.iter().enumerate() {
            on_progress(BatchProgress::Resolving {
                package: name.clone(),
                current: idx + 1,
                total,
            });

            // Check if update is available
            let registry = self.registry.read().await;
            let update_available = self.check_update_available(&registry, name).await;
            drop(registry);

            match update_available {
                Ok(Some((current, latest, provider))) => {
                    on_progress(BatchProgress::Installing {
                        package: name.clone(),
                        current: idx + 1,
                        total,
                    });

                    let spec = PackageSpec {
                        name: name.clone(),
                        version: Some(latest.clone()),
                        provider: Some(provider.clone()),
                    };

                    match self.install_single(&spec, true, true).await {
                        Ok(mut item) => {
                            item.action = format!("updated {} -> {}", current, latest);
                            successful.push(item);
                        }
                        Err(item) => failed.push(item),
                    }
                }
                Ok(None) => {
                    skipped.push(BatchItemSkipped {
                        name: name.clone(),
                        reason: "Already at latest version".into(),
                    });
                }
                Err(e) => {
                    failed.push(BatchItemError {
                        name: name.clone(),
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
    ) -> Vec<Result<BatchItemResult, BatchItemError>>
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
                    (idx, spec.name.clone(), result)
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
            .map(|(current, (_, name, result))| {
                on_progress(BatchProgress::ItemCompleted {
                    package: name,
                    success: result.is_ok(),
                    current: current + 1,
                    total,
                });
                result
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
        name: &str,
        force: bool,
    ) -> Result<BatchItemResult, BatchItemError> {
        let registry = self.registry.read().await;

        let provider = match registry.find_for_package(name).await {
            Ok(Some(p)) => p,
            Ok(None) => {
                return Err(BatchItemError {
                    name: name.into(),
                    error: format!("No provider found for package: {}", name),
                    recoverable: false,
                    suggestion: None,
                });
            }
            Err(e) => {
                return Err(BatchItemError {
                    name: name.into(),
                    error: e.to_string(),
                    recoverable: false,
                    suggestion: None,
                });
            }
        };

        let request = UninstallRequest {
            name: name.into(),
            version: None,
            force,
        };

        match provider.uninstall(request).await {
            Ok(_) => Ok(BatchItemResult {
                name: name.into(),
                version: String::new(),
                provider: provider.id().to_string(),
                action: "uninstalled".into(),
            }),
            Err(e) => Err(BatchItemError {
                name: name.into(),
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
                    if let Ok(installed) = p
                        .list_installed(crate::provider::InstalledFilter::default())
                        .await
                    {
                        if installed.iter().any(|i| i.name.eq_ignore_ascii_case(name)) {
                            return true;
                        }
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
    ) -> Result<Option<(String, String, String)>, String> {
        for provider_id in registry.list() {
            if let Some(p) = registry.get(provider_id) {
                if p.is_available().await {
                    if let Ok(installed) = p
                        .list_installed(crate::provider::InstalledFilter::default())
                        .await
                    {
                        if let Some(pkg) = installed.iter().find(|i| i.name.eq_ignore_ascii_case(name))
                        {
                            // Get latest version
                            if let Ok(versions) = p.get_versions(name).await {
                                if let Some(latest) = versions.first() {
                                    if latest.version != pkg.version {
                                        return Ok(Some((
                                            pkg.version.clone(),
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
            // Check if it looks like a version
            if potential_version
                .chars()
                .next()
                .map(|c| c.is_ascii_digit() || c == '^' || c == '~' || c == '*')
                .unwrap_or(false)
            {
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
}
