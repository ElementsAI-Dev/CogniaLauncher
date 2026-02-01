use crate::error::{CogniaError, CogniaResult};
use reqwest::Client;
use serde::Deserialize;
use std::time::Duration;

/// HTTP API client for package registries
pub struct PackageApiClient {
    client: Client,
}

impl PackageApiClient {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("CogniaLauncher/0.1.0")
            .build()
            .unwrap_or_default();

        Self { client }
    }

    /// Search PyPI packages using JSON API
    pub async fn search_pypi(&self, query: &str, _limit: usize) -> CogniaResult<Vec<PyPIPackage>> {
        // PyPI doesn't have a search API, but we can query packages directly
        // For search functionality, we'll use the XML-RPC API or simple index
        // Here we implement a direct package lookup that works well for exact matches

        let url = format!("https://pypi.org/pypi/{}/json", query);

        match self.client.get(&url).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    let data: PyPIResponse = response.json().await.map_err(|e| {
                        CogniaError::Provider(format!("Failed to parse PyPI response: {}", e))
                    })?;

                    Ok(vec![PyPIPackage {
                        name: data.info.name,
                        version: data.info.version,
                        summary: data.info.summary,
                        homepage: data.info.home_page,
                        license: data.info.license,
                        author: data.info.author,
                        releases: data.releases.keys().cloned().collect(),
                    }])
                } else {
                    // Package not found, return empty
                    Ok(vec![])
                }
            }
            Err(e) => {
                // Network error or timeout
                Err(CogniaError::Provider(format!(
                    "PyPI API request failed: {}",
                    e
                )))
            }
        }
    }

    /// Get detailed package info from PyPI
    pub async fn get_pypi_package(&self, name: &str) -> CogniaResult<PyPIPackage> {
        let url = format!("https://pypi.org/pypi/{}/json", name);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| CogniaError::Provider(format!("PyPI API request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(CogniaError::PackageNotFound(name.to_string()));
        }

        let data: PyPIResponse = response
            .json()
            .await
            .map_err(|e| CogniaError::Provider(format!("Failed to parse PyPI response: {}", e)))?;

        Ok(PyPIPackage {
            name: data.info.name,
            version: data.info.version,
            summary: data.info.summary,
            homepage: data.info.home_page,
            license: data.info.license,
            author: data.info.author,
            releases: data.releases.keys().cloned().collect(),
        })
    }

    /// Search npm packages using registry API
    pub async fn search_npm(&self, query: &str, limit: usize) -> CogniaResult<Vec<NpmPackage>> {
        let url = format!(
            "https://registry.npmjs.org/-/v1/search?text={}&size={}",
            urlencoding::encode(query),
            limit
        );

        let response = self.client.get(&url).send().await.map_err(|e| {
            CogniaError::Provider(format!("npm registry API request failed: {}", e))
        })?;

        if !response.status().is_success() {
            return Err(CogniaError::Provider(format!(
                "npm registry returned status: {}",
                response.status()
            )));
        }

        let data: NpmSearchResponse = response
            .json()
            .await
            .map_err(|e| CogniaError::Provider(format!("Failed to parse npm response: {}", e)))?;

        Ok(data
            .objects
            .into_iter()
            .map(|obj| {
                let links = obj.package.links;
                NpmPackage {
                    name: obj.package.name,
                    version: obj.package.version,
                    description: obj.package.description,
                    homepage: links.as_ref().and_then(|l| l.homepage.clone()),
                    repository: links.and_then(|l| l.repository),
                    keywords: obj.package.keywords.unwrap_or_default(),
                    score: obj.score.map(|s| s.final_score).unwrap_or(0.0),
                }
            })
            .collect())
    }

    /// Get detailed npm package info
    pub async fn get_npm_package(&self, name: &str) -> CogniaResult<NpmPackageInfo> {
        let url = format!("https://registry.npmjs.org/{}", urlencoding::encode(name));

        let response = self.client.get(&url).send().await.map_err(|e| {
            CogniaError::Provider(format!("npm registry API request failed: {}", e))
        })?;

        if !response.status().is_success() {
            return Err(CogniaError::PackageNotFound(name.to_string()));
        }

        let data: NpmPackageFullInfo = response
            .json()
            .await
            .map_err(|e| CogniaError::Provider(format!("Failed to parse npm response: {}", e)))?;

        let versions: Vec<String> = data.versions.keys().cloned().collect();

        Ok(NpmPackageInfo {
            name: data.name,
            description: data.description,
            dist_tags: data.dist_tags,
            versions,
            homepage: data.homepage,
            repository: data.repository.map(|r| r.url),
            license: data.license,
        })
    }

    /// Search crates.io packages
    pub async fn search_crates(
        &self,
        query: &str,
        limit: usize,
    ) -> CogniaResult<Vec<CratesPackage>> {
        let url = format!(
            "https://crates.io/api/v1/crates?q={}&per_page={}",
            urlencoding::encode(query),
            limit
        );

        let response = self
            .client
            .get(&url)
            .header(
                "User-Agent",
                "CogniaLauncher/0.1.0 (https://github.com/AstroAir/CogniaLauncher)",
            )
            .send()
            .await
            .map_err(|e| CogniaError::Provider(format!("crates.io API request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(CogniaError::Provider(format!(
                "crates.io returned status: {}",
                response.status()
            )));
        }

        let data: CratesSearchResponse = response.json().await.map_err(|e| {
            CogniaError::Provider(format!("Failed to parse crates.io response: {}", e))
        })?;

        Ok(data
            .crates
            .into_iter()
            .map(|c| CratesPackage {
                name: c.name,
                max_version: c.max_version,
                description: c.description,
                downloads: c.downloads,
                documentation: c.documentation,
                repository: c.repository,
            })
            .collect())
    }

    /// Get detailed crate info
    pub async fn get_crate(&self, name: &str) -> CogniaResult<CrateInfo> {
        let url = format!(
            "https://crates.io/api/v1/crates/{}",
            urlencoding::encode(name)
        );

        let response = self
            .client
            .get(&url)
            .header(
                "User-Agent",
                "CogniaLauncher/0.1.0 (https://github.com/AstroAir/CogniaLauncher)",
            )
            .send()
            .await
            .map_err(|e| CogniaError::Provider(format!("crates.io API request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(CogniaError::PackageNotFound(name.to_string()));
        }

        let data: CrateDetailResponse = response.json().await.map_err(|e| {
            CogniaError::Provider(format!("Failed to parse crates.io response: {}", e))
        })?;

        let versions: Vec<String> = data.versions.iter().map(|v| v.num.clone()).collect();

        Ok(CrateInfo {
            name: data.krate.name,
            max_version: data.krate.max_version,
            description: data.krate.description,
            homepage: data.krate.homepage,
            documentation: data.krate.documentation,
            repository: data.krate.repository,
            downloads: data.krate.downloads,
            versions,
        })
    }
}

impl Default for PackageApiClient {
    fn default() -> Self {
        Self::new()
    }
}

// PyPI API response types
#[derive(Debug, Deserialize)]
pub struct PyPIResponse {
    pub info: PyPIInfo,
    #[serde(default)]
    pub releases: std::collections::HashMap<String, Vec<serde_json::Value>>,
}

#[derive(Debug, Deserialize)]
pub struct PyPIInfo {
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub home_page: Option<String>,
    #[serde(default)]
    pub license: Option<String>,
    #[serde(default)]
    pub author: Option<String>,
}

#[derive(Debug, Clone)]
pub struct PyPIPackage {
    pub name: String,
    pub version: String,
    pub summary: Option<String>,
    pub homepage: Option<String>,
    pub license: Option<String>,
    pub author: Option<String>,
    pub releases: Vec<String>,
}

// npm API response types
#[derive(Debug, Deserialize)]
pub struct NpmSearchResponse {
    pub objects: Vec<NpmSearchObject>,
    pub total: i64,
}

#[derive(Debug, Deserialize)]
pub struct NpmSearchObject {
    pub package: NpmPackageBasic,
    pub score: Option<NpmScore>,
}

#[derive(Debug, Deserialize)]
pub struct NpmPackageBasic {
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub keywords: Option<Vec<String>>,
    #[serde(default)]
    pub links: Option<NpmLinks>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct NpmLinks {
    pub npm: Option<String>,
    pub homepage: Option<String>,
    pub repository: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct NpmScore {
    #[serde(rename = "final")]
    pub final_score: f64,
}

#[derive(Debug, Clone)]
pub struct NpmPackage {
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub homepage: Option<String>,
    pub repository: Option<String>,
    pub keywords: Vec<String>,
    pub score: f64,
}

#[derive(Debug, Deserialize)]
pub struct NpmPackageFullInfo {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(rename = "dist-tags")]
    pub dist_tags: std::collections::HashMap<String, String>,
    pub versions: std::collections::HashMap<String, serde_json::Value>,
    #[serde(default)]
    pub homepage: Option<String>,
    #[serde(default)]
    pub repository: Option<NpmRepository>,
    #[serde(default)]
    pub license: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct NpmRepository {
    pub url: String,
}

#[derive(Debug, Clone)]
pub struct NpmPackageInfo {
    pub name: String,
    pub description: Option<String>,
    pub dist_tags: std::collections::HashMap<String, String>,
    pub versions: Vec<String>,
    pub homepage: Option<String>,
    pub repository: Option<String>,
    pub license: Option<String>,
}

// crates.io API response types
#[derive(Debug, Deserialize)]
pub struct CratesSearchResponse {
    pub crates: Vec<CrateBasic>,
    pub meta: CratesMeta,
}

#[derive(Debug, Deserialize)]
pub struct CrateBasic {
    pub name: String,
    pub max_version: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub downloads: i64,
    #[serde(default)]
    pub documentation: Option<String>,
    #[serde(default)]
    pub repository: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CratesMeta {
    pub total: i64,
}

#[derive(Debug, Clone)]
pub struct CratesPackage {
    pub name: String,
    pub max_version: String,
    pub description: Option<String>,
    pub downloads: i64,
    pub documentation: Option<String>,
    pub repository: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CrateDetailResponse {
    #[serde(rename = "crate")]
    pub krate: CrateDetail,
    pub versions: Vec<CrateVersion>,
}

#[derive(Debug, Deserialize)]
pub struct CrateDetail {
    pub name: String,
    pub max_version: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub homepage: Option<String>,
    #[serde(default)]
    pub documentation: Option<String>,
    #[serde(default)]
    pub repository: Option<String>,
    #[serde(default)]
    pub downloads: i64,
}

#[derive(Debug, Deserialize)]
pub struct CrateVersion {
    pub num: String,
    #[serde(default)]
    pub yanked: bool,
}

#[derive(Debug, Clone)]
pub struct CrateInfo {
    pub name: String,
    pub max_version: String,
    pub description: Option<String>,
    pub homepage: Option<String>,
    pub documentation: Option<String>,
    pub repository: Option<String>,
    pub downloads: i64,
    pub versions: Vec<String>,
}

// Lazy static client instance
use std::sync::OnceLock;

static API_CLIENT: OnceLock<PackageApiClient> = OnceLock::new();

pub fn get_api_client() -> &'static PackageApiClient {
    API_CLIENT.get_or_init(PackageApiClient::new)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_pypi_search() {
        let client = PackageApiClient::new();
        let results = client.search_pypi("requests", 10).await;
        assert!(results.is_ok());
    }

    #[tokio::test]
    async fn test_npm_search() {
        let client = PackageApiClient::new();
        let results = client.search_npm("react", 10).await;
        assert!(results.is_ok());
    }

    #[tokio::test]
    async fn test_crates_search() {
        let client = PackageApiClient::new();
        let results = client.search_crates("serde", 10).await;
        assert!(results.is_ok());
    }
}
