use super::traits::*;
use crate::download::{AssetLike, AssetPicker, LibcType};
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::{current_arch, current_platform, detect_libc, Architecture, Platform},
    fs,
    network::HttpClient,
};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

const DEFAULT_GITLAB_API: &str = "https://gitlab.com/api/v4";
const DEFAULT_GITLAB_URL: &str = "https://gitlab.com";

pub struct GitLabProvider {
    client: HttpClient,
    token: Option<String>,
    api_base: String,
    instance_url: String,
}

impl GitLabProvider {
    pub fn new() -> Self {
        let token = std::env::var("GITLAB_TOKEN").ok();
        Self {
            client: HttpClient::new(),
            token,
            api_base: DEFAULT_GITLAB_API.to_string(),
            instance_url: DEFAULT_GITLAB_URL.to_string(),
        }
    }

    /// Create a provider with an explicit token (from settings)
    pub fn with_token(mut self, token: Option<String>) -> Self {
        if token.is_some() {
            self.token = token;
        }
        self
    }

    /// Set a custom GitLab instance URL (for self-hosted GitLab)
    pub fn with_instance_url(mut self, url: Option<String>) -> Self {
        if let Some(url) = url {
            let url = url.trim_end_matches('/').to_string();
            self.api_base = format!("{}/api/v4", url);
            self.instance_url = url;
        }
        self
    }

    fn build_request_options(&self) -> crate::platform::network::RequestOptions {
        let mut opts = crate::platform::network::RequestOptions::new()
            .with_header("Accept", "application/json");
        if let Some(token) = &self.token {
            opts = opts.with_header("PRIVATE-TOKEN", token.clone());
        }
        opts
    }

    pub async fn api_get<T: for<'de> Deserialize<'de>>(&self, path: &str) -> CogniaResult<T> {
        let url = format!("{}{}", self.api_base, path);
        let opts = self.build_request_options();
        let resp = self.client.get_with_options(&url, Some(opts)).await?;
        resp.json()
            .await
            .map_err(|e| CogniaError::Network(e.to_string()))
    }

    async fn api_get_paginated<T: for<'de> Deserialize<'de>>(
        &self,
        path: &str,
        max_pages: usize,
    ) -> CogniaResult<Vec<T>> {
        let mut all_items: Vec<T> = Vec::new();
        let mut url = format!("{}{}", self.api_base, path);

        for _ in 0..max_pages {
            let opts = self.build_request_options();
            let resp = self.client.get_with_options(&url, Some(opts)).await?;

            let next_url = resp
                .headers()
                .get("link")
                .and_then(|v| v.to_str().ok())
                .and_then(Self::parse_next_link);

            let items: Vec<T> = resp
                .json()
                .await
                .map_err(|e| CogniaError::Network(e.to_string()))?;

            let is_empty = items.is_empty();
            all_items.extend(items);

            match next_url {
                Some(next) if !is_empty => url = next,
                _ => break,
            }
        }

        Ok(all_items)
    }

    fn parse_next_link(link_header: &str) -> Option<String> {
        for part in link_header.split(',') {
            let part = part.trim();
            if part.contains("rel=\"next\"") {
                if let Some(start) = part.find('<') {
                    if let Some(end) = part.find('>') {
                        return Some(part[start + 1..end].to_string());
                    }
                }
            }
        }
        None
    }

    /// URL-encode a project path (owner/repo -> owner%2Frepo)
    fn encode_project(project: &str) -> String {
        urlencoding::encode(project).into_owned()
    }

    pub async fn get_project_info(&self, project: &str) -> CogniaResult<GitLabProject> {
        let encoded = Self::encode_project(project);
        self.api_get(&format!("/projects/{}", encoded)).await
    }

    pub async fn list_branches(&self, project: &str) -> CogniaResult<Vec<GitLabBranch>> {
        let encoded = Self::encode_project(project);
        self.api_get_paginated(
            &format!("/projects/{}/repository/branches?per_page=100", encoded),
            5,
        )
        .await
    }

    pub async fn list_tags(&self, project: &str) -> CogniaResult<Vec<GitLabTag>> {
        let encoded = Self::encode_project(project);
        self.api_get_paginated(
            &format!("/projects/{}/repository/tags?per_page=100", encoded),
            5,
        )
        .await
    }

    pub async fn list_releases(&self, project: &str) -> CogniaResult<Vec<GitLabRelease>> {
        let encoded = Self::encode_project(project);
        self.api_get(&format!("/projects/{}/releases?per_page=30", encoded))
            .await
    }

    pub async fn get_latest_release(&self, project: &str) -> CogniaResult<GitLabRelease> {
        let encoded = Self::encode_project(project);
        let releases: Vec<GitLabRelease> = self
            .api_get(&format!(
                "/projects/{}/releases?per_page=1&order_by=released_at&sort=desc",
                encoded
            ))
            .await?;
        releases
            .into_iter()
            .next()
            .ok_or_else(|| CogniaError::Provider("No releases found".into()))
    }

    pub async fn get_release_by_tag(
        &self,
        project: &str,
        tag: &str,
    ) -> CogniaResult<GitLabRelease> {
        let encoded = Self::encode_project(project);
        let encoded_tag = urlencoding::encode(tag);
        self.api_get(&format!("/projects/{}/releases/{}", encoded, encoded_tag))
            .await
    }

    pub async fn validate_project(&self, project: &str) -> bool {
        self.get_project_info(project).await.is_ok()
    }

    /// Get HTTP headers needed for authenticated downloads
    pub fn get_download_headers(&self) -> std::collections::HashMap<String, String> {
        let mut headers = std::collections::HashMap::new();
        if let Some(token) = &self.token {
            headers.insert("PRIVATE-TOKEN".to_string(), token.clone());
        }
        headers
    }

    /// Check if a token is configured
    pub fn has_token(&self) -> bool {
        self.token.is_some()
    }

    /// Validate that the configured token works by making an authenticated API call
    pub async fn validate_token(&self) -> bool {
        if self.token.is_none() {
            return false;
        }
        #[derive(Deserialize)]
        struct User {
            #[allow(dead_code)]
            id: u64,
        }
        self.api_get::<User>("/user").await.is_ok()
    }

    /// Get the instance URL (for display/config purposes)
    pub fn get_instance_url(&self) -> &str {
        &self.instance_url
    }

    // ====================================================================
    // Pipeline & Job (CI Artifacts) API
    // ====================================================================

    pub async fn list_pipelines(
        &self,
        project: &str,
        ref_name: Option<&str>,
        status: Option<&str>,
    ) -> CogniaResult<Vec<GitLabPipeline>> {
        let encoded = Self::encode_project(project);
        let mut query = format!("/projects/{}/pipelines?per_page=20&order_by=updated_at&sort=desc", encoded);
        if let Some(r) = ref_name {
            query.push_str(&format!("&ref={}", urlencoding::encode(r)));
        }
        if let Some(s) = status {
            query.push_str(&format!("&status={}", s));
        }
        self.api_get(&query).await
    }

    pub async fn list_pipeline_jobs(
        &self,
        project: &str,
        pipeline_id: u64,
    ) -> CogniaResult<Vec<GitLabJob>> {
        let encoded = Self::encode_project(project);
        self.api_get(&format!(
            "/projects/{}/pipelines/{}/jobs?per_page=100",
            encoded, pipeline_id
        ))
        .await
    }

    pub fn get_job_artifacts_url(&self, project: &str, job_id: u64) -> String {
        let encoded = Self::encode_project(project);
        format!("{}/projects/{}/jobs/{}/artifacts", self.api_base, encoded, job_id)
    }

    // ====================================================================
    // Package Registry API
    // ====================================================================

    pub async fn list_packages(
        &self,
        project: &str,
        package_type: Option<&str>,
    ) -> CogniaResult<Vec<GitLabPackage>> {
        let encoded = Self::encode_project(project);
        let mut query = format!("/projects/{}/packages?per_page=30&order_by=created_at&sort=desc", encoded);
        if let Some(pt) = package_type {
            query.push_str(&format!("&package_type={}", pt));
        }
        self.api_get(&query).await
    }

    pub async fn list_package_files(
        &self,
        project: &str,
        package_id: u64,
    ) -> CogniaResult<Vec<GitLabPackageFile>> {
        let encoded = Self::encode_project(project);
        self.api_get(&format!(
            "/projects/{}/packages/{}/package_files",
            encoded, package_id
        ))
        .await
    }

    pub fn get_package_file_url(
        &self,
        project: &str,
        package_id: u64,
        file_name: &str,
    ) -> String {
        let encoded = Self::encode_project(project);
        format!(
            "{}/projects/{}/packages/{}/package_files/{}/download",
            self.api_base, encoded, package_id, urlencoding::encode(file_name)
        )
    }

    // ====================================================================
    // Source Archive
    // ====================================================================

    pub fn get_source_archive_url(&self, project: &str, ref_name: &str, format: &str) -> String {
        let encoded = Self::encode_project(project);
        let ext = match format {
            "tar.gz" => "tar.gz",
            "tar.bz2" => "tar.bz2",
            "tar" => "tar",
            _ => "zip",
        };
        format!(
            "{}/projects/{}/repository/archive.{}?sha={}",
            self.api_base, encoded, ext, ref_name
        )
    }

    /// Parse a GitLab project URL or path into (namespace, project_name).
    /// Supports nested subgroups: `group/subgroup/project` → `("group/subgroup", "project")`.
    pub fn parse_project_url(url: &str) -> Option<(String, String)> {
        let url = url.trim();

        // Handle direct path format: owner/repo or group/subgroup/project
        if !url.contains("://") && !url.starts_with("git@") {
            let parts: Vec<&str> = url.split('/').collect();
            if parts.len() >= 2 && parts.iter().all(|p| !p.is_empty()) {
                let project = parts[parts.len() - 1].to_string();
                let namespace = parts[..parts.len() - 1].join("/");
                return Some((namespace, project));
            }
        }

        // Handle HTTPS URLs: https://gitlab.com/owner/repo or https://gitlab.example.com/group/sub/project
        if url.starts_with("http://") || url.starts_with("https://") {
            if let Some(pos) = url.find("://") {
                let after_scheme = &url[pos + 3..];
                // Skip the host part
                if let Some(slash_pos) = after_scheme.find('/') {
                    let path = after_scheme[slash_pos + 1..].trim_end_matches('/');
                    let path = path.trim_end_matches(".git");
                    // Remove any trailing path segments like /-/tree/main
                    let path = if let Some(idx) = path.find("/-/") {
                        &path[..idx]
                    } else {
                        path
                    };
                    let parts: Vec<&str> = path.split('/').collect();
                    if parts.len() >= 2 && parts.iter().all(|p| !p.is_empty()) {
                        let project = parts[parts.len() - 1].to_string();
                        let namespace = parts[..parts.len() - 1].join("/");
                        return Some((namespace, project));
                    }
                }
            }
        }

        // Handle SSH URLs: git@gitlab.com:owner/repo.git or git@gitlab.com:group/sub/project.git
        if let Some(path) = url.strip_prefix("git@") {
            if let Some(colon_pos) = path.find(':') {
                let repo_path = path[colon_pos + 1..].trim_end_matches(".git");
                let parts: Vec<&str> = repo_path.split('/').collect();
                if parts.len() >= 2 && parts.iter().all(|p| !p.is_empty()) {
                    let project = parts[parts.len() - 1].to_string();
                    let namespace = parts[..parts.len() - 1].join("/");
                    return Some((namespace, project));
                }
            }
        }

        None
    }

    fn match_asset<'a>(
        &self,
        assets: &'a [GitLabReleaseLink],
        platform: Platform,
        arch: Architecture,
    ) -> Option<&'a GitLabReleaseLink> {
        let mut picker = AssetPicker::new(platform, arch);

        if platform == Platform::Linux {
            let libc = detect_libc();
            let libc_type = match libc.as_str() {
                "musl" => LibcType::Musl,
                "glibc" => LibcType::Glibc,
                _ => LibcType::Unknown,
            };
            picker = picker.with_libc(libc_type);
        }

        picker.pick_best(assets)
    }
}

impl AssetLike for GitLabReleaseLink {
    fn name(&self) -> &str {
        &self.name
    }
}

impl Default for GitLabProvider {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// GitLab API Data Types
// ============================================================================

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GitLabProject {
    pub id: u64,
    pub name: String,
    pub path_with_namespace: String,
    pub description: Option<String>,
    pub web_url: String,
    pub default_branch: Option<String>,
    pub star_count: Option<u64>,
    pub forks_count: Option<u64>,
    pub archived: Option<bool>,
    pub topics: Option<Vec<String>>,
    pub last_activity_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GitLabRelease {
    pub tag_name: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub created_at: Option<String>,
    pub released_at: Option<String>,
    pub upcoming_release: Option<bool>,
    pub assets: GitLabReleaseAssets,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GitLabReleaseAssets {
    pub count: Option<u64>,
    pub links: Vec<GitLabReleaseLink>,
    pub sources: Option<Vec<GitLabReleaseSource>>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GitLabReleaseLink {
    pub id: u64,
    pub name: String,
    pub url: String,
    pub direct_asset_url: Option<String>,
    pub link_type: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GitLabReleaseSource {
    pub format: String,
    pub url: String,
}

// ============================================================================
// Pipeline & Job Types (for CI Artifacts)
// ============================================================================

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GitLabPipeline {
    pub id: u64,
    #[serde(rename = "ref")]
    pub ref_name: Option<String>,
    pub sha: Option<String>,
    pub status: String,
    pub source: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub web_url: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GitLabJob {
    pub id: u64,
    pub name: String,
    pub stage: Option<String>,
    pub status: String,
    pub pipeline: Option<GitLabJobPipeline>,
    pub web_url: Option<String>,
    pub created_at: Option<String>,
    pub finished_at: Option<String>,
    pub artifacts: Option<Vec<GitLabJobArtifact>>,
    #[serde(rename = "ref")]
    pub ref_name: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GitLabJobPipeline {
    pub id: u64,
    pub status: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GitLabJobArtifact {
    pub file_type: String,
    pub size: Option<u64>,
    pub filename: String,
    pub file_format: Option<String>,
}

// ============================================================================
// Package Registry Types
// ============================================================================

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GitLabPackage {
    pub id: u64,
    pub name: String,
    pub version: String,
    pub package_type: String,
    pub status: Option<String>,
    pub created_at: Option<String>,
    #[serde(rename = "_links")]
    pub links: Option<GitLabPackageLinks>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GitLabPackageLinks {
    pub web_path: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GitLabPackageFile {
    pub id: u64,
    pub package_id: u64,
    pub file_name: String,
    pub size: u64,
    pub file_md5: Option<String>,
    pub file_sha256: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GitLabBranch {
    pub name: String,
    pub commit: GitLabCommitRef,
    #[serde(default)]
    pub protected: bool,
    #[serde(default)]
    pub default: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GitLabCommitRef {
    pub id: String,
    pub short_id: Option<String>,
    pub title: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GitLabTag {
    pub name: String,
    pub message: Option<String>,
    pub commit: GitLabCommitRef,
    pub release: Option<GitLabTagRelease>,
    pub protected: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GitLabTagRelease {
    pub tag_name: String,
    pub description: Option<String>,
}

// ============================================================================
// Provider Trait Implementation
// ============================================================================

#[async_trait]
impl Provider for GitLabProvider {
    fn id(&self) -> &str {
        "gitlab"
    }
    fn display_name(&self) -> &str {
        "GitLab Releases"
    }
    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([Capability::Install, Capability::Search, Capability::List])
    }
    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Linux, Platform::MacOS, Platform::Windows]
    }
    fn priority(&self) -> i32 {
        45
    }
    async fn is_available(&self) -> bool {
        true
    }

    async fn search(&self, query: &str, opts: SearchOptions) -> CogniaResult<Vec<PackageSummary>> {
        #[derive(Deserialize)]
        struct SearchItem {
            path_with_namespace: String,
            description: Option<String>,
        }

        let limit = opts.limit.unwrap_or(10);
        let encoded_query = urlencoding::encode(query);
        let items: Vec<SearchItem> = self
            .api_get(&format!(
                "/projects?search={}&per_page={}&order_by=star_count&sort=desc",
                encoded_query, limit
            ))
            .await?;

        Ok(items
            .into_iter()
            .map(|i| PackageSummary {
                name: i.path_with_namespace,
                description: i.description,
                latest_version: None,
                provider: self.id().into(),
            })
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let versions = self.get_versions(name).await?;
        let (description, homepage) = match self.get_project_info(name).await {
            Ok(info) => (info.description, Some(info.web_url)),
            Err(_) => (None, Some(format!("{}/{}", self.instance_url, name))),
        };
        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description,
            homepage,
            license: None,
            repository: Some(format!("{}/{}", self.instance_url, name)),
            versions,
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let releases = self.list_releases(name).await?;
        Ok(releases
            .into_iter()
            .map(|r| VersionInfo {
                version: r.tag_name.trim_start_matches('v').into(),
                release_date: r.released_at.or(r.created_at),
                deprecated: false,
                yanked: false,
            })
            .collect())
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let release = if let Some(v) = &req.version {
            let candidates = if let Some(stripped) = v.strip_prefix('v') {
                vec![v.clone(), stripped.to_string()]
            } else {
                vec![format!("v{}", v), v.clone()]
            };
            let mut last_err = CogniaError::Provider("No matching release found".into());
            let mut found = None;
            for tag in &candidates {
                match self.get_release_by_tag(&req.name, tag).await {
                    Ok(r) => {
                        found = Some(r);
                        break;
                    }
                    Err(e) => {
                        last_err = e;
                    }
                }
            }
            found.ok_or(last_err)?
        } else {
            self.get_latest_release(&req.name).await?
        };

        let asset = self
            .match_asset(&release.assets.links, current_platform(), current_arch())
            .ok_or_else(|| CogniaError::PlatformNotSupported("No compatible asset".into()))?;

        let pkg_name = req.name.split('/').next_back().unwrap_or(&req.name);
        let install_dir = fs::get_cognia_dir()
            .unwrap()
            .join("packages")
            .join(pkg_name)
            .join(&release.tag_name);
        fs::create_dir_all(&install_dir).await?;

        let download_url = asset.direct_asset_url.as_deref().unwrap_or(&asset.url);

        let dest = install_dir.join(&asset.name);

        // Build request options with auth header for private repos
        let opts = self.build_request_options();
        let download_client = HttpClient::new().with_options(opts);
        download_client
            .download(download_url, &dest, None::<fn(_)>)
            .await?;

        Ok(InstallReceipt {
            name: req.name,
            version: release.tag_name,
            provider: self.id().into(),
            install_path: install_dir,
            files: vec![dest],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let pkg_name = req.name.split('/').next_back().unwrap_or(&req.name);
        let pkg_dir = fs::get_cognia_dir()
            .unwrap()
            .join("packages")
            .join(pkg_name);
        if let Some(v) = req.version {
            fs::remove_dir_all(pkg_dir.join(v)).await?;
        } else {
            fs::remove_dir_all(pkg_dir).await?;
        }
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let packages_dir = match fs::get_cognia_dir() {
            Some(dir) => dir.join("packages"),
            None => return Ok(vec![]),
        };

        if !packages_dir.exists() {
            return Ok(vec![]);
        }

        let mut installed = Vec::new();
        let entries = std::fs::read_dir(&packages_dir)?;

        for entry in entries.flatten() {
            let pkg_name = entry.file_name().to_string_lossy().to_string();

            if let Some(ref name_filter) = filter.name_filter {
                if !pkg_name.to_lowercase().contains(&name_filter.to_lowercase()) {
                    continue;
                }
            }

            let pkg_path = entry.path();
            if !pkg_path.is_dir() {
                continue;
            }

            let versions: Vec<String> = std::fs::read_dir(&pkg_path)
                .into_iter()
                .flatten()
                .flatten()
                .filter(|e| e.path().is_dir())
                .map(|e| e.file_name().to_string_lossy().to_string())
                .collect();

            if let Some(version) = versions.first() {
                let installed_at = entry
                    .metadata()
                    .ok()
                    .and_then(|m| m.modified().ok())
                    .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339())
                    .unwrap_or_default();
                installed.push(InstalledPackage {
                    name: pkg_name,
                    version: version.trim_start_matches('v').to_string(),
                    provider: self.id().into(),
                    install_path: pkg_path.clone(),
                    installed_at,
                    is_global: true,
                });
            }
        }

        Ok(installed)
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let mut updates = Vec::new();

        for pkg_name in packages {
            let latest = match self.get_latest_release(pkg_name).await {
                Ok(r) => r,
                Err(_) => continue,
            };

            let latest_version = latest.tag_name.trim_start_matches('v').to_string();
            let local_pkg_name = pkg_name.split('/').next_back().unwrap_or(pkg_name);
            let pkg_dir = match fs::get_cognia_dir() {
                Some(dir) => dir.join("packages").join(local_pkg_name),
                None => continue,
            };

            if !pkg_dir.exists() {
                continue;
            }

            let installed_versions: Vec<String> = std::fs::read_dir(&pkg_dir)
                .into_iter()
                .flatten()
                .flatten()
                .filter(|e| e.path().is_dir())
                .map(|e| e.file_name().to_string_lossy().trim_start_matches('v').to_string())
                .collect();

            if let Some(current) = installed_versions.first() {
                if current != &latest_version {
                    updates.push(UpdateInfo {
                        name: pkg_name.clone(),
                        current_version: current.clone(),
                        latest_version: latest_version.clone(),
                        provider: self.id().into(),
                    });
                }
            }
        }

        Ok(updates)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_project_url_owner_repo() {
        let result = GitLabProvider::parse_project_url("owner/repo");
        assert_eq!(
            result,
            Some(("owner".to_string(), "repo".to_string()))
        );
    }

    #[test]
    fn test_parse_project_url_https() {
        let result = GitLabProvider::parse_project_url("https://gitlab.com/owner/repo");
        assert_eq!(
            result,
            Some(("owner".to_string(), "repo".to_string()))
        );
    }

    #[test]
    fn test_parse_project_url_https_trailing_slash() {
        let result = GitLabProvider::parse_project_url("https://gitlab.com/owner/repo/");
        assert_eq!(
            result,
            Some(("owner".to_string(), "repo".to_string()))
        );
    }

    #[test]
    fn test_parse_project_url_https_with_git_suffix() {
        let result =
            GitLabProvider::parse_project_url("https://gitlab.example.com/owner/repo.git");
        assert_eq!(
            result,
            Some(("owner".to_string(), "repo".to_string()))
        );
    }

    #[test]
    fn test_parse_project_url_https_with_tree_path() {
        let result =
            GitLabProvider::parse_project_url("https://gitlab.com/owner/repo/-/tree/main");
        assert_eq!(
            result,
            Some(("owner".to_string(), "repo".to_string()))
        );
    }

    #[test]
    fn test_parse_project_url_ssh() {
        let result = GitLabProvider::parse_project_url("git@gitlab.com:owner/repo.git");
        assert_eq!(
            result,
            Some(("owner".to_string(), "repo".to_string()))
        );
    }

    #[test]
    fn test_parse_project_url_nested_subgroup() {
        let result = GitLabProvider::parse_project_url("group/subgroup/project");
        assert_eq!(
            result,
            Some(("group/subgroup".to_string(), "project".to_string()))
        );
    }

    #[test]
    fn test_parse_project_url_deep_nested_subgroup() {
        let result = GitLabProvider::parse_project_url("org/team/sub/project");
        assert_eq!(
            result,
            Some(("org/team/sub".to_string(), "project".to_string()))
        );
    }

    #[test]
    fn test_parse_project_url_https_nested_subgroup() {
        let result =
            GitLabProvider::parse_project_url("https://gitlab.com/group/subgroup/project");
        assert_eq!(
            result,
            Some(("group/subgroup".to_string(), "project".to_string()))
        );
    }

    #[test]
    fn test_parse_project_url_https_nested_with_tree() {
        let result = GitLabProvider::parse_project_url(
            "https://gitlab.com/group/subgroup/project/-/tree/main",
        );
        assert_eq!(
            result,
            Some(("group/subgroup".to_string(), "project".to_string()))
        );
    }

    #[test]
    fn test_parse_project_url_ssh_nested_subgroup() {
        let result =
            GitLabProvider::parse_project_url("git@gitlab.com:group/subgroup/project.git");
        assert_eq!(
            result,
            Some(("group/subgroup".to_string(), "project".to_string()))
        );
    }

    #[test]
    fn test_parse_project_url_invalid() {
        assert!(GitLabProvider::parse_project_url("").is_none());
        assert!(GitLabProvider::parse_project_url("just-a-name").is_none());
    }

    #[test]
    fn test_encode_project() {
        assert_eq!(
            GitLabProvider::encode_project("owner/repo"),
            "owner%2Frepo"
        );
    }

    #[test]
    fn test_get_source_archive_url_tar_gz() {
        let provider = GitLabProvider::new();
        let url = provider.get_source_archive_url("owner/repo", "main", "tar.gz");
        assert!(url.contains("archive.tar.gz"));
        assert!(url.contains("sha=main"));
        assert!(url.contains("owner%2Frepo"));
    }

    #[test]
    fn test_get_source_archive_url_zip() {
        let provider = GitLabProvider::new();
        let url = provider.get_source_archive_url("owner/repo", "v1.0", "zip");
        assert!(url.contains("archive.zip"));
        assert!(url.contains("sha=v1.0"));
    }

    #[test]
    fn test_with_instance_url() {
        let provider = GitLabProvider::new()
            .with_instance_url(Some("https://gitlab.example.com/".to_string()));
        assert_eq!(provider.get_instance_url(), "https://gitlab.example.com");
        assert!(provider.api_base.contains("gitlab.example.com/api/v4"));
    }

    #[test]
    fn test_has_token() {
        let p1 = GitLabProvider::new();
        // Token depends on GITLAB_TOKEN env var; just test the method
        let _ = p1.has_token();

        let mut p2 = GitLabProvider::new();
        p2.token = Some("glpat-test".into());
        assert!(p2.has_token());
    }

    #[test]
    fn test_get_download_headers_no_token() {
        let mut provider = GitLabProvider::new();
        provider.token = None;
        let headers = provider.get_download_headers();
        assert!(!headers.contains_key("PRIVATE-TOKEN"));
    }

    #[test]
    fn test_get_download_headers_with_token() {
        let mut provider = GitLabProvider::new();
        provider.token = Some("glpat-abc".into());
        let headers = provider.get_download_headers();
        assert_eq!(headers["PRIVATE-TOKEN"], "glpat-abc");
    }

    #[test]
    fn test_provider_metadata() {
        let provider = GitLabProvider::new();
        assert_eq!(provider.id(), "gitlab");
        assert_eq!(provider.display_name(), "GitLab Releases");
        assert_eq!(provider.priority(), 45);
        assert_eq!(provider.get_instance_url(), DEFAULT_GITLAB_URL);
    }

    #[test]
    fn test_capabilities() {
        let provider = GitLabProvider::new();
        let caps = provider.capabilities();
        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
    }

    #[test]
    fn test_supported_platforms() {
        let provider = GitLabProvider::new();
        let platforms = provider.supported_platforms();
        assert!(platforms.contains(&Platform::Linux));
        assert!(platforms.contains(&Platform::MacOS));
        assert!(platforms.contains(&Platform::Windows));
    }

    #[test]
    fn test_default_impl() {
        let _provider = GitLabProvider::default();
    }

    #[test]
    fn test_parse_next_link() {
        let header = r#"<https://gitlab.com/api/v4/projects/1/branches?page=2&per_page=100>; rel="next", <https://gitlab.com/api/v4/projects/1/branches?page=5&per_page=100>; rel="last""#;
        let next = GitLabProvider::parse_next_link(header);
        assert_eq!(
            next,
            Some("https://gitlab.com/api/v4/projects/1/branches?page=2&per_page=100".into())
        );
    }

    #[test]
    fn test_parse_next_link_no_next() {
        let header = r#"<https://gitlab.com/api/v4/projects/1/branches?page=5&per_page=100>; rel="last""#;
        let next = GitLabProvider::parse_next_link(header);
        assert!(next.is_none());
    }

    #[test]
    fn test_encode_nested_project() {
        assert_eq!(
            GitLabProvider::encode_project("group/subgroup/project"),
            "group%2Fsubgroup%2Fproject"
        );
    }
}
