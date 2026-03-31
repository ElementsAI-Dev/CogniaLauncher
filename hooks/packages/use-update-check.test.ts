import { renderHook, act, waitFor } from '@testing-library/react';
import { useUpdateCheck } from './use-update-check';

const mockIsTauri = jest.fn();
const mockCheckUpdates = jest.fn();

let mockStoreState = {
  availableUpdates: [] as Array<{ name: string; provider: string; current_version: string; latest_version: string }>,
  isCheckingUpdates: false,
  updateCheckProgress: null as { current: number; total: number } | null,
  lastUpdateCheck: null as number | null,
};

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
}));

jest.mock('@/hooks/packages/use-package-updates', () => ({
  usePackageUpdates: () => ({
    checkUpdates: (...args: unknown[]) => mockCheckUpdates(...args),
  }),
}));

jest.mock('@/lib/stores/packages', () => ({
  usePackageStore: (selector: (state: Record<string, unknown>) => unknown) => selector(mockStoreState),
}));

describe('useUpdateCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreState = {
      availableUpdates: [],
      isCheckingUpdates: false,
      updateCheckProgress: null,
      lastUpdateCheck: Date.now(),
    };
    mockIsTauri.mockReturnValue(true);
    mockCheckUpdates.mockResolvedValue({
      updates: [],
      total_checked: 0,
      total_providers: 0,
      errors: [],
    });
  });

  it('exposes state from package store', () => {
    mockStoreState.availableUpdates = [
      { name: 'typescript', provider: 'npm', current_version: '5.0.0', latest_version: '5.1.0' },
    ];
    mockStoreState.lastUpdateCheck = Date.now();
    const { result } = renderHook(() => useUpdateCheck());

    expect(result.current.availableUpdates).toHaveLength(1);
    expect(result.current.lastUpdateCheck).toBe(mockStoreState.lastUpdateCheck);
  });

  it('delegates manual checks to usePackageUpdates', async () => {
    const { result } = renderHook(() => useUpdateCheck());

    await act(async () => {
      await result.current.handleCheckUpdates();
    });

    expect(mockCheckUpdates).toHaveBeenCalledTimes(1);
  });

  it('sets local error when delegated check fails', async () => {
    mockCheckUpdates.mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useUpdateCheck());

    await act(async () => {
      await result.current.handleCheckUpdates();
    });

    await waitFor(() => {
      expect(result.current.error).toBe('network error');
    });
  });

  it('auto-checks when last check is stale', async () => {
    mockStoreState.lastUpdateCheck = Date.now() - (2 * 60 * 60 * 1000);
    renderHook(() => useUpdateCheck());

    await waitFor(() => {
      expect(mockCheckUpdates).toHaveBeenCalledTimes(1);
    });
  });

  it('does not auto-check outside tauri runtime', async () => {
    mockIsTauri.mockReturnValue(false);
    renderHook(() => useUpdateCheck());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockCheckUpdates).not.toHaveBeenCalled();
  });
});
