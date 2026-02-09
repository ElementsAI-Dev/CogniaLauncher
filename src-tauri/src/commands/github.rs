//! GitHub repository commands for download integration

use crate::download::DownloadTask;
use crate::platform::disk::format_size;
use crate::provider::github::{
    GitHubAsset, GitHubBranch, GitHubProvider, GitHubRelease, GitHubTag,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::State;

use super::download::SharedDownloadManager;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchInfo {
    pub name: String,
    pub commit_sha: String,
    pub protected: bool,
}

impl From<GitHubBranch> for BranchInfo {
    fn from(b: GitHubBranch) -> Self {
        Self {
            name: b.name,
            commit_sha: b.commit.sha,
            protected: b.protected,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagInfo {
    pub name: String,
    pub commit_sha: String,
    pub zipball_url: Option<String>,
    pub tarball_url: Option<String>,
}

impl From<GitHubTag> for TagInfo {
    fn from(t: GitHubTag) -> Self {
        Self {
            name: t.name,
            commit_sha: t.commit.sha,
            zipball_url: t.zipball_url,
            tarball_url: t.tarball_url,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseInfo {
    pub id: u64,
    pub tag_name: String,
    pub name: Option<String>,
    pub body: Option<String>,
    pub published_at: Option<String>,
    pub prerelease: bool,
    pub draft: bool,
    pub assets: Vec<AssetInfo>,
}

impl From<GitHubRelease> for ReleaseInfo {
    fn from(r: GitHubRelease) -> Self {
        Self {
            id: r.id,
            tag_name: r.tag_name,
            name: r.name,
            body: r.body,
            published_at: r.published_at,
            prerelease: r.prerelease,
            draft: r.draft,
            assets: r.assets.into_iter().map(AssetInfo::from).collect(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetInfo {
    pub id: u64,
    pub name: String,
    pub size: u64,
    pub size_human: String,
    pub download_url: String,
    pub content_type: Option<String>,
    pub download_count: Option<u64>,
}

impl From<GitHubAsset> for AssetInfo {
    fn from(a: GitHubAsset) -> Self {
        Self {
            id: a.id,
            name: a.name.clone(),
            size: a.size,
            size_human: format_size(a.size),
            download_url: a.browser_download_url,
            content_type: a.content_type,
            download_count: a.download_count,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedRepo {
    pub owner: String,
    pub repo: String,
    pub full_name: String,
}

#[tauri::command]
pub async fn github_parse_url(url: String) -> Result<Option<ParsedRepo>, String> {
    Ok(GitHubProvider::parse_repo_url(&url).map(|(owner, repo)| ParsedRepo {
        full_name: format!("{}/{}", owner, repo),
        owner,
        repo,
    }))
}

/// Helper to create a GitHubProvider with an optional token
fn make_github_provider(token: Option<String>) -> GitHubProvider {
    GitHubProvider::new().with_token(token)
}

#[tauri::command]
pub async fn github_validate_repo(repo: String, token: Option<String>) -> Result<bool, String> {
    let provider = make_github_provider(token);
    Ok(provider.validate_repo(&repo).await)
}

#[tauri::command]
pub async fn github_list_branches(repo: String, token: Option<String>) -> Result<Vec<BranchInfo>, String> {
    let provider = make_github_provider(token);
    provider
        .list_branches(&repo)
        .await
        .map(|branches| branches.into_iter().map(BranchInfo::from).collect())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn github_list_tags(repo: String, token: Option<String>) -> Result<Vec<TagInfo>, String> {
    let provider = make_github_provider(token);
    provider
        .list_tags(&repo)
        .await
        .map(|tags| tags.into_iter().map(TagInfo::from).collect())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn github_list_releases(repo: String, token: Option<String>) -> Result<Vec<ReleaseInfo>, String> {
    let provider = make_github_provider(token);
    provider
        .list_releases(&repo)
        .await
        .map(|releases| releases.into_iter().map(ReleaseInfo::from).collect())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn github_get_release_assets(
    repo: String,
    tag: String,
    token: Option<String>,
) -> Result<Vec<AssetInfo>, String> {
    let provider = make_github_provider(token);
    provider
        .get_release_by_tag(&repo, &tag)
        .await
        .map(|release| release.assets.into_iter().map(AssetInfo::from).collect())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn github_download_asset(
    repo: String,
    asset_id: u64,
    asset_url: String,
    asset_name: String,
    destination: String,
    token: Option<String>,
    manager: State<'_, SharedDownloadManager>,
) -> Result<String, String> {
    let provider = make_github_provider(token);
    let dest_path = PathBuf::from(&destination);
    let full_path = dest_path.join(&asset_name);

    // For authenticated requests, use the API URL for asset downloads
    let download_url = if provider.has_token() {
        provider.get_asset_api_download_url(&repo, asset_id)
    } else {
        asset_url
    };

    let headers = provider.get_download_headers();
    let task = DownloadTask::builder(download_url, full_path, asset_name)
        .with_provider(format!("github:{}", repo))
        .with_headers(headers)
        .build();

    let mgr = manager.read().await;
    Ok(mgr.add_task(task).await)
}

#[tauri::command]
pub async fn github_download_source(
    repo: String,
    ref_name: String,
    format: String,
    destination: String,
    token: Option<String>,
    manager: State<'_, SharedDownloadManager>,
) -> Result<String, String> {
    let provider = make_github_provider(token);
    let url = provider.get_source_archive_url(&repo, &ref_name, &format);

    let ext = if format == "tar.gz" { "tar.gz" } else { "zip" };
    let file_name = format!(
        "{}-{}.{}",
        repo.replace('/', "-"),
        ref_name.replace('/', "-"),
        ext
    );

    let dest_path = PathBuf::from(&destination);
    let full_path = dest_path.join(&file_name);

    let headers = provider.get_source_download_headers();
    let task = DownloadTask::builder(url, full_path, file_name)
        .with_provider(format!("github:{}", repo))
        .with_headers(headers)
        .build();

    let mgr = manager.read().await;
    Ok(mgr.add_task(task).await)
}

#[tauri::command]
pub async fn github_set_token(token: String) -> Result<(), String> {
    let mut settings = crate::config::Settings::load().await.map_err(|e| e.to_string())?;
    settings
        .set_value("providers.github.token", &token)
        .map_err(|e| e.to_string())?;
    settings.save().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn github_get_token() -> Result<Option<String>, String> {
    let settings = crate::config::Settings::load().await.map_err(|e| e.to_string())?;
    Ok(settings.get_value("providers.github.token")
        .or_else(|| std::env::var("GITHUB_TOKEN").ok()))
}

#[tauri::command]
pub async fn github_clear_token() -> Result<(), String> {
    let mut settings = crate::config::Settings::load().await.map_err(|e| e.to_string())?;
    settings
        .set_value("providers.github.token", "")
        .map_err(|e| e.to_string())?;
    settings.save().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn github_validate_token(token: String) -> Result<bool, String> {
    let provider = GitHubProvider::new().with_token(Some(token));
    Ok(provider.validate_token().await)
}

