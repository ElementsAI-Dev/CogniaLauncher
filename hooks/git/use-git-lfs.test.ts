import { renderHook, act } from '@testing-library/react';
import { useGitLfs } from './use-git-lfs';

jest.mock('@/lib/tauri', () => ({
  isTauri: () => true,
  gitLfsIsAvailable: jest.fn().mockResolvedValue(true),
  gitLfsGetVersion: jest.fn().mockResolvedValue('3.4.0'),
  gitLfsTrackedPatterns: jest.fn().mockResolvedValue(['*.psd', '*.zip']),
  gitLfsLsFiles: jest.fn().mockResolvedValue([
    { oid: 'abc123', name: 'assets/large.psd', pointerStatus: '*' },
    { oid: 'def456', name: 'docs/guide.pdf', pointerStatus: '-' },
  ]),
  gitLfsTrack: jest.fn().mockResolvedValue("LFS tracking '*.png'"),
  gitLfsUntrack: jest.fn().mockResolvedValue("LFS untracking '*.psd'"),
  gitLfsInstall: jest.fn().mockResolvedValue("Updated git hooks"),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tauri = require('@/lib/tauri');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useGitLfs', () => {
  it('checkAvailability detects LFS and fetches version', async () => {
    const { result } = renderHook(() => useGitLfs('/repo'));
    await act(async () => { await result.current.checkAvailability(); });
    expect(tauri.gitLfsIsAvailable).toHaveBeenCalled();
    expect(tauri.gitLfsGetVersion).toHaveBeenCalled();
    expect(result.current.lfsAvailable).toBe(true);
    expect(result.current.lfsVersion).toBe('3.4.0');
  });

  it('checkAvailability sets false when not available', async () => {
    tauri.gitLfsIsAvailable.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useGitLfs('/repo'));
    await act(async () => { await result.current.checkAvailability(); });
    expect(result.current.lfsAvailable).toBe(false);
    expect(result.current.lfsVersion).toBeNull();
  });

  it('refreshTrackedPatterns fetches patterns', async () => {
    const { result } = renderHook(() => useGitLfs('/repo'));
    await act(async () => { await result.current.refreshTrackedPatterns(); });
    expect(tauri.gitLfsTrackedPatterns).toHaveBeenCalledWith('/repo');
    expect(result.current.trackedPatterns).toEqual(['*.psd', '*.zip']);
  });

  it('refreshLfsFiles fetches files', async () => {
    const { result } = renderHook(() => useGitLfs('/repo'));
    await act(async () => { await result.current.refreshLfsFiles(); });
    expect(tauri.gitLfsLsFiles).toHaveBeenCalledWith('/repo');
    expect(result.current.lfsFiles).toHaveLength(2);
    expect(result.current.lfsFiles[0].name).toBe('assets/large.psd');
  });

  it('track calls tauri and refreshes patterns', async () => {
    const { result } = renderHook(() => useGitLfs('/repo'));
    await act(async () => { await result.current.track('*.png'); });
    expect(tauri.gitLfsTrack).toHaveBeenCalledWith('/repo', '*.png');
    expect(tauri.gitLfsTrackedPatterns).toHaveBeenCalled();
  });

  it('untrack calls tauri and refreshes patterns', async () => {
    const { result } = renderHook(() => useGitLfs('/repo'));
    await act(async () => { await result.current.untrack('*.psd'); });
    expect(tauri.gitLfsUntrack).toHaveBeenCalledWith('/repo', '*.psd');
    expect(tauri.gitLfsTrackedPatterns).toHaveBeenCalled();
  });

  it('install calls tauri', async () => {
    const { result } = renderHook(() => useGitLfs('/repo'));
    await act(async () => { await result.current.install(); });
    expect(tauri.gitLfsInstall).toHaveBeenCalledWith('/repo');
  });

  it('does nothing when no repo path', async () => {
    const { result } = renderHook(() => useGitLfs(null));
    await act(async () => { await result.current.refreshTrackedPatterns(); });
    expect(tauri.gitLfsTrackedPatterns).not.toHaveBeenCalled();
    expect(result.current.trackedPatterns).toEqual([]);
  });

  it('throws on write action without repo', async () => {
    const { result } = renderHook(() => useGitLfs(null));
    await expect(
      act(async () => { await result.current.track('*.bin'); })
    ).rejects.toThrow('No repo');
  });
});
