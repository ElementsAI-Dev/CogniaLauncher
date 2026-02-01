use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::{current_arch, current_platform, Architecture, Platform},
    fs,
    network::HttpClient,
};
use async_trait::async_trait;
use serde::Deserialize;
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

    fn match_asset<'a>(
        &self,
        assets: &'a [GitHubAsset],
        platform: Platform,
        arch: Architecture,
    ) -> Option<&'a GitHubAsset> {
        let plat_pat: Vec<&str> = match platform {
            Platform::Linux => vec!["linux", "Linux", "musl", "gnu"],
            Platform::MacOS => vec!["darwin", "macos", "apple"],
            Platform::Windows => vec!["windows", "win64", "win32"],
            _ => return None,
        };
        let arch_pat: Vec<&str> = match arch {
            Architecture::X86_64 => vec!["x86_64", "amd64", "x64"],
            Architecture::Aarch64 => vec!["aarch64", "arm64"],
            _ => vec![],
        };
        assets
            .iter()
            .filter(|a| !a.name.contains(".sha") && !a.name.contains(".sig"))
            .filter(|a| plat_pat.iter().any(|p| a.name.to_lowercase().contains(p)))
            .max_by_key(|a| {
                arch_pat
                    .iter()
                    .filter(|p| a.name.to_lowercase().contains(*p))
                    .count()
            })
    }
}

impl Default for GitHubProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    published_at: Option<String>,
    #[allow(dead_code)]
    prerelease: bool,
    assets: Vec<GitHubAsset>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
    #[allow(dead_code)]
    size: u64,
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
