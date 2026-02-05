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

const GITHUB_API: &str = "https://api.github.com";

pub struct GitHubProvider {
    client: HttpClient,
    token: Option<String>,
}

impl GitHubProvider {
    pub fn new() -> Self {
        let token = std::env::var("GITHUB_TOKEN").ok();
        Self {
            client: HttpClient::new(),
            token,
        }
    }

    async fn api_get<T: for<'de> Deserialize<'de>>(&self, path: &str) -> CogniaResult<T> {
        let url = format!("{}{}", GITHUB_API, path);
        let mut opts = crate::platform::network::RequestOptions::new()
            .with_header("Accept", "application/vnd.github+json");
        if let Some(token) = &self.token {
            opts = opts.with_header("Authorization", format!("Bearer {}", token));
        }
        let resp = self.client.get_with_options(&url, Some(opts)).await?;
        resp.json()
            .await
            .map_err(|e| CogniaError::Network(e.to_string()))
    }

    pub async fn list_branches(&self, repo: &str) -> CogniaResult<Vec<GitHubBranch>> {
        self.api_get(&format!("/repos/{}/branches?per_page=100", repo))
            .await
    }

    pub async fn list_tags(&self, repo: &str) -> CogniaResult<Vec<GitHubTag>> {
        self.api_get(&format!("/repos/{}/tags?per_page=100", repo))
            .await
    }

    pub async fn list_releases(&self, repo: &str) -> CogniaResult<Vec<GitHubRelease>> {
        self.api_get(&format!("/repos/{}/releases?per_page=30", repo))
            .await
    }

    pub async fn get_release_by_tag(&self, repo: &str, tag: &str) -> CogniaResult<GitHubRelease> {
        self.api_get(&format!("/repos/{}/releases/tags/{}", repo, tag))
            .await
    }

    pub async fn get_latest_release(&self, repo: &str) -> CogniaResult<GitHubRelease> {
        self.api_get(&format!("/repos/{}/releases/latest", repo))
            .await
    }

    pub async fn validate_repo(&self, repo: &str) -> bool {
        #[derive(Deserialize)]
        struct RepoInfo {
            #[allow(dead_code)]
            full_name: String,
        }
        self.api_get::<RepoInfo>(&format!("/repos/{}", repo))
            .await
            .is_ok()
    }

    pub fn get_source_archive_url(&self, repo: &str, ref_name: &str, format: &str) -> String {
        let ext = if format == "tar.gz" { "tarball" } else { "zipball" };
        format!("https://github.com/{}/{}/{}", repo, ext, ref_name)
    }

    pub fn parse_repo_url(url: &str) -> Option<(String, String)> {
        let url = url.trim();
        
        // Handle owner/repo format directly
        if !url.contains('/') || url.starts_with("http") {
            // Try to parse as URL
            if let Some(path) = url.strip_prefix("https://github.com/") {
                let parts: Vec<&str> = path.trim_matches('/').split('/').collect();
                if parts.len() >= 2 {
                    return Some((parts[0].to_string(), parts[1].to_string()));
                }
            }
            if let Some(path) = url.strip_prefix("http://github.com/") {
                let parts: Vec<&str> = path.trim_matches('/').split('/').collect();
                if parts.len() >= 2 {
                    return Some((parts[0].to_string(), parts[1].to_string()));
                }
            }
            if let Some(path) = url.strip_prefix("git@github.com:") {
                let path = path.trim_end_matches(".git");
                let parts: Vec<&str> = path.split('/').collect();
                if parts.len() >= 2 {
                    return Some((parts[0].to_string(), parts[1].to_string()));
                }
            }
        } else {
            // owner/repo format
            let parts: Vec<&str> = url.split('/').collect();
            if parts.len() == 2 && !parts[0].is_empty() && !parts[1].is_empty() {
                return Some((parts[0].to_string(), parts[1].to_string()));
            }
        }
        None
    }

    fn match_asset<'a>(
        &self,
        assets: &'a [GitHubAsset],
        platform: Platform,
        arch: Architecture,
    ) -> Option<&'a GitHubAsset> {
        let mut picker = AssetPicker::new(platform, arch);

        // Add libc detection for Linux
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

impl AssetLike for GitHubAsset {
    fn name(&self) -> &str {
        &self.name
    }
}

impl Default for GitHubProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GitHubRelease {
    pub id: u64,
    pub tag_name: String,
    pub name: Option<String>,
    pub body: Option<String>,
    pub published_at: Option<String>,
    pub prerelease: bool,
    pub draft: bool,
    pub assets: Vec<GitHubAsset>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GitHubAsset {
    pub id: u64,
    pub name: String,
    pub size: u64,
    pub browser_download_url: String,
    pub content_type: Option<String>,
    pub download_count: Option<u64>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GitHubBranch {
    pub name: String,
    pub commit: GitHubCommitRef,
    #[serde(default)]
    pub protected: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GitHubCommitRef {
    pub sha: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GitHubTag {
    pub name: String,
    pub commit: GitHubCommitRef,
    pub zipball_url: Option<String>,
    pub tarball_url: Option<String>,
}

#[async_trait]
impl Provider for GitHubProvider {
    fn id(&self) -> &str {
        "github"
    }
    fn display_name(&self) -> &str {
        "GitHub Releases"
    }
    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([Capability::Install, Capability::Search, Capability::List])
    }
    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Linux, Platform::MacOS, Platform::Windows]
    }
    fn priority(&self) -> i32 {
        50
    }
    async fn is_available(&self) -> bool {
        true
    }

    async fn search(&self, query: &str, opts: SearchOptions) -> CogniaResult<Vec<PackageSummary>> {
        #[derive(Deserialize)]
        struct SearchResp {
            items: Vec<SearchItem>,
        }
        #[derive(Deserialize)]
        struct SearchItem {
            full_name: String,
            description: Option<String>,
        }

        let limit = opts.limit.unwrap_or(10);
        let resp: SearchResp = self
            .api_get(&format!(
                "/search/repositories?q={}&per_page={}",
                query, limit
            ))
            .await?;
        Ok(resp
            .items
            .into_iter()
            .map(|i| PackageSummary {
                name: i.full_name,
                description: i.description,
                latest_version: None,
                provider: self.id().into(),
            })
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let versions = self.get_versions(name).await?;
        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description: None,
            homepage: Some(format!("https://github.com/{}", name)),
            license: None,
            repository: Some(format!("https://github.com/{}", name)),
            versions,
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let releases: Vec<GitHubRelease> = self
            .api_get(&format!("/repos/{}/releases?per_page=20", name))
            .await?;
        Ok(releases
            .into_iter()
            .map(|r| VersionInfo {
                version: r.tag_name.trim_start_matches('v').into(),
                release_date: r.published_at,
                deprecated: false,
                yanked: false,
            })
            .collect())
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let release: GitHubRelease = if let Some(v) = &req.version {
            let tag = if v.starts_with('v') {
                v.clone()
            } else {
                format!("v{}", v)
            };
            self.api_get(&format!("/repos/{}/releases/tags/{}", req.name, tag))
                .await?
        } else {
            self.api_get(&format!("/repos/{}/releases/latest", req.name))
                .await?
        };

        let asset = self
            .match_asset(&release.assets, current_platform(), current_arch())
            .ok_or_else(|| CogniaError::PlatformNotSupported("No compatible asset".into()))?;

        let pkg_name = req.name.split('/').next_back().unwrap_or(&req.name);
        let install_dir = fs::get_cognia_dir()
            .unwrap()
            .join("packages")
            .join(pkg_name)
            .join(&release.tag_name);
        fs::create_dir_all(&install_dir).await?;

        let dest = install_dir.join(&asset.name);
        self.client
            .download(&asset.browser_download_url, &dest, None::<fn(_)>)
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

    async fn list_installed(&self, _: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        Ok(vec![])
    }

    async fn check_updates(&self, _: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        Ok(vec![])
    }
}
