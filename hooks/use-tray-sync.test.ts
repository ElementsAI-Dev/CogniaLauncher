import { renderHook } from '@testing-library/react';
import { useTraySync, updateTrayDownloadCount, updateTrayHasUpdate } from './use-tray-sync';

// Mock Tauri APIs
const mockTraySetLanguage = jest.fn();
const mockTrayRebuild = jest.fn();
const mockListenNavigate = jest.fn();
const mockListenCheckUpdates = jest.fn();
const mockTraySetActiveDownloads = jest.fn();
const mockTraySetHasUpdate = jest.fn();

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
  listenDownloadPauseAll: jest.fn().mockResolvedValue(() => {}),
  listenDownloadResumeAll: jest.fn().mockResolvedValue(() => {}),
  listenToggleAlwaysOnTop: jest.fn().mockResolvedValue(() => {}),
  traySetActiveDownloads: (...args: unknown[]) => {
    mockTraySetActiveDownloads(...args);
    return Promise.resolve();
  },
  traySetHasUpdate: (...args: unknown[]) => {
    mockTraySetHasUpdate(...args);
    return Promise.resolve();
  },
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
  });

  it('should setup tray sync on mount', async () => {
    renderHook(() => useTraySync());

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockTraySetLanguage).toHaveBeenCalledWith('en');
    expect(mockTrayRebuild).toHaveBeenCalled();
  });

  it('should setup navigation listener', () => {
    renderHook(() => useTraySync());

    expect(mockListenNavigate).toHaveBeenCalled();
  });

  it('should setup check updates listener', () => {
    renderHook(() => useTraySync());

    expect(mockListenCheckUpdates).toHaveBeenCalled();
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
