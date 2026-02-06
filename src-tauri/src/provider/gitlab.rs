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

    async fn api_get<T: for<'de> Deserialize<'de>>(&self, path: &str) -> CogniaResult<T> {
        let url = format!("{}{}", self.api_base, path);
        let opts = self.build_request_options();
        let resp = self.client.get_with_options(&url, Some(opts)).await?;
        resp.json()
            .await
            .map_err(|e| CogniaError::Network(e.to_string()))
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
        self.api_get(&format!("/projects/{}/repository/branches?per_page=100", encoded))
            .await
    }

    pub async fn list_tags(&self, project: &str) -> CogniaResult<Vec<GitLabTag>> {
        let encoded = Self::encode_project(project);
        self.api_get(&format!("/projects/{}/repository/tags?per_page=100", encoded))
            .await
    }

    pub async fn list_releases(&self, project: &str) -> CogniaResult<Vec<GitLabRelease>> {
        let encoded = Self::encode_project(project);
        self.api_get(&format!("/projects/{}/releases?per_page=30", encoded))
            .await
    }

    pub async fn get_release_by_tag(
        &self,
        project: &str,
        tag: &str,
    ) -> CogniaResult<GitLabRelease> {
        let encoded = Self::encode_project(project);
        let encoded_tag = urlencoding::encode(tag);
        self.api_get(&format!(
            "/projects/{}/releases/{}",
            encoded, encoded_tag
        ))
        .await
    }

    pub async fn validate_project(&self, project: &str) -> bool {
        self.get_project_info(project).await.is_ok()
    }

    pub fn get_source_archive_url(
        &self,
        project: &str,
        ref_name: &str,
        format: &str,
    ) -> String {
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

    pub fn parse_project_url(url: &str) -> Option<(String, String)> {
        let url = url.trim();

        // Handle owner/repo format directly
        if !url.contains("://") && !url.starts_with("git@") {
            let parts: Vec<&str> = url.split('/').collect();
            if parts.len() == 2 && !parts[0].is_empty() && !parts[1].is_empty() {
                return Some((parts[0].to_string(), parts[1].to_string()));
            }
        }

        // Handle HTTPS URLs: https://gitlab.com/owner/repo or https://gitlab.example.com/owner/repo
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
                    if parts.len() >= 2 {
                        return Some((parts[0].to_string(), parts[1].to_string()));
                    }
                }
            }
        }

        // Handle SSH URLs: git@gitlab.com:owner/repo.git
        if let Some(path) = url.strip_prefix("git@") {
            if let Some(colon_pos) = path.find(':') {
                let repo_path = path[colon_pos + 1..].trim_end_matches(".git");
                let parts: Vec<&str> = repo_path.split('/').collect();
                if parts.len() >= 2 {
                    return Some((parts[0].to_string(), parts[1].to_string()));
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
            Err(_) => (
                None,
                Some(format!("{}/{}", self.instance_url, name)),
            ),
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
            let candidates = if v.starts_with('v') {
                vec![v.clone(), v[1..].to_string()]
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
            let releases = self.list_releases(&req.name).await?;
            releases
                .into_iter()
                .next()
                .ok_or_else(|| CogniaError::Provider("No releases found".into()))?
        };

        let asset = self
            .match_asset(
                &release.assets.links,
                current_platform(),
                current_arch(),
            )
            .ok_or_else(|| CogniaError::PlatformNotSupported("No compatible asset".into()))?;

        let pkg_name = req
            .name
            .split('/')
            .next_back()
            .unwrap_or(&req.name);
        let install_dir = fs::get_cognia_dir()
            .unwrap()
            .join("packages")
            .join(pkg_name)
            .join(&release.tag_name);
        fs::create_dir_all(&install_dir).await?;

        let download_url = asset
            .direct_asset_url
            .as_deref()
            .unwrap_or(&asset.url);

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
        let pkg_name = req
            .name
            .split('/')
            .next_back()
            .unwrap_or(&req.name);
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

    async fn list_installed(&self, _: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        Ok(vec![])
    }

    async fn check_updates(&self, _: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        Ok(vec![])
    }
}
