pub mod constraint;
pub mod pubgrub;
pub mod version;

use crate::error::CogniaResult;
use crate::provider::ProviderRegistry;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::RwLockReadGuard;

pub use constraint::*;
pub use pubgrub::*;
pub use version::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ConflictResolutionStrategy {
    LatestCompatible,
    MinimalUpgrade,
    Manual,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConflictResolutionInput {
    pub package_name: String,
    pub provider_id: Option<String>,
    pub versions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConflictResolutionRecommendation {
    pub package_name: String,
    pub provider_id: Option<String>,
    pub selected_version: String,
    pub available_versions: Vec<String>,
    pub strategy: ConflictResolutionStrategy,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConflictResolutionResult {
    pub success: bool,
    pub strategy: ConflictResolutionStrategy,
    pub recommendations: Vec<ConflictResolutionRecommendation>,
    pub unresolved: Vec<String>,
    pub message: Option<String>,
}

pub async fn resolve_dependency_conflict(
    registry: &RwLockReadGuard<'_, ProviderRegistry>,
    conflicts: &[ConflictResolutionInput],
    strategy: ConflictResolutionStrategy,
    manual_versions: Option<&HashMap<String, String>>,
) -> CogniaResult<ConflictResolutionResult> {
    let mut recommendations = Vec::new();
    let mut unresolved = Vec::new();

    for conflict in conflicts {
        let provider = if let Some(provider_id) = conflict.provider_id.as_deref() {
            registry.get(provider_id)
        } else {
            registry.find_for_package(&conflict.package_name).await?
        };

        let Some(provider) = provider else {
            unresolved.push(conflict.package_name.clone());
            continue;
        };

        let mut available_versions = provider
            .get_versions(&conflict.package_name)
            .await?
            .into_iter()
            .map(|version| version.version)
            .collect::<Vec<_>>();
        available_versions.sort_by(|a, b| {
            let parsed_a = a.parse::<Version>().ok();
            let parsed_b = b.parse::<Version>().ok();
            parsed_b.cmp(&parsed_a).then_with(|| b.cmp(a))
        });

        let compatible = select_compatible_versions(&available_versions, &conflict.versions);
        let selected_version = match strategy {
            ConflictResolutionStrategy::LatestCompatible => compatible
                .first()
                .cloned()
                .or_else(|| available_versions.first().cloned()),
            ConflictResolutionStrategy::MinimalUpgrade => compatible
                .last()
                .cloned()
                .or_else(|| available_versions.last().cloned()),
            ConflictResolutionStrategy::Manual => manual_versions
                .and_then(|versions| versions.get(&conflict.package_name).cloned())
                .filter(|version| available_versions.contains(version)),
        };

        if let Some(selected_version) = selected_version {
            recommendations.push(ConflictResolutionRecommendation {
                package_name: conflict.package_name.clone(),
                provider_id: Some(provider.id().to_string()),
                selected_version,
                available_versions,
                strategy: strategy.clone(),
                reason: match strategy {
                    ConflictResolutionStrategy::LatestCompatible => {
                        "Selected the newest compatible version.".to_string()
                    }
                    ConflictResolutionStrategy::MinimalUpgrade => {
                        "Selected the lowest version that minimizes change.".to_string()
                    }
                    ConflictResolutionStrategy::Manual => {
                        "Accepted the manually selected version.".to_string()
                    }
                },
            });
        } else {
            unresolved.push(conflict.package_name.clone());
        }
    }

    Ok(ConflictResolutionResult {
        success: unresolved.is_empty(),
        strategy,
        recommendations,
        unresolved: unresolved.clone(),
        message: if unresolved.is_empty() {
            None
        } else {
            Some(format!(
                "Could not resolve conflicts for: {}",
                unresolved.join(", ")
            ))
        },
    })
}

fn select_compatible_versions(
    available_versions: &[String],
    constraints: &[String],
) -> Vec<String> {
    if constraints.is_empty() {
        return available_versions.to_vec();
    }

    let parsed_constraints = constraints
        .iter()
        .filter_map(|constraint| constraint.parse::<VersionConstraint>().ok())
        .collect::<Vec<_>>();

    if parsed_constraints.is_empty() {
        return available_versions.to_vec();
    }

    available_versions
        .iter()
        .filter(|version| {
            version.parse::<Version>().ok().is_some_and(|parsed| {
                parsed_constraints
                    .iter()
                    .all(|constraint| constraint.matches(&parsed))
            })
        })
        .cloned()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::provider::{
        Capability, InstallReceipt, InstallRequest, InstalledFilter, InstalledPackage, PackageInfo,
        PackageSummary, Provider, ProviderRegistry, SearchOptions, UninstallRequest, UpdateInfo,
        VersionInfo,
    };
    use async_trait::async_trait;
    use std::collections::{HashMap, HashSet};
    use std::path::PathBuf;
    use std::sync::Arc;
    use tokio::sync::RwLock;

    #[derive(Clone)]
    struct MockProvider {
        versions: Vec<VersionInfo>,
    }

    #[async_trait]
    impl Provider for MockProvider {
        fn id(&self) -> &str {
            "mock"
        }
        fn display_name(&self) -> &str {
            "mock"
        }
        fn capabilities(&self) -> HashSet<Capability> {
            HashSet::from([Capability::Search, Capability::Install, Capability::List])
        }
        fn supported_platforms(&self) -> Vec<crate::platform::env::Platform> {
            vec![crate::platform::env::current_platform()]
        }
        async fn is_available(&self) -> bool {
            true
        }
        async fn search(
            &self,
            query: &str,
            _options: SearchOptions,
        ) -> crate::error::CogniaResult<Vec<PackageSummary>> {
            Ok(vec![PackageSummary {
                name: query.to_string(),
                description: None,
                latest_version: self.versions.first().map(|item| item.version.clone()),
                provider: "mock".to_string(),
            }])
        }
        async fn get_package_info(&self, name: &str) -> crate::error::CogniaResult<PackageInfo> {
            Ok(PackageInfo {
                name: name.to_string(),
                display_name: Some(name.to_string()),
                description: None,
                homepage: None,
                license: None,
                repository: None,
                versions: self.versions.clone(),
                provider: "mock".to_string(),
            })
        }
        async fn get_versions(&self, _name: &str) -> crate::error::CogniaResult<Vec<VersionInfo>> {
            Ok(self.versions.clone())
        }
        async fn install(
            &self,
            request: InstallRequest,
        ) -> crate::error::CogniaResult<InstallReceipt> {
            Ok(InstallReceipt {
                name: request.name,
                version: request.version.unwrap_or_else(|| "1.0.0".to_string()),
                provider: "mock".to_string(),
                install_path: PathBuf::from("."),
                files: Vec::new(),
                installed_at: chrono::Utc::now().to_rfc3339(),
            })
        }
        async fn uninstall(&self, _request: UninstallRequest) -> crate::error::CogniaResult<()> {
            Ok(())
        }
        async fn list_installed(
            &self,
            _filter: InstalledFilter,
        ) -> crate::error::CogniaResult<Vec<InstalledPackage>> {
            Ok(Vec::new())
        }
        async fn check_updates(
            &self,
            _packages: &[String],
        ) -> crate::error::CogniaResult<Vec<UpdateInfo>> {
            Ok(Vec::new())
        }
    }

    #[test]
    fn select_compatible_versions_filters_by_all_constraints() {
        let versions = vec![
            "2.0.0".to_string(),
            "1.28.0".to_string(),
            "1.26.18".to_string(),
        ];

        let compatible = select_compatible_versions(&versions, &["^1.26.0".to_string()]);

        expect_eq_compatible(
            compatible,
            vec!["1.28.0".to_string(), "1.26.18".to_string()],
        );
    }

    #[tokio::test]
    async fn resolve_dependency_conflict_returns_recommendations() {
        let mut registry = ProviderRegistry::new();
        registry.register_provider(Arc::new(MockProvider {
            versions: vec![
                VersionInfo {
                    version: "2.0.7".to_string(),
                    release_date: None,
                    deprecated: false,
                    yanked: false,
                },
                VersionInfo {
                    version: "1.26.18".to_string(),
                    release_date: None,
                    deprecated: false,
                    yanked: false,
                },
            ],
        }));
        let registry = Arc::new(RwLock::new(registry));
        let guard = registry.read().await;

        let result = resolve_dependency_conflict(
            &guard,
            &[ConflictResolutionInput {
                package_name: "urllib3".to_string(),
                provider_id: Some("mock".to_string()),
                versions: vec!["^1.26.0".to_string()],
            }],
            ConflictResolutionStrategy::LatestCompatible,
            None,
        )
        .await
        .expect("resolution should succeed");

        assert!(result.success);
        assert_eq!(result.recommendations[0].selected_version, "1.26.18");

        let manual = resolve_dependency_conflict(
            &guard,
            &[ConflictResolutionInput {
                package_name: "urllib3".to_string(),
                provider_id: Some("mock".to_string()),
                versions: vec!["^1.26.0".to_string()],
            }],
            ConflictResolutionStrategy::Manual,
            Some(&HashMap::from([(
                "urllib3".to_string(),
                "2.0.7".to_string(),
            )])),
        )
        .await
        .expect("manual resolution should succeed");

        assert!(manual.success);
        assert_eq!(manual.recommendations[0].selected_version, "2.0.7");
    }

    fn expect_eq_compatible(actual: Vec<String>, expected: Vec<String>) {
        assert_eq!(actual, expected);
    }
}
