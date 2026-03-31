import { renderHook, act } from '@testing-library/react';
import { __resetEnvVarOverviewCache, useEnvVar } from './use-envvar';
import { useSettingsStore } from '@/lib/stores/settings';

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
const mockEnvvarRevealValue = jest.fn();
const mockEnvvarAddPathEntry = jest.fn();
const mockEnvvarRemovePathEntry = jest.fn();
const mockEnvvarReorderPath = jest.fn();
const mockEnvvarReadShellProfile = jest.fn();
const mockEnvvarSetPersistent = jest.fn();
const mockEnvvarRemovePersistent = jest.fn();
const mockEnvvarListProcessSummaries = jest.fn();
const mockEnvvarListPersistentTypedSummaries = jest.fn();
const mockEnvvarGetSupportSnapshot = jest.fn();
const mockEnvvarListSnapshots = jest.fn();
const mockEnvvarCreateSnapshot = jest.fn();
const mockEnvvarGetBackupProtection = jest.fn();
const mockEnvvarPreviewSnapshotRestore = jest.fn();
const mockEnvvarRestoreSnapshot = jest.fn();
const mockEnvvarDeleteSnapshot = jest.fn();
const mockEnvvarGetOverview = jest.fn();

jest.mock('@/lib/tauri', () => ({
  envvarListAll: (...args: unknown[]) => mockEnvvarListAll(...args),
  envvarGet: (...args: unknown[]) => mockEnvvarGet(...args),
  envvarSetProcess: (...args: unknown[]) => mockEnvvarSetProcess(...args),
  envvarRemoveProcess: (...args: unknown[]) => mockEnvvarRemoveProcess(...args),
  envvarSetPersistent: (...args: unknown[]) => mockEnvvarSetPersistent(...args),
  envvarRemovePersistent: (...args: unknown[]) => mockEnvvarRemovePersistent(...args),
  envvarListProcessSummaries: (...args: unknown[]) => mockEnvvarListProcessSummaries(...args),
  envvarListPersistentTypedSummaries: (...args: unknown[]) => mockEnvvarListPersistentTypedSummaries(...args),
  envvarGetSupportSnapshot: (...args: unknown[]) => mockEnvvarGetSupportSnapshot(...args),
  envvarListSnapshots: (...args: unknown[]) => mockEnvvarListSnapshots(...args),
  envvarCreateSnapshot: (...args: unknown[]) => mockEnvvarCreateSnapshot(...args),
  envvarGetBackupProtection: (...args: unknown[]) => mockEnvvarGetBackupProtection(...args),
  envvarPreviewSnapshotRestore: (...args: unknown[]) => mockEnvvarPreviewSnapshotRestore(...args),
  envvarRestoreSnapshot: (...args: unknown[]) => mockEnvvarRestoreSnapshot(...args),
  envvarDeleteSnapshot: (...args: unknown[]) => mockEnvvarDeleteSnapshot(...args),
  envvarGetOverview: (...args: unknown[]) => mockEnvvarGetOverview(...args),
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
  envvarRevealValue: (...args: unknown[]) => mockEnvvarRevealValue(...args),
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
    __resetEnvVarOverviewCache();
    useSettingsStore.setState((state) => ({
      appSettings: {
        ...state.appSettings,
        envvarDefaultScope: 'all',
        envvarAutoSnapshot: false,
        envvarMaskSensitive: true,
      },
    }));
    mockEnvvarGetPath.mockResolvedValue([]);
    mockEnvvarListProcessSummaries.mockResolvedValue([]);
    mockEnvvarListPersistentTypedSummaries.mockResolvedValue([]);
    mockEnvvarDetectConflicts.mockResolvedValue([]);
    mockEnvvarGetSupportSnapshot.mockResolvedValue({
      state: 'ready',
      reasonCode: 'ready',
      reason: 'Envvar workflows are ready.',
      platform: 'linux',
      detectedShells: 1,
      primaryShellTarget: '/home/user/.bashrc',
      actions: [
        {
          action: 'set',
          scope: 'process',
          supported: true,
          state: 'ready',
          reasonCode: 'ready',
          reason: 'Process scope is ready.',
          nextSteps: [],
        },
      ],
    });
    mockEnvvarGetBackupProtection.mockImplementation((action: string, scope: 'user' | 'system') => Promise.resolve({
      action,
      scope,
      state: 'unprotected',
      reasonCode: 'unprotected',
      reason: 'Protection not required.',
      nextSteps: [],
      snapshot: null,
    }));
    mockEnvvarListSnapshots.mockResolvedValue([]);
    mockEnvvarGetOverview.mockReset();
    mockEnvvarGetOverview.mockResolvedValue({
      totalVars: 0,
      processCount: 0,
      userCount: 0,
      systemCount: 0,
      conflictCount: 0,
      pathIssueCount: 0,
      latestSnapshotAt: null,
    });
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
    expect((result.current as unknown as { supportSnapshot?: unknown }).supportSnapshot ?? null).toBeNull();
    expect((result.current as unknown as { snapshotHistory?: unknown[] }).snapshotHistory ?? []).toEqual([]);
  });

  it('loads envvar snapshot history and creates manual snapshots', async () => {
    mockEnvvarListSnapshots.mockResolvedValueOnce([
      {
        path: 'D:/snapshots/envvar-snapshot-1',
        name: 'envvar-snapshot-1',
        createdAt: '2026-03-19T00:00:00Z',
        creationMode: 'manual',
        sourceAction: 'set',
        note: 'before change',
        scopes: ['user'],
        integrityState: 'valid',
        snapshot: {
          formatVersion: 1,
          createdAt: '2026-03-19T00:00:00Z',
          creationMode: 'manual',
          sourceAction: 'set',
          note: 'before change',
          scopes: [],
        },
      },
    ]);
    mockEnvvarCreateSnapshot.mockResolvedValueOnce({
      success: true,
      status: 'verified',
      reasonCode: null,
      message: null,
      snapshot: {
        path: 'D:/snapshots/envvar-snapshot-2',
        name: 'envvar-snapshot-2',
        createdAt: '2026-03-19T01:00:00Z',
        creationMode: 'manual',
        sourceAction: 'import_apply',
        note: 'manual safety point',
        scopes: ['user', 'system'],
        integrityState: 'valid',
        snapshot: {
          formatVersion: 1,
          createdAt: '2026-03-19T01:00:00Z',
          creationMode: 'manual',
          sourceAction: 'import_apply',
          note: 'manual safety point',
          scopes: [],
        },
      },
    });

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await (result.current as unknown as {
        fetchSnapshotHistory: () => Promise<unknown[]>;
      }).fetchSnapshotHistory();
    });

    expect((result.current as unknown as { snapshotHistory: unknown[] }).snapshotHistory).toHaveLength(1);

    await act(async () => {
      await (result.current as unknown as {
        createSnapshot: (
          scopes: Array<'user' | 'system'>,
          options?: { sourceAction?: string; note?: string; creationMode?: 'manual' | 'automatic' },
        ) => Promise<unknown>;
      }).createSnapshot(['user', 'system'], {
        sourceAction: 'import_apply',
        note: 'manual safety point',
      });
    });

    expect(mockEnvvarCreateSnapshot).toHaveBeenCalledWith(
      ['user', 'system'],
      'manual',
      'import_apply',
      'manual safety point',
    );
    expect((result.current as unknown as { snapshotHistory: Array<{ name: string }> }).snapshotHistory[0].name)
      .toBe('envvar-snapshot-2');
  });

  it('restores a snapshot and refreshes detection state', async () => {
    mockEnvvarRestoreSnapshot.mockResolvedValueOnce({
      success: true,
      verified: true,
      status: 'verified',
      reasonCode: null,
      message: null,
      restoredScopes: ['user'],
      skipped: [],
      primaryShellTarget: '/home/user/.bashrc',
      shellGuidance: [
        {
          shell: 'bash',
          configPath: '/home/user/.bashrc',
          command: 'export API_TOKEN="value"',
          autoApplied: true,
          containsSensitiveValue: false,
          redacted: false,
        },
      ],
    });
    mockEnvvarListSnapshots.mockResolvedValueOnce([]);
    mockEnvvarListProcessSummaries.mockResolvedValueOnce([makeSummary('PATH', '/usr/bin', 'process')]);

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await (result.current as unknown as {
        restoreSnapshot: (snapshotPath: string, scopes?: Array<'user'>, previewFingerprint?: string) => Promise<unknown>;
      }).restoreSnapshot('D:/snapshots/envvar-snapshot-1', ['user'], 'restore-preview-fingerprint');
    });

    expect(mockEnvvarRestoreSnapshot).toHaveBeenCalledWith(
      'D:/snapshots/envvar-snapshot-1',
      ['user'],
      'restore-preview-fingerprint',
    );
    expect(mockEnvvarListSnapshots).toHaveBeenCalled();
    expect(mockEnvvarGetSupportSnapshot).toHaveBeenCalled();
    expect((result.current as unknown as {
      shellGuidance: Array<{ shell: string }>;
      detectionState: string;
    }).shellGuidance[0].shell).toBe('bash');
  });

  it('loads support snapshot and exposes blocked action readiness', async () => {
    mockEnvvarGetSupportSnapshot.mockResolvedValueOnce({
      state: 'degraded',
      reasonCode: 'system_scope_requires_permissions',
      reason: 'Some envvar actions require additional permissions.',
      platform: 'linux',
      detectedShells: 1,
      primaryShellTarget: '/home/user/.bashrc',
      actions: [
        {
          action: 'set',
          scope: 'system',
          supported: false,
          state: 'blocked',
          reasonCode: 'system_scope_requires_permissions',
          reason: 'System scope requires elevated permissions.',
          nextSteps: ['Re-run with elevated permissions.'],
        },
      ],
    });

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await (result.current as unknown as {
        loadSupportSnapshot: () => Promise<unknown>;
      }).loadSupportSnapshot();
    });

    const supportSnapshot = (result.current as unknown as {
      supportSnapshot?: { actions?: Array<{ state: string; reasonCode: string }> };
    }).supportSnapshot;

    expect(supportSnapshot?.actions?.[0]).toMatchObject({
      state: 'blocked',
      reasonCode: 'system_scope_requires_permissions',
    });
  });

  it('loads envvar overview through the shared cache and reuses it on repeated calls', async () => {
    mockEnvvarGetOverview.mockResolvedValue({
      totalVars: 12,
      processCount: 4,
      userCount: 5,
      systemCount: 3,
      conflictCount: 2,
      pathIssueCount: 3,
      latestSnapshotAt: '2026-03-28T00:00:00Z',
    });

    const { result } = renderHook(() => useEnvVar());

    let firstOverview: unknown;
    await act(async () => {
      firstOverview = await (result.current as unknown as {
        getOverview: () => Promise<unknown>;
      }).getOverview();
    });

    let secondOverview: unknown;
    await act(async () => {
      secondOverview = await (result.current as unknown as {
        getOverview: () => Promise<unknown>;
      }).getOverview();
    });

    expect(firstOverview).toMatchObject({
      totalVars: 12,
      conflictCount: 2,
      pathIssueCount: 3,
    });
    expect(secondOverview).toMatchObject({
      totalVars: 12,
      conflictCount: 2,
      pathIssueCount: 3,
    });
    expect(mockEnvvarGetOverview).toHaveBeenCalledTimes(1);
    expect((result.current as unknown as {
      overview?: { totalVars: number; userCount: number };
      overviewLoading: boolean;
      overviewError: string | null;
    }).overview).toMatchObject({
      totalVars: 12,
      userCount: 5,
    });
    expect((result.current as unknown as { overviewLoading: boolean }).overviewLoading).toBe(false);
    expect((result.current as unknown as { overviewError: string | null }).overviewError).toBeNull();
  });

  it('surfaces envvar overview loading failures', async () => {
    mockEnvvarGetOverview.mockRejectedValueOnce(new Error('overview failed'));

    const { result } = renderHook(() => useEnvVar());

    let overview: unknown = 'pending';
    await act(async () => {
      overview = await (result.current as unknown as {
        getOverview: () => Promise<unknown>;
      }).getOverview();
    });

    expect(overview).toBeNull();
    expect((result.current as unknown as { overviewError: string | null }).overviewError).toBe('Error: overview failed');
    expect((result.current as unknown as { overviewLoading: boolean }).overviewLoading).toBe(false);
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
    mockEnvvarSetProcess.mockResolvedValue({
      operation: 'set',
      key: 'MY_VAR',
      scope: 'process',
      success: true,
      verified: true,
      status: 'verified',
      reasonCode: null,
      message: null,
      effectiveValueSummary: {
        displayValue: 'my_value',
        masked: false,
        hasValue: true,
        length: 8,
        isSensitive: false,
      },
      primaryShellTarget: null,
      shellGuidance: [],
    });

    const { result } = renderHook(() => useEnvVar());

    let mutation: unknown = null;
    await act(async () => {
      mutation = await (result.current as unknown as {
        setVar: (key: string, value: string, scope: 'process') => Promise<unknown>;
      }).setVar('MY_VAR', 'my_value', 'process');
    });

    expect(mutation).toMatchObject({
      status: 'verified',
      verified: true,
      success: true,
    });
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

    expect(importResult).toMatchObject({
      ...mockResult,
      scope: 'process',
      success: true,
      verified: true,
      status: 'verified',
    });
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
    mockEnvvarDeduplicatePath.mockResolvedValue({
      operation: 'deduplicate_path',
      scope: 'user',
      success: true,
      verified: true,
      status: 'verified',
      reasonCode: null,
      message: null,
      removedCount: 3,
      pathEntries: [],
      primaryShellTarget: '/home/user/.bashrc',
      shellGuidance: [],
    });

    const { result } = renderHook(() => useEnvVar());

    let resultValue: unknown = null;
    await act(async () => {
      resultValue = await (result.current as unknown as {
        deduplicatePath: (scope: 'user') => Promise<unknown>;
      }).deduplicatePath('user');
    });

    expect(resultValue).toMatchObject({
      status: 'verified',
      verified: true,
      removedCount: 3,
    });
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

    let success: unknown = false;
    await act(async () => {
      success = await result.current.setVar('MY_VAR', 'val', 'user');
    });

    expect(success).toMatchObject({
      success: true,
      verified: true,
      status: 'verified',
      scope: 'user',
    });
    // Should NOT update local envVars for non-process scope
    expect(result.current.envVars).toEqual({});
  });

  it('creates an automatic snapshot before setting a persistent variable when enabled', async () => {
    useSettingsStore.setState((state) => ({
      appSettings: {
        ...state.appSettings,
        envvarAutoSnapshot: true,
      },
    }));
    mockEnvvarGetBackupProtection.mockResolvedValue({
      action: 'persistent_set',
      scope: 'user',
      state: 'will_create',
      reasonCode: 'new_snapshot_required',
      reason: 'Create snapshot first',
      nextSteps: [],
      snapshot: null,
    });
    mockEnvvarCreateSnapshot.mockResolvedValue({
      success: true,
      status: 'verified',
      reasonCode: null,
      message: null,
      snapshot: {
        path: 'D:/snapshots/envvar-auto',
        name: 'envvar-auto',
        createdAt: new Date().toISOString(),
        creationMode: 'automatic',
        scopes: ['user'],
        integrityState: 'valid',
      },
    });

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.setVar('MY_VAR', 'val', 'user');
    });

    expect(mockEnvvarGetBackupProtection).toHaveBeenCalledWith('persistent_set', 'user');
    expect(mockEnvvarCreateSnapshot).toHaveBeenCalledWith(
      ['user'],
      'automatic',
      'persistent_set',
      'Auto snapshot before persistent_set',
    );
    expect(mockEnvvarSetPersistent).toHaveBeenCalledWith('MY_VAR', 'val', 'user');
  });

  it('exposes envvar settings preferences from the settings store', () => {
    useSettingsStore.setState((state) => ({
      appSettings: {
        ...state.appSettings,
        envvarDefaultScope: 'user',
        envvarAutoSnapshot: true,
        envvarMaskSensitive: false,
      },
    }));

    const { result } = renderHook(() => useEnvVar());

    expect(result.current.defaultScopePreference).toBe('user');
    expect(result.current.autoSnapshotEnabled).toBe(true);
    expect(result.current.maskSensitiveByDefault).toBe(false);
  });

  it('creates an automatic snapshot before removing a persistent variable when enabled', async () => {
    useSettingsStore.setState((state) => ({
      appSettings: {
        ...state.appSettings,
        envvarAutoSnapshot: true,
      },
    }));
    mockEnvvarGetBackupProtection.mockResolvedValue({
      action: 'persistent_remove',
      scope: 'user',
      state: 'will_create',
      reasonCode: 'new_snapshot_required',
      reason: 'Create snapshot first',
      nextSteps: [],
      snapshot: null,
    });
    mockEnvvarCreateSnapshot.mockResolvedValue({
      success: true,
      status: 'verified',
      reasonCode: null,
      message: null,
      snapshot: {
        path: 'D:/snapshots/envvar-auto',
        name: 'envvar-auto',
        createdAt: new Date().toISOString(),
        creationMode: 'automatic',
        scopes: ['user'],
        integrityState: 'valid',
      },
    });

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.removeVar('MY_VAR', 'user');
    });

    expect(mockEnvvarGetBackupProtection).toHaveBeenCalledWith('persistent_remove', 'user');
    expect(mockEnvvarCreateSnapshot).toHaveBeenCalledWith(
      ['user'],
      'automatic',
      'persistent_remove',
      'Auto snapshot before persistent_remove',
    );
    expect(mockEnvvarRemovePersistent).toHaveBeenCalledWith('MY_VAR', 'user');
  });

  it('reuses compatible automatic protection without creating a fresh snapshot', async () => {
    useSettingsStore.setState((state) => ({
      appSettings: {
        ...state.appSettings,
        envvarAutoSnapshot: true,
      },
    }));
    mockEnvvarGetBackupProtection.mockResolvedValue({
      action: 'persistent_set',
      scope: 'user',
      state: 'will_reuse',
      reasonCode: 'compatible_snapshot_available',
      reason: 'Existing snapshot can be reused',
      nextSteps: [],
      snapshot: {
        path: 'D:/snapshots/envvar-auto',
        name: 'envvar-auto',
        createdAt: new Date().toISOString(),
        creationMode: 'automatic',
        scopes: ['user'],
        integrityState: 'valid',
        snapshot: {
          formatVersion: 1,
          createdAt: new Date().toISOString(),
          creationMode: 'automatic',
          scopes: [],
        },
      },
    });

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.setVar('MY_VAR', 'val', 'user');
    });

    expect(mockEnvvarGetBackupProtection).toHaveBeenCalledWith('persistent_set', 'user');
    expect(mockEnvvarCreateSnapshot).not.toHaveBeenCalled();
    expect(mockEnvvarSetPersistent).toHaveBeenCalledWith('MY_VAR', 'val', 'user');
  });

  it('blocks risky persistent mutations when protection preflight reports blocked', async () => {
    useSettingsStore.setState((state) => ({
      appSettings: {
        ...state.appSettings,
        envvarAutoSnapshot: true,
      },
    }));
    mockEnvvarGetBackupProtection.mockResolvedValue({
      action: 'persistent_set',
      scope: 'user',
      state: 'blocked',
      reasonCode: 'permission_denied',
      reason: 'Protection is blocked',
      nextSteps: ['Retry later'],
      snapshot: null,
    });

    const { result } = renderHook(() => useEnvVar());

    let mutationResult: unknown = 'pending';
    await act(async () => {
      mutationResult = await result.current.setVar('MY_VAR', 'val', 'user');
    });

    expect(mutationResult).toBeNull();
    expect(mockEnvvarSetPersistent).not.toHaveBeenCalled();
    expect(result.current.error).toContain('Protection is blocked');
  });

  it('should handle setVar error', async () => {
    mockEnvvarSetProcess.mockRejectedValue(new Error('set failed'));

    const { result } = renderHook(() => useEnvVar());

    let success: unknown = true;
    await act(async () => {
      success = await result.current.setVar('K', 'V', 'process');
    });

    expect(success).toBeNull();
    expect(result.current.error).toBe('Error: set failed');
  });

  it('should remove a persistent (user) var', async () => {
    const { result } = renderHook(() => useEnvVar());

    let success: unknown = false;
    await act(async () => {
      success = await result.current.removeVar('MY_VAR', 'user');
    });

    expect(success).toMatchObject({
      success: true,
      verified: true,
      status: 'verified',
      scope: 'user',
    });
  });

  it('should handle removeVar error', async () => {
    mockEnvvarRemoveProcess.mockRejectedValue(new Error('remove failed'));

    const { result } = renderHook(() => useEnvVar());

    let success: unknown = true;
    await act(async () => {
      success = await result.current.removeVar('K', 'process');
    });

    expect(success).toBeNull();
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

    let success: unknown = true;
    await act(async () => {
      success = await result.current.addPathEntry('/bad', 'process');
    });

    expect(success).toBeNull();
    expect(result.current.error).toBe('Error: add path failed');
  });

  it('should return true for successful add/remove/reorder path mutations', async () => {
    mockEnvvarAddPathEntry.mockResolvedValue(undefined);
    mockEnvvarRemovePathEntry.mockResolvedValue(undefined);
    mockEnvvarReorderPath.mockResolvedValue(undefined);

    const { result } = renderHook(() => useEnvVar());

    let addSuccess: unknown = false;
    let removeSuccess: unknown = false;
    let reorderSuccess: unknown = false;
    await act(async () => {
      addSuccess = await result.current.addPathEntry('/ok', 'process');
      removeSuccess = await result.current.removePathEntry('/ok', 'process');
      reorderSuccess = await result.current.reorderPath(['/a', '/b'], 'process');
    });

    expect(addSuccess).toMatchObject({ success: true, verified: true, status: 'verified' });
    expect(removeSuccess).toMatchObject({ success: true, verified: true, status: 'verified' });
    expect(reorderSuccess).toMatchObject({ success: true, verified: true, status: 'verified' });
    expect(mockEnvvarGetPath).toHaveBeenCalledTimes(3);
  });

  it('should handle removePathEntry error', async () => {
    mockEnvvarRemovePathEntry.mockRejectedValue(new Error('remove path failed'));

    const { result } = renderHook(() => useEnvVar());

    let success: unknown = true;
    await act(async () => {
      success = await result.current.removePathEntry('/bad', 'process');
    });

    expect(success).toBeNull();
    expect(result.current.error).toBe('Error: remove path failed');
  });

  it('should handle reorderPath error', async () => {
    mockEnvvarReorderPath.mockRejectedValue(new Error('reorder failed'));

    const { result } = renderHook(() => useEnvVar());

    let success: unknown = true;
    await act(async () => {
      success = await result.current.reorderPath(['/a'], 'process');
    });

    expect(success).toBeNull();
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

    let removed: unknown = -1;
    await act(async () => {
      removed = await result.current.deduplicatePath('user');
    });

    expect(removed).toBeNull();
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

  it('loads user-scope detection without reloading other scope summaries', async () => {
    const userSummaries = [makeSummary('JAVA_HOME', '/jdk', 'user')];
    const existingSystemSummaries = [makeSummary('SYSTEM_KEY', '/system', 'system')];
    mockEnvvarListPersistentTypedSummaries.mockResolvedValueOnce(existingSystemSummaries);
    mockEnvvarDetectConflicts.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.loadDetection('system', { forceRefresh: true });
    });

    expect(result.current.systemPersistentVarSummaries).toEqual(existingSystemSummaries);

    mockEnvvarListPersistentTypedSummaries.mockResolvedValueOnce(userSummaries);
    mockEnvvarDetectConflicts.mockResolvedValueOnce([
      { key: 'JAVA_HOME', userValue: '/jdk', systemValue: '/old-jdk', effectiveValue: '/jdk' },
    ]);

    await act(async () => {
      await result.current.loadDetection('user', { forceRefresh: true });
    });

    expect(mockEnvvarListPersistentTypedSummaries).toHaveBeenLastCalledWith('user');
    expect(result.current.userPersistentVarSummaries).toEqual(userSummaries);
    expect(result.current.systemPersistentVarSummaries).toEqual(existingSystemSummaries);
    expect(result.current.conflicts).toHaveLength(1);
  });

  it('marks scope-specific detection as empty when no summaries exist', async () => {
    mockEnvvarListPersistentTypedSummaries.mockResolvedValueOnce([]);
    mockEnvvarDetectConflicts.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.loadDetection('system', { forceRefresh: true });
    });

    expect(result.current.detectionState).toBe('empty');
    expect(result.current.detectionCanRetry).toBe(true);
  });

  it('exposes retry metadata when detection fails without cache', async () => {
    mockEnvvarListProcessSummaries.mockRejectedValueOnce(new Error('cold refresh failed'));

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.loadDetection('process', { forceRefresh: true });
    });

    expect(result.current.detectionState).toBe('error');
    expect(result.current.detectionFromCache).toBe(false);
    expect(result.current.detectionError).toBe('Error: cold refresh failed');
    expect(result.current.detectionCanRetry).toBe(true);
  });

  it('surfaces support snapshot loading failures', async () => {
    mockEnvvarGetSupportSnapshot.mockRejectedValueOnce(new Error('support snapshot failed'));

    const { result } = renderHook(() => useEnvVar());

    let supportSnapshot: unknown = 'pending';
    await act(async () => {
      supportSnapshot = await result.current.loadSupportSnapshot();
    });

    expect(supportSnapshot).toBeNull();
    expect(result.current.supportError).toBe('Error: support snapshot failed');
    expect(result.current.supportLoading).toBe(false);
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

  it('clears import preview state on demand', async () => {
    mockEnvvarPreviewImportEnvFile.mockResolvedValueOnce({
      scope: 'user',
      fingerprint: 'preview-fingerprint',
      additions: 1,
      updates: 0,
      noops: 0,
      invalid: 0,
      skipped: 0,
      items: [{ key: 'JAVA_HOME', value: '/jdk', action: 'add', reason: null }],
      primaryShellTarget: '/home/user/.bashrc',
      shellGuidance: [],
    });

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.previewImportEnvFile('JAVA_HOME=/jdk', 'user');
    });

    act(() => {
      result.current.clearImportPreview();
    });

    expect(result.current.importPreview).toBeNull();
    expect(result.current.importPreviewStale).toBe(false);
  });

  it('clears preview and surfaces message when applyImportPreview returns a failed result', async () => {
    mockEnvvarPreviewImportEnvFile.mockResolvedValueOnce({
      scope: 'user',
      fingerprint: 'preview-fingerprint',
      additions: 1,
      updates: 0,
      noops: 0,
      invalid: 0,
      skipped: 0,
      items: [{ key: 'JAVA_HOME', value: '/jdk', action: 'add', reason: null }],
      primaryShellTarget: '/home/user/.bashrc',
      shellGuidance: [],
    });
    mockEnvvarApplyImportPreview.mockResolvedValueOnce({
      scope: 'user',
      imported: 0,
      skipped: 1,
      errors: ['failed'],
      success: false,
      verified: false,
      status: 'verification_failed',
      reasonCode: 'verification_failed',
      message: 'preview apply failed',
      primaryShellTarget: null,
      shellGuidance: [],
    });

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.previewImportEnvFile('JAVA_HOME=/jdk', 'user');
    });

    await act(async () => {
      await result.current.applyImportPreview('JAVA_HOME=/jdk', 'user', 'preview-fingerprint');
    });

    expect(result.current.error).toBe('preview apply failed');
    expect(result.current.importPreview).toBeNull();
    expect(result.current.importPreviewStale).toBe(false);
  });

  it('preserves preview when applyImportPreview returns null without a stale error', async () => {
    mockEnvvarPreviewImportEnvFile.mockResolvedValueOnce({
      scope: 'user',
      fingerprint: 'preview-fingerprint',
      additions: 1,
      updates: 0,
      noops: 0,
      invalid: 0,
      skipped: 0,
      items: [{ key: 'JAVA_HOME', value: '/jdk', action: 'add', reason: null }],
      primaryShellTarget: '/home/user/.bashrc',
      shellGuidance: [],
    });
    mockEnvvarApplyImportPreview.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.previewImportEnvFile('JAVA_HOME=/jdk', 'user');
    });

    await act(async () => {
      await result.current.applyImportPreview('JAVA_HOME=/jdk', 'user', 'preview-fingerprint');
    });

    expect(result.current.importPreview?.fingerprint).toBe('preview-fingerprint');
    expect(result.current.error).toBeNull();
  });

  it('stores backend message when direct import verification fails', async () => {
    mockEnvvarImportEnvFile.mockResolvedValueOnce({
      scope: 'process',
      imported: 0,
      skipped: 1,
      errors: ['invalid'],
      success: false,
      verified: false,
      status: 'verification_failed',
      reasonCode: 'verification_failed',
      message: 'direct import failed',
      primaryShellTarget: null,
      shellGuidance: [],
    });

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.importEnvFile('BROKEN', 'process');
    });

    expect(result.current.error).toBe('direct import failed');
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

  it('clears path repair preview state on demand', async () => {
    mockEnvvarPreviewPathRepair.mockResolvedValueOnce({
      scope: 'user',
      fingerprint: 'path-fingerprint',
      currentEntries: ['/missing', '/dup', '/dup'],
      repairedEntries: ['/dup'],
      duplicateCount: 1,
      missingCount: 1,
      removedCount: 2,
      primaryShellTarget: '/home/user/.bashrc',
      shellGuidance: [],
    });

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.previewPathRepair('user');
    });

    act(() => {
      result.current.clearPathRepairPreview();
    });

    expect(result.current.pathRepairPreview).toBeNull();
    expect(result.current.pathRepairPreviewStale).toBe(false);
  });

  it('stores backend messages for failed path mutations', async () => {
    mockEnvvarAddPathEntry.mockResolvedValueOnce({
      scope: 'process',
      operation: 'path_add',
      success: false,
      verified: false,
      status: 'verification_failed',
      reasonCode: 'verification_failed',
      message: 'path add failed',
      removedCount: 0,
      pathEntries: [],
      primaryShellTarget: null,
      shellGuidance: [],
    });
    mockEnvvarRemovePathEntry.mockResolvedValueOnce({
      scope: 'process',
      operation: 'path_remove',
      success: false,
      verified: false,
      status: 'verification_failed',
      reasonCode: 'verification_failed',
      message: 'path remove failed',
      removedCount: 0,
      pathEntries: [],
      primaryShellTarget: null,
      shellGuidance: [],
    });
    mockEnvvarReorderPath.mockResolvedValueOnce({
      scope: 'process',
      operation: 'path_reorder',
      success: false,
      verified: false,
      status: 'verification_failed',
      reasonCode: 'verification_failed',
      message: 'path reorder failed',
      removedCount: 0,
      pathEntries: [],
      primaryShellTarget: null,
      shellGuidance: [],
    });

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.addPathEntry('/broken', 'process');
    });
    expect(result.current.error).toBe('path add failed');

    await act(async () => {
      await result.current.removePathEntry('/broken', 'process');
    });
    expect(result.current.error).toBe('path remove failed');

    await act(async () => {
      await result.current.reorderPath(['/broken'], 'process');
    });
    expect(result.current.error).toBe('path reorder failed');
  });

  it('returns a structured shell profile read result and handles errors', async () => {
    mockEnvvarReadShellProfile
      .mockResolvedValueOnce({
        path: '/home/user/.bashrc',
        content: 'export JAVA_HOME="/jdk"',
        redacted: false,
        sensitiveCount: 0,
      })
      .mockRejectedValueOnce(new Error('sensitive read failed'));

    const { result } = renderHook(() => useEnvVar());

    let readResult: unknown = null;
    await act(async () => {
      readResult = await result.current.readShellProfileResult('/home/user/.bashrc', true);
    });

    expect(readResult).toMatchObject({
      content: 'export JAVA_HOME="/jdk"',
      redacted: false,
    });
    expect(mockEnvvarReadShellProfile).toHaveBeenNthCalledWith(1, '/home/user/.bashrc', true);

    let failedRead: unknown = 'pending';
    await act(async () => {
      failedRead = await result.current.readShellProfileResult('/home/user/.bashrc', true);
    });

    expect(failedRead).toBeNull();
    expect(result.current.error).toBe('Error: sensitive read failed');
  });

  it('stores backend mutation messages when variable verification fails', async () => {
    mockEnvvarSetProcess.mockResolvedValueOnce({
      operation: 'set',
      key: 'BROKEN',
      scope: 'process',
      success: false,
      verified: false,
      status: 'verification_failed',
      reasonCode: 'verification_failed',
      message: 'set verification failed',
      effectiveValueSummary: null,
      primaryShellTarget: null,
      shellGuidance: [],
    });
    mockEnvvarRemovePersistent.mockResolvedValueOnce({
      operation: 'remove',
      key: 'BROKEN',
      scope: 'user',
      success: false,
      verified: false,
      status: 'verification_failed',
      reasonCode: 'verification_failed',
      message: 'remove verification failed',
      effectiveValueSummary: null,
      primaryShellTarget: null,
      shellGuidance: [],
    });

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.setVar('BROKEN', '1', 'process');
    });
    expect(result.current.error).toBe('set verification failed');

    await act(async () => {
      await result.current.removeVar('BROKEN', 'user');
    });
    expect(result.current.error).toBe('remove verification failed');
  });

  it('stores and clears revealed values per scope', async () => {
    mockEnvvarRevealValue
      .mockResolvedValueOnce({ key: 'API_TOKEN', scope: 'user', value: 'secret-user-token' })
      .mockResolvedValueOnce({ key: 'API_TOKEN', scope: 'system', value: 'secret-system-token' });

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.revealVar('API_TOKEN', 'user');
      await result.current.revealVar('API_TOKEN', 'system');
    });

    expect(result.current.revealedValues).toMatchObject({
      'user:API_TOKEN': 'secret-user-token',
      'system:API_TOKEN': 'secret-system-token',
    });

    act(() => {
      result.current.clearRevealedVar('API_TOKEN', 'user');
    });

    expect(result.current.revealedValues).toMatchObject({
      'system:API_TOKEN': 'secret-system-token',
    });
    expect(result.current.revealedValues).not.toHaveProperty('user:API_TOKEN');
  });

  it('surfaces reveal failures', async () => {
    mockEnvvarRevealValue.mockRejectedValueOnce(new Error('reveal failed'));

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.revealVar('API_TOKEN', 'user');
    });

    expect(result.current.error).toBe('Error: reveal failed');
  });

  it('returns global and scoped action support entries', async () => {
    mockEnvvarGetSupportSnapshot.mockResolvedValueOnce({
      state: 'degraded',
      reasonCode: 'degraded',
      reason: 'degraded',
      platform: 'linux',
      detectedShells: 1,
      primaryShellTarget: '/home/user/.bashrc',
      actions: [
        {
          action: 'refresh',
          scope: null,
          supported: true,
          state: 'ready',
          reasonCode: 'ready',
          reason: 'ready',
          nextSteps: [],
        },
        {
          action: 'set',
          scope: 'system',
          supported: false,
          state: 'blocked',
          reasonCode: 'blocked',
          reason: 'blocked',
          nextSteps: ['retry'],
        },
      ],
    });

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.loadSupportSnapshot();
    });

    expect(result.current.getActionSupport('refresh')).toMatchObject({
      action: 'refresh',
      scope: null,
    });
    expect(result.current.getActionSupport('set', 'system')).toMatchObject({
      action: 'set',
      scope: 'system',
      supported: false,
    });
    expect(result.current.getActionSupport('set', 'all')).toBeNull();
  });

  it('returns null and surfaces errors when conflict resolution fails early', async () => {
    mockEnvvarResolveConflict
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        key: 'JAVA_HOME',
        sourceScope: 'system',
        targetScope: 'user',
        appliedValue: '/jdk-21',
        success: false,
        verified: false,
        status: 'verification_failed',
        reasonCode: 'verification_failed',
        message: 'conflict resolution failed',
        primaryShellTarget: null,
        shellGuidance: [],
      })
      .mockRejectedValueOnce(new Error('conflict resolve exploded'));

    const { result } = renderHook(() => useEnvVar());

    let nullResult: unknown = 'pending';
    await act(async () => {
      nullResult = await result.current.resolveConflict('JAVA_HOME', 'system', 'user');
    });
    expect(nullResult).toBeNull();

    await act(async () => {
      await result.current.resolveConflict('JAVA_HOME', 'system', 'user');
    });
    expect(result.current.error).toBe('conflict resolution failed');

    await act(async () => {
      await result.current.resolveConflict('JAVA_HOME', 'system', 'user');
    });
    expect(result.current.error).toBe('Error: conflict resolve exploded');
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
