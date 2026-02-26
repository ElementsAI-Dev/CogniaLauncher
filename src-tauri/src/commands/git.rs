use crate::provider::git::GitProvider;
use crate::provider::traits::Provider;
use serde::{Deserialize, Serialize};

// Re-export types from provider for frontend consumption
pub use crate::provider::git::{
    GitAheadBehind, GitBlameEntry, GitBranchInfo, GitCommitDetail, GitCommitEntry, GitConfigEntry,
    GitContributor, GitDayActivity, GitDiffFile, GitFileStatEntry, GitGraphEntry, GitRemoteInfo,
    GitRepoInfo, GitStashEntry, GitStatusFile, GitTagInfo,
};

/// Diff stats for a commit
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffStats {
    pub files_changed: u32,
    pub insertions: u32,
    pub deletions: u32,
    pub files: Vec<GitDiffFile>,
}

fn get_provider() -> GitProvider {
    GitProvider::new()
}

/// Check if git is installed and available
#[tauri::command]
pub async fn git_is_available() -> Result<bool, String> {
    Ok(get_provider().is_available().await)
}

/// Get the installed git version string
#[tauri::command]
pub async fn git_get_version() -> Result<Option<String>, String> {
    get_provider()
        .get_git_version()
        .await
        .map_err(|e| e.to_string())
}

/// Get the git executable path
#[tauri::command]
pub async fn git_get_executable_path() -> Result<Option<String>, String> {
    Ok(get_provider().get_git_path().await)
}

/// Install git via system package manager
#[tauri::command]
pub async fn git_install() -> Result<String, String> {
    get_provider()
        .install_git()
        .await
        .map_err(|e| e.to_string())
}

/// Update git to the latest version
#[tauri::command]
pub async fn git_update() -> Result<String, String> {
    get_provider().update_git().await.map_err(|e| e.to_string())
}

/// Get all global git configuration entries
#[tauri::command]
pub async fn git_get_config() -> Result<Vec<GitConfigEntry>, String> {
    get_provider()
        .get_config_list()
        .await
        .map_err(|e| e.to_string())
}

/// Set a global git config value
#[tauri::command]
pub async fn git_set_config(key: String, value: String) -> Result<(), String> {
    get_provider()
        .set_config(&key, &value)
        .await
        .map_err(|e| e.to_string())
}

/// Remove a global git config key
#[tauri::command]
pub async fn git_remove_config(key: String) -> Result<(), String> {
    get_provider()
        .remove_config(&key)
        .await
        .map_err(|e| e.to_string())
}

/// Get repository information for a given path
#[tauri::command]
pub async fn git_get_repo_info(path: String) -> Result<GitRepoInfo, String> {
    get_provider()
        .get_repo_info(&path)
        .await
        .map_err(|e| e.to_string())
}

/// Get commit log for a repository
#[tauri::command]
pub async fn git_get_log(
    path: String,
    limit: Option<u32>,
    author: Option<String>,
    since: Option<String>,
    until: Option<String>,
    file: Option<String>,
) -> Result<Vec<GitCommitEntry>, String> {
    get_provider()
        .get_log(
            &path,
            limit.unwrap_or(50),
            author.as_deref(),
            since.as_deref(),
            until.as_deref(),
            file.as_deref(),
        )
        .await
        .map_err(|e| e.to_string())
}

/// Get branches for a repository
#[tauri::command]
pub async fn git_get_branches(path: String) -> Result<Vec<GitBranchInfo>, String> {
    get_provider()
        .get_branches(&path)
        .await
        .map_err(|e| e.to_string())
}

/// Get remotes for a repository
#[tauri::command]
pub async fn git_get_remotes(path: String) -> Result<Vec<GitRemoteInfo>, String> {
    get_provider()
        .get_remotes(&path)
        .await
        .map_err(|e| e.to_string())
}

/// Get tags for a repository
#[tauri::command]
pub async fn git_get_tags(path: String) -> Result<Vec<GitTagInfo>, String> {
    get_provider()
        .get_tags(&path)
        .await
        .map_err(|e| e.to_string())
}

/// Get stashes for a repository
#[tauri::command]
pub async fn git_get_stashes(path: String) -> Result<Vec<GitStashEntry>, String> {
    get_provider()
        .get_stashes(&path)
        .await
        .map_err(|e| e.to_string())
}

/// Get contributors for a repository
#[tauri::command]
pub async fn git_get_contributors(path: String) -> Result<Vec<GitContributor>, String> {
    get_provider()
        .get_contributors(&path)
        .await
        .map_err(|e| e.to_string())
}

/// Get file history (commits that modified a specific file)
#[tauri::command]
pub async fn git_get_file_history(
    path: String,
    file: String,
    limit: Option<u32>,
) -> Result<Vec<GitCommitEntry>, String> {
    get_provider()
        .get_file_history(&path, &file, limit.unwrap_or(50))
        .await
        .map_err(|e| e.to_string())
}

/// Get blame information for a file
#[tauri::command]
pub async fn git_get_blame(path: String, file: String) -> Result<Vec<GitBlameEntry>, String> {
    get_provider()
        .get_blame(&path, &file)
        .await
        .map_err(|e| e.to_string())
}

/// Get detailed information about a specific commit
#[tauri::command]
pub async fn git_get_commit_detail(path: String, hash: String) -> Result<GitCommitDetail, String> {
    get_provider()
        .get_commit_detail(&path, &hash)
        .await
        .map_err(|e| e.to_string())
}

/// Get file-level status (full paths)
#[tauri::command]
pub async fn git_get_status(path: String) -> Result<Vec<GitStatusFile>, String> {
    get_provider()
        .get_status(&path)
        .await
        .map_err(|e| e.to_string())
}

/// Get graph log for commit graph visualization
#[tauri::command]
pub async fn git_get_graph_log(
    path: String,
    limit: Option<u32>,
    all_branches: Option<bool>,
) -> Result<Vec<GitGraphEntry>, String> {
    get_provider()
        .get_graph_log(&path, limit.unwrap_or(200), all_branches.unwrap_or(true))
        .await
        .map_err(|e| e.to_string())
}

/// Get ahead/behind counts for a branch
#[tauri::command]
pub async fn git_get_ahead_behind(
    path: String,
    branch: String,
    upstream: Option<String>,
) -> Result<GitAheadBehind, String> {
    get_provider()
        .get_ahead_behind(&path, &branch, upstream.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// Checkout (switch to) a branch
#[tauri::command]
pub async fn git_checkout_branch(path: String, name: String) -> Result<String, String> {
    get_provider()
        .checkout_branch(&path, &name)
        .await
        .map_err(|e| e.to_string())
}

/// Create a new branch
#[tauri::command]
pub async fn git_create_branch(
    path: String,
    name: String,
    start_point: Option<String>,
) -> Result<String, String> {
    get_provider()
        .create_branch(&path, &name, start_point.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// Delete a branch
#[tauri::command]
pub async fn git_delete_branch(
    path: String,
    name: String,
    force: Option<bool>,
) -> Result<String, String> {
    get_provider()
        .delete_branch(&path, &name, force.unwrap_or(false))
        .await
        .map_err(|e| e.to_string())
}

/// Apply a stash
#[tauri::command]
pub async fn git_stash_apply(path: String, stash_id: Option<String>) -> Result<String, String> {
    get_provider()
        .stash_apply(&path, stash_id.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// Pop a stash
#[tauri::command]
pub async fn git_stash_pop(path: String, stash_id: Option<String>) -> Result<String, String> {
    get_provider()
        .stash_pop(&path, stash_id.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// Drop a stash
#[tauri::command]
pub async fn git_stash_drop(path: String, stash_id: Option<String>) -> Result<String, String> {
    get_provider()
        .stash_drop(&path, stash_id.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// Save (create) a stash
#[tauri::command]
pub async fn git_stash_save(
    path: String,
    message: Option<String>,
    include_untracked: Option<bool>,
) -> Result<String, String> {
    get_provider()
        .stash_save(
            &path,
            message.as_deref(),
            include_untracked.unwrap_or(false),
        )
        .await
        .map_err(|e| e.to_string())
}

/// Create a tag
#[tauri::command]
pub async fn git_create_tag(
    path: String,
    name: String,
    target_ref: Option<String>,
    message: Option<String>,
) -> Result<String, String> {
    get_provider()
        .create_tag(&path, &name, target_ref.as_deref(), message.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// Delete a tag
#[tauri::command]
pub async fn git_delete_tag(path: String, name: String) -> Result<String, String> {
    get_provider()
        .delete_tag(&path, &name)
        .await
        .map_err(|e| e.to_string())
}

/// Get activity data for heatmap
#[tauri::command]
pub async fn git_get_activity(
    path: String,
    days: Option<u32>,
) -> Result<Vec<GitDayActivity>, String> {
    get_provider()
        .get_activity(&path, days.unwrap_or(365))
        .await
        .map_err(|e| e.to_string())
}

/// Get file stats for visual file history
#[tauri::command]
pub async fn git_get_file_stats(
    path: String,
    file: String,
    limit: Option<u32>,
) -> Result<Vec<GitFileStatEntry>, String> {
    get_provider()
        .get_file_stats(&path, &file, limit.unwrap_or(50))
        .await
        .map_err(|e| e.to_string())
}

/// Search commits by message, author, or diff content
#[tauri::command]
pub async fn git_search_commits(
    path: String,
    query: String,
    search_type: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<GitCommitEntry>, String> {
    get_provider()
        .search_commits(
            &path,
            &query,
            search_type.as_deref().unwrap_or("message"),
            limit.unwrap_or(50),
        )
        .await
        .map_err(|e| e.to_string())
}
