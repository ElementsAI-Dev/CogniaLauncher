import { renderHook, act } from '@testing-library/react';
import { useVersionBrowser } from './use-version-browser';

// Mock tauri
const mockEnvAvailableVersions = jest.fn();
jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(() => true),
  envAvailableVersions: (...args: unknown[]) => mockEnvAvailableVersions(...args),
}));

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock environment store
const mockSetAvailableVersions = jest.fn();
const mockToggleVersionSelection = jest.fn();
const mockClearVersionSelection = jest.fn();

jest.mock('@/lib/stores/environment', () => ({
  useEnvironmentStore: jest.fn(() => ({
    availableVersions: {},
    setAvailableVersions: mockSetAvailableVersions,
    selectedVersions: [],
    toggleVersionSelection: mockToggleVersionSelection,
    clearVersionSelection: mockClearVersionSelection,
  })),
}));

import type { VersionInfo } from '@/lib/tauri';

const makeVersion = (version: string, deprecated = false, yanked = false): VersionInfo => ({
  version,
  release_date: null,
  deprecated,
  yanked,
});

describe('useVersionBrowser', () => {
  const mockOnInstall = jest.fn();
  const mockOnUninstall = jest.fn();
  const mockT = jest.fn((key: string) => key);

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnvAvailableVersions.mockResolvedValue([]);
  });

  it('starts with default state', () => {
    const { result } = renderHook(() =>
      useVersionBrowser('node', false, [], mockOnInstall, mockOnUninstall, undefined, mockT),
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.searchQuery).toBe('');
    expect(result.current.filter).toBe('all');
    expect(result.current.installingVersion).toBeNull();
    expect(result.current.batchProcessing).toBe(false);
  });

  it('fetches versions when opened', async () => {
    const versions = [makeVersion('20.0.0'), makeVersion('18.0.0')];
    mockEnvAvailableVersions.mockResolvedValue(versions);

    renderHook(() =>
      useVersionBrowser('node', true, [], mockOnInstall, mockOnUninstall, undefined, mockT),
    );

    // Wait for effect
    await act(async () => {});

    expect(mockEnvAvailableVersions).toHaveBeenCalledWith('node');
    expect(mockSetAvailableVersions).toHaveBeenCalledWith('node', versions);
  });

  it('handles install for a single version', async () => {
    mockOnInstall.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useVersionBrowser('node', false, [], mockOnInstall, mockOnUninstall, 'fnm', mockT),
    );

    await act(async () => {
      await result.current.handleInstall('20.0.0');
    });

    expect(mockOnInstall).toHaveBeenCalledWith('20.0.0', 'fnm');
    expect(result.current.installingVersion).toBeNull();
  });

  it('sets error on fetch failure', async () => {
    mockEnvAvailableVersions.mockRejectedValue(new Error('fetch failed'));

    const { result } = renderHook(() =>
      useVersionBrowser('node', true, [], mockOnInstall, mockOnUninstall, undefined, mockT),
    );

    await act(async () => {});

    expect(result.current.error).toBe('fetch failed');
  });

  it('computes installable and uninstallable counts as 0 with no selection', () => {
    const { result } = renderHook(() =>
      useVersionBrowser('node', false, ['18.0.0'], mockOnInstall, mockOnUninstall, undefined, mockT),
    );

    expect(result.current.installableCount).toBe(0);
    expect(result.current.uninstallableCount).toBe(0);
  });

  it('isInstalled returns correct value', () => {
    const { result } = renderHook(() =>
      useVersionBrowser('node', false, ['18.0.0', '20.0.0'], mockOnInstall, mockOnUninstall, undefined, mockT),
    );

    expect(result.current.isInstalled('18.0.0')).toBe(true);
    expect(result.current.isInstalled('16.0.0')).toBe(false);
  });
});
