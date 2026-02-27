import { renderHook, act, waitFor } from '@testing-library/react';
import { useGitHubDownloads } from './use-github-downloads';

const mockGithubParseUrl = jest.fn();
const mockGithubValidateRepo = jest.fn();
const mockGithubListReleases = jest.fn();
const mockGithubListBranches = jest.fn();
const mockGithubListTags = jest.fn();
const mockGithubGetRepoInfo = jest.fn();
const mockGithubDownloadAsset = jest.fn();
const mockGithubDownloadSource = jest.fn();
const mockGithubGetToken = jest.fn();
const mockGithubSetToken = jest.fn();
const mockGithubClearToken = jest.fn();
const mockIsTauri = jest.fn(() => true);

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  githubParseUrl: (...args: unknown[]) => mockGithubParseUrl(...args),
  githubValidateRepo: (...args: unknown[]) => mockGithubValidateRepo(...args),
  githubListReleases: (...args: unknown[]) => mockGithubListReleases(...args),
  githubListBranches: (...args: unknown[]) => mockGithubListBranches(...args),
  githubListTags: (...args: unknown[]) => mockGithubListTags(...args),
  githubGetRepoInfo: (...args: unknown[]) => mockGithubGetRepoInfo(...args),
  githubDownloadAsset: (...args: unknown[]) => mockGithubDownloadAsset(...args),
  githubDownloadSource: (...args: unknown[]) => mockGithubDownloadSource(...args),
  githubGetToken: (...args: unknown[]) => mockGithubGetToken(...args),
  githubSetToken: (...args: unknown[]) => mockGithubSetToken(...args),
  githubClearToken: (...args: unknown[]) => mockGithubClearToken(...args),
}));

describe('useGitHubDownloads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockGithubGetToken.mockResolvedValue(null);
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useGitHubDownloads());

    expect(result.current.repoInput).toBe('');
    expect(result.current.token).toBe('');
    expect(result.current.parsedRepo).toBeNull();
    expect(result.current.repoInfo).toBeNull();
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
    mockGithubGetToken.mockResolvedValue('ghp_test123');

    const { result } = renderHook(() => useGitHubDownloads());

    await waitFor(() => {
      expect(result.current.token).toBe('ghp_test123');
    });
    expect(result.current.tokenLoading).toBe(false);
  });

  it('should handle token load failure', async () => {
    mockGithubGetToken.mockRejectedValue(new Error('No token'));

    const { result } = renderHook(() => useGitHubDownloads());

    await waitFor(() => {
      expect(result.current.tokenLoading).toBe(false);
    });
    expect(result.current.token).toBe('');
  });

  it('should set tokenLoading false when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);

    const { result } = renderHook(() => useGitHubDownloads());

    await waitFor(() => {
      expect(result.current.tokenLoading).toBe(false);
    });
  });

  it('should update repoInput and sourceType', () => {
    const { result } = renderHook(() => useGitHubDownloads());

    act(() => {
      result.current.setRepoInput('owner/repo');
    });
    expect(result.current.repoInput).toBe('owner/repo');

    act(() => {
      result.current.setSourceType('branch');
    });
    expect(result.current.sourceType).toBe('branch');
  });

  it('should validate and fetch repo data', async () => {
    const parsed = { owner: 'facebook', repo: 'react', fullName: 'facebook/react' };
    const releases = [{ id: 1, tag_name: 'v18.0.0' }];
    const branches = [{ name: 'main' }];
    const tags = [{ name: 'v18.0.0' }];
    const repoInfo = { name: 'react', stars: 200000 };

    mockGithubParseUrl.mockResolvedValue(parsed);
    mockGithubValidateRepo.mockResolvedValue(true);
    mockGithubListReleases.mockResolvedValue(releases);
    mockGithubListBranches.mockResolvedValue(branches);
    mockGithubListTags.mockResolvedValue(tags);
    mockGithubGetRepoInfo.mockResolvedValue(repoInfo);

    const { result } = renderHook(() => useGitHubDownloads());

    act(() => {
      result.current.setRepoInput('facebook/react');
    });

    await act(async () => {
      await result.current.validateAndFetch();
    });

    expect(result.current.parsedRepo).toEqual(parsed);
    expect(result.current.isValid).toBe(true);
    expect(result.current.releases).toEqual(releases);
    expect(result.current.branches).toEqual(branches);
    expect(result.current.tags).toEqual(tags);
    expect(result.current.repoInfo).toEqual(repoInfo);
    expect(result.current.isValidating).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it('should handle invalid repo URL', async () => {
    mockGithubParseUrl.mockResolvedValue(null);

    const { result } = renderHook(() => useGitHubDownloads());

    act(() => {
      result.current.setRepoInput('invalid-url');
    });

    await act(async () => {
      await result.current.validateAndFetch();
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.error).toContain('Invalid');
  });

  it('should handle inaccessible repo', async () => {
    mockGithubParseUrl.mockResolvedValue({ fullName: 'a/b' });
    mockGithubValidateRepo.mockResolvedValue(false);

    const { result } = renderHook(() => useGitHubDownloads());

    act(() => {
      result.current.setRepoInput('a/b');
    });

    await act(async () => {
      await result.current.validateAndFetch();
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.error).toContain('not found');
  });

  it('should not validate when repoInput is empty', async () => {
    const { result } = renderHook(() => useGitHubDownloads());

    await act(async () => {
      await result.current.validateAndFetch();
    });

    expect(mockGithubParseUrl).not.toHaveBeenCalled();
  });

  it('should not validate when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);

    const { result } = renderHook(() => useGitHubDownloads());

    act(() => {
      result.current.setRepoInput('owner/repo');
    });

    await act(async () => {
      await result.current.validateAndFetch();
    });

    expect(mockGithubParseUrl).not.toHaveBeenCalled();
  });

  it('should handle validateAndFetch error', async () => {
    mockGithubParseUrl.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useGitHubDownloads());

    act(() => {
      result.current.setRepoInput('owner/repo');
    });

    await act(async () => {
      await result.current.validateAndFetch();
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.isValid).toBe(false);
  });

  it('should download asset', async () => {
    mockGithubParseUrl.mockResolvedValue({ fullName: 'a/b' });
    mockGithubValidateRepo.mockResolvedValue(true);
    mockGithubListReleases.mockResolvedValue([]);
    mockGithubListBranches.mockResolvedValue([]);
    mockGithubListTags.mockResolvedValue([]);
    mockGithubGetRepoInfo.mockResolvedValue(null);
    mockGithubDownloadAsset.mockResolvedValue('/downloads/file.zip');

    const { result } = renderHook(() => useGitHubDownloads());

    act(() => {
      result.current.setRepoInput('a/b');
    });

    await act(async () => {
      await result.current.validateAndFetch();
    });

    const asset = { id: 1, name: 'file.zip', downloadUrl: 'https://example.com/file.zip' };
    let path;
    await act(async () => {
      path = await result.current.downloadAsset(asset as never, '/downloads');
    });

    expect(path).toBe('/downloads/file.zip');
    expect(mockGithubDownloadAsset).toHaveBeenCalledWith('a/b', 1, 'https://example.com/file.zip', 'file.zip', '/downloads', undefined);
  });

  it('should throw when downloadAsset without parsedRepo', async () => {
    const { result } = renderHook(() => useGitHubDownloads());

    await expect(
      act(async () => {
        await result.current.downloadAsset({} as never, '/downloads');
      }),
    ).rejects.toThrow('Not available');
  });

  it('should download source', async () => {
    mockGithubParseUrl.mockResolvedValue({ fullName: 'a/b' });
    mockGithubValidateRepo.mockResolvedValue(true);
    mockGithubListReleases.mockResolvedValue([]);
    mockGithubListBranches.mockResolvedValue([]);
    mockGithubListTags.mockResolvedValue([]);
    mockGithubGetRepoInfo.mockResolvedValue(null);
    mockGithubDownloadSource.mockResolvedValue('/downloads/source.tar.gz');

    const { result } = renderHook(() => useGitHubDownloads());

    act(() => {
      result.current.setRepoInput('a/b');
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
    mockGithubSetToken.mockResolvedValue(undefined);

    const { result } = renderHook(() => useGitHubDownloads());

    act(() => {
      result.current.setToken('ghp_test');
    });

    await act(async () => {
      await result.current.saveToken();
    });

    expect(mockGithubSetToken).toHaveBeenCalledWith('ghp_test');
  });

  it('should not save empty token', async () => {
    const { result } = renderHook(() => useGitHubDownloads());

    await act(async () => {
      await result.current.saveToken();
    });

    expect(mockGithubSetToken).not.toHaveBeenCalled();
  });

  it('should clear saved token', async () => {
    mockGithubClearToken.mockResolvedValue(undefined);

    const { result } = renderHook(() => useGitHubDownloads());

    act(() => {
      result.current.setToken('ghp_test');
    });

    await act(async () => {
      await result.current.clearSavedToken();
    });

    expect(mockGithubClearToken).toHaveBeenCalled();
    expect(result.current.token).toBe('');
  });

  it('should reset all state', () => {
    const { result } = renderHook(() => useGitHubDownloads());

    act(() => {
      result.current.setRepoInput('owner/repo');
      result.current.setToken('token');
      result.current.setSourceType('tag');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.repoInput).toBe('');
    expect(result.current.token).toBe('');
    expect(result.current.sourceType).toBe('release');
    expect(result.current.parsedRepo).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should clear data when repoInput is emptied', async () => {
    mockGithubParseUrl.mockResolvedValue({ fullName: 'a/b' });
    mockGithubValidateRepo.mockResolvedValue(true);
    mockGithubListReleases.mockResolvedValue([{ id: 1 }]);
    mockGithubListBranches.mockResolvedValue([{ name: 'main' }]);
    mockGithubListTags.mockResolvedValue([{ name: 'v1' }]);
    mockGithubGetRepoInfo.mockResolvedValue({ name: 'repo' });

    const { result } = renderHook(() => useGitHubDownloads());

    act(() => {
      result.current.setRepoInput('a/b');
    });

    await act(async () => {
      await result.current.validateAndFetch();
    });

    expect(result.current.releases.length).toBe(1);

    act(() => {
      result.current.setRepoInput('');
    });

    await waitFor(() => {
      expect(result.current.parsedRepo).toBeNull();
      expect(result.current.releases).toEqual([]);
      expect(result.current.branches).toEqual([]);
      expect(result.current.tags).toEqual([]);
    });
  });
});
