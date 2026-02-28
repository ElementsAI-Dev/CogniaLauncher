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
  token: string;
  setToken: (value: string) => void;
  instanceUrl: string;
  setInstanceUrl: (value: string) => void;
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
  saveToken: () => Promise<void>;
  saveInstanceUrl: () => Promise<void>;
  clearSavedToken: () => Promise<void>;
  reset: () => void;
}

export function useGitLabDownloads(): UseGitLabDownloadsReturn {
  const [projectInput, setProjectInput] = useState('');
  const [token, setToken] = useState('');
  const [instanceUrl, setInstanceUrl] = useState('');
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
    setToken('');
    setInstanceUrl('');
    setParsedProject(null);
    setProjectInfo(null);
    setIsValid(null);
    setSourceType('release');
    setBranches([]);
    setTags([]);
    setReleases([]);
    setError(null);
  }, []);

  // Load saved token and instance URL on mount
  useEffect(() => {
    if (!isTauri()) return;
    import('@/lib/tauri').then(async (t) => {
      const [savedToken, savedUrl] = await Promise.all([
        t.gitlabGetToken().catch(() => null),
        t.gitlabGetInstanceUrl().catch(() => null),
      ]);
      if (savedToken) setToken(savedToken);
      if (savedUrl) setInstanceUrl(savedUrl);
    }).catch(() => {});
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

      const authToken = token.trim() || undefined;
      const instUrl = instanceUrl.trim() || undefined;
      const valid = await tauri.gitlabValidateProject(parsed.fullName, authToken, instUrl);
      setIsValid(valid);

      if (!valid) {
        setError('Project not found or inaccessible.');
        setIsValidating(false);
        return;
      }

      setLoading(true);

      const [releasesData, branchesData, tagsData, info] = await Promise.all([
        tauri.gitlabListReleases(parsed.fullName, authToken, instUrl).catch(() => []),
        tauri.gitlabListBranches(parsed.fullName, authToken, instUrl).catch(() => []),
        tauri.gitlabListTags(parsed.fullName, authToken, instUrl).catch(() => []),
        tauri.gitlabGetProjectInfo(parsed.fullName, authToken, instUrl).catch(() => null),
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
  }, [projectInput, token, instanceUrl]);

  const downloadAsset = useCallback(
    async (asset: GitLabAssetInfo, destination: string): Promise<string> => {
      if (!isTauri() || !parsedProject) {
        throw new Error('Not available');
      }

      const tauri = await import('@/lib/tauri');
      const url = asset.directAssetUrl || asset.url;
      const authToken = token.trim() || undefined;
      const instUrl = instanceUrl.trim() || undefined;
      return tauri.gitlabDownloadAsset(
        parsedProject.fullName,
        url,
        asset.name,
        destination,
        authToken,
        instUrl
      );
    },
    [parsedProject, token, instanceUrl]
  );

  const downloadSource = useCallback(
    async (refName: string, format: GitLabArchiveFormat, destination: string): Promise<string> => {
      if (!isTauri() || !parsedProject) {
        throw new Error('Not available');
      }

      const tauri = await import('@/lib/tauri');
      const authToken = token.trim() || undefined;
      const instUrl = instanceUrl.trim() || undefined;
      return tauri.gitlabDownloadSource(
        parsedProject.fullName, refName, format, destination, authToken, instUrl
      );
    },
    [parsedProject, token, instanceUrl]
  );

  const saveToken = useCallback(async () => {
    if (!isTauri() || !token.trim()) return;
    const tauri = await import('@/lib/tauri');
    await tauri.gitlabSetToken(token.trim());
  }, [token]);

  const saveInstanceUrl = useCallback(async () => {
    if (!isTauri()) return;
    const tauri = await import('@/lib/tauri');
    await tauri.gitlabSetInstanceUrl(instanceUrl.trim());
  }, [instanceUrl]);

  const clearSavedToken = useCallback(async () => {
    if (!isTauri()) return;
    const tauri = await import('@/lib/tauri');
    await tauri.gitlabClearToken();
    setToken('');
  }, []);

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
    token,
    setToken,
    instanceUrl,
    setInstanceUrl,
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
    saveToken,
    saveInstanceUrl,
    clearSavedToken,
    reset,
  };
}
