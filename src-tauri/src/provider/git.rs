use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::env::Platform;
use crate::platform::process::{self, ProcessOptions};
use async_trait::async_trait;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::time::Duration;

/// Default timeout for Git commands (30 seconds)
const GIT_TIMEOUT: Duration = Duration::from_secs(30);
/// Longer timeout for install/update operations
const GIT_INSTALL_TIMEOUT: Duration = Duration::from_secs(300);

/// Unit separator character used as delimiter in git --format output
const FIELD_SEP: char = '\x1f';

fn make_opts() -> ProcessOptions {
    ProcessOptions::new().with_timeout(GIT_TIMEOUT)
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
    let out = process::execute("git", args, Some(make_opts()))
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
// Clone progress parsing & URL helpers
// ============================================================================

/// Parse a git clone progress line from stderr.
/// Git clone with `--progress` emits lines like:
///   "remote: Counting objects: 100% (50/50), done."
///   "Receiving objects:  45% (100/222)"
///   "Resolving deltas: 100% (80/80), done."
///   "Checking out files:  67% (100/150)"
pub fn parse_clone_progress(line: &str) -> Option<GitCloneProgress> {
    let line = line.trim();
    if line.is_empty() {
        return None;
    }

    // Strip optional "remote: " prefix
    let content = line.strip_prefix("remote: ").unwrap_or(line);

    let phase = if content.starts_with("Counting") {
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

    let percent_re = Regex::new(r"(\d+)%").ok()?;
    let count_re = Regex::new(r"\((\d+)/(\d+)\)").ok()?;

    let percent = percent_re
        .captures(content)
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().parse::<u32>().ok());

    let (current, total) = if let Some(caps) = count_re.captures(content) {
        let cur = caps.get(1).and_then(|m| m.as_str().parse::<u64>().ok());
        let tot = caps.get(2).and_then(|m| m.as_str().parse::<u64>().ok());
        (cur, tot)
    } else {
        (None, None)
    };

    Some(GitCloneProgress {
        phase: phase.to_string(),
        percent,
        current,
        total,
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
            return path.rsplit('/').next().map(|s| s.to_string()).filter(|s| !s.is_empty());
        }
    }

    // URL format: scheme://host/path/repo
    if cleaned.contains("://") {
        return cleaned.rsplit('/').next().map(|s| s.to_string()).filter(|s| !s.is_empty());
    }

    // Local path or bare name: extract basename
    #[cfg(windows)]
    let name = cleaned.rsplit(&['/', '\\'][..]).next();
    #[cfg(not(windows))]
    let name = cleaned.rsplit('/').next();

    name.map(|s| s.to_string()).filter(|s| !s.is_empty())
}

/// Validate whether a string looks like a valid git remote URL.
pub fn validate_git_url(url: &str) -> bool {
    let url = url.trim();
    if url.is_empty() {
        return false;
    }

    // HTTPS/HTTP/git:// protocol
    for scheme in &["https://", "http://", "git://", "ssh://"] {
        if let Some(rest) = url.strip_prefix(scheme) {
            // Must have at least host/path
            return rest.contains('/') && rest.len() > 3;
        }
    }

    // SSH shorthand: git@host:path
    if let Some(rest) = url.strip_prefix("git@") {
        return rest.contains(':') && rest.len() > 3;
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
        match run_git_lenient(&["config", "--global", "--list"]).await {
            Ok(output) => Ok(parse_config_list(&output)),
            Err(_) => Ok(vec![]),
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
        if let Some(f) = file {
            args.push("--");
            args.push(f);
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
    ) -> CogniaResult<Vec<GitCommitEntry>> {
        let format_str = format!(
            "%H{}%P{}%an{}%ae{}%aI{}%s",
            FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP
        );
        let format_arg = format!("--format={}", format_str);
        let limit_str = format!("-{}", limit);
        let output = run_git_in_lenient(
            path,
            &["log", &format_arg, &limit_str, "--follow", "--", file],
        )
        .await?;

        Ok(parse_log_output(&output))
    }

    /// Get blame for a file
    pub async fn get_blame(&self, path: &str, file: &str) -> CogniaResult<Vec<GitBlameEntry>> {
        let output = run_git_in(path, &["blame", "--line-porcelain", file]).await?;
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
    ) -> CogniaResult<Vec<GitGraphEntry>> {
        let format_str = format!(
            "%H{}%P{}%D{}%an{}%aI{}%s",
            FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP
        );
        let format_arg = format!("--format={}", format_str);
        let limit_str = format!("-{}", limit);
        let mut args = vec!["log", "--topo-order", &format_arg, &limit_str];
        if all_branches {
            args.push("--all");
        }
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
    ) -> CogniaResult<Vec<GitFileStatEntry>> {
        let format_str = format!("%H{}%an{}%aI", FIELD_SEP, FIELD_SEP);
        let format_arg = format!("--format={}", format_str);
        let limit_str = format!("-{}", limit);
        let output = run_git_in_lenient(
            path,
            &[
                "log",
                "--numstat",
                &format_arg,
                &limit_str,
                "--follow",
                "--",
                file,
            ],
        )
        .await?;
        Ok(parse_file_stats(&output))
    }

    /// Search commits by message, author, or diff content
    pub async fn search_commits(
        &self,
        path: &str,
        query: &str,
        search_type: &str,
        limit: u32,
    ) -> CogniaResult<Vec<GitCommitEntry>> {
        let format_str = format!(
            "%H{}%P{}%an{}%ae{}%aI{}%s",
            FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP, FIELD_SEP
        );
        let format_arg = format!("--format={}", format_str);
        let limit_str = format!("-{}", limit);

        let search_arg;
        let mut args = vec!["log", &format_arg, &limit_str];
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
    ) -> CogniaResult<String> {
        let mut args = vec!["commit", "-m", message];
        if amend {
            args.push("--amend");
        }
        run_git_in(path, &args).await
    }

    /// Push to remote
    pub async fn push(
        &self,
        path: &str,
        remote: Option<&str>,
        branch: Option<&str>,
        force_lease: bool,
    ) -> CogniaResult<String> {
        let mut full_args = vec!["-C", path, "push"];
        if force_lease {
            full_args.push("--force-with-lease");
        }
        if let Some(r) = remote {
            full_args.push(r);
        }
        if let Some(b) = branch {
            full_args.push(b);
        }
        let out = process::execute("git", &full_args, Some(make_install_opts()))
            .await
            .map_err(|e| CogniaError::Provider(format!("git push: {}", e)))?;
        if out.success {
            let msg = out.stderr.trim().to_string();
            Ok(if msg.is_empty() {
                "Push completed".into()
            } else {
                msg
            })
        } else {
            let err = if out.stderr.trim().is_empty() {
                out.stdout.trim().to_string()
            } else {
                out.stderr.trim().to_string()
            };
            Err(CogniaError::Provider(format!("git push: {}", err)))
        }
    }

    /// Pull from remote
    pub async fn pull(
        &self,
        path: &str,
        remote: Option<&str>,
        branch: Option<&str>,
        rebase: bool,
    ) -> CogniaResult<String> {
        let mut full_args = vec!["-C", path, "pull"];
        if rebase {
            full_args.push("--rebase");
        }
        if let Some(r) = remote {
            full_args.push(r);
        }
        if let Some(b) = branch {
            full_args.push(b);
        }
        let out = process::execute("git", &full_args, Some(make_install_opts()))
            .await
            .map_err(|e| CogniaError::Provider(format!("git pull: {}", e)))?;
        if out.success {
            Ok(out.stdout.trim().to_string())
        } else {
            let err = if out.stderr.trim().is_empty() {
                out.stdout.trim().to_string()
            } else {
                out.stderr.trim().to_string()
            };
            Err(CogniaError::Provider(format!("git pull: {}", err)))
        }
    }

    /// Fetch from remote
    pub async fn fetch_remote(&self, path: &str, remote: Option<&str>) -> CogniaResult<String> {
        let mut full_args = vec!["-C", path, "fetch"];
        if let Some(r) = remote {
            full_args.push(r);
        }
        let out = process::execute("git", &full_args, Some(make_install_opts()))
            .await
            .map_err(|e| CogniaError::Provider(format!("git fetch: {}", e)))?;
        if out.success {
            let msg = out.stderr.trim().to_string();
            Ok(if msg.is_empty() {
                "Fetch completed".into()
            } else {
                msg
            })
        } else {
            let err = if out.stderr.trim().is_empty() {
                out.stdout.trim().to_string()
            } else {
                out.stderr.trim().to_string()
            };
            Err(CogniaError::Provider(format!("git fetch: {}", err)))
        }
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
        let out = process::execute("git", &arg_refs, Some(make_install_opts()))
            .await
            .map_err(|e| CogniaError::Provider(format!("git clone: {}", e)))?;
        if out.success {
            Ok(format!("Repository cloned to {}", dest_path))
        } else {
            let err = if out.stderr.trim().is_empty() {
                out.stdout.trim().to_string()
            } else {
                out.stderr.trim().to_string()
            };
            Err(CogniaError::Provider(format!("git clone: {}", err)))
        }
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
    ) -> CogniaResult<String> {
        let mut args = vec!["diff"];
        if staged {
            args.push("--staged");
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
    ) -> CogniaResult<String> {
        let mut args = vec!["diff", from, to];
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
    pub async fn remote_set_url(
        &self,
        path: &str,
        name: &str,
        url: &str,
    ) -> CogniaResult<String> {
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
        let mut full_args = vec!["-C", path, "push", "--tags"];
        if let Some(r) = remote {
            full_args.push(r);
        }
        let out = process::execute("git", &full_args, Some(make_install_opts()))
            .await
            .map_err(|e| CogniaError::Provider(format!("git push --tags: {}", e)))?;
        if out.success {
            Ok("Tags pushed to remote".into())
        } else {
            let err = if out.stderr.trim().is_empty() {
                out.stdout.trim().to_string()
            } else {
                out.stderr.trim().to_string()
            };
            Err(CogniaError::Provider(format!("git push --tags: {}", err)))
        }
    }

    /// Delete a remote branch
    pub async fn delete_remote_branch(
        &self,
        path: &str,
        remote: &str,
        branch: &str,
    ) -> CogniaResult<String> {
        let full_args = vec!["-C", path, "push", remote, "--delete", branch];
        let out = process::execute("git", &full_args, Some(make_install_opts()))
            .await
            .map_err(|e| CogniaError::Provider(format!("git push --delete: {}", e)))?;
        if out.success {
            Ok(format!("Remote branch '{}/{}' deleted", remote, branch))
        } else {
            let err = if out.stderr.trim().is_empty() {
                out.stdout.trim().to_string()
            } else {
                out.stderr.trim().to_string()
            };
            Err(CogniaError::Provider(format!(
                "git push --delete: {}",
                err
            )))
        }
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
            FIELD_SEP, FIELD_SEP, FIELD_SEP,
            FIELD_SEP, FIELD_SEP, FIELD_SEP
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
        let result =
            parse_clone_progress("remote: Compressing objects: 100% (30/30), done.");
        assert!(result.is_some());
        let p = result.unwrap();
        assert_eq!(p.phase, "compressing");
        assert_eq!(p.percent, Some(100));
    }

    #[test]
    fn test_parse_clone_cloning_into() {
        assert!(parse_clone_progress("Cloning into 'repo'...").is_none());
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
}
