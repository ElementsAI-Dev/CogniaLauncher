//! GitHub repository commands for download integration

use crate::commands::secrets::{
    provider_secret_clear_internal, provider_secret_save_internal, provider_secret_status_internal,
    resolve_provider_secret, ProviderSecretStatus,
};
use crate::platform::disk::format_size;
use crate::provider::github::{
    GitHubAsset, GitHubBranch, GitHubProvider, GitHubRelease, GitHubTag,
};
use crate::SharedSecretVault;
use serde::{Deserialize, Serialize};
use tauri::State;

use super::download::{download_add, DownloadRequest, SharedDownloadManager, SharedSettings};

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
    Ok(
        GitHubProvider::parse_repo_url(&url).map(|(owner, repo)| ParsedRepo {
            full_name: format!("{}/{}", owner, repo),
            owner,
            repo,
        }),
    )
}

/// Helper to create a GitHubProvider with an optional explicit token.
/// Resolution order: explicit input, unlocked secure storage, then env var fallback.
async fn make_github_provider(
    token: Option<String>,
    vault: &State<'_, SharedSecretVault>,
) -> GitHubProvider {
    let settings = crate::config::Settings::load().await.unwrap_or_default();
    let effective_token = {
        let vault_guard = vault.read().await;
        resolve_provider_secret("github", token, &settings, &vault_guard)
    };
    GitHubProvider::new().with_token(effective_token)
}

fn build_github_download_request(
    url: String,
    destination: &str,
    file_name: String,
    provider: String,
    headers: std::collections::HashMap<String, String>,
) -> DownloadRequest {
    let full_path = std::path::PathBuf::from(destination)
        .join(&file_name)
        .display()
        .to_string();
    DownloadRequest {
        url,
        destination: full_path,
        name: file_name,
        checksum: None,
        priority: None,
        provider: Some(provider),
        headers: if headers.is_empty() {
            None
        } else {
            Some(headers)
        },
        auto_extract: None,
        extract_dest: None,
        segments: None,
        mirror_urls: None,
        post_action: None,
        delete_after_extract: None,
        auto_rename: None,
        tags: None,
    }
}

#[tauri::command]
pub async fn github_validate_repo(
    repo: String,
    token: Option<String>,
    vault: State<'_, SharedSecretVault>,
) -> Result<bool, String> {
    let provider = make_github_provider(token, &vault).await;
    Ok(provider.validate_repo(&repo).await)
}

#[tauri::command]
pub async fn github_list_branches(
    repo: String,
    token: Option<String>,
    vault: State<'_, SharedSecretVault>,
) -> Result<Vec<BranchInfo>, String> {
    let provider = make_github_provider(token, &vault).await;
    provider
        .list_branches(&repo)
        .await
        .map(|branches| branches.into_iter().map(BranchInfo::from).collect())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn github_list_tags(
    repo: String,
    token: Option<String>,
    vault: State<'_, SharedSecretVault>,
) -> Result<Vec<TagInfo>, String> {
    let provider = make_github_provider(token, &vault).await;
    provider
        .list_tags(&repo)
        .await
        .map(|tags| tags.into_iter().map(TagInfo::from).collect())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn github_list_releases(
    repo: String,
    token: Option<String>,
    vault: State<'_, SharedSecretVault>,
) -> Result<Vec<ReleaseInfo>, String> {
    let provider = make_github_provider(token, &vault).await;
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
    vault: State<'_, SharedSecretVault>,
) -> Result<Vec<AssetInfo>, String> {
    let provider = make_github_provider(token, &vault).await;
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
    vault: State<'_, SharedSecretVault>,
    manager: State<'_, SharedDownloadManager>,
    settings: State<'_, SharedSettings>,
) -> Result<String, String> {
    let provider = make_github_provider(token, &vault).await;

    // For authenticated requests, use the API URL for asset downloads
    let download_url = if provider.has_token() {
        provider.get_asset_api_download_url(&repo, asset_id)
    } else {
        asset_url
    };

    let headers = provider.get_download_headers();
    let request = build_github_download_request(
        download_url,
        &destination,
        asset_name,
        format!("github:{}", repo),
        headers,
    );
    download_add(request, manager, settings).await
}

#[tauri::command]
pub async fn github_download_source(
    repo: String,
    ref_name: String,
    format: String,
    destination: String,
    token: Option<String>,
    vault: State<'_, SharedSecretVault>,
    manager: State<'_, SharedDownloadManager>,
    settings: State<'_, SharedSettings>,
) -> Result<String, String> {
    let provider = make_github_provider(token, &vault).await;
    let url = provider.get_source_archive_url(&repo, &ref_name, &format);

    let ext = if format == "tar.gz" { "tar.gz" } else { "zip" };
    let file_name = format!(
        "{}-{}.{}",
        repo.replace('/', "-"),
        ref_name.replace('/', "-"),
        ext
    );

    let headers = provider.get_source_download_headers();
    let request = build_github_download_request(
        url,
        &destination,
        file_name,
        format!("github:{}", repo),
        headers,
    );
    download_add(request, manager, settings).await
}

#[tauri::command]
pub async fn github_set_token(
    token: String,
    settings: State<'_, crate::SharedSettings>,
    vault: State<'_, SharedSecretVault>,
) -> Result<ProviderSecretStatus, String> {
    provider_secret_save_internal("github", token, &settings, &vault).await
}

#[tauri::command]
pub async fn github_get_token(
    settings: State<'_, crate::SharedSettings>,
    vault: State<'_, SharedSecretVault>,
) -> Result<ProviderSecretStatus, String> {
    provider_secret_status_internal("github", &settings, &vault).await
}

#[tauri::command]
pub async fn github_clear_token(
    settings: State<'_, crate::SharedSettings>,
    vault: State<'_, SharedSecretVault>,
) -> Result<ProviderSecretStatus, String> {
    provider_secret_clear_internal("github", &settings, &vault).await
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoInfoResponse {
    pub full_name: String,
    pub description: Option<String>,
    pub homepage: Option<String>,
    pub license: Option<String>,
    pub stargazers_count: u64,
    pub forks_count: u64,
    pub open_issues_count: u64,
    pub default_branch: Option<String>,
    pub archived: bool,
    pub disabled: bool,
    pub topics: Vec<String>,
}

#[tauri::command]
pub async fn github_get_repo_info(
    repo: String,
    token: Option<String>,
    vault: State<'_, SharedSecretVault>,
) -> Result<RepoInfoResponse, String> {
    let provider = make_github_provider(token, &vault).await;
    let info = provider
        .get_repo_info(&repo)
        .await
        .map_err(|e| e.to_string())?;
    Ok(RepoInfoResponse {
        full_name: info.full_name,
        description: info.description,
        homepage: info.homepage,
        license: info.license.map(|l| l.spdx_id),
        stargazers_count: info.stargazers_count.unwrap_or(0),
        forks_count: info.forks_count.unwrap_or(0),
        open_issues_count: info.open_issues_count.unwrap_or(0),
        default_branch: info.default_branch,
        archived: info.archived.unwrap_or(false),
        disabled: info.disabled.unwrap_or(false),
        topics: info.topics.unwrap_or_default(),
    })
}

#[tauri::command]
pub async fn github_validate_token(token: String) -> Result<bool, String> {
    let provider = GitHubProvider::new().with_token(Some(token));
    Ok(provider.validate_token().await)
}

#[cfg(test)]
mod tests {
    use super::build_github_download_request;
    use std::collections::HashMap;

    #[test]
    fn build_request_preserves_provider_headers_and_file_path() {
        let mut headers = HashMap::new();
        headers.insert("Authorization".to_string(), "Bearer token".to_string());
        headers.insert("Accept".to_string(), "application/octet-stream".to_string());

        let request = build_github_download_request(
            "https://api.github.com/repos/a/b/releases/assets/1".to_string(),
            "/tmp/downloads",
            "asset.zip".to_string(),
            "github:a/b".to_string(),
            headers.clone(),
        );

        assert_eq!(
            request.url,
            "https://api.github.com/repos/a/b/releases/assets/1"
        );
        assert_eq!(request.name, "asset.zip");
        assert_eq!(request.provider.as_deref(), Some("github:a/b"));
        assert_eq!(request.headers, Some(headers));
        let destination = std::path::Path::new(&request.destination);
        assert!(destination.ends_with(std::path::Path::new("downloads").join("asset.zip")));
        assert!(request.delete_after_extract.is_none());
        assert!(request.auto_rename.is_none());
        assert!(request.tags.is_none());
    }
}
