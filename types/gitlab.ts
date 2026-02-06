/**
 * GitLab API Types for CogniaLauncher
 * Used for GitLab repository download integration
 */

export interface GitLabBranchInfo {
  name: string;
  commitId: string;
  protected: boolean;
  default: boolean;
}

export interface GitLabTagInfo {
  name: string;
  commitId: string;
  message: string | null;
  protected: boolean;
}

export interface GitLabReleaseInfo {
  tagName: string;
  name: string | null;
  description: string | null;
  createdAt: string | null;
  releasedAt: string | null;
  upcomingRelease: boolean;
  assets: GitLabAssetInfo[];
  sources: GitLabSourceInfo[];
}

export interface GitLabAssetInfo {
  id: number;
  name: string;
  url: string;
  directAssetUrl: string | null;
  linkType: string | null;
}

export interface GitLabSourceInfo {
  format: string;
  url: string;
}

export interface GitLabParsedProject {
  owner: string;
  repo: string;
  fullName: string;
}

export interface GitLabProjectInfo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  webUrl: string;
  defaultBranch: string | null;
  starCount: number;
  forksCount: number;
  archived: boolean;
  topics: string[];
}

export type GitLabSourceType = 'release' | 'branch' | 'tag';

export type GitLabArchiveFormat = 'zip' | 'tar.gz' | 'tar.bz2' | 'tar';
