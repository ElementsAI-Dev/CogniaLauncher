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
const mockEnvvarPreviewImportEnvFile = jest.fn();
const mockEnvvarApplyImportPreview = jest.fn();
const mockEnvvarExportEnvFile = jest.fn();
const mockEnvvarListPersistent = jest.fn();
const mockEnvvarExpand = jest.fn();
const mockEnvvarDeduplicatePath = jest.fn();
const mockEnvvarPreviewPathRepair = jest.fn();
const mockEnvvarApplyPathRepair = jest.fn();
const mockEnvvarListPersistentTyped = jest.fn();
const mockEnvvarDetectConflicts = jest.fn();
const mockEnvvarResolveConflict = jest.fn();
const mockEnvvarAddPathEntry = jest.fn();
const mockEnvvarRemovePathEntry = jest.fn();
const mockEnvvarReorderPath = jest.fn();
const mockEnvvarReadShellProfile = jest.fn();
const mockEnvvarSetPersistent = jest.fn();
const mockEnvvarRemovePersistent = jest.fn();
const mockEnvvarListProcessSummaries = jest.fn();
const mockEnvvarListPersistentTypedSummaries = jest.fn();

jest.mock('@/lib/tauri', () => ({
  envvarListAll: (...args: unknown[]) => mockEnvvarListAll(...args),
  envvarGet: (...args: unknown[]) => mockEnvvarGet(...args),
  envvarSetProcess: (...args: unknown[]) => mockEnvvarSetProcess(...args),
  envvarRemoveProcess: (...args: unknown[]) => mockEnvvarRemoveProcess(...args),
  envvarSetPersistent: (...args: unknown[]) => mockEnvvarSetPersistent(...args),
  envvarRemovePersistent: (...args: unknown[]) => mockEnvvarRemovePersistent(...args),
  envvarListProcessSummaries: (...args: unknown[]) => mockEnvvarListProcessSummaries(...args),
  envvarListPersistentTypedSummaries: (...args: unknown[]) => mockEnvvarListPersistentTypedSummaries(...args),
  envvarGetPath: (...args: unknown[]) => mockEnvvarGetPath(...args),
  envvarAddPathEntry: (...args: unknown[]) => mockEnvvarAddPathEntry(...args),
  envvarRemovePathEntry: (...args: unknown[]) => mockEnvvarRemovePathEntry(...args),
  envvarReorderPath: (...args: unknown[]) => mockEnvvarReorderPath(...args),
  envvarListShellProfiles: (...args: unknown[]) => mockEnvvarListShellProfiles(...args),
  envvarReadShellProfile: (...args: unknown[]) => mockEnvvarReadShellProfile(...args),
  envvarImportEnvFile: (...args: unknown[]) => mockEnvvarImportEnvFile(...args),
  envvarPreviewImportEnvFile: (...args: unknown[]) => mockEnvvarPreviewImportEnvFile(...args),
  envvarApplyImportPreview: (...args: unknown[]) => mockEnvvarApplyImportPreview(...args),
  envvarExportEnvFile: (...args: unknown[]) => mockEnvvarExportEnvFile(...args),
  envvarListPersistent: (...args: unknown[]) => mockEnvvarListPersistent(...args),
  envvarExpand: (...args: unknown[]) => mockEnvvarExpand(...args),
  envvarDeduplicatePath: (...args: unknown[]) => mockEnvvarDeduplicatePath(...args),
  envvarPreviewPathRepair: (...args: unknown[]) => mockEnvvarPreviewPathRepair(...args),
  envvarApplyPathRepair: (...args: unknown[]) => mockEnvvarApplyPathRepair(...args),
  envvarListPersistentTyped: (...args: unknown[]) => mockEnvvarListPersistentTyped(...args),
  envvarDetectConflicts: (...args: unknown[]) => mockEnvvarDetectConflicts(...args),
  envvarResolveConflict: (...args: unknown[]) => mockEnvvarResolveConflict(...args),
}));

jest.mock('@/lib/errors', () => ({
  formatError: (err: unknown) => String(err),
}));

describe('useEnvVar', () => {
  const makeSummary = (
    key: string,
    displayValue: string,
    scope: 'process' | 'user' | 'system',
  ) => ({
    key,
    scope,
    value: {
      displayValue,
      masked: false,
      hasValue: true,
      length: displayValue.length,
      isSensitive: false,
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnvvarGetPath.mockResolvedValue([]);
    mockEnvvarListProcessSummaries.mockResolvedValue([]);
    mockEnvvarListPersistentTypedSummaries.mockResolvedValue([]);
    mockEnvvarDetectConflicts.mockResolvedValue([]);
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useEnvVar());

    expect(result.current.envVars).toEqual({});
    expect(result.current.persistentVars).toEqual([]);
    expect(result.current.persistentVarsTyped).toEqual([]);
    expect(result.current.userPersistentVarsTyped).toEqual([]);
    expect(result.current.systemPersistentVarsTyped).toEqual([]);
    expect(result.current.pathEntries).toEqual([]);
    expect(result.current.shellProfiles).toEqual([]);
    expect(result.current.conflicts).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.detectionState).toBe('idle');
    expect(result.current.detectionFromCache).toBe(false);
    expect(result.current.detectionError).toBeNull();
    expect(result.current.detectionCanRetry).toBe(false);
    expect(result.current.detectionLastUpdated).toBeNull();
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
    const mockExportResult = {
      scope: 'process',
      format: 'dotenv',
      content: 'FOO=bar\nBAZ=qux',
      redacted: false,
      sensitiveCount: 0,
      variableCount: 2,
      revealed: false,
    };
    mockEnvvarExportEnvFile.mockResolvedValue(mockExportResult);

    const { result } = renderHook(() => useEnvVar());

    let content = null;
    await act(async () => {
      content = await result.current.exportEnvFile('process', 'dotenv');
    });

    expect(content).toEqual(mockExportResult);
    expect(mockEnvvarExportEnvFile).toHaveBeenCalledWith('process', 'dotenv', false);
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
    expect(mockEnvvarGetPath).toHaveBeenCalledWith('user');
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
    expect(result.current.userPersistentVarsTyped).toEqual(mockTyped);
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

  it('should return true for successful add/remove/reorder path mutations', async () => {
    mockEnvvarAddPathEntry.mockResolvedValue(undefined);
    mockEnvvarRemovePathEntry.mockResolvedValue(undefined);
    mockEnvvarReorderPath.mockResolvedValue(undefined);

    const { result } = renderHook(() => useEnvVar());

    let addSuccess = false;
    let removeSuccess = false;
    let reorderSuccess = false;
    await act(async () => {
      addSuccess = await result.current.addPathEntry('/ok', 'process');
      removeSuccess = await result.current.removePathEntry('/ok', 'process');
      reorderSuccess = await result.current.reorderPath(['/a', '/b'], 'process');
    });

    expect(addSuccess).toBe(true);
    expect(removeSuccess).toBe(true);
    expect(reorderSuccess).toBe(true);
    expect(mockEnvvarGetPath).toHaveBeenCalledTimes(3);
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

  it('should clear stale error before a successful setVar retry', async () => {
    mockEnvvarSetProcess.mockRejectedValueOnce(new Error('set failed once'));
    mockEnvvarSetProcess.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.setVar('KEY', 'bad', 'process');
    });
    expect(result.current.error).toBe('Error: set failed once');

    await act(async () => {
      await result.current.setVar('KEY', 'good', 'process');
    });
    expect(result.current.error).toBeNull();
    expect(result.current.envVars).toHaveProperty('KEY', 'good');
  });

  it('should refresh typed persistent list by requested scope', async () => {
    mockEnvvarListPersistentTyped
      .mockResolvedValueOnce([{ key: 'USER_VAR', value: '1', regType: 'REG_SZ' }])
      .mockResolvedValueOnce([{ key: 'SYSTEM_VAR', value: '2', regType: 'REG_EXPAND_SZ' }]);

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.fetchPersistentVarsTyped('user');
    });
    expect(result.current.persistentVarsTyped).toEqual([{ key: 'USER_VAR', value: '1', regType: 'REG_SZ' }]);
    expect(result.current.userPersistentVarsTyped).toEqual([{ key: 'USER_VAR', value: '1', regType: 'REG_SZ' }]);

    await act(async () => {
      await result.current.fetchPersistentVarsTyped('system');
    });
    expect(result.current.persistentVarsTyped).toEqual([{ key: 'SYSTEM_VAR', value: '2', regType: 'REG_EXPAND_SZ' }]);
    expect(result.current.systemPersistentVarsTyped).toEqual([{ key: 'SYSTEM_VAR', value: '2', regType: 'REG_EXPAND_SZ' }]);
    expect(mockEnvvarListPersistentTyped).toHaveBeenNthCalledWith(1, 'user');
    expect(mockEnvvarListPersistentTyped).toHaveBeenNthCalledWith(2, 'system');
  });

  it('loads detection from fresh data on cache miss', async () => {
    const processSummaries = [makeSummary('PATH', '/usr/bin', 'process')];
    const userSummaries = [makeSummary('USER_KEY', 'u', 'user')];
    const systemSummaries = [makeSummary('SYSTEM_KEY', 's', 'system')];
    mockEnvvarListProcessSummaries.mockResolvedValue(processSummaries);
    mockEnvvarListPersistentTypedSummaries
      .mockResolvedValueOnce(userSummaries)
      .mockResolvedValueOnce(systemSummaries);

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.loadDetection('all');
    });

    expect(result.current.detectionState).toBe('showing-fresh');
    expect(result.current.detectionFromCache).toBe(false);
    expect(result.current.detectionError).toBeNull();
    expect(result.current.processVarSummaries).toEqual(processSummaries);
    expect(result.current.userPersistentVarSummaries).toEqual(userSummaries);
    expect(result.current.systemPersistentVarSummaries).toEqual(systemSummaries);
  });

  it('shows cached detection immediately and refreshes in background', async () => {
    const cachedProcess = [makeSummary('PATH', '/cache', 'process')];
    const cachedUser = [makeSummary('U', 'cache', 'user')];
    const cachedSystem = [makeSummary('S', 'cache', 'system')];
    mockEnvvarListProcessSummaries.mockResolvedValueOnce(cachedProcess);
    mockEnvvarListPersistentTypedSummaries
      .mockResolvedValueOnce(cachedUser)
      .mockResolvedValueOnce(cachedSystem);

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.loadDetection('all');
    });

    const freshProcess = [makeSummary('PATH', '/fresh', 'process')];
    const freshUser = [makeSummary('U', 'fresh', 'user')];
    const freshSystem = [makeSummary('S', 'fresh', 'system')];
    let resolveFresh: ((value: typeof freshProcess) => void) | null = null;
    const freshPromise = new Promise<typeof freshProcess>((resolve) => {
      resolveFresh = resolve;
    });

    mockEnvvarListProcessSummaries.mockImplementationOnce(() => freshPromise);
    mockEnvvarListPersistentTypedSummaries
      .mockResolvedValueOnce(freshUser)
      .mockResolvedValueOnce(freshSystem);

    await act(async () => {
      void result.current.loadDetection('all');
    });

    expect(result.current.detectionState).toBe('showing-cache-refreshing');
    expect(result.current.detectionFromCache).toBe(true);
    expect(result.current.processVarSummaries).toEqual(cachedProcess);

    await act(async () => {
      resolveFresh?.(freshProcess);
      await freshPromise;
    });

    expect(result.current.detectionState).toBe('showing-fresh');
    expect(result.current.detectionFromCache).toBe(false);
    expect(result.current.processVarSummaries).toEqual(freshProcess);
    expect(result.current.userPersistentVarSummaries).toEqual(freshUser);
    expect(result.current.systemPersistentVarSummaries).toEqual(freshSystem);
  });

  it('keeps cached data and exposes retry metadata on refresh failure', async () => {
    const cachedProcess = [makeSummary('PATH', '/cache', 'process')];
    mockEnvvarListProcessSummaries.mockResolvedValueOnce(cachedProcess);
    mockEnvvarListPersistentTypedSummaries
      .mockResolvedValueOnce([makeSummary('U', 'cache', 'user')])
      .mockResolvedValueOnce([makeSummary('S', 'cache', 'system')]);

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.loadDetection('all');
    });

    mockEnvvarListProcessSummaries.mockRejectedValueOnce(new Error('refresh failed'));

    await act(async () => {
      await result.current.loadDetection('all');
    });

    expect(result.current.detectionState).toBe('error');
    expect(result.current.detectionFromCache).toBe(true);
    expect(result.current.detectionError).toBe('Error: refresh failed');
    expect(result.current.detectionCanRetry).toBe(true);
    expect(result.current.processVarSummaries).toEqual(cachedProcess);
  });

  it('ignores stale detection responses when newer request finishes first', async () => {
    const staleProcess = [makeSummary('PATH', '/stale', 'process')];
    const newestProcess = [makeSummary('PATH', '/newest', 'process')];
    let resolveFirst: ((value: typeof staleProcess) => void) | null = null;
    const firstPromise = new Promise<typeof staleProcess>((resolve) => {
      resolveFirst = resolve;
    });
    mockEnvvarListProcessSummaries.mockImplementationOnce(() => firstPromise);

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      void result.current.loadDetection('process', { forceRefresh: true });
    });

    mockEnvvarListProcessSummaries.mockResolvedValueOnce(newestProcess);

    await act(async () => {
      await result.current.loadDetection('process', { forceRefresh: true });
    });

    expect(result.current.processVarSummaries).toEqual(newestProcess);

    await act(async () => {
      resolveFirst?.(staleProcess);
      await firstPromise;
    });

    expect(result.current.processVarSummaries).toEqual(newestProcess);
    expect(result.current.detectionState).toBe('showing-fresh');
  });

  it('stores import preview and shell guidance', async () => {
    mockEnvvarPreviewImportEnvFile.mockResolvedValue({
      scope: 'user',
      fingerprint: 'preview-fingerprint',
      additions: 1,
      updates: 0,
      noops: 0,
      invalid: 0,
      skipped: 0,
      items: [{ key: 'JAVA_HOME', value: '/jdk', action: 'add', reason: null }],
      primaryShellTarget: '/home/user/.bashrc',
      shellGuidance: [{ shell: 'bash', configPath: '/home/user/.bashrc', command: 'export JAVA_HOME="/jdk"', autoApplied: true }],
    });

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.previewImportEnvFile('JAVA_HOME=/jdk', 'user');
    });

    expect(result.current.importPreview?.fingerprint).toBe('preview-fingerprint');
    expect(result.current.importPreviewStale).toBe(false);
    expect(result.current.shellGuidance).toHaveLength(1);
  });

  it('marks import preview stale when apply rejects stale preview', async () => {
    mockEnvvarApplyImportPreview.mockRejectedValue(new Error('stale_preview: changed'));

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.applyImportPreview('JAVA_HOME=/jdk', 'user', 'stale-fingerprint');
    });

    expect(result.current.importPreviewStale).toBe(true);
    expect(result.current.error).toContain('stale_preview');
  });

  it('stores path repair preview and stale state', async () => {
    mockEnvvarPreviewPathRepair.mockResolvedValue({
      scope: 'user',
      fingerprint: 'path-fingerprint',
      currentEntries: ['/missing', '/dup', '/dup'],
      repairedEntries: ['/dup'],
      duplicateCount: 1,
      missingCount: 1,
      removedCount: 2,
      primaryShellTarget: '/home/user/.bashrc',
      shellGuidance: [{ shell: 'bash', configPath: '/home/user/.bashrc', command: 'export PATH="/dup:$PATH"', autoApplied: true }],
    });
    mockEnvvarApplyPathRepair.mockRejectedValue(new Error('stale_preview: path changed'));

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.previewPathRepair('user');
    });

    expect(result.current.pathRepairPreview?.fingerprint).toBe('path-fingerprint');

    await act(async () => {
      await result.current.applyPathRepair('user', 'path-fingerprint');
    });

    expect(result.current.pathRepairPreviewStale).toBe(true);
  });

  it('resolves conflict and refreshes shell guidance', async () => {
    mockEnvvarResolveConflict.mockResolvedValue({
      key: 'JAVA_HOME',
      sourceScope: 'system',
      targetScope: 'user',
      appliedValue: '/jdk-21',
      primaryShellTarget: '/home/user/.bashrc',
      shellGuidance: [{ shell: 'bash', configPath: '/home/user/.bashrc', command: 'export JAVA_HOME="/jdk-21"', autoApplied: true }],
    });
    mockEnvvarListAll.mockResolvedValue({});
    mockEnvvarListPersistentTyped.mockResolvedValue([]);
    mockEnvvarDetectConflicts.mockResolvedValue([]);

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.resolveConflict('JAVA_HOME', 'system', 'user');
    });

    expect(mockEnvvarResolveConflict).toHaveBeenCalledWith('JAVA_HOME', 'system', 'user');
    expect(result.current.shellGuidance).toHaveLength(1);
  });
});
