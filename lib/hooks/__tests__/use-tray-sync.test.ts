import { renderHook, waitFor } from '@testing-library/react';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: jest.fn(() => ({
    locale: 'en',
  })),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(),
  traySetLanguage: jest.fn(),
  traySetActiveDownloads: jest.fn(),
  traySetHasUpdate: jest.fn(),
  trayRebuild: jest.fn(),
  listenNavigate: jest.fn(),
  listenCheckUpdates: jest.fn(),
}));

import { useTraySync, updateTrayDownloadCount, updateTrayHasUpdate } from '../use-tray-sync';
import { useLocale } from '@/components/providers/locale-provider';
import { useRouter } from 'next/navigation';
import * as tauriLib from '@/lib/tauri';

const mockedUseLocale = jest.mocked(useLocale);
const mockedUseRouter = jest.mocked(useRouter);
const mockedTauri = jest.mocked(tauriLib);

describe('useTraySync', () => {
  const mockRouterPush = jest.fn();
  let navigateCallback: ((path: string) => void) | null = null;
  let checkUpdatesCallback: (() => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    navigateCallback = null;
    checkUpdatesCallback = null;

    mockedUseLocale.mockReturnValue({ locale: 'en' } as ReturnType<typeof useLocale>);
    mockedUseRouter.mockReturnValue({ push: mockRouterPush } as unknown as ReturnType<typeof useRouter>);
    mockedTauri.isTauri.mockReturnValue(false);
    mockedTauri.traySetLanguage.mockResolvedValue(undefined);
    mockedTauri.trayRebuild.mockResolvedValue(undefined);
    mockedTauri.listenNavigate.mockImplementation((cb) => {
      navigateCallback = cb;
      return Promise.resolve(jest.fn());
    });
    mockedTauri.listenCheckUpdates.mockImplementation((cb) => {
      checkUpdatesCallback = cb;
      return Promise.resolve(jest.fn());
    });
  });

  it('does nothing when not in Tauri environment', () => {
    mockedTauri.isTauri.mockReturnValue(false);

    renderHook(() => useTraySync());

    expect(mockedTauri.traySetLanguage).not.toHaveBeenCalled();
    expect(mockedTauri.listenNavigate).not.toHaveBeenCalled();
    expect(mockedTauri.listenCheckUpdates).not.toHaveBeenCalled();
  });

  it('syncs tray language when locale is en', async () => {
    mockedTauri.isTauri.mockReturnValue(true);
    mockedUseLocale.mockReturnValue({ locale: 'en' } as ReturnType<typeof useLocale>);

    renderHook(() => useTraySync());

    await waitFor(() => {
      expect(mockedTauri.traySetLanguage).toHaveBeenCalledWith('en');
    });
  });

  it('syncs tray language when locale is zh', async () => {
    mockedTauri.isTauri.mockReturnValue(true);
    mockedUseLocale.mockReturnValue({ locale: 'zh' } as ReturnType<typeof useLocale>);

    renderHook(() => useTraySync());

    await waitFor(() => {
      expect(mockedTauri.traySetLanguage).toHaveBeenCalledWith('zh');
    });
  });

  it('rebuilds tray after setting language', async () => {
    mockedTauri.isTauri.mockReturnValue(true);

    renderHook(() => useTraySync());

    await waitFor(() => {
      expect(mockedTauri.trayRebuild).toHaveBeenCalled();
    });
  });

  it('registers navigation listener', async () => {
    mockedTauri.isTauri.mockReturnValue(true);

    renderHook(() => useTraySync());

    await waitFor(() => {
      expect(mockedTauri.listenNavigate).toHaveBeenCalled();
    });
  });

  it('navigates when navigation event received', async () => {
    mockedTauri.isTauri.mockReturnValue(true);

    renderHook(() => useTraySync());

    await waitFor(() => {
      expect(navigateCallback).not.toBeNull();
    });

    navigateCallback!('/settings');

    expect(mockRouterPush).toHaveBeenCalledWith('/settings');
  });

  it('registers check-updates listener', async () => {
    mockedTauri.isTauri.mockReturnValue(true);

    renderHook(() => useTraySync());

    await waitFor(() => {
      expect(mockedTauri.listenCheckUpdates).toHaveBeenCalled();
    });
  });

  it('navigates to about page when check-updates event received', async () => {
    mockedTauri.isTauri.mockReturnValue(true);

    renderHook(() => useTraySync());

    await waitFor(() => {
      expect(checkUpdatesCallback).not.toBeNull();
    });

    checkUpdatesCallback!();

    expect(mockRouterPush).toHaveBeenCalledWith('/about');
  });

  it('cleans up listeners on unmount', async () => {
    mockedTauri.isTauri.mockReturnValue(true);
    const unlistenNavigate = jest.fn();
    const unlistenCheckUpdates = jest.fn();

    mockedTauri.listenNavigate.mockResolvedValue(unlistenNavigate);
    mockedTauri.listenCheckUpdates.mockResolvedValue(unlistenCheckUpdates);

    const { unmount } = renderHook(() => useTraySync());

    await waitFor(() => {
      expect(mockedTauri.listenNavigate).toHaveBeenCalled();
    });

    unmount();

    expect(unlistenNavigate).toHaveBeenCalled();
    expect(unlistenCheckUpdates).toHaveBeenCalled();
  });

  it('handles tray sync errors gracefully', async () => {
    mockedTauri.isTauri.mockReturnValue(true);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedTauri.traySetLanguage.mockRejectedValue(new Error('Tray error'));

    renderHook(() => useTraySync());

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });
});

describe('updateTrayDownloadCount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedTauri.isTauri.mockReturnValue(false);
    mockedTauri.traySetActiveDownloads.mockResolvedValue(undefined);
  });

  it('does nothing when not in Tauri environment', async () => {
    mockedTauri.isTauri.mockReturnValue(false);

    await updateTrayDownloadCount(5);

    expect(mockedTauri.traySetActiveDownloads).not.toHaveBeenCalled();
  });

  it('sets active downloads count in Tauri environment', async () => {
    mockedTauri.isTauri.mockReturnValue(true);

    await updateTrayDownloadCount(5);

    expect(mockedTauri.traySetActiveDownloads).toHaveBeenCalledWith(5);
  });

  it('handles errors gracefully', async () => {
    mockedTauri.isTauri.mockReturnValue(true);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedTauri.traySetActiveDownloads.mockRejectedValue(new Error('Tray error'));

    await updateTrayDownloadCount(5);

    expect(consoleSpy).toHaveBeenCalledWith('Failed to update tray download count:', expect.any(Error));
    consoleSpy.mockRestore();
  });
});

describe('updateTrayHasUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedTauri.isTauri.mockReturnValue(false);
    mockedTauri.traySetHasUpdate.mockResolvedValue(undefined);
  });

  it('does nothing when not in Tauri environment', async () => {
    mockedTauri.isTauri.mockReturnValue(false);

    await updateTrayHasUpdate(true);

    expect(mockedTauri.traySetHasUpdate).not.toHaveBeenCalled();
  });

  it('sets has update state in Tauri environment', async () => {
    mockedTauri.isTauri.mockReturnValue(true);

    await updateTrayHasUpdate(true);

    expect(mockedTauri.traySetHasUpdate).toHaveBeenCalledWith(true);
  });

  it('can set update state to false', async () => {
    mockedTauri.isTauri.mockReturnValue(true);

    await updateTrayHasUpdate(false);

    expect(mockedTauri.traySetHasUpdate).toHaveBeenCalledWith(false);
  });

  it('handles errors gracefully', async () => {
    mockedTauri.isTauri.mockReturnValue(true);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedTauri.traySetHasUpdate.mockRejectedValue(new Error('Tray error'));

    await updateTrayHasUpdate(true);

    expect(consoleSpy).toHaveBeenCalledWith('Failed to update tray update state:', expect.any(Error));
    consoleSpy.mockRestore();
  });
});
