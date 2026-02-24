# Git Integration System Overview

## 1. Identity

- **What it is:** Full Git repository management and inspection system integrated into CogniaLauncher.
- **Purpose:** Provide Git version detection, global config management, and repository inspection (branches, tags, log, blame, stash, contributors) without leaving the application.

## 2. Key Features

- **Version Management**: Detect installed Git version, install/update Git via system package manager
- **Global Config**: Read/write/remove global git configuration entries
- **Repository Inspection**: Branch listing, tag listing, commit log with filters, file blame, stash list, contributor list
- **Remote Management**: List configured remotes for a repository
- **File History**: Track modification history for individual files

## 3. Components

### Backend
- `src-tauri/src/provider/git.rs` — GitProvider implementing Provider + SystemPackageProvider traits (1365 lines)
- `src-tauri/src/commands/git.rs` — 33 Tauri commands for Git operations

### Frontend
- `app/git/page.tsx` — Git repository management UI page
- `hooks/use-git.ts` — React hook for Git operations

### Commands (33 total)
| Command | Purpose |
|---------|---------|
| `git_is_available` | Check if git is installed |
| `git_get_version` | Get git version string |
| `git_get_executable_path` | Get git executable path |
| `git_install` | Install git via system package manager |
| `git_update` | Update git to latest version |
| `git_get_config` | Get global git config entries |
| `git_set_config` | Set a global git config value |
| `git_remove_config` | Remove a global git config key |
| `git_get_repo_info` | Get repository info (branch, dirty, head) |
| `git_get_log` | Get commit log with filters |
| `git_get_branches` | Get branch list |
| `git_get_remotes` | Get remote list |
| `git_get_tags` | Get tag list |
| `git_get_stashes` | Get stash list |
| `git_get_contributors` | Get contributor list |
| `git_get_file_history` | Get file modification history |
| `git_get_blame` | Get blame info for a file |

## 4. Provider Details

- **ID**: `git`
- **Platform**: Cross-platform (Windows, macOS, Linux)
- **Capabilities**: Install, Update, Search, List
- **Detection**: `git --version` with pattern `git version (\d+\.\d+\.\d+)`
- **SystemPackageProvider**: Provides `get_version()`, `get_executable_path()`, `get_install_instructions()`

## 5. Related Documentation

- [Provider System Architecture](../architecture/provider-system.md)
- [Tauri Backend Docs](../../src-tauri/CLAUDE.md)
