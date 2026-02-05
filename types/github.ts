/**
 * GitHub API Types for CogniaLauncher
 * Used for GitHub repository download integration
 */

export interface GitHubBranchInfo {
  name: string;
  commitSha: string;
  protected: boolean;
}

export interface GitHubTagInfo {
  name: string;
  commitSha: string;
  zipballUrl: string | null;
  tarballUrl: string | null;
}

export interface GitHubReleaseInfo {
  id: number;
  tagName: string;
  name: string | null;
  body: string | null;
  publishedAt: string | null;
  prerelease: boolean;
  draft: boolean;
  assets: GitHubAssetInfo[];
}

export interface GitHubAssetInfo {
  id: number;
  name: string;
  size: number;
  sizeHuman: string;
  downloadUrl: string;
  contentType: string | null;
  downloadCount: number | null;
}

export interface GitHubParsedRepo {
  owner: string;
  repo: string;
  fullName: string;
}

export type GitHubSourceType = 'release' | 'branch' | 'tag';

export type GitHubArchiveFormat = 'zip' | 'tar.gz';
