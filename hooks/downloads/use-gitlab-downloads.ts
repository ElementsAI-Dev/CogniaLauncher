import { useState, useCallback, useEffect } from 'react';
import { isTauri } from '@/lib/tauri';
import type { ProviderSecretStatus, SecretVaultStatus } from '@/lib/tauri';
import type {
  GitLabBranchInfo,
  GitLabTagInfo,
  GitLabReleaseInfo,
  GitLabAssetInfo,
  GitLabParsedProject,
  GitLabProjectInfo,
  GitLabSourceType,
  GitLabArchiveFormat,
  GitLabPipelineInfo,
  GitLabJobInfo,
  GitLabPackageInfo,
  GitLabPackageFileInfo,
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
  pipelines: GitLabPipelineInfo[];
  jobs: GitLabJobInfo[];
  packages: GitLabPackageInfo[];
  packageFiles: GitLabPackageFileInfo[];
  loading: boolean;
  error: string | null;
  tokenStatus: ProviderSecretStatus | null;
  vaultStatus: SecretVaultStatus | null;
  vaultPassword: string;
  setVaultPassword: (value: string) => void;
  setupVault: () => Promise<void>;
  unlockVault: () => Promise<void>;
  lockVault: () => Promise<void>;
  validateAndFetch: () => Promise<void>;
  fetchPipelines: (refName?: string, status?: string) => Promise<GitLabPipelineInfo[]>;
  fetchPipelineJobs: (pipelineId: number) => Promise<GitLabJobInfo[]>;
  fetchPackages: (packageType?: string) => Promise<GitLabPackageInfo[]>;
  fetchPackageFiles: (packageId: number) => Promise<GitLabPackageFileInfo[]>;
  downloadAsset: (asset: GitLabAssetInfo, destination: string) => Promise<string>;
  downloadSource: (refName: string, format: GitLabArchiveFormat, destination: string) => Promise<string>;
  downloadJobArtifacts: (job: GitLabJobInfo, destination: string) => Promise<string>;
  downloadPackageFile: (packageId: number, fileName: string, destination: string) => Promise<string>;
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
  const [pipelines, setPipelines] = useState<GitLabPipelineInfo[]>([]);
  const [jobs, setJobs] = useState<GitLabJobInfo[]>([]);
  const [packages, setPackages] = useState<GitLabPackageInfo[]>([]);
  const [packageFiles, setPackageFiles] = useState<GitLabPackageFileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenStatus, setTokenStatus] = useState<ProviderSecretStatus | null>(null);
  const [vaultStatus, setVaultStatus] = useState<SecretVaultStatus | null>(null);
  const [vaultPassword, setVaultPassword] = useState('');

  const reset = useCallback(() => {
    setProjectInput('');
    setToken('');
    setInstanceUrl('');
    setVaultPassword('');
    setParsedProject(null);
    setProjectInfo(null);
    setIsValid(null);
    setSourceType('release');
    setBranches([]);
    setTags([]);
    setReleases([]);
    setPipelines([]);
    setJobs([]);
    setPackages([]);
    setPackageFiles([]);
    setError(null);
  }, []);

  const refreshSecurityState = useCallback(async () => {
    if (!isTauri()) {
      setTokenStatus(null);
      setVaultStatus(null);
      return;
    }

    const tauri = await import('@/lib/tauri');
    const [savedStatus, savedUrl, nextVaultStatus] = await Promise.all([
      tauri.gitlabGetToken().catch(() => null),
      tauri.gitlabGetInstanceUrl().catch(() => null),
      tauri.secretVaultStatus().catch(() => null),
    ]);

    setTokenStatus(savedStatus);
    if (savedUrl) {
      setInstanceUrl(savedUrl);
    }
    setVaultStatus(nextVaultStatus);
  }, []);

  // Load secure token status and instance URL on mount
  useEffect(() => {
    if (!isTauri()) return;
    refreshSecurityState().catch(() => {});
  }, [refreshSecurityState]);

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

      const [releasesData, branchesData, tagsData, pipelinesData, packagesData, info] = await Promise.all([
        tauri.gitlabListReleases(parsed.fullName, authToken, instUrl).catch(() => []),
        tauri.gitlabListBranches(parsed.fullName, authToken, instUrl).catch(() => []),
        tauri.gitlabListTags(parsed.fullName, authToken, instUrl).catch(() => []),
        tauri.gitlabListPipelines(parsed.fullName, undefined, undefined, authToken, instUrl).catch(() => []),
        tauri.gitlabListPackages(parsed.fullName, undefined, authToken, instUrl).catch(() => []),
        tauri.gitlabGetProjectInfo(parsed.fullName, authToken, instUrl).catch(() => null),
      ]);

      setReleases(releasesData);
      setBranches(branchesData);
      setTags(tagsData);
      setPipelines(pipelinesData);
      setJobs([]);
      setPackages(packagesData);
      setPackageFiles([]);
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

  const fetchPipelines = useCallback(
    async (refName?: string, status?: string): Promise<GitLabPipelineInfo[]> => {
      if (!isTauri() || !parsedProject) {
        return [];
      }

      const tauri = await import('@/lib/tauri');
      const authToken = token.trim() || undefined;
      const instUrl = instanceUrl.trim() || undefined;
      const result = await tauri.gitlabListPipelines(
        parsedProject.fullName,
        refName,
        status,
        authToken,
        instUrl
      );
      setPipelines(result);
      return result;
    },
    [parsedProject, token, instanceUrl]
  );

  const fetchPipelineJobs = useCallback(
    async (pipelineId: number): Promise<GitLabJobInfo[]> => {
      if (!isTauri() || !parsedProject) {
        return [];
      }

      const tauri = await import('@/lib/tauri');
      const authToken = token.trim() || undefined;
      const instUrl = instanceUrl.trim() || undefined;
      const result = await tauri.gitlabListPipelineJobs(
        parsedProject.fullName,
        pipelineId,
        authToken,
        instUrl
      );
      setJobs(result);
      return result;
    },
    [parsedProject, token, instanceUrl]
  );

  const fetchPackages = useCallback(
    async (packageType?: string): Promise<GitLabPackageInfo[]> => {
      if (!isTauri() || !parsedProject) {
        return [];
      }

      const tauri = await import('@/lib/tauri');
      const authToken = token.trim() || undefined;
      const instUrl = instanceUrl.trim() || undefined;
      const result = await tauri.gitlabListPackages(
        parsedProject.fullName,
        packageType,
        authToken,
        instUrl
      );
      setPackages(result);
      setPackageFiles([]);
      return result;
    },
    [parsedProject, token, instanceUrl]
  );

  const fetchPackageFiles = useCallback(
    async (packageId: number): Promise<GitLabPackageFileInfo[]> => {
      if (!isTauri() || !parsedProject) {
        return [];
      }

      const tauri = await import('@/lib/tauri');
      const authToken = token.trim() || undefined;
      const instUrl = instanceUrl.trim() || undefined;
      const result = await tauri.gitlabListPackageFiles(
        parsedProject.fullName,
        packageId,
        authToken,
        instUrl
      );
      setPackageFiles(result);
      return result;
    },
    [parsedProject, token, instanceUrl]
  );

  const downloadJobArtifacts = useCallback(
    async (job: GitLabJobInfo, destination: string): Promise<string> => {
      if (!isTauri() || !parsedProject) {
        throw new Error('Not available');
      }

      const tauri = await import('@/lib/tauri');
      const authToken = token.trim() || undefined;
      const instUrl = instanceUrl.trim() || undefined;
      return tauri.gitlabDownloadJobArtifacts(
        parsedProject.fullName,
        job.id,
        job.name,
        destination,
        authToken,
        instUrl
      );
    },
    [parsedProject, token, instanceUrl]
  );

  const downloadPackageFile = useCallback(
    async (packageId: number, fileName: string, destination: string): Promise<string> => {
      if (!isTauri() || !parsedProject) {
        throw new Error('Not available');
      }

      const tauri = await import('@/lib/tauri');
      const authToken = token.trim() || undefined;
      const instUrl = instanceUrl.trim() || undefined;
      return tauri.gitlabDownloadPackageFile(
        parsedProject.fullName,
        packageId,
        fileName,
        destination,
        authToken,
        instUrl
      );
    },
    [parsedProject, token, instanceUrl]
  );

  const saveToken = useCallback(async () => {
    if (!isTauri() || !token.trim()) return;
    const tauri = await import('@/lib/tauri');
    await tauri.gitlabSetToken(token.trim());
    setToken('');
    await refreshSecurityState();
  }, [refreshSecurityState, token]);

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
    await refreshSecurityState();
  }, [refreshSecurityState]);

  const setupVault = useCallback(async () => {
    if (!isTauri()) return;
    const password = vaultPassword.trim();
    if (!password) {
      throw new Error('Secure storage password is required.');
    }
    const tauri = await import('@/lib/tauri');
    const nextStatus = await tauri.secretVaultSetup(password);
    setVaultStatus(nextStatus);
    setVaultPassword('');
    await refreshSecurityState();
  }, [refreshSecurityState, vaultPassword]);

  const unlockVault = useCallback(async () => {
    if (!isTauri()) return;
    const password = vaultPassword.trim();
    if (!password) {
      throw new Error('Secure storage password is required.');
    }
    const tauri = await import('@/lib/tauri');
    const nextStatus = await tauri.secretVaultUnlock(password);
    setVaultStatus(nextStatus);
    setVaultPassword('');
    await refreshSecurityState();
  }, [refreshSecurityState, vaultPassword]);

  const lockVault = useCallback(async () => {
    if (!isTauri()) return;
    const tauri = await import('@/lib/tauri');
    const nextStatus = await tauri.secretVaultLock();
    setVaultStatus(nextStatus);
    await refreshSecurityState();
  }, [refreshSecurityState]);

  useEffect(() => {
    if (!projectInput.trim()) {
      setParsedProject(null);
      setProjectInfo(null);
      setIsValid(null);
      setBranches([]);
      setTags([]);
      setReleases([]);
      setPipelines([]);
      setJobs([]);
      setPackages([]);
      setPackageFiles([]);
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
    pipelines,
    jobs,
    packages,
    packageFiles,
    loading,
    error,
    tokenStatus,
    vaultStatus,
    vaultPassword,
    setVaultPassword,
    setupVault,
    unlockVault,
    lockVault,
    validateAndFetch,
    fetchPipelines,
    fetchPipelineJobs,
    fetchPackages,
    fetchPackageFiles,
    downloadAsset,
    downloadSource,
    downloadJobArtifacts,
    downloadPackageFile,
    saveToken,
    saveInstanceUrl,
    clearSavedToken,
    reset,
  };
}
