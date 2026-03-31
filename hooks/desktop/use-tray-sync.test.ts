import { renderHook } from '@testing-library/react';
import { useTraySync, updateTrayDownloadCount, updateTrayHasUpdate } from './use-tray-sync';

// Mock Tauri APIs
const mockTraySetLanguage = jest.fn();
const mockTrayRebuild = jest.fn();
const mockListenNavigate = jest.fn();
const mockListenCheckUpdates = jest.fn();
const mockListenDesktopAction = jest.fn();
const mockListenTrayTerminalLaunch = jest.fn();
const mockListenTrayShowNotificationsChanged = jest.fn();
const mockTraySetActiveDownloads = jest.fn();
const mockTraySetWslState = jest.fn();
const mockTraySetHasUpdate = jest.fn();
const mockTraySetTerminalProfiles = jest.fn();
const mockTerminalLaunchProfile = jest.fn();
const mockWslGetStatus = jest.fn();
const mockSetAppSettings = jest.fn();
const mockTerminalHydrate = jest.fn();
let mockTerminalStoreState = {
  profiles: [] as Array<{ id: string; name: string }>,
  defaultProfileId: null as string | null,
  recentlyLaunchedIds: [] as string[],
  loading: false,
  hydrate: mockTerminalHydrate,
  markProfileLaunched: jest.fn(),
};

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(() => true),
  traySetLanguage: (...args: unknown[]) => {
    mockTraySetLanguage(...args);
    return Promise.resolve();
  },
  trayRebuild: (...args: unknown[]) => {
    mockTrayRebuild(...args);
    return Promise.resolve();
  },
  listenNavigate: (...args: unknown[]) => mockListenNavigate(...args),
  listenCheckUpdates: (...args: unknown[]) => mockListenCheckUpdates(...args),
  listenDesktopAction: (...args: unknown[]) => mockListenDesktopAction(...args),
  listenTrayTerminalLaunch: (...args: unknown[]) =>
    mockListenTrayTerminalLaunch(...args),
  listenTrayShowNotificationsChanged: (...args: unknown[]) =>
    mockListenTrayShowNotificationsChanged(...args),
  listenDownloadPauseAll: jest.fn().mockResolvedValue(() => {}),
  listenDownloadResumeAll: jest.fn().mockResolvedValue(() => {}),
  listenToggleAlwaysOnTop: jest.fn().mockResolvedValue(() => {}),
  traySetActiveDownloads: (...args: unknown[]) => {
    mockTraySetActiveDownloads(...args);
    return Promise.resolve();
  },
  traySetWslState: (...args: unknown[]) => {
    mockTraySetWslState(...args);
    return Promise.resolve();
  },
  traySetHasUpdate: (...args: unknown[]) => {
    mockTraySetHasUpdate(...args);
    return Promise.resolve();
  },
  traySetTerminalProfiles: (...args: unknown[]) => {
    mockTraySetTerminalProfiles(...args);
    return Promise.resolve();
  },
  terminalLaunchProfile: (...args: unknown[]) => {
    mockTerminalLaunchProfile(...args);
    return Promise.resolve("launched");
  },
  wslGetStatus: (...args: unknown[]) => mockWslGetStatus(...args),
}));

jest.mock('@/lib/stores/settings', () => ({
  useSettingsStore: (selector: (state: { setAppSettings: typeof mockSetAppSettings }) => unknown) =>
    selector({ setAppSettings: mockSetAppSettings }),
}));

jest.mock('@/lib/stores/terminal', () => ({
  useTerminalStore: (
    selector: (state: typeof mockTerminalStoreState) => unknown,
  ) => selector(mockTerminalStoreState),
}));

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock locale provider
jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => key,
    locale: 'en',
    setLocale: jest.fn(),
  }),
}));

describe('useTraySync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListenNavigate.mockResolvedValue(() => {});
    mockListenCheckUpdates.mockResolvedValue(() => {});
    mockListenDesktopAction.mockResolvedValue(() => {});
    mockListenTrayTerminalLaunch.mockResolvedValue(() => {});
    mockListenTrayShowNotificationsChanged.mockResolvedValue(() => {});
    mockWslGetStatus.mockResolvedValue({
      defaultDistribution: 'Ubuntu',
      runningDistros: ['Ubuntu'],
    });
    mockTerminalStoreState = {
      profiles: [],
      defaultProfileId: null,
      recentlyLaunchedIds: [],
      loading: false,
      hydrate: mockTerminalHydrate,
      markProfileLaunched: jest.fn(),
    };
  });

  it('should setup tray sync on mount', async () => {
    renderHook(() => useTraySync());

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockTraySetLanguage).toHaveBeenCalledWith('en');
    expect(mockTrayRebuild).toHaveBeenCalled();
  });

  it('syncs WSL tray state from runtime status on mount', async () => {
    renderHook(() => useTraySync());
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockWslGetStatus).toHaveBeenCalled();
    expect(mockTraySetWslState).toHaveBeenCalledWith(1, 'Ubuntu');
  });

  it('should setup navigation listener', () => {
    renderHook(() => useTraySync());

    expect(mockListenNavigate).toHaveBeenCalled();
  });

  it('should setup check updates listener', () => {
    renderHook(() => useTraySync());

    expect(mockListenCheckUpdates).toHaveBeenCalled();
  });

  it("listens for shared desktop actions from the tray bridge", () => {
    renderHook(() => useTraySync());

    expect(mockListenDesktopAction).toHaveBeenCalled();
  });

  it('should setup tray notification visibility listener', () => {
    renderHook(() => useTraySync());

    expect(mockListenTrayShowNotificationsChanged).toHaveBeenCalled();
  });

  it("syncs terminal shortcuts to the tray from the terminal store", async () => {
    mockTerminalStoreState = {
      profiles: [
        { id: "default-terminal", name: "Default Terminal" },
        { id: "recent-terminal", name: "Recent Terminal" },
      ],
      defaultProfileId: "default-terminal",
      recentlyLaunchedIds: ["recent-terminal"],
      loading: false,
      hydrate: mockTerminalHydrate,
      markProfileLaunched: jest.fn(),
    };

    renderHook(() => useTraySync());
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockTraySetTerminalProfiles).toHaveBeenCalledWith(
      "default-terminal",
      [{ id: "recent-terminal", name: "Recent Terminal" }],
    );
  });

  it("listens for tray terminal launch events", async () => {
    let launchFromTray: ((profileId: string) => void) | undefined;
    mockListenTrayTerminalLaunch.mockImplementation((callback: (profileId: string) => void) => {
      launchFromTray = callback;
      return Promise.resolve(() => {});
    });

    renderHook(() => useTraySync());
    await new Promise((resolve) => setTimeout(resolve, 0));

    launchFromTray?.("profile-1");
    expect(mockTerminalLaunchProfile).toHaveBeenCalledWith("profile-1");
  });

  it('should cleanup listeners on unmount', async () => {
    const unlistenNavigate = jest.fn();
    const unlistenCheckUpdates = jest.fn();
    mockListenNavigate.mockResolvedValue(unlistenNavigate);
    mockListenCheckUpdates.mockResolvedValue(unlistenCheckUpdates);

    const { unmount } = renderHook(() => useTraySync());
    
    // Wait for async setup
    await new Promise(resolve => setTimeout(resolve, 0));
    
    unmount();

    expect(unlistenNavigate).toHaveBeenCalled();
    expect(unlistenCheckUpdates).toHaveBeenCalled();
  });
});

describe('updateTrayDownloadCount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update tray download count', async () => {
    mockTraySetActiveDownloads.mockResolvedValue(undefined);

    await updateTrayDownloadCount(5);

    expect(mockTraySetActiveDownloads).toHaveBeenCalledWith(5);
  });

  it('should handle zero downloads', async () => {
    mockTraySetActiveDownloads.mockResolvedValue(undefined);

    await updateTrayDownloadCount(0);

    expect(mockTraySetActiveDownloads).toHaveBeenCalledWith(0);
  });
});

describe('updateTrayHasUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update tray has update flag', async () => {
    mockTraySetHasUpdate.mockResolvedValue(undefined);

    await updateTrayHasUpdate(true);

    expect(mockTraySetHasUpdate).toHaveBeenCalledWith(true);
  });

  it('should set no update available', async () => {
    mockTraySetHasUpdate.mockResolvedValue(undefined);

    await updateTrayHasUpdate(false);

    expect(mockTraySetHasUpdate).toHaveBeenCalledWith(false);
  });
});
