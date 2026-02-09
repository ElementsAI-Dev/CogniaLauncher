//! GitLab repository commands for download integration

use crate::download::DownloadTask;
use crate::provider::gitlab::{
    GitLabBranch, GitLabProvider, GitLabRelease, GitLabReleaseLink, GitLabTag,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::State;

use super::download::SharedDownloadManager;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabBranchInfo {
    pub name: String,
    pub commit_id: String,
    pub protected: bool,
    pub default: bool,
}

impl From<GitLabBranch> for GitLabBranchInfo {
    fn from(b: GitLabBranch) -> Self {
        Self {
            name: b.name,
            commit_id: b.commit.id,
            protected: b.protected,
            default: b.default,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabTagInfo {
    pub name: String,
    pub commit_id: String,
    pub message: Option<String>,
    pub protected: bool,
}

impl From<GitLabTag> for GitLabTagInfo {
    fn from(t: GitLabTag) -> Self {
        Self {
            name: t.name,
            commit_id: t.commit.id,
            message: t.message,
            protected: t.protected.unwrap_or(false),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabReleaseInfo {
    pub tag_name: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub created_at: Option<String>,
    pub released_at: Option<String>,
    pub upcoming_release: bool,
    pub assets: Vec<GitLabAssetInfo>,
    pub sources: Vec<GitLabSourceInfo>,
}

impl From<GitLabRelease> for GitLabReleaseInfo {
    fn from(r: GitLabRelease) -> Self {
        Self {
            tag_name: r.tag_name,
            name: r.name,
            description: r.description,
            created_at: r.created_at,
            released_at: r.released_at,
            upcoming_release: r.upcoming_release.unwrap_or(false),
            assets: r.assets.links.into_iter().map(GitLabAssetInfo::from).collect(),
            sources: r
                .assets
                .sources
                .unwrap_or_default()
                .into_iter()
                .map(GitLabSourceInfo::from)
                .collect(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabAssetInfo {
    pub id: u64,
    pub name: String,
    pub url: String,
    pub direct_asset_url: Option<String>,
    pub link_type: Option<String>,
}

impl From<GitLabReleaseLink> for GitLabAssetInfo {
    fn from(a: GitLabReleaseLink) -> Self {
        Self {
            id: a.id,
            name: a.name,
            url: a.url,
            direct_asset_url: a.direct_asset_url,
            link_type: a.link_type,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabSourceInfo {
    pub format: String,
    pub url: String,
}

impl From<crate::provider::gitlab::GitLabReleaseSource> for GitLabSourceInfo {
    fn from(s: crate::provider::gitlab::GitLabReleaseSource) -> Self {
        Self {
            format: s.format,
            url: s.url,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabParsedProject {
    pub owner: String,
    pub repo: String,
    pub full_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabProjectInfo {
    pub id: u64,
    pub name: String,
    pub full_name: String,
    pub description: Option<String>,
    pub web_url: String,
    pub default_branch: Option<String>,
    pub star_count: u64,
    pub forks_count: u64,
    pub archived: bool,
    pub topics: Vec<String>,
}

#[tauri::command]
pub async fn gitlab_parse_url(url: String) -> Result<Option<GitLabParsedProject>, String> {
    Ok(
        GitLabProvider::parse_project_url(&url).map(|(owner, repo)| GitLabParsedProject {
            full_name: format!("{}/{}", owner, repo),
            owner,
            repo,
        }),
    )
}

/// Helper to create a GitLabProvider with optional token and instance URL
fn make_gitlab_provider(token: Option<String>, instance_url: Option<String>) -> GitLabProvider {
    GitLabProvider::new()
        .with_token(token)
        .with_instance_url(instance_url)
}

#[tauri::command]
pub async fn gitlab_validate_project(
    project: String,
    token: Option<String>,
    instance_url: Option<String>,
) -> Result<bool, String> {
    let provider = make_gitlab_provider(token, instance_url);
    Ok(provider.validate_project(&project).await)
}

#[tauri::command]
pub async fn gitlab_get_project_info(
    project: String,
    token: Option<String>,
    instance_url: Option<String>,
) -> Result<GitLabProjectInfo, String> {
    let provider = make_gitlab_provider(token, instance_url);
    let info = provider
        .get_project_info(&project)
        .await
        .map_err(|e| e.to_string())?;
    Ok(GitLabProjectInfo {
        id: info.id,
        name: info.name,
        full_name: info.path_with_namespace,
        description: info.description,
        web_url: info.web_url,
        default_branch: info.default_branch,
        star_count: info.star_count.unwrap_or(0),
        forks_count: info.forks_count.unwrap_or(0),
        archived: info.archived.unwrap_or(false),
        topics: info.topics.unwrap_or_default(),
    })
}

#[tauri::command]
pub async fn gitlab_list_branches(
    project: String,
    token: Option<String>,
    instance_url: Option<String>,
) -> Result<Vec<GitLabBranchInfo>, String> {
    let provider = make_gitlab_provider(token, instance_url);
    provider
        .list_branches(&project)
        .await
        .map(|branches| branches.into_iter().map(GitLabBranchInfo::from).collect())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn gitlab_list_tags(
    project: String,
    token: Option<String>,
    instance_url: Option<String>,
) -> Result<Vec<GitLabTagInfo>, String> {
    let provider = make_gitlab_provider(token, instance_url);
    provider
        .list_tags(&project)
        .await
        .map(|tags| tags.into_iter().map(GitLabTagInfo::from).collect())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn gitlab_list_releases(
    project: String,
    token: Option<String>,
    instance_url: Option<String>,
) -> Result<Vec<GitLabReleaseInfo>, String> {
    let provider = make_gitlab_provider(token, instance_url);
    provider
        .list_releases(&project)
        .await
        .map(|releases| releases.into_iter().map(GitLabReleaseInfo::from).collect())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn gitlab_get_release_assets(
    project: String,
    tag: String,
    token: Option<String>,
    instance_url: Option<String>,
) -> Result<Vec<GitLabAssetInfo>, String> {
    let provider = make_gitlab_provider(token, instance_url);
    provider
        .get_release_by_tag(&project, &tag)
        .await
        .map(|release| {
            release
                .assets
                .links
                .into_iter()
                .map(GitLabAssetInfo::from)
                .collect()
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn gitlab_download_asset(
    project: String,
    asset_url: String,
    asset_name: String,
    destination: String,
    token: Option<String>,
    instance_url: Option<String>,
    manager: State<'_, SharedDownloadManager>,
) -> Result<String, String> {
    let provider = make_gitlab_provider(token, instance_url);
    let dest_path = PathBuf::from(&destination);
    let full_path = dest_path.join(&asset_name);

    let headers = provider.get_download_headers();
    let task = DownloadTask::builder(asset_url, full_path, asset_name)
        .with_provider(format!("gitlab:{}", project))
        .with_headers(headers)
        .build();

    let mgr = manager.read().await;
    Ok(mgr.add_task(task).await)
}

#[tauri::command]
pub async fn gitlab_download_source(
    project: String,
    ref_name: String,
    format: String,
    destination: String,
    token: Option<String>,
    instance_url: Option<String>,
    manager: State<'_, SharedDownloadManager>,
) -> Result<String, String> {
    let provider = make_gitlab_provider(token, instance_url);
    let url = provider.get_source_archive_url(&project, &ref_name, &format);

    let ext = match format.as_str() {
        "tar.gz" => "tar.gz",
        "tar.bz2" => "tar.bz2",
        "tar" => "tar",
        _ => "zip",
    };
    let file_name = format!(
        "{}-{}.{}",
        project.replace('/', "-"),
        ref_name.replace('/', "-"),
        ext
    );

    let dest_path = PathBuf::from(&destination);
    let full_path = dest_path.join(&file_name);

    let headers = provider.get_download_headers();
    let task = DownloadTask::builder(url, full_path, file_name)
        .with_provider(format!("gitlab:{}", project))
        .with_headers(headers)
        .build();

    let mgr = manager.read().await;
    Ok(mgr.add_task(task).await)
}

#[tauri::command]
pub async fn gitlab_set_token(token: String) -> Result<(), String> {
    let mut settings = crate::config::Settings::load().await.map_err(|e| e.to_string())?;
    settings
        .set_value("providers.gitlab.token", &token)
        .map_err(|e| e.to_string())?;
    settings.save().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn gitlab_get_token() -> Result<Option<String>, String> {
    let settings = crate::config::Settings::load().await.map_err(|e| e.to_string())?;
    Ok(settings.get_value("providers.gitlab.token")
        .or_else(|| std::env::var("GITLAB_TOKEN").ok()))
}

#[tauri::command]
pub async fn gitlab_clear_token() -> Result<(), String> {
    let mut settings = crate::config::Settings::load().await.map_err(|e| e.to_string())?;
    settings
        .set_value("providers.gitlab.token", "")
        .map_err(|e| e.to_string())?;
    settings.save().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn gitlab_validate_token(
    token: String,
    instance_url: Option<String>,
) -> Result<bool, String> {
    let provider = GitLabProvider::new()
        .with_token(Some(token))
        .with_instance_url(instance_url);
    Ok(provider.validate_token().await)
}

#[tauri::command]
pub async fn gitlab_set_instance_url(url: String) -> Result<(), String> {
    let mut settings = crate::config::Settings::load().await.map_err(|e| e.to_string())?;
    settings
        .set_value("providers.gitlab.url", &url)
        .map_err(|e| e.to_string())?;
    settings.save().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn gitlab_get_instance_url() -> Result<Option<String>, String> {
    let settings = crate::config::Settings::load().await.map_err(|e| e.to_string())?;
    Ok(settings.get_value("providers.gitlab.url"))
}
