use crate::provider::git::{self, GitProvider};
use crate::provider::traits::Provider;
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter};
use tokio::sync::{watch, Mutex};

/// Global cancel sender for the current clone operation.
/// When a clone starts it creates a new watch channel and stores the sender here.
/// `git_cancel_clone` sends `true` through this channel to kill the process.
static CLONE_CANCEL: OnceLock<Mutex<Option<watch::Sender<bool>>>> = OnceLock::new();

fn clone_cancel() -> &'static Mutex<Option<watch::Sender<bool>>> {
    CLONE_CANCEL.get_or_init(|| Mutex::new(None))
}

// Re-export types from provider for frontend consumption
pub use crate::provider::git::{
    GitAheadBehind, GitBisectState, GitBlameEntry, GitBranchInfo, GitCloneOptions,
    GitCloneProgress, GitCommitDetail, GitCommitEntry, GitConfigEntry, GitContributor,
    GitDayActivity, GitDiffFile, GitFileStatEntry, GitGraphEntry, GitHookInfo, GitLfsFile,
    GitMergeRebaseState, GitRebaseTodoItem, GitReflogEntry, GitRemoteInfo, GitRepoInfo,
    GitRepoStats, GitStashEntry, GitStatusFile, GitSubmoduleInfo, GitSupportFeature,
    GitSupportSnapshot, GitTagInfo, GitWorktreeInfo,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorCapabilityProbeResult {
    pub available: bool,
    pub reason: String,
    pub preferred_editor: Option<String>,
    pub config_path: Option<String>,
    pub fallback_available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorOpenActionResult {
    pub success: bool,
    pub kind: String,
    pub reason: String,
    pub message: String,
    pub opened_with: Option<String>,
    pub fallback_used: bool,
    pub fallback_path: Option<String>,
}

fn command_exists(command: &str) -> bool {
    let mut probe = if cfg!(target_os = "windows") {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", "where", command]);
        cmd
    } else {
        let mut cmd = Command::new("sh");
        cmd.args(["-c", &format!("command -v {} >/dev/null 2>&1", command)]);
        cmd
    };

    probe
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn open_with_command(path: &str, command: Option<&str>) -> Result<(), String> {
    tauri_plugin_opener::open_path(path, command)
        .map_err(|e| format!("Failed to open '{}': {}", path, e))
}

fn get_provider() -> GitProvider {
    GitProvider::new()
}

fn normalize_git_error_message(message: String) -> String {
    if message.starts_with("[git:") {
        return message;
    }

    let lower = message.to_lowercase();
    let category = if lower.contains("cancelled")
        || lower.contains("canceled")
        || lower.contains("terminated by signal")
    {
        "cancelled"
    } else if lower.contains("[git:timeout]")
        || lower.contains("timed out")
        || lower.contains("timeout")
    {
        "timeout"
    } else if lower.contains("no repo")
        || lower.contains("no clone operation in progress")
        || lower.contains("no upstream")
        || lower.contains("set-upstream")
        || lower.contains("invalid path")
        || lower.contains("outside repository")
    {
        "precondition"
    } else if lower.contains("conflict")
        || lower.contains("merge in progress")
        || lower.contains("rebase in progress")
        || lower.contains("resolve conflicts")
    {
        "conflict"
    } else if lower.contains("not a git repository")
        || lower.contains("git is not recognized")
        || lower.contains("not in tauri environment")
    {
        "environment"
    } else {
        "execution"
    };

    format!("[git:{}] {}", category, message)
}

fn map_git_err<E: ToString>(error: E) -> String {
    normalize_git_error_message(error.to_string())
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

/// Get structured Git feature support snapshot for capability gating.
#[tauri::command]
pub async fn git_get_support_snapshot(
    path: Option<String>,
) -> Result<GitSupportSnapshot, String> {
    get_provider()
        .get_support_snapshot(path.as_deref())
        .await
        .map_err(map_git_err)
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

/// Get a single global git config value by key
#[tauri::command]
pub async fn git_get_config_value(key: String) -> Result<Option<String>, String> {
    get_provider()
        .get_config_value(&key)
        .await
        .map_err(|e| e.to_string())
}

/// Get the path to the global git config file
#[tauri::command]
pub async fn git_get_config_file_path() -> Result<Option<String>, String> {
    get_provider()
        .get_config_file_path()
        .await
        .map_err(|e| e.to_string())
}

/// List all git aliases
#[tauri::command]
pub async fn git_list_aliases() -> Result<Vec<GitConfigEntry>, String> {
    get_provider()
        .list_aliases()
        .await
        .map_err(|e| e.to_string())
}

/// Set a global git config value only if not already set
#[tauri::command]
pub async fn git_set_config_if_unset(key: String, value: String) -> Result<bool, String> {
    get_provider()
        .set_config_if_unset(&key, &value)
        .await
        .map_err(|e| e.to_string())
}

/// Probe preferred-editor capability for global git config
#[tauri::command]
pub async fn git_probe_editor_capability() -> Result<EditorCapabilityProbeResult, String> {
    let provider = get_provider();
    let config_path = provider
        .get_config_file_path()
        .await
        .map_err(|e| e.to_string())?;

    let Some(path) = config_path else {
        return Ok(EditorCapabilityProbeResult {
            available: false,
            reason: "config_not_found".to_string(),
            preferred_editor: None,
            config_path: None,
            fallback_available: false,
        });
    };

    if command_exists("code") {
        return Ok(EditorCapabilityProbeResult {
            available: true,
            reason: "ok".to_string(),
            preferred_editor: Some("code".to_string()),
            config_path: Some(path),
            fallback_available: true,
        });
    }

    Ok(EditorCapabilityProbeResult {
        available: false,
        reason: "editor_not_found".to_string(),
        preferred_editor: None,
        config_path: Some(path),
        fallback_available: true,
    })
}

/// Open the global git config file with normalized editor/fallback result
#[tauri::command]
pub async fn git_open_config_in_editor() -> Result<EditorOpenActionResult, String> {
    let probe = git_probe_editor_capability().await?;
    let fallback_path = probe.config_path.clone();
    let Some(path) = fallback_path.clone() else {
        return Ok(EditorOpenActionResult {
            success: false,
            kind: "unavailable".to_string(),
            reason: "config_not_found".to_string(),
            message: "Global git config file was not found".to_string(),
            opened_with: None,
            fallback_used: false,
            fallback_path: None,
        });
    };

    if probe.available {
        if open_with_command(&path, probe.preferred_editor.as_deref()).is_ok() {
            let opened_with = probe.preferred_editor.clone();
            return Ok(EditorOpenActionResult {
                success: true,
                kind: "opened_editor".to_string(),
                reason: "ok".to_string(),
                message: format!(
                    "Opened in {}: {}",
                    opened_with.clone().unwrap_or_default(),
                    path
                ),
                opened_with,
                fallback_used: false,
                fallback_path: Some(path),
            });
        }
    }

    match open_with_command(&path, None::<&str>) {
        Ok(()) => Ok(EditorOpenActionResult {
            success: true,
            kind: "fallback_opened".to_string(),
            reason: if probe.available {
                "editor_launch_failed".to_string()
            } else {
                "editor_not_found".to_string()
            },
            message: format!("Opened fallback path: {}", path),
            opened_with: Some("default".to_string()),
            fallback_used: true,
            fallback_path: Some(path),
        }),
        Err(err) => Ok(EditorOpenActionResult {
            success: false,
            kind: "error".to_string(),
            reason: "fallback_failed".to_string(),
            message: err,
            opened_with: None,
            fallback_used: false,
            fallback_path: Some(path),
        }),
    }
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
    skip: Option<u32>,
    author: Option<String>,
    since: Option<String>,
    until: Option<String>,
    file: Option<String>,
) -> Result<Vec<GitCommitEntry>, String> {
    get_provider()
        .get_log(
            &path,
            limit.unwrap_or(50),
            skip.unwrap_or(0),
            author.as_deref(),
            since.as_deref(),
            until.as_deref(),
            file.as_deref(),
        )
        .await
        .map_err(map_git_err)
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
    skip: Option<u32>,
) -> Result<Vec<GitCommitEntry>, String> {
    get_provider()
        .get_file_history(&path, &file, limit.unwrap_or(50), skip.unwrap_or(0))
        .await
        .map_err(map_git_err)
}

/// Get blame information for a file
#[tauri::command]
pub async fn git_get_blame(path: String, file: String) -> Result<Vec<GitBlameEntry>, String> {
    get_provider()
        .get_blame(&path, &file)
        .await
        .map_err(map_git_err)
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
    first_parent: Option<bool>,
    branch: Option<String>,
) -> Result<Vec<GitGraphEntry>, String> {
    get_provider()
        .get_graph_log(
            &path,
            limit.unwrap_or(200),
            all_branches.unwrap_or(true),
            first_parent.unwrap_or(false),
            branch.as_deref(),
        )
        .await
        .map_err(map_git_err)
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
        .map_err(map_git_err)
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
    skip: Option<u32>,
) -> Result<Vec<GitFileStatEntry>, String> {
    get_provider()
        .get_file_stats(&path, &file, limit.unwrap_or(50), skip.unwrap_or(0))
        .await
        .map_err(map_git_err)
}

/// Search commits by message, author, or diff content
#[tauri::command]
pub async fn git_search_commits(
    path: String,
    query: String,
    search_type: Option<String>,
    limit: Option<u32>,
    skip: Option<u32>,
) -> Result<Vec<GitCommitEntry>, String> {
    get_provider()
        .search_commits(
            &path,
            &query,
            search_type.as_deref().unwrap_or("message"),
            limit.unwrap_or(50),
            skip.unwrap_or(0),
        )
        .await
        .map_err(map_git_err)
}

// ============================================================================
// Write operations
// ============================================================================

#[tauri::command]
pub async fn git_stage_files(path: String, files: Vec<String>) -> Result<String, String> {
    let file_refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
    get_provider()
        .stage_files(&path, &file_refs)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_stage_all(path: String) -> Result<String, String> {
    get_provider()
        .stage_all(&path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_unstage_files(path: String, files: Vec<String>) -> Result<String, String> {
    let file_refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
    get_provider()
        .unstage_files(&path, &file_refs)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_discard_changes(path: String, files: Vec<String>) -> Result<String, String> {
    let file_refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
    get_provider()
        .discard_changes(&path, &file_refs)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_commit(
    path: String,
    message: String,
    amend: Option<bool>,
    allow_empty: Option<bool>,
    signoff: Option<bool>,
    no_verify: Option<bool>,
) -> Result<String, String> {
    get_provider()
        .commit(
            &path,
            &message,
            amend.unwrap_or(false),
            allow_empty.unwrap_or(false),
            signoff.unwrap_or(false),
            no_verify.unwrap_or(false),
        )
        .await
        .map_err(map_git_err)
}

#[tauri::command]
pub async fn git_push(
    path: String,
    remote: Option<String>,
    branch: Option<String>,
    force: Option<bool>,
    force_lease: Option<bool>,
    set_upstream: Option<bool>,
) -> Result<String, String> {
    get_provider()
        .push(
            &path,
            remote.as_deref(),
            branch.as_deref(),
            force.unwrap_or(false),
            force_lease.unwrap_or(false),
            set_upstream.unwrap_or(false),
        )
        .await
        .map_err(map_git_err)
}

#[tauri::command]
pub async fn git_pull(
    path: String,
    remote: Option<String>,
    branch: Option<String>,
    rebase: Option<bool>,
    autostash: Option<bool>,
) -> Result<String, String> {
    get_provider()
        .pull(
            &path,
            remote.as_deref(),
            branch.as_deref(),
            rebase.unwrap_or(false),
            autostash.unwrap_or(false),
        )
        .await
        .map_err(map_git_err)
}

#[tauri::command]
pub async fn git_fetch(
    path: String,
    remote: Option<String>,
    prune: Option<bool>,
    all: Option<bool>,
) -> Result<String, String> {
    get_provider()
        .fetch_remote(
            &path,
            remote.as_deref(),
            prune.unwrap_or(false),
            all.unwrap_or(false),
        )
        .await
        .map_err(map_git_err)
}

#[tauri::command]
pub async fn git_clone(
    app: AppHandle,
    url: String,
    dest_path: String,
    options: Option<GitCloneOptions>,
) -> Result<String, String> {
    let opts = options.unwrap_or_default();
    let app_clone = app.clone();

    let (cancel_tx, cancel_rx) = watch::channel(false);
    {
        let mut guard = clone_cancel().lock().await;
        *guard = Some(cancel_tx);
    }

    let result = get_provider()
        .clone_repo_with_progress_cancellable(
            &url,
            &dest_path,
            opts,
            move |progress| {
                let _ = app_clone.emit("git-clone-progress", &progress);
            },
            cancel_rx,
        )
        .await
        .map_err(map_git_err);

    {
        let mut guard = clone_cancel().lock().await;
        *guard = None;
    }

    result
}

#[tauri::command]
pub async fn git_cancel_clone() -> Result<(), String> {
    let guard = clone_cancel().lock().await;
    if let Some(tx) = guard.as_ref() {
        let _ = tx.send(true);
        Ok(())
    } else {
        Err(map_git_err("No clone operation in progress"))
    }
}

#[tauri::command]
pub fn git_extract_repo_name(url: String) -> Option<String> {
    git::extract_repo_name(&url)
}

#[tauri::command]
pub fn git_validate_url(url: String) -> bool {
    git::validate_git_url(&url)
}

#[tauri::command]
pub async fn git_init(path: String) -> Result<String, String> {
    get_provider()
        .init_repo(&path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_get_diff(
    path: String,
    staged: Option<bool>,
    file: Option<String>,
    context_lines: Option<u32>,
) -> Result<String, String> {
    get_provider()
        .get_diff(
            &path,
            staged.unwrap_or(false),
            file.as_deref(),
            context_lines,
        )
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_get_diff_between(
    path: String,
    from: String,
    to: String,
    file: Option<String>,
    context_lines: Option<u32>,
) -> Result<String, String> {
    get_provider()
        .get_diff_between(&path, &from, &to, file.as_deref(), context_lines)
        .await
        .map_err(|e| e.to_string())
}

/// Get the full diff (patch) for a single commit
#[tauri::command]
pub async fn git_get_commit_diff(
    path: String,
    hash: String,
    file: Option<String>,
    context_lines: Option<u32>,
) -> Result<String, String> {
    get_provider()
        .get_commit_diff(&path, &hash, file.as_deref(), context_lines)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_merge(
    path: String,
    branch: String,
    no_ff: Option<bool>,
) -> Result<String, String> {
    get_provider()
        .merge_branch(&path, &branch, no_ff.unwrap_or(false))
        .await
        .map_err(map_git_err)
}

#[tauri::command]
pub async fn git_revert(
    path: String,
    hash: String,
    no_commit: Option<bool>,
) -> Result<String, String> {
    get_provider()
        .revert_commit(&path, &hash, no_commit.unwrap_or(false))
        .await
        .map_err(map_git_err)
}

#[tauri::command]
pub async fn git_cherry_pick(path: String, hash: String) -> Result<String, String> {
    get_provider()
        .cherry_pick(&path, &hash)
        .await
        .map_err(map_git_err)
}

#[tauri::command]
pub async fn git_reset(
    path: String,
    mode: Option<String>,
    target: Option<String>,
) -> Result<String, String> {
    get_provider()
        .reset_head(&path, mode.as_deref().unwrap_or("mixed"), target.as_deref())
        .await
        .map_err(map_git_err)
}

// ============================================================================
// Remote & branch management
// ============================================================================

#[tauri::command]
pub async fn git_remote_add(path: String, name: String, url: String) -> Result<String, String> {
    get_provider()
        .remote_add(&path, &name, &url)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_remote_remove(path: String, name: String) -> Result<String, String> {
    get_provider()
        .remote_remove(&path, &name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_remote_rename(
    path: String,
    old_name: String,
    new_name: String,
) -> Result<String, String> {
    get_provider()
        .remote_rename(&path, &old_name, &new_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_remote_set_url(path: String, name: String, url: String) -> Result<String, String> {
    get_provider()
        .remote_set_url(&path, &name, &url)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_branch_rename(
    path: String,
    old_name: String,
    new_name: String,
) -> Result<String, String> {
    get_provider()
        .branch_rename(&path, &old_name, &new_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_branch_set_upstream(
    path: String,
    branch: String,
    upstream: String,
) -> Result<String, String> {
    get_provider()
        .branch_set_upstream(&path, &branch, &upstream)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_push_tags(path: String, remote: Option<String>) -> Result<String, String> {
    get_provider()
        .push_tags(&path, remote.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_delete_remote_branch(
    path: String,
    remote: String,
    branch: String,
) -> Result<String, String> {
    get_provider()
        .delete_remote_branch(&path, &remote, &branch)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_stash_show(path: String, stash_id: Option<String>) -> Result<String, String> {
    get_provider()
        .stash_show(&path, stash_id.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_get_reflog(
    path: String,
    limit: Option<u32>,
) -> Result<Vec<GitReflogEntry>, String> {
    get_provider()
        .get_reflog(&path, limit.unwrap_or(50))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_clean(path: String, directories: Option<bool>) -> Result<String, String> {
    get_provider()
        .clean_untracked(&path, directories.unwrap_or(false))
        .await
        .map_err(map_git_err)
}

#[tauri::command]
pub async fn git_clean_dry_run(
    path: String,
    directories: Option<bool>,
) -> Result<Vec<String>, String> {
    get_provider()
        .clean_dry_run(&path, directories.unwrap_or(false))
        .await
        .map_err(map_git_err)
}

#[tauri::command]
pub async fn git_stash_push_files(
    path: String,
    files: Vec<String>,
    message: Option<String>,
    include_untracked: Option<bool>,
) -> Result<String, String> {
    let file_refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
    get_provider()
        .stash_push_files(
            &path,
            &file_refs,
            message.as_deref(),
            include_untracked.unwrap_or(false),
        )
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Submodule commands
// ============================================================================

#[tauri::command]
pub async fn git_list_submodules(path: String) -> Result<Vec<GitSubmoduleInfo>, String> {
    get_provider()
        .list_submodules(&path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_add_submodule(
    path: String,
    url: String,
    subpath: String,
) -> Result<String, String> {
    get_provider()
        .add_submodule(&path, &url, &subpath)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_update_submodules(
    path: String,
    init: Option<bool>,
    recursive: Option<bool>,
) -> Result<String, String> {
    get_provider()
        .update_submodules(&path, init.unwrap_or(true), recursive.unwrap_or(true))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_remove_submodule(path: String, subpath: String) -> Result<String, String> {
    get_provider()
        .remove_submodule(&path, &subpath)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_sync_submodules(path: String) -> Result<String, String> {
    get_provider()
        .sync_submodules(&path)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Worktree commands
// ============================================================================

#[tauri::command]
pub async fn git_list_worktrees(path: String) -> Result<Vec<GitWorktreeInfo>, String> {
    get_provider()
        .list_worktrees(&path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_add_worktree(
    path: String,
    dest: String,
    branch: Option<String>,
    new_branch: Option<String>,
) -> Result<String, String> {
    get_provider()
        .add_worktree(&path, &dest, branch.as_deref(), new_branch.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_remove_worktree(
    path: String,
    dest: String,
    force: Option<bool>,
) -> Result<String, String> {
    get_provider()
        .remove_worktree(&path, &dest, force.unwrap_or(false))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_prune_worktrees(path: String) -> Result<String, String> {
    get_provider()
        .prune_worktrees(&path)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// .gitignore commands
// ============================================================================

#[tauri::command]
pub async fn git_get_gitignore(path: String) -> Result<String, String> {
    get_provider()
        .get_gitignore(&path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_set_gitignore(path: String, content: String) -> Result<(), String> {
    get_provider()
        .set_gitignore(&path, &content)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_check_ignore(path: String, files: Vec<String>) -> Result<Vec<String>, String> {
    let file_refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
    get_provider()
        .check_ignore(&path, &file_refs)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_add_to_gitignore(path: String, patterns: Vec<String>) -> Result<(), String> {
    let pattern_refs: Vec<&str> = patterns.iter().map(|s| s.as_str()).collect();
    get_provider()
        .add_to_gitignore(&path, &pattern_refs)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Git Hooks commands
// ============================================================================

#[tauri::command]
pub async fn git_list_hooks(path: String) -> Result<Vec<GitHookInfo>, String> {
    get_provider()
        .list_hooks(&path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_get_hook_content(path: String, name: String) -> Result<String, String> {
    get_provider()
        .get_hook_content(&path, &name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_set_hook_content(
    path: String,
    name: String,
    content: String,
) -> Result<(), String> {
    get_provider()
        .set_hook_content(&path, &name, &content)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_toggle_hook(path: String, name: String, enabled: bool) -> Result<(), String> {
    get_provider()
        .toggle_hook(&path, &name, enabled)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Git LFS commands
// ============================================================================

#[tauri::command]
pub async fn git_lfs_is_available() -> Result<bool, String> {
    Ok(get_provider().lfs_is_available().await)
}

#[tauri::command]
pub async fn git_lfs_get_version() -> Result<Option<String>, String> {
    get_provider()
        .lfs_get_version()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_lfs_tracked_patterns(path: String) -> Result<Vec<String>, String> {
    get_provider()
        .lfs_tracked_patterns(&path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_lfs_ls_files(path: String) -> Result<Vec<GitLfsFile>, String> {
    get_provider()
        .lfs_ls_files(&path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_lfs_track(path: String, pattern: String) -> Result<String, String> {
    get_provider()
        .lfs_track(&path, &pattern)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_lfs_untrack(path: String, pattern: String) -> Result<String, String> {
    get_provider()
        .lfs_untrack(&path, &pattern)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_lfs_install(path: String) -> Result<String, String> {
    get_provider()
        .lfs_install(&path)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Rebase & Squash commands
// ============================================================================

#[tauri::command]
pub async fn git_rebase(path: String, onto: String) -> Result<String, String> {
    get_provider()
        .rebase(&path, &onto)
        .await
        .map_err(map_git_err)
}

#[tauri::command]
pub async fn git_rebase_abort(path: String) -> Result<String, String> {
    get_provider()
        .rebase_abort(&path)
        .await
        .map_err(map_git_err)
}

#[tauri::command]
pub async fn git_rebase_continue(path: String) -> Result<String, String> {
    get_provider()
        .rebase_continue(&path)
        .await
        .map_err(map_git_err)
}

#[tauri::command]
pub async fn git_rebase_skip(path: String) -> Result<String, String> {
    get_provider().rebase_skip(&path).await.map_err(map_git_err)
}

#[tauri::command]
pub async fn git_squash(path: String, count: u32, message: String) -> Result<String, String> {
    get_provider()
        .squash_last_n(&path, count, &message)
        .await
        .map_err(map_git_err)
}

// ============================================================================
// Merge/Rebase state & Conflict resolution commands
// ============================================================================

#[tauri::command]
pub async fn git_get_merge_rebase_state(path: String) -> Result<GitMergeRebaseState, String> {
    get_provider()
        .get_merge_rebase_state(&path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_get_conflicted_files(path: String) -> Result<Vec<String>, String> {
    get_provider()
        .get_conflicted_files(&path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_resolve_file_ours(path: String, file: String) -> Result<String, String> {
    get_provider()
        .resolve_file_ours(&path, &file)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_resolve_file_theirs(path: String, file: String) -> Result<String, String> {
    get_provider()
        .resolve_file_theirs(&path, &file)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_resolve_file_mark(path: String, file: String) -> Result<String, String> {
    get_provider()
        .resolve_file_mark(&path, &file)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_merge_abort(path: String) -> Result<String, String> {
    get_provider().merge_abort(&path).await.map_err(map_git_err)
}

#[tauri::command]
pub async fn git_merge_continue(path: String) -> Result<String, String> {
    get_provider()
        .merge_continue(&path)
        .await
        .map_err(map_git_err)
}

// ============================================================================
// Cherry-pick abort/continue & Revert abort
// ============================================================================

#[tauri::command]
pub async fn git_cherry_pick_abort(path: String) -> Result<String, String> {
    get_provider()
        .cherry_pick_abort(&path)
        .await
        .map_err(map_git_err)
}

#[tauri::command]
pub async fn git_cherry_pick_continue(path: String) -> Result<String, String> {
    get_provider()
        .cherry_pick_continue(&path)
        .await
        .map_err(map_git_err)
}

#[tauri::command]
pub async fn git_revert_abort(path: String) -> Result<String, String> {
    get_provider()
        .revert_abort(&path)
        .await
        .map_err(map_git_err)
}

// ============================================================================
// Stash branch
// ============================================================================

#[tauri::command]
pub async fn git_stash_branch(
    path: String,
    branch_name: String,
    stash_id: Option<String>,
) -> Result<String, String> {
    get_provider()
        .stash_branch(&path, &branch_name, stash_id.as_deref())
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Local (per-repo) config
// ============================================================================

#[tauri::command]
pub async fn git_get_local_config(path: String) -> Result<Vec<GitConfigEntry>, String> {
    get_provider()
        .get_local_config_list(&path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_set_local_config(path: String, key: String, value: String) -> Result<(), String> {
    get_provider()
        .set_local_config(&path, &key, &value)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_remove_local_config(path: String, key: String) -> Result<(), String> {
    get_provider()
        .remove_local_config(&path, &key)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_get_local_config_value(
    path: String,
    key: String,
) -> Result<Option<String>, String> {
    get_provider()
        .get_local_config_value(&path, &key)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Shallow clone management
// ============================================================================

#[tauri::command]
pub async fn git_is_shallow(path: String) -> Result<bool, String> {
    get_provider()
        .is_shallow(&path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_deepen(path: String, depth: u32) -> Result<String, String> {
    get_provider()
        .deepen(&path, depth)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_unshallow(path: String) -> Result<String, String> {
    get_provider()
        .unshallow(&path)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Repository statistics & health
// ============================================================================

#[tauri::command]
pub async fn git_get_repo_stats(path: String) -> Result<GitRepoStats, String> {
    get_provider()
        .get_repo_stats(&path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_fsck(path: String) -> Result<Vec<String>, String> {
    get_provider().fsck(&path).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_describe(path: String) -> Result<Option<String>, String> {
    get_provider()
        .describe(&path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_remote_prune(path: String, remote: String) -> Result<String, String> {
    get_provider()
        .remote_prune(&path, &remote)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Commit/tag signature verification
// ============================================================================

#[tauri::command]
pub async fn git_verify_commit(path: String, hash: String) -> Result<String, String> {
    get_provider()
        .verify_commit(&path, &hash)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_verify_tag(path: String, tag: String) -> Result<String, String> {
    get_provider()
        .verify_tag(&path, &tag)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Interactive rebase
// ============================================================================

#[tauri::command]
pub async fn git_get_rebase_todo_preview(
    path: String,
    base: String,
) -> Result<Vec<GitRebaseTodoItem>, String> {
    get_provider()
        .get_rebase_todo_preview(&path, &base)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_start_interactive_rebase(
    path: String,
    base: String,
    todo: Vec<GitRebaseTodoItem>,
) -> Result<String, String> {
    get_provider()
        .start_interactive_rebase(&path, &base, &todo)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Git bisect
// ============================================================================

#[tauri::command]
pub async fn git_bisect_start(
    path: String,
    bad_ref: String,
    good_ref: String,
) -> Result<String, String> {
    get_provider()
        .bisect_start(&path, &bad_ref, &good_ref)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_bisect_good(path: String) -> Result<String, String> {
    get_provider()
        .bisect_good(&path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_bisect_bad(path: String) -> Result<String, String> {
    get_provider()
        .bisect_bad(&path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_bisect_skip(path: String) -> Result<String, String> {
    get_provider()
        .bisect_skip(&path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_bisect_reset(path: String) -> Result<String, String> {
    get_provider()
        .bisect_reset(&path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_bisect_log(path: String) -> Result<String, String> {
    get_provider()
        .bisect_log(&path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_get_bisect_state(path: String) -> Result<GitBisectState, String> {
    get_provider()
        .get_bisect_state(&path)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Sparse-checkout
// ============================================================================

#[tauri::command]
pub async fn git_is_sparse_checkout(path: String) -> Result<bool, String> {
    get_provider()
        .is_sparse_checkout(&path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_sparse_checkout_init(path: String, cone: Option<bool>) -> Result<String, String> {
    get_provider()
        .sparse_checkout_init(&path, cone.unwrap_or(true))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_sparse_checkout_set(
    path: String,
    patterns: Vec<String>,
) -> Result<String, String> {
    let refs: Vec<&str> = patterns.iter().map(|s| s.as_str()).collect();
    get_provider()
        .sparse_checkout_set(&path, &refs)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_sparse_checkout_add(
    path: String,
    patterns: Vec<String>,
) -> Result<String, String> {
    let refs: Vec<&str> = patterns.iter().map(|s| s.as_str()).collect();
    get_provider()
        .sparse_checkout_add(&path, &refs)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_sparse_checkout_list(path: String) -> Result<Vec<String>, String> {
    get_provider()
        .sparse_checkout_list(&path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_sparse_checkout_disable(path: String) -> Result<String, String> {
    get_provider()
        .sparse_checkout_disable(&path)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Git archive
// ============================================================================

#[tauri::command]
pub async fn git_archive(
    path: String,
    format: String,
    output_path: String,
    ref_name: String,
    prefix: Option<String>,
) -> Result<String, String> {
    get_provider()
        .archive_repo(&path, &format, &output_path, &ref_name, prefix.as_deref())
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Git patch (format-patch / apply / am)
// ============================================================================

#[tauri::command]
pub async fn git_format_patch(
    path: String,
    range: String,
    output_dir: String,
) -> Result<Vec<String>, String> {
    get_provider()
        .format_patch(&path, &range, &output_dir)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_apply_patch(
    path: String,
    patch_path: String,
    check_only: Option<bool>,
) -> Result<String, String> {
    get_provider()
        .apply_patch(&path, &patch_path, check_only.unwrap_or(false))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_apply_mailbox(path: String, patch_path: String) -> Result<String, String> {
    get_provider()
        .apply_mailbox(&path, &patch_path)
        .await
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::normalize_git_error_message;

    #[test]
    fn normalize_git_error_preserves_existing_tag() {
        let message = "[git:conflict] merge conflict".to_string();
        assert_eq!(normalize_git_error_message(message.clone()), message);
    }

    #[test]
    fn normalize_git_error_maps_precondition() {
        let normalized = normalize_git_error_message(
            "fatal: no upstream configured for branch 'main'".to_string(),
        );
        assert!(normalized.starts_with("[git:precondition]"));
    }

    #[test]
    fn normalize_git_error_maps_conflict() {
        let normalized =
            normalize_git_error_message("Automatic merge failed; fix conflicts".to_string());
        assert!(normalized.starts_with("[git:conflict]"));
    }

    #[test]
    fn normalize_git_error_maps_cancelled() {
        let normalized = normalize_git_error_message("process terminated by signal".to_string());
        assert!(normalized.starts_with("[git:cancelled]"));
    }

    #[test]
    fn normalize_git_error_maps_timeout() {
        let normalized =
            normalize_git_error_message("git command timed out after 30s".to_string());
        assert!(normalized.starts_with("[git:timeout]"));
    }

    #[test]
    fn normalize_git_error_maps_environment() {
        let normalized = normalize_git_error_message("fatal: not a git repository".to_string());
        assert!(normalized.starts_with("[git:environment]"));
    }

    #[test]
    fn normalize_git_error_defaults_execution() {
        let normalized = normalize_git_error_message("fatal: remote error".to_string());
        assert!(normalized.starts_with("[git:execution]"));
    }
}
