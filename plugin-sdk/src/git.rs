//! Git repository operations module.
//!
//! Provides read-only access to Git repository information and limited write operations.

use crate::host;
use crate::types::*;
use extism_pdk::*;

/// Check if git is available. Requires: git_read
pub fn is_available() -> Result<bool, Error> {
    let result = unsafe { host::cognia_git_is_available(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// Get git version string. Requires: git_read
pub fn get_version() -> Result<String, Error> {
    let result = unsafe { host::cognia_git_get_version(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

/// Get repository information. Requires: git_read
pub fn get_repo_info(path: &str) -> Result<GitRepoInfo, Error> {
    let input = serde_json::json!({ "path": path }).to_string();
    let result = unsafe { host::cognia_git_get_repo_info(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Get repository working tree status. Requires: git_read
pub fn get_status(path: &str) -> Result<GitStatus, Error> {
    let input = serde_json::json!({ "path": path }).to_string();
    let result = unsafe { host::cognia_git_get_status(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// List branches. Requires: git_read
pub fn get_branches(path: &str) -> Result<Vec<GitBranch>, Error> {
    let input = serde_json::json!({ "path": path }).to_string();
    let result = unsafe { host::cognia_git_get_branches(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Get the current branch name. Requires: git_read
pub fn get_current_branch(path: &str) -> Result<Option<String>, Error> {
    let input = serde_json::json!({ "path": path }).to_string();
    let result = unsafe { host::cognia_git_get_current_branch(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// List tags. Requires: git_read
pub fn get_tags(path: &str) -> Result<Vec<GitTag>, Error> {
    let input = serde_json::json!({ "path": path }).to_string();
    let result = unsafe { host::cognia_git_get_tags(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Get commit history. Requires: git_read
pub fn get_log(path: &str, limit: Option<u32>, branch: Option<&str>) -> Result<Vec<GitCommit>, Error> {
    let input = serde_json::json!({ "path": path, "limit": limit, "branch": branch }).to_string();
    let result = unsafe { host::cognia_git_get_log(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Get detailed commit information. Requires: git_read
pub fn get_commit_detail(path: &str, hash: &str) -> Result<GitCommitDetail, Error> {
    let input = serde_json::json!({ "path": path, "hash": hash }).to_string();
    let result = unsafe { host::cognia_git_get_commit_detail(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Get blame information for a file. Requires: git_read
pub fn get_blame(path: &str, file: &str) -> Result<Vec<GitBlameEntry>, Error> {
    let input = serde_json::json!({ "path": path, "file": file }).to_string();
    let result = unsafe { host::cognia_git_get_blame(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Get working tree diff. Requires: git_read
pub fn get_diff(path: &str) -> Result<String, Error> {
    let input = serde_json::json!({ "path": path }).to_string();
    let result = unsafe { host::cognia_git_get_diff(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Get diff between two revisions. Requires: git_read
pub fn get_diff_between(path: &str, from: &str, to: &str) -> Result<String, Error> {
    let input = serde_json::json!({ "path": path, "from": from, "to": to }).to_string();
    let result = unsafe { host::cognia_git_get_diff_between(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// List remote repositories. Requires: git_read
pub fn get_remotes(path: &str) -> Result<Vec<GitRemote>, Error> {
    let input = serde_json::json!({ "path": path }).to_string();
    let result = unsafe { host::cognia_git_get_remotes(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// List stashed changes. Requires: git_read
pub fn get_stashes(path: &str) -> Result<Vec<GitStash>, Error> {
    let input = serde_json::json!({ "path": path }).to_string();
    let result = unsafe { host::cognia_git_get_stashes(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Get repository contributors. Requires: git_read
pub fn get_contributors(path: &str) -> Result<Vec<GitContributor>, Error> {
    let input = serde_json::json!({ "path": path }).to_string();
    let result = unsafe { host::cognia_git_get_contributors(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Search commits by query. Requires: git_read
pub fn search_commits(path: &str, query: &str) -> Result<Vec<GitCommit>, Error> {
    let input = serde_json::json!({ "path": path, "query": query }).to_string();
    let result = unsafe { host::cognia_git_search_commits(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Get file commit history. Requires: git_read
pub fn get_file_history(path: &str, file: &str) -> Result<Vec<GitCommit>, Error> {
    let input = serde_json::json!({ "path": path, "file": file }).to_string();
    let result = unsafe { host::cognia_git_get_file_history(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Get ahead/behind count relative to upstream. Requires: git_read
pub fn get_ahead_behind(path: &str, branch: Option<&str>) -> Result<GitAheadBehind, Error> {
    let input = serde_json::json!({ "path": path, "branch": branch }).to_string();
    let result = unsafe { host::cognia_git_get_ahead_behind(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Stage specific files. Requires: git_write
pub fn stage_files(path: &str, files: &[&str]) -> Result<(), Error> {
    let input = serde_json::json!({ "path": path, "files": files }).to_string();
    unsafe { host::cognia_git_stage_files(input)?; }
    Ok(())
}

/// Create a commit. Returns commit hash. Requires: git_write
pub fn commit(path: &str, message: &str) -> Result<String, Error> {
    let input = serde_json::json!({ "path": path, "message": message }).to_string();
    let result = unsafe { host::cognia_git_commit(input)? };
    Ok(serde_json::from_str(&result)?)
}
