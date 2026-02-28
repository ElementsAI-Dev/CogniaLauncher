use crate::error::{CogniaError, CogniaResult};
use reqwest::Client;
use serde::Deserialize;
use std::sync::RwLock;


/// Default registry URLs
pub const DEFAULT_PYPI_URL: &str = "https://pypi.org";
pub const DEFAULT_NPM_REGISTRY: &str = "https://registry.npmjs.org";
pub const DEFAULT_CRATES_REGISTRY: &str = "https://crates.io";

/// Configuration for API client mirrors
#[derive(Debug, Clone)]
pub struct ApiClientConfig {
    pub pypi_base_url: String,
    pub npm_registry_url: String,
    pub crates_registry_url: String,
}

impl Default for ApiClientConfig {
    fn default() -> Self {
        Self {
            pypi_base_url: DEFAULT_PYPI_URL.into(),
            npm_registry_url: DEFAULT_NPM_REGISTRY.into(),
            crates_registry_url: DEFAULT_CRATES_REGISTRY.into(),
        }
    }
}

impl ApiClientConfig {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_pypi_url(mut self, url: impl Into<String>) -> Self {
        self.pypi_base_url = url.into();
        self
    }

    pub fn with_npm_registry(mut self, url: impl Into<String>) -> Self {
        self.npm_registry_url = url.into();
        self
    }

    pub fn with_crates_registry(mut self, url: impl Into<String>) -> Self {
        self.crates_registry_url = url.into();
        self
    }
}

/// HTTP API client for package registries
pub struct PackageApiClient {
    client: RwLock<Client>,
    config: RwLock<ApiClientConfig>,
}

impl PackageApiClient {
    pub fn new() -> Self {
        Self {
            client: RwLock::new(crate::platform::proxy::get_shared_client()),
            config: RwLock::new(ApiClientConfig::default()),
        }
    }

    /// Create a new client with custom configuration
    pub fn with_config(config: ApiClientConfig) -> Self {
        Self {
            client: RwLock::new(crate::platform::proxy::get_shared_client()),
            config: RwLock::new(config),
        }
    }

    /// Rebuild the internal HTTP client from current settings.
    /// Called when proxy or security settings change.
    pub fn rebuild_client(&self, settings: &crate::config::Settings) {
        let new_client = crate::platform::proxy::build_client(settings);
        if let Ok(mut guard) = self.client.write() {
            *guard = new_client;
        }
    }

    /// Get a clone of the inner reqwest Client (cheap, Arc-based)
    fn get_client(&self) -> Client {
        self.client
            .read()
            .map(|g| g.clone())
            .unwrap_or_else(|e| e.into_inner().clone())
    }

    /// Update the configuration at runtime
    pub fn update_config(&self, config: ApiClientConfig) {
        if let Ok(mut guard) = self.config.write() {
            *guard = config;
        }
    }

    /// Set PyPI base URL
    pub fn set_pypi_url(&self, url: &str) {
        if let Ok(mut guard) = self.config.write() {
            guard.pypi_base_url = url.to_string();
        }
    }

    /// Set npm registry URL
    pub fn set_npm_registry(&self, url: &str) {
        if let Ok(mut guard) = self.config.write() {
            guard.npm_registry_url = url.to_string();
        }
    }

    /// Set crates.io registry URL
    pub fn set_crates_registry(&self, url: &str) {
        if let Ok(mut guard) = self.config.write() {
            guard.crates_registry_url = url.to_string();
        }
    }

    /// Get the current PyPI base URL
    fn get_pypi_url(&self) -> String {
        self.config
            .read()
            .map(|c| c.pypi_base_url.clone())
            .unwrap_or_else(|_| DEFAULT_PYPI_URL.into())
    }

    /// Get the current npm registry URL
    fn get_npm_registry(&self) -> String {
        self.config
            .read()
            .map(|c| c.npm_registry_url.clone())
            .unwrap_or_else(|_| DEFAULT_NPM_REGISTRY.into())
    }

    /// Get the current crates.io registry URL
    fn get_crates_registry(&self) -> String {
        self.config
            .read()
            .map(|c| c.crates_registry_url.clone())
            .unwrap_or_else(|_| DEFAULT_CRATES_REGISTRY.into())
    }

    /// Search PyPI packages — exact match via JSON API, then fuzzy via search page
    pub async fn search_pypi(&self, query: &str, limit: usize) -> CogniaResult<Vec<PyPIPackage>> {
        let base_url = self.get_pypi_url();

        // 1. Try exact match first (fast, returns full metadata)
        let url = format!("{}/pypi/{}/json", base_url, query);
        let exact_match = match self.get_client().get(&url).send().await {
            Ok(response) if response.status().is_success() => {
                let data: PyPIResponse = response.json().await.map_err(|e| {
                    CogniaError::Provider(format!("Failed to parse PyPI response: {}", e))
                })?;
                Some(PyPIPackage {
                    name: data.info.name,
                    version: data.info.version,
                    summary: data.info.summary,
                    homepage: data.info.home_page,
                    license: data.info.license,
                    author: data.info.author,
                    releases: data.releases.keys().cloned().collect(),
                })
            }
            _ => None,
        };

        // 2. Try fuzzy search via PyPI search HTML page
        let mut results = Vec::new();
        if let Some(exact) = exact_match {
            results.push(exact);
        }

        // Only do fuzzy search if we need more results
        if results.len() < limit {
            let search_url = format!("{}/search/?q={}", base_url, query);
            if let Ok(response) = self.get_client().get(&search_url).send().await {
                if response.status().is_success() {
                    if let Ok(html) = response.text().await {
                        let fuzzy = Self::parse_pypi_search_html(&html, limit);
                        for pkg in fuzzy {
                            // Avoid duplicating the exact match
                            if !results.iter().any(|r| r.name.eq_ignore_ascii_case(&pkg.name)) {
                                results.push(pkg);
                                if results.len() >= limit {
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }

        if results.is_empty() {
            // Network issue or truly no results
            return Ok(vec![]);
        }

        Ok(results)
    }

    /// Parse PyPI search HTML page to extract package name, version, description
    fn parse_pypi_search_html(html: &str, limit: usize) -> Vec<PyPIPackage> {
        let mut packages = Vec::new();

        // PyPI search results are in <a class="package-snippet"> blocks
        // Each contains: <span class="package-snippet__name">name</span>
        //                <span class="package-snippet__version">version</span>
        //                <p class="package-snippet__description">desc</p>
        for snippet in html.split("package-snippet__name") {
            if packages.len() >= limit {
                break;
            }
            // Extract name: content between > and <
            let name = Self::extract_html_text(snippet);
            if name.is_empty() {
                continue;
            }

            // Find version in the remainder of this snippet block
            let version = snippet
                .find("package-snippet__version")
                .and_then(|pos| Self::extract_html_text(&snippet[pos..]).into())
                .filter(|v: &String| !v.is_empty());

            // Find description
            let description = snippet
                .find("package-snippet__description")
                .and_then(|pos| Self::extract_html_text(&snippet[pos..]).into())
                .filter(|d: &String| !d.is_empty());

            packages.push(PyPIPackage {
                name,
                version: version.unwrap_or_default(),
                summary: description,
                homepage: None,
                license: None,
                author: None,
                releases: vec![],
            });
        }

        packages
    }

    /// Extract text content between the first > and < after a class marker
    fn extract_html_text(s: &str) -> String {
        if let Some(start) = s.find('>') {
            let rest = &s[start + 1..];
            if let Some(end) = rest.find('<') {
                return rest[..end].trim().to_string();
            }
        }
        String::new()
    }

    /// Get detailed package info from PyPI
    pub async fn get_pypi_package(&self, name: &str) -> CogniaResult<PyPIPackage> {
        let base_url = self.get_pypi_url();
        let url = format!("{}/pypi/{}/json", base_url, name);

        let response = self
            .get_client()
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
        let registry_url = self.get_npm_registry();
        let url = format!(
            "{}/-/v1/search?text={}&size={}",
            registry_url,
            urlencoding::encode(query),
            limit
        );

        let response = self.get_client().get(&url).send().await.map_err(|e| {
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
        let registry_url = self.get_npm_registry();
        let url = format!("{}/{}", registry_url, urlencoding::encode(name));

        let response = self.get_client().get(&url).send().await.map_err(|e| {
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
        let registry_url = self.get_crates_registry();
        let url = format!(
            "{}/api/v1/crates?q={}&per_page={}",
            registry_url,
            urlencoding::encode(query),
            limit
        );

        let response = self
            .get_client()
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

    /// Perform a raw GET request and return the response body as a string
    /// Useful for APIs that don't fit the standard package registry pattern
    pub async fn raw_get(&self, url: &str) -> CogniaResult<String> {
        let response = self
            .get_client()
            .get(url)
            .header(
                "User-Agent",
                "CogniaLauncher/0.1.0 (https://github.com/AstroAir/CogniaLauncher)",
            )
            .send()
            .await
            .map_err(|e| CogniaError::Provider(format!("HTTP request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(CogniaError::Provider(format!(
                "HTTP {} from {}",
                response.status(),
                url
            )));
        }

        response
            .text()
            .await
            .map_err(|e| CogniaError::Provider(format!("Failed to read response body: {}", e)))
    }

    /// Get detailed crate info
    pub async fn get_crate(&self, name: &str) -> CogniaResult<CrateInfo> {
        let registry_url = self.get_crates_registry();
        let url = format!(
            "{}/api/v1/crates/{}",
            registry_url,
            urlencoding::encode(name)
        );

        let response = self
            .get_client()
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

fn pypi_base_url_from_index_url(index_url: &str) -> String {
    let trimmed = index_url.trim_end_matches('/');
    if let Some(base) = trimmed.strip_suffix("/simple") {
        base.to_string()
    } else {
        trimmed.to_string()
    }
}

/// Update the global API client configuration from Settings
pub fn update_api_client_from_settings(settings: &crate::config::Settings) {
    let client = get_api_client();

    // Rebuild the underlying reqwest Client with current proxy/security settings
    client.rebuild_client(settings);

    if let Some(pypi_url) = settings.get_mirror_url("pypi") {
        // mirrors.pypi is a pip/uv index-url (usually ends with /simple). The JSON API base
        // must not include /simple.
        client.set_pypi_url(&pypi_base_url_from_index_url(&pypi_url));
    }

    if let Some(npm_url) = settings.get_mirror_url("npm") {
        client.set_npm_registry(&npm_url);
    }
}

/// Build an ApiClientConfig from Settings
pub fn config_from_settings(settings: &crate::config::Settings) -> ApiClientConfig {
    let mut config = ApiClientConfig::default();

    if let Some(pypi_url) = settings.get_mirror_url("pypi") {
        config.pypi_base_url = pypi_base_url_from_index_url(&pypi_url);
    }

    if let Some(npm_url) = settings.get_mirror_url("npm") {
        config.npm_registry_url = npm_url;
    }

    config
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore = "Live network test (PyPI). Run with: cargo test -- --ignored"]
    async fn test_pypi_search() {
        let client = PackageApiClient::new();
        let results = client.search_pypi("requests", 10).await;
        assert!(results.is_ok());
    }

    #[tokio::test]
    #[ignore = "Live network test (npm registry). Run with: cargo test -- --ignored"]
    async fn test_npm_search() {
        let client = PackageApiClient::new();
        let results = client.search_npm("react", 10).await;
        assert!(results.is_ok());
    }

    #[tokio::test]
    #[ignore = "Live network test (crates.io). Run with: cargo test -- --ignored"]
    async fn test_crates_search() {
        let client = PackageApiClient::new();
        let results = client.search_crates("serde", 10).await;
        assert!(results.is_ok());
    }

    #[test]
    fn test_api_client_config_builder() {
        let config = ApiClientConfig::new()
            .with_pypi_url("https://pypi.tuna.tsinghua.edu.cn")
            .with_npm_registry("https://registry.npmmirror.com")
            .with_crates_registry("https://rsproxy.cn");

        assert_eq!(config.pypi_base_url, "https://pypi.tuna.tsinghua.edu.cn");
        assert_eq!(config.npm_registry_url, "https://registry.npmmirror.com");
        assert_eq!(config.crates_registry_url, "https://rsproxy.cn");
    }

    #[test]
    fn test_api_client_config_update() {
        let client = PackageApiClient::new();

        client.set_pypi_url("https://custom.pypi.org");
        assert_eq!(client.get_pypi_url(), "https://custom.pypi.org");

        client.set_npm_registry("https://custom.npm.org");
        assert_eq!(client.get_npm_registry(), "https://custom.npm.org");

        client.set_crates_registry("https://custom.crates.io");
        assert_eq!(client.get_crates_registry(), "https://custom.crates.io");
    }

    #[test]
    fn test_pypi_base_url_derivation() {
        assert_eq!(
            pypi_base_url_from_index_url("https://pypi.org/simple"),
            "https://pypi.org"
        );
        assert_eq!(
            pypi_base_url_from_index_url("https://pypi.org/simple/"),
            "https://pypi.org"
        );
        assert_eq!(
            pypi_base_url_from_index_url("https://mirror.example.com/simple"),
            "https://mirror.example.com"
        );
        // If it's not an index-url, keep it as-is.
        assert_eq!(
            pypi_base_url_from_index_url("https://pypi.org"),
            "https://pypi.org"
        );
    }
}
