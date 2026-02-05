import { useState, useCallback, useEffect } from 'react';
import { isTauri } from '@/lib/tauri';
import type {
  GitHubBranchInfo,
  GitHubTagInfo,
  GitHubReleaseInfo,
  GitHubAssetInfo,
  GitHubParsedRepo,
  GitHubSourceType,
  GitHubArchiveFormat,
} from '@/types/github';

interface UseGitHubDownloadsReturn {
  repoInput: string;
  setRepoInput: (value: string) => void;
  parsedRepo: GitHubParsedRepo | null;
  isValidating: boolean;
  isValid: boolean | null;
  sourceType: GitHubSourceType;
  setSourceType: (type: GitHubSourceType) => void;
  branches: GitHubBranchInfo[];
  tags: GitHubTagInfo[];
  releases: GitHubReleaseInfo[];
  loading: boolean;
  error: string | null;
  validateAndFetch: () => Promise<void>;
  downloadAsset: (asset: GitHubAssetInfo, destination: string) => Promise<string>;
  downloadSource: (refName: string, format: GitHubArchiveFormat, destination: string) => Promise<string>;
  reset: () => void;
}

export function useGitHubDownloads(): UseGitHubDownloadsReturn {
  const [repoInput, setRepoInput] = useState('');
  const [parsedRepo, setParsedRepo] = useState<GitHubParsedRepo | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [sourceType, setSourceType] = useState<GitHubSourceType>('release');
  const [branches, setBranches] = useState<GitHubBranchInfo[]>([]);
  const [tags, setTags] = useState<GitHubTagInfo[]>([]);
  const [releases, setReleases] = useState<GitHubReleaseInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setRepoInput('');
    setParsedRepo(null);
    setIsValid(null);
    setSourceType('release');
    setBranches([]);
    setTags([]);
    setReleases([]);
    setError(null);
  }, []);

  const validateAndFetch = useCallback(async () => {
    if (!isTauri() || !repoInput.trim()) {
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const tauri = await import('@/lib/tauri');
      
      const parsed = await tauri.githubParseUrl(repoInput.trim());
      if (!parsed) {
        setIsValid(false);
        setParsedRepo(null);
        setError('Invalid repository format. Use owner/repo or GitHub URL.');
        setIsValidating(false);
        return;
      }

      setParsedRepo(parsed);

      const valid = await tauri.githubValidateRepo(parsed.fullName);
      setIsValid(valid);

      if (!valid) {
        setError('Repository not found or inaccessible.');
        setIsValidating(false);
        return;
      }

      setLoading(true);

      const [releasesData, branchesData, tagsData] = await Promise.all([
        tauri.githubListReleases(parsed.fullName).catch(() => []),
        tauri.githubListBranches(parsed.fullName).catch(() => []),
        tauri.githubListTags(parsed.fullName).catch(() => []),
      ]);

      setReleases(releasesData);
      setBranches(branchesData);
      setTags(tagsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsValid(false);
    } finally {
      setIsValidating(false);
      setLoading(false);
    }
  }, [repoInput]);

  const downloadAsset = useCallback(
    async (asset: GitHubAssetInfo, destination: string): Promise<string> => {
      if (!isTauri() || !parsedRepo) {
        throw new Error('Not available');
      }

      const tauri = await import('@/lib/tauri');
      return tauri.githubDownloadAsset(
        parsedRepo.fullName,
        asset.downloadUrl,
        asset.name,
        destination
      );
    },
    [parsedRepo]
  );

  const downloadSource = useCallback(
    async (refName: string, format: GitHubArchiveFormat, destination: string): Promise<string> => {
      if (!isTauri() || !parsedRepo) {
        throw new Error('Not available');
      }

      const tauri = await import('@/lib/tauri');
      return tauri.githubDownloadSource(parsedRepo.fullName, refName, format, destination);
    },
    [parsedRepo]
  );

  useEffect(() => {
    if (!repoInput.trim()) {
      setParsedRepo(null);
      setIsValid(null);
      setBranches([]);
      setTags([]);
      setReleases([]);
    }
  }, [repoInput]);

  return {
    repoInput,
    setRepoInput,
    parsedRepo,
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
