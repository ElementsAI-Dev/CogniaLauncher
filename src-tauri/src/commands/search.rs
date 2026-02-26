use crate::provider::{PackageSummary, ProviderRegistry, SearchOptions};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

pub type SharedRegistry = Arc<RwLock<ProviderRegistry>>;

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

/// Advanced package search with filtering and scoring
#[tauri::command]
pub async fn advanced_search(
    options: AdvancedSearchOptions,
    registry: State<'_, SharedRegistry>,
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

    // Get installed packages for comparison
    let mut installed_set: HashMap<String, String> = HashMap::new();
    for provider_id in reg.list() {
        if let Some(p) = reg.get(provider_id) {
            if p.is_available().await {
                if let Ok(installed) = p
                    .list_installed(crate::provider::InstalledFilter::default())
                    .await
                {
                    for pkg in installed {
                        installed_set.insert(pkg.name.to_lowercase(), pkg.version);
                    }
                }
            }
        }
    }

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

                    // Calculate relevance score
                    let score = calculate_score(&pkg, &query_terms);

                    // Check if installed
                    let is_installed = installed_set.contains_key(&name_lower);

                    // Apply filters
                    if let Some(ref filters) = options.filters {
                        if filters.installed_only.unwrap_or(false) && !is_installed {
                            continue;
                        }
                        if filters.not_installed.unwrap_or(false) && is_installed {
                            continue;
                        }
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

                    all_results.push(ScoredPackage {
                        package: pkg,
                        score,
                        match_type: match_type.into(),
                        is_installed,
                        has_update: false, // TODO: Check for updates
                    });
                }
            }
        }
    }

    // Sort by score (or custom sort)
    all_results.sort_by(|a, b| match options.sort_by.as_deref() {
        Some("name") => a.package.name.cmp(&b.package.name),
        Some("provider") => a.package.provider.cmp(&b.package.provider),
        _ => b
            .score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal),
    });

    // Reverse if descending
    if options.sort_order.as_deref() == Some("asc") && options.sort_by.is_some() {
        all_results.reverse();
    }

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
