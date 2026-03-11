use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::env::Platform;
use crate::platform::process::{self, ProcessOptions};
use async_trait::async_trait;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Component, Path, PathBuf};
use std::sync::OnceLock;
use std::time::Duration;

/// Default timeout for Git commands (30 seconds)
const GIT_TIMEOUT: Duration = Duration::from_secs(30);
/// Short timeout for non-critical global config read operations
const GIT_CONFIG_READ_TIMEOUT: Duration = Duration::from_secs(5);
/// Longer timeout for install/update operations
const GIT_INSTALL_TIMEOUT: Duration = Duration::from_secs(300);

/// Unit separator character used as delimiter in git --format output
const FIELD_SEP: char = '\x1f';

fn make_opts() -> ProcessOptions {
    ProcessOptions::new().with_timeout(GIT_TIMEOUT)
}

fn make_config_read_opts() -> ProcessOptions {
    ProcessOptions::new().with_timeout(GIT_CONFIG_READ_TIMEOUT)
}

fn make_install_opts() -> ProcessOptions {
    ProcessOptions::new().with_timeout(GIT_INSTALL_TIMEOUT)
}

/// Run a git command with standard timeout
async fn run_git(args: &[&str]) -> CogniaResult<String> {
    let out = process::execute("git", args, Some(make_opts()))
        .await
        .map_err(|e| CogniaError::Provider(format!("git: {}", e)))?;
    if out.success {
        Ok(out.stdout.trim().to_string())
    } else {
        let err = if out.stderr.trim().is_empty() {
            out.stdout.trim().to_string()
        } else {
            out.stderr.trim().to_string()
        };
        Err(CogniaError::Provider(format!("git: {}", err)))
    }
}

/// Run a git command, returning stdout even on non-zero exit
async fn run_git_lenient(args: &[&str]) -> CogniaResult<String> {
    run_git_lenient_with_opts(args, make_opts()).await
}

/// Run a git command with custom ProcessOptions, returning stdout even on non-zero exit
async fn run_git_lenient_with_opts(args: &[&str], opts: ProcessOptions) -> CogniaResult<String> {
    let out = process::execute("git", args, Some(opts))
        .await
        .map_err(|e| CogniaError::Provider(format!("git: {}", e)))?;
    let stdout = out.stdout.trim().to_string();
    if !stdout.is_empty() {
        Ok(stdout)
    } else if !out.stderr.trim().is_empty() {
        Err(CogniaError::Provider(format!("git: {}", out.stderr.trim())))
    } else {
        Ok(String::new())
    }
}

/// Run a git command with -C <path> prefix
async fn run_git_in(path: &str, args: &[&str]) -> CogniaResult<String> {
    let mut full_args = vec!["-C", path];
    full_args.extend_from_slice(args);
    run_git(&full_args).await
}

/// Run a git command with -C <path> prefix, lenient (returns stdout even on error)
async fn run_git_in_lenient(path: &str, args: &[&str]) -> CogniaResult<String> {
    let mut full_args = vec!["-C", path];
    full_args.extend_from_slice(args);
    run_git_lenient(&full_args).await
}

fn classify_config_read_error(operation: &str, error: CogniaError) -> CogniaError {
    let raw = error.to_string();
    let lower = raw.to_lowercase();
    let category = if lower.contains("timed out") || lower.contains("timeout") {
        "timeout"
    } else {
        "execution"
    };
    CogniaError::Provider(format!("[git:{category}] {operation} failed: {raw}"))
}

fn normalize_for_compare(path: &str) -> String {
    let normalized = path.replace('\\', "/").trim_end_matches('/').to_string();
    #[cfg(windows)]
    {
        normalized.to_lowercase()
    }
    #[cfg(not(windows))]
    {
        normalized
    }
}

fn normalize_relative_history_path(path: &str) -> CogniaResult<String> {
    let mut result = PathBuf::new();
    for component in Path::new(path).components() {
        match component {
            Component::CurDir => {}
            Component::Normal(seg) => result.push(seg),
            Component::ParentDir => {
                if !result.pop() {
                    return Err(CogniaError::Provider(
                        "git: invalid path: outside repository".into(),
                    ));
                }
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err(CogniaError::Provider(
                    "git: invalid path: expected repository-relative path".into(),
                ));
            }
        }
    }

    if result.as_os_str().is_empty() {
        return Err(CogniaError::Provider(
            "git: invalid path: empty file path".into(),
        ));
    }

    Ok(result.to_string_lossy().replace('\\', "/"))
}

async fn normalize_history_file_path(path: &str, file: &str) -> CogniaResult<String> {
    let file = file.trim();
    if file.is_empty() {
        return Err(CogniaError::Provider(
            "git: invalid path: empty file path".into(),
        ));
    }

    let repo_root = run_git_in(path, &["rev-parse", "--show-toplevel"]).await?;
    let repo_root_norm = normalize_for_compare(&repo_root);
    let file_norm = normalize_for_compare(file);

    let relative = if Path::new(file).is_absolute() {
        if file_norm == repo_root_norm {
            return Err(CogniaError::Provider(
                "git: invalid path: expected a file path, got repository root".into(),
            ));
        }
        let root_prefix = format!("{}/", repo_root_norm);
        if !file_norm.starts_with(&root_prefix) {
            return Err(CogniaError::Provider(
                "git: invalid path: file is outside repository".into(),
            ));
        }
        file_norm[root_prefix.len()..].to_string()
    } else {
        file_norm
    };

    normalize_relative_history_path(&relative)
}

/// Run a git command with custom ProcessOptions (e.g. longer timeout)
async fn run_git_with_opts(args: &[&str], opts: ProcessOptions) -> CogniaResult<String> {
    let out = process::execute("git", args, Some(opts))
        .await
        .map_err(|e| CogniaError::Provider(format!("git: {}", e)))?;
    if out.success {
        Ok(out.stdout.trim().to_string())
    } else {
        let err = if out.stderr.trim().is_empty() {
            out.stdout.trim().to_string()
        } else {
            out.stderr.trim().to_string()
        };
        Err(CogniaError::Provider(format!("git: {}", err)))
    }
}

/// Run a git command with -C <path> prefix and longer timeout (300s)
async fn run_git_in_long(path: &str, args: &[&str]) -> CogniaResult<String> {
    let mut full_args = vec!["-C", path];
    full_args.extend_from_slice(args);
    run_git_with_opts(&full_args, make_install_opts()).await
}

/// Run a git command with -C <path> prefix and longer timeout (300s), lenient.
/// Returns stderr as Ok when stdout is empty (useful for push/fetch where progress goes to stderr).
async fn run_git_in_long_lenient(path: &str, args: &[&str]) -> CogniaResult<String> {
    let mut full_args = vec!["-C", path];
    full_args.extend_from_slice(args);
    let out = process::execute("git", &full_args, Some(make_install_opts()))
        .await
        .map_err(|e| CogniaError::Provider(format!("git: {}", e)))?;
    if out.success {
        let stdout = out.stdout.trim().to_string();
        if stdout.is_empty() {
            let stderr = out.stderr.trim().to_string();
            Ok(if stderr.is_empty() {
                String::new()
            } else {
                stderr
            })
        } else {
            Ok(stdout)
        }
    } else {
        let err = if out.stderr.trim().is_empty() {
            out.stdout.trim().to_string()
        } else {
            out.stderr.trim().to_string()
        };
        Err(CogniaError::Provider(format!("git: {}", err)))
    }
}

// ============================================================================
// Data structures for repo inspection
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRepoInfo {
    pub root_path: String,
    pub current_branch: String,
    pub is_dirty: bool,
    pub file_count_staged: u32,
    pub file_count_modified: u32,
    pub file_count_untracked: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitEntry {
    pub hash: String,
    pub parents: Vec<String>,
    pub author_name: String,
    pub author_email: String,
    pub date: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitBranchInfo {
    pub name: String,
    pub short_hash: String,
    pub upstream: Option<String>,
    pub is_current: bool,
    pub is_remote: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRemoteInfo {
    pub name: String,
    pub fetch_url: String,
    pub push_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitTagInfo {
    pub name: String,
    pub short_hash: String,
    pub date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStashEntry {
    pub id: String,
    pub message: String,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitContributor {
    pub name: String,
    pub email: String,
    pub commit_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitBlameEntry {
    pub commit_hash: String,
    pub author: String,
    pub author_email: String,
    pub timestamp: i64,
    pub summary: String,
    pub line_number: u32,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffFile {
    pub path: String,
    pub insertions: u32,
    pub deletions: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitConfigEntry {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusFile {
    pub path: String,
    pub index_status: String,
    pub worktree_status: String,
    pub old_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitDetail {
    pub hash: String,
    pub parents: Vec<String>,
    pub author_name: String,
    pub author_email: String,
    pub date: String,
    pub message: String,
    pub files_changed: u32,
    pub insertions: u32,
    pub deletions: u32,
    pub files: Vec<GitDiffFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitGraphEntry {
    pub hash: String,
    pub parents: Vec<String>,
    pub refs: Vec<String>,
    pub author_name: String,
    pub date: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitAheadBehind {
    pub ahead: u32,
    pub behind: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDayActivity {
    pub date: String,
    pub commit_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitFileStatEntry {
    pub hash: String,
    pub author_name: String,
    pub date: String,
    pub additions: u32,
    pub deletions: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitReflogEntry {
    pub hash: String,
    pub selector: String,
    pub action: String,
    pub message: String,
    pub date: String,
}

// ============================================================================
// Submodule, Worktree, Hook, LFS, Merge/Rebase state types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitSubmoduleInfo {
    pub path: String,
    pub hash: String,
    pub status: String,
    pub describe: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitWorktreeInfo {
    pub path: String,
    pub head: String,
    pub branch: Option<String>,
    pub is_bare: bool,
    pub is_detached: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHookInfo {
    pub name: String,
    pub enabled: bool,
    pub has_content: bool,
    pub file_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLfsFile {
    pub oid: String,
    pub name: String,
    pub pointer_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitMergeRebaseState {
    pub state: String,
    pub onto: Option<String>,
    pub progress: Option<u32>,
    pub total: Option<u32>,
}

// ============================================================================
// New data structures for advanced features
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRepoStats {
    pub size_on_disk: String,
    pub object_count: u64,
    pub pack_count: u32,
    pub loose_objects: u32,
    pub commit_count: u64,
    pub is_shallow: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitBisectState {
    pub active: bool,
    pub current_hash: Option<String>,
    pub steps_taken: u32,
    pub remaining_estimate: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRebaseTodoItem {
    pub action: String,
    pub hash: String,
    pub message: String,
}

// ============================================================================
// Clone options & progress types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GitCloneOptions {
    pub branch: Option<String>,
    pub depth: Option<u32>,
    pub single_branch: Option<bool>,
    pub recurse_submodules: Option<bool>,
    pub shallow_submodules: Option<bool>,
    pub no_checkout: Option<bool>,
    pub bare: Option<bool>,
    pub mirror: Option<bool>,
    pub sparse: Option<bool>,
    pub filter: Option<String>,
    pub jobs: Option<u32>,
    pub no_tags: Option<bool>,
    pub remote_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCloneProgress {
    pub phase: String,
    pub percent: Option<u32>,
    pub current: Option<u64>,
    pub total: Option<u64>,
    pub speed: Option<String>,
    pub message: String,
}

// ============================================================================
// Parsing helpers
// ============================================================================

/// Parse `git --version` output → version string.
/// Input: "git version 2.47.1.windows.1" or "git version 2.47.1"
/// Output: "2.47.1"
pub fn parse_version(output: &str) -> Option<String> {
    let re = Regex::new(r"git version (\d+\.\d+\.\d+)").ok()?;
    re.captures(output.trim())
        .and_then(|caps| caps.get(1))
        .map(|m| m.as_str().to_string())
}

/// Parse `git config --global --list` output → Vec<GitConfigEntry>
pub fn parse_config_list(output: &str) -> Vec<GitConfigEntry> {
    output
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() {
                return None;
            }
            let mut parts = line.splitn(2, '=');
            let key = parts.next()?.trim().to_string();
            let value = parts.next().unwrap_or("").to_string();
            if key.is_empty() {
                return None;
            }
            Some(GitConfigEntry { key, value })
        })
        .collect()
}

/// Parse `git log --format="%H\x1f%P\x1f%an\x1f%ae\x1f%aI\x1f%s"` output
pub fn parse_log_output(output: &str) -> Vec<GitCommitEntry> {
    output
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() {
                return None;
            }
            let fields: Vec<&str> = line.split(FIELD_SEP).collect();
            if fields.len() < 6 {
                return None;
            }
            let parents: Vec<String> = fields[1]
                .split_whitespace()
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string())
                .collect();
            Some(GitCommitEntry {
                hash: fields[0].to_string(),
                parents,
                author_name: fields[2].to_string(),
                author_email: fields[3].to_string(),
                date: fields[4].to_string(),
                message: fields[5..].join(&FIELD_SEP.to_string()),
            })
        })
        .collect()
}

/// Parse `git for-each-ref --format="%(refname:short)\x1f%(objectname:short)\x1f%(upstream:short)\x1f%(HEAD)\x1f%(refname:strip=1)"` output
pub fn parse_branches(output: &str) -> Vec<GitBranchInfo> {
    output
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() {
                return None;
            }
            let fields: Vec<&str> = line.split(FIELD_SEP).collect();
            if fields.is_empty() {
                return None;
            }
            let name = fields[0].to_string();
            let short_hash = fields.get(1).unwrap_or(&"").to_string();
            let upstream_raw = fields.get(2).unwrap_or(&"").to_string();
            let upstream = if upstream_raw.is_empty() {
                None
            } else {
                Some(upstream_raw)
            };
            let head_marker = fields.get(3).unwrap_or(&"").trim();
            let is_current = head_marker == "*";
            // %(refname:strip=1) yields "heads/..." for local or "remotes/..." for remote refs
            let ref_path = fields.get(4).unwrap_or(&"").trim();
            let is_remote = ref_path.starts_with("remotes/");
            Some(GitBranchInfo {
                name,
                short_hash,
                upstream,
                is_current,
                is_remote,
            })
        })
        .collect()
}

/// Parse `git remote -v` output → Vec<GitRemoteInfo> (deduplicated)
pub fn parse_remotes(output: &str) -> Vec<GitRemoteInfo> {
    let mut map: HashMap<String, (String, String)> = HashMap::new();
    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        // Format: "origin\thttps://github.com/user/repo.git (fetch)"
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() < 2 {
            continue;
        }
        let name = parts[0].to_string();
        let url_and_type = parts[1].trim();
        let entry = map
            .entry(name)
            .or_insert_with(|| (String::new(), String::new()));
        if url_and_type.ends_with("(fetch)") {
            entry.0 = url_and_type.trim_end_matches("(fetch)").trim().to_string();
        } else if url_and_type.ends_with("(push)") {
            entry.1 = url_and_type.trim_end_matches("(push)").trim().to_string();
        }
    }
    let mut remotes: Vec<GitRemoteInfo> = map
        .into_iter()
        .map(|(name, (fetch_url, push_url))| GitRemoteInfo {
            name,
            fetch_url: fetch_url.clone(),
            push_url: if push_url.is_empty() {
                fetch_url
            } else {
                push_url
            },
        })
        .collect();
    remotes.sort_by(|a, b| a.name.cmp(&b.name));
    remotes
}

/// Parse `git tag --sort=-creatordate --format="%(refname:short)\x1f%(objectname:short)\x1f%(creatordate:iso8601)"` output
pub fn parse_tags(output: &str) -> Vec<GitTagInfo> {
    output
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() {
                return None;
            }
            let fields: Vec<&str> = line.split(FIELD_SEP).collect();
            if fields.is_empty() {
                return None;
            }
            let name = fields[0].to_string();
            let short_hash = fields.get(1).unwrap_or(&"").to_string();
            let date_raw = fields.get(2).unwrap_or(&"").trim().to_string();
            let date = if date_raw.is_empty() {
                None
            } else {
                Some(date_raw)
            };
            Some(GitTagInfo {
                name,
                short_hash,
                date,
            })
        })
        .collect()
}

/// Parse `git stash list --format="%gd\x1f%s\x1f%aI"` output
pub fn parse_stashes(output: &str) -> Vec<GitStashEntry> {
    output
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() {
                return None;
            }
            let fields: Vec<&str> = line.split(FIELD_SEP).collect();
            if fields.len() < 3 {
                return None;
            }
            Some(GitStashEntry {
                id: fields[0].to_string(),
                message: fields[1].to_string(),
                date: fields[2].to_string(),
            })
        })
        .collect()
}

/// Parse `git shortlog -sne --all` output → Vec<GitContributor>
pub fn parse_contributors(output: &str) -> Vec<GitContributor> {
    let re = Regex::new(r"^\s*(\d+)\t(.+)\s<(.+)>$").unwrap();
    output
        .lines()
        .filter_map(|line| {
            let caps = re.captures(line)?;
            let count: u32 = caps.get(1)?.as_str().parse().ok()?;
            let name = caps.get(2)?.as_str().trim().to_string();
            let email = caps.get(3)?.as_str().trim().to_string();
            Some(GitContributor {
                name,
                email,
                commit_count: count,
            })
        })
        .collect()
}

/// Parse `git diff-tree --no-commit-id --numstat -r <commit>` output
pub fn parse_diff_stats(output: &str) -> Vec<GitDiffFile> {
    output
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() {
                return None;
            }
            let parts: Vec<&str> = line.split('\t').collect();
            if parts.len() < 3 {
                return None;
            }
            // Binary files show "-" for insertions/deletions
            let insertions = parts[0].parse::<u32>().unwrap_or(0);
            let deletions = parts[1].parse::<u32>().unwrap_or(0);
            let path = parts[2..].join("\t");
            Some(GitDiffFile {
                path,
                insertions,
                deletions,
            })
        })
        .collect()
}

/// Parse `git blame --line-porcelain <file>` output
pub fn parse_blame_porcelain(output: &str) -> Vec<GitBlameEntry> {
    let mut entries = Vec::new();
    let mut current_hash = String::new();
    let mut current_author = String::new();
    let mut current_email = String::new();
    let mut current_timestamp: i64 = 0;
    let mut current_summary = String::new();
    let mut current_line_no: u32 = 0;
    let mut in_block = false;

    for line in output.lines() {
        if !in_block {
            // First line of a block: <40-char hash> <orig_line> <final_line> [<num_lines>]
            if line.len() >= 40 && line.chars().take(40).all(|c| c.is_ascii_hexdigit()) {
                let parts: Vec<&str> = line.split_whitespace().collect();
                current_hash = parts[0].to_string();
                current_line_no = parts.get(2).and_then(|s| s.parse().ok()).unwrap_or(0);
                in_block = true;
            }
        } else if let Some(rest) = line.strip_prefix("author ") {
            current_author = rest.to_string();
        } else if let Some(rest) = line.strip_prefix("author-mail ") {
            current_email = rest
                .trim_start_matches('<')
                .trim_end_matches('>')
                .to_string();
        } else if let Some(rest) = line.strip_prefix("author-time ") {
            current_timestamp = rest.parse().unwrap_or(0);
        } else if let Some(rest) = line.strip_prefix("summary ") {
            current_summary = rest.to_string();
        } else if let Some(content) = line.strip_prefix('\t') {
            // Content line — marks end of this block
            entries.push(GitBlameEntry {
                commit_hash: current_hash.clone(),
                author: current_author.clone(),
                author_email: current_email.clone(),
                timestamp: current_timestamp,
                summary: current_summary.clone(),
                line_number: current_line_no,
                content: content.to_string(),
            });
            in_block = false;
        }
    }
    entries
}

/// Parse `git status --porcelain` output into counts
pub fn parse_status_porcelain(output: &str) -> (u32, u32, u32) {
    let mut staged = 0u32;
    let mut modified = 0u32;
    let mut untracked = 0u32;
    for line in output.lines() {
        if line.len() < 2 {
            continue;
        }
        let index = line.as_bytes()[0];
        let worktree = line.as_bytes()[1];
        if index == b'?' && worktree == b'?' {
            untracked += 1;
        } else {
            if index != b' ' && index != b'?' {
                staged += 1;
            }
            if worktree != b' ' && worktree != b'?' {
                modified += 1;
            }
        }
    }
    (staged, modified, untracked)
}

/// Parse `git status --porcelain` output into file-level details
pub fn parse_status_files(output: &str) -> Vec<GitStatusFile> {
    output
        .lines()
        .filter_map(|line| {
            if line.len() < 4 {
                return None;
            }
            let index_status = (line.as_bytes()[0] as char).to_string();
            let worktree_status = (line.as_bytes()[1] as char).to_string();
            let rest = &line[3..];
            // Renames show "old -> new"
            if rest.contains(" -> ") {
                let parts: Vec<&str> = rest.splitn(2, " -> ").collect();
                Some(GitStatusFile {
                    path: parts.get(1).unwrap_or(&"").to_string(),
                    index_status,
                    worktree_status,
                    old_path: Some(parts[0].to_string()),
                })
            } else {
                Some(GitStatusFile {
                    path: rest.to_string(),
                    index_status,
                    worktree_status,
                    old_path: None,
                })
            }
        })
        .collect()
}

/// Parse `git log --all --topo-order --format="%H\x1f%P\x1f%D\x1f%an\x1f%aI\x1f%s"` output
pub fn parse_graph_log(output: &str) -> Vec<GitGraphEntry> {
    output
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() {
                return None;
            }
            let fields: Vec<&str> = line.split(FIELD_SEP).collect();
            if fields.len() < 6 {
                return None;
            }
            let parents: Vec<String> = fields[1]
                .split_whitespace()
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string())
                .collect();
            let refs: Vec<String> = if fields[2].trim().is_empty() {
                vec![]
            } else {
                fields[2]
                    .split(", ")
                    .map(|s| s.trim().to_string())
                    .collect()
            };
            Some(GitGraphEntry {
                hash: fields[0].to_string(),
                parents,
                refs,
                author_name: fields[3].to_string(),
                date: fields[4].to_string(),
                message: fields[5..].join(&FIELD_SEP.to_string()),
            })
        })
        .collect()
}

fn build_graph_log_args(
    limit: u32,
    all_branches: bool,
    first_parent: bool,
    branch: Option<&str>,
) -> Vec<String> {
    let format_str = format!(
        "%H{}%P{}%D{}%an{}%aI{}%s",
        FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP
    );
    let format_arg = format!("--format={}", format_str);
    let limit_str = format!("-{}", limit);

    // NOTE: %D decorations are only populated when decoration is enabled.
    // Also force deterministic output without color codes.
    let mut args = vec![
        "log".to_string(),
        "--topo-order".to_string(),
        "--decorate=short".to_string(),
        "--no-color".to_string(),
        format_arg,
        limit_str,
    ];

    if first_parent {
        args.push("--first-parent".to_string());
    }

    // Mutual exclusion: if branch is specified, it takes precedence over --all.
    if all_branches && branch.is_none() {
        args.push("--all".to_string());
    }

    if let Some(b) = branch {
        args.push(b.to_string());
    }

    args
}

/// Parse ahead/behind output from `git rev-list --left-right --count`
pub fn parse_ahead_behind(output: &str) -> GitAheadBehind {
    let parts: Vec<&str> = output.trim().split('\t').collect();
    let ahead = parts.first().and_then(|s| s.parse().ok()).unwrap_or(0);
    let behind = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
    GitAheadBehind { ahead, behind }
}

/// Parse date strings from git log and group by date for activity heatmap
pub fn parse_activity(output: &str) -> Vec<GitDayActivity> {
    let mut counts: HashMap<String, u32> = HashMap::new();
    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        // ISO 8601 date: "2025-01-15T10:30:00+08:00" → take first 10 chars
        let date = if line.len() >= 10 {
            line[..10].to_string()
        } else {
            line.to_string()
        };
        *counts.entry(date).or_insert(0) += 1;
    }
    let mut result: Vec<GitDayActivity> = counts
        .into_iter()
        .map(|(date, commit_count)| GitDayActivity { date, commit_count })
        .collect();
    result.sort_by(|a, b| a.date.cmp(&b.date));
    result
}

/// Parse `git log --numstat --format="%H\x1f%an\x1f%aI"` output for file stats
/// The format produces alternating metadata lines and numstat lines
pub fn parse_file_stats(output: &str) -> Vec<GitFileStatEntry> {
    let mut entries = Vec::new();
    let mut current_hash = String::new();
    let mut current_author = String::new();
    let mut current_date = String::new();

    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        // Check if this is a metadata line (contains FIELD_SEP)
        if line.contains(FIELD_SEP) {
            let fields: Vec<&str> = line.split(FIELD_SEP).collect();
            if fields.len() >= 3 {
                current_hash = fields[0].to_string();
                current_author = fields[1].to_string();
                current_date = fields[2].to_string();
            }
        } else if !current_hash.is_empty() {
            // This is a numstat line: "10\t5\tfilename"
            let parts: Vec<&str> = line.split('\t').collect();
            if parts.len() >= 3 {
                let additions = parts[0].parse::<u32>().unwrap_or(0);
                let deletions = parts[1].parse::<u32>().unwrap_or(0);
                entries.push(GitFileStatEntry {
                    hash: current_hash.clone(),
                    author_name: current_author.clone(),
                    date: current_date.clone(),
                    additions,
                    deletions,
                });
            }
        }
    }
    entries
}

/// Parse `git reflog show --format="%H\x1f%gd\x1f%gs\x1f%aI"` output
pub fn parse_reflog(output: &str) -> Vec<GitReflogEntry> {
    output
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() {
                return None;
            }
            let fields: Vec<&str> = line.split(FIELD_SEP).collect();
            if fields.len() < 4 {
                return None;
            }
            let subject = fields[2];
            let action = subject
                .split(':')
                .next()
                .unwrap_or(subject)
                .trim()
                .to_string();
            Some(GitReflogEntry {
                hash: fields[0].to_string(),
                selector: fields[1].to_string(),
                action,
                message: subject.to_string(),
                date: fields[3].to_string(),
            })
        })
        .collect()
}

// ============================================================================
// Submodule, Worktree, LFS parsing helpers
// ============================================================================

/// Parse `git submodule status --recursive` output
/// Format: `[+-U ]<sha1> <path> (<describe>)` or `[+-U ]<sha1> <path>`
pub fn parse_submodule_status(output: &str) -> Vec<GitSubmoduleInfo> {
    output
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() {
                return None;
            }
            // First char is status indicator: ' '=initialized, '-'=uninitialized, '+'=modified, 'U'=conflict
            let status_char = line.chars().next().unwrap_or(' ');
            let status = match status_char {
                '-' => "uninitialized",
                '+' => "modified",
                'U' => "conflict",
                _ => "initialized",
            }
            .to_string();

            let rest = if matches!(status_char, '-' | '+' | 'U') {
                &line[1..]
            } else {
                line
            };
            let parts: Vec<&str> = rest.trim().splitn(3, ' ').collect();
            if parts.len() < 2 {
                return None;
            }
            let hash = parts[0].to_string();
            let path = parts[1].to_string();
            let describe = parts
                .get(2)
                .unwrap_or(&"")
                .trim_start_matches('(')
                .trim_end_matches(')')
                .to_string();
            Some(GitSubmoduleInfo {
                path,
                hash,
                status,
                describe,
            })
        })
        .collect()
}

/// Parse `git worktree list --porcelain` output
/// Format: blocks separated by blank lines, each block:
///   worktree <path>
///   HEAD <sha>
///   branch refs/heads/<name>  (or "detached")
///   bare (optional)
pub fn parse_worktree_list(output: &str) -> Vec<GitWorktreeInfo> {
    let mut worktrees = Vec::new();
    let mut current_path = String::new();
    let mut current_head = String::new();
    let mut current_branch: Option<String> = None;
    let mut is_bare = false;
    let mut is_detached = false;

    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            if !current_path.is_empty() {
                worktrees.push(GitWorktreeInfo {
                    path: current_path.clone(),
                    head: current_head.clone(),
                    branch: current_branch.take(),
                    is_bare,
                    is_detached,
                });
                current_path.clear();
                current_head.clear();
                is_bare = false;
                is_detached = false;
            }
            continue;
        }
        if let Some(p) = line.strip_prefix("worktree ") {
            current_path = p.to_string();
        } else if let Some(h) = line.strip_prefix("HEAD ") {
            current_head = h.to_string();
        } else if let Some(b) = line.strip_prefix("branch ") {
            // Strip "refs/heads/" prefix for display
            current_branch = Some(b.strip_prefix("refs/heads/").unwrap_or(b).to_string());
        } else if line == "bare" {
            is_bare = true;
        } else if line == "detached" {
            is_detached = true;
        }
    }
    // Handle last entry (no trailing blank line)
    if !current_path.is_empty() {
        worktrees.push(GitWorktreeInfo {
            path: current_path,
            head: current_head,
            branch: current_branch,
            is_bare,
            is_detached,
        });
    }
    worktrees
}

/// Parse `git lfs ls-files --long` output
/// Format: `<oid> <status> <name>`  where status is '*' (pointer) or '-' (full)
pub fn parse_lfs_ls_files(output: &str) -> Vec<GitLfsFile> {
    output
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() {
                return None;
            }
            // Format: "<oid_prefix> <*|-> <filename>"
            let parts: Vec<&str> = line.splitn(3, ' ').collect();
            if parts.len() < 3 {
                return None;
            }
            Some(GitLfsFile {
                oid: parts[0].to_string(),
                pointer_status: parts[1].to_string(),
                name: parts[2].to_string(),
            })
        })
        .collect()
}

// ============================================================================
// Clone progress parsing & URL helpers
// ============================================================================

/// Cached regex patterns for clone progress parsing
fn percent_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(\d+)%").unwrap())
}

fn count_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"\((\d+)/(\d+)\)").unwrap())
}

fn speed_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"\|\s*([\d.]+\s*[KMG]?i?B/s)").unwrap())
}

/// Parse a git clone progress line from stderr.
/// Git clone with `--progress` emits lines like:
///   "Cloning into 'repo'..."
///   "remote: Enumerating objects: 100, done."
///   "remote: Counting objects: 100% (50/50), done."
///   "Receiving objects:  45% (100/222), 1.20 MiB | 512.00 KiB/s"
///   "Resolving deltas: 100% (80/80), done."
///   "Checking out files:  67% (100/150)"
pub fn parse_clone_progress(line: &str) -> Option<GitCloneProgress> {
    let line = line.trim();
    if line.is_empty() {
        return None;
    }

    // "Cloning into 'repo'..." — initial phase
    if line.starts_with("Cloning into") {
        return Some(GitCloneProgress {
            phase: "cloning_into".to_string(),
            percent: None,
            current: None,
            total: None,
            speed: None,
            message: line.to_string(),
        });
    }

    // Strip optional "remote: " prefix
    let content = line.strip_prefix("remote: ").unwrap_or(line);

    let phase = if content.starts_with("Enumerating") {
        "enumerating"
    } else if content.starts_with("Counting") {
        "counting"
    } else if content.starts_with("Compressing") {
        "compressing"
    } else if content.starts_with("Receiving") {
        "receiving"
    } else if content.starts_with("Resolving") {
        "resolving"
    } else if content.starts_with("Checking out") {
        "checking_out"
    } else {
        return None;
    };

    let percent = percent_regex()
        .captures(content)
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().parse::<u32>().ok());

    let (current, total) = if let Some(caps) = count_regex().captures(content) {
        let cur = caps.get(1).and_then(|m| m.as_str().parse::<u64>().ok());
        let tot = caps.get(2).and_then(|m| m.as_str().parse::<u64>().ok());
        (cur, tot)
    } else {
        (None, None)
    };

    let speed = speed_regex()
        .captures(content)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string());

    Some(GitCloneProgress {
        phase: phase.to_string(),
        percent,
        current,
        total,
        speed,
        message: line.to_string(),
    })
}

/// Extract repository name from a git URL (any host).
/// Handles HTTPS, SSH, git:// protocols and local paths.
pub fn extract_repo_name(url: &str) -> Option<String> {
    let url = url.trim();
    if url.is_empty() {
        return None;
    }

    // Strip trailing slashes and .git suffix
    let cleaned = url.trim_end_matches('/').trim_end_matches(".git");
    if cleaned.is_empty() {
        return None;
    }

    // SSH format: git@host:path/repo
    if let Some(after_at) = cleaned.strip_prefix("git@") {
        if let Some(colon_pos) = after_at.find(':') {
            let path = &after_at[colon_pos + 1..];
            return path
                .rsplit('/')
                .next()
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty());
        }
    }

    // URL format: scheme://host/path/repo
    if cleaned.contains("://") {
        return cleaned
            .rsplit('/')
            .next()
            .map(|s| s.to_string())
            .filter(|s| !s.is_empty());
    }

    // Local path or bare name: extract basename
    #[cfg(windows)]
    let name = cleaned.rsplit(&['/', '\\'][..]).next();
    #[cfg(not(windows))]
    let name = cleaned.rsplit('/').next();

    name.map(|s| s.to_string()).filter(|s| !s.is_empty())
}

/// Validate whether a string looks like a valid git remote URL.
/// Accepts: HTTPS, HTTP, git://, ssh://, file://, SSH shorthand (user@host:path), local paths.
pub fn validate_git_url(url: &str) -> bool {
    let url = url.trim();
    if url.is_empty() {
        return false;
    }

    // HTTPS/HTTP/git://ssh:// protocol
    for scheme in &["https://", "http://", "git://", "ssh://"] {
        if let Some(rest) = url.strip_prefix(scheme) {
            return rest.contains('/') && rest.len() > 3;
        }
    }

    // file:// protocol (local clone)
    if let Some(rest) = url.strip_prefix("file://") {
        return !rest.is_empty();
    }

    // SSH shorthand: user@host:path (not just git@)
    if url.contains('@') && url.contains(':') {
        if let Some(at_pos) = url.find('@') {
            let after_at = &url[at_pos + 1..];
            if let Some(colon_pos) = after_at.find(':') {
                // Ensure there's content before @, between @ and :, and after :
                return at_pos > 0 && colon_pos > 0 && colon_pos + 1 < after_at.len();
            }
        }
    }

    // Local absolute path — Windows drive letter or Unix absolute path
    #[cfg(windows)]
    {
        if url.len() >= 3
            && url.as_bytes()[1] == b':'
            && (url.as_bytes()[2] == b'\\' || url.as_bytes()[2] == b'/')
        {
            return true;
        }
    }
    if url.starts_with('/') && url.len() > 1 {
        return true;
    }

    false
}

/// Build clone args from GitCloneOptions
fn build_clone_args(url: &str, dest_path: &str, options: &GitCloneOptions) -> Vec<String> {
    let mut args: Vec<String> = vec!["clone".into()];
    if let Some(ref b) = options.branch {
        args.push("--branch".into());
        args.push(b.clone());
    }
    if let Some(d) = options.depth {
        args.push(format!("--depth={}", d));
    }
    if options.single_branch == Some(true) {
        args.push("--single-branch".into());
    }
    if options.recurse_submodules == Some(true) {
        args.push("--recurse-submodules".into());
    }
    if options.shallow_submodules == Some(true) {
        args.push("--shallow-submodules".into());
    }
    if options.no_checkout == Some(true) {
        args.push("--no-checkout".into());
    }
    if options.bare == Some(true) {
        args.push("--bare".into());
    }
    if options.mirror == Some(true) {
        args.push("--mirror".into());
    }
    if options.sparse == Some(true) {
        args.push("--sparse".into());
    }
    if let Some(ref f) = options.filter {
        args.push(format!("--filter={}", f));
    }
    if let Some(j) = options.jobs {
        args.push(format!("--jobs={}", j));
    }
    if options.no_tags == Some(true) {
        args.push("--no-tags".into());
    }
    if let Some(ref name) = options.remote_name {
        args.push("--origin".into());
        args.push(name.clone());
    }
    args.push("--progress".into());
    args.push(url.into());
    args.push(dest_path.into());
    args
}

// ============================================================================
// GitProvider
// ============================================================================

pub struct GitProvider;

impl Default for GitProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl GitProvider {
    pub fn new() -> Self {
        Self
    }

    /// Detect which system package manager is available for installing git
    async fn detect_package_manager(&self) -> Option<&'static str> {
        #[cfg(windows)]
        {
            if process::which("winget").await.is_some() {
                return Some("winget");
            }
            if process::which("scoop").await.is_some() {
                return Some("scoop");
            }
            if process::which("choco").await.is_some() {
                return Some("choco");
            }
        }
        #[cfg(target_os = "macos")]
        {
            if process::which("brew").await.is_some() {
                return Some("brew");
            }
            if process::which("port").await.is_some() {
                return Some("macports");
            }
        }
        #[cfg(target_os = "linux")]
        {
            if process::which("apt-get").await.is_some() {
                return Some("apt");
            }
            if process::which("dnf").await.is_some() {
                return Some("dnf");
            }
            if process::which("pacman").await.is_some() {
                return Some("pacman");
            }
        }
        None
    }

    /// Get the installed git version string
    pub async fn get_git_version(&self) -> CogniaResult<Option<String>> {
        match process::execute("git", &["--version"], Some(make_opts())).await {
            Ok(out) if out.success => Ok(parse_version(&out.stdout)),
            _ => Ok(None),
        }
    }

    /// Get git executable path
    pub async fn get_git_path(&self) -> Option<String> {
        process::which("git").await
    }

    /// Install git using the detected system package manager
    pub async fn install_git(&self) -> CogniaResult<String> {
        let pm = self.detect_package_manager().await.ok_or_else(|| {
            CogniaError::Provider("No supported package manager found to install Git".into())
        })?;

        let result = match pm {
            "winget" => {
                process::execute(
                    "winget",
                    &[
                        "install",
                        "Git.Git",
                        "--silent",
                        "--accept-source-agreements",
                        "--disable-interactivity",
                    ],
                    Some(make_install_opts()),
                )
                .await
            }
            "scoop" => {
                process::execute("scoop", &["install", "git"], Some(make_install_opts())).await
            }
            "choco" => {
                process::execute(
                    "choco",
                    &["install", "git", "-y", "--no-progress"],
                    Some(make_install_opts()),
                )
                .await
            }
            "brew" => {
                process::execute("brew", &["install", "git"], Some(make_install_opts())).await
            }
            "macports" => {
                process::execute(
                    "sudo",
                    &["port", "install", "git"],
                    Some(make_install_opts()),
                )
                .await
            }
            "apt" => {
                process::execute(
                    "sudo",
                    &["apt-get", "install", "-y", "git"],
                    Some(make_install_opts()),
                )
                .await
            }
            "dnf" => {
                process::execute(
                    "sudo",
                    &["dnf", "install", "-y", "git"],
                    Some(make_install_opts()),
                )
                .await
            }
            "pacman" => {
                process::execute(
                    "sudo",
                    &["pacman", "-S", "--noconfirm", "git"],
                    Some(make_install_opts()),
                )
                .await
            }
            _ => {
                return Err(CogniaError::Provider(format!(
                    "Unsupported package manager: {}",
                    pm
                )))
            }
        };

        match result {
            Ok(out) if out.success => Ok(format!("Git installed successfully via {}", pm)),
            Ok(out) => {
                let err = if out.stderr.trim().is_empty() {
                    out.stdout.trim().to_string()
                } else {
                    out.stderr.trim().to_string()
                };
                Err(CogniaError::Provider(format!(
                    "Git installation failed via {}: {}",
                    pm, err
                )))
            }
            Err(e) => Err(CogniaError::Provider(format!(
                "Git installation failed via {}: {}",
                pm, e
            ))),
        }
    }

    /// Update git to the latest version
    pub async fn update_git(&self) -> CogniaResult<String> {
        // On Windows, try `git update-git-for-windows` first
        #[cfg(windows)]
        {
            if let Ok(out) = process::execute(
                "git",
                &["update-git-for-windows"],
                Some(make_install_opts()),
            )
            .await
            {
                if out.success {
                    return Ok("Git updated successfully via git update-git-for-windows".into());
                }
            }
        }

        // Fall back to using the system package manager
        let pm = self.detect_package_manager().await.ok_or_else(|| {
            CogniaError::Provider("No supported package manager found to update Git".into())
        })?;

        let result = match pm {
            "winget" => {
                process::execute(
                    "winget",
                    &[
                        "upgrade",
                        "Git.Git",
                        "--silent",
                        "--accept-source-agreements",
                        "--disable-interactivity",
                    ],
                    Some(make_install_opts()),
                )
                .await
            }
            "scoop" => {
                process::execute("scoop", &["update", "git"], Some(make_install_opts())).await
            }
            "choco" => {
                process::execute(
                    "choco",
                    &["upgrade", "git", "-y", "--no-progress"],
                    Some(make_install_opts()),
                )
                .await
            }
            "brew" => {
                process::execute("brew", &["upgrade", "git"], Some(make_install_opts())).await
            }
            "macports" => {
                process::execute(
                    "sudo",
                    &["port", "upgrade", "git"],
                    Some(make_install_opts()),
                )
                .await
            }
            "apt" => {
                process::execute(
                    "sudo",
                    &["apt-get", "install", "--only-upgrade", "-y", "git"],
                    Some(make_install_opts()),
                )
                .await
            }
            "dnf" => {
                process::execute(
                    "sudo",
                    &["dnf", "upgrade", "-y", "git"],
                    Some(make_install_opts()),
                )
                .await
            }
            "pacman" => {
                process::execute(
                    "sudo",
                    &["pacman", "-S", "--noconfirm", "git"],
                    Some(make_install_opts()),
                )
                .await
            }
            _ => {
                return Err(CogniaError::Provider(format!(
                    "Unsupported package manager: {}",
                    pm
                )))
            }
        };

        match result {
            Ok(out) if out.success => Ok(format!("Git updated successfully via {}", pm)),
            Ok(out) => {
                let err = if out.stderr.trim().is_empty() {
                    out.stdout
                } else {
                    out.stderr
                };
                Err(CogniaError::Provider(format!(
                    "Git update failed via {}: {}",
                    pm,
                    err.trim()
                )))
            }
            Err(e) => Err(CogniaError::Provider(format!(
                "Git update failed via {}: {}",
                pm, e
            ))),
        }
    }

    /// Get all global git config entries
    pub async fn get_config_list(&self) -> CogniaResult<Vec<GitConfigEntry>> {
        match run_git_lenient_with_opts(&["config", "--global", "--list"], make_config_read_opts())
            .await
        {
            Ok(output) => Ok(parse_config_list(&output)),
            Err(e) => Err(classify_config_read_error("git config --global --list", e)),
        }
    }

    /// Set a global git config value
    pub async fn set_config(&self, key: &str, value: &str) -> CogniaResult<()> {
        run_git(&["config", "--global", key, value]).await?;
        Ok(())
    }

    /// Remove a global git config key
    pub async fn remove_config(&self, key: &str) -> CogniaResult<()> {
        run_git(&["config", "--global", "--unset", key]).await?;
        Ok(())
    }

    /// Get a single global git config value by key
    pub async fn get_config_value(&self, key: &str) -> CogniaResult<Option<String>> {
        match run_git_lenient_with_opts(
            &["config", "--global", "--get", key],
            make_config_read_opts(),
        )
        .await
        {
            Ok(v) => {
                let trimmed = v.trim().to_string();
                if trimmed.is_empty() {
                    Ok(None)
                } else {
                    Ok(Some(trimmed))
                }
            }
            Err(e) => Err(classify_config_read_error(
                &format!("git config --global --get {}", key),
                e,
            )),
        }
    }

    /// Get the path to the global git config file
    pub async fn get_config_file_path(&self) -> CogniaResult<Option<String>> {
        match run_git_lenient_with_opts(
            &["config", "--global", "--list", "--show-origin"],
            make_config_read_opts(),
        )
        .await
        {
            Ok(output) => {
                // First line format: "file:/path/to/.gitconfig\tkey=value"
                if let Some(first_line) = output.lines().next() {
                    if let Some(rest) = first_line.strip_prefix("file:") {
                        if let Some(tab_pos) = rest.find('\t') {
                            return Ok(Some(rest[..tab_pos].to_string()));
                        }
                    }
                }
                Ok(None)
            }
            Err(_) => Ok(None),
        }
    }

    /// List all git aliases (alias.* entries)
    pub async fn list_aliases(&self) -> CogniaResult<Vec<GitConfigEntry>> {
        match run_git_lenient_with_opts(
            &["config", "--global", "--get-regexp", "^alias\\."],
            make_config_read_opts(),
        )
        .await
        {
            Ok(output) => {
                Ok(output
                    .lines()
                    .filter_map(|line| {
                        let line = line.trim();
                        if line.is_empty() {
                            return None;
                        }
                        // Format: "alias.co checkout"
                        let mut parts = line.splitn(2, ' ');
                        let full_key = parts.next()?.trim();
                        let value = parts.next().unwrap_or("").to_string();
                        let alias_name = full_key.strip_prefix("alias.")?;
                        Some(GitConfigEntry {
                            key: alias_name.to_string(),
                            value,
                        })
                    })
                    .collect())
            }
            Err(_) => Ok(vec![]),
        }
    }

    /// Set a global git config value only if it's not already set
    pub async fn set_config_if_unset(&self, key: &str, value: &str) -> CogniaResult<bool> {
        match self.get_config_value(key).await? {
            Some(_) => Ok(false), // already set
            None => {
                self.set_config(key, value).await?;
                Ok(true) // newly set
            }
        }
    }

    /// Open the global git config file in the default editor
    pub async fn open_config_in_editor(&self) -> CogniaResult<String> {
        run_git(&["config", "--global", "--edit"]).await
    }

    // ========================================================================
    // Repository inspection methods
    // ========================================================================

    /// Get repository information for a given path
    pub async fn get_repo_info(&self, path: &str) -> CogniaResult<GitRepoInfo> {
        let root = run_git_in(path, &["rev-parse", "--show-toplevel"]).await?;

        let branch = run_git_in(path, &["symbolic-ref", "--short", "HEAD"])
            .await
            .unwrap_or_else(|_| "HEAD (detached)".into());

        let status_output = run_git_in_lenient(path, &["status", "--porcelain"])
            .await
            .unwrap_or_default();
        let (staged, modified, untracked) = parse_status_porcelain(&status_output);
        let is_dirty = staged > 0 || modified > 0 || untracked > 0;

        Ok(GitRepoInfo {
            root_path: root,
            current_branch: branch,
            is_dirty,
            file_count_staged: staged,
            file_count_modified: modified,
            file_count_untracked: untracked,
        })
    }

    /// Get commit log for a repository
    pub async fn get_log(
        &self,
        path: &str,
        limit: u32,
        skip: u32,
        author: Option<&str>,
        since: Option<&str>,
        until: Option<&str>,
        file: Option<&str>,
    ) -> CogniaResult<Vec<GitCommitEntry>> {
        let format_str = format!(
            "%H{}%P{}%an{}%ae{}%aI{}%s",
            FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP
        );
        let limit_str = format!("-{}", limit);
        let format_arg = format!("--format={}", format_str);
        let mut args = vec!["log", &format_arg, &limit_str];
        let skip_arg;
        if skip > 0 {
            skip_arg = format!("--skip={}", skip);
            args.push(&skip_arg);
        }

        let author_arg;
        if let Some(a) = author {
            author_arg = format!("--author={}", a);
            args.push(&author_arg);
        }
        let since_arg;
        if let Some(s) = since {
            since_arg = format!("--since={}", s);
            args.push(&since_arg);
        }
        let until_arg;
        if let Some(u) = until {
            until_arg = format!("--until={}", u);
            args.push(&until_arg);
        }
        let normalized_file;
        if let Some(f) = file {
            normalized_file = normalize_history_file_path(path, f).await?;
            args.push("--");
            args.push(&normalized_file);
        }

        let output = run_git_in_lenient(path, &args).await?;
        Ok(parse_log_output(&output))
    }

    /// Get branches for a repository
    pub async fn get_branches(&self, path: &str) -> CogniaResult<Vec<GitBranchInfo>> {
        let format_str = format!(
            "%(refname:short){}%(objectname:short){}%(upstream:short){}%(HEAD){}%(refname:strip=1)",
            FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP
        );
        let format_arg = format!("--format={}", format_str);
        let output = run_git_in_lenient(
            path,
            &["for-each-ref", &format_arg, "refs/heads", "refs/remotes"],
        )
        .await?;
        Ok(parse_branches(&output))
    }

    /// Get remotes for a repository
    pub async fn get_remotes(&self, path: &str) -> CogniaResult<Vec<GitRemoteInfo>> {
        let output = run_git_in_lenient(path, &["remote", "-v"]).await?;
        Ok(parse_remotes(&output))
    }

    /// Get tags for a repository
    pub async fn get_tags(&self, path: &str) -> CogniaResult<Vec<GitTagInfo>> {
        let format_str = format!(
            "%(refname:short){}%(objectname:short){}%(creatordate:iso8601)",
            FIELD_SEP, FIELD_SEP
        );
        let format_arg = format!("--format={}", format_str);
        let output = run_git_in_lenient(path, &["tag", "--sort=-creatordate", &format_arg]).await?;
        Ok(parse_tags(&output))
    }

    /// Get stash list for a repository
    pub async fn get_stashes(&self, path: &str) -> CogniaResult<Vec<GitStashEntry>> {
        let format_str = format!("%gd{}%s{}%aI", FIELD_SEP, FIELD_SEP);
        let format_arg = format!("--format={}", format_str);
        let output = run_git_in_lenient(path, &["stash", "list", &format_arg]).await?;
        Ok(parse_stashes(&output))
    }

    /// Get contributors for a repository
    pub async fn get_contributors(&self, path: &str) -> CogniaResult<Vec<GitContributor>> {
        let output = run_git_in_lenient(path, &["shortlog", "-sne", "--all"]).await?;
        Ok(parse_contributors(&output))
    }

    /// Get file history (commits that modified a specific file)
    pub async fn get_file_history(
        &self,
        path: &str,
        file: &str,
        limit: u32,
        skip: u32,
    ) -> CogniaResult<Vec<GitCommitEntry>> {
        let format_str = format!(
            "%H{}%P{}%an{}%ae{}%aI{}%s",
            FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP
        );
        let format_arg = format!("--format={}", format_str);
        let limit_str = format!("-{}", limit);
        let skip_arg;
        let normalized_file = normalize_history_file_path(path, file).await?;
        let mut args = vec!["log", &format_arg, &limit_str];
        if skip > 0 {
            skip_arg = format!("--skip={}", skip);
            args.push(&skip_arg);
        }
        args.extend_from_slice(&["--follow", "--", &normalized_file]);
        let output = run_git_in_lenient(path, &args).await?;

        Ok(parse_log_output(&output))
    }

    /// Get blame for a file
    pub async fn get_blame(&self, path: &str, file: &str) -> CogniaResult<Vec<GitBlameEntry>> {
        let normalized_file = normalize_history_file_path(path, file).await?;
        let output = run_git_in(path, &["blame", "--line-porcelain", &normalized_file]).await?;
        Ok(parse_blame_porcelain(&output))
    }

    // ========================================================================
    // New methods for GitLens-inspired features
    // ========================================================================

    /// Get detailed information about a specific commit (metadata + changed files)
    pub async fn get_commit_detail(&self, path: &str, hash: &str) -> CogniaResult<GitCommitDetail> {
        let format_str = format!(
            "%H{}%P{}%an{}%ae{}%aI{}%B",
            FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP
        );
        let format_arg = format!("--format={}", format_str);
        let meta_output = run_git_in(path, &["log", "-1", &format_arg, hash]).await?;
        let fields: Vec<&str> = meta_output.split(FIELD_SEP).collect();
        if fields.len() < 6 {
            return Err(CogniaError::Provider(format!(
                "git: invalid commit {}",
                hash
            )));
        }
        let parents: Vec<String> = fields[1]
            .split_whitespace()
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .collect();

        let diff_output = run_git_in_lenient(
            path,
            &["diff-tree", "--no-commit-id", "--numstat", "-r", hash],
        )
        .await
        .unwrap_or_default();
        let files = parse_diff_stats(&diff_output);
        let insertions: u32 = files.iter().map(|f| f.insertions).sum();
        let deletions: u32 = files.iter().map(|f| f.deletions).sum();

        Ok(GitCommitDetail {
            hash: fields[0].to_string(),
            parents,
            author_name: fields[2].to_string(),
            author_email: fields[3].to_string(),
            date: fields[4].to_string(),
            message: fields[5..].join(&FIELD_SEP.to_string()).trim().to_string(),
            files_changed: files.len() as u32,
            insertions,
            deletions,
            files,
        })
    }

    /// Get file-level status (paths instead of just counts)
    pub async fn get_status(&self, path: &str) -> CogniaResult<Vec<GitStatusFile>> {
        let output = run_git_in_lenient(path, &["status", "--porcelain"])
            .await
            .unwrap_or_default();
        Ok(parse_status_files(&output))
    }

    /// Get graph log with parent hashes and ref decorations for commit graph visualization
    pub async fn get_graph_log(
        &self,
        path: &str,
        limit: u32,
        all_branches: bool,
        first_parent: bool,
        branch: Option<&str>,
    ) -> CogniaResult<Vec<GitGraphEntry>> {
        let args_owned = build_graph_log_args(limit, all_branches, first_parent, branch);
        let args: Vec<&str> = args_owned.iter().map(|s| s.as_str()).collect();
        let output = run_git_in_lenient(path, &args).await?;
        Ok(parse_graph_log(&output))
    }

    /// Get ahead/behind counts for a branch relative to its upstream
    pub async fn get_ahead_behind(
        &self,
        path: &str,
        branch: &str,
        upstream: Option<&str>,
    ) -> CogniaResult<GitAheadBehind> {
        let upstream_ref = if let Some(u) = upstream {
            u.to_string()
        } else {
            // Try to determine upstream automatically
            match run_git_in(
                path,
                &[
                    "rev-parse",
                    "--abbrev-ref",
                    &format!("{}@{{upstream}}", branch),
                ],
            )
            .await
            {
                Ok(u) => u,
                Err(_) => {
                    return Ok(GitAheadBehind {
                        ahead: 0,
                        behind: 0,
                    })
                }
            }
        };
        let range = format!("{}...{}", branch, upstream_ref);
        let output = run_git_in_lenient(path, &["rev-list", "--left-right", "--count", &range])
            .await
            .unwrap_or_default();
        Ok(parse_ahead_behind(&output))
    }

    /// Checkout (switch to) a branch
    pub async fn checkout_branch(&self, path: &str, name: &str) -> CogniaResult<String> {
        run_git_in(path, &["checkout", name]).await
    }

    /// Create a new branch
    pub async fn create_branch(
        &self,
        path: &str,
        name: &str,
        start_point: Option<&str>,
    ) -> CogniaResult<String> {
        let mut args = vec!["branch", name];
        if let Some(sp) = start_point {
            args.push(sp);
        }
        run_git_in(path, &args).await?;
        Ok(format!("Branch '{}' created", name))
    }

    /// Delete a branch
    pub async fn delete_branch(&self, path: &str, name: &str, force: bool) -> CogniaResult<String> {
        let flag = if force { "-D" } else { "-d" };
        run_git_in(path, &["branch", flag, name]).await?;
        Ok(format!("Branch '{}' deleted", name))
    }

    /// Apply a stash
    pub async fn stash_apply(&self, path: &str, stash_id: Option<&str>) -> CogniaResult<String> {
        let mut args = vec!["stash", "apply"];
        if let Some(id) = stash_id {
            args.push(id);
        }
        run_git_in(path, &args).await
    }

    /// Pop a stash
    pub async fn stash_pop(&self, path: &str, stash_id: Option<&str>) -> CogniaResult<String> {
        let mut args = vec!["stash", "pop"];
        if let Some(id) = stash_id {
            args.push(id);
        }
        run_git_in(path, &args).await
    }

    /// Drop a stash
    pub async fn stash_drop(&self, path: &str, stash_id: Option<&str>) -> CogniaResult<String> {
        let mut args = vec!["stash", "drop"];
        if let Some(id) = stash_id {
            args.push(id);
        }
        run_git_in(path, &args).await
    }

    /// Save (create) a stash
    pub async fn stash_save(
        &self,
        path: &str,
        message: Option<&str>,
        include_untracked: bool,
    ) -> CogniaResult<String> {
        let mut args = vec!["stash", "push"];
        if include_untracked {
            args.push("-u");
        }
        if let Some(m) = message {
            args.push("-m");
            args.push(m);
        }
        run_git_in(path, &args).await
    }

    /// Create a tag (lightweight or annotated)
    pub async fn create_tag(
        &self,
        path: &str,
        name: &str,
        target_ref: Option<&str>,
        message: Option<&str>,
    ) -> CogniaResult<String> {
        let mut args = vec!["tag"];
        if let Some(m) = message {
            args.push("-a");
            args.push(name);
            if let Some(r) = target_ref {
                args.push(r);
            }
            args.push("-m");
            args.push(m);
        } else {
            args.push(name);
            if let Some(r) = target_ref {
                args.push(r);
            }
        }
        run_git_in(path, &args).await?;
        Ok(format!("Tag '{}' created", name))
    }

    /// Delete a tag
    pub async fn delete_tag(&self, path: &str, name: &str) -> CogniaResult<String> {
        run_git_in(path, &["tag", "-d", name]).await?;
        Ok(format!("Tag '{}' deleted", name))
    }

    /// Get activity data (commit counts per day) for heatmap
    pub async fn get_activity(&self, path: &str, days: u32) -> CogniaResult<Vec<GitDayActivity>> {
        let since_arg = format!("--since={} days ago", days);
        let output = run_git_in_lenient(path, &["log", "--all", "--format=%aI", &since_arg])
            .await
            .unwrap_or_default();
        Ok(parse_activity(&output))
    }

    /// Get file stats (additions/deletions per commit) for visual file history
    pub async fn get_file_stats(
        &self,
        path: &str,
        file: &str,
        limit: u32,
        skip: u32,
    ) -> CogniaResult<Vec<GitFileStatEntry>> {
        let format_str = format!("%H{}%an{}%aI", FIELD_SEP, FIELD_SEP);
        let format_arg = format!("--format={}", format_str);
        let limit_str = format!("-{}", limit);
        let skip_arg;
        let normalized_file = normalize_history_file_path(path, file).await?;
        let mut args = vec!["log", "--numstat", &format_arg, &limit_str];
        if skip > 0 {
            skip_arg = format!("--skip={}", skip);
            args.push(&skip_arg);
        }
        args.extend_from_slice(&["--follow", "--", &normalized_file]);
        let output = run_git_in_lenient(path, &args).await?;
        Ok(parse_file_stats(&output))
    }

    /// Search commits by message, author, or diff content
    pub async fn search_commits(
        &self,
        path: &str,
        query: &str,
        search_type: &str,
        limit: u32,
        skip: u32,
    ) -> CogniaResult<Vec<GitCommitEntry>> {
        let format_str = format!(
            "%H{}%P{}%an{}%ae{}%aI{}%s",
            FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP
        );
        let format_arg = format!("--format={}", format_str);
        let limit_str = format!("-{}", limit);
        let skip_arg;

        let search_arg;
        let mut args = vec!["log", &format_arg, &limit_str];
        if skip > 0 {
            skip_arg = format!("--skip={}", skip);
            args.push(&skip_arg);
        }
        match search_type {
            "message" => {
                search_arg = format!("--grep={}", query);
                args.push(&search_arg);
                args.push("-i");
            }
            "author" => {
                search_arg = format!("--author={}", query);
                args.push(&search_arg);
            }
            "diff" => {
                search_arg = format!("-S{}", query);
                args.push(&search_arg);
            }
            _ => {
                search_arg = format!("--grep={}", query);
                args.push(&search_arg);
                args.push("-i");
            }
        }

        let output = run_git_in_lenient(path, &args).await?;
        Ok(parse_log_output(&output))
    }

    // ========================================================================
    // Write operations: staging, committing, syncing
    // ========================================================================

    /// Stage specific files
    pub async fn stage_files(&self, path: &str, files: &[&str]) -> CogniaResult<String> {
        let mut args = vec!["add", "--"];
        args.extend_from_slice(files);
        run_git_in(path, &args).await?;
        Ok(format!("Staged {} file(s)", files.len()))
    }

    /// Stage all changes
    pub async fn stage_all(&self, path: &str) -> CogniaResult<String> {
        run_git_in(path, &["add", "-A"]).await?;
        Ok("All changes staged".into())
    }

    /// Unstage specific files (git restore --staged)
    pub async fn unstage_files(&self, path: &str, files: &[&str]) -> CogniaResult<String> {
        let mut args = vec!["restore", "--staged", "--"];
        args.extend_from_slice(files);
        run_git_in(path, &args).await?;
        Ok(format!("Unstaged {} file(s)", files.len()))
    }

    /// Discard working tree changes for specific files (git restore)
    pub async fn discard_changes(&self, path: &str, files: &[&str]) -> CogniaResult<String> {
        let mut args = vec!["restore", "--"];
        args.extend_from_slice(files);
        run_git_in(path, &args).await?;
        Ok(format!("Discarded changes in {} file(s)", files.len()))
    }

    /// Create a commit
    pub async fn commit(
        &self,
        path: &str,
        message: &str,
        amend: bool,
        allow_empty: bool,
        signoff: bool,
        no_verify: bool,
    ) -> CogniaResult<String> {
        let mut args = vec!["commit", "-m", message];
        if amend {
            args.push("--amend");
        }
        if allow_empty {
            args.push("--allow-empty");
        }
        if signoff {
            args.push("--signoff");
        }
        if no_verify {
            args.push("--no-verify");
        }
        run_git_in(path, &args).await
    }

    /// Push to remote
    pub async fn push(
        &self,
        path: &str,
        remote: Option<&str>,
        branch: Option<&str>,
        force: bool,
        force_lease: bool,
        set_upstream: bool,
    ) -> CogniaResult<String> {
        let mut args = vec!["push"];
        if force {
            args.push("--force");
        } else if force_lease {
            args.push("--force-with-lease");
        }
        if set_upstream {
            args.push("-u");
        }
        if let Some(r) = remote {
            args.push(r);
        }
        if let Some(b) = branch {
            args.push(b);
        }
        let result = run_git_in_long_lenient(path, &args).await?;
        Ok(if result.is_empty() {
            "Push completed".into()
        } else {
            result
        })
    }

    /// Pull from remote
    pub async fn pull(
        &self,
        path: &str,
        remote: Option<&str>,
        branch: Option<&str>,
        rebase: bool,
        autostash: bool,
    ) -> CogniaResult<String> {
        let mut args = vec!["pull"];
        if rebase {
            args.push("--rebase");
        }
        if autostash {
            args.push("--autostash");
        }
        if let Some(r) = remote {
            args.push(r);
        }
        if let Some(b) = branch {
            args.push(b);
        }
        run_git_in_long(path, &args).await
    }

    /// Fetch from remote
    pub async fn fetch_remote(
        &self,
        path: &str,
        remote: Option<&str>,
        prune: bool,
        all: bool,
    ) -> CogniaResult<String> {
        let mut args = vec!["fetch"];
        if all {
            args.push("--all");
        }
        if prune {
            args.push("--prune");
        }
        if let Some(r) = remote {
            args.push(r);
        }
        let result = run_git_in_long_lenient(path, &args).await?;
        Ok(if result.is_empty() {
            "Fetch completed".into()
        } else {
            result
        })
    }

    /// Clone a repository with options
    pub async fn clone_repo(
        &self,
        url: &str,
        dest_path: &str,
        options: GitCloneOptions,
    ) -> CogniaResult<String> {
        let args = build_clone_args(url, dest_path, &options);
        let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        run_git_with_opts(&arg_refs, make_install_opts()).await?;
        Ok(format!("Repository cloned to {}", dest_path))
    }

    /// Clone a repository with streaming progress
    pub async fn clone_repo_with_progress<F>(
        &self,
        url: &str,
        dest_path: &str,
        options: GitCloneOptions,
        mut on_progress: F,
    ) -> CogniaResult<String>
    where
        F: FnMut(GitCloneProgress),
    {
        let args = build_clone_args(url, dest_path, &options);
        let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        let out = process::execute_with_streaming(
            "git",
            &arg_refs,
            Some(make_install_opts()),
            |_stdout_line| {},
            |stderr_line| {
                if let Some(progress) = parse_clone_progress(stderr_line) {
                    on_progress(progress);
                }
            },
        )
        .await
        .map_err(|e| CogniaError::Provider(format!("git clone: {}", e)))?;
        if out.success {
            on_progress(GitCloneProgress {
                phase: "done".to_string(),
                percent: Some(100),
                current: None,
                total: None,
                speed: None,
                message: format!("Repository cloned to {}", dest_path),
            });
            Ok(format!("Repository cloned to {}", dest_path))
        } else {
            let err = if out.stderr.trim().is_empty() {
                out.stdout.trim().to_string()
            } else {
                out.stderr.trim().to_string()
            };
            on_progress(GitCloneProgress {
                phase: "error".to_string(),
                percent: None,
                current: None,
                total: None,
                speed: None,
                message: err.clone(),
            });
            Err(CogniaError::Provider(format!("git clone: {}", err)))
        }
    }

    /// Clone a repository with streaming progress and cancellation support
    fn map_clone_stream_error(error: process::ProcessError) -> CogniaError {
        match error {
            process::ProcessError::Signal => {
                CogniaError::Provider("git clone cancelled by user".to_string())
            }
            other => CogniaError::Provider(format!("git clone: {}", other)),
        }
    }

    pub async fn clone_repo_with_progress_cancellable<F>(
        &self,
        url: &str,
        dest_path: &str,
        options: GitCloneOptions,
        mut on_progress: F,
        cancel_rx: tokio::sync::watch::Receiver<bool>,
    ) -> CogniaResult<String>
    where
        F: FnMut(GitCloneProgress),
    {
        let args = build_clone_args(url, dest_path, &options);
        let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        let out = process::execute_with_streaming_cancellable(
            "git",
            &arg_refs,
            Some(make_install_opts()),
            |_stdout_line| {},
            |stderr_line| {
                if let Some(progress) = parse_clone_progress(stderr_line) {
                    on_progress(progress);
                }
            },
            cancel_rx,
        )
        .await
        .map_err(Self::map_clone_stream_error)?;
        if out.success {
            on_progress(GitCloneProgress {
                phase: "done".to_string(),
                percent: Some(100),
                current: None,
                total: None,
                speed: None,
                message: format!("Repository cloned to {}", dest_path),
            });
            Ok(format!("Repository cloned to {}", dest_path))
        } else {
            let err = if out.stderr.trim().is_empty() {
                out.stdout.trim().to_string()
            } else {
                out.stderr.trim().to_string()
            };
            on_progress(GitCloneProgress {
                phase: "error".to_string(),
                percent: None,
                current: None,
                total: None,
                speed: None,
                message: err.clone(),
            });
            Err(CogniaError::Provider(format!("git clone: {}", err)))
        }
    }

    /// Initialize a new repository
    pub async fn init_repo(&self, path: &str) -> CogniaResult<String> {
        run_git(&["init", path]).await
    }

    /// Get diff output (working tree or staged changes)
    pub async fn get_diff(
        &self,
        path: &str,
        staged: bool,
        file: Option<&str>,
        context_lines: Option<u32>,
    ) -> CogniaResult<String> {
        let mut args = vec!["diff"];
        if staged {
            args.push("--staged");
        }
        let ctx_arg;
        if let Some(ctx) = context_lines {
            ctx_arg = format!("-U{}", ctx);
            args.push(&ctx_arg);
        }
        if let Some(f) = file {
            args.push("--");
            args.push(f);
        }
        run_git_in_lenient(path, &args).await
    }

    /// Get diff between two commits
    pub async fn get_diff_between(
        &self,
        path: &str,
        from: &str,
        to: &str,
        file: Option<&str>,
        context_lines: Option<u32>,
    ) -> CogniaResult<String> {
        let mut args = vec!["diff", from, to];
        let ctx_arg;
        if let Some(ctx) = context_lines {
            ctx_arg = format!("-U{}", ctx);
            args.push(&ctx_arg);
        }
        if let Some(f) = file {
            args.push("--");
            args.push(f);
        }
        run_git_in_lenient(path, &args).await
    }

    /// Get the full diff (patch) for a single commit
    pub async fn get_commit_diff(
        &self,
        path: &str,
        hash: &str,
        file: Option<&str>,
        context_lines: Option<u32>,
    ) -> CogniaResult<String> {
        let mut args = vec!["diff-tree", "-p", "--no-commit-id"];
        let ctx_arg;
        if let Some(ctx) = context_lines {
            ctx_arg = format!("-U{}", ctx);
            args.push(&ctx_arg);
        }
        args.push(hash);
        if let Some(f) = file {
            args.push("--");
            args.push(f);
        }
        run_git_in_lenient(path, &args).await
    }

    /// Merge a branch into current
    pub async fn merge_branch(
        &self,
        path: &str,
        branch: &str,
        no_ff: bool,
    ) -> CogniaResult<String> {
        let mut args = vec!["merge"];
        if no_ff {
            args.push("--no-ff");
        }
        args.push(branch);
        run_git_in(path, &args).await
    }

    /// Revert a commit
    pub async fn revert_commit(
        &self,
        path: &str,
        hash: &str,
        no_commit: bool,
    ) -> CogniaResult<String> {
        let mut args = vec!["revert"];
        if no_commit {
            args.push("--no-commit");
        }
        args.push(hash);
        run_git_in(path, &args).await
    }

    /// Cherry-pick a commit
    pub async fn cherry_pick(&self, path: &str, hash: &str) -> CogniaResult<String> {
        run_git_in(path, &["cherry-pick", hash]).await
    }

    /// Reset HEAD to a target
    pub async fn reset_head(
        &self,
        path: &str,
        mode: &str,
        target: Option<&str>,
    ) -> CogniaResult<String> {
        let mode_flag = match mode {
            "soft" => "--soft",
            "hard" => "--hard",
            _ => "--mixed",
        };
        let mut args = vec!["reset", mode_flag];
        if let Some(t) = target {
            args.push(t);
        }
        run_git_in(path, &args).await?;
        Ok("Reset completed".into())
    }

    // ========================================================================
    // Remote & branch management
    // ========================================================================

    /// Add a remote
    pub async fn remote_add(&self, path: &str, name: &str, url: &str) -> CogniaResult<String> {
        run_git_in(path, &["remote", "add", name, url]).await?;
        Ok(format!("Remote '{}' added", name))
    }

    /// Remove a remote
    pub async fn remote_remove(&self, path: &str, name: &str) -> CogniaResult<String> {
        run_git_in(path, &["remote", "remove", name]).await?;
        Ok(format!("Remote '{}' removed", name))
    }

    /// Rename a remote
    pub async fn remote_rename(
        &self,
        path: &str,
        old_name: &str,
        new_name: &str,
    ) -> CogniaResult<String> {
        run_git_in(path, &["remote", "rename", old_name, new_name]).await?;
        Ok(format!("Remote '{}' renamed to '{}'", old_name, new_name))
    }

    /// Set remote URL
    pub async fn remote_set_url(&self, path: &str, name: &str, url: &str) -> CogniaResult<String> {
        run_git_in(path, &["remote", "set-url", name, url]).await?;
        Ok(format!("Remote '{}' URL updated", name))
    }

    /// Rename a branch
    pub async fn branch_rename(
        &self,
        path: &str,
        old_name: &str,
        new_name: &str,
    ) -> CogniaResult<String> {
        run_git_in(path, &["branch", "-m", old_name, new_name]).await?;
        Ok(format!("Branch '{}' renamed to '{}'", old_name, new_name))
    }

    /// Set upstream tracking branch
    pub async fn branch_set_upstream(
        &self,
        path: &str,
        branch: &str,
        upstream: &str,
    ) -> CogniaResult<String> {
        let upstream_arg = format!("--set-upstream-to={}", upstream);
        run_git_in(path, &["branch", &upstream_arg, branch]).await?;
        Ok(format!("Upstream for '{}' set to '{}'", branch, upstream))
    }

    /// Push all tags to remote
    pub async fn push_tags(&self, path: &str, remote: Option<&str>) -> CogniaResult<String> {
        let mut args = vec!["push", "--tags"];
        if let Some(r) = remote {
            args.push(r);
        }
        run_git_in_long(path, &args).await?;
        Ok("Tags pushed to remote".into())
    }

    /// Delete a remote branch
    pub async fn delete_remote_branch(
        &self,
        path: &str,
        remote: &str,
        branch: &str,
    ) -> CogniaResult<String> {
        run_git_in_long(path, &["push", remote, "--delete", branch]).await?;
        Ok(format!("Remote branch '{}/{}' deleted", remote, branch))
    }

    /// Show stash diff
    pub async fn stash_show(&self, path: &str, stash_id: Option<&str>) -> CogniaResult<String> {
        let mut args = vec!["stash", "show", "-p"];
        if let Some(id) = stash_id {
            args.push(id);
        }
        run_git_in_lenient(path, &args).await
    }

    /// Get reflog entries
    pub async fn get_reflog(&self, path: &str, limit: u32) -> CogniaResult<Vec<GitReflogEntry>> {
        let format_str = format!("%H{}%gd{}%gs{}%aI", FIELD_SEP, FIELD_SEP, FIELD_SEP);
        let format_arg = format!("--format={}", format_str);
        let limit_str = format!("-{}", limit);
        let output = run_git_in_lenient(path, &["reflog", "show", &format_arg, &limit_str])
            .await
            .unwrap_or_default();
        Ok(parse_reflog(&output))
    }

    /// Remove untracked files
    pub async fn clean_untracked(&self, path: &str, directories: bool) -> CogniaResult<String> {
        let mut args = vec!["clean", "-f"];
        if directories {
            args.push("-d");
        }
        run_git_in(path, &args).await
    }

    /// Dry-run clean: preview which untracked files would be removed
    pub async fn clean_dry_run(&self, path: &str, directories: bool) -> CogniaResult<Vec<String>> {
        let mut args = vec!["clean", "-n"];
        if directories {
            args.push("-d");
        }
        let output = run_git_in_lenient(path, &args).await.unwrap_or_default();
        Ok(output
            .lines()
            .filter_map(|line| {
                let line = line.trim();
                // Output format: "Would remove <path>"
                line.strip_prefix("Would remove ").map(|p| p.to_string())
            })
            .collect())
    }

    /// Stash specific files
    pub async fn stash_push_files(
        &self,
        path: &str,
        files: &[&str],
        message: Option<&str>,
        include_untracked: bool,
    ) -> CogniaResult<String> {
        let mut args = vec!["stash", "push"];
        if include_untracked {
            args.push("-u");
        }
        if let Some(m) = message {
            args.push("-m");
            args.push(m);
        }
        args.push("--");
        args.extend_from_slice(files);
        run_git_in(path, &args).await
    }

    // ========================================================================
    // Submodule management
    // ========================================================================

    /// List submodules and their status
    pub async fn list_submodules(&self, path: &str) -> CogniaResult<Vec<GitSubmoduleInfo>> {
        let output = run_git_in_lenient(path, &["submodule", "status", "--recursive"])
            .await
            .unwrap_or_default();
        Ok(parse_submodule_status(&output))
    }

    /// Add a submodule
    pub async fn add_submodule(
        &self,
        path: &str,
        url: &str,
        subpath: &str,
    ) -> CogniaResult<String> {
        run_git_in(path, &["submodule", "add", url, subpath]).await?;
        Ok(format!("Submodule '{}' added at '{}'", url, subpath))
    }

    /// Update submodules
    pub async fn update_submodules(
        &self,
        path: &str,
        init: bool,
        recursive: bool,
    ) -> CogniaResult<String> {
        let mut args = vec!["submodule", "update"];
        if init {
            args.push("--init");
        }
        if recursive {
            args.push("--recursive");
        }
        run_git_in(path, &args).await?;
        Ok("Submodules updated".into())
    }

    /// Remove a submodule
    pub async fn remove_submodule(&self, path: &str, subpath: &str) -> CogniaResult<String> {
        run_git_in(path, &["submodule", "deinit", "-f", subpath]).await?;
        run_git_in(path, &["rm", "-f", subpath]).await?;
        Ok(format!("Submodule '{}' removed", subpath))
    }

    /// Sync submodule URLs from .gitmodules
    pub async fn sync_submodules(&self, path: &str) -> CogniaResult<String> {
        run_git_in(path, &["submodule", "sync", "--recursive"]).await?;
        Ok("Submodule URLs synced".into())
    }

    // ========================================================================
    // Worktree management
    // ========================================================================

    /// List worktrees
    pub async fn list_worktrees(&self, path: &str) -> CogniaResult<Vec<GitWorktreeInfo>> {
        let output = run_git_in_lenient(path, &["worktree", "list", "--porcelain"])
            .await
            .unwrap_or_default();
        Ok(parse_worktree_list(&output))
    }

    /// Add a worktree
    pub async fn add_worktree(
        &self,
        path: &str,
        dest: &str,
        branch: Option<&str>,
        new_branch: Option<&str>,
    ) -> CogniaResult<String> {
        let mut args = vec!["worktree", "add"];
        let new_branch_owned: String;
        if let Some(nb) = new_branch {
            new_branch_owned = nb.to_string();
            args.push("-b");
            args.push(&new_branch_owned);
        }
        args.push(dest);
        if let Some(b) = branch {
            args.push(b);
        }
        run_git_in(path, &args).await?;
        Ok(format!("Worktree added at '{}'", dest))
    }

    /// Remove a worktree
    pub async fn remove_worktree(
        &self,
        path: &str,
        dest: &str,
        force: bool,
    ) -> CogniaResult<String> {
        let mut args = vec!["worktree", "remove"];
        if force {
            args.push("--force");
        }
        args.push(dest);
        run_git_in(path, &args).await?;
        Ok(format!("Worktree '{}' removed", dest))
    }

    /// Prune stale worktree entries
    pub async fn prune_worktrees(&self, path: &str) -> CogniaResult<String> {
        run_git_in(path, &["worktree", "prune"]).await?;
        Ok("Stale worktrees pruned".into())
    }

    // ========================================================================
    // .gitignore management
    // ========================================================================

    /// Read .gitignore content
    pub async fn get_gitignore(&self, path: &str) -> CogniaResult<String> {
        let root = run_git_in(path, &["rev-parse", "--show-toplevel"]).await?;
        let gitignore_path = std::path::Path::new(root.trim()).join(".gitignore");
        match tokio::fs::read_to_string(&gitignore_path).await {
            Ok(content) => Ok(content),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
            Err(e) => Err(CogniaError::Provider(format!(
                "Failed to read .gitignore: {}",
                e
            ))),
        }
    }

    /// Write .gitignore content
    pub async fn set_gitignore(&self, path: &str, content: &str) -> CogniaResult<()> {
        let root = run_git_in(path, &["rev-parse", "--show-toplevel"]).await?;
        let gitignore_path = std::path::Path::new(root.trim()).join(".gitignore");
        tokio::fs::write(&gitignore_path, content)
            .await
            .map_err(|e| CogniaError::Provider(format!("Failed to write .gitignore: {}", e)))?;
        Ok(())
    }

    /// Check which files are ignored
    pub async fn check_ignore(&self, path: &str, files: &[&str]) -> CogniaResult<Vec<String>> {
        let mut args = vec!["check-ignore"];
        args.extend_from_slice(files);
        let output = run_git_in_lenient(path, &args).await.unwrap_or_default();
        Ok(output
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty())
            .collect())
    }

    /// Append patterns to .gitignore
    pub async fn add_to_gitignore(&self, path: &str, patterns: &[&str]) -> CogniaResult<()> {
        let root = run_git_in(path, &["rev-parse", "--show-toplevel"]).await?;
        let gitignore_path = std::path::Path::new(root.trim()).join(".gitignore");
        let mut content = tokio::fs::read_to_string(&gitignore_path)
            .await
            .unwrap_or_default();
        if !content.is_empty() && !content.ends_with('\n') {
            content.push('\n');
        }
        for pattern in patterns {
            content.push_str(pattern);
            content.push('\n');
        }
        tokio::fs::write(&gitignore_path, &content)
            .await
            .map_err(|e| CogniaError::Provider(format!("Failed to write .gitignore: {}", e)))?;
        Ok(())
    }

    // ========================================================================
    // Git Hooks management
    // ========================================================================

    /// List hooks in the repository
    pub async fn list_hooks(&self, path: &str) -> CogniaResult<Vec<GitHookInfo>> {
        let git_dir = run_git_in(path, &["rev-parse", "--git-dir"]).await?;
        let hooks_dir = std::path::Path::new(path)
            .join(git_dir.trim())
            .join("hooks");
        let mut hooks = Vec::new();
        if let Ok(mut entries) = tokio::fs::read_dir(&hooks_dir).await {
            while let Ok(Some(entry)) = entries.next_entry().await {
                let file_name = entry.file_name().to_string_lossy().to_string();
                if file_name.starts_with('.') {
                    continue;
                }
                let is_sample = file_name.ends_with(".sample");
                let name = if is_sample {
                    file_name.trim_end_matches(".sample").to_string()
                } else {
                    file_name.clone()
                };
                let has_content = entry.metadata().await.map(|m| m.len() > 0).unwrap_or(false);
                hooks.push(GitHookInfo {
                    name,
                    enabled: !is_sample,
                    has_content,
                    file_name,
                });
            }
        }
        hooks.sort_by(|a, b| a.name.cmp(&b.name));
        hooks.dedup_by(|a, b| a.name == b.name);
        Ok(hooks)
    }

    /// Get hook file content
    pub async fn get_hook_content(&self, path: &str, name: &str) -> CogniaResult<String> {
        let git_dir = run_git_in(path, &["rev-parse", "--git-dir"]).await?;
        let hooks_dir = std::path::Path::new(path)
            .join(git_dir.trim())
            .join("hooks");
        // Try active hook first, then sample
        let hook_path = hooks_dir.join(name);
        if hook_path.exists() {
            return tokio::fs::read_to_string(&hook_path)
                .await
                .map_err(|e| CogniaError::Provider(format!("Failed to read hook: {}", e)));
        }
        let sample_path = hooks_dir.join(format!("{}.sample", name));
        if sample_path.exists() {
            return tokio::fs::read_to_string(&sample_path)
                .await
                .map_err(|e| CogniaError::Provider(format!("Failed to read hook: {}", e)));
        }
        Ok(String::new())
    }

    /// Set hook file content
    pub async fn set_hook_content(
        &self,
        path: &str,
        name: &str,
        content: &str,
    ) -> CogniaResult<()> {
        let git_dir = run_git_in(path, &["rev-parse", "--git-dir"]).await?;
        let hook_path = std::path::Path::new(path)
            .join(git_dir.trim())
            .join("hooks")
            .join(name);
        tokio::fs::write(&hook_path, content)
            .await
            .map_err(|e| CogniaError::Provider(format!("Failed to write hook: {}", e)))?;
        // Make executable on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let perms = std::fs::Permissions::from_mode(0o755);
            tokio::fs::set_permissions(&hook_path, perms)
                .await
                .map_err(|e| {
                    CogniaError::Provider(format!("Failed to set hook permissions: {}", e))
                })?;
        }
        Ok(())
    }

    /// Toggle hook enabled/disabled
    pub async fn toggle_hook(&self, path: &str, name: &str, enabled: bool) -> CogniaResult<()> {
        let git_dir = run_git_in(path, &["rev-parse", "--git-dir"]).await?;
        let hooks_dir = std::path::Path::new(path)
            .join(git_dir.trim())
            .join("hooks");
        let active_path = hooks_dir.join(name);
        let sample_path = hooks_dir.join(format!("{}.sample", name));
        if enabled {
            // Rename .sample → active
            if sample_path.exists() && !active_path.exists() {
                tokio::fs::rename(&sample_path, &active_path)
                    .await
                    .map_err(|e| CogniaError::Provider(format!("Failed to enable hook: {}", e)))?;
            }
        } else {
            // Rename active → .sample
            if active_path.exists() && !sample_path.exists() {
                tokio::fs::rename(&active_path, &sample_path)
                    .await
                    .map_err(|e| CogniaError::Provider(format!("Failed to disable hook: {}", e)))?;
            }
        }
        Ok(())
    }

    // ========================================================================
    // Git LFS
    // ========================================================================

    /// Check if git-lfs is available
    pub async fn lfs_is_available(&self) -> bool {
        matches!(
            process::execute("git", &["lfs", "version"], Some(make_opts())).await,
            Ok(out) if out.success
        )
    }

    /// Get LFS tracked patterns from .gitattributes
    pub async fn lfs_tracked_patterns(&self, path: &str) -> CogniaResult<Vec<String>> {
        let output = run_git_in_lenient(path, &["lfs", "track"])
            .await
            .unwrap_or_default();
        Ok(output
            .lines()
            .filter_map(|line| {
                let line = line.trim();
                // Output: "    *.psd (.gitattributes)"
                if line.starts_with('*') || line.starts_with('.') {
                    let pattern = line.split(" (").next().unwrap_or(line).trim();
                    if !pattern.is_empty() {
                        return Some(pattern.to_string());
                    }
                }
                None
            })
            .collect())
    }

    /// List LFS files
    pub async fn lfs_ls_files(&self, path: &str) -> CogniaResult<Vec<GitLfsFile>> {
        let output = run_git_in_lenient(path, &["lfs", "ls-files", "--long"])
            .await
            .unwrap_or_default();
        Ok(parse_lfs_ls_files(&output))
    }

    /// Track a pattern with LFS
    pub async fn lfs_track(&self, path: &str, pattern: &str) -> CogniaResult<String> {
        run_git_in(path, &["lfs", "track", pattern]).await?;
        Ok(format!("LFS tracking '{}'", pattern))
    }

    /// Untrack a pattern from LFS
    pub async fn lfs_untrack(&self, path: &str, pattern: &str) -> CogniaResult<String> {
        run_git_in(path, &["lfs", "untrack", pattern]).await?;
        Ok(format!("LFS untracking '{}'", pattern))
    }

    /// Install LFS hooks in the repository
    pub async fn lfs_install(&self, path: &str) -> CogniaResult<String> {
        run_git_in(path, &["lfs", "install"]).await
    }

    /// Get LFS version string
    pub async fn lfs_get_version(&self) -> CogniaResult<Option<String>> {
        match process::execute("git", &["lfs", "version"], Some(make_opts())).await {
            Ok(out) if out.success => {
                // "git-lfs/3.4.0 (GitHub; windows amd64; ...)"
                let version = out
                    .stdout
                    .trim()
                    .split('/')
                    .nth(1)
                    .and_then(|s| s.split_whitespace().next())
                    .map(|s| s.to_string());
                Ok(version)
            }
            _ => Ok(None),
        }
    }

    // ========================================================================
    // Rebase
    // ========================================================================

    /// Rebase current branch onto target
    pub async fn rebase(&self, path: &str, onto: &str) -> CogniaResult<String> {
        run_git_in(path, &["rebase", onto]).await
    }

    /// Abort an in-progress rebase
    pub async fn rebase_abort(&self, path: &str) -> CogniaResult<String> {
        run_git_in(path, &["rebase", "--abort"]).await?;
        Ok("Rebase aborted".into())
    }

    /// Continue rebase after resolving conflicts
    pub async fn rebase_continue(&self, path: &str) -> CogniaResult<String> {
        run_git_in(path, &["rebase", "--continue"]).await
    }

    /// Skip current commit during rebase
    pub async fn rebase_skip(&self, path: &str) -> CogniaResult<String> {
        run_git_in(path, &["rebase", "--skip"]).await
    }

    /// Squash last N commits into one
    pub async fn squash_last_n(
        &self,
        path: &str,
        count: u32,
        message: &str,
    ) -> CogniaResult<String> {
        let target = format!("HEAD~{}", count);
        run_git_in(path, &["reset", "--soft", &target]).await?;
        run_git_in(path, &["commit", "-m", message]).await
    }

    /// Get rebase status (in progress or not)
    pub async fn get_merge_rebase_state(&self, path: &str) -> CogniaResult<GitMergeRebaseState> {
        let git_dir = run_git_in(path, &["rev-parse", "--git-dir"]).await?;
        let git_dir_path = std::path::Path::new(path).join(git_dir.trim());

        if git_dir_path.join("MERGE_HEAD").exists() {
            return Ok(GitMergeRebaseState {
                state: "merging".into(),
                onto: None,
                progress: None,
                total: None,
            });
        }
        if git_dir_path.join("rebase-merge").exists() || git_dir_path.join("rebase-apply").exists()
        {
            let rebase_dir = if git_dir_path.join("rebase-merge").exists() {
                git_dir_path.join("rebase-merge")
            } else {
                git_dir_path.join("rebase-apply")
            };
            let onto = tokio::fs::read_to_string(rebase_dir.join("onto"))
                .await
                .ok()
                .map(|s| s.trim().to_string());
            let progress = tokio::fs::read_to_string(rebase_dir.join("msgnum"))
                .await
                .ok()
                .and_then(|s| s.trim().parse::<u32>().ok());
            let total = tokio::fs::read_to_string(rebase_dir.join("end"))
                .await
                .ok()
                .and_then(|s| s.trim().parse::<u32>().ok());
            return Ok(GitMergeRebaseState {
                state: "rebasing".into(),
                onto,
                progress,
                total,
            });
        }
        if git_dir_path.join("CHERRY_PICK_HEAD").exists() {
            return Ok(GitMergeRebaseState {
                state: "cherry_picking".into(),
                onto: None,
                progress: None,
                total: None,
            });
        }
        if git_dir_path.join("REVERT_HEAD").exists() {
            return Ok(GitMergeRebaseState {
                state: "reverting".into(),
                onto: None,
                progress: None,
                total: None,
            });
        }
        Ok(GitMergeRebaseState {
            state: "none".into(),
            onto: None,
            progress: None,
            total: None,
        })
    }

    // ========================================================================
    // Conflict resolution
    // ========================================================================

    /// Get list of conflicted files
    pub async fn get_conflicted_files(&self, path: &str) -> CogniaResult<Vec<String>> {
        let output = run_git_in_lenient(path, &["diff", "--name-only", "--diff-filter=U"])
            .await
            .unwrap_or_default();
        Ok(output
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty())
            .collect())
    }

    /// Resolve a file conflict by choosing ours
    pub async fn resolve_file_ours(&self, path: &str, file: &str) -> CogniaResult<String> {
        run_git_in(path, &["checkout", "--ours", "--", file]).await?;
        run_git_in(path, &["add", "--", file]).await?;
        Ok(format!("Resolved '{}' using ours", file))
    }

    /// Resolve a file conflict by choosing theirs
    pub async fn resolve_file_theirs(&self, path: &str, file: &str) -> CogniaResult<String> {
        run_git_in(path, &["checkout", "--theirs", "--", file]).await?;
        run_git_in(path, &["add", "--", file]).await?;
        Ok(format!("Resolved '{}' using theirs", file))
    }

    /// Mark a conflicted file as resolved (after manual edit)
    pub async fn resolve_file_mark(&self, path: &str, file: &str) -> CogniaResult<String> {
        run_git_in(path, &["add", "--", file]).await?;
        Ok(format!("Marked '{}' as resolved", file))
    }

    /// Abort an in-progress merge
    pub async fn merge_abort(&self, path: &str) -> CogniaResult<String> {
        run_git_in(path, &["merge", "--abort"]).await?;
        Ok("Merge aborted".into())
    }

    /// Continue merge after resolving all conflicts
    pub async fn merge_continue(&self, path: &str) -> CogniaResult<String> {
        // Use core.editor=true to skip editor on merge commit
        run_git_with_opts(
            &["-C", path, "-c", "core.editor=true", "merge", "--continue"],
            make_opts(),
        )
        .await?;
        Ok("Merge continued".into())
    }

    // ========================================================================
    // Cherry-pick abort/continue & Revert abort
    // ========================================================================

    /// Abort an in-progress cherry-pick
    pub async fn cherry_pick_abort(&self, path: &str) -> CogniaResult<String> {
        run_git_in(path, &["cherry-pick", "--abort"]).await?;
        Ok("Cherry-pick aborted".into())
    }

    /// Continue cherry-pick after resolving conflicts
    pub async fn cherry_pick_continue(&self, path: &str) -> CogniaResult<String> {
        run_git_with_opts(
            &[
                "-C",
                path,
                "-c",
                "core.editor=true",
                "cherry-pick",
                "--continue",
            ],
            make_opts(),
        )
        .await?;
        Ok("Cherry-pick continued".into())
    }

    /// Abort an in-progress revert
    pub async fn revert_abort(&self, path: &str) -> CogniaResult<String> {
        run_git_in(path, &["revert", "--abort"]).await?;
        Ok("Revert aborted".into())
    }

    // ========================================================================
    // Stash branch
    // ========================================================================

    /// Create a new branch from a stash entry
    pub async fn stash_branch(
        &self,
        path: &str,
        branch_name: &str,
        stash_id: Option<&str>,
    ) -> CogniaResult<String> {
        let mut args = vec!["stash", "branch", branch_name];
        if let Some(id) = stash_id {
            args.push(id);
        }
        run_git_in(path, &args).await?;
        Ok(format!("Branch '{}' created from stash", branch_name))
    }

    // ========================================================================
    // Local (per-repo) config
    // ========================================================================

    /// Get all local config entries for a repository
    pub async fn get_local_config_list(&self, path: &str) -> CogniaResult<Vec<GitConfigEntry>> {
        match run_git_in_lenient(path, &["config", "--local", "--list"]).await {
            Ok(output) => Ok(parse_config_list(&output)),
            Err(_) => Ok(vec![]),
        }
    }

    /// Set a local config value
    pub async fn set_local_config(&self, path: &str, key: &str, value: &str) -> CogniaResult<()> {
        run_git_in(path, &["config", "--local", key, value]).await?;
        Ok(())
    }

    /// Remove a local config key
    pub async fn remove_local_config(&self, path: &str, key: &str) -> CogniaResult<()> {
        run_git_in(path, &["config", "--local", "--unset", key]).await?;
        Ok(())
    }

    /// Get a single local config value
    pub async fn get_local_config_value(
        &self,
        path: &str,
        key: &str,
    ) -> CogniaResult<Option<String>> {
        match run_git_in_lenient(path, &["config", "--local", "--get", key]).await {
            Ok(v) => {
                let trimmed = v.trim().to_string();
                if trimmed.is_empty() {
                    Ok(None)
                } else {
                    Ok(Some(trimmed))
                }
            }
            Err(_) => Ok(None),
        }
    }

    // ========================================================================
    // Shallow clone management
    // ========================================================================

    /// Check if the repository is a shallow clone
    pub async fn is_shallow(&self, path: &str) -> CogniaResult<bool> {
        match run_git_in(path, &["rev-parse", "--is-shallow-repository"]).await {
            Ok(output) => Ok(output.trim() == "true"),
            Err(_) => Ok(false),
        }
    }

    /// Deepen a shallow clone by N commits
    pub async fn deepen(&self, path: &str, depth: u32) -> CogniaResult<String> {
        let depth_arg = format!("--deepen={}", depth);
        run_git_in_long(path, &["fetch", &depth_arg]).await?;
        Ok(format!("Repository deepened by {} commits", depth))
    }

    /// Convert a shallow clone to a full clone
    pub async fn unshallow(&self, path: &str) -> CogniaResult<String> {
        run_git_in_long(path, &["fetch", "--unshallow"]).await?;
        Ok("Repository unshallowed (full history fetched)".into())
    }

    // ========================================================================
    // Repository statistics
    // ========================================================================

    /// Get repository statistics (object count, disk usage, etc.)
    pub async fn get_repo_stats(&self, path: &str) -> CogniaResult<GitRepoStats> {
        let count_output = run_git_in_lenient(path, &["count-objects", "-vH"])
            .await
            .unwrap_or_default();

        let mut size_on_disk = String::new();
        let mut object_count: u64 = 0;
        let mut pack_count: u32 = 0;
        let mut loose_objects: u32 = 0;

        for line in count_output.lines() {
            let line = line.trim();
            if let Some(rest) = line.strip_prefix("count: ") {
                loose_objects = rest.trim().parse().unwrap_or(0);
            } else if let Some(rest) = line.strip_prefix("in-pack: ") {
                object_count = rest.trim().parse().unwrap_or(0);
            } else if let Some(rest) = line.strip_prefix("packs: ") {
                pack_count = rest.trim().parse().unwrap_or(0);
            } else if let Some(rest) = line.strip_prefix("size-pack: ") {
                size_on_disk = rest.trim().to_string();
            }
        }
        object_count += loose_objects as u64;

        let commit_count = run_git_in_lenient(path, &["rev-list", "--count", "--all"])
            .await
            .ok()
            .and_then(|s| s.trim().parse::<u64>().ok())
            .unwrap_or(0);

        let is_shallow = self.is_shallow(path).await.unwrap_or(false);

        Ok(GitRepoStats {
            size_on_disk,
            object_count,
            pack_count,
            loose_objects,
            commit_count,
            is_shallow,
        })
    }

    /// Run git fsck to check repository integrity
    pub async fn fsck(&self, path: &str) -> CogniaResult<Vec<String>> {
        let output = run_git_in_lenient(path, &["fsck", "--no-dangling", "--no-progress"])
            .await
            .unwrap_or_default();
        Ok(output
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty())
            .collect())
    }

    /// Get human-readable description based on nearest tag
    pub async fn describe(&self, path: &str) -> CogniaResult<Option<String>> {
        match run_git_in_lenient(path, &["describe", "--tags", "--always", "--long"]).await {
            Ok(d) => {
                let trimmed = d.trim().to_string();
                if trimmed.is_empty() {
                    Ok(None)
                } else {
                    Ok(Some(trimmed))
                }
            }
            Err(_) => Ok(None),
        }
    }

    /// Prune stale remote-tracking branches
    pub async fn remote_prune(&self, path: &str, remote: &str) -> CogniaResult<String> {
        run_git_in(path, &["remote", "prune", remote]).await?;
        Ok(format!("Pruned stale branches from '{}'", remote))
    }

    // ========================================================================
    // Commit signature verification
    // ========================================================================

    /// Verify a commit signature
    pub async fn verify_commit(&self, path: &str, hash: &str) -> CogniaResult<String> {
        run_git_in_lenient(path, &["verify-commit", hash]).await
    }

    /// Verify a tag signature
    pub async fn verify_tag(&self, path: &str, tag: &str) -> CogniaResult<String> {
        run_git_in_lenient(path, &["tag", "-v", tag]).await
    }

    // ========================================================================
    // Interactive rebase
    // ========================================================================

    /// Get commits between base and HEAD for interactive rebase preview
    pub async fn get_rebase_todo_preview(
        &self,
        path: &str,
        base: &str,
    ) -> CogniaResult<Vec<GitRebaseTodoItem>> {
        let format_str = format!("%H{}%s", FIELD_SEP);
        let format_arg = format!("--format={}", format_str);
        let range = format!("{}..HEAD", base);
        let output = run_git_in_lenient(path, &["log", "--reverse", &format_arg, &range]).await?;

        Ok(output
            .lines()
            .filter_map(|line| {
                let line = line.trim();
                if line.is_empty() {
                    return None;
                }
                let fields: Vec<&str> = line.split(FIELD_SEP).collect();
                if fields.len() < 2 {
                    return None;
                }
                Some(GitRebaseTodoItem {
                    action: "pick".to_string(),
                    hash: fields[0].to_string(),
                    message: fields[1..].join(&FIELD_SEP.to_string()),
                })
            })
            .collect())
    }

    /// Start an interactive rebase with a user-defined todo list
    pub async fn start_interactive_rebase(
        &self,
        path: &str,
        base: &str,
        todo: &[GitRebaseTodoItem],
    ) -> CogniaResult<String> {
        // Write a temporary script that replaces the todo file content
        let temp_dir = std::env::temp_dir();
        #[cfg(windows)]
        let script_path = temp_dir.join("cognia_rebase_editor.cmd");
        #[cfg(not(windows))]
        let script_path = temp_dir.join("cognia_rebase_editor.sh");

        // Helper closure to format a todo item as a short line
        let fmt_item = |item: &GitRebaseTodoItem| {
            format!(
                "{} {} {}",
                item.action,
                &item.hash[..7.min(item.hash.len())],
                item.message
            )
        };

        #[cfg(windows)]
        {
            let script = format!(
                "@echo off\r\n(\r\n{}\r\n) > %1\r\n",
                todo.iter()
                    .map(|item| format!("echo {}", fmt_item(item)))
                    .collect::<Vec<_>>()
                    .join("\r\n")
            );
            tokio::fs::write(&script_path, &script).await.map_err(|e| {
                CogniaError::Provider(format!("Failed to write rebase editor script: {}", e))
            })?;
        }
        #[cfg(not(windows))]
        {
            let todo_content: String = todo
                .iter()
                .map(|item| fmt_item(item))
                .collect::<Vec<_>>()
                .join("\n");
            let todo_escaped = todo_content.replace('\\', "\\\\").replace('"', "\\\"");
            let script = format!(
                "#!/bin/sh\nprintf '{}\\n' > \"$1\"\n",
                todo_escaped.replace('\n', "\\n")
            );
            tokio::fs::write(&script_path, &script).await.map_err(|e| {
                CogniaError::Provider(format!("Failed to write rebase editor script: {}", e))
            })?;
            // Make executable
            use std::os::unix::fs::PermissionsExt;
            let perms = std::fs::Permissions::from_mode(0o755);
            tokio::fs::set_permissions(&script_path, perms)
                .await
                .map_err(|e| {
                    CogniaError::Provider(format!(
                        "Failed to set rebase editor script permissions: {}",
                        e
                    ))
                })?;
        }

        let editor_env = script_path.to_string_lossy().to_string();
        let opts = make_install_opts().with_env("GIT_SEQUENCE_EDITOR", &editor_env);

        let result = process::execute("git", &["-C", path, "rebase", "-i", base], Some(opts))
            .await
            .map_err(|e| CogniaError::Provider(format!("git rebase -i: {}", e)))?;

        // Clean up temp script
        let _ = tokio::fs::remove_file(&script_path).await;

        if result.success {
            Ok("Interactive rebase completed".into())
        } else {
            let stderr = result.stderr.trim().to_string();
            if stderr.contains("Could not apply") || stderr.contains("CONFLICT") {
                // Rebase paused due to conflicts — this is not an error
                Ok(format!("Rebase paused: {}", stderr))
            } else {
                let err = if stderr.is_empty() {
                    result.stdout.trim().to_string()
                } else {
                    stderr
                };
                Err(CogniaError::Provider(format!("git rebase -i: {}", err)))
            }
        }
    }

    // ========================================================================
    // Git bisect
    // ========================================================================

    /// Start a bisect session
    pub async fn bisect_start(
        &self,
        path: &str,
        bad_ref: &str,
        good_ref: &str,
    ) -> CogniaResult<String> {
        run_git_in(path, &["bisect", "start", bad_ref, good_ref]).await
    }

    /// Mark current commit as good
    pub async fn bisect_good(&self, path: &str) -> CogniaResult<String> {
        run_git_in_lenient(path, &["bisect", "good"]).await
    }

    /// Mark current commit as bad
    pub async fn bisect_bad(&self, path: &str) -> CogniaResult<String> {
        run_git_in_lenient(path, &["bisect", "bad"]).await
    }

    /// Skip current commit in bisect
    pub async fn bisect_skip(&self, path: &str) -> CogniaResult<String> {
        run_git_in_lenient(path, &["bisect", "skip"]).await
    }

    /// Reset (end) a bisect session
    pub async fn bisect_reset(&self, path: &str) -> CogniaResult<String> {
        run_git_in(path, &["bisect", "reset"]).await?;
        Ok("Bisect session ended".into())
    }

    /// Get bisect log
    pub async fn bisect_log(&self, path: &str) -> CogniaResult<String> {
        run_git_in_lenient(path, &["bisect", "log"]).await
    }

    /// Get the current bisect state
    pub async fn get_bisect_state(&self, path: &str) -> CogniaResult<GitBisectState> {
        let git_dir = run_git_in(path, &["rev-parse", "--git-dir"]).await?;
        let git_dir_path = std::path::Path::new(path).join(git_dir.trim());

        let active = git_dir_path.join("BISECT_START").exists();
        if !active {
            return Ok(GitBisectState {
                active: false,
                current_hash: None,
                steps_taken: 0,
                remaining_estimate: None,
            });
        }

        let current_hash = run_git_in(path, &["rev-parse", "--short", "HEAD"])
            .await
            .ok();

        // Parse bisect log to count steps
        let log = run_git_in_lenient(path, &["bisect", "log"])
            .await
            .unwrap_or_default();
        let steps_taken = log
            .lines()
            .filter(|l| {
                let l = l.trim();
                l.starts_with("# good:") || l.starts_with("# bad:") || l.starts_with("# skip:")
            })
            .count() as u32;

        Ok(GitBisectState {
            active: true,
            current_hash,
            steps_taken,
            remaining_estimate: None,
        })
    }

    // ========================================================================
    // Git sparse-checkout
    // ========================================================================

    /// Check if sparse-checkout is enabled
    pub async fn is_sparse_checkout(&self, path: &str) -> CogniaResult<bool> {
        match run_git_in_lenient(path, &["sparse-checkout", "list"]).await {
            Ok(_) => {
                // Also check config
                match run_git_in_lenient(path, &["config", "core.sparseCheckout"]).await {
                    Ok(v) => Ok(v.trim() == "true"),
                    Err(_) => Ok(false),
                }
            }
            Err(_) => Ok(false),
        }
    }

    /// Initialize sparse-checkout
    pub async fn sparse_checkout_init(&self, path: &str, cone: bool) -> CogniaResult<String> {
        let mut args = vec!["sparse-checkout", "init"];
        if cone {
            args.push("--cone");
        }
        run_git_in(path, &args).await?;
        Ok("Sparse-checkout initialized".into())
    }

    /// Set sparse-checkout patterns (replaces existing)
    pub async fn sparse_checkout_set(&self, path: &str, patterns: &[&str]) -> CogniaResult<String> {
        let mut args = vec!["sparse-checkout", "set"];
        args.extend_from_slice(patterns);
        run_git_in(path, &args).await?;
        Ok("Sparse-checkout patterns set".into())
    }

    /// Add patterns to sparse-checkout
    pub async fn sparse_checkout_add(&self, path: &str, patterns: &[&str]) -> CogniaResult<String> {
        let mut args = vec!["sparse-checkout", "add"];
        args.extend_from_slice(patterns);
        run_git_in(path, &args).await?;
        Ok("Sparse-checkout patterns added".into())
    }

    /// List current sparse-checkout patterns
    pub async fn sparse_checkout_list(&self, path: &str) -> CogniaResult<Vec<String>> {
        let output = run_git_in_lenient(path, &["sparse-checkout", "list"])
            .await
            .unwrap_or_default();
        Ok(output
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty())
            .collect())
    }

    /// Disable sparse-checkout
    pub async fn sparse_checkout_disable(&self, path: &str) -> CogniaResult<String> {
        run_git_in(path, &["sparse-checkout", "disable"]).await?;
        Ok("Sparse-checkout disabled".into())
    }

    // ========================================================================
    // Git archive
    // ========================================================================

    /// Create an archive of the repository
    pub async fn archive_repo(
        &self,
        path: &str,
        format: &str,
        output_path: &str,
        ref_name: &str,
        prefix: Option<&str>,
    ) -> CogniaResult<String> {
        let format_arg = format!("--format={}", format);
        let output_arg = format!("--output={}", output_path);
        let mut args = vec!["archive", &format_arg, &output_arg];
        let prefix_arg;
        if let Some(p) = prefix {
            prefix_arg = format!("--prefix={}/", p);
            args.push(&prefix_arg);
        }
        args.push(ref_name);
        run_git_in_long(path, &args).await?;
        Ok(format!("Archive created at {}", output_path))
    }

    // ========================================================================
    // Git patch (format-patch / apply / am)
    // ========================================================================

    /// Create patch files from a commit range
    pub async fn format_patch(
        &self,
        path: &str,
        range: &str,
        output_dir: &str,
    ) -> CogniaResult<Vec<String>> {
        let output_arg = format!("-o{}", output_dir);
        let output = run_git_in_lenient(path, &["format-patch", &output_arg, range]).await?;
        Ok(output
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty())
            .collect())
    }

    /// Apply a patch file (git apply)
    pub async fn apply_patch(
        &self,
        path: &str,
        patch_path: &str,
        check_only: bool,
    ) -> CogniaResult<String> {
        let mut args = vec!["apply"];
        if check_only {
            args.push("--check");
        }
        args.push(patch_path);
        run_git_in(path, &args).await?;
        Ok(if check_only {
            "Patch can be applied cleanly".into()
        } else {
            "Patch applied successfully".into()
        })
    }

    /// Apply a mailbox patch (git am, for format-patch output)
    pub async fn apply_mailbox(&self, path: &str, patch_path: &str) -> CogniaResult<String> {
        run_git_in(path, &["am", patch_path]).await
    }
}

// ============================================================================
// Provider trait implementations
// ============================================================================

#[async_trait]
impl Provider for GitProvider {
    fn id(&self) -> &str {
        "git"
    }

    fn display_name(&self) -> &str {
        "Git (Version Control)"
    }

    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::Update,
            Capability::List,
        ])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }

    fn priority(&self) -> i32 {
        85
    }

    async fn is_available(&self) -> bool {
        self.get_git_version().await.ok().flatten().is_some()
    }

    async fn search(
        &self,
        _query: &str,
        _options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        Ok(vec![PackageSummary {
            name: "git".into(),
            description: Some("Distributed version control system".into()),
            latest_version: None,
            provider: self.id().into(),
        }])
    }

    async fn get_package_info(&self, _name: &str) -> CogniaResult<PackageInfo> {
        let version = self.get_git_version().await?.unwrap_or_default();
        Ok(PackageInfo {
            name: "git".into(),
            display_name: Some("Git".into()),
            description: Some("Fast, scalable, distributed revision control system".into()),
            homepage: Some("https://git-scm.com".into()),
            license: Some("GPL-2.0".into()),
            repository: Some("https://github.com/git/git".into()),
            versions: if version.is_empty() {
                vec![]
            } else {
                vec![VersionInfo {
                    version,
                    release_date: None,
                    deprecated: false,
                    yanked: false,
                }]
            },
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, _name: &str) -> CogniaResult<Vec<VersionInfo>> {
        if let Some(version) = self.get_git_version().await? {
            Ok(vec![VersionInfo {
                version,
                release_date: None,
                deprecated: false,
                yanked: false,
            }])
        } else {
            Ok(vec![])
        }
    }

    async fn install(&self, _request: InstallRequest) -> CogniaResult<InstallReceipt> {
        let _msg = self.install_git().await?;
        let version = self
            .get_git_version()
            .await?
            .unwrap_or_else(|| "unknown".into());
        let path = self.get_git_path().await.unwrap_or_default();
        Ok(InstallReceipt {
            name: "git".into(),
            version,
            provider: self.id().into(),
            install_path: PathBuf::from(path),
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, _request: UninstallRequest) -> CogniaResult<()> {
        let pm = self.detect_package_manager().await.ok_or_else(|| {
            CogniaError::Provider("No supported package manager found to uninstall Git".into())
        })?;

        let result = match pm {
            "winget" => {
                process::execute(
                    "winget",
                    &["uninstall", "Git.Git", "--silent"],
                    Some(make_install_opts()),
                )
                .await
            }
            "scoop" => {
                process::execute("scoop", &["uninstall", "git"], Some(make_install_opts())).await
            }
            "choco" => {
                process::execute(
                    "choco",
                    &["uninstall", "git", "-y"],
                    Some(make_install_opts()),
                )
                .await
            }
            "brew" => {
                process::execute("brew", &["uninstall", "git"], Some(make_install_opts())).await
            }
            "macports" => {
                process::execute(
                    "sudo",
                    &["port", "uninstall", "git"],
                    Some(make_install_opts()),
                )
                .await
            }
            "apt" => {
                process::execute(
                    "sudo",
                    &["apt-get", "remove", "-y", "git"],
                    Some(make_install_opts()),
                )
                .await
            }
            "dnf" => {
                process::execute(
                    "sudo",
                    &["dnf", "remove", "-y", "git"],
                    Some(make_install_opts()),
                )
                .await
            }
            "pacman" => {
                process::execute(
                    "sudo",
                    &["pacman", "-Rs", "--noconfirm", "git"],
                    Some(make_install_opts()),
                )
                .await
            }
            _ => {
                return Err(CogniaError::Provider(format!(
                    "Unsupported package manager: {}",
                    pm
                )))
            }
        };

        match result {
            Ok(out) if out.success => Ok(()),
            Ok(out) => {
                let err = if out.stderr.trim().is_empty() {
                    out.stdout
                } else {
                    out.stderr
                };
                Err(CogniaError::Provider(format!(
                    "Git uninstall failed: {}",
                    err.trim()
                )))
            }
            Err(e) => Err(CogniaError::Provider(format!(
                "Git uninstall failed: {}",
                e
            ))),
        }
    }

    async fn list_installed(
        &self,
        _filter: InstalledFilter,
    ) -> CogniaResult<Vec<InstalledPackage>> {
        if let Some(version) = self.get_git_version().await? {
            let path = self.get_git_path().await.unwrap_or_default();
            Ok(vec![InstalledPackage {
                name: "git".into(),
                version,
                provider: self.id().into(),
                install_path: PathBuf::from(path),
                installed_at: String::new(),
                is_global: true,
            }])
        } else {
            Ok(vec![])
        }
    }

    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        Ok(vec![])
    }
}

#[async_trait]
impl SystemPackageProvider for GitProvider {
    async fn get_version(&self) -> CogniaResult<String> {
        self.get_git_version()
            .await?
            .ok_or_else(|| CogniaError::Provider("Git is not installed".into()))
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        self.get_git_path()
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("Git executable not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some(if cfg!(windows) {
            "winget install Git.Git".to_string()
        } else if cfg!(target_os = "macos") {
            "brew install git".to_string()
        } else {
            "sudo apt-get install git".to_string()
        })
    }

    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        // Git has no special system requirements beyond a working OS
        Ok(true)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        // On Linux, install/uninstall via apt/dnf/pacman requires sudo,
        // but sudo is already added to the command arguments in install_git/uninstall.
        // The provider handles elevation internally.
        false
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        if name == "git" {
            Ok(self.is_available().await)
        } else {
            Ok(false)
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_relative_history_path_basic() {
        let normalized = normalize_relative_history_path("./src/../src/main.rs").unwrap();
        assert_eq!(normalized, "src/main.rs");
    }

    #[test]
    fn test_normalize_relative_history_path_rejects_escape() {
        let err = normalize_relative_history_path("../../outside.txt")
            .err()
            .expect("expected escape path to fail");
        assert!(err.to_string().contains("outside repository"));
    }

    #[test]
    fn test_normalize_relative_history_path_rejects_absolute() {
        let absolute = if cfg!(windows) {
            "C:\\repo\\src\\main.rs"
        } else {
            "/repo/src/main.rs"
        };
        let err = normalize_relative_history_path(absolute)
            .err()
            .expect("expected absolute path to fail");
        assert!(err.to_string().contains("repository-relative"));
    }

    #[test]
    fn test_parse_version_windows() {
        assert_eq!(
            parse_version("git version 2.47.1.windows.1"),
            Some("2.47.1".to_string())
        );
    }

    #[test]
    fn test_parse_version_linux() {
        assert_eq!(
            parse_version("git version 2.47.1"),
            Some("2.47.1".to_string())
        );
    }

    #[test]
    fn test_parse_version_empty() {
        assert_eq!(parse_version(""), None);
    }

    #[test]
    fn test_map_clone_stream_error_cancelled() {
        let err = GitProvider::map_clone_stream_error(process::ProcessError::Signal);
        match err {
            CogniaError::Provider(message) => {
                assert!(message.contains("cancelled by user"));
            }
            other => panic!("unexpected error variant: {:?}", other),
        }
    }

    #[test]
    fn test_map_clone_stream_error_passthrough() {
        let err = GitProvider::map_clone_stream_error(process::ProcessError::StartFailed(
            std::io::Error::other("spawn failed"),
        ));
        match err {
            CogniaError::Provider(message) => {
                assert!(message.contains("git clone: Process failed to start"));
            }
            other => panic!("unexpected error variant: {:?}", other),
        }
    }

    #[test]
    fn test_parse_config_list() {
        let input = "user.name=John Doe\nuser.email=john@example.com\ncore.autocrlf=true\n";
        let entries = parse_config_list(input);
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].key, "user.name");
        assert_eq!(entries[0].value, "John Doe");
        assert_eq!(entries[1].key, "user.email");
        assert_eq!(entries[1].value, "john@example.com");
    }

    #[test]
    fn test_parse_config_with_equals_in_value() {
        let input = "url.ssh://git@github.com/.insteadOf=https://github.com/\n";
        let entries = parse_config_list(input);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].key, "url.ssh://git@github.com/.insteadOf");
        assert_eq!(entries[0].value, "https://github.com/");
    }

    #[test]
    fn test_parse_log_output() {
        // Format: hash, parents, author_name, author_email, date, message
        let input = format!(
            "abc1234{}parent1 parent2{}Author Name{}author@email.com{}2025-01-15T10:30:00+08:00{}Initial commit\n\
             def5678{}abc1234{}Other Author{}other@email.com{}2025-01-14T09:00:00+08:00{}Add feature",
            FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP,
            FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP
        );
        let commits = parse_log_output(&input);
        assert_eq!(commits.len(), 2);
        assert_eq!(commits[0].hash, "abc1234");
        assert_eq!(commits[0].parents, vec!["parent1", "parent2"]);
        assert_eq!(commits[0].author_name, "Author Name");
        assert_eq!(commits[0].message, "Initial commit");
        assert_eq!(commits[1].hash, "def5678");
        assert_eq!(commits[1].parents, vec!["abc1234"]);
    }

    #[test]
    fn test_parse_branches() {
        // Format: refname:short, objectname:short, upstream:short, HEAD, refname:strip=1
        let input = format!(
            "main{}abc1234{}origin/main{}*{}heads/main\n\
             feature/test{}def5678{}{}{}heads/feature/test\n\
             origin/main{}abc1234{}{}{}remotes/origin/main\n\
             dependabot/npm/lodash{}ghi9012{}{}{}heads/dependabot/npm/lodash",
            FIELD_SEP,
            FIELD_SEP,
            FIELD_SEP,
            FIELD_SEP,
            FIELD_SEP,
            FIELD_SEP,
            FIELD_SEP,
            FIELD_SEP,
            FIELD_SEP,
            FIELD_SEP,
            FIELD_SEP,
            FIELD_SEP,
            FIELD_SEP,
            FIELD_SEP,
            FIELD_SEP,
            FIELD_SEP
        );
        let branches = parse_branches(&input);
        assert_eq!(branches.len(), 4);
        assert!(branches[0].is_current);
        assert_eq!(branches[0].name, "main");
        assert!(!branches[0].is_remote);
        assert!(!branches[1].is_current);
        assert_eq!(branches[1].name, "feature/test");
        assert!(!branches[1].is_remote);
        assert_eq!(branches[2].name, "origin/main");
        assert!(branches[2].is_remote);
        // dependabot/ branch has a slash but is local — should NOT be remote
        assert_eq!(branches[3].name, "dependabot/npm/lodash");
        assert!(!branches[3].is_remote);
    }

    #[test]
    fn test_parse_remotes() {
        let input = "origin\thttps://github.com/user/repo.git (fetch)\n\
                      origin\thttps://github.com/user/repo.git (push)\n\
                      upstream\thttps://github.com/org/repo.git (fetch)\n\
                      upstream\tgit@github.com:org/repo.git (push)\n";
        let remotes = parse_remotes(input);
        assert_eq!(remotes.len(), 2);
        let origin = remotes.iter().find(|r| r.name == "origin").unwrap();
        assert_eq!(origin.fetch_url, "https://github.com/user/repo.git");
        assert_eq!(origin.push_url, "https://github.com/user/repo.git");
        let upstream = remotes.iter().find(|r| r.name == "upstream").unwrap();
        assert_eq!(upstream.fetch_url, "https://github.com/org/repo.git");
        assert_eq!(upstream.push_url, "git@github.com:org/repo.git");
    }

    #[test]
    fn test_parse_contributors() {
        let input = "   150\tJohn Doe <john@example.com>\n\
                       42\tJane Smith <jane@example.com>\n     5\tBot <bot@ci.com>\n";
        let contributors = parse_contributors(input);
        assert_eq!(contributors.len(), 3);
        assert_eq!(contributors[0].name, "John Doe");
        assert_eq!(contributors[0].commit_count, 150);
        assert_eq!(contributors[1].name, "Jane Smith");
        assert_eq!(contributors[1].commit_count, 42);
        assert_eq!(contributors[2].name, "Bot");
        assert_eq!(contributors[2].commit_count, 5);
    }

    #[test]
    fn test_parse_diff_stats() {
        let input = "10\t5\tsrc/main.rs\n3\t0\tREADME.md\n-\t-\timage.png\n";
        let files = parse_diff_stats(input);
        assert_eq!(files.len(), 3);
        assert_eq!(files[0].path, "src/main.rs");
        assert_eq!(files[0].insertions, 10);
        assert_eq!(files[0].deletions, 5);
        assert_eq!(files[2].insertions, 0); // binary file
    }

    #[test]
    fn test_parse_tags() {
        let input = format!(
            "v1.0.0{}abc1234{}2025-01-15 10:30:00 +0800\n\
             v0.9.0{}def5678{}2025-01-01 09:00:00 +0800",
            FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP
        );
        let tags = parse_tags(&input);
        assert_eq!(tags.len(), 2);
        assert_eq!(tags[0].name, "v1.0.0");
        assert_eq!(tags[0].short_hash, "abc1234");
    }

    #[test]
    fn test_parse_stashes() {
        let input = format!(
            "stash@{{0}}{}WIP on main: add feature{}2025-01-15T10:30:00+08:00\n\
             stash@{{1}}{}temp save{}2025-01-14T09:00:00+08:00",
            FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP
        );
        let stashes = parse_stashes(&input);
        assert_eq!(stashes.len(), 2);
        assert_eq!(stashes[0].id, "stash@{0}");
        assert_eq!(stashes[0].message, "WIP on main: add feature");
    }

    #[test]
    fn test_parse_blame_porcelain() {
        let input = "\
abcdef1234567890abcdef1234567890abcdef12 1 1 1\n\
author John Doe\n\
author-mail <john@example.com>\n\
author-time 1705300200\n\
author-tz +0800\n\
committer John Doe\n\
committer-mail <john@example.com>\n\
committer-time 1705300200\n\
committer-tz +0800\n\
summary Initial commit\n\
filename src/main.rs\n\
\tfn main() {\n\
abcdef1234567890abcdef1234567890abcdef12 2 2\n\
author John Doe\n\
author-mail <john@example.com>\n\
author-time 1705300200\n\
author-tz +0800\n\
committer John Doe\n\
committer-mail <john@example.com>\n\
committer-time 1705300200\n\
committer-tz +0800\n\
summary Initial commit\n\
filename src/main.rs\n\
\t    println!(\"Hello\");\n";
        let entries = parse_blame_porcelain(input);
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].author, "John Doe");
        assert_eq!(entries[0].author_email, "john@example.com");
        assert_eq!(entries[0].timestamp, 1705300200);
        assert_eq!(entries[0].summary, "Initial commit");
        assert_eq!(entries[0].line_number, 1);
        assert_eq!(entries[0].content, "fn main() {");
        assert_eq!(entries[1].line_number, 2);
    }

    #[test]
    fn test_parse_status_porcelain() {
        let input = "M  src/main.rs\nA  new_file.txt\n?? untracked.txt\n M modified.rs\n";
        let (staged, modified, untracked) = parse_status_porcelain(input);
        assert_eq!(staged, 2); // M (index) and A (index)
        assert_eq!(modified, 1); // M (worktree)
        assert_eq!(untracked, 1);
    }

    #[test]
    fn test_parse_status_files() {
        let input = "M  src/main.rs\nA  new_file.txt\n?? untracked.txt\nR  old.rs -> new.rs\n";
        let files = parse_status_files(input);
        assert_eq!(files.len(), 4);
        assert_eq!(files[0].path, "src/main.rs");
        assert_eq!(files[0].index_status, "M");
        assert_eq!(files[0].worktree_status, " ");
        assert_eq!(files[1].path, "new_file.txt");
        assert_eq!(files[1].index_status, "A");
        assert_eq!(files[2].path, "untracked.txt");
        assert_eq!(files[2].index_status, "?");
        assert_eq!(files[2].worktree_status, "?");
        assert_eq!(files[3].path, "new.rs");
        assert_eq!(files[3].old_path, Some("old.rs".to_string()));
    }

    #[test]
    fn test_parse_graph_log() {
        let input = format!(
            "abc1234{}parent1 parent2{}HEAD -> main, origin/main{}Author{}2025-01-15T10:30:00+08:00{}Initial commit\n\
             def5678{}abc1234{}tag: v1.0{}Other{}2025-01-14T09:00:00+08:00{}Add feature",
            FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP,
            FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP
        );
        let entries = parse_graph_log(&input);
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].hash, "abc1234");
        assert_eq!(entries[0].parents, vec!["parent1", "parent2"]);
        assert_eq!(entries[0].refs, vec!["HEAD -> main", "origin/main"]);
        assert_eq!(entries[1].refs, vec!["tag: v1.0"]);
    }

    #[test]
    fn test_parse_graph_log_empty_refs_and_message_sep() {
        let message = format!("Hello{}World", FIELD_SEP);
        let input = format!(
            "abc1234{}{}{}Author{}2025-01-15T10:30:00+08:00{}Hello{}World",
            FIELD_SEP,
            FIELD_SEP,
            FIELD_SEP,
            FIELD_SEP,
            FIELD_SEP,
            FIELD_SEP,
        );
        let entries = parse_graph_log(&input);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].refs, Vec::<String>::new());
        assert_eq!(entries[0].parents, Vec::<String>::new());
        assert_eq!(entries[0].message, message);
    }

    #[test]
    fn test_parse_graph_log_decorations_split() {
        let input = format!(
            "abc1234{}{}HEAD -> main, origin/main, origin/HEAD, tag: v1.0{}Author{}2025-01-15T10:30:00+08:00{}Msg",
            FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP
        );
        let entries = parse_graph_log(&input);
        assert_eq!(entries.len(), 1);
        assert_eq!(
            entries[0].refs,
            vec!["HEAD -> main", "origin/main", "origin/HEAD", "tag: v1.0"]
        );
    }

    #[test]
    fn test_build_graph_log_args_all_branches_first_parent() {
        let args = build_graph_log_args(50, true, true, None);
        assert_eq!(args[0], "log");
        assert!(args.contains(&"--decorate=short".to_string()));
        assert!(args.contains(&"--no-color".to_string()));
        assert!(args.contains(&"--first-parent".to_string()));
        assert!(args.contains(&"--all".to_string()));
        assert!(args.iter().any(|a| a.starts_with("--format=%H")));
        assert!(args.contains(&"-50".to_string()));
    }

    #[test]
    fn test_build_graph_log_args_branch_precedence_over_all() {
        let args = build_graph_log_args(100, true, false, Some("main"));
        assert!(!args.contains(&"--all".to_string()));
        assert!(args.contains(&"main".to_string()));
    }

    #[test]
    fn test_parse_ahead_behind() {
        assert_eq!(parse_ahead_behind("3\t5").ahead, 3);
        assert_eq!(parse_ahead_behind("3\t5").behind, 5);
        assert_eq!(parse_ahead_behind("0\t0").ahead, 0);
        assert_eq!(parse_ahead_behind("").ahead, 0);
    }

    #[test]
    fn test_parse_activity() {
        let input =
            "2025-01-15T10:30:00+08:00\n2025-01-15T11:00:00+08:00\n2025-01-14T09:00:00+08:00\n";
        let activity = parse_activity(input);
        assert_eq!(activity.len(), 2);
        let day15 = activity.iter().find(|a| a.date == "2025-01-15").unwrap();
        assert_eq!(day15.commit_count, 2);
        let day14 = activity.iter().find(|a| a.date == "2025-01-14").unwrap();
        assert_eq!(day14.commit_count, 1);
    }

    #[test]
    fn test_parse_file_stats() {
        let input = format!(
            "abc1234{}Author{}2025-01-15T10:30:00+08:00\n\
             10\t5\tsrc/main.rs\n\
             \n\
             def5678{}Other{}2025-01-14T09:00:00+08:00\n\
             3\t0\tREADME.md\n",
            FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP
        );
        let stats = parse_file_stats(&input);
        assert_eq!(stats.len(), 2);
        assert_eq!(stats[0].hash, "abc1234");
        assert_eq!(stats[0].additions, 10);
        assert_eq!(stats[0].deletions, 5);
        assert_eq!(stats[1].hash, "def5678");
        assert_eq!(stats[1].additions, 3);
        assert_eq!(stats[1].deletions, 0);
    }

    #[test]
    fn test_parse_reflog() {
        let input = format!(
            "abc1234{}HEAD@{{0}}{}commit: add feature{}2025-01-15T10:30:00+08:00\n\
             def5678{}HEAD@{{1}}{}checkout: moving from main to dev{}2025-01-14T09:00:00+08:00",
            FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP
        );
        let entries = parse_reflog(&input);
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].hash, "abc1234");
        assert_eq!(entries[0].selector, "HEAD@{0}");
        assert_eq!(entries[0].action, "commit");
        assert_eq!(entries[0].message, "commit: add feature");
        assert_eq!(entries[1].action, "checkout");
        assert_eq!(entries[1].selector, "HEAD@{1}");
    }

    // ====================================================================
    // Clone progress parsing tests
    // ====================================================================

    #[test]
    fn test_parse_clone_counting_objects() {
        let result = parse_clone_progress("remote: Counting objects: 100% (50/50), done.");
        assert!(result.is_some());
        let p = result.unwrap();
        assert_eq!(p.phase, "counting");
        assert_eq!(p.percent, Some(100));
        assert_eq!(p.current, Some(50));
        assert_eq!(p.total, Some(50));
    }

    #[test]
    fn test_parse_clone_receiving_partial() {
        let result = parse_clone_progress("Receiving objects:  45% (100/222)");
        assert!(result.is_some());
        let p = result.unwrap();
        assert_eq!(p.phase, "receiving");
        assert_eq!(p.percent, Some(45));
        assert_eq!(p.current, Some(100));
        assert_eq!(p.total, Some(222));
    }

    #[test]
    fn test_parse_clone_resolving_done() {
        let result = parse_clone_progress("Resolving deltas: 100% (80/80), done.");
        assert!(result.is_some());
        let p = result.unwrap();
        assert_eq!(p.phase, "resolving");
        assert_eq!(p.percent, Some(100));
        assert_eq!(p.current, Some(80));
        assert_eq!(p.total, Some(80));
    }

    #[test]
    fn test_parse_clone_checking_out() {
        let result = parse_clone_progress("Checking out files:  67% (100/150)");
        assert!(result.is_some());
        let p = result.unwrap();
        assert_eq!(p.phase, "checking_out");
        assert_eq!(p.percent, Some(67));
        assert_eq!(p.current, Some(100));
        assert_eq!(p.total, Some(150));
    }

    #[test]
    fn test_parse_clone_compressing() {
        let result = parse_clone_progress("remote: Compressing objects: 100% (30/30), done.");
        assert!(result.is_some());
        let p = result.unwrap();
        assert_eq!(p.phase, "compressing");
        assert_eq!(p.percent, Some(100));
    }

    #[test]
    fn test_parse_clone_cloning_into() {
        let result = parse_clone_progress("Cloning into 'repo'...");
        assert!(result.is_some());
        let p = result.unwrap();
        assert_eq!(p.phase, "cloning_into");
        assert_eq!(p.percent, None);
        assert_eq!(p.speed, None);
    }

    #[test]
    fn test_parse_clone_enumerating() {
        let result = parse_clone_progress("remote: Enumerating objects: 100, done.");
        assert!(result.is_some());
        let p = result.unwrap();
        assert_eq!(p.phase, "enumerating");
    }

    #[test]
    fn test_parse_clone_receiving_with_speed() {
        let result =
            parse_clone_progress("Receiving objects:  45% (100/222), 1.20 MiB | 512.00 KiB/s");
        assert!(result.is_some());
        let p = result.unwrap();
        assert_eq!(p.phase, "receiving");
        assert_eq!(p.percent, Some(45));
        assert_eq!(p.current, Some(100));
        assert_eq!(p.total, Some(222));
        assert_eq!(p.speed, Some("512.00 KiB/s".to_string()));
    }

    #[test]
    fn test_parse_clone_receiving_mib_speed() {
        let result =
            parse_clone_progress("Receiving objects:  90% (500/555), 50.00 MiB | 10.50 MiB/s");
        assert!(result.is_some());
        let p = result.unwrap();
        assert_eq!(p.speed, Some("10.50 MiB/s".to_string()));
    }

    #[test]
    fn test_parse_clone_empty_line() {
        assert!(parse_clone_progress("").is_none());
    }

    #[test]
    fn test_parse_clone_unknown_line() {
        assert!(parse_clone_progress("some random output").is_none());
    }

    // ====================================================================
    // extract_repo_name tests
    // ====================================================================

    #[test]
    fn test_extract_https_github() {
        assert_eq!(
            extract_repo_name("https://github.com/user/repo.git"),
            Some("repo".to_string())
        );
    }

    #[test]
    fn test_extract_ssh_github() {
        assert_eq!(
            extract_repo_name("git@github.com:user/repo.git"),
            Some("repo".to_string())
        );
    }

    #[test]
    fn test_extract_https_no_git_suffix() {
        assert_eq!(
            extract_repo_name("https://gitlab.com/user/repo"),
            Some("repo".to_string())
        );
    }

    #[test]
    fn test_extract_https_trailing_slash() {
        assert_eq!(
            extract_repo_name("https://github.com/user/repo/"),
            Some("repo".to_string())
        );
    }

    #[test]
    fn test_extract_ssh_nested() {
        assert_eq!(
            extract_repo_name("git@gitlab.com:group/subgroup/repo.git"),
            Some("repo".to_string())
        );
    }

    #[test]
    fn test_extract_local_path() {
        assert_eq!(
            extract_repo_name("/home/user/projects/myrepo"),
            Some("myrepo".to_string())
        );
    }

    #[test]
    fn test_extract_empty() {
        assert_eq!(extract_repo_name(""), None);
    }

    // ====================================================================
    // validate_git_url tests
    // ====================================================================

    #[test]
    fn test_valid_https() {
        assert!(validate_git_url("https://github.com/user/repo.git"));
    }

    #[test]
    fn test_valid_ssh() {
        assert!(validate_git_url("git@github.com:user/repo.git"));
    }

    #[test]
    fn test_valid_git_protocol() {
        assert!(validate_git_url("git://example.com/repo.git"));
    }

    #[test]
    fn test_invalid_empty() {
        assert!(!validate_git_url(""));
    }

    #[test]
    fn test_invalid_random() {
        assert!(!validate_git_url("not a url"));
    }

    #[test]
    fn test_invalid_no_path() {
        assert!(!validate_git_url("https://"));
    }

    #[test]
    fn test_valid_file_protocol() {
        assert!(validate_git_url("file:///home/user/repo"));
    }

    #[test]
    fn test_valid_generic_ssh() {
        assert!(validate_git_url(
            "deploy@server.example.com:repos/project.git"
        ));
    }

    #[test]
    fn test_valid_local_unix_path() {
        assert!(validate_git_url("/home/user/repos/myrepo"));
    }

    #[test]
    fn test_valid_ssh_protocol() {
        assert!(validate_git_url("ssh://git@github.com/user/repo.git"));
    }

    #[test]
    fn test_invalid_bare_at_sign() {
        assert!(!validate_git_url("@"));
    }

    #[test]
    fn test_invalid_single_slash() {
        assert!(!validate_git_url("/"));
    }

    // ====================================================================
    // parse_config_list edge cases
    // ====================================================================

    #[test]
    fn test_classify_config_read_error_timeout() {
        let err = CogniaError::Provider("git: Process timed out after 5s".to_string());
        let classified = classify_config_read_error("git config --global --list", err);
        assert!(classified
            .to_string()
            .contains("[git:timeout] git config --global --list failed"));
    }

    #[test]
    fn test_classify_config_read_error_execution() {
        let err = CogniaError::Provider("git: failed to read config".to_string());
        let classified = classify_config_read_error("git config --global --get user.name", err);
        assert!(classified
            .to_string()
            .contains("[git:execution] git config --global --get user.name failed"));
    }

    #[test]
    fn test_parse_config_list_empty() {
        assert!(parse_config_list("").is_empty());
    }

    #[test]
    fn test_parse_config_list_no_value() {
        let entries = parse_config_list("core.bare=\n");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].key, "core.bare");
        assert_eq!(entries[0].value, "");
    }

    #[test]
    fn test_parse_config_list_multiple() {
        let input = "user.name=John Doe\nuser.email=john@example.com\ncore.autocrlf=true\n";
        let entries = parse_config_list(input);
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].key, "user.name");
        assert_eq!(entries[0].value, "John Doe");
        assert_eq!(entries[2].key, "core.autocrlf");
        assert_eq!(entries[2].value, "true");
    }

    // ====================================================================
    // alias parsing (simulating list_aliases output)
    // ====================================================================

    #[test]
    fn test_parse_alias_output() {
        // git config --global --get-regexp "^alias\." output format
        let input =
            "alias.co checkout\nalias.br branch\nalias.lg log --oneline --graph --decorate --all\n";
        let entries: Vec<GitConfigEntry> = input
            .lines()
            .filter_map(|line| {
                let line = line.trim();
                if line.is_empty() {
                    return None;
                }
                let mut parts = line.splitn(2, ' ');
                let full_key = parts.next()?.trim();
                let value = parts.next().unwrap_or("").to_string();
                let alias_name = full_key.strip_prefix("alias.")?;
                Some(GitConfigEntry {
                    key: alias_name.to_string(),
                    value,
                })
            })
            .collect();
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].key, "co");
        assert_eq!(entries[0].value, "checkout");
        assert_eq!(entries[1].key, "br");
        assert_eq!(entries[1].value, "branch");
        assert_eq!(entries[2].key, "lg");
        assert_eq!(entries[2].value, "log --oneline --graph --decorate --all");
    }

    #[test]
    fn test_parse_alias_output_empty() {
        let input = "";
        let entries: Vec<GitConfigEntry> = input
            .lines()
            .filter_map(|line| {
                let line = line.trim();
                if line.is_empty() {
                    return None;
                }
                let mut parts = line.splitn(2, ' ');
                let full_key = parts.next()?.trim();
                let value = parts.next().unwrap_or("").to_string();
                let alias_name = full_key.strip_prefix("alias.")?;
                Some(GitConfigEntry {
                    key: alias_name.to_string(),
                    value,
                })
            })
            .collect();
        assert!(entries.is_empty());
    }

    // ====================================================================
    // Submodule parsing tests
    // ====================================================================

    #[test]
    fn test_parse_submodule_status_initialized() {
        let input = " abc1234def5678901234567890123456789012 lib/vendor (v1.0.0)\n";
        let subs = parse_submodule_status(input);
        assert_eq!(subs.len(), 1);
        assert_eq!(subs[0].path, "lib/vendor");
        assert_eq!(subs[0].hash, "abc1234def5678901234567890123456789012");
        assert_eq!(subs[0].status, "initialized");
        assert_eq!(subs[0].describe, "v1.0.0");
    }

    #[test]
    fn test_parse_submodule_status_uninitialized() {
        let input = "-abc1234def5678901234567890123456789012 lib/vendor\n";
        let subs = parse_submodule_status(input);
        assert_eq!(subs.len(), 1);
        assert_eq!(subs[0].status, "uninitialized");
        assert_eq!(subs[0].path, "lib/vendor");
        assert_eq!(subs[0].describe, "");
    }

    #[test]
    fn test_parse_submodule_status_modified() {
        let input = "+abc1234def5678901234567890123456789012 lib/vendor (v1.0.0-1-gabc1234)\n";
        let subs = parse_submodule_status(input);
        assert_eq!(subs.len(), 1);
        assert_eq!(subs[0].status, "modified");
    }

    #[test]
    fn test_parse_submodule_status_multiple() {
        let input = " aaa0000000000000000000000000000000000000 sub1 (v1)\n\
                      -bbb0000000000000000000000000000000000000 sub2\n\
                      +ccc0000000000000000000000000000000000000 sub3 (v3)\n";
        let subs = parse_submodule_status(input);
        assert_eq!(subs.len(), 3);
        assert_eq!(subs[0].status, "initialized");
        assert_eq!(subs[1].status, "uninitialized");
        assert_eq!(subs[2].status, "modified");
    }

    #[test]
    fn test_parse_submodule_status_empty() {
        assert!(parse_submodule_status("").is_empty());
    }

    // ====================================================================
    // Worktree parsing tests
    // ====================================================================

    #[test]
    fn test_parse_worktree_list_single() {
        let input = "worktree /home/user/project\nHEAD abc1234\nbranch refs/heads/main\n\n";
        let wts = parse_worktree_list(input);
        assert_eq!(wts.len(), 1);
        assert_eq!(wts[0].path, "/home/user/project");
        assert_eq!(wts[0].head, "abc1234");
        assert_eq!(wts[0].branch, Some("main".to_string()));
        assert!(!wts[0].is_bare);
        assert!(!wts[0].is_detached);
    }

    #[test]
    fn test_parse_worktree_list_multiple() {
        let input = "worktree /home/user/project\nHEAD abc1234\nbranch refs/heads/main\n\n\
                      worktree /home/user/project-feature\nHEAD def5678\nbranch refs/heads/feature\n\n";
        let wts = parse_worktree_list(input);
        assert_eq!(wts.len(), 2);
        assert_eq!(wts[0].branch, Some("main".to_string()));
        assert_eq!(wts[1].branch, Some("feature".to_string()));
    }

    #[test]
    fn test_parse_worktree_list_bare() {
        let input = "worktree /home/user/bare.git\nHEAD abc1234\nbare\n\n";
        let wts = parse_worktree_list(input);
        assert_eq!(wts.len(), 1);
        assert!(wts[0].is_bare);
        assert_eq!(wts[0].branch, None);
    }

    #[test]
    fn test_parse_worktree_list_detached() {
        let input = "worktree /home/user/detached\nHEAD abc1234\ndetached\n\n";
        let wts = parse_worktree_list(input);
        assert_eq!(wts.len(), 1);
        assert!(wts[0].is_detached);
        assert_eq!(wts[0].branch, None);
    }

    #[test]
    fn test_parse_worktree_list_no_trailing_newline() {
        let input = "worktree /tmp/wt\nHEAD abc1234\nbranch refs/heads/dev";
        let wts = parse_worktree_list(input);
        assert_eq!(wts.len(), 1);
        assert_eq!(wts[0].branch, Some("dev".to_string()));
    }

    #[test]
    fn test_parse_worktree_list_empty() {
        assert!(parse_worktree_list("").is_empty());
    }

    // ====================================================================
    // LFS parsing tests
    // ====================================================================

    #[test]
    fn test_parse_lfs_ls_files_standard() {
        let input = "abc123def456 * assets/large.psd\ndef789abc012 - docs/guide.pdf\n";
        let files = parse_lfs_ls_files(input);
        assert_eq!(files.len(), 2);
        assert_eq!(files[0].oid, "abc123def456");
        assert_eq!(files[0].pointer_status, "*");
        assert_eq!(files[0].name, "assets/large.psd");
        assert_eq!(files[1].pointer_status, "-");
        assert_eq!(files[1].name, "docs/guide.pdf");
    }

    #[test]
    fn test_parse_lfs_ls_files_empty() {
        assert!(parse_lfs_ls_files("").is_empty());
    }

    #[test]
    fn test_parse_lfs_ls_files_spaces_in_name() {
        let input = "abc123def456 * path with spaces/file name.bin\n";
        let files = parse_lfs_ls_files(input);
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].name, "path with spaces/file name.bin");
    }

    // ====================================================================
    // Status conflict handling tests
    // ====================================================================

    #[test]
    fn test_parse_status_porcelain_conflicts() {
        let input = "UU conflicted.txt\nAA both_added.txt\nM  normal.rs\n";
        let (staged, modified, untracked) = parse_status_porcelain(input);
        assert_eq!(staged, 3); // U (index) + A (index) + M (index)
        assert_eq!(modified, 2); // U (worktree) + A (worktree)
        assert_eq!(untracked, 0);
    }

    #[test]
    fn test_parse_status_files_conflict() {
        let input = "UU conflicted.txt\n";
        let files = parse_status_files(input);
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "conflicted.txt");
        assert_eq!(files[0].index_status, "U");
        assert_eq!(files[0].worktree_status, "U");
    }

    // ====================================================================
    // New data struct serialization tests
    // ====================================================================

    #[test]
    fn test_git_repo_stats_serialization() {
        let stats = GitRepoStats {
            size_on_disk: "4.50 MiB".into(),
            object_count: 1234,
            pack_count: 2,
            loose_objects: 10,
            commit_count: 500,
            is_shallow: false,
        };
        let json = serde_json::to_string(&stats).unwrap();
        assert!(json.contains("\"sizeOnDisk\":\"4.50 MiB\""));
        assert!(json.contains("\"objectCount\":1234"));
        assert!(json.contains("\"isShallow\":false"));
        let deserialized: GitRepoStats = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.commit_count, 500);
    }

    #[test]
    fn test_git_bisect_state_serialization() {
        let state = GitBisectState {
            active: true,
            current_hash: Some("abc1234".into()),
            steps_taken: 3,
            remaining_estimate: Some(4),
        };
        let json = serde_json::to_string(&state).unwrap();
        assert!(json.contains("\"active\":true"));
        assert!(json.contains("\"currentHash\":\"abc1234\""));
        assert!(json.contains("\"stepsTaken\":3"));
        assert!(json.contains("\"remainingEstimate\":4"));

        let inactive = GitBisectState {
            active: false,
            current_hash: None,
            steps_taken: 0,
            remaining_estimate: None,
        };
        let json2 = serde_json::to_string(&inactive).unwrap();
        assert!(json2.contains("\"active\":false"));
        assert!(json2.contains("\"currentHash\":null"));
    }

    #[test]
    fn test_git_rebase_todo_item_serialization() {
        let item = GitRebaseTodoItem {
            action: "squash".into(),
            hash: "abc1234def5678".into(),
            message: "Fix typo in readme".into(),
        };
        let json = serde_json::to_string(&item).unwrap();
        assert!(json.contains("\"action\":\"squash\""));
        assert!(json.contains("\"hash\":\"abc1234def5678\""));

        let items = vec![
            GitRebaseTodoItem {
                action: "pick".into(),
                hash: "aaa1111".into(),
                message: "First".into(),
            },
            GitRebaseTodoItem {
                action: "squash".into(),
                hash: "bbb2222".into(),
                message: "Second".into(),
            },
            GitRebaseTodoItem {
                action: "drop".into(),
                hash: "ccc3333".into(),
                message: "Third".into(),
            },
        ];
        let json = serde_json::to_string(&items).unwrap();
        let deserialized: Vec<GitRebaseTodoItem> = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.len(), 3);
        assert_eq!(deserialized[0].action, "pick");
        assert_eq!(deserialized[1].action, "squash");
        assert_eq!(deserialized[2].action, "drop");
    }

    #[test]
    fn test_git_merge_rebase_state_reverting() {
        let state = GitMergeRebaseState {
            state: "reverting".into(),
            onto: None,
            progress: None,
            total: None,
        };
        let json = serde_json::to_string(&state).unwrap();
        assert!(json.contains("\"state\":\"reverting\""));
    }

    // ====================================================================
    // count-objects parsing tests (for get_repo_stats)
    // ====================================================================

    #[test]
    fn test_parse_count_objects_output() {
        let input = "count: 42\nsize: 168\nin-pack: 1234\npacks: 2\nsize-pack: 4096\nprune-packable: 0\ngarbage: 0\nsize-garbage: 0\n";
        let mut size_on_disk = String::new();
        let mut object_count: u64 = 0;
        let mut pack_count: u32 = 0;
        let mut loose_objects: u32 = 0;
        for line in input.lines() {
            let line = line.trim();
            if let Some(rest) = line.strip_prefix("count: ") {
                loose_objects = rest.trim().parse().unwrap_or(0);
            } else if let Some(rest) = line.strip_prefix("in-pack: ") {
                object_count = rest.trim().parse().unwrap_or(0);
            } else if let Some(rest) = line.strip_prefix("packs: ") {
                pack_count = rest.trim().parse().unwrap_or(0);
            } else if let Some(rest) = line.strip_prefix("size-pack: ") {
                size_on_disk = rest.trim().to_string();
            }
        }
        object_count += loose_objects as u64;
        assert_eq!(loose_objects, 42);
        assert_eq!(object_count, 1276); // 1234 + 42
        assert_eq!(pack_count, 2);
        assert_eq!(size_on_disk, "4096");
    }

    #[test]
    fn test_parse_count_objects_empty() {
        let input = "";
        let mut loose_objects: u32 = 0;
        let mut object_count: u64 = 0;
        for line in input.lines() {
            let line = line.trim();
            if let Some(rest) = line.strip_prefix("count: ") {
                loose_objects = rest.trim().parse().unwrap_or(0);
            } else if let Some(rest) = line.strip_prefix("in-pack: ") {
                object_count = rest.trim().parse().unwrap_or(0);
            }
        }
        object_count += loose_objects as u64;
        assert_eq!(loose_objects, 0);
        assert_eq!(object_count, 0);
    }

    // ====================================================================
    // Provider metadata tests for new features
    // ====================================================================

    #[test]
    fn test_validate_git_url_windows_path() {
        #[cfg(windows)]
        {
            assert!(validate_git_url("C:\\Users\\test\\repo"));
            assert!(validate_git_url("D:/Projects/repo.git"));
        }
    }

    #[test]
    fn test_extract_repo_name_with_git_suffix_and_slash() {
        assert_eq!(
            extract_repo_name("https://github.com/user/repo.git/"),
            Some("repo".to_string())
        );
    }

    #[test]
    fn test_rebase_todo_item_short_hash() {
        let item = GitRebaseTodoItem {
            action: "pick".into(),
            hash: "abc".into(), // shorter than 7
            message: "short hash".into(),
        };
        // Ensure formatting doesn't panic on short hashes
        let formatted = format!(
            "{} {} {}",
            item.action,
            &item.hash[..7.min(item.hash.len())],
            item.message
        );
        assert_eq!(formatted, "pick abc short hash");
    }

    #[test]
    fn test_rebase_todo_item_exact_seven() {
        let item = GitRebaseTodoItem {
            action: "fixup".into(),
            hash: "abc1234".into(),
            message: "exact seven".into(),
        };
        let formatted = format!(
            "{} {} {}",
            item.action,
            &item.hash[..7.min(item.hash.len())],
            item.message
        );
        assert_eq!(formatted, "fixup abc1234 exact seven");
    }

    #[test]
    fn test_rebase_todo_item_long_hash() {
        let item = GitRebaseTodoItem {
            action: "reword".into(),
            hash: "abc1234def5678901234567890123456789012".into(),
            message: "long hash".into(),
        };
        let formatted = format!(
            "{} {} {}",
            item.action,
            &item.hash[..7.min(item.hash.len())],
            item.message
        );
        assert_eq!(formatted, "reword abc1234 long hash");
    }
}
