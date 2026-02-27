import { renderHook, act } from '@testing-library/react';
import { useUpdateChecker } from './use-update-checker';

// Mock use-environments hook
const mockFetchAvailableVersions = jest.fn();
jest.mock('@/hooks/use-environments', () => ({
  useEnvironments: () => ({
    fetchAvailableVersions: mockFetchAvailableVersions,
  }),
}));

// Mock the environment store (required by use-environments)
jest.mock('@/lib/stores/environment', () => ({
  useEnvironmentStore: Object.assign(jest.fn(() => ({})), {
    getState: jest.fn(() => ({})),
  }),
}));

import type { EnvironmentInfo, VersionInfo } from '@/lib/tauri';

const makeEnv = (envType: string, currentVersion: string | null): EnvironmentInfo => ({
  env_type: envType,
  provider_id: 'fnm',
  provider: 'fnm',
  current_version: currentVersion,
  installed_versions: [],
  available: true,
});

const makeVersion = (version: string, deprecated = false, yanked = false): VersionInfo => ({
  version,
  release_date: null,
  deprecated,
  yanked,
});

describe('useUpdateChecker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts with unchecked state', () => {
    const { result } = renderHook(() => useUpdateChecker());
    expect(result.current.checking).toBe(false);
    expect(result.current.checked).toBe(false);
    expect(result.current.updateInfo).toBeNull();
    expect(result.current.hasUpdate).toBe(false);
  });

  it('does not check when current_version is null', async () => {
    const env = makeEnv('node', null);
    const { result } = renderHook(() => useUpdateChecker());

    await act(async () => {
      await result.current.checkForUpdates(env);
    });

    expect(mockFetchAvailableVersions).not.toHaveBeenCalled();
  });

  it('detects available updates', async () => {
    const env = makeEnv('node', '18.0.0');
    mockFetchAvailableVersions.mockResolvedValue([
      makeVersion('20.11.0'),
      makeVersion('20.10.0'),
      makeVersion('18.19.0'),
      makeVersion('18.0.0'),
    ]);

    const { result } = renderHook(() => useUpdateChecker());

    await act(async () => {
      await result.current.checkForUpdates(env);
    });

    expect(result.current.checked).toBe(true);
    expect(result.current.checking).toBe(false);
    expect(result.current.hasUpdate).toBe(true);
    expect(result.current.updateInfo).toEqual({
      envType: 'node',
      currentVersion: '18.0.0',
      latestVersion: '20.11.0',
      latestStable: '20.11.0',
      availableCount: 3,
    });
  });

  it('reports up-to-date when on latest', async () => {
    const env = makeEnv('node', '20.11.0');
    mockFetchAvailableVersions.mockResolvedValue([
      makeVersion('20.11.0'),
      makeVersion('20.10.0'),
    ]);

    const { result } = renderHook(() => useUpdateChecker());

    await act(async () => {
      await result.current.checkForUpdates(env);
    });

    expect(result.current.checked).toBe(true);
    expect(result.current.hasUpdate).toBe(false);
  });

  it('handles fetch error gracefully', async () => {
    const env = makeEnv('node', '18.0.0');
    mockFetchAvailableVersions.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useUpdateChecker());

    await act(async () => {
      await result.current.checkForUpdates(env);
    });

    expect(result.current.checked).toBe(true);
    expect(result.current.checking).toBe(false);
    expect(result.current.updateInfo).toBeNull();
  });

  it('skips deprecated versions for latest', async () => {
    const env = makeEnv('node', '18.0.0');
    mockFetchAvailableVersions.mockResolvedValue([
      makeVersion('21.0.0', true),
      makeVersion('20.0.0'),
    ]);

    const { result } = renderHook(() => useUpdateChecker());

    await act(async () => {
      await result.current.checkForUpdates(env);
    });

    expect(result.current.updateInfo?.latestVersion).toBe('20.0.0');
  });
});
