import { renderHook, act, waitFor } from '@testing-library/react';
import { useGitLabDownloads } from './use-gitlab-downloads';

const mockGitlabParseUrl = jest.fn();
const mockGitlabValidateProject = jest.fn();
const mockGitlabListReleases = jest.fn();
const mockGitlabListBranches = jest.fn();
const mockGitlabListTags = jest.fn();
const mockGitlabGetProjectInfo = jest.fn();
const mockGitlabDownloadAsset = jest.fn();
const mockGitlabDownloadSource = jest.fn();
const mockGitlabGetToken = jest.fn();
const mockGitlabSetToken = jest.fn();
const mockGitlabClearToken = jest.fn();
const mockGitlabGetInstanceUrl = jest.fn();
const mockGitlabSetInstanceUrl = jest.fn();
const mockIsTauri = jest.fn(() => true);

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  gitlabParseUrl: (...args: unknown[]) => mockGitlabParseUrl(...args),
  gitlabValidateProject: (...args: unknown[]) => mockGitlabValidateProject(...args),
  gitlabListReleases: (...args: unknown[]) => mockGitlabListReleases(...args),
  gitlabListBranches: (...args: unknown[]) => mockGitlabListBranches(...args),
  gitlabListTags: (...args: unknown[]) => mockGitlabListTags(...args),
  gitlabGetProjectInfo: (...args: unknown[]) => mockGitlabGetProjectInfo(...args),
  gitlabDownloadAsset: (...args: unknown[]) => mockGitlabDownloadAsset(...args),
  gitlabDownloadSource: (...args: unknown[]) => mockGitlabDownloadSource(...args),
  gitlabGetToken: (...args: unknown[]) => mockGitlabGetToken(...args),
  gitlabSetToken: (...args: unknown[]) => mockGitlabSetToken(...args),
  gitlabClearToken: (...args: unknown[]) => mockGitlabClearToken(...args),
  gitlabGetInstanceUrl: (...args: unknown[]) => mockGitlabGetInstanceUrl(...args),
  gitlabSetInstanceUrl: (...args: unknown[]) => mockGitlabSetInstanceUrl(...args),
}));

describe('useGitLabDownloads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockGitlabGetToken.mockResolvedValue(null);
    mockGitlabGetInstanceUrl.mockResolvedValue(null);
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
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should load saved token on mount', async () => {
    mockGitlabGetToken.mockResolvedValue('glpat-test123');

    const { result } = renderHook(() => useGitLabDownloads());

    await waitFor(() => {
      expect(result.current.token).toBe('glpat-test123');
    });
  });

  it('should handle token load failure', async () => {
    mockGitlabGetToken.mockRejectedValue(new Error('No token'));

    const { result } = renderHook(() => useGitLabDownloads());

    await waitFor(() => {
      expect(result.current.token).toBe('');
    });
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
    const projectInfo = { name: 'project', stars: 100 };

    mockGitlabParseUrl.mockResolvedValue(parsed);
    mockGitlabValidateProject.mockResolvedValue(true);
    mockGitlabListReleases.mockResolvedValue(releases);
    mockGitlabListBranches.mockResolvedValue(branches);
    mockGitlabListTags.mockResolvedValue(tags);
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
    mockGitlabSetToken.mockResolvedValue(undefined);

    const { result } = renderHook(() => useGitLabDownloads());

    act(() => {
      result.current.setToken('glpat-test');
    });

    await act(async () => {
      await result.current.saveToken();
    });

    expect(mockGitlabSetToken).toHaveBeenCalledWith('glpat-test');
  });

  it('should not save empty token', async () => {
    const { result } = renderHook(() => useGitLabDownloads());

    await act(async () => {
      await result.current.saveToken();
    });

    expect(mockGitlabSetToken).not.toHaveBeenCalled();
  });

  it('should clear saved token', async () => {
    mockGitlabClearToken.mockResolvedValue(undefined);

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
    mockGitlabGetToken.mockResolvedValue('glpat-saved');
    mockGitlabGetInstanceUrl.mockResolvedValue('https://gl.corp.com');

    const { result } = renderHook(() => useGitLabDownloads());

    await waitFor(() => {
      expect(result.current.token).toBe('glpat-saved');
      expect(result.current.instanceUrl).toBe('https://gl.corp.com');
    });
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
    mockGitlabGetProjectInfo.mockResolvedValue({ name: 'repo' });

    const { result } = renderHook(() => useGitLabDownloads());

    act(() => {
      result.current.setProjectInput('a/b');
    });

    await act(async () => {
      await result.current.validateAndFetch();
    });

    expect(result.current.releases.length).toBe(1);

    act(() => {
      result.current.setProjectInput('');
    });

    await waitFor(() => {
      expect(result.current.parsedProject).toBeNull();
      expect(result.current.releases).toEqual([]);
    });
  });
});
