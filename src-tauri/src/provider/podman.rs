use super::api::get_api_client;
use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::Platform,
    process::{self, ProcessOptions},
};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::PathBuf;
use std::time::Duration;

/// Podman - Daemonless container engine (Docker-compatible)
///
/// Podman provides a Docker-compatible CLI for managing OCI containers
/// without requiring a daemon. It supports rootless containers by default.
pub struct PodmanProvider;

impl PodmanProvider {
    pub fn new() -> Self {
        Self
    }

    fn make_opts() -> ProcessOptions {
        ProcessOptions::new().with_timeout(Duration::from_secs(120))
    }

    async fn run_podman(&self, args: &[&str]) -> CogniaResult<String> {
        let out = process::execute("podman", args, Some(Self::make_opts())).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Parse an image name into (namespace, repo) for Docker Hub API queries.
    /// Returns None if the image is from a non-Hub registry.
    fn parse_hub_image(name: &str) -> Option<(String, String)> {
        let name_part = name.split(':').next().unwrap_or(name);
        // Podman may prefix docker.io/library/ or docker.io/ - strip it
        let name_part = name_part
            .strip_prefix("docker.io/library/")
            .or_else(|| name_part.strip_prefix("docker.io/"))
            .unwrap_or(name_part);

        let parts: Vec<&str> = name_part.split('/').collect();
        match parts.len() {
            1 => Some(("library".to_string(), parts[0].to_string())),
            2 => {
                if parts[0].contains('.') || parts[0].contains(':') {
                    None
                } else {
                    Some((parts[0].to_string(), parts[1].to_string()))
                }
            }
            _ => None,
        }
    }

    /// Query Docker Hub API for tags (shared registry with Docker)
    async fn fetch_hub_tags(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let (namespace, repo) = match Self::parse_hub_image(name) {
            Some(pair) => pair,
            None => return Ok(vec![]),
        };

        let url = format!(
            "https://hub.docker.com/v2/repositories/{}/{}/tags/?page_size=25&ordering=last_updated",
            namespace, repo
        );

        let client = get_api_client();
        let body = match client.raw_get(&url).await {
            Ok(b) => b,
            Err(_) => return Ok(vec![]),
        };

        let json: serde_json::Value = match serde_json::from_str(&body) {
            Ok(v) => v,
            Err(_) => return Ok(vec![]),
        };

        let versions = json["results"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|tag| {
                        let tag_name = tag["name"].as_str()?;
                        let last_updated = tag["last_updated"].as_str().map(|s| s.to_string());
                        Some(VersionInfo {
                            version: tag_name.to_string(),
                            release_date: last_updated,
                            deprecated: false,
                            yanked: false,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(versions)
    }

    /// Query Docker Hub API for repository info
    async fn fetch_hub_info(&self, name: &str) -> Option<(String, Option<String>, Option<u64>)> {
        let (namespace, repo) = Self::parse_hub_image(name)?;

        let url = format!(
            "https://hub.docker.com/v2/repositories/{}/{}/",
            namespace, repo
        );

        let client = get_api_client();
        let body = client.raw_get(&url).await.ok()?;
        let json: serde_json::Value = serde_json::from_str(&body).ok()?;

        let description = json["description"]
            .as_str()
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .or_else(|| {
                json["full_description"].as_str().map(|s| {
                    s.split("\n\n")
                        .next()
                        .unwrap_or(s)
                        .chars()
                        .take(500)
                        .collect()
                })
            });
        let star_count = json["star_count"].as_u64();

        let hub_url = if namespace == "library" {
            format!("https://hub.docker.com/_/{}", repo)
        } else {
            format!("https://hub.docker.com/r/{}/{}", namespace, repo)
        };

        Some((hub_url, description, star_count))
    }

    /// Format image name with optional tag
    fn format_image(name: &str, version: Option<&str>) -> String {
        if let Some(v) = version {
            format!("{}:{}", name, v)
        } else {
            format!("{}:latest", name)
        }
    }

    /// Get image digest from local storage
    async fn get_local_digest(&self, image: &str) -> Option<String> {
        let out = self
            .run_podman(&[
                "image",
                "inspect",
                image,
                "--format",
                "{{index .RepoDigests 0}}",
            ])
            .await
            .ok()?;
        let digest = out.trim();
        if digest.is_empty() || digest == "[]" {
            None
        } else {
            digest.split('@').nth(1).map(|s| s.to_string())
        }
    }

    /// Normalize image name: Podman may store images with full registry prefix
    /// e.g. "docker.io/library/nginx" instead of just "nginx"
    fn normalize_image_name(name: &str) -> &str {
        name.strip_prefix("docker.io/library/")
            .or_else(|| name.strip_prefix("docker.io/"))
            .unwrap_or(name)
    }
}

impl Default for PodmanProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for PodmanProvider {
    fn id(&self) -> &str {
        "podman"
    }

    fn display_name(&self) -> &str {
        "Podman (Daemonless Containers)"
    }

    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
            Capability::Update,
            Capability::Upgrade,
        ])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }

    fn priority(&self) -> i32 {
        58
    }

    async fn is_available(&self) -> bool {
        if process::which("podman").await.is_none() {
            return false;
        }
        // Podman is daemonless - just verify the CLI works
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(10));
        match process::execute("podman", &["--version"], Some(opts)).await {
            Ok(output) => output.success,
            Err(_) => false,
        }
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let limit = options.limit.unwrap_or(25).to_string();
        let out = self
            .run_podman(&["search", query, "--limit", &limit, "--format", "{{json .}}"])
            .await?;

        let packages: Vec<PackageSummary> = out
            .lines()
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let json = serde_json::from_str::<serde_json::Value>(line).ok()?;
                // Podman search JSON uses "Name", "Description", "Stars", "Official"
                let name = json["Name"].as_str()?.to_string();
                let description = json["Description"].as_str().map(|s| s.to_string());
                let is_official = json["Official"].as_str() == Some("[OK]")
                    || json["Official"].as_bool() == Some(true);
                let star_count = json["Stars"]
                    .as_str()
                    .and_then(|s| s.parse::<u64>().ok())
                    .or_else(|| json["Stars"].as_u64());

                let enhanced_desc = match (&description, is_official, star_count) {
                    (Some(desc), true, Some(stars)) if stars > 0 => {
                        Some(format!("[Official] {} stars - {}", stars, desc))
                    }
                    (Some(desc), false, Some(stars)) if stars > 0 => {
                        Some(format!("{} stars - {}", stars, desc))
                    }
                    (Some(desc), true, _) => Some(format!("[Official] {}", desc)),
                    _ => description,
                };

                // Normalize the name (Podman may include registry prefix)
                let normalized = Self::normalize_image_name(&name).to_string();

                Some(PackageSummary {
                    name: normalized,
                    description: enhanced_desc,
                    latest_version: Some("latest".into()),
                    provider: self.id().into(),
                })
            })
            .collect();

        Ok(packages)
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        // Try to inspect the local image first
        let out = self
            .run_podman(&["image", "inspect", name, "--format", "{{json .}}"])
            .await;

        let (mut description, mut versions) = if let Ok(output) = out {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&output) {
                let inspect = if json.is_array() {
                    json.get(0).unwrap_or(&json)
                } else {
                    &json
                };

                let tags = inspect["RepoTags"]
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|t| {
                                let tag = t.as_str()?;
                                let version = tag.split(':').next_back()?;
                                Some(VersionInfo {
                                    version: version.into(),
                                    release_date: None,
                                    deprecated: false,
                                    yanked: false,
                                })
                            })
                            .collect()
                    })
                    .unwrap_or_default();

                let desc = inspect["Config"]["Labels"]["org.opencontainers.image.description"]
                    .as_str()
                    .or_else(|| inspect["Config"]["Labels"]["description"].as_str())
                    .or_else(|| inspect["Comment"].as_str())
                    .map(|s| s.to_string());

                (desc, tags)
            } else {
                (None, vec![])
            }
        } else {
            (None, vec![])
        };

        // Try Docker Hub API for additional info
        let mut license = None;
        let homepage = if let Some((hub_url, hub_desc, _stars)) = self.fetch_hub_info(name).await {
            if description.is_none() {
                description = hub_desc;
            }
            Some(hub_url)
        } else if name.contains('/') {
            Some(format!("https://hub.docker.com/r/{}", name))
        } else {
            Some(format!("https://hub.docker.com/_/{}", name))
        };

        // Try to extract license from OCI labels
        if let Ok(output) = self
            .run_podman(&[
                "image",
                "inspect",
                name,
                "--format",
                "{{index .Config.Labels \"org.opencontainers.image.licenses\"}}",
            ])
            .await
        {
            let lic = output.trim();
            if !lic.is_empty() && lic != "<no value>" {
                license = Some(lic.to_string());
            }
        }

        // If no versions from local, try Docker Hub API
        if versions.is_empty() {
            if let Ok(hub_versions) = self.fetch_hub_tags(name).await {
                if !hub_versions.is_empty() {
                    versions = hub_versions;
                }
            }
        }

        if versions.is_empty() {
            versions.push(VersionInfo {
                version: "latest".into(),
                release_date: None,
                deprecated: false,
                yanked: false,
            });
        }

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description,
            homepage,
            license,
            repository: None,
            versions,
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        // Try Docker Hub API first for remote tags
        if let Ok(versions) = self.fetch_hub_tags(name).await {
            if !versions.is_empty() {
                return Ok(versions);
            }
        }

        // Fall back to local image tags
        let out = self
            .run_podman(&["image", "inspect", name, "--format", "{{json .RepoTags}}"])
            .await;

        if let Ok(output) = out {
            if let Ok(tags) = serde_json::from_str::<Vec<String>>(output.trim()) {
                let versions: Vec<VersionInfo> = tags
                    .iter()
                    .filter_map(|tag| {
                        let version = tag.split(':').next_back()?;
                        Some(VersionInfo {
                            version: version.into(),
                            release_date: None,
                            deprecated: false,
                            yanked: false,
                        })
                    })
                    .collect();
                if !versions.is_empty() {
                    return Ok(versions);
                }
            }
        }

        Ok(vec![VersionInfo {
            version: "latest".into(),
            release_date: None,
            deprecated: false,
            yanked: false,
        }])
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let image = Self::format_image(&req.name, req.version.as_deref());

        self.run_podman(&["pull", &image]).await?;

        let actual_version = req.version.unwrap_or_else(|| "latest".into());

        Ok(InstallReceipt {
            name: req.name,
            version: actual_version,
            provider: self.id().into(),
            install_path: PathBuf::new(),
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let image = if let Some(v) = &req.version {
            format!("{}:{}", req.name, v)
        } else {
            req.name.clone()
        };

        let mut args = vec!["rmi"];
        if req.force {
            args.push("--force");
        }
        args.push(&image);

        self.run_podman(&args).await?;
        Ok(())
    }

    async fn get_installed_version(&self, name: &str) -> CogniaResult<Option<String>> {
        let filter_arg = format!("reference={}", name);
        let out = self
            .run_podman(&[
                "images",
                "--format",
                "{{.Repository}}:{{.Tag}}",
                "--filter",
                &filter_arg,
            ])
            .await;

        match out {
            Ok(output) => {
                for line in output.lines() {
                    let line = line.trim();
                    if line.is_empty() || line.contains("<none>") {
                        continue;
                    }
                    if let Some(tag) = line.split(':').next_back() {
                        return Ok(Some(tag.to_string()));
                    }
                }
                Ok(None)
            }
            Err(_) => Ok(None),
        }
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self
            .run_podman(&["images", "--format", "{{json .}}"])
            .await?;

        let packages: Vec<InstalledPackage> = out
            .lines()
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let json: serde_json::Value = serde_json::from_str(line).ok()?;
                // Podman uses "repository" (lowercase) in some versions, "Repository" in others
                let repo = json["Repository"]
                    .as_str()
                    .or_else(|| json["repository"].as_str())?;
                let tag = json["Tag"]
                    .as_str()
                    .or_else(|| json["tag"].as_str())
                    .unwrap_or("latest");

                if repo == "<none>" || tag == "<none>" {
                    return None;
                }

                // Normalize: strip docker.io/library/ prefix
                let name = Self::normalize_image_name(repo).to_string();

                if let Some(ref name_filter) = filter.name_filter {
                    if !name.to_lowercase().contains(&name_filter.to_lowercase()) {
                        return None;
                    }
                }

                let created = json["CreatedAt"]
                    .as_str()
                    .or_else(|| json["created"].as_str())
                    .or_else(|| json["CreatedSince"].as_str())
                    .unwrap_or("")
                    .to_string();

                Some(InstalledPackage {
                    name,
                    version: tag.into(),
                    provider: self.id().into(),
                    install_path: PathBuf::new(),
                    installed_at: created,
                    is_global: true,
                })
            })
            .collect();

        Ok(packages)
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let mut updates = Vec::new();

        let images: Vec<String> = if packages.is_empty() {
            let out = self
                .run_podman(&[
                    "images",
                    "--format",
                    "{{.Repository}}:{{.Tag}}",
                    "--filter",
                    "dangling=false",
                ])
                .await?;
            out.lines()
                .filter(|l| !l.contains("<none>") && !l.trim().is_empty())
                .map(|s| s.trim().to_string())
                .collect()
        } else {
            packages.to_vec()
        };

        // Use `podman manifest inspect` to compare digests without pulling
        for image in images.iter().take(20) {
            let parts: Vec<&str> = image.splitn(2, ':').collect();
            let name = Self::normalize_image_name(parts[0]);
            let current_tag = parts.get(1).copied().unwrap_or("latest");

            let local_digest = self.get_local_digest(image).await;

            let manifest_opts = ProcessOptions::new().with_timeout(Duration::from_secs(30));
            let remote_check = process::execute(
                "podman",
                &["manifest", "inspect", image],
                Some(manifest_opts),
            )
            .await;

            if let Ok(remote_out) = remote_check {
                if remote_out.success {
                    if let Ok(manifest) =
                        serde_json::from_str::<serde_json::Value>(&remote_out.stdout)
                    {
                        let remote_digest =
                            manifest["config"]["digest"].as_str().map(|s| s.to_string());

                        let has_update = match (&local_digest, &remote_digest) {
                            (Some(local), Some(remote)) => local != remote,
                            (None, Some(_)) => true,
                            _ => false,
                        };

                        if has_update {
                            updates.push(UpdateInfo {
                                name: name.into(),
                                current_version: current_tag.to_string(),
                                latest_version: format!("{} (new digest available)", current_tag),
                                provider: self.id().into(),
                            });
                        }
                    }
                }
            }
        }

        Ok(updates)
    }
}

#[async_trait]
impl SystemPackageProvider for PodmanProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        // Podman is rootless by default - no elevation needed
        false
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self
            .run_podman(&["version", "--format", "{{.Client.Version}}"])
            .await?;
        Ok(out.trim().to_string())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("podman")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("podman not found in PATH".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some(
            "Install Podman: https://podman.io/docs/installation \
             or use your system package manager (e.g. sudo apt install podman, brew install podman)"
                .into(),
        )
    }

    async fn update_index(&self) -> CogniaResult<()> {
        Ok(())
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        self.run_podman(&["pull", name]).await?;
        Ok(())
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        let out = self
            .run_podman(&[
                "images",
                "--format",
                "{{.Repository}}:{{.Tag}}",
                "--filter",
                "dangling=false",
            ])
            .await?;

        let mut upgraded = Vec::new();
        for image in out
            .lines()
            .filter(|l| !l.contains("<none>") && !l.trim().is_empty())
        {
            if self.run_podman(&["pull", image.trim()]).await.is_ok() {
                upgraded.push(image.trim().to_string());
            }
        }

        Ok(upgraded)
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let filter_arg = format!("reference={}", name);
        let out = self
            .run_podman(&[
                "images",
                "--format",
                "{{.Repository}}",
                "--filter",
                &filter_arg,
            ])
            .await;
        Ok(out
            .map(|s| s.lines().any(|l| !l.trim().is_empty()))
            .unwrap_or(false))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_hub_image_simple() {
        let result = PodmanProvider::parse_hub_image("nginx");
        assert_eq!(result, Some(("library".into(), "nginx".into())));
    }

    #[test]
    fn test_parse_hub_image_with_docker_prefix() {
        let result = PodmanProvider::parse_hub_image("docker.io/library/nginx");
        assert_eq!(result, Some(("library".into(), "nginx".into())));
    }

    #[test]
    fn test_parse_hub_image_user_with_docker_prefix() {
        let result = PodmanProvider::parse_hub_image("docker.io/myuser/myapp");
        assert_eq!(result, Some(("myuser".into(), "myapp".into())));
    }

    #[test]
    fn test_parse_hub_image_with_tag() {
        let result = PodmanProvider::parse_hub_image("nginx:1.25");
        assert_eq!(result, Some(("library".into(), "nginx".into())));
    }

    #[test]
    fn test_parse_hub_image_user_repo() {
        let result = PodmanProvider::parse_hub_image("myuser/myapp");
        assert_eq!(result, Some(("myuser".into(), "myapp".into())));
    }

    #[test]
    fn test_parse_hub_image_custom_registry() {
        let result = PodmanProvider::parse_hub_image("ghcr.io/owner/repo");
        assert_eq!(result, None);
    }

    #[test]
    fn test_parse_hub_image_quay() {
        let result = PodmanProvider::parse_hub_image("quay.io/podman/hello");
        assert_eq!(result, None);
    }

    #[test]
    fn test_normalize_image_name() {
        assert_eq!(
            PodmanProvider::normalize_image_name("docker.io/library/nginx"),
            "nginx"
        );
        assert_eq!(
            PodmanProvider::normalize_image_name("docker.io/myuser/myapp"),
            "myuser/myapp"
        );
        assert_eq!(PodmanProvider::normalize_image_name("nginx"), "nginx");
        assert_eq!(
            PodmanProvider::normalize_image_name("ghcr.io/owner/repo"),
            "ghcr.io/owner/repo"
        );
    }

    #[test]
    fn test_format_image() {
        assert_eq!(
            PodmanProvider::format_image("nginx", Some("1.25")),
            "nginx:1.25"
        );
        assert_eq!(PodmanProvider::format_image("nginx", None), "nginx:latest");
    }

    #[test]
    fn test_capabilities() {
        let provider = PodmanProvider::new();
        let caps = provider.capabilities();
        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
        assert!(caps.contains(&Capability::Update));
        assert!(caps.contains(&Capability::Upgrade));
    }

    #[test]
    fn test_provider_metadata() {
        let provider = PodmanProvider::new();
        assert_eq!(provider.id(), "podman");
        assert_eq!(provider.display_name(), "Podman (Daemonless Containers)");
        assert_eq!(provider.priority(), 58);
        assert!(provider.supported_platforms().contains(&Platform::Windows));
        assert!(provider.supported_platforms().contains(&Platform::MacOS));
        assert!(provider.supported_platforms().contains(&Platform::Linux));
    }

    #[test]
    fn test_requires_no_elevation() {
        let provider = PodmanProvider::new();
        // Podman is rootless by default
        assert!(!provider.requires_elevation("install"));
        assert!(!provider.requires_elevation("uninstall"));
    }
}
