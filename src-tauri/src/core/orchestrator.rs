use crate::config::Settings;
use crate::error::{CogniaError, CogniaResult};
use crate::provider::{InstallReceipt, InstallRequest, InstalledFilter, ProviderRegistry};
use crate::core::{HistoryManager, PackageSpec};
use crate::resolver::{Dependency, Package, Resolver, Version};
use serde::{Deserialize, Serialize};
use std::collections::{HashSet, VecDeque};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallPlan {
    pub packages: Vec<PlannedInstall>,
    pub total_download_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlannedInstall {
    pub name: String,
    pub version: String,
    pub provider: String,
    pub download_size: Option<u64>,
    pub is_upgrade: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum InstallProgress {
    Resolving,
    Downloading { package: String, progress: f32 },
    Verifying { package: String },
    Installing { package: String },
    Completed { receipts: Vec<InstallReceipt> },
    Failed { error: String },
}

pub struct Orchestrator {
    registry: Arc<RwLock<ProviderRegistry>>,
    #[allow(dead_code)]
    settings: Settings,
}

impl Orchestrator {
    pub fn new(registry: Arc<RwLock<ProviderRegistry>>, settings: Settings) -> Self {
        Self { registry, settings }
    }

    pub async fn plan_install(&self, packages: &[String]) -> CogniaResult<InstallPlan> {
        let specs: Vec<PackageSpec> = packages.iter().map(|p| PackageSpec::parse(p)).collect();
        let deps: Vec<Dependency> = specs
            .iter()
            .map(|spec| Dependency {
                name: spec.name.clone(),
                constraint: spec
                    .version
                    .as_ref()
                    .map(|v| v.parse().unwrap_or(crate::resolver::VersionConstraint::Any))
                    .unwrap_or(crate::resolver::VersionConstraint::Any),
            })
            .collect();

        let registry = self.registry.read().await;
        let mut resolver = Resolver::new();
        let mut package_providers: std::collections::HashMap<String, String> =
            std::collections::HashMap::new();
        let mut installed_versions: std::collections::HashMap<String, String> =
            std::collections::HashMap::new();

        for provider_id in registry.list() {
            if let Some(provider) = registry.get(provider_id) {
                if provider.is_available().await {
                    if let Ok(installed) = provider
                        .list_installed(crate::provider::InstalledFilter::default())
                        .await
                    {
                        for pkg in installed {
                            installed_versions.insert(pkg.name.to_lowercase(), pkg.version);
                        }
                    }
                }
            }
        }

        let provider_ids: Vec<String> = registry.list().iter().map(|id| id.to_string()).collect();
        let mut queue: VecDeque<(String, Option<String>)> = specs
            .iter()
            .map(|spec| (spec.name.clone(), spec.provider.clone()))
            .collect();
        let mut seen: HashSet<String> = HashSet::new();

        while let Some((name, provider_hint)) = queue.pop_front() {
            if !seen.insert(name.clone()) {
                continue;
            }

            let providers_to_check: Vec<String> = if let Some(provider) = provider_hint.clone() {
                vec![provider]
            } else {
                provider_ids.clone()
            };

            for provider_id in &providers_to_check {
                if let Some(provider) = registry.get(provider_id) {
                    if provider.is_available().await {
                        if let Ok(versions) = provider.get_versions(&name).await {
                            if !versions.is_empty() {
                                package_providers
                                    .entry(name.clone())
                                    .or_insert_with(|| provider_id.to_string());
                            }

                            for v in versions {
                                if let Ok(version) = v.version.parse::<Version>() {
                                    let dependencies = provider
                                        .get_dependencies(&name, &v.version)
                                        .await
                                        .unwrap_or_default();

                                    for dep in &dependencies {
                                        if !seen.contains(&dep.name) {
                                            queue.push_back((dep.name.clone(), None));
                                        }
                                    }

                                    resolver.add_package(Package {
                                        name: name.clone(),
                                        version,
                                        dependencies,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        let resolution = resolver.resolve(&deps)?;
        let mut dependency_map: std::collections::HashMap<String, Vec<String>> =
            std::collections::HashMap::new();

        for (name, version) in resolution.iter() {
            let provider_id = package_providers.get(name).cloned().unwrap_or_default();
            if let Some(provider) = registry.get(&provider_id) {
                let deps = provider
                    .get_dependencies(name, &version.to_string())
                    .await
                    .unwrap_or_default();
                dependency_map.insert(name.clone(), deps.into_iter().map(|d| d.name).collect());
            } else {
                dependency_map.insert(name.clone(), vec![]);
            }
        }

        let mut order = Vec::new();
        let mut visiting = std::collections::HashSet::new();
        let mut visited = std::collections::HashSet::new();

        fn visit(
            name: &str,
            dependency_map: &std::collections::HashMap<String, Vec<String>>,
            visiting: &mut std::collections::HashSet<String>,
            visited: &mut std::collections::HashSet<String>,
            order: &mut Vec<String>,
        ) {
            if visited.contains(name) {
                return;
            }
            if !visiting.insert(name.to_string()) {
                return;
            }

            if let Some(children) = dependency_map.get(name) {
                for child in children {
                    visit(child, dependency_map, visiting, visited, order);
                }
            }

            visiting.remove(name);
            visited.insert(name.to_string());
            order.push(name.to_string());
        }

        for dep in &deps {
            visit(&dep.name, &dependency_map, &mut visiting, &mut visited, &mut order);
        }
        for name in resolution.iter().map(|(name, _)| name) {
            if !visited.contains(name) {
                visit(name, &dependency_map, &mut visiting, &mut visited, &mut order);
            }
        }

        let planned = order
            .into_iter()
            .filter_map(|name| {
                let version = resolution.get(&name)?.to_string();
                let provider = package_providers.get(&name).cloned().unwrap_or_default();
                let is_upgrade = installed_versions
                    .get(&name.to_lowercase())
                    .map(|current| current != &version)
                    .unwrap_or(false);
                Some(PlannedInstall {
                    name,
                    version,
                    provider,
                    download_size: None,
                    is_upgrade,
                })
            })
            .collect();

        Ok(InstallPlan {
            packages: planned,
            total_download_size: 0,
        })
    }

    pub async fn execute_install<F>(
        &self,
        plan: &InstallPlan,
        mut on_progress: F,
    ) -> CogniaResult<Vec<InstallReceipt>>
    where
        F: FnMut(InstallProgress),
    {
        let mut receipts = Vec::new();
        let registry = self.registry.read().await;

        for planned in &plan.packages {
            on_progress(InstallProgress::Installing {
                package: planned.name.clone(),
            });

            let provider = if !planned.provider.is_empty() {
                registry.get(&planned.provider)
            } else {
                registry.find_for_package(&planned.name).await?
            };

            let provider = provider.ok_or_else(|| {
                CogniaError::ProviderNotFound(format!("No provider for {}", planned.name))
            })?;

            let request = InstallRequest {
                name: planned.name.clone(),
                version: if planned.version == "*" {
                    None
                } else {
                    Some(planned.version.clone())
                },
                global: true,
                force: false,
            };

            match provider.install(request).await {
                Ok(receipt) => {
                    let _ = HistoryManager::record_install(
                        &receipt.name,
                        &receipt.version,
                        &receipt.provider,
                        true,
                        None,
                    )
                    .await;
                    receipts.push(receipt);
                }
                Err(err) => {
                    let version = planned
                        .version
                        .strip_prefix('^')
                        .unwrap_or(&planned.version)
                        .to_string();
                    let _ = HistoryManager::record_install(
                        &planned.name,
                        &version,
                        provider.id(),
                        false,
                        Some(err.to_string()),
                    )
                    .await;
                    return Err(err);
                }
            }
        }

        on_progress(InstallProgress::Completed {
            receipts: receipts.clone(),
        });
        Ok(receipts)
    }

    pub async fn install(&self, packages: &[String]) -> CogniaResult<Vec<InstallReceipt>> {
        let plan = self.plan_install(packages).await?;
        self.execute_install(&plan, |_| {}).await
    }

    pub async fn uninstall(&self, packages: &[String]) -> CogniaResult<()> {
        let registry = self.registry.read().await;

        for name in packages {
            let spec = PackageSpec::parse(name);
            let provider = if let Some(ref provider_id) = spec.provider {
                registry.get(provider_id).ok_or_else(|| {
                    CogniaError::ProviderNotFound(format!("Provider not found: {}", provider_id))
                })?
            } else {
                registry.find_for_package(&spec.name).await?.ok_or_else(|| {
                    CogniaError::ProviderNotFound(format!("No provider for {}", spec.name))
                })?
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

            match provider
                .uninstall(crate::provider::UninstallRequest {
                    name: spec.name.clone(),
                    version: None,
                    force: false,
                })
                .await
            {
                Ok(()) => {
                    let _ = HistoryManager::record_uninstall(
                        &spec.name,
                        &installed_version,
                        provider.id(),
                        true,
                        None,
                    )
                    .await;
                }
                Err(err) => {
                    let _ = HistoryManager::record_uninstall(
                        &spec.name,
                        &installed_version,
                        provider.id(),
                        false,
                        Some(err.to_string()),
                    )
                    .await;
                    return Err(err);
                }
            }
        }

        Ok(())
    }
}
