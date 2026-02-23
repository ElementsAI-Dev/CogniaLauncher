# GitHub Downloads Integration Guide

## Overview

This guide covers the GitHub download feature that allows users to browse GitHub repositories and download releases, branches, or tags directly through the download manager.

## Features

- **Repository Validation**: Parse and validate GitHub repository URLs or `owner/repo` format
- **Repository Info**: Display stars, license, description, and archived status after validation
- **Release Browsing**: List and download release assets with draft/prerelease indicators
- **Release Notes**: Collapsible changelog viewer for selected releases
- **Asset Intelligence**: Platform/architecture detection, recommended asset selection, download count display
- **Branch/Tag Support**: Download source archives from any branch or tag
- **Token Persistence**: Save/load GitHub tokens across sessions for private repo access
- **Download Queue Integration**: All downloads are managed through the existing download queue

## Architecture

### Backend (Rust)

#### Provider Extensions (`src-tauri/src/provider/github.rs`)

Public types:
- `GitHubRelease` - Release information with assets
- `GitHubAsset` - Asset details (name, size, download URL)
- `GitHubBranch` - Branch information
- `GitHubTag` - Tag information
- `GitHubRepoInfo` - Repository metadata (description, stars, license, topics, etc.)

Methods on `GitHubProvider`:
```rust
pub async fn get_repo_info(&self, repo: &str) -> CogniaResult<GitHubRepoInfo>
pub async fn list_branches(&self, repo: &str) -> CogniaResult<Vec<GitHubBranch>>
pub async fn list_tags(&self, repo: &str) -> CogniaResult<Vec<GitHubTag>>
pub async fn list_releases(&self, repo: &str) -> CogniaResult<Vec<GitHubRelease>>
pub async fn get_release_by_tag(&self, repo: &str, tag: &str) -> CogniaResult<GitHubRelease>
pub async fn get_latest_release(&self, repo: &str) -> CogniaResult<GitHubRelease>
pub async fn validate_repo(&self, repo: &str) -> bool
pub async fn validate_token(&self) -> bool
pub fn get_source_archive_url(&self, repo: &str, ref_name: &str, format: &str) -> String
pub fn parse_repo_url(url: &str) -> Option<(String, String)>
```

#### Tauri Commands (`src-tauri/src/commands/github.rs`)

| Command | Description |
|---------|-------------|
| `github_parse_url` | Parse owner/repo from URL |
| `github_validate_repo` | Check if repository exists |
| `github_get_repo_info` | Get repository metadata (stars, license, description, etc.) |
| `github_list_branches` | List repository branches |
| `github_list_tags` | List repository tags |
| `github_list_releases` | List repository releases |
| `github_get_release_assets` | Get assets for a release |
| `github_download_asset` | Download asset to queue |
| `github_download_source` | Download source archive to queue |
| `github_set_token` | Save GitHub token to settings |
| `github_get_token` | Get saved GitHub token |
| `github_clear_token` | Clear saved GitHub token |
| `github_validate_token` | Validate a GitHub token |

### Frontend (TypeScript/React)

#### Types (`types/github.ts`)

```typescript
interface GitHubBranchInfo { name, commitSha, protected }
interface GitHubTagInfo { name, commitSha, zipballUrl, tarballUrl }
interface GitHubReleaseInfo { id, tagName, name, body, publishedAt, prerelease, draft, assets }
interface GitHubAssetInfo { id, name, size, sizeHuman, downloadUrl, contentType, downloadCount }
interface GitHubParsedRepo { owner, repo, fullName }
interface GitHubRepoInfoResponse { fullName, description, homepage, license, stargazersCount, forksCount, openIssuesCount, defaultBranch, archived, disabled, topics }
type GitHubSourceType = 'release' | 'branch' | 'tag'
type GitHubArchiveFormat = 'zip' | 'tar.gz'
```

#### Tauri Bindings (`lib/tauri.ts`)

Functions matching each Tauri command:
- `githubParseUrl(url)`
- `githubValidateRepo(repo, token?)`
- `githubGetRepoInfo(repo, token?)` — returns repository metadata
- `githubListBranches(repo, token?)`
- `githubListTags(repo, token?)`
- `githubListReleases(repo, token?)`
- `githubGetReleaseAssets(repo, tag, token?)`
- `githubDownloadAsset(repo, assetId, assetUrl, assetName, destination, token?)`
- `githubDownloadSource(repo, refName, format, destination, token?)`
- `githubSetToken(token)` — persist token to settings
- `githubGetToken()` — load saved token
- `githubClearToken()` — remove saved token
- `githubValidateToken(token)` — validate token via API

#### Hook (`hooks/use-github-downloads.ts`)

```typescript
const {
  repoInput, setRepoInput,
  token, setToken,
  parsedRepo, repoInfo,
  isValidating, isValid,
  sourceType, setSourceType,
  branches, tags, releases,
  loading, error,
  validateAndFetch,
  downloadAsset,
  downloadSource,
  saveToken, clearSavedToken,
  reset,
} = useGitHubDownloads();
```

The hook automatically loads saved tokens on mount and fetches repo info alongside branches/tags/releases during validation.

#### Asset Matcher (`hooks/use-asset-matcher.ts`)

Provides platform/architecture detection and asset scoring:
- `parseAssets(assets)` — returns scored, sorted assets with platform/arch detection
- `getRecommendedAsset(assets)` — returns the best asset for the current platform
- Filters out checksum/signature files (`.sha256`, `.sig`, `.asc`, etc.)

#### Dialog Component (`components/downloads/github-download-dialog.tsx`)

Full-featured dialog with:
- Repository input with validation indicator
- **Repository info display** (stars, license, description, archived warning)
- **Token persistence** (Save/Clear buttons, auto-loads saved token)
- Source type tabs (Releases | Branches | Tags)
- Release list with **draft** and prerelease badges
- **Release notes** collapsible viewer
- Asset selection with **platform detection**, **download count**, and **"Select Recommended"** button
- Branch/tag list with archive format selection
- Destination folder picker
- Download queue integration

## Usage

### From Downloads Page

1. Click "From GitHub" button in the page header
2. Enter repository (e.g., `microsoft/vscode` or full URL)
3. Click "Fetch" to validate and load data
4. View repository info (stars, license, description)
5. Select source type (Release/Branch/Tag)
6. For releases: select assets (use "Select Recommended" for auto-detection)
7. For branches/tags: choose archive format (ZIP/TAR.GZ)
8. Select destination folder
9. Click "Add to Queue"

### Token Management

Tokens can be saved for persistent access to private repositories:
- Enter token in the Authentication section
- Click "Save" to persist across sessions
- Click "Clear" to remove saved token
- Tokens are stored via the settings system (`providers.github.token`)
- The `GITHUB_TOKEN` environment variable is also supported as fallback

### Programmatic Usage

```typescript
import { githubListReleases, githubDownloadAsset, githubGetRepoInfo } from '@/lib/tauri';

// Fetch repo info
const info = await githubGetRepoInfo('owner/repo');
console.log(info.stargazersCount, info.license);

// Fetch releases
const releases = await githubListReleases('owner/repo');

// Download an asset
const taskId = await githubDownloadAsset(
  'owner/repo',
  asset.id,
  asset.downloadUrl,
  asset.name,
  '/path/to/destination'
);
```

## GitHub API Rate Limits

- Unauthenticated: 60 requests/hour
- Authenticated: 5000 requests/hour

Set `GITHUB_TOKEN` environment variable or save a token in the dialog for higher limits.

## Related Files

- `src-tauri/src/provider/github.rs` - Backend provider
- `src-tauri/src/commands/github.rs` - Tauri commands
- `types/github.ts` - TypeScript types
- `lib/tauri.ts` - Tauri bindings
- `hooks/use-github-downloads.ts` - React hook
- `hooks/use-asset-matcher.ts` - Asset platform detection and scoring
- `components/downloads/github-download-dialog.tsx` - UI component
- `app/downloads/page.tsx` - Integration point
