import { act, renderHook, waitFor } from '@testing-library/react';
import { useTrayAutostart } from './use-tray-autostart';

const mockIsTauri = jest.fn(() => true);
const mockTrayIsAutostartEnabled = jest.fn();
const mockTrayEnableAutostart = jest.fn();
const mockTrayDisableAutostart = jest.fn();
const mockTraySetClickBehavior = jest.fn();
const mockTraySetQuickAction = jest.fn();
const mockTrayGetAvailableQuickActions = jest.fn();
const mockTraySetShowNotifications = jest.fn();
const mockTraySetNotificationLevel = jest.fn();
const mockTraySetNotificationEvents = jest.fn();
const mockTrayGetAvailableNotificationEvents = jest.fn();
const mockTrayGetState = jest.fn();
const mockListenTrayNotificationEventsChanged = jest.fn();
const mockTraySetMinimizeToTray = jest.fn();
const mockTraySetStartMinimized = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  trayIsAutostartEnabled: (...args: unknown[]) => mockTrayIsAutostartEnabled(...args),
  trayEnableAutostart: (...args: unknown[]) => mockTrayEnableAutostart(...args),
  trayDisableAutostart: (...args: unknown[]) => mockTrayDisableAutostart(...args),
  traySetClickBehavior: (...args: unknown[]) => mockTraySetClickBehavior(...args),
  traySetQuickAction: (...args: unknown[]) => mockTraySetQuickAction(...args),
  trayGetAvailableQuickActions: (...args: unknown[]) =>
    mockTrayGetAvailableQuickActions(...args),
  traySetShowNotifications: (...args: unknown[]) => mockTraySetShowNotifications(...args),
  traySetNotificationLevel: (...args: unknown[]) => mockTraySetNotificationLevel(...args),
  traySetNotificationEvents: (...args: unknown[]) =>
    mockTraySetNotificationEvents(...args),
  trayGetAvailableNotificationEvents: (...args: unknown[]) =>
    mockTrayGetAvailableNotificationEvents(...args),
  trayGetState: (...args: unknown[]) => mockTrayGetState(...args),
  listenTrayNotificationEventsChanged: (...args: unknown[]) =>
    mockListenTrayNotificationEventsChanged(...args),
  traySetMinimizeToTray: (...args: unknown[]) => mockTraySetMinimizeToTray(...args),
  traySetStartMinimized: (...args: unknown[]) => mockTraySetStartMinimized(...args),
}));

describe('useTrayAutostart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockTrayIsAutostartEnabled.mockResolvedValue(true);
    mockTrayEnableAutostart.mockResolvedValue(undefined);
    mockTrayDisableAutostart.mockResolvedValue(undefined);
    mockTraySetClickBehavior.mockResolvedValue(undefined);
    mockTraySetQuickAction.mockResolvedValue(undefined);
    mockTrayGetAvailableQuickActions.mockResolvedValue([
      "open_settings",
      "open_downloads",
      "check_updates",
      "open_logs",
    ]);
    mockTraySetShowNotifications.mockResolvedValue(undefined);
    mockTraySetNotificationLevel.mockResolvedValue(undefined);
    mockTraySetNotificationEvents.mockResolvedValue(undefined);
    mockTrayGetAvailableNotificationEvents.mockResolvedValue([
      "updates",
      "downloads",
      "errors",
      "system",
    ]);
    mockListenTrayNotificationEventsChanged.mockResolvedValue(() => {});
    mockTrayGetState.mockResolvedValue({
      quickAction: "check_updates",
      notificationEvents: ["updates", "downloads", "errors", "system"],
    });
    mockTraySetMinimizeToTray.mockResolvedValue(undefined);
    mockTraySetStartMinimized.mockResolvedValue(undefined);
  });

  it('hydrates autostart state and updates backend on toggle', async () => {
    const onValueChange = jest.fn();
    const { result } = renderHook(() =>
      useTrayAutostart({ appSettings: {} as never, onValueChange }),
    );

    await waitFor(() => expect(result.current.autostartEnabled).toBe(true));

    await act(async () => {
      await result.current.handleAutostartChange(false);
    });

    expect(mockTrayDisableAutostart).toHaveBeenCalled();
    expect(onValueChange).toHaveBeenCalledWith('autostart', false);
  });

  it('does nothing for autostart toggle outside tauri', async () => {
    mockIsTauri.mockReturnValue(false);
    const { result } = renderHook(() =>
      useTrayAutostart({ appSettings: {} as never, onValueChange: jest.fn() }),
    );

    await act(async () => {
      await result.current.handleAutostartChange(true);
    });

    expect(mockTrayEnableAutostart).not.toHaveBeenCalled();
    expect(result.current.autostartLoading).toBe(false);
  });

  it("updates quick action through backend command", async () => {
    const { result } = renderHook(() =>
      useTrayAutostart({ appSettings: {} as never, onValueChange: jest.fn() }),
    );

    await act(async () => {
      await result.current.handleQuickActionChange("open_settings");
    });

    expect(mockTraySetQuickAction).toHaveBeenCalledWith("open_settings");
  });
});
