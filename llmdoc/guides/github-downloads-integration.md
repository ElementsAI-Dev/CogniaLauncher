# GitHub Downloads Integration Guide

## Overview

This guide covers the GitHub download feature that allows users to browse GitHub repositories and download releases, branches, or tags directly through the download manager.

## Features

- **Repository Validation**: Parse and validate GitHub repository URLs or `owner/repo` format
- **Release Browsing**: List and download release assets
- **Branch/Tag Support**: Download source archives from any branch or tag
- **Download Queue Integration**: All downloads are managed through the existing download queue

## Architecture

### Backend (Rust)

#### Provider Extensions (`src-tauri/src/provider/github.rs`)

New public types:
- `GitHubRelease` - Release information with assets
- `GitHubAsset` - Asset details (name, size, download URL)
- `GitHubBranch` - Branch information
- `GitHubTag` - Tag information

New methods on `GitHubProvider`:
```rust
pub async fn list_branches(&self, repo: &str) -> CogniaResult<Vec<GitHubBranch>>
pub async fn list_tags(&self, repo: &str) -> CogniaResult<Vec<GitHubTag>>
pub async fn list_releases(&self, repo: &str) -> CogniaResult<Vec<GitHubRelease>>
pub async fn get_release_by_tag(&self, repo: &str, tag: &str) -> CogniaResult<GitHubRelease>
pub async fn validate_repo(&self, repo: &str) -> bool
pub fn get_source_archive_url(&self, repo: &str, ref_name: &str, format: &str) -> String
pub fn parse_repo_url(url: &str) -> Option<(String, String)>
```

#### Tauri Commands (`src-tauri/src/commands/github.rs`)

| Command | Description |
|---------|-------------|
| `github_parse_url` | Parse owner/repo from URL |
| `github_validate_repo` | Check if repository exists |
| `github_list_branches` | List repository branches |
| `github_list_tags` | List repository tags |
| `github_list_releases` | List repository releases |
| `github_get_release_assets` | Get assets for a release |
| `github_download_asset` | Download asset to queue |
| `github_download_source` | Download source archive to queue |

### Frontend (TypeScript/React)

#### Types (`types/github.ts`)

```typescript
interface GitHubBranchInfo { name, commitSha, protected }
interface GitHubTagInfo { name, commitSha, zipballUrl, tarballUrl }
interface GitHubReleaseInfo { id, tagName, name, body, publishedAt, prerelease, draft, assets }
interface GitHubAssetInfo { id, name, size, sizeHuman, downloadUrl, contentType, downloadCount }
type GitHubSourceType = 'release' | 'branch' | 'tag'
type GitHubArchiveFormat = 'zip' | 'tar.gz'
```

#### Tauri Bindings (`lib/tauri.ts`)

Functions matching each Tauri command:
- `githubParseUrl(url)`
- `githubValidateRepo(repo)`
- `githubListBranches(repo)`
- `githubListTags(repo)`
- `githubListReleases(repo)`
- `githubGetReleaseAssets(repo, tag)`
- `githubDownloadAsset(repo, assetUrl, assetName, destination)`
- `githubDownloadSource(repo, refName, format, destination)`

#### Hook (`hooks/use-github-downloads.ts`)

```typescript
const {
  repoInput, setRepoInput,
  parsedRepo, isValidating, isValid,
  sourceType, setSourceType,
  branches, tags, releases,
  loading, error,
  validateAndFetch,
  downloadAsset,
  downloadSource,
  reset,
} = useGitHubDownloads();
```

#### Dialog Component (`components/downloads/github-download-dialog.tsx`)

Full-featured dialog with:
- Repository input with validation indicator
- Source type tabs (Releases | Branches | Tags)
- Release list with asset selection
- Branch/tag list with archive format selection
- Destination folder picker
- Download queue integration

## Usage

### From Downloads Page

1. Click "From GitHub" button in the page header
2. Enter repository (e.g., `microsoft/vscode` or full URL)
3. Click "Fetch" to validate and load data
4. Select source type (Release/Branch/Tag)
5. For releases: select assets to download
6. For branches/tags: choose archive format (ZIP/TAR.GZ)
7. Select destination folder
8. Click "Add to Queue"

### Programmatic Usage

```typescript
import { githubListReleases, githubDownloadAsset } from '@/lib/tauri';

// Fetch releases
const releases = await githubListReleases('owner/repo');

// Download an asset
const taskId = await githubDownloadAsset(
  'owner/repo',
  asset.downloadUrl,
  asset.name,
  '/path/to/destination'
);
```

## GitHub API Rate Limits

- Unauthenticated: 60 requests/hour
- Authenticated: 5000 requests/hour

Set `GITHUB_TOKEN` environment variable for higher limits.

## Related Files

- `src-tauri/src/provider/github.rs` - Backend provider
- `src-tauri/src/commands/github.rs` - Tauri commands
- `types/github.ts` - TypeScript types
- `lib/tauri.ts` - Tauri bindings
- `hooks/use-github-downloads.ts` - React hook
- `components/downloads/github-download-dialog.tsx` - UI component
- `app/downloads/page.tsx` - Integration point
