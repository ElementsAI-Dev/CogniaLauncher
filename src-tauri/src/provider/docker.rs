use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{env::Platform, process};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::PathBuf;

pub struct DockerProvider;

impl DockerProvider {
    pub fn new() -> Self {
        Self
    }

    async fn run_docker(&self, args: &[&str]) -> CogniaResult<String> {
        let out = process::execute("docker", args, None).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }
}

impl Default for DockerProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for DockerProvider {
    fn id(&self) -> &str {
        "docker"
    }
    fn display_name(&self) -> &str {
        "Docker (Container Images)"
    }
    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
            Capability::Update,
        ])
    }
    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }
    fn priority(&self) -> i32 {
        60
    }

    async fn is_available(&self) -> bool {
        if process::which("docker").await.is_none() {
            return false;
        }
        // Verify docker daemon is running
        match process::execute("docker", &["info"], None).await {
            Ok(output) => output.success,
            Err(_) => false,
        }
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let limit = options.limit.unwrap_or(20).to_string();
        let out = self
            .run_docker(&["search", query, "--limit", &limit, "--format", "{{json .}}"])
            .await?;

        let packages: Vec<PackageSummary> = out
            .lines()
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                    Some(PackageSummary {
                        name: json["Name"].as_str()?.into(),
                        description: json["Description"].as_str().map(|s| s.into()),
                        latest_version: Some("latest".into()),
                        provider: self.id().into(),
                    })
                } else {
                    None
                }
            })
            .collect();

        Ok(packages)
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        // Try to inspect the image if it's local
        let out = self
            .run_docker(&["image", "inspect", name, "--format", "{{json .}}"])
            .await;

        let (description, versions) = if let Ok(output) = out {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&output) {
                let tags = json[0]["RepoTags"]
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

                (json[0]["Comment"].as_str().map(|s| s.to_string()), tags)
            } else {
                (
                    None,
                    vec![VersionInfo {
                        version: "latest".into(),
                        release_date: None,
                        deprecated: false,
                        yanked: false,
                    }],
                )
            }
        } else {
            (
                None,
                vec![VersionInfo {
                    version: "latest".into(),
                    release_date: None,
                    deprecated: false,
                    yanked: false,
                }],
            )
        };

        let homepage = if name.contains('/') {
            format!("https://hub.docker.com/r/{}", name)
        } else {
            format!("https://hub.docker.com/_/{}", name)
        };

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description,
            homepage: Some(homepage),
            license: None,
            repository: None,
            versions,
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        // Get tags from local image if available
        let out = self
            .run_docker(&["image", "inspect", name, "--format", "{{json .RepoTags}}"])
            .await;

        if let Ok(output) = out {
            if let Ok(tags) = serde_json::from_str::<Vec<String>>(&output) {
                return Ok(tags
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
                    .collect());
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
        let image = if let Some(v) = &req.version {
            format!("{}:{}", req.name, v)
        } else {
            format!("{}:latest", req.name)
        };

        self.run_docker(&["pull", &image]).await?;

        Ok(InstallReceipt {
            name: req.name,
            version: req.version.unwrap_or_else(|| "latest".into()),
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

        self.run_docker(&["rmi", &image]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self
            .run_docker(&["images", "--format", "{{json .}}"])
            .await?;

        let packages: Vec<InstalledPackage> = out
            .lines()
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let json: serde_json::Value = serde_json::from_str(line).ok()?;
                let repo = json["Repository"].as_str()?;
                let tag = json["Tag"].as_str().unwrap_or("latest");
                let name = repo.to_string();

                if let Some(name_filter) = &filter.name_filter {
                    if !name.contains(name_filter) {
                        return None;
                    }
                }

                let created = json["CreatedAt"].as_str().unwrap_or("").to_string();
                let _size = json["Size"].as_str().unwrap_or("").to_string();

                // Docker images are stored in the Docker data directory
                let docker_data = if cfg!(windows) {
                    PathBuf::from("C:\\ProgramData\\Docker\\windowsfilter")
                } else if cfg!(target_os = "macos") {
                    PathBuf::from("/var/lib/docker/image")
                } else {
                    PathBuf::from("/var/lib/docker/image")
                };

                Some(InstalledPackage {
                    name: name.clone(),
                    version: tag.into(),
                    provider: self.id().into(),
                    install_path: docker_data.join(&name),
                    installed_at: created,
                    is_global: true,
                })
            })
            .collect();

        Ok(packages)
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let mut updates = Vec::new();

        // Get list of images to check
        let images: Vec<String> = if packages.is_empty() {
            let out = self
                .run_docker(&["images", "--format", "{{.Repository}}:{{.Tag}}"])
                .await?;
            out.lines().map(|s| s.to_string()).collect()
        } else {
            packages.to_vec()
        };

        for image in images.iter().take(10) {
            // Limit to 10 to avoid too many requests
            // Try to pull and see if there's a newer version
            let parts: Vec<&str> = image.split(':').collect();
            let name = parts[0];
            let current_tag = parts.get(1).unwrap_or(&"latest");

            // Get current image ID
            let current_id = self.run_docker(&["images", "-q", image]).await.ok();

            // Pull latest
            if (self.run_docker(&["pull", image]).await).is_ok() {
                // Get new image ID
                if let Ok(new_id) = self.run_docker(&["images", "-q", image]).await {
                    if let Some(old_id) = current_id {
                        if old_id.trim() != new_id.trim() && !new_id.is_empty() {
                            updates.push(UpdateInfo {
                                name: name.into(),
                                current_version: current_tag.to_string(),
                                latest_version: format!("{} (updated)", current_tag),
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
impl SystemPackageProvider for DockerProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        // Check if Docker daemon is running
        if self.is_available().await {
            return Ok(self.run_docker(&["info"]).await.is_ok());
        }
        Ok(false)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        // Docker typically requires elevated permissions or docker group membership
        cfg!(target_os = "linux")
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = self
            .run_docker(&["images", "--format", "{{.Repository}}"])
            .await;
        Ok(out
            .map(|s| {
                s.lines()
                    .any(|l| l == name || l.starts_with(&format!("{}:", name)))
            })
            .unwrap_or(false))
    }
}
