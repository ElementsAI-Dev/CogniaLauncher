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
    mockTrayGetAvailableMenuItems.mockResolvedValue(['show', 'settings', 'quit']);
    mockTrayGetMenuConfig.mockResolvedValue({ items: ['show', 'quit'], priorityItems: [] });
    mockTraySetMenuConfig.mockResolvedValue(undefined);
    mockTrayResetMenuConfig.mockResolvedValue(undefined);
  });

  it('loads menu config and toggles non-quit item', async () => {
    const { result } = renderHook(() => useTrayMenu());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.enabledItems).toEqual(['show', 'quit']);

    act(() => {
      result.current.handleToggle('settings' as never, true);
    });

    expect(mockTraySetMenuConfig).toHaveBeenCalled();
    expect(result.current.enabledItems).toContain('settings');
  });

  it('does not remove quit item when toggled off', async () => {
    const { result } = renderHook(() => useTrayMenu());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.handleToggle('quit' as never, false);
    });

    expect(result.current.enabledItems).toContain('quit');
  });
});
