import { renderHook, act } from '@testing-library/react';
import { useAboutData } from './use-about-data';

// Mock app version
jest.mock('@/lib/app-version', () => ({
  APP_VERSION: '1.0.0',
}));

// Mock sonner toast
const mockToastError = jest.fn();
const mockToastSuccess = jest.fn();
jest.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

// Mock Tauri APIs
const mockIsTauri = jest.fn(() => false);
const mockSelfCheckUpdate = jest.fn();
const mockSelfUpdate = jest.fn();
const mockGetPlatformInfo = jest.fn();
const mockGetCogniaDir = jest.fn();
const mockListenSelfUpdateProgress = jest.fn();

jest.mock('@/lib/platform', () => ({
  isTauri: () => mockIsTauri(),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  selfCheckUpdate: (...args: unknown[]) => mockSelfCheckUpdate(...args),
  selfUpdate: (...args: unknown[]) => mockSelfUpdate(...args),
  getPlatformInfo: (...args: unknown[]) => mockGetPlatformInfo(...args),
  getCogniaDir: (...args: unknown[]) => mockGetCogniaDir(...args),
  listenSelfUpdateProgress: (...args: unknown[]) => mockListenSelfUpdateProgress(...args),
  providerStatusAll: jest.fn().mockResolvedValue([]),
  getCombinedCacheStats: jest.fn().mockResolvedValue({ internalSizeHuman: '0 B', externalSizeHuman: '0 B', totalSizeHuman: '0 B' }),
  logGetTotalSize: jest.fn().mockResolvedValue(0),
}));

describe('useAboutData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
  });

  describe('web mode (non-Tauri)', () => {
    it('should return initial state with web defaults', async () => {
      const { result } = renderHook(() => useAboutData('en'));

      // Wait for effects
      await act(async () => {});

      expect(result.current.isDesktop).toBe(false);
      expect(result.current.loading).toBe(false);
      expect(result.current.systemLoading).toBe(false);
      expect(result.current.systemInfo).not.toBeNull();
      expect(result.current.systemInfo?.os).toBe('Web');
      expect(result.current.systemInfo?.arch).toBe('Browser');
      expect(result.current.systemInfo?.appVersion).toBe('1.0.0');
    });

    it('should set updateInfo with no update available in web mode', async () => {
      const { result } = renderHook(() => useAboutData('en'));

      await act(async () => {});

      expect(result.current.updateInfo).not.toBeNull();
      expect(result.current.updateInfo?.update_available).toBe(false);
      expect(result.current.updateInfo?.current_version).toBe('1.0.0');
    });

    it('should set locale to en-US for English', async () => {
      const { result } = renderHook(() => useAboutData('en'));

      await act(async () => {});

      expect(result.current.systemInfo?.locale).toBe('en-US');
    });

    it('should set locale to zh-CN for Chinese', async () => {
      const { result } = renderHook(() => useAboutData('zh'));

      await act(async () => {});

      expect(result.current.systemInfo?.locale).toBe('zh-CN');
    });

    it('should show toast error when handleUpdate is called in web mode', async () => {
      const { result } = renderHook(() => useAboutData('en'));
      const t = (key: string) => key;

      await act(async () => {
        await result.current.handleUpdate(t);
      });

      expect(mockToastError).toHaveBeenCalledWith('about.updateDesktopOnly');
    });
  });

  describe('desktop mode (Tauri)', () => {
    beforeEach(() => {
      mockIsTauri.mockReturnValue(true);
      mockListenSelfUpdateProgress.mockResolvedValue(jest.fn());
    });

    it('should set isDesktop to true', async () => {
      mockSelfCheckUpdate.mockResolvedValue({
        current_version: '1.0.0',
        latest_version: '1.0.0',
        update_available: false,
        release_notes: null,
      });
      mockGetPlatformInfo.mockResolvedValue({
        os: 'windows',
        arch: 'x86_64',
        osVersion: '10.0',
        osLongVersion: 'Windows 10',
        kernelVersion: '10.0.19041',
        hostname: 'test-pc',
        osName: 'Windows',
        distributionId: '',
        cpuArch: 'x86_64',
        cpuModel: 'Intel i7',
        cpuVendorId: 'GenuineIntel',
        cpuFrequency: 3600,
        cpuCores: 8,
        physicalCoreCount: 4,
        globalCpuUsage: 10,
        totalMemory: 16000000000,
        availableMemory: 8000000000,
        usedMemory: 8000000000,
        totalSwap: 0,
        usedSwap: 0,
        uptime: 3600,
        bootTime: 1700000000,
        loadAverage: [0, 0, 0],
        gpus: [],
        appVersion: '1.0.0',
      });
      mockGetCogniaDir.mockResolvedValue('C:\\Users\\test\\.cognia');

      const { result } = renderHook(() => useAboutData('en'));

      await act(async () => {});

      expect(result.current.isDesktop).toBe(true);
    });

    it('should check for updates and set updateInfo', async () => {
      const updateData = {
        current_version: '1.0.0',
        latest_version: '1.1.0',
        update_available: true,
        release_notes: 'New features',
      };
      mockSelfCheckUpdate.mockResolvedValue(updateData);
      mockGetPlatformInfo.mockResolvedValue({
        os: 'windows', arch: 'x86_64', osVersion: '', osLongVersion: '',
        kernelVersion: '', hostname: '', osName: '', distributionId: '',
        cpuArch: '', cpuModel: '', cpuVendorId: '', cpuFrequency: 0,
        cpuCores: 0, physicalCoreCount: null, globalCpuUsage: 0,
        totalMemory: 0, availableMemory: 0, usedMemory: 0,
        totalSwap: 0, usedSwap: 0, uptime: 0, bootTime: 0,
        loadAverage: [0, 0, 0], gpus: [], appVersion: '1.0.0',
      });
      mockGetCogniaDir.mockResolvedValue('/home/test/.cognia');

      const { result } = renderHook(() => useAboutData('en'));

      await act(async () => {});

      expect(mockSelfCheckUpdate).toHaveBeenCalled();
      expect(result.current.updateInfo?.update_available).toBe(true);
      expect(result.current.updateInfo?.latest_version).toBe('1.1.0');
    });

    it('should handle network error during update check', async () => {
      mockSelfCheckUpdate.mockRejectedValue(new Error('network error'));
      mockGetPlatformInfo.mockResolvedValue({
        os: 'windows', arch: 'x86_64', osVersion: '', osLongVersion: '',
        kernelVersion: '', hostname: '', osName: '', distributionId: '',
        cpuArch: '', cpuModel: '', cpuVendorId: '', cpuFrequency: 0,
        cpuCores: 0, physicalCoreCount: null, globalCpuUsage: 0,
        totalMemory: 0, availableMemory: 0, usedMemory: 0,
        totalSwap: 0, usedSwap: 0, uptime: 0, bootTime: 0,
        loadAverage: [0, 0, 0], gpus: [], appVersion: '1.0.0',
      });
      mockGetCogniaDir.mockResolvedValue('/home/test/.cognia');

      const { result } = renderHook(() => useAboutData('en'));

      await act(async () => {});

      expect(result.current.error).toBe('network_error');
    });

    it('should handle timeout error during update check', async () => {
      mockSelfCheckUpdate.mockRejectedValue(new Error('request timed out'));
      mockGetPlatformInfo.mockResolvedValue({
        os: 'windows', arch: 'x86_64', osVersion: '', osLongVersion: '',
        kernelVersion: '', hostname: '', osName: '', distributionId: '',
        cpuArch: '', cpuModel: '', cpuVendorId: '', cpuFrequency: 0,
        cpuCores: 0, physicalCoreCount: null, globalCpuUsage: 0,
        totalMemory: 0, availableMemory: 0, usedMemory: 0,
        totalSwap: 0, usedSwap: 0, uptime: 0, bootTime: 0,
        loadAverage: [0, 0, 0], gpus: [], appVersion: '1.0.0',
      });
      mockGetCogniaDir.mockResolvedValue('/home/test/.cognia');

      const { result } = renderHook(() => useAboutData('en'));

      await act(async () => {});

      expect(result.current.error).toBe('timeout_error');
    });

    it('should handle generic error during update check', async () => {
      mockSelfCheckUpdate.mockRejectedValue(new Error('something broke'));
      mockGetPlatformInfo.mockResolvedValue({
        os: 'windows', arch: 'x86_64', osVersion: '', osLongVersion: '',
        kernelVersion: '', hostname: '', osName: '', distributionId: '',
        cpuArch: '', cpuModel: '', cpuVendorId: '', cpuFrequency: 0,
        cpuCores: 0, physicalCoreCount: null, globalCpuUsage: 0,
        totalMemory: 0, availableMemory: 0, usedMemory: 0,
        totalSwap: 0, usedSwap: 0, uptime: 0, bootTime: 0,
        loadAverage: [0, 0, 0], gpus: [], appVersion: '1.0.0',
      });
      mockGetCogniaDir.mockResolvedValue('/home/test/.cognia');

      const { result } = renderHook(() => useAboutData('en'));

      await act(async () => {});

      expect(result.current.error).toBe('update_check_failed');
    });

    it('should load system info from backend', async () => {
      mockSelfCheckUpdate.mockResolvedValue({
        current_version: '1.0.0', latest_version: '1.0.0',
        update_available: false, release_notes: null,
      });
      mockGetPlatformInfo.mockResolvedValue({
        os: 'windows', arch: 'x86_64', osVersion: '10.0',
        osLongVersion: 'Windows 10 Pro', kernelVersion: '10.0.19041',
        hostname: 'my-pc', osName: 'Windows', distributionId: '',
        cpuArch: 'x86_64', cpuModel: 'AMD Ryzen 9', cpuVendorId: 'AuthenticAMD',
        cpuFrequency: 4500, cpuCores: 16, physicalCoreCount: 8,
        globalCpuUsage: 20, totalMemory: 32000000000, availableMemory: 16000000000,
        usedMemory: 16000000000, totalSwap: 8000000000, usedSwap: 2000000000,
        uptime: 7200, bootTime: 1700000000, loadAverage: [0, 0, 0],
        gpus: [], appVersion: '1.0.0',
      });
      mockGetCogniaDir.mockResolvedValue('C:\\Users\\test\\.cognia');

      const { result } = renderHook(() => useAboutData('en'));

      await act(async () => {});

      expect(result.current.systemInfo?.os).toBe('windows');
      expect(result.current.systemInfo?.cpuCores).toBe(16);
      expect(result.current.systemInfo?.homeDir).toBe('C:\\Users\\test\\.cognia');
    });

    it('should handle system info load failure', async () => {
      mockSelfCheckUpdate.mockResolvedValue({
        current_version: '1.0.0', latest_version: '1.0.0',
        update_available: false, release_notes: null,
      });
      mockGetPlatformInfo.mockRejectedValue(new Error('fail'));
      mockGetCogniaDir.mockResolvedValue('/tmp');

      const { result } = renderHook(() => useAboutData('en'));

      await act(async () => {});

      expect(result.current.systemError).toBe('system_info_failed');
      expect(result.current.systemInfo?.os).toBe('Unknown');
    });

    it('should perform update successfully', async () => {
      mockSelfCheckUpdate.mockResolvedValue({
        current_version: '1.0.0', latest_version: '1.1.0',
        update_available: true, release_notes: null,
      });
      mockSelfUpdate.mockResolvedValue(undefined);
      mockGetPlatformInfo.mockResolvedValue({
        os: 'windows', arch: 'x86_64', osVersion: '', osLongVersion: '',
        kernelVersion: '', hostname: '', osName: '', distributionId: '',
        cpuArch: '', cpuModel: '', cpuVendorId: '', cpuFrequency: 0,
        cpuCores: 0, physicalCoreCount: null, globalCpuUsage: 0,
        totalMemory: 0, availableMemory: 0, usedMemory: 0,
        totalSwap: 0, usedSwap: 0, uptime: 0, bootTime: 0,
        loadAverage: [0, 0, 0], gpus: [], appVersion: '1.0.0',
      });
      mockGetCogniaDir.mockResolvedValue('/tmp');

      const { result } = renderHook(() => useAboutData('en'));
      const t = (key: string) => key;

      await act(async () => {});

      await act(async () => {
        await result.current.handleUpdate(t);
      });

      expect(mockSelfUpdate).toHaveBeenCalled();
      expect(result.current.updateStatus).toBe('done');
      expect(mockToastSuccess).toHaveBeenCalled();
    });

    it('should handle update failure', async () => {
      mockSelfCheckUpdate.mockResolvedValue({
        current_version: '1.0.0', latest_version: '1.1.0',
        update_available: true, release_notes: null,
      });
      mockSelfUpdate.mockRejectedValue(new Error('Update failed'));
      mockGetPlatformInfo.mockResolvedValue({
        os: 'windows', arch: 'x86_64', osVersion: '', osLongVersion: '',
        kernelVersion: '', hostname: '', osName: '', distributionId: '',
        cpuArch: '', cpuModel: '', cpuVendorId: '', cpuFrequency: 0,
        cpuCores: 0, physicalCoreCount: null, globalCpuUsage: 0,
        totalMemory: 0, availableMemory: 0, usedMemory: 0,
        totalSwap: 0, usedSwap: 0, uptime: 0, bootTime: 0,
        loadAverage: [0, 0, 0], gpus: [], appVersion: '1.0.0',
      });
      mockGetCogniaDir.mockResolvedValue('/tmp');

      const { result } = renderHook(() => useAboutData('en'));
      const t = (key: string) => key;

      await act(async () => {});

      await act(async () => {
        await result.current.handleUpdate(t);
      });

      expect(result.current.updateStatus).toBe('error');
      expect(mockToastError).toHaveBeenCalled();
    });

    it('should clear error', async () => {
      mockSelfCheckUpdate.mockRejectedValue(new Error('network error'));
      mockGetPlatformInfo.mockResolvedValue({
        os: 'windows', arch: 'x86_64', osVersion: '', osLongVersion: '',
        kernelVersion: '', hostname: '', osName: '', distributionId: '',
        cpuArch: '', cpuModel: '', cpuVendorId: '', cpuFrequency: 0,
        cpuCores: 0, physicalCoreCount: null, globalCpuUsage: 0,
        totalMemory: 0, availableMemory: 0, usedMemory: 0,
        totalSwap: 0, usedSwap: 0, uptime: 0, bootTime: 0,
        loadAverage: [0, 0, 0], gpus: [], appVersion: '1.0.0',
      });
      mockGetCogniaDir.mockResolvedValue('/tmp');

      const { result } = renderHook(() => useAboutData('en'));

      await act(async () => {});

      expect(result.current.error).toBe('network_error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
