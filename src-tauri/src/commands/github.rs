//! GitHub repository commands for download integration

use crate::commands::secrets::{
    provider_secret_clear_internal, provider_secret_save_internal, provider_secret_status_internal,
    resolve_provider_secret, ProviderSecretStatus,
};
use crate::platform::disk::format_size;
use crate::provider::github::{
    GitHubAsset, GitHubBranch, GitHubProvider, GitHubRelease, GitHubTag, GitHubWorkflowArtifact,
};
use crate::SharedSecretVault;
use serde::{Deserialize, Serialize};
use tauri::State;

use super::download::{
    build_download_request_preset, download_add, DownloadRequest, DownloadRequestPreset,
    SharedDownloadManager, SharedSettings,
};

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
pub struct WorkflowArtifactInfo {
    pub id: u64,
    pub name: String,
    pub size_in_bytes: u64,
    pub size_human: String,
    pub archive_download_url: String,
    pub expired: bool,
    pub created_at: Option<String>,
    pub expires_at: Option<String>,
    pub workflow_run_id: Option<u64>,
    pub workflow_run_number: Option<u64>,
    pub workflow_run_branch: Option<String>,
    pub workflow_run_head_sha: Option<String>,
}

impl From<GitHubWorkflowArtifact> for WorkflowArtifactInfo {
    fn from(artifact: GitHubWorkflowArtifact) -> Self {
        Self {
            id: artifact.id,
            name: artifact.name,
            size_in_bytes: artifact.size_in_bytes,
            size_human: format_size(artifact.size_in_bytes),
            archive_download_url: artifact.archive_download_url,
            expired: artifact.expired,
            created_at: artifact.created_at,
            expires_at: artifact.expires_at,
            workflow_run_id: artifact.workflow_run.as_ref().map(|run| run.id),
            workflow_run_number: artifact
                .workflow_run
                .as_ref()
                .and_then(|run| run.run_number),
            workflow_run_branch: artifact
                .workflow_run
                .as_ref()
                .and_then(|run| run.head_branch.clone()),
            workflow_run_head_sha: artifact
                .workflow_run
                .as_ref()
                .and_then(|run| run.head_sha.clone()),
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
    source_descriptor: crate::download::SourceDescriptor,
    artifact_profile: crate::download::ArtifactProfile,
) -> DownloadRequest {
    build_download_request_preset(
        url,
        destination,
        file_name,
        DownloadRequestPreset {
            provider: Some(provider),
            headers: Some(headers),
            install_intent: Some(artifact_profile.install_intent),
            source_descriptor: Some(source_descriptor),
            artifact_profile: Some(artifact_profile),
            ..DownloadRequestPreset::default()
        },
    )
}

fn infer_artifact_profile(
    file_name: &str,
    source_kind: crate::download::SourceKind,
) -> crate::download::ArtifactProfile {
    let lower = file_name.to_ascii_lowercase();
    let artifact_kind = match source_kind {
        crate::download::SourceKind::GithubWorkflowArtifact => {
            crate::download::ArtifactKind::CiArtifact
        }
        crate::download::SourceKind::GithubSourceArchive => {
            crate::download::ArtifactKind::SourceArchive
        }
        _ if lower.ends_with(".tar.gz")
            || lower.ends_with(".tgz")
            || lower.ends_with(".zip")
            || lower.ends_with(".tar.xz")
            || lower.ends_with(".txz")
            || lower.ends_with(".tar.bz2")
            || lower.ends_with(".tbz2")
            || lower.ends_with(".tar.zst")
            || lower.ends_with(".tzst")
            || lower.ends_with(".7z") =>
        {
            crate::download::ArtifactKind::Archive
        }
        _ if lower.ends_with(".exe")
            || lower.ends_with(".msi")
            || lower.ends_with(".pkg")
            || lower.ends_with(".dmg") =>
        {
            crate::download::ArtifactKind::Installer
        }
        _ if lower.ends_with(".deb") || lower.ends_with(".rpm") || lower.ends_with(".appimage") => {
            crate::download::ArtifactKind::PackageFile
        }
        _ if lower.ends_with(".bin") => crate::download::ArtifactKind::PortableBinary,
        _ => crate::download::ArtifactKind::Unknown,
    };

    let install_intent = match artifact_kind {
        crate::download::ArtifactKind::Installer => crate::download::InstallIntent::OpenInstaller,
        crate::download::ArtifactKind::Archive
        | crate::download::ArtifactKind::CiArtifact
        | crate::download::ArtifactKind::SourceArchive => {
            crate::download::InstallIntent::ExtractThenContinue
        }
        _ => crate::download::InstallIntent::None,
    };

    let suggested_follow_ups = match install_intent {
        crate::download::InstallIntent::OpenInstaller => vec![
            crate::download::FollowUpAction::Install,
            crate::download::FollowUpAction::Open,
            crate::download::FollowUpAction::Reveal,
        ],
        crate::download::InstallIntent::ExtractThenContinue => vec![
            crate::download::FollowUpAction::Extract,
            crate::download::FollowUpAction::Open,
            crate::download::FollowUpAction::Reveal,
        ],
        crate::download::InstallIntent::None => vec![
            crate::download::FollowUpAction::Open,
            crate::download::FollowUpAction::Reveal,
        ],
    };

    let platform = if lower.contains("windows") || lower.contains("win") {
        crate::download::ArtifactPlatform::Windows
    } else if lower.contains("darwin") || lower.contains("macos") || lower.contains("osx") {
        crate::download::ArtifactPlatform::Macos
    } else if lower.contains("linux") {
        crate::download::ArtifactPlatform::Linux
    } else {
        crate::download::ArtifactPlatform::Unknown
    };

    let arch = if lower.contains("arm64") || lower.contains("aarch64") {
        crate::download::ArtifactArch::Arm64
    } else if lower.contains("x64") || lower.contains("x86_64") || lower.contains("amd64") {
        crate::download::ArtifactArch::X64
    } else if lower.contains("x86") || lower.contains("i386") || lower.contains("i686") {
        crate::download::ArtifactArch::X86
    } else {
        crate::download::ArtifactArch::Unknown
    };

    crate::download::ArtifactProfile {
        artifact_kind,
        source_kind,
        platform,
        arch,
        install_intent,
        suggested_follow_ups,
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
pub async fn github_list_workflow_artifacts(
    repo: String,
    token: Option<String>,
    vault: State<'_, SharedSecretVault>,
) -> Result<Vec<WorkflowArtifactInfo>, String> {
    let provider = make_github_provider(token, &vault).await;
    provider
        .list_workflow_artifacts(&repo)
        .await
        .map(|artifacts| {
            artifacts
                .into_iter()
                .map(WorkflowArtifactInfo::from)
                .collect()
        })
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
    let source_descriptor = crate::download::SourceDescriptor {
        kind: crate::download::SourceKind::GithubReleaseAsset,
        provider: Some("github".to_string()),
        label: Some(format!("{}#{}", repo, asset_name)),
        repo: Some(repo.clone()),
        artifact_id: Some(asset_id.to_string()),
        ..Default::default()
    };
    let artifact_profile =
        infer_artifact_profile(&asset_name, crate::download::SourceKind::GithubReleaseAsset);
    let request = build_github_download_request(
        download_url,
        &destination,
        asset_name,
        format!("github:{}", repo),
        headers,
        source_descriptor,
        artifact_profile,
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
    let source_descriptor = crate::download::SourceDescriptor {
        kind: crate::download::SourceKind::GithubSourceArchive,
        provider: Some("github".to_string()),
        label: Some(format!("{}@{}", repo, ref_name)),
        repo: Some(repo.clone()),
        ref_name: Some(ref_name.clone()),
        ..Default::default()
    };
    let artifact_profile =
        infer_artifact_profile(&file_name, crate::download::SourceKind::GithubSourceArchive);
    let request = build_github_download_request(
        url,
        &destination,
        file_name,
        format!("github:{}", repo),
        headers,
        source_descriptor,
        artifact_profile,
    );
    download_add(request, manager, settings).await
}

#[tauri::command]
pub async fn github_download_workflow_artifact(
    repo: String,
    artifact_id: u64,
    artifact_name: String,
    destination: String,
    token: Option<String>,
    vault: State<'_, SharedSecretVault>,
    manager: State<'_, SharedDownloadManager>,
    settings: State<'_, SharedSettings>,
) -> Result<String, String> {
    let provider = make_github_provider(token, &vault).await;
    let url = provider.get_workflow_artifact_download_url(&repo, artifact_id);
    let headers = provider.get_source_download_headers();
    let source_descriptor = crate::download::SourceDescriptor {
        kind: crate::download::SourceKind::GithubWorkflowArtifact,
        provider: Some("github".to_string()),
        label: Some(format!("{} workflow artifact {}", repo, artifact_name)),
        repo: Some(repo.clone()),
        artifact_id: Some(artifact_id.to_string()),
        ..Default::default()
    };
    let artifact_profile = infer_artifact_profile(
        &artifact_name,
        crate::download::SourceKind::GithubWorkflowArtifact,
    );
    let request = build_github_download_request(
        url,
        &destination,
        artifact_name,
        format!("github:{}", repo),
        headers,
        source_descriptor,
        artifact_profile,
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
    use super::{build_github_download_request, infer_artifact_profile};
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
            crate::download::SourceDescriptor {
                kind: crate::download::SourceKind::GithubReleaseAsset,
                provider: Some("github".to_string()),
                label: Some("a/b#asset.zip".to_string()),
                repo: Some("a/b".to_string()),
                artifact_id: Some("1".to_string()),
                ..Default::default()
            },
            infer_artifact_profile("asset.zip", crate::download::SourceKind::GithubReleaseAsset),
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
        assert!(request.source_descriptor.is_some());
        assert!(request.artifact_profile.is_some());
        assert!(request.install_intent.is_some());
    }
}
