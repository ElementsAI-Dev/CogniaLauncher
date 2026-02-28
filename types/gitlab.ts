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
  namespace: string;
  project: string;
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

export interface GitLabSearchResult {
  fullName: string;
  description: string | null;
  starCount: number;
  archived: boolean;
  webUrl: string;
}

export interface GitLabPipelineInfo {
  id: number;
  refName: string | null;
  status: string;
  source: string | null;
  createdAt: string | null;
  webUrl: string | null;
}

export interface GitLabJobInfo {
  id: number;
  name: string;
  stage: string | null;
  status: string;
  refName: string | null;
  hasArtifacts: boolean;
  webUrl: string | null;
  finishedAt: string | null;
}

export interface GitLabPackageInfo {
  id: number;
  name: string;
  version: string;
  packageType: string;
  createdAt: string | null;
}

export interface GitLabPackageFileInfo {
  id: number;
  fileName: string;
  size: number;
  fileSha256: string | null;
  createdAt: string | null;
}

export type GitLabSourceType = 'release' | 'branch' | 'tag';

export type GitLabArchiveFormat = 'zip' | 'tar.gz' | 'tar.bz2' | 'tar';
