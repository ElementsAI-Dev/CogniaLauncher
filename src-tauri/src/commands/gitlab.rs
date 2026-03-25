//! GitLab repository commands for download integration

use crate::SharedSecretVault;
use crate::commands::secrets::{
    ProviderSecretStatus, provider_secret_clear_internal, provider_secret_save_internal,
    provider_secret_status_internal, resolve_provider_secret,
};
use crate::error::CogniaError;
use crate::provider::gitlab::{
    GitLabBranch, GitLabProvider, GitLabRelease, GitLabReleaseLink, GitLabTag,
};
use serde::{Deserialize, Serialize};
use tauri::State;

use super::download::{
    DownloadRequest, DownloadRequestPreset, SharedDownloadManager, SharedSettings,
    build_download_request_preset, download_add,
};

fn map_gitlab_error(e: CogniaError) -> String {
    let msg = e.to_string();
    if msg.contains("401") || msg.contains("Unauthorized") {
        "GitLab authentication failed. Check your access token and ensure it has 'read_api' scope."
            .into()
    } else if msg.contains("403") || msg.contains("Forbidden") {
        "Access denied. Your token may lack permissions for this project.".into()
    } else if msg.contains("404") || msg.contains("Not Found") {
        "Project not found. Check the project path or your access permissions.".into()
    } else if msg.contains("429") || msg.contains("Too Many") {
        "GitLab API rate limit exceeded. Please wait a moment and try again.".into()
    } else {
        msg
    }
}

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
            assets: r
                .assets
                .links
                .into_iter()
                .map(GitLabAssetInfo::from)
                .collect(),
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
    pub namespace: String,
    pub project: String,
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
        GitLabProvider::parse_project_url(&url).map(|(namespace, project)| GitLabParsedProject {
            full_name: format!("{}/{}", namespace, project),
            namespace,
            project,
        }),
    )
}

/// Helper to create a GitLabProvider with optional token and instance URL.
/// Falls back to loading token and instance URL from settings if not provided.
async fn make_gitlab_provider(
    token: Option<String>,
    instance_url: Option<String>,
    vault: &State<'_, SharedSecretVault>,
) -> GitLabProvider {
    let settings = crate::config::Settings::load().await.unwrap_or_default();

    let effective_token = {
        let vault_guard = vault.read().await;
        resolve_provider_secret("gitlab", token, &settings, &vault_guard)
    };

    let effective_url = if instance_url.as_ref().map_or(true, |u| u.is_empty()) {
        settings
            .get_value("providers.gitlab.url")
            .filter(|u| !u.is_empty())
    } else {
        instance_url
    };

    GitLabProvider::new()
        .with_token(effective_token)
        .with_instance_url(effective_url)
}

fn build_gitlab_download_request(
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
        crate::download::SourceKind::GitlabPipelineArtifact => {
            crate::download::ArtifactKind::CiArtifact
        }
        crate::download::SourceKind::GitlabSourceArchive => {
            crate::download::ArtifactKind::SourceArchive
        }
        crate::download::SourceKind::GitlabPackageFile => {
            crate::download::ArtifactKind::PackageFile
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

    crate::download::ArtifactProfile {
        artifact_kind,
        source_kind,
        platform: crate::download::ArtifactPlatform::Unknown,
        arch: crate::download::ArtifactArch::Unknown,
        install_intent,
        suggested_follow_ups,
    }
}

#[tauri::command]
pub async fn gitlab_validate_project(
    project: String,
    token: Option<String>,
    instance_url: Option<String>,
    vault: State<'_, SharedSecretVault>,
) -> Result<bool, String> {
    let provider = make_gitlab_provider(token, instance_url, &vault).await;
    Ok(provider.validate_project(&project).await)
}

#[tauri::command]
pub async fn gitlab_get_project_info(
    project: String,
    token: Option<String>,
    instance_url: Option<String>,
    vault: State<'_, SharedSecretVault>,
) -> Result<GitLabProjectInfo, String> {
    let provider = make_gitlab_provider(token, instance_url, &vault).await;
    let info = provider
        .get_project_info(&project)
        .await
        .map_err(map_gitlab_error)?;
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
    vault: State<'_, SharedSecretVault>,
) -> Result<Vec<GitLabBranchInfo>, String> {
    let provider = make_gitlab_provider(token, instance_url, &vault).await;
    provider
        .list_branches(&project)
        .await
        .map(|branches| branches.into_iter().map(GitLabBranchInfo::from).collect())
        .map_err(map_gitlab_error)
}

#[tauri::command]
pub async fn gitlab_list_tags(
    project: String,
    token: Option<String>,
    instance_url: Option<String>,
    vault: State<'_, SharedSecretVault>,
) -> Result<Vec<GitLabTagInfo>, String> {
    let provider = make_gitlab_provider(token, instance_url, &vault).await;
    provider
        .list_tags(&project)
        .await
        .map(|tags| tags.into_iter().map(GitLabTagInfo::from).collect())
        .map_err(map_gitlab_error)
}

#[tauri::command]
pub async fn gitlab_list_releases(
    project: String,
    token: Option<String>,
    instance_url: Option<String>,
    vault: State<'_, SharedSecretVault>,
) -> Result<Vec<GitLabReleaseInfo>, String> {
    let provider = make_gitlab_provider(token, instance_url, &vault).await;
    provider
        .list_releases(&project)
        .await
        .map(|releases| releases.into_iter().map(GitLabReleaseInfo::from).collect())
        .map_err(map_gitlab_error)
}

#[tauri::command]
pub async fn gitlab_get_release_assets(
    project: String,
    tag: String,
    token: Option<String>,
    instance_url: Option<String>,
    vault: State<'_, SharedSecretVault>,
) -> Result<Vec<GitLabAssetInfo>, String> {
    let provider = make_gitlab_provider(token, instance_url, &vault).await;
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
        .map_err(map_gitlab_error)
}

#[tauri::command]
pub async fn gitlab_download_asset(
    project: String,
    asset_url: String,
    asset_name: String,
    destination: String,
    token: Option<String>,
    instance_url: Option<String>,
    vault: State<'_, SharedSecretVault>,
    manager: State<'_, SharedDownloadManager>,
    settings: State<'_, SharedSettings>,
) -> Result<String, String> {
    let provider = make_gitlab_provider(token, instance_url, &vault).await;

    let headers = provider.get_download_headers();
    let source_descriptor = crate::download::SourceDescriptor {
        kind: crate::download::SourceKind::GitlabReleaseAsset,
        provider: Some("gitlab".to_string()),
        label: Some(format!("{}#{}", project, asset_name)),
        repo: Some(project.clone()),
        artifact_id: Some(asset_name.clone()),
        ..Default::default()
    };
    let artifact_profile =
        infer_artifact_profile(&asset_name, crate::download::SourceKind::GitlabReleaseAsset);
    let request = build_gitlab_download_request(
        asset_url,
        &destination,
        asset_name,
        format!("gitlab:{}", project),
        headers,
        source_descriptor,
        artifact_profile,
    );
    download_add(request, manager, settings).await
}

#[tauri::command]
pub async fn gitlab_download_source(
    project: String,
    ref_name: String,
    format: String,
    destination: String,
    token: Option<String>,
    instance_url: Option<String>,
    vault: State<'_, SharedSecretVault>,
    manager: State<'_, SharedDownloadManager>,
    settings: State<'_, SharedSettings>,
) -> Result<String, String> {
    let provider = make_gitlab_provider(token, instance_url, &vault).await;
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

    let headers = provider.get_download_headers();
    let source_descriptor = crate::download::SourceDescriptor {
        kind: crate::download::SourceKind::GitlabSourceArchive,
        provider: Some("gitlab".to_string()),
        label: Some(format!("{}@{}", project, ref_name)),
        repo: Some(project.clone()),
        ref_name: Some(ref_name.clone()),
        ..Default::default()
    };
    let artifact_profile =
        infer_artifact_profile(&file_name, crate::download::SourceKind::GitlabSourceArchive);
    let request = build_gitlab_download_request(
        url,
        &destination,
        file_name,
        format!("gitlab:{}", project),
        headers,
        source_descriptor,
        artifact_profile,
    );
    download_add(request, manager, settings).await
}

#[tauri::command]
pub async fn gitlab_set_token(
    token: String,
    settings: State<'_, crate::SharedSettings>,
    vault: State<'_, SharedSecretVault>,
) -> Result<ProviderSecretStatus, String> {
    provider_secret_save_internal("gitlab", token, &settings, &vault).await
}

#[tauri::command]
pub async fn gitlab_get_token(
    settings: State<'_, crate::SharedSettings>,
    vault: State<'_, SharedSecretVault>,
) -> Result<ProviderSecretStatus, String> {
    provider_secret_status_internal("gitlab", &settings, &vault).await
}

#[tauri::command]
pub async fn gitlab_clear_token(
    settings: State<'_, crate::SharedSettings>,
    vault: State<'_, SharedSecretVault>,
) -> Result<ProviderSecretStatus, String> {
    provider_secret_clear_internal("gitlab", &settings, &vault).await
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabSearchResult {
    pub full_name: String,
    pub description: Option<String>,
    pub star_count: u64,
    pub archived: bool,
    pub web_url: String,
}

#[tauri::command]
pub async fn gitlab_search_projects(
    query: String,
    limit: Option<u32>,
    token: Option<String>,
    instance_url: Option<String>,
    vault: State<'_, SharedSecretVault>,
) -> Result<Vec<GitLabSearchResult>, String> {
    let provider = make_gitlab_provider(token, instance_url, &vault).await;
    let limit = limit.unwrap_or(10).min(50);
    let encoded_query = urlencoding::encode(&query);

    #[derive(Deserialize)]
    struct SearchItem {
        path_with_namespace: String,
        description: Option<String>,
        star_count: Option<u64>,
        archived: Option<bool>,
        web_url: String,
    }

    let items: Vec<SearchItem> = provider
        .api_get(&format!(
            "/projects?search={}&per_page={}&order_by=star_count&sort=desc",
            encoded_query, limit
        ))
        .await
        .map_err(|e| e.to_string())?;

    Ok(items
        .into_iter()
        .map(|i| GitLabSearchResult {
            full_name: i.path_with_namespace,
            description: i.description,
            star_count: i.star_count.unwrap_or(0),
            archived: i.archived.unwrap_or(false),
            web_url: i.web_url,
        })
        .collect())
}

// ============================================================================
// Pipeline & Job Artifacts Commands
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabPipelineInfo {
    pub id: u64,
    pub ref_name: Option<String>,
    pub status: String,
    pub source: Option<String>,
    pub created_at: Option<String>,
    pub web_url: Option<String>,
}

impl From<crate::provider::gitlab::GitLabPipeline> for GitLabPipelineInfo {
    fn from(p: crate::provider::gitlab::GitLabPipeline) -> Self {
        Self {
            id: p.id,
            ref_name: p.ref_name,
            status: p.status,
            source: p.source,
            created_at: p.created_at,
            web_url: p.web_url,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabJobInfo {
    pub id: u64,
    pub name: String,
    pub stage: Option<String>,
    pub status: String,
    pub ref_name: Option<String>,
    pub has_artifacts: bool,
    pub web_url: Option<String>,
    pub finished_at: Option<String>,
}

impl From<crate::provider::gitlab::GitLabJob> for GitLabJobInfo {
    fn from(j: crate::provider::gitlab::GitLabJob) -> Self {
        let has_artifacts = j.artifacts.as_ref().map_or(false, |a| !a.is_empty());
        Self {
            id: j.id,
            name: j.name,
            stage: j.stage,
            status: j.status,
            ref_name: j.ref_name,
            has_artifacts,
            web_url: j.web_url,
            finished_at: j.finished_at,
        }
    }
}

#[tauri::command]
pub async fn gitlab_list_pipelines(
    project: String,
    ref_name: Option<String>,
    status: Option<String>,
    token: Option<String>,
    instance_url: Option<String>,
    vault: State<'_, SharedSecretVault>,
) -> Result<Vec<GitLabPipelineInfo>, String> {
    let provider = make_gitlab_provider(token, instance_url, &vault).await;
    provider
        .list_pipelines(&project, ref_name.as_deref(), status.as_deref())
        .await
        .map(|p| p.into_iter().map(GitLabPipelineInfo::from).collect())
        .map_err(map_gitlab_error)
}

#[tauri::command]
pub async fn gitlab_list_pipeline_jobs(
    project: String,
    pipeline_id: u64,
    token: Option<String>,
    instance_url: Option<String>,
    vault: State<'_, SharedSecretVault>,
) -> Result<Vec<GitLabJobInfo>, String> {
    let provider = make_gitlab_provider(token, instance_url, &vault).await;
    provider
        .list_pipeline_jobs(&project, pipeline_id)
        .await
        .map(|j| j.into_iter().map(GitLabJobInfo::from).collect())
        .map_err(map_gitlab_error)
}

#[tauri::command]
pub async fn gitlab_download_job_artifacts(
    project: String,
    job_id: u64,
    job_name: String,
    destination: String,
    token: Option<String>,
    instance_url: Option<String>,
    vault: State<'_, SharedSecretVault>,
    manager: State<'_, SharedDownloadManager>,
    settings: State<'_, SharedSettings>,
) -> Result<String, String> {
    let provider = make_gitlab_provider(token, instance_url, &vault).await;
    let url = provider.get_job_artifacts_url(&project, job_id);
    let file_name = format!("{}-artifacts-{}.zip", job_name, job_id);

    let headers = provider.get_download_headers();
    let source_descriptor = crate::download::SourceDescriptor {
        kind: crate::download::SourceKind::GitlabPipelineArtifact,
        provider: Some("gitlab".to_string()),
        label: Some(format!("{} pipeline job {}", project, job_name)),
        repo: Some(project.clone()),
        job_id: Some(job_id.to_string()),
        ..Default::default()
    };
    let artifact_profile = infer_artifact_profile(
        &file_name,
        crate::download::SourceKind::GitlabPipelineArtifact,
    );
    let request = build_gitlab_download_request(
        url,
        &destination,
        file_name,
        format!("gitlab:{}", project),
        headers,
        source_descriptor,
        artifact_profile,
    );
    download_add(request, manager, settings).await
}

// ============================================================================
// Package Registry Commands
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabPackageInfo {
    pub id: u64,
    pub name: String,
    pub version: String,
    pub package_type: String,
    pub created_at: Option<String>,
}

impl From<crate::provider::gitlab::GitLabPackage> for GitLabPackageInfo {
    fn from(p: crate::provider::gitlab::GitLabPackage) -> Self {
        Self {
            id: p.id,
            name: p.name,
            version: p.version,
            package_type: p.package_type,
            created_at: p.created_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabPackageFileInfo {
    pub id: u64,
    pub file_name: String,
    pub size: u64,
    pub file_sha256: Option<String>,
    pub created_at: Option<String>,
}

impl From<crate::provider::gitlab::GitLabPackageFile> for GitLabPackageFileInfo {
    fn from(f: crate::provider::gitlab::GitLabPackageFile) -> Self {
        Self {
            id: f.id,
            file_name: f.file_name,
            size: f.size,
            file_sha256: f.file_sha256,
            created_at: f.created_at,
        }
    }
}

#[tauri::command]
pub async fn gitlab_list_packages(
    project: String,
    package_type: Option<String>,
    token: Option<String>,
    instance_url: Option<String>,
    vault: State<'_, SharedSecretVault>,
) -> Result<Vec<GitLabPackageInfo>, String> {
    let provider = make_gitlab_provider(token, instance_url, &vault).await;
    provider
        .list_packages(&project, package_type.as_deref())
        .await
        .map(|p| p.into_iter().map(GitLabPackageInfo::from).collect())
        .map_err(map_gitlab_error)
}

#[tauri::command]
pub async fn gitlab_list_package_files(
    project: String,
    package_id: u64,
    token: Option<String>,
    instance_url: Option<String>,
    vault: State<'_, SharedSecretVault>,
) -> Result<Vec<GitLabPackageFileInfo>, String> {
    let provider = make_gitlab_provider(token, instance_url, &vault).await;
    provider
        .list_package_files(&project, package_id)
        .await
        .map(|f| f.into_iter().map(GitLabPackageFileInfo::from).collect())
        .map_err(map_gitlab_error)
}

#[tauri::command]
pub async fn gitlab_download_package_file(
    project: String,
    package_id: u64,
    file_name: String,
    destination: String,
    token: Option<String>,
    instance_url: Option<String>,
    vault: State<'_, SharedSecretVault>,
    manager: State<'_, SharedDownloadManager>,
    settings: State<'_, SharedSettings>,
) -> Result<String, String> {
    let provider = make_gitlab_provider(token, instance_url, &vault).await;
    let url = provider.get_package_file_url(&project, package_id, &file_name);

    let headers = provider.get_download_headers();
    let source_descriptor = crate::download::SourceDescriptor {
        kind: crate::download::SourceKind::GitlabPackageFile,
        provider: Some("gitlab".to_string()),
        label: Some(format!("{} package {}", project, file_name)),
        repo: Some(project.clone()),
        package_id: Some(package_id.to_string()),
        package_file_id: Some(file_name.clone()),
        ..Default::default()
    };
    let artifact_profile =
        infer_artifact_profile(&file_name, crate::download::SourceKind::GitlabPackageFile);
    let request = build_gitlab_download_request(
        url,
        &destination,
        file_name,
        format!("gitlab:{}", project),
        headers,
        source_descriptor,
        artifact_profile,
    );
    download_add(request, manager, settings).await
}

#[tauri::command]
pub async fn gitlab_set_instance_url(url: String) -> Result<(), String> {
    let mut settings = crate::config::Settings::load()
        .await
        .map_err(|e| e.to_string())?;
    settings
        .set_value("providers.gitlab.url", &url)
        .map_err(|e| e.to_string())?;
    settings.save().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn gitlab_get_instance_url() -> Result<Option<String>, String> {
    let settings = crate::config::Settings::load()
        .await
        .map_err(|e| e.to_string())?;
    Ok(settings.get_value("providers.gitlab.url"))
}

#[cfg(test)]
mod tests {
    use super::{build_gitlab_download_request, infer_artifact_profile};
    use std::collections::HashMap;

    #[test]
    fn build_request_uses_full_file_destination_and_headers() {
        let mut headers = HashMap::new();
        headers.insert("Private-Token".to_string(), "glpat-xxx".to_string());

        let request = build_gitlab_download_request(
            "https://gitlab.example.com/api/v4/projects/1/jobs/2/artifacts".to_string(),
            "/tmp/gitlab",
            "build-artifacts.zip".to_string(),
            "gitlab:group/project".to_string(),
            headers.clone(),
            crate::download::SourceDescriptor {
                kind: crate::download::SourceKind::GitlabPipelineArtifact,
                provider: Some("gitlab".to_string()),
                label: Some("group/project pipeline".to_string()),
                repo: Some("group/project".to_string()),
                job_id: Some("2".to_string()),
                ..Default::default()
            },
            infer_artifact_profile(
                "build-artifacts.zip",
                crate::download::SourceKind::GitlabPipelineArtifact,
            ),
        );

        assert_eq!(
            request.url,
            "https://gitlab.example.com/api/v4/projects/1/jobs/2/artifacts"
        );
        assert_eq!(request.name, "build-artifacts.zip");
        assert_eq!(request.provider.as_deref(), Some("gitlab:group/project"));
        assert_eq!(request.headers, Some(headers));
        let destination = std::path::Path::new(&request.destination);
        assert!(destination.ends_with(std::path::Path::new("gitlab").join("build-artifacts.zip")));
        assert!(request.delete_after_extract.is_none());
        assert!(request.auto_rename.is_none());
        assert!(request.tags.is_none());
        assert!(request.source_descriptor.is_some());
        assert!(request.artifact_profile.is_some());
        assert!(request.install_intent.is_some());
    }
}
