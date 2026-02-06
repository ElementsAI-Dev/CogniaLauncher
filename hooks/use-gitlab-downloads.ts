import { useState, useCallback, useEffect } from 'react';
import { isTauri } from '@/lib/tauri';
import type {
  GitLabBranchInfo,
  GitLabTagInfo,
  GitLabReleaseInfo,
  GitLabAssetInfo,
  GitLabParsedProject,
  GitLabProjectInfo,
  GitLabSourceType,
  GitLabArchiveFormat,
} from '@/types/gitlab';

interface UseGitLabDownloadsReturn {
  projectInput: string;
  setProjectInput: (value: string) => void;
  parsedProject: GitLabParsedProject | null;
  projectInfo: GitLabProjectInfo | null;
  isValidating: boolean;
  isValid: boolean | null;
  sourceType: GitLabSourceType;
  setSourceType: (type: GitLabSourceType) => void;
  branches: GitLabBranchInfo[];
  tags: GitLabTagInfo[];
  releases: GitLabReleaseInfo[];
  loading: boolean;
  error: string | null;
  validateAndFetch: () => Promise<void>;
  downloadAsset: (asset: GitLabAssetInfo, destination: string) => Promise<string>;
  downloadSource: (refName: string, format: GitLabArchiveFormat, destination: string) => Promise<string>;
  reset: () => void;
}

export function useGitLabDownloads(): UseGitLabDownloadsReturn {
  const [projectInput, setProjectInput] = useState('');
  const [parsedProject, setParsedProject] = useState<GitLabParsedProject | null>(null);
  const [projectInfo, setProjectInfo] = useState<GitLabProjectInfo | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [sourceType, setSourceType] = useState<GitLabSourceType>('release');
  const [branches, setBranches] = useState<GitLabBranchInfo[]>([]);
  const [tags, setTags] = useState<GitLabTagInfo[]>([]);
  const [releases, setReleases] = useState<GitLabReleaseInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setProjectInput('');
    setParsedProject(null);
    setProjectInfo(null);
    setIsValid(null);
    setSourceType('release');
    setBranches([]);
    setTags([]);
    setReleases([]);
    setError(null);
  }, []);

  const validateAndFetch = useCallback(async () => {
    if (!isTauri() || !projectInput.trim()) {
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const tauri = await import('@/lib/tauri');

      const parsed = await tauri.gitlabParseUrl(projectInput.trim());
      if (!parsed) {
        setIsValid(false);
        setParsedProject(null);
        setError('Invalid project format. Use owner/repo or GitLab URL.');
        setIsValidating(false);
        return;
      }

      setParsedProject(parsed);

      const valid = await tauri.gitlabValidateProject(parsed.fullName);
      setIsValid(valid);

      if (!valid) {
        setError('Project not found or inaccessible.');
        setIsValidating(false);
        return;
      }

      setLoading(true);

      const [releasesData, branchesData, tagsData, info] = await Promise.all([
        tauri.gitlabListReleases(parsed.fullName).catch(() => []),
        tauri.gitlabListBranches(parsed.fullName).catch(() => []),
        tauri.gitlabListTags(parsed.fullName).catch(() => []),
        tauri.gitlabGetProjectInfo(parsed.fullName).catch(() => null),
      ]);

      setReleases(releasesData);
      setBranches(branchesData);
      setTags(tagsData);
      setProjectInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsValid(false);
    } finally {
      setIsValidating(false);
      setLoading(false);
    }
  }, [projectInput]);

  const downloadAsset = useCallback(
    async (asset: GitLabAssetInfo, destination: string): Promise<string> => {
      if (!isTauri() || !parsedProject) {
        throw new Error('Not available');
      }

      const tauri = await import('@/lib/tauri');
      const url = asset.directAssetUrl || asset.url;
      return tauri.gitlabDownloadAsset(
        parsedProject.fullName,
        url,
        asset.name,
        destination
      );
    },
    [parsedProject]
  );

  const downloadSource = useCallback(
    async (refName: string, format: GitLabArchiveFormat, destination: string): Promise<string> => {
      if (!isTauri() || !parsedProject) {
        throw new Error('Not available');
      }

      const tauri = await import('@/lib/tauri');
      return tauri.gitlabDownloadSource(parsedProject.fullName, refName, format, destination);
    },
    [parsedProject]
  );

  useEffect(() => {
    if (!projectInput.trim()) {
      setParsedProject(null);
      setProjectInfo(null);
      setIsValid(null);
      setBranches([]);
      setTags([]);
      setReleases([]);
    }
  }, [projectInput]);

  return {
    projectInput,
    setProjectInput,
    parsedProject,
    projectInfo,
    isValidating,
    isValid,
    sourceType,
    setSourceType,
    branches,
    tags,
    releases,
    loading,
    error,
    validateAndFetch,
    downloadAsset,
    downloadSource,
    reset,
  };
}
