use crate::config::Settings;
use crate::error::{CogniaError, CogniaResult};
use crate::provider::{InstallReceipt, InstallRequest, ProviderRegistry};
use crate::resolver::Dependency;
use serde::{Deserialize, Serialize};
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
        let deps: Vec<Dependency> = packages
            .iter()
            .map(|p| {
                let (name, version) = if p.contains('@') {
                    let parts: Vec<&str> = p.splitn(2, '@').collect();
                    (parts[0].to_string(), Some(parts[1].to_string()))
                } else {
                    (p.clone(), None)
                };
                Dependency {
                    name,
                    constraint: version
                        .map(|v| v.parse().unwrap_or(crate::resolver::VersionConstraint::Any))
                        .unwrap_or(crate::resolver::VersionConstraint::Any),
                }
            })
            .collect();

        let planned: Vec<PlannedInstall> = deps
            .iter()
            .map(|d| PlannedInstall {
                name: d.name.clone(),
                version: d.constraint.to_string(),
                provider: String::new(),
                download_size: None,
                is_upgrade: false,
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

            let receipt = provider.install(request).await?;
            receipts.push(receipt);
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
            let provider = registry.find_for_package(name).await?.ok_or_else(|| {
                CogniaError::ProviderNotFound(format!("No provider for {}", name))
            })?;

            provider
                .uninstall(crate::provider::UninstallRequest {
                    name: name.clone(),
                    version: None,
                    force: false,
                })
                .await?;
        }

        Ok(())
    }
}
