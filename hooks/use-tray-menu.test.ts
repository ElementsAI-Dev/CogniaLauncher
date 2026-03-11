import { act, renderHook, waitFor } from '@testing-library/react';
import { useTrayMenu } from './use-tray-menu';

const mockIsTauri = jest.fn(() => true);
const mockTrayGetMenuConfig = jest.fn();
const mockTraySetMenuConfig = jest.fn();
const mockTrayGetAvailableMenuItems = jest.fn();
const mockTrayResetMenuConfig = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  trayGetMenuConfig: (...args: unknown[]) => mockTrayGetMenuConfig(...args),
  traySetMenuConfig: (...args: unknown[]) => mockTraySetMenuConfig(...args),
  trayGetAvailableMenuItems: (...args: unknown[]) =>
    mockTrayGetAvailableMenuItems(...args),
  trayResetMenuConfig: (...args: unknown[]) => mockTrayResetMenuConfig(...args),
}));

describe('useTrayMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTrayGetAvailableMenuItems.mockResolvedValue(['show_hide', 'settings', 'quit']);
    mockTrayGetMenuConfig.mockResolvedValue({ items: ['show_hide', 'quit'], priorityItems: [] });
    mockTraySetMenuConfig.mockResolvedValue(undefined);
    mockTrayResetMenuConfig.mockResolvedValue(undefined);
  });

  it('loads normalized menu config and derived sections', async () => {
    const { result } = renderHook(() => useTrayMenu());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.enabledItems).toEqual(['show_hide', 'quit']);
    expect(result.current.priorityEnabledItems).toEqual([]);
    expect(result.current.normalEnabledItems).toEqual(['show_hide']);
    expect(result.current.requiredEnabledItems).toEqual(['quit']);
    expect(result.current.disabledItems).toEqual(['settings']);
  });

  it('toggles non-quit item and persists normalized config', async () => {
    const { result } = renderHook(() => useTrayMenu());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.handleToggle('settings', true);
    });

    expect(mockTraySetMenuConfig).toHaveBeenCalled();
    expect(result.current.enabledItems).toContain('settings');
  });

  it('does not remove quit item when toggled off', async () => {
    const { result } = renderHook(() => useTrayMenu());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.handleToggle('quit', false);
    });

    expect(result.current.enabledItems).toContain('quit');
  });

  it('reorders normal items and saves once at drag end handler', async () => {
    mockTrayGetAvailableMenuItems.mockResolvedValue([
      'show_hide',
      'settings',
      'downloads',
      'quit',
    ]);
    mockTrayGetMenuConfig.mockResolvedValue({
      items: ['show_hide', 'settings', 'downloads', 'quit'],
      priorityItems: [],
    });

    const { result } = renderHook(() => useTrayMenu());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.handleNormalReorder('downloads', 'show_hide');
    });

    expect(result.current.normalEnabledItems).toEqual([
      'downloads',
      'show_hide',
      'settings',
    ]);
    expect(mockTraySetMenuConfig).toHaveBeenCalledWith({
      items: ['downloads', 'show_hide', 'settings', 'quit'],
      priorityItems: [],
    });
  });

  it('keeps priority as an ordered enabled subset without quit', async () => {
    mockTrayGetAvailableMenuItems.mockResolvedValue([
      'show_hide',
      'settings',
      'downloads',
      'quit',
    ]);
    mockTrayGetMenuConfig.mockResolvedValue({
      items: ['show_hide', 'settings', 'downloads', 'quit'],
      priorityItems: ['settings'],
    });

    const { result } = renderHook(() => useTrayMenu());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.handlePriorityToggle('downloads', true);
    });

    act(() => {
      result.current.handlePriorityReorder('downloads', 'settings');
    });

    act(() => {
      result.current.handlePriorityToggle('quit', true);
    });

    expect(result.current.priorityEnabledItems).toEqual(['downloads', 'settings']);
    expect(result.current.priorityEnabledItems).not.toContain('quit');
    expect(mockTraySetMenuConfig).toHaveBeenLastCalledWith({
      items: ['downloads', 'settings', 'show_hide', 'quit'],
      priorityItems: ['downloads', 'settings'],
    });
  });
});
