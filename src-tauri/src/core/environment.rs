use crate::error::{CogniaError, CogniaResult};
use crate::platform::env::EnvModifications;
use crate::provider::{InstalledVersion, ProviderRegistry};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentInfo {
    pub env_type: String,
    pub provider_id: String,
    pub provider: String,
    pub current_version: Option<String>,
    pub installed_versions: Vec<InstalledVersion>,
    pub available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedEnvironment {
    pub env_type: String,
    pub version: String,
    pub source: String,
    pub source_path: Option<PathBuf>,
}

pub struct EnvironmentManager {
    registry: Arc<RwLock<ProviderRegistry>>,
}

impl EnvironmentManager {
    pub fn new(registry: Arc<RwLock<ProviderRegistry>>) -> Self {
        Self { registry }
    }

    pub async fn list_environments(&self) -> CogniaResult<Vec<EnvironmentInfo>> {
        let registry = self.registry.read().await;
        let mut envs = Vec::new();

        for provider_id in registry.list_environment_providers() {
            if let Some(provider) = registry.get_environment_provider(provider_id) {
                let available = provider.is_available().await;

                let (current, installed) = if available {
                    let current = provider.get_current_version().await.ok().flatten();
                    let installed = provider.list_installed_versions().await.unwrap_or_default();
                    (current, installed)
                } else {
                    (None, vec![])
                };

                envs.push(EnvironmentInfo {
                    env_type: provider_id.to_string(),
                    provider_id: provider_id.to_string(),
                    provider: provider.display_name().to_string(),
                    current_version: current,
                    installed_versions: installed,
                    available,
                });
            }
        }

        Ok(envs)
    }

    pub async fn get_environment(&self, env_type: &str) -> CogniaResult<EnvironmentInfo> {
        let registry = self.registry.read().await;
        let provider = registry
            .get_environment_provider(env_type)
            .ok_or_else(|| CogniaError::ProviderNotFound(env_type.into()))?;

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
            env_type: env_type.to_string(),
            provider_id: env_type.to_string(),
            provider: provider.display_name().to_string(),
            current_version: current,
            installed_versions: installed,
            available,
        })
    }

    pub async fn install_version(
        &self,
        env_type: &str,
        version: &str,
        provider_id: Option<&str>,
    ) -> CogniaResult<()> {
        let registry = self.registry.read().await;
        let provider_key = provider_id.unwrap_or(env_type);
        let provider = registry
            .get_environment_provider(provider_key)
            .ok_or_else(|| CogniaError::ProviderNotFound(provider_key.into()))?;

        provider
            .install(crate::provider::InstallRequest {
                name: env_type.to_string(),
                version: Some(version.to_string()),
                global: true,
                force: false,
            })
            .await?;

        Ok(())
    }

    pub async fn uninstall_version(&self, env_type: &str, version: &str) -> CogniaResult<()> {
        let registry = self.registry.read().await;
        let provider = registry
            .get_environment_provider(env_type)
            .ok_or_else(|| CogniaError::ProviderNotFound(env_type.into()))?;

        provider
            .uninstall(crate::provider::UninstallRequest {
                name: env_type.to_string(),
                version: Some(version.to_string()),
                force: false,
            })
            .await?;

        Ok(())
    }

    pub async fn set_global_version(&self, env_type: &str, version: &str) -> CogniaResult<()> {
        let registry = self.registry.read().await;
        let provider = registry
            .get_environment_provider(env_type)
            .ok_or_else(|| CogniaError::ProviderNotFound(env_type.into()))?;

        provider.set_global_version(version).await
    }

    pub async fn set_local_version(
        &self,
        env_type: &str,
        project_path: &Path,
        version: &str,
    ) -> CogniaResult<()> {
        let registry = self.registry.read().await;
        let provider = registry
            .get_environment_provider(env_type)
            .ok_or_else(|| CogniaError::ProviderNotFound(env_type.into()))?;

        provider.set_local_version(project_path, version).await
    }

    pub async fn detect_version(
        &self,
        env_type: &str,
        start_path: &Path,
    ) -> CogniaResult<Option<DetectedEnvironment>> {
        let registry = self.registry.read().await;
        let provider = registry
            .get_environment_provider(env_type)
            .ok_or_else(|| CogniaError::ProviderNotFound(env_type.into()))?;

        let detection = provider.detect_version(start_path).await?;

        Ok(detection.map(|d| DetectedEnvironment {
            env_type: env_type.to_string(),
            version: d.version,
            source: format!("{:?}", d.source),
            source_path: d.source_path,
        }))
    }

    pub async fn detect_all_versions(
        &self,
        start_path: &Path,
    ) -> CogniaResult<Vec<DetectedEnvironment>> {
        let registry = self.registry.read().await;
        let mut detected = Vec::new();

        for provider_id in registry.list_environment_providers() {
            if let Some(provider) = registry.get_environment_provider(provider_id) {
                if provider.is_available().await {
                    if let Ok(Some(d)) = provider.detect_version(start_path).await {
                        detected.push(DetectedEnvironment {
                            env_type: provider_id.to_string(),
                            version: d.version,
                            source: format!("{:?}", d.source),
                            source_path: d.source_path,
                        });
                    }
                }
            }
        }

        Ok(detected)
    }

    pub async fn get_env_modifications(
        &self,
        env_type: &str,
        version: &str,
    ) -> CogniaResult<EnvModifications> {
        let registry = self.registry.read().await;
        let provider = registry
            .get_environment_provider(env_type)
            .ok_or_else(|| CogniaError::ProviderNotFound(env_type.into()))?;

        provider.get_env_modifications(version)
    }

    pub async fn get_available_versions(
        &self,
        env_type: &str,
    ) -> CogniaResult<Vec<crate::provider::VersionInfo>> {
        let registry = self.registry.read().await;
        let provider = registry
            .get_environment_provider(env_type)
            .ok_or_else(|| CogniaError::ProviderNotFound(env_type.into()))?;

        provider.get_versions(env_type).await
    }
}
