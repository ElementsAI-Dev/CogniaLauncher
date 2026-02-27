import { renderHook, act, waitFor } from '@testing-library/react';
import { useMigratePackages } from './use-migrate-packages';

// Mock tauri
const mockEnvListGlobalPackages = jest.fn();
const mockEnvMigratePackages = jest.fn();
const mockListenEnvMigrateProgress = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(() => true),
  envListGlobalPackages: (...args: unknown[]) => mockEnvListGlobalPackages(...args),
  envMigratePackages: (...args: unknown[]) => mockEnvMigratePackages(...args),
  listenEnvMigrateProgress: (...args: unknown[]) => mockListenEnvMigrateProgress(...args),
}));

describe('useMigratePackages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnvListGlobalPackages.mockResolvedValue([]);
    mockListenEnvMigrateProgress.mockResolvedValue(jest.fn());
  });

  it('starts with empty state when closed', () => {
    const { result } = renderHook(() =>
      useMigratePackages('node', '18.0.0', false),
    );

    expect(result.current.packages).toEqual([]);
    expect(result.current.selected.size).toBe(0);
    expect(result.current.loadingPackages).toBe(false);
    expect(result.current.migrating).toBe(false);
    expect(result.current.result).toBeNull();
  });

  it('loads packages when opened', async () => {
    const packages = [
      { name: 'typescript', version: '5.0.0' },
      { name: 'eslint', version: '8.0.0' },
    ];
    mockEnvListGlobalPackages.mockResolvedValue(packages);

    const { result } = renderHook(() =>
      useMigratePackages('node', '18.0.0', true),
    );

    await waitFor(() => {
      expect(result.current.packages).toEqual(packages);
    });

    expect(result.current.selected.size).toBe(2);
    expect(result.current.selected.has('typescript')).toBe(true);
    expect(result.current.selected.has('eslint')).toBe(true);
    expect(mockEnvListGlobalPackages).toHaveBeenCalledWith('node', '18.0.0');
  });

  it('toggles package selection', async () => {
    mockEnvListGlobalPackages.mockResolvedValue([
      { name: 'typescript', version: '5.0.0' },
    ]);

    const { result } = renderHook(() =>
      useMigratePackages('node', '18.0.0', true),
    );

    await waitFor(() => {
      expect(result.current.selected.has('typescript')).toBe(true);
    });

    act(() => {
      result.current.togglePackage('typescript');
    });

    expect(result.current.selected.has('typescript')).toBe(false);

    act(() => {
      result.current.togglePackage('typescript');
    });

    expect(result.current.selected.has('typescript')).toBe(true);
  });

  it('migrates selected packages', async () => {
    mockEnvListGlobalPackages.mockResolvedValue([
      { name: 'typescript', version: '5.0.0' },
    ]);
    const migrateResult = {
      migrated: ['typescript'],
      failed: [],
      skipped: [],
    };
    mockEnvMigratePackages.mockResolvedValue(migrateResult);

    const { result } = renderHook(() =>
      useMigratePackages('node', '18.0.0', true),
    );

    await waitFor(() => {
      expect(result.current.packages.length).toBe(1);
    });

    await act(async () => {
      await result.current.handleMigrate('20.0.0');
    });

    expect(mockEnvMigratePackages).toHaveBeenCalledWith(
      'node',
      '18.0.0',
      '20.0.0',
      ['typescript'],
    );
    expect(result.current.result).toEqual(migrateResult);
    expect(result.current.migrating).toBe(false);
  });

  it('handles package load error', async () => {
    mockEnvListGlobalPackages.mockRejectedValue(new Error('load error'));

    const { result } = renderHook(() =>
      useMigratePackages('node', '18.0.0', true),
    );

    await waitFor(() => {
      expect(result.current.loadingPackages).toBe(false);
    });

    expect(result.current.packages).toEqual([]);
  });

  it('computes progressPercent correctly', async () => {
    const { result } = renderHook(() =>
      useMigratePackages('node', '18.0.0', false),
    );

    // With no progress, percent is 0
    expect(result.current.progressPercent).toBe(0);
  });

  it('does not migrate when nothing selected', async () => {
    mockEnvListGlobalPackages.mockResolvedValue([
      { name: 'typescript', version: '5.0.0' },
    ]);

    const { result } = renderHook(() =>
      useMigratePackages('node', '18.0.0', true),
    );

    await waitFor(() => {
      expect(result.current.packages.length).toBe(1);
    });

    // Deselect all
    act(() => {
      result.current.togglePackage('typescript');
    });

    await act(async () => {
      await result.current.handleMigrate('20.0.0');
    });

    expect(mockEnvMigratePackages).not.toHaveBeenCalled();
  });
});
