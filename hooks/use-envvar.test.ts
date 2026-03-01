import { renderHook, act } from '@testing-library/react';
import { useEnvVar } from './use-envvar';

// Mock tauri module
const mockEnvvarListAll = jest.fn();
const mockEnvvarGet = jest.fn();
const mockEnvvarSetProcess = jest.fn();
const mockEnvvarRemoveProcess = jest.fn();
const mockEnvvarGetPath = jest.fn();
const mockEnvvarListShellProfiles = jest.fn();
const mockEnvvarImportEnvFile = jest.fn();
const mockEnvvarExportEnvFile = jest.fn();
const mockEnvvarListPersistent = jest.fn();
const mockEnvvarExpand = jest.fn();
const mockEnvvarDeduplicatePath = jest.fn();
const mockEnvvarListPersistentTyped = jest.fn();
const mockEnvvarDetectConflicts = jest.fn();
const mockEnvvarAddPathEntry = jest.fn();
const mockEnvvarRemovePathEntry = jest.fn();
const mockEnvvarReorderPath = jest.fn();
const mockEnvvarReadShellProfile = jest.fn();
const mockEnvvarSetPersistent = jest.fn();
const mockEnvvarRemovePersistent = jest.fn();

jest.mock('@/lib/tauri', () => ({
  envvarListAll: (...args: unknown[]) => mockEnvvarListAll(...args),
  envvarGet: (...args: unknown[]) => mockEnvvarGet(...args),
  envvarSetProcess: (...args: unknown[]) => mockEnvvarSetProcess(...args),
  envvarRemoveProcess: (...args: unknown[]) => mockEnvvarRemoveProcess(...args),
  envvarSetPersistent: (...args: unknown[]) => mockEnvvarSetPersistent(...args),
  envvarRemovePersistent: (...args: unknown[]) => mockEnvvarRemovePersistent(...args),
  envvarGetPath: (...args: unknown[]) => mockEnvvarGetPath(...args),
  envvarAddPathEntry: (...args: unknown[]) => mockEnvvarAddPathEntry(...args),
  envvarRemovePathEntry: (...args: unknown[]) => mockEnvvarRemovePathEntry(...args),
  envvarReorderPath: (...args: unknown[]) => mockEnvvarReorderPath(...args),
  envvarListShellProfiles: (...args: unknown[]) => mockEnvvarListShellProfiles(...args),
  envvarReadShellProfile: (...args: unknown[]) => mockEnvvarReadShellProfile(...args),
  envvarImportEnvFile: (...args: unknown[]) => mockEnvvarImportEnvFile(...args),
  envvarExportEnvFile: (...args: unknown[]) => mockEnvvarExportEnvFile(...args),
  envvarListPersistent: (...args: unknown[]) => mockEnvvarListPersistent(...args),
  envvarExpand: (...args: unknown[]) => mockEnvvarExpand(...args),
  envvarDeduplicatePath: (...args: unknown[]) => mockEnvvarDeduplicatePath(...args),
  envvarListPersistentTyped: (...args: unknown[]) => mockEnvvarListPersistentTyped(...args),
  envvarDetectConflicts: (...args: unknown[]) => mockEnvvarDetectConflicts(...args),
}));

jest.mock('@/lib/errors', () => ({
  formatError: (err: unknown) => String(err),
}));

describe('useEnvVar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useEnvVar());

    expect(result.current.envVars).toEqual({});
    expect(result.current.persistentVars).toEqual([]);
    expect(result.current.persistentVarsTyped).toEqual([]);
    expect(result.current.pathEntries).toEqual([]);
    expect(result.current.shellProfiles).toEqual([]);
    expect(result.current.conflicts).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should fetch all vars and update state', async () => {
    const mockVars = { PATH: '/usr/bin', HOME: '/home/user' };
    mockEnvvarListAll.mockResolvedValue(mockVars);

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.fetchAllVars();
    });

    expect(result.current.envVars).toEqual(mockVars);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle fetchAllVars error', async () => {
    mockEnvvarListAll.mockRejectedValue(new Error('fetch failed'));

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.fetchAllVars();
    });

    expect(result.current.envVars).toEqual({});
    expect(result.current.error).toBe('Error: fetch failed');
  });

  it('should get a specific var', async () => {
    mockEnvvarGet.mockResolvedValue('/usr/bin');

    const { result } = renderHook(() => useEnvVar());

    let value: string | null = null;
    await act(async () => {
      value = await result.current.getVar('PATH');
    });

    expect(value).toBe('/usr/bin');
    expect(mockEnvvarGet).toHaveBeenCalledWith('PATH');
  });

  it('should set a process var and update local state', async () => {
    mockEnvvarSetProcess.mockResolvedValue(undefined);

    const { result } = renderHook(() => useEnvVar());

    let success = false;
    await act(async () => {
      success = await result.current.setVar('MY_VAR', 'my_value', 'process');
    });

    expect(success).toBe(true);
    expect(mockEnvvarSetProcess).toHaveBeenCalledWith('MY_VAR', 'my_value');
    expect(result.current.envVars).toHaveProperty('MY_VAR', 'my_value');
  });

  it('should remove a process var and update local state', async () => {
    mockEnvvarListAll.mockResolvedValue({ FOO: 'bar', BAZ: 'qux' });
    mockEnvvarRemoveProcess.mockResolvedValue(undefined);

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.fetchAllVars();
    });

    await act(async () => {
      await result.current.removeVar('FOO', 'process');
    });

    expect(result.current.envVars).not.toHaveProperty('FOO');
    expect(result.current.envVars).toHaveProperty('BAZ', 'qux');
  });

  it('should fetch path entries', async () => {
    const mockEntries = [
      { path: '/usr/bin', exists: true, isDirectory: true },
      { path: '/missing', exists: false, isDirectory: false },
    ];
    mockEnvvarGetPath.mockResolvedValue(mockEntries);

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.fetchPath('process');
    });

    expect(result.current.pathEntries).toEqual(mockEntries);
    expect(mockEnvvarGetPath).toHaveBeenCalledWith('process');
  });

  it('should fetch shell profiles', async () => {
    const mockProfiles = [
      { shell: 'powershell', configPath: 'C:/profile.ps1', exists: true, isCurrent: true },
    ];
    mockEnvvarListShellProfiles.mockResolvedValue(mockProfiles);

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.fetchShellProfiles();
    });

    expect(result.current.shellProfiles).toEqual(mockProfiles);
  });

  it('should import env file', async () => {
    const mockResult = { imported: 3, skipped: 0, errors: [] };
    mockEnvvarImportEnvFile.mockResolvedValue(mockResult);

    const { result } = renderHook(() => useEnvVar());

    let importResult = null;
    await act(async () => {
      importResult = await result.current.importEnvFile('FOO=bar\nBAZ=qux\nHELLO=world', 'process');
    });

    expect(importResult).toEqual(mockResult);
    expect(mockEnvvarImportEnvFile).toHaveBeenCalledWith('FOO=bar\nBAZ=qux\nHELLO=world', 'process');
  });

  it('should export env file', async () => {
    const mockContent = 'FOO=bar\nBAZ=qux';
    mockEnvvarExportEnvFile.mockResolvedValue(mockContent);

    const { result } = renderHook(() => useEnvVar());

    let content = null;
    await act(async () => {
      content = await result.current.exportEnvFile('process', 'dotenv');
    });

    expect(content).toBe(mockContent);
    expect(mockEnvvarExportEnvFile).toHaveBeenCalledWith('process', 'dotenv');
  });

  it('should fetch persistent vars', async () => {
    const mockVars: [string, string][] = [['FOO', 'bar'], ['BAZ', 'qux']];
    mockEnvvarListPersistent.mockResolvedValue(mockVars);

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.fetchPersistentVars('user');
    });

    expect(result.current.persistentVars).toEqual(mockVars);
    expect(mockEnvvarListPersistent).toHaveBeenCalledWith('user');
  });

  it('should expand path', async () => {
    mockEnvvarExpand.mockResolvedValue('/home/user/test');

    const { result } = renderHook(() => useEnvVar());

    let expanded: string | null = null;
    await act(async () => {
      expanded = await result.current.expandPath('~/test');
    });

    expect(expanded).toBe('/home/user/test');
    expect(mockEnvvarExpand).toHaveBeenCalledWith('~/test');
  });

  it('should deduplicate path', async () => {
    mockEnvvarDeduplicatePath.mockResolvedValue(3);

    const { result } = renderHook(() => useEnvVar());

    let removed = 0;
    await act(async () => {
      removed = await result.current.deduplicatePath('user');
    });

    expect(removed).toBe(3);
    expect(mockEnvvarDeduplicatePath).toHaveBeenCalledWith('user');
  });

  it('should handle fetchPersistentVars error', async () => {
    mockEnvvarListPersistent.mockRejectedValue(new Error('registry access denied'));

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.fetchPersistentVars('system');
    });

    expect(result.current.persistentVars).toEqual([]);
    expect(result.current.error).toBe('Error: registry access denied');
  });

  it('should fetch persistent vars with type info', async () => {
    const mockTyped = [
      { key: 'PATH', value: 'C:\\Windows', regType: 'REG_EXPAND_SZ' },
      { key: 'FOO', value: 'bar', regType: 'REG_SZ' },
    ];
    mockEnvvarListPersistentTyped.mockResolvedValue(mockTyped);

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.fetchPersistentVarsTyped('user');
    });

    expect(result.current.persistentVarsTyped).toEqual(mockTyped);
    expect(mockEnvvarListPersistentTyped).toHaveBeenCalledWith('user');
  });

  it('should handle fetchPersistentVarsTyped error', async () => {
    mockEnvvarListPersistentTyped.mockRejectedValue(new Error('typed fetch failed'));

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.fetchPersistentVarsTyped('system');
    });

    expect(result.current.persistentVarsTyped).toEqual([]);
    expect(result.current.error).toBe('Error: typed fetch failed');
  });

  it('should detect conflicts', async () => {
    const mockConflicts = [
      { key: 'PATH', userValue: '/home/bin', systemValue: '/usr/bin', effectiveValue: '/home/bin' },
    ];
    mockEnvvarDetectConflicts.mockResolvedValue(mockConflicts);

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.detectConflicts();
    });

    expect(result.current.conflicts).toEqual(mockConflicts);
    expect(mockEnvvarDetectConflicts).toHaveBeenCalled();
  });

  it('should handle detectConflicts error', async () => {
    mockEnvvarDetectConflicts.mockRejectedValue(new Error('conflict detection failed'));

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.detectConflicts();
    });

    expect(result.current.conflicts).toEqual([]);
    expect(result.current.error).toBe('Error: conflict detection failed');
  });

  it('should set a persistent (user) var via envvarSetPersistent', async () => {
    const { result } = renderHook(() => useEnvVar());

    let success = false;
    await act(async () => {
      success = await result.current.setVar('MY_VAR', 'val', 'user');
    });

    expect(success).toBe(true);
    // Should NOT update local envVars for non-process scope
    expect(result.current.envVars).toEqual({});
  });

  it('should handle setVar error', async () => {
    mockEnvvarSetProcess.mockRejectedValue(new Error('set failed'));

    const { result } = renderHook(() => useEnvVar());

    let success = true;
    await act(async () => {
      success = await result.current.setVar('K', 'V', 'process');
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('Error: set failed');
  });

  it('should remove a persistent (user) var', async () => {
    const { result } = renderHook(() => useEnvVar());

    let success = false;
    await act(async () => {
      success = await result.current.removeVar('MY_VAR', 'user');
    });

    expect(success).toBe(true);
  });

  it('should handle removeVar error', async () => {
    mockEnvvarRemoveProcess.mockRejectedValue(new Error('remove failed'));

    const { result } = renderHook(() => useEnvVar());

    let success = true;
    await act(async () => {
      success = await result.current.removeVar('K', 'process');
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('Error: remove failed');
  });

  it('should handle getVar error', async () => {
    mockEnvvarGet.mockRejectedValue(new Error('get failed'));

    const { result } = renderHook(() => useEnvVar());

    let val: string | null = 'initial';
    await act(async () => {
      val = await result.current.getVar('BAD');
    });

    expect(val).toBeNull();
    expect(result.current.error).toBe('Error: get failed');
  });

  it('should handle fetchPath error', async () => {
    mockEnvvarGetPath.mockRejectedValue(new Error('path failed'));

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.fetchPath('process');
    });

    expect(result.current.pathEntries).toEqual([]);
    expect(result.current.error).toBe('Error: path failed');
  });

  it('should handle addPathEntry error', async () => {
    mockEnvvarAddPathEntry.mockRejectedValue(new Error('add path failed'));

    const { result } = renderHook(() => useEnvVar());

    let success = true;
    await act(async () => {
      success = await result.current.addPathEntry('/bad', 'process');
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('Error: add path failed');
  });

  it('should handle removePathEntry error', async () => {
    mockEnvvarRemovePathEntry.mockRejectedValue(new Error('remove path failed'));

    const { result } = renderHook(() => useEnvVar());

    let success = true;
    await act(async () => {
      success = await result.current.removePathEntry('/bad', 'process');
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('Error: remove path failed');
  });

  it('should handle reorderPath error', async () => {
    mockEnvvarReorderPath.mockRejectedValue(new Error('reorder failed'));

    const { result } = renderHook(() => useEnvVar());

    let success = true;
    await act(async () => {
      success = await result.current.reorderPath(['/a'], 'process');
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('Error: reorder failed');
  });

  it('should handle readShellProfile error', async () => {
    mockEnvvarReadShellProfile.mockRejectedValue(new Error('read failed'));

    const { result } = renderHook(() => useEnvVar());

    let content: string | null = 'initial';
    await act(async () => {
      content = await result.current.readShellProfile('/bad');
    });

    expect(content).toBeNull();
    expect(result.current.error).toBe('Error: read failed');
  });

  it('should handle importEnvFile error', async () => {
    mockEnvvarImportEnvFile.mockRejectedValue(new Error('import failed'));

    const { result } = renderHook(() => useEnvVar());

    let res = null;
    await act(async () => {
      res = await result.current.importEnvFile('FOO=bar', 'process');
    });

    expect(res).toBeNull();
    expect(result.current.error).toBe('Error: import failed');
  });

  it('should handle exportEnvFile error', async () => {
    mockEnvvarExportEnvFile.mockRejectedValue(new Error('export failed'));

    const { result } = renderHook(() => useEnvVar());

    let content: string | null = 'initial';
    await act(async () => {
      content = await result.current.exportEnvFile('process', 'dotenv');
    });

    expect(content).toBeNull();
    expect(result.current.error).toBe('Error: export failed');
  });

  it('should handle expandPath error', async () => {
    mockEnvvarExpand.mockRejectedValue(new Error('expand failed'));

    const { result } = renderHook(() => useEnvVar());

    let expanded: string | null = 'initial';
    await act(async () => {
      expanded = await result.current.expandPath('~/bad');
    });

    expect(expanded).toBeNull();
    expect(result.current.error).toBe('Error: expand failed');
  });

  it('should handle deduplicatePath error', async () => {
    mockEnvvarDeduplicatePath.mockRejectedValue(new Error('dedup failed'));

    const { result } = renderHook(() => useEnvVar());

    let removed = -1;
    await act(async () => {
      removed = await result.current.deduplicatePath('user');
    });

    expect(removed).toBe(0);
    expect(result.current.error).toBe('Error: dedup failed');
  });

  it('should handle fetchShellProfiles error', async () => {
    mockEnvvarListShellProfiles.mockRejectedValue(new Error('profiles failed'));

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.fetchShellProfiles();
    });

    expect(result.current.shellProfiles).toEqual([]);
    expect(result.current.error).toBe('Error: profiles failed');
  });
});
