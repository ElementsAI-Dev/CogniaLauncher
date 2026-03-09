use crate::cache::MetadataCache;
use crate::config::Settings;
use crate::provider::{InstalledPackage, PackageSummary, ProviderRegistry, SearchOptions};
use crate::resolver::Version;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

pub type SharedRegistry = Arc<RwLock<ProviderRegistry>>;
pub type SharedSettings = Arc<RwLock<Settings>>;

/// TTL for installed package cache used by search (matches package.rs)
const INSTALLED_CACHE_TTL: i64 = 60;

fn installed_lookup_key(provider: &str, name: &str) -> String {
    format!(
        "{}:{}",
        provider.to_ascii_lowercase(),
        name.to_ascii_lowercase()
    )
}

fn compare_versions(left: &str, right: &str) -> Option<Ordering> {
    match (left.parse::<Version>(), right.parse::<Version>()) {
        (Ok(left_version), Ok(right_version)) => Some(left_version.cmp(&right_version)),
        _ => Some(left.to_ascii_lowercase().cmp(&right.to_ascii_lowercase())),
    }
}

fn matches_metadata_filters(
    filters: Option<&SearchFilters>,
    license: Option<&str>,
    latest_version: Option<&str>,
) -> bool {
    let Some(filters) = filters else {
        return true;
    };

    if let Some(licenses) = filters.license.as_ref() {
        if !licenses.is_empty() {
            let Some(actual_license) = license else {
                return false;
            };
            let normalized_license = actual_license.trim().to_ascii_lowercase();
            if !licenses
                .iter()
                .any(|candidate| candidate.trim().eq_ignore_ascii_case(&normalized_license))
            {
                return false;
            }
        }
    }

    if let Some(min_version) = filters.min_version.as_deref() {
        let Some(actual_version) = latest_version else {
            return false;
        };
        if matches!(
            compare_versions(actual_version, min_version),
            Some(Ordering::Less)
        ) {
            return false;
        }
    }

    if let Some(max_version) = filters.max_version.as_deref() {
        let Some(actual_version) = latest_version else {
            return false;
        };
        if matches!(
            compare_versions(actual_version, max_version),
            Some(Ordering::Greater)
        ) {
            return false;
        }
    }

    true
}

/// Build installed package set, preferring cached data from `package_list`.
async fn get_installed_set(
    registry: &ProviderRegistry,
    settings: &SharedSettings,
) -> HashMap<String, String> {
    // Try reading from MetadataCache first (written by package_list)
    let cache_dir = settings.read().await.get_cache_dir();
    if let Ok(mut cache) = MetadataCache::open_with_ttl(&cache_dir, INSTALLED_CACHE_TTL).await {
        if let Ok(Some(cached)) = cache
            .get::<Vec<InstalledPackage>>("pkg:installed:all")
            .await
        {
            if !cached.is_stale {
                return cached
                    .data
                    .into_iter()
                    .map(|p| (installed_lookup_key(&p.provider, &p.name), p.version))
                    .collect();
            }
        }
    }

    // Fallback: live scan
    let mut installed_set = HashMap::new();
    for provider_id in registry.list() {
        if let Some(p) = registry.get(provider_id) {
            if p.is_available().await {
                if let Ok(installed) = p
                    .list_installed(crate::provider::InstalledFilter::default())
                    .await
                {
                    for pkg in installed {
                        installed_set
                            .insert(installed_lookup_key(&pkg.provider, &pkg.name), pkg.version);
                    }
                }
            }
        }
    }
    installed_set
}

/// Advanced search options
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AdvancedSearchOptions {
    pub query: String,
    pub providers: Option<Vec<String>>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
    pub filters: Option<SearchFilters>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SearchFilters {
    pub has_updates: Option<bool>,
    pub installed_only: Option<bool>,
    pub not_installed: Option<bool>,
    pub license: Option<Vec<String>>,
    pub min_version: Option<String>,
    pub max_version: Option<String>,
}

/// Enhanced search result with relevance scoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancedSearchResult {
    pub packages: Vec<ScoredPackage>,
    pub total: usize,
    pub page: usize,
    pub page_size: usize,
    pub facets: SearchFacets,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoredPackage {
    #[serde(flatten)]
    pub package: PackageSummary,
    pub score: f64,
    pub match_type: String,
    pub is_installed: bool,
    pub has_update: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SearchFacets {
    pub providers: HashMap<String, usize>,
    pub licenses: HashMap<String, usize>,
}

fn has_newer_version(current: &str, latest: &str) -> bool {
    match (current.parse::<Version>(), latest.parse::<Version>()) {
        (Ok(current_ver), Ok(latest_ver)) => latest_ver > current_ver,
        _ => !latest.trim().eq_ignore_ascii_case(current.trim()),
    }
}

fn matches_filters(filters: Option<&SearchFilters>, is_installed: bool, has_update: bool) -> bool {
    if let Some(filters) = filters {
        if filters.installed_only.unwrap_or(false) && !is_installed {
            return false;
        }
        if filters.not_installed.unwrap_or(false) && is_installed {
            return false;
        }
        if filters.has_updates.unwrap_or(false) && !has_update {
            return false;
        }
    }
    true
}

fn sort_scored_packages(
    all_results: &mut [ScoredPackage],
    sort_by: Option<&str>,
    sort_order: Option<&str>,
) {
    let alpha_sort = matches!(sort_by, Some("name") | Some("provider"));
    all_results.sort_by(|a, b| {
        let ordering = match sort_by {
            Some("name") => a.package.name.cmp(&b.package.name),
            Some("provider") => a.package.provider.cmp(&b.package.provider),
            _ => b
                .score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal),
        };

        match sort_order {
            Some("desc") if alpha_sort => ordering.reverse(),
            Some("asc") if !alpha_sort => ordering.reverse(),
            _ => ordering,
        }
    });
}

/// Advanced package search with filtering and scoring
#[tauri::command]
pub async fn advanced_search(
    options: AdvancedSearchOptions,
    registry: State<'_, SharedRegistry>,
    settings: State<'_, SharedSettings>,
) -> Result<EnhancedSearchResult, String> {
    let reg = registry.read().await;
    let mut all_results = Vec::new();
    let mut facets = SearchFacets::default();

    let query_lower = options.query.to_lowercase();
    let query_terms: Vec<&str> = query_lower.split_whitespace().collect();

    // Determine which providers to search
    let providers_to_search: Vec<&str> = if let Some(ref providers) = options.providers {
        providers.iter().map(|s| s.as_str()).collect()
    } else {
        reg.list()
    };

    // Get installed packages for comparison (prefer cached data)
    let installed_set = get_installed_set(&reg, settings.inner()).await;

    // Search each provider
    for provider_id in providers_to_search {
        if let Some(p) = reg.get(provider_id) {
            if !p.is_available().await {
                continue;
            }

            let search_opts = SearchOptions {
                limit: Some(options.limit.unwrap_or(20)),
                page: options.offset.map(|o| o / options.limit.unwrap_or(20)),
            };

            if let Ok(results) = p.search(&options.query, search_opts).await {
                for pkg in results {
                    let name_lower = pkg.name.to_lowercase();
                    let installed_key = installed_lookup_key(provider_id, &pkg.name);

                    // Calculate relevance score
                    let score = calculate_score(&pkg, &query_terms);

                    // Check if installed
                    let is_installed = installed_set.contains_key(&installed_key);
                    let has_update = match (
                        installed_set.get(&installed_key),
                        pkg.latest_version.as_ref(),
                    ) {
                        (Some(current), Some(latest)) => has_newer_version(current, latest),
                        _ => false,
                    };

                    let package_info = p.get_package_info(&pkg.name).await.ok();
                    let package_license = package_info
                        .as_ref()
                        .and_then(|info| info.license.as_ref())
                        .map(|license| license.trim())
                        .filter(|license| !license.is_empty());

                    // Apply filters
                    if !matches_filters(options.filters.as_ref(), is_installed, has_update) {
                        continue;
                    }
                    if !matches_metadata_filters(
                        options.filters.as_ref(),
                        package_license,
                        pkg.latest_version.as_deref(),
                    ) {
                        continue;
                    }

                    // Determine match type
                    let match_type = if name_lower == query_lower {
                        "exact"
                    } else if name_lower.starts_with(&query_lower) {
                        "prefix"
                    } else if name_lower.contains(&query_lower) {
                        "contains"
                    } else {
                        "fuzzy"
                    };

                    *facets.providers.entry(pkg.provider.clone()).or_insert(0) += 1;
                    if let Some(license) = package_license {
                        *facets.licenses.entry(license.to_string()).or_insert(0) += 1;
                    }

                    all_results.push(ScoredPackage {
                        package: pkg,
                        score,
                        match_type: match_type.into(),
                        is_installed,
                        has_update,
                    });
                }
            }
        }
    }

    // Sort by score (or custom sort)
    sort_scored_packages(
        &mut all_results,
        options.sort_by.as_deref(),
        options.sort_order.as_deref(),
    );

    let total = all_results.len();
    let page_size = options.limit.unwrap_or(20);
    let offset = options.offset.unwrap_or(0);

    // Paginate
    let packages: Vec<_> = all_results
        .into_iter()
        .skip(offset)
        .take(page_size)
        .collect();

    Ok(EnhancedSearchResult {
        packages,
        total,
        page: offset / page_size,
        page_size,
        facets,
    })
}

/// Search suggestions for autocomplete
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchSuggestion {
    pub text: String,
    pub suggestion_type: String,
    pub provider: Option<String>,
}

#[tauri::command]
pub async fn search_suggestions(
    query: String,
    limit: Option<usize>,
    registry: State<'_, SharedRegistry>,
) -> Result<Vec<SearchSuggestion>, String> {
    if query.len() < 2 {
        return Ok(vec![]);
    }

    let reg = registry.read().await;
    let mut suggestions = Vec::new();
    let limit = limit.unwrap_or(10);
    let query_lower = query.to_lowercase();

    // Search for matching package names
    for provider_id in reg.list() {
        if let Some(p) = reg.get(provider_id) {
            if !p.is_available().await {
                continue;
            }

            if let Ok(results) = p
                .search(
                    &query,
                    SearchOptions {
                        limit: Some(5),
                        page: None,
                    },
                )
                .await
            {
                for pkg in results {
                    if pkg.name.to_lowercase().contains(&query_lower) {
                        suggestions.push(SearchSuggestion {
                            text: pkg.name,
                            suggestion_type: "package".into(),
                            provider: Some(provider_id.to_string()),
                        });
                    }
                }
            }

            if suggestions.len() >= limit {
                break;
            }
        }
    }

    // Add provider suggestions
    for provider_id in reg.list() {
        if provider_id.to_lowercase().starts_with(&query_lower) {
            suggestions.push(SearchSuggestion {
                text: format!("{}:", provider_id),
                suggestion_type: "provider".into(),
                provider: Some(provider_id.to_string()),
            });
        }
    }

    // Limit results
    suggestions.truncate(limit);
    Ok(suggestions)
}

/// Get search history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHistoryEntry {
    pub query: String,
    pub timestamp: i64,
    pub result_count: usize,
}

// Note: Search history should be stored/managed client-side for privacy

/// Calculate relevance score for a package
fn calculate_score(pkg: &PackageSummary, query_terms: &[&str]) -> f64 {
    let mut score = 0.0;
    let name_lower = pkg.name.to_lowercase();
    let desc_lower = pkg.description.as_deref().unwrap_or("").to_lowercase();

    for term in query_terms {
        // Exact name match (highest)
        if name_lower == *term {
            score += 100.0;
        }
        // Name starts with term
        else if name_lower.starts_with(term) {
            score += 50.0;
        }
        // Name contains term
        else if name_lower.contains(term) {
            score += 25.0;
        }
        // Description contains term
        if desc_lower.contains(term) {
            score += 10.0;
        }
    }

    // Boost for shorter names (more likely to be the main package)
    score += 10.0 / (name_lower.len() as f64).max(1.0);

    // Boost for having a description
    if pkg.description.is_some() {
        score += 5.0;
    }

    // Boost for having a version
    if pkg.latest_version.is_some() {
        score += 3.0;
    }

    score
}

/// Compare two packages
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageComparison {
    pub packages: Vec<PackageCompareItem>,
    pub features: Vec<FeatureComparison>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageCompareItem {
    pub name: String,
    pub provider: String,
    pub latest_version: Option<String>,
    pub description: Option<String>,
    pub homepage: Option<String>,
    pub license: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureComparison {
    pub feature: String,
    pub values: Vec<Option<String>>,
}

#[tauri::command]
pub async fn compare_packages(
    packages: Vec<(String, Option<String>)>, // (name, provider)
    registry: State<'_, SharedRegistry>,
) -> Result<PackageComparison, String> {
    let reg = registry.read().await;
    let mut items = Vec::new();

    for (name, provider) in &packages {
        let p = if let Some(ref provider_id) = provider {
            reg.get(provider_id)
        } else {
            reg.find_for_package(name).await.ok().flatten()
        };

        if let Some(provider) = p {
            if let Ok(info) = provider.get_package_info(name).await {
                items.push(PackageCompareItem {
                    name: info.name,
                    provider: info.provider,
                    latest_version: info.versions.first().map(|v| v.version.clone()),
                    description: info.description,
                    homepage: info.homepage,
                    license: info.license,
                });
            }
        }
    }

    // Build feature comparison
    let features = vec![
        FeatureComparison {
            feature: "Latest Version".into(),
            values: items.iter().map(|i| i.latest_version.clone()).collect(),
        },
        FeatureComparison {
            feature: "License".into(),
            values: items.iter().map(|i| i.license.clone()).collect(),
        },
        FeatureComparison {
            feature: "Homepage".into(),
            values: items.iter().map(|i| i.homepage.clone()).collect(),
        },
    ];

    Ok(PackageComparison {
        packages: items,
        features,
    })
}

#[cfg(test)]
mod tests {
    use super::{
        has_newer_version, installed_lookup_key, matches_filters, sort_scored_packages,
        ScoredPackage, SearchFilters,
    };
    use crate::provider::PackageSummary;

    fn sample_result(name: &str, provider: &str, score: f64) -> ScoredPackage {
        ScoredPackage {
            package: PackageSummary {
                name: name.to_string(),
                description: None,
                latest_version: Some("1.0.0".to_string()),
                provider: provider.to_string(),
            },
            score,
            match_type: "fuzzy".to_string(),
            is_installed: false,
            has_update: false,
        }
    }

    #[test]
    fn has_newer_version_handles_semver() {
        assert!(has_newer_version("1.0.0", "1.0.1"));
        assert!(has_newer_version("1.2.3", "2.0.0"));
        assert!(!has_newer_version("2.0.0", "1.9.9"));
    }

    #[test]
    fn has_newer_version_handles_non_semver_fallback() {
        assert!(has_newer_version("stable", "nightly"));
        assert!(!has_newer_version("stable", "stable"));
    }

    #[test]
    fn matches_filters_honors_installation_and_update_flags() {
        let installed_only = SearchFilters {
            installed_only: Some(true),
            ..Default::default()
        };
        assert!(matches_filters(Some(&installed_only), true, false));
        assert!(!matches_filters(Some(&installed_only), false, false));

        let not_installed = SearchFilters {
            not_installed: Some(true),
            ..Default::default()
        };
        assert!(matches_filters(Some(&not_installed), false, false));
        assert!(!matches_filters(Some(&not_installed), true, false));

        let has_updates = SearchFilters {
            has_updates: Some(true),
            ..Default::default()
        };
        assert!(matches_filters(Some(&has_updates), true, true));
        assert!(!matches_filters(Some(&has_updates), true, false));
    }

    #[test]
    fn sort_scored_packages_honors_non_default_sort_and_order() {
        let mut by_name = vec![
            sample_result("zeta", "pip", 0.1),
            sample_result("alpha", "npm", 0.9),
        ];
        sort_scored_packages(&mut by_name, Some("name"), Some("asc"));
        assert_eq!(by_name[0].package.name, "alpha");
        sort_scored_packages(&mut by_name, Some("name"), Some("desc"));
        assert_eq!(by_name[0].package.name, "zeta");

        let mut by_score = vec![
            sample_result("pkg-low", "npm", 0.2),
            sample_result("pkg-high", "npm", 0.8),
        ];
        sort_scored_packages(&mut by_score, None, Some("asc"));
        assert_eq!(by_score[0].package.name, "pkg-low");
        sort_scored_packages(&mut by_score, None, Some("desc"));
        assert_eq!(by_score[0].package.name, "pkg-high");
    }

    #[test]
    fn installed_lookup_key_is_provider_aware() {
        assert_eq!(installed_lookup_key("npm", "TypeScript"), "npm:typescript");
        assert_eq!(installed_lookup_key("pip", "TypeScript"), "pip:typescript");
        assert_ne!(
            installed_lookup_key("npm", "TypeScript"),
            installed_lookup_key("pip", "TypeScript")
        );
    }
}
