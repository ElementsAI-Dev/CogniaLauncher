import { renderHook, act } from '@testing-library/react';
import { usePackageUpdates } from './use-package-updates';
import type { UpdateCheckSummary } from '@/types/tauri';

const mockIsTauri = jest.fn();
const mockListenUpdateCheckProgress = jest.fn();
const mockCheckUpdates = jest.fn();

const mockSetAvailableUpdates = jest.fn();
const mockSetIsCheckingUpdates = jest.fn();
const mockSetUpdateCheckProgress = jest.fn();
const mockSetUpdateCheckErrors = jest.fn();
const mockSetUpdateCheckProviderOutcomes = jest.fn();
const mockSetUpdateCheckCoverage = jest.fn();
const mockSetLastUpdateCheck = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  listenUpdateCheckProgress: (...args: unknown[]) => mockListenUpdateCheckProgress(...args),
  checkUpdates: (...args: unknown[]) => mockCheckUpdates(...args),
}));

jest.mock('@/lib/stores/packages', () => ({
  usePackageStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    setAvailableUpdates: mockSetAvailableUpdates,
    setIsCheckingUpdates: mockSetIsCheckingUpdates,
    setUpdateCheckProgress: mockSetUpdateCheckProgress,
    setUpdateCheckErrors: mockSetUpdateCheckErrors,
    setUpdateCheckProviderOutcomes: mockSetUpdateCheckProviderOutcomes,
    setUpdateCheckCoverage: mockSetUpdateCheckCoverage,
    setLastUpdateCheck: mockSetLastUpdateCheck,
  }),
}));

describe('usePackageUpdates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockListenUpdateCheckProgress.mockResolvedValue(jest.fn());
    mockCheckUpdates.mockResolvedValue({
      updates: [],
      total_checked: 0,
      total_providers: 0,
      errors: [],
      provider_outcomes: [],
      coverage: { supported: 0, partial: 0, unsupported: 0, error: 0 },
    });
  });

  it('returns empty summary when not in tauri runtime', async () => {
    mockIsTauri.mockReturnValue(false);
    const { result } = renderHook(() => usePackageUpdates());

    let summary: UpdateCheckSummary | undefined;
    await act(async () => {
      summary = await result.current.checkUpdates();
    });

    expect(summary).toEqual({
      updates: [],
      total_checked: 0,
      total_providers: 0,
      errors: [],
      provider_outcomes: [],
      coverage: { supported: 0, partial: 0, unsupported: 0, error: 0 },
    });
    expect(mockCheckUpdates).not.toHaveBeenCalled();
  });

  it('syncs store state in default mode', async () => {
    const unlisten = jest.fn();
    mockListenUpdateCheckProgress.mockResolvedValue(unlisten);
    mockCheckUpdates.mockResolvedValue({
      updates: [{ name: 'typescript', provider: 'npm', current_version: '5.0.0', latest_version: '5.1.0' }],
      total_checked: 1,
      total_providers: 1,
      errors: [{ provider: 'pip', package: null, message: 'unavailable' }],
      provider_outcomes: [{ provider: 'npm', status: 'supported', reason: null, checked: 1, updates: 1, errors: 0 }],
      coverage: { supported: 1, partial: 0, unsupported: 0, error: 0 },
    });

    const { result } = renderHook(() => usePackageUpdates());

    await act(async () => {
      await result.current.checkUpdates({ packages: ['typescript'] });
    });

    expect(mockSetIsCheckingUpdates).toHaveBeenNthCalledWith(1, true);
    expect(mockCheckUpdates).toHaveBeenCalledWith(['typescript']);
    expect(mockSetAvailableUpdates).toHaveBeenCalledWith([
      { name: 'typescript', provider: 'npm', current_version: '5.0.0', latest_version: '5.1.0' },
    ]);
    expect(mockSetUpdateCheckErrors).toHaveBeenCalledWith([
      { provider: 'pip', package: null, message: 'unavailable' },
    ]);
    expect(mockSetUpdateCheckProviderOutcomes).toHaveBeenCalledWith([
      { provider: 'npm', status: 'supported', reason: null, checked: 1, updates: 1, errors: 0 },
    ]);
    expect(mockSetUpdateCheckCoverage).toHaveBeenCalledWith({
      supported: 1,
      partial: 0,
      unsupported: 0,
      error: 0,
    });
    expect(mockSetLastUpdateCheck).toHaveBeenCalledTimes(1);
    expect(mockSetIsCheckingUpdates).toHaveBeenLastCalledWith(false);
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it('filters updates by provider when providerId is passed', async () => {
    mockCheckUpdates.mockResolvedValue({
      updates: [
        { name: 'typescript', provider: 'npm', current_version: '5.0.0', latest_version: '5.1.0' },
        { name: 'requests', provider: 'pip', current_version: '2.0.0', latest_version: '3.0.0' },
      ],
      total_checked: 2,
      total_providers: 2,
      errors: [],
      provider_outcomes: [],
      coverage: { supported: 2, partial: 0, unsupported: 0, error: 0 },
    });

    const { result } = renderHook(() => usePackageUpdates());
    let summary: UpdateCheckSummary | undefined;

    await act(async () => {
      summary = await result.current.checkUpdates({ providerId: 'npm' });
    });

    expect(summary?.updates).toEqual([
      { name: 'typescript', provider: 'npm', current_version: '5.0.0', latest_version: '5.1.0' },
    ]);
    expect(mockSetAvailableUpdates).toHaveBeenCalledWith([
      { name: 'typescript', provider: 'npm', current_version: '5.0.0', latest_version: '5.1.0' },
    ]);
  });

  it('does not mutate package store in syncStore=false mode', async () => {
    const { result } = renderHook(() => usePackageUpdates());

    await act(async () => {
      await result.current.checkUpdates({ syncStore: false });
    });

    expect(mockSetIsCheckingUpdates).not.toHaveBeenCalled();
    expect(mockSetAvailableUpdates).not.toHaveBeenCalled();
    expect(mockSetUpdateCheckProgress).not.toHaveBeenCalled();
    expect(mockSetUpdateCheckErrors).not.toHaveBeenCalled();
    expect(mockSetUpdateCheckProviderOutcomes).not.toHaveBeenCalled();
    expect(mockSetUpdateCheckCoverage).not.toHaveBeenCalled();
    expect(mockSetLastUpdateCheck).not.toHaveBeenCalled();
  });
});
