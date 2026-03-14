import { renderHook, act, waitFor } from '@testing-library/react';
import { useGitLabDownloads } from './use-gitlab-downloads';

const mockGitlabParseUrl = jest.fn();
const mockGitlabValidateProject = jest.fn();
const mockGitlabListReleases = jest.fn();
const mockGitlabListBranches = jest.fn();
const mockGitlabListTags = jest.fn();
const mockGitlabGetProjectInfo = jest.fn();
const mockGitlabListPipelines = jest.fn();
const mockGitlabListPipelineJobs = jest.fn();
const mockGitlabListPackages = jest.fn();
const mockGitlabListPackageFiles = jest.fn();
const mockGitlabDownloadAsset = jest.fn();
const mockGitlabDownloadSource = jest.fn();
const mockGitlabDownloadJobArtifacts = jest.fn();
const mockGitlabDownloadPackageFile = jest.fn();
const mockGitlabGetToken = jest.fn();
const mockGitlabSetToken = jest.fn();
const mockGitlabClearToken = jest.fn();
const mockGitlabGetInstanceUrl = jest.fn();
const mockGitlabSetInstanceUrl = jest.fn();
const mockSecretVaultStatus = jest.fn();
const mockSecretVaultSetup = jest.fn();
const mockSecretVaultUnlock = jest.fn();
const mockSecretVaultLock = jest.fn();
const mockIsTauri = jest.fn(() => true);

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  gitlabParseUrl: (...args: unknown[]) => mockGitlabParseUrl(...args),
  gitlabValidateProject: (...args: unknown[]) => mockGitlabValidateProject(...args),
  gitlabListReleases: (...args: unknown[]) => mockGitlabListReleases(...args),
  gitlabListBranches: (...args: unknown[]) => mockGitlabListBranches(...args),
  gitlabListTags: (...args: unknown[]) => mockGitlabListTags(...args),
  gitlabGetProjectInfo: (...args: unknown[]) => mockGitlabGetProjectInfo(...args),
  gitlabListPipelines: (...args: unknown[]) => mockGitlabListPipelines(...args),
  gitlabListPipelineJobs: (...args: unknown[]) => mockGitlabListPipelineJobs(...args),
  gitlabListPackages: (...args: unknown[]) => mockGitlabListPackages(...args),
  gitlabListPackageFiles: (...args: unknown[]) => mockGitlabListPackageFiles(...args),
  gitlabDownloadAsset: (...args: unknown[]) => mockGitlabDownloadAsset(...args),
  gitlabDownloadSource: (...args: unknown[]) => mockGitlabDownloadSource(...args),
  gitlabDownloadJobArtifacts: (...args: unknown[]) => mockGitlabDownloadJobArtifacts(...args),
  gitlabDownloadPackageFile: (...args: unknown[]) => mockGitlabDownloadPackageFile(...args),
  gitlabGetToken: (...args: unknown[]) => mockGitlabGetToken(...args),
  gitlabSetToken: (...args: unknown[]) => mockGitlabSetToken(...args),
  gitlabClearToken: (...args: unknown[]) => mockGitlabClearToken(...args),
  gitlabGetInstanceUrl: (...args: unknown[]) => mockGitlabGetInstanceUrl(...args),
  gitlabSetInstanceUrl: (...args: unknown[]) => mockGitlabSetInstanceUrl(...args),
  secretVaultStatus: (...args: unknown[]) => mockSecretVaultStatus(...args),
  secretVaultSetup: (...args: unknown[]) => mockSecretVaultSetup(...args),
  secretVaultUnlock: (...args: unknown[]) => mockSecretVaultUnlock(...args),
  secretVaultLock: (...args: unknown[]) => mockSecretVaultLock(...args),
}));

const unsecuredStatus = {
  initialized: false,
  unlocked: false,
  migrationPending: false,
};

const emptyTokenStatus = {
  provider: 'gitlab',
  configured: false,
  configuredInVault: false,
  configuredInEnv: false,
  needsUnlock: false,
  legacyPlaintextPresent: false,
};

describe('useGitLabDownloads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockGitlabGetToken.mockResolvedValue(emptyTokenStatus);
    mockGitlabGetInstanceUrl.mockResolvedValue(null);
    mockSecretVaultStatus.mockResolvedValue(unsecuredStatus);
    mockGitlabListPipelines.mockResolvedValue([]);
    mockGitlabListPipelineJobs.mockResolvedValue([]);
    mockGitlabListPackages.mockResolvedValue([]);
    mockGitlabListPackageFiles.mockResolvedValue([]);
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useGitLabDownloads());

    expect(result.current.projectInput).toBe('');
    expect(result.current.token).toBe('');
    expect(result.current.instanceUrl).toBe('');
    expect(result.current.parsedProject).toBeNull();
    expect(result.current.projectInfo).toBeNull();
    expect(result.current.isValidating).toBe(false);
    expect(result.current.isValid).toBeNull();
    expect(result.current.sourceType).toBe('release');
    expect(result.current.branches).toEqual([]);
    expect(result.current.tags).toEqual([]);
    expect(result.current.releases).toEqual([]);
    expect(result.current.pipelines).toEqual([]);
    expect(result.current.jobs).toEqual([]);
    expect(result.current.packages).toEqual([]);
    expect(result.current.packageFiles).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.tokenStatus).toBeNull();
    expect(result.current.vaultStatus).toBeNull();
  });

  it('should load saved token status on mount without repopulating the token input', async () => {
    mockGitlabGetToken.mockResolvedValue({
      ...emptyTokenStatus,
      configured: true,
      configuredInVault: true,
      needsUnlock: true,
    });
    mockSecretVaultStatus.mockResolvedValue({
      initialized: true,
      unlocked: false,
      migrationPending: false,
    });

    const { result } = renderHook(() => useGitLabDownloads());

    await waitFor(() => {
      expect(result.current.tokenStatus?.configured).toBe(true);
      expect(result.current.vaultStatus?.initialized).toBe(true);
    });
    expect(result.current.token).toBe('');
  });

  it('should handle token load failure', async () => {
    mockGitlabGetToken.mockRejectedValue(new Error('No token'));

    const { result } = renderHook(() => useGitLabDownloads());

    await waitFor(() => {
      expect(result.current.token).toBe('');
    });
    expect(result.current.tokenStatus).toBeNull();
  });

  it('should not load token when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);

    renderHook(() => useGitLabDownloads());

    await waitFor(() => {
      expect(mockGitlabGetToken).not.toHaveBeenCalled();
    });
  });

  it('should update projectInput, token, instanceUrl, sourceType', () => {
    const { result } = renderHook(() => useGitLabDownloads());

    act(() => {
      result.current.setProjectInput('group/project');
      result.current.setToken('token');
      result.current.setInstanceUrl('https://gitlab.example.com');
      result.current.setSourceType('branch');
    });

    expect(result.current.projectInput).toBe('group/project');
    expect(result.current.token).toBe('token');
    expect(result.current.instanceUrl).toBe('https://gitlab.example.com');
    expect(result.current.sourceType).toBe('branch');
  });

  it('should validate and fetch project data', async () => {
    const parsed = { fullName: 'group/project' };
    const releases = [{ tag_name: 'v1.0' }];
    const branches = [{ name: 'main' }];
    const tags = [{ name: 'v1.0' }];
    const pipelines = [{ id: 1, status: 'success' }];
    const packages = [{ id: 2, name: 'pkg', version: '1.0.0', packageType: 'generic', createdAt: null }];
    const projectInfo = { name: 'project', stars: 100 };

    mockGitlabParseUrl.mockResolvedValue(parsed);
    mockGitlabValidateProject.mockResolvedValue(true);
    mockGitlabListReleases.mockResolvedValue(releases);
    mockGitlabListBranches.mockResolvedValue(branches);
    mockGitlabListTags.mockResolvedValue(tags);
    mockGitlabListPipelines.mockResolvedValue(pipelines);
    mockGitlabListPackages.mockResolvedValue(packages);
    mockGitlabGetProjectInfo.mockResolvedValue(projectInfo);

    const { result } = renderHook(() => useGitLabDownloads());

    act(() => {
      result.current.setProjectInput('group/project');
    });

    await act(async () => {
      await result.current.validateAndFetch();
    });

    expect(result.current.parsedProject).toEqual(parsed);
    expect(result.current.isValid).toBe(true);
    expect(result.current.releases).toEqual(releases);
    expect(result.current.branches).toEqual(branches);
    expect(result.current.tags).toEqual(tags);
    expect(result.current.pipelines).toEqual(pipelines);
    expect(result.current.packages).toEqual(packages);
    expect(result.current.projectInfo).toEqual(projectInfo);
  });

  it('should pass instanceUrl to validation and fetch', async () => {
    mockGitlabParseUrl.mockResolvedValue({ fullName: 'g/p' });
    mockGitlabValidateProject.mockResolvedValue(true);
    mockGitlabListReleases.mockResolvedValue([]);
    mockGitlabListBranches.mockResolvedValue([]);
    mockGitlabListTags.mockResolvedValue([]);
    mockGitlabGetProjectInfo.mockResolvedValue(null);

    const { result } = renderHook(() => useGitLabDownloads());

    act(() => {
      result.current.setProjectInput('g/p');
      result.current.setToken('tok');
      result.current.setInstanceUrl('https://gl.example.com');
    });

    await act(async () => {
      await result.current.validateAndFetch();
    });

    expect(mockGitlabValidateProject).toHaveBeenCalledWith('g/p', 'tok', 'https://gl.example.com');
  });

  it('should handle invalid project URL', async () => {
    mockGitlabParseUrl.mockResolvedValue(null);

    const { result } = renderHook(() => useGitLabDownloads());

    act(() => {
      result.current.setProjectInput('invalid');
    });

    await act(async () => {
      await result.current.validateAndFetch();
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.error).toContain('Invalid');
  });

  it('should handle inaccessible project', async () => {
    mockGitlabParseUrl.mockResolvedValue({ fullName: 'a/b' });
    mockGitlabValidateProject.mockResolvedValue(false);

    const { result } = renderHook(() => useGitLabDownloads());

    act(() => {
      result.current.setProjectInput('a/b');
    });

    await act(async () => {
      await result.current.validateAndFetch();
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.error).toContain('not found');
  });

  it('should not validate empty input', async () => {
    const { result } = renderHook(() => useGitLabDownloads());

    await act(async () => {
      await result.current.validateAndFetch();
    });

    expect(mockGitlabParseUrl).not.toHaveBeenCalled();
  });

  it('should handle validateAndFetch error', async () => {
    mockGitlabParseUrl.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useGitLabDownloads());

    act(() => {
      result.current.setProjectInput('a/b');
    });

    await act(async () => {
      await result.current.validateAndFetch();
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.isValid).toBe(false);
  });

  it('should download asset', async () => {
    mockGitlabParseUrl.mockResolvedValue({ fullName: 'a/b' });
    mockGitlabValidateProject.mockResolvedValue(true);
    mockGitlabListReleases.mockResolvedValue([]);
    mockGitlabListBranches.mockResolvedValue([]);
    mockGitlabListTags.mockResolvedValue([]);
    mockGitlabGetProjectInfo.mockResolvedValue(null);
    mockGitlabDownloadAsset.mockResolvedValue('/downloads/file.zip');

    const { result } = renderHook(() => useGitLabDownloads());

    act(() => {
      result.current.setProjectInput('a/b');
    });

    await act(async () => {
      await result.current.validateAndFetch();
    });

    const asset = { name: 'file.zip', url: 'https://example.com/file.zip', directAssetUrl: '' };
    let path;
    await act(async () => {
      path = await result.current.downloadAsset(asset as never, '/downloads');
    });

    expect(path).toBe('/downloads/file.zip');
  });

  it('should prefer directAssetUrl over url', async () => {
    mockGitlabParseUrl.mockResolvedValue({ fullName: 'a/b' });
    mockGitlabValidateProject.mockResolvedValue(true);
    mockGitlabListReleases.mockResolvedValue([]);
    mockGitlabListBranches.mockResolvedValue([]);
    mockGitlabListTags.mockResolvedValue([]);
    mockGitlabGetProjectInfo.mockResolvedValue(null);
    mockGitlabDownloadAsset.mockResolvedValue('/downloads/file.zip');

    const { result } = renderHook(() => useGitLabDownloads());

    act(() => {
      result.current.setProjectInput('a/b');
    });

    await act(async () => {
      await result.current.validateAndFetch();
    });

    const asset = { name: 'file.zip', url: 'https://fallback.com', directAssetUrl: 'https://direct.com' };
    await act(async () => {
      await result.current.downloadAsset(asset as never, '/downloads');
    });

    expect(mockGitlabDownloadAsset).toHaveBeenCalledWith(
      'a/b', 'https://direct.com', 'file.zip', '/downloads', undefined, undefined,
    );
  });

  it('should throw when downloadAsset without parsedProject', async () => {
    const { result } = renderHook(() => useGitLabDownloads());

    await expect(
      act(async () => {
        await result.current.downloadAsset({} as never, '/downloads');
      }),
    ).rejects.toThrow('Not available');
  });

  it('should download source', async () => {
    mockGitlabParseUrl.mockResolvedValue({ fullName: 'a/b' });
    mockGitlabValidateProject.mockResolvedValue(true);
    mockGitlabListReleases.mockResolvedValue([]);
    mockGitlabListBranches.mockResolvedValue([]);
    mockGitlabListTags.mockResolvedValue([]);
    mockGitlabGetProjectInfo.mockResolvedValue(null);
    mockGitlabDownloadSource.mockResolvedValue('/downloads/source.tar.gz');

    const { result } = renderHook(() => useGitLabDownloads());

    act(() => {
      result.current.setProjectInput('a/b');
    });

    await act(async () => {
      await result.current.validateAndFetch();
    });

    let path;
    await act(async () => {
      path = await result.current.downloadSource('main', 'tar.gz' as never, '/downloads');
    });

    expect(path).toBe('/downloads/source.tar.gz');
  });

  it('should save token', async () => {
    mockGitlabSetToken.mockResolvedValue({
      ...emptyTokenStatus,
      configured: true,
      configuredInVault: true,
    });

    const { result } = renderHook(() => useGitLabDownloads());

    act(() => {
      result.current.setToken('glpat-test');
    });

    await act(async () => {
      await result.current.saveToken();
    });

    expect(mockGitlabSetToken).toHaveBeenCalledWith('glpat-test');
    expect(result.current.token).toBe('');
  });

  it('should not save empty token', async () => {
    const { result } = renderHook(() => useGitLabDownloads());

    await act(async () => {
      await result.current.saveToken();
    });

    expect(mockGitlabSetToken).not.toHaveBeenCalled();
  });

  it('should clear saved token', async () => {
    mockGitlabClearToken.mockResolvedValue(emptyTokenStatus);

    const { result } = renderHook(() => useGitLabDownloads());

    act(() => {
      result.current.setToken('glpat-test');
    });

    await act(async () => {
      await result.current.clearSavedToken();
    });

    expect(mockGitlabClearToken).toHaveBeenCalled();
    expect(result.current.token).toBe('');
  });

  it('should reset all state', () => {
    const { result } = renderHook(() => useGitLabDownloads());

    act(() => {
      result.current.setProjectInput('group/project');
      result.current.setToken('tok');
      result.current.setInstanceUrl('https://gl.com');
      result.current.setSourceType('tag');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.projectInput).toBe('');
    expect(result.current.token).toBe('');
    expect(result.current.instanceUrl).toBe('');
    expect(result.current.sourceType).toBe('release');
    expect(result.current.parsedProject).toBeNull();
    expect(result.current.pipelines).toEqual([]);
    expect(result.current.jobs).toEqual([]);
    expect(result.current.packages).toEqual([]);
    expect(result.current.packageFiles).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should load saved instance URL on mount', async () => {
    mockGitlabGetToken.mockResolvedValue(null);
    mockGitlabGetInstanceUrl.mockResolvedValue('https://gitlab.example.com');

    const { result } = renderHook(() => useGitLabDownloads());

    await waitFor(() => {
      expect(result.current.instanceUrl).toBe('https://gitlab.example.com');
    });
  });

  it('should load both saved token and instance URL on mount', async () => {
    mockGitlabGetToken.mockResolvedValue({
      ...emptyTokenStatus,
      configured: true,
      configuredInVault: true,
    });
    mockGitlabGetInstanceUrl.mockResolvedValue('https://gl.corp.com');

    const { result } = renderHook(() => useGitLabDownloads());

    await waitFor(() => {
      expect(result.current.tokenStatus?.configured).toBe(true);
      expect(result.current.instanceUrl).toBe('https://gl.corp.com');
    });
    expect(result.current.token).toBe('');
  });

  it('should set up secure storage when a password is provided', async () => {
    mockSecretVaultSetup.mockResolvedValue({
      initialized: true,
      unlocked: true,
      migrationPending: false,
    });

    const { result } = renderHook(() => useGitLabDownloads());

    act(() => {
      result.current.setVaultPassword('vault-pass');
    });

    await act(async () => {
      await result.current.setupVault();
    });

    expect(mockSecretVaultSetup).toHaveBeenCalledWith('vault-pass');
    expect(result.current.vaultPassword).toBe('');
  });

  it('should unlock secure storage when a password is provided', async () => {
    mockSecretVaultUnlock.mockResolvedValue({
      initialized: true,
      unlocked: true,
      migrationPending: false,
    });

    const { result } = renderHook(() => useGitLabDownloads());

    act(() => {
      result.current.setVaultPassword('vault-pass');
    });

    await act(async () => {
      await result.current.unlockVault();
    });

    expect(mockSecretVaultUnlock).toHaveBeenCalledWith('vault-pass');
    expect(result.current.vaultPassword).toBe('');
  });

  it('should save instance URL', async () => {
    mockGitlabSetInstanceUrl.mockResolvedValue(undefined);

    const { result } = renderHook(() => useGitLabDownloads());

    act(() => {
      result.current.setInstanceUrl('https://gitlab.example.com');
    });

    await act(async () => {
      await result.current.saveInstanceUrl();
    });

    expect(mockGitlabSetInstanceUrl).toHaveBeenCalledWith('https://gitlab.example.com');
  });

  it('should not load instance URL when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);

    renderHook(() => useGitLabDownloads());

    await waitFor(() => {
      expect(mockGitlabGetInstanceUrl).not.toHaveBeenCalled();
    });
  });

  it('should clear data when projectInput is emptied', async () => {
    mockGitlabParseUrl.mockResolvedValue({ fullName: 'a/b' });
    mockGitlabValidateProject.mockResolvedValue(true);
    mockGitlabListReleases.mockResolvedValue([{ id: 1 }]);
    mockGitlabListBranches.mockResolvedValue([{ name: 'main' }]);
    mockGitlabListTags.mockResolvedValue([{ name: 'v1' }]);
    mockGitlabListPipelines.mockResolvedValue([{ id: 10 }]);
    mockGitlabListPackages.mockResolvedValue([{ id: 20 }]);
    mockGitlabGetProjectInfo.mockResolvedValue({ name: 'repo' });

    const { result } = renderHook(() => useGitLabDownloads());

    act(() => {
      result.current.setProjectInput('a/b');
    });

    await act(async () => {
      await result.current.validateAndFetch();
    });

    expect(result.current.releases.length).toBe(1);
    expect(result.current.pipelines.length).toBe(1);
    expect(result.current.packages.length).toBe(1);

    act(() => {
      result.current.setProjectInput('');
    });

    await waitFor(() => {
      expect(result.current.parsedProject).toBeNull();
      expect(result.current.releases).toEqual([]);
      expect(result.current.pipelines).toEqual([]);
      expect(result.current.jobs).toEqual([]);
      expect(result.current.packages).toEqual([]);
      expect(result.current.packageFiles).toEqual([]);
    });
  });

  it('fetchPipelines should load pipeline list for parsed project', async () => {
    mockGitlabParseUrl.mockResolvedValue({ fullName: 'a/b' });
    mockGitlabValidateProject.mockResolvedValue(true);
    mockGitlabListReleases.mockResolvedValue([]);
    mockGitlabListBranches.mockResolvedValue([]);
    mockGitlabListTags.mockResolvedValue([]);
    mockGitlabGetProjectInfo.mockResolvedValue(null);
    mockGitlabListPipelines.mockResolvedValue([{ id: 99, status: 'success' }]);

    const { result } = renderHook(() => useGitLabDownloads());

    act(() => {
      result.current.setProjectInput('a/b');
    });

    await act(async () => {
      await result.current.validateAndFetch();
    });

    await act(async () => {
      await result.current.fetchPipelines('main', 'success');
    });

    expect(mockGitlabListPipelines).toHaveBeenCalledWith(
      'a/b',
      'main',
      'success',
      undefined,
      undefined,
    );
    expect(result.current.pipelines).toEqual([{ id: 99, status: 'success' }]);
  });

  it('fetchPipelineJobs should load jobs for a pipeline', async () => {
    mockGitlabParseUrl.mockResolvedValue({ fullName: 'a/b' });
    mockGitlabValidateProject.mockResolvedValue(true);
    mockGitlabListReleases.mockResolvedValue([]);
    mockGitlabListBranches.mockResolvedValue([]);
    mockGitlabListTags.mockResolvedValue([]);
    mockGitlabGetProjectInfo.mockResolvedValue(null);
    mockGitlabListPipelineJobs.mockResolvedValue([{ id: 7, name: 'build', hasArtifacts: true }]);

    const { result } = renderHook(() => useGitLabDownloads());

    act(() => {
      result.current.setProjectInput('a/b');
    });

    await act(async () => {
      await result.current.validateAndFetch();
    });

    await act(async () => {
      await result.current.fetchPipelineJobs(123);
    });

    expect(mockGitlabListPipelineJobs).toHaveBeenCalledWith('a/b', 123, undefined, undefined);
    expect(result.current.jobs).toEqual([{ id: 7, name: 'build', hasArtifacts: true }]);
  });

  it('fetchPackages should load package list for parsed project', async () => {
    mockGitlabParseUrl.mockResolvedValue({ fullName: 'a/b' });
    mockGitlabValidateProject.mockResolvedValue(true);
    mockGitlabListReleases.mockResolvedValue([]);
    mockGitlabListBranches.mockResolvedValue([]);
    mockGitlabListTags.mockResolvedValue([]);
    mockGitlabGetProjectInfo.mockResolvedValue(null);
    mockGitlabListPackages.mockResolvedValue([
      { id: 11, name: 'pkg', version: '1.0.0', packageType: 'generic', createdAt: null },
    ]);

    const { result } = renderHook(() => useGitLabDownloads());

    act(() => {
      result.current.setProjectInput('a/b');
    });

    await act(async () => {
      await result.current.validateAndFetch();
    });

    await act(async () => {
      await result.current.fetchPackages('generic');
    });

    expect(mockGitlabListPackages).toHaveBeenCalledWith(
      'a/b',
      'generic',
      undefined,
      undefined
    );
    expect(result.current.packages).toEqual([
      { id: 11, name: 'pkg', version: '1.0.0', packageType: 'generic', createdAt: null },
    ]);
  });

  it('fetchPackageFiles should load files for selected package', async () => {
    mockGitlabParseUrl.mockResolvedValue({ fullName: 'a/b' });
    mockGitlabValidateProject.mockResolvedValue(true);
    mockGitlabListReleases.mockResolvedValue([]);
    mockGitlabListBranches.mockResolvedValue([]);
    mockGitlabListTags.mockResolvedValue([]);
    mockGitlabGetProjectInfo.mockResolvedValue(null);
    mockGitlabListPackageFiles.mockResolvedValue([
      { id: 31, fileName: 'artifact.zip', size: 2048, fileSha256: null, createdAt: null },
    ]);

    const { result } = renderHook(() => useGitLabDownloads());

    act(() => {
      result.current.setProjectInput('a/b');
    });

    await act(async () => {
      await result.current.validateAndFetch();
    });

    await act(async () => {
      await result.current.fetchPackageFiles(11);
    });

    expect(mockGitlabListPackageFiles).toHaveBeenCalledWith('a/b', 11, undefined, undefined);
    expect(result.current.packageFiles).toEqual([
      { id: 31, fileName: 'artifact.zip', size: 2048, fileSha256: null, createdAt: null },
    ]);
  });

  it('downloadJobArtifacts should enqueue artifacts download', async () => {
    mockGitlabParseUrl.mockResolvedValue({ fullName: 'a/b' });
    mockGitlabValidateProject.mockResolvedValue(true);
    mockGitlabListReleases.mockResolvedValue([]);
    mockGitlabListBranches.mockResolvedValue([]);
    mockGitlabListTags.mockResolvedValue([]);
    mockGitlabGetProjectInfo.mockResolvedValue(null);
    mockGitlabDownloadJobArtifacts.mockResolvedValue('/downloads/build-artifacts-7.zip');

    const { result } = renderHook(() => useGitLabDownloads());

    act(() => {
      result.current.setProjectInput('a/b');
    });

    await act(async () => {
      await result.current.validateAndFetch();
    });

    let output = '';
    await act(async () => {
      output = await result.current.downloadJobArtifacts(
        { id: 7, name: 'build' } as never,
        '/downloads'
      );
    });

    expect(mockGitlabDownloadJobArtifacts).toHaveBeenCalledWith(
      'a/b',
      7,
      'build',
      '/downloads',
      undefined,
      undefined
    );
    expect(output).toBe('/downloads/build-artifacts-7.zip');
  });

  it('downloadPackageFile should enqueue package file download', async () => {
    mockGitlabParseUrl.mockResolvedValue({ fullName: 'a/b' });
    mockGitlabValidateProject.mockResolvedValue(true);
    mockGitlabListReleases.mockResolvedValue([]);
    mockGitlabListBranches.mockResolvedValue([]);
    mockGitlabListTags.mockResolvedValue([]);
    mockGitlabGetProjectInfo.mockResolvedValue(null);
    mockGitlabDownloadPackageFile.mockResolvedValue('/downloads/pkg-file.zip');

    const { result } = renderHook(() => useGitLabDownloads());

    act(() => {
      result.current.setProjectInput('a/b');
    });

    await act(async () => {
      await result.current.validateAndFetch();
    });

    let output = '';
    await act(async () => {
      output = await result.current.downloadPackageFile(11, 'pkg-file.zip', '/downloads');
    });

    expect(mockGitlabDownloadPackageFile).toHaveBeenCalledWith(
      'a/b',
      11,
      'pkg-file.zip',
      '/downloads',
      undefined,
      undefined
    );
    expect(output).toBe('/downloads/pkg-file.zip');
  });
});
