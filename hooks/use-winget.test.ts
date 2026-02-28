import { renderHook, act } from '@testing-library/react';
import { useWinget } from './use-winget';

// Mock Tauri APIs
const mockWingetPinList = jest.fn();
const mockWingetPinAdd = jest.fn();
const mockWingetPinRemove = jest.fn();
const mockWingetPinReset = jest.fn();
const mockWingetSourceList = jest.fn();
const mockWingetSourceAdd = jest.fn();
const mockWingetSourceRemove = jest.fn();
const mockWingetSourceReset = jest.fn();
const mockWingetExport = jest.fn();
const mockWingetImport = jest.fn();
const mockWingetRepair = jest.fn();
const mockWingetDownload = jest.fn();
const mockWingetGetInfo = jest.fn();
const mockWingetInstallAdvanced = jest.fn();

jest.mock('@/lib/tauri', () => ({
  wingetPinList: (...args: unknown[]) => mockWingetPinList(...args),
  wingetPinAdd: (...args: unknown[]) => mockWingetPinAdd(...args),
  wingetPinRemove: (...args: unknown[]) => mockWingetPinRemove(...args),
  wingetPinReset: (...args: unknown[]) => mockWingetPinReset(...args),
  wingetSourceList: (...args: unknown[]) => mockWingetSourceList(...args),
  wingetSourceAdd: (...args: unknown[]) => mockWingetSourceAdd(...args),
  wingetSourceRemove: (...args: unknown[]) => mockWingetSourceRemove(...args),
  wingetSourceReset: (...args: unknown[]) => mockWingetSourceReset(...args),
  wingetExport: (...args: unknown[]) => mockWingetExport(...args),
  wingetImport: (...args: unknown[]) => mockWingetImport(...args),
  wingetRepair: (...args: unknown[]) => mockWingetRepair(...args),
  wingetDownload: (...args: unknown[]) => mockWingetDownload(...args),
  wingetGetInfo: (...args: unknown[]) => mockWingetGetInfo(...args),
  wingetInstallAdvanced: (...args: unknown[]) => mockWingetInstallAdvanced(...args),
}));

describe('useWinget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return initial state', () => {
    const { result } = renderHook(() => useWinget());

    expect(result.current.pins).toEqual([]);
    expect(result.current.sources).toEqual([]);
    expect(result.current.info).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  // ── Pin management ──────────────────────────────────────────────────

  describe('fetchPins', () => {
    it('should fetch and set pins', async () => {
      const mockPins = [
        { name: 'PowerToys', id: 'Microsoft.PowerToys', version: '0.75.1', source: 'winget', pinType: 'Pinning' },
      ];
      mockWingetPinList.mockResolvedValue(mockPins);

      const { result } = renderHook(() => useWinget());

      await act(async () => {
        await result.current.fetchPins();
      });

      expect(mockWingetPinList).toHaveBeenCalledTimes(1);
      expect(result.current.pins).toEqual(mockPins);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should set error on failure', async () => {
      mockWingetPinList.mockRejectedValue(new Error('winget not available'));

      const { result } = renderHook(() => useWinget());

      await act(async () => {
        try {
          await result.current.fetchPins();
        } catch {
          // expected
        }
      });

      expect(result.current.error).toBe('winget not available');
      expect(result.current.loading).toBe(false);
    });
  });

  describe('addPin', () => {
    it('should add a pin and refresh the list', async () => {
      const pinsAfter = [
        { name: 'VS Code', id: 'Microsoft.VSCode', version: '1.85.0', source: 'winget', pinType: 'Blocking' },
      ];
      mockWingetPinAdd.mockResolvedValue(undefined);
      mockWingetPinList.mockResolvedValue(pinsAfter);

      const { result } = renderHook(() => useWinget());

      await act(async () => {
        await result.current.addPin('Microsoft.VSCode', '1.85.0', true);
      });

      expect(mockWingetPinAdd).toHaveBeenCalledWith('Microsoft.VSCode', '1.85.0', true);
      expect(mockWingetPinList).toHaveBeenCalledTimes(1);
      expect(result.current.pins).toEqual(pinsAfter);
    });
  });

  describe('removePin', () => {
    it('should remove a pin and refresh the list', async () => {
      mockWingetPinRemove.mockResolvedValue(undefined);
      mockWingetPinList.mockResolvedValue([]);

      const { result } = renderHook(() => useWinget());

      await act(async () => {
        await result.current.removePin('Microsoft.PowerToys');
      });

      expect(mockWingetPinRemove).toHaveBeenCalledWith('Microsoft.PowerToys');
      expect(result.current.pins).toEqual([]);
    });
  });

  describe('resetPins', () => {
    it('should reset all pins and clear the list', async () => {
      mockWingetPinReset.mockResolvedValue(undefined);

      const { result } = renderHook(() => useWinget());

      await act(async () => {
        await result.current.resetPins();
      });

      expect(mockWingetPinReset).toHaveBeenCalledTimes(1);
      expect(result.current.pins).toEqual([]);
    });
  });

  // ── Source management ─────────────────────────────────────────────────

  describe('fetchSources', () => {
    it('should fetch and set sources', async () => {
      const mockSources = [
        { name: 'winget', argument: 'https://cdn.winget.microsoft.com/cache', sourceType: '', updated: '' },
      ];
      mockWingetSourceList.mockResolvedValue(mockSources);

      const { result } = renderHook(() => useWinget());

      await act(async () => {
        await result.current.fetchSources();
      });

      expect(mockWingetSourceList).toHaveBeenCalledTimes(1);
      expect(result.current.sources).toEqual(mockSources);
    });
  });

  describe('addSource', () => {
    it('should add a source and refresh the list', async () => {
      const sourcesAfter = [
        { name: 'winget', argument: 'https://cdn.winget.microsoft.com/cache', sourceType: '', updated: '' },
        { name: 'contoso', argument: 'https://packages.contoso.local', sourceType: '', updated: '' },
      ];
      mockWingetSourceAdd.mockResolvedValue(undefined);
      mockWingetSourceList.mockResolvedValue(sourcesAfter);

      const { result } = renderHook(() => useWinget());

      await act(async () => {
        await result.current.addSource('contoso', 'https://packages.contoso.local');
      });

      expect(mockWingetSourceAdd).toHaveBeenCalledWith('contoso', 'https://packages.contoso.local', undefined);
      expect(result.current.sources).toEqual(sourcesAfter);
    });
  });

  describe('removeSource', () => {
    it('should remove a source and refresh the list', async () => {
      mockWingetSourceRemove.mockResolvedValue(undefined);
      mockWingetSourceList.mockResolvedValue([]);

      const { result } = renderHook(() => useWinget());

      await act(async () => {
        await result.current.removeSource('contoso');
      });

      expect(mockWingetSourceRemove).toHaveBeenCalledWith('contoso');
    });
  });

  describe('resetSources', () => {
    it('should reset sources and refresh the list', async () => {
      const defaultSources = [
        { name: 'winget', argument: 'https://cdn.winget.microsoft.com/cache', sourceType: '', updated: '' },
      ];
      mockWingetSourceReset.mockResolvedValue(undefined);
      mockWingetSourceList.mockResolvedValue(defaultSources);

      const { result } = renderHook(() => useWinget());

      await act(async () => {
        await result.current.resetSources();
      });

      expect(mockWingetSourceReset).toHaveBeenCalledTimes(1);
      expect(result.current.sources).toEqual(defaultSources);
    });
  });

  // ── Export / Import ───────────────────────────────────────────────────

  describe('exportPackages', () => {
    it('should call wingetExport with correct params', async () => {
      mockWingetExport.mockResolvedValue(undefined);

      const { result } = renderHook(() => useWinget());

      await act(async () => {
        await result.current.exportPackages('C:\\export.json', true);
      });

      expect(mockWingetExport).toHaveBeenCalledWith('C:\\export.json', true);
    });
  });

  describe('importPackages', () => {
    it('should call wingetImport and return output', async () => {
      mockWingetImport.mockResolvedValue('Imported 10 packages');

      const { result } = renderHook(() => useWinget());

      let output = '';
      await act(async () => {
        output = await result.current.importPackages('C:\\export.json', true, false);
      });

      expect(mockWingetImport).toHaveBeenCalledWith('C:\\export.json', true, false);
      expect(output).toBe('Imported 10 packages');
    });
  });

  // ── Repair ────────────────────────────────────────────────────────────

  describe('repairPackage', () => {
    it('should call wingetRepair with the package id', async () => {
      mockWingetRepair.mockResolvedValue(undefined);

      const { result } = renderHook(() => useWinget());

      await act(async () => {
        await result.current.repairPackage('Microsoft.PowerToys');
      });

      expect(mockWingetRepair).toHaveBeenCalledWith('Microsoft.PowerToys');
    });

    it('should set error on failure', async () => {
      mockWingetRepair.mockRejectedValue(new Error('repair failed'));

      const { result } = renderHook(() => useWinget());

      await act(async () => {
        try {
          await result.current.repairPackage('Microsoft.PowerToys');
        } catch {
          // expected
        }
      });

      expect(result.current.error).toBe('repair failed');
    });
  });

  // ── Download ──────────────────────────────────────────────────────────

  describe('downloadInstaller', () => {
    it('should call wingetDownload and return output', async () => {
      mockWingetDownload.mockResolvedValue('Downloaded to C:\\Downloads\\installer.exe');

      const { result } = renderHook(() => useWinget());

      let output = '';
      await act(async () => {
        output = await result.current.downloadInstaller('Microsoft.PowerToys', '0.75.1', 'C:\\Downloads');
      });

      expect(mockWingetDownload).toHaveBeenCalledWith('Microsoft.PowerToys', '0.75.1', 'C:\\Downloads');
      expect(output).toBe('Downloaded to C:\\Downloads\\installer.exe');
    });
  });

  // ── Info ──────────────────────────────────────────────────────────────

  describe('fetchInfo', () => {
    it('should fetch and set winget info', async () => {
      const mockInfo = {
        version: '1.8.1911',
        logsDir: 'C:\\Users\\test\\AppData\\Local\\Packages\\logs',
        isAdmin: false,
        sources: [
          { name: 'winget', argument: 'https://cdn.winget.microsoft.com/cache', sourceType: '', updated: '' },
        ],
      };
      mockWingetGetInfo.mockResolvedValue(mockInfo);

      const { result } = renderHook(() => useWinget());

      await act(async () => {
        await result.current.fetchInfo();
      });

      expect(mockWingetGetInfo).toHaveBeenCalledTimes(1);
      expect(result.current.info).toEqual(mockInfo);
    });
  });

  // ── Advanced install ──────────────────────────────────────────────────

  describe('installAdvanced', () => {
    it('should call wingetInstallAdvanced with all options', async () => {
      mockWingetInstallAdvanced.mockResolvedValue('Successfully installed');

      const { result } = renderHook(() => useWinget());

      const options = {
        id: 'Microsoft.PowerToys',
        version: '0.75.1',
        scope: 'user' as const,
        architecture: 'x64' as const,
        locale: 'en-US',
        location: 'C:\\Tools',
        force: true,
      };

      let output = '';
      await act(async () => {
        output = await result.current.installAdvanced(options);
      });

      expect(mockWingetInstallAdvanced).toHaveBeenCalledWith(options);
      expect(output).toBe('Successfully installed');
    });

    it('should call wingetInstallAdvanced with minimal options', async () => {
      mockWingetInstallAdvanced.mockResolvedValue('Done');

      const { result } = renderHook(() => useWinget());

      await act(async () => {
        await result.current.installAdvanced({ id: 'Git.Git' });
      });

      expect(mockWingetInstallAdvanced).toHaveBeenCalledWith({ id: 'Git.Git' });
    });
  });

  // ── Loading state ─────────────────────────────────────────────────────

  describe('loading state', () => {
    it('should set loading to true during async operation', async () => {
      let resolvePromise: (value: unknown[]) => void;
      const pendingPromise = new Promise<unknown[]>((resolve) => {
        resolvePromise = resolve;
      });
      mockWingetPinList.mockReturnValue(pendingPromise);

      const { result } = renderHook(() => useWinget());

      let fetchPromise: Promise<void>;
      act(() => {
        fetchPromise = result.current.fetchPins();
      });

      // Loading should be true while the promise is pending
      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolvePromise!([]);
        await fetchPromise!;
      });

      expect(result.current.loading).toBe(false);
    });
  });
});
