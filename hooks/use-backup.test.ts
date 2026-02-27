import { renderHook, act, waitFor } from '@testing-library/react';
import { useBackup } from './use-backup';

const mockBackupCreate = jest.fn();
const mockBackupRestore = jest.fn();
const mockBackupList = jest.fn();
const mockBackupDelete = jest.fn();
const mockBackupValidate = jest.fn();
const mockDbIntegrityCheck = jest.fn();
const mockDbGetInfo = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(() => true),
  backupCreate: (...args: unknown[]) => mockBackupCreate(...args),
  backupRestore: (...args: unknown[]) => mockBackupRestore(...args),
  backupList: (...args: unknown[]) => mockBackupList(...args),
  backupDelete: (...args: unknown[]) => mockBackupDelete(...args),
  backupValidate: (...args: unknown[]) => mockBackupValidate(...args),
  dbIntegrityCheck: (...args: unknown[]) => mockDbIntegrityCheck(...args),
  dbGetInfo: (...args: unknown[]) => mockDbGetInfo(...args),
}));

describe('useBackup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBackupList.mockResolvedValue([]);
  });

  it('should initialize with default state and auto-refresh', async () => {
    mockBackupList.mockResolvedValue([]);

    const { result } = renderHook(() => useBackup());

    // Auto-refresh runs on mount, wait for it to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.backups).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.creating).toBe(false);
    expect(result.current.restoring).toBe(false);
  });

  it('should auto-refresh on mount', async () => {
    const backups = [{ path: '/backup1', date: '2025-01-01' }];
    mockBackupList.mockResolvedValue(backups);

    const { result } = renderHook(() => useBackup());

    await waitFor(() => {
      expect(result.current.backups).toEqual(backups);
    });
    expect(mockBackupList).toHaveBeenCalled();
  });

  it('should refresh backups', async () => {
    const backups = [{ path: '/b1' }, { path: '/b2' }];
    mockBackupList.mockResolvedValue(backups);

    const { result } = renderHook(() => useBackup());

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.backups).toEqual(backups);
  });

  it('should handle refresh error', async () => {
    mockBackupList.mockRejectedValue(new Error('List failed'));

    const { result } = renderHook(() => useBackup());

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBe('List failed');
    expect(result.current.loading).toBe(false);
  });

  it('should create backup', async () => {
    const backupResult = { path: '/new-backup', size: 1024 };
    mockBackupCreate.mockResolvedValue(backupResult);
    mockBackupList.mockResolvedValue([]);

    const { result } = renderHook(() => useBackup());

    let created;
    await act(async () => {
      created = await result.current.create(['settings', 'environments'] as never[], 'test note');
    });

    expect(created).toEqual(backupResult);
    expect(mockBackupCreate).toHaveBeenCalledWith(['settings', 'environments'], 'test note');
    expect(result.current.creating).toBe(false);
  });

  it('should handle create error', async () => {
    mockBackupCreate.mockRejectedValue(new Error('Create failed'));
    mockBackupList.mockResolvedValue([]);

    const { result } = renderHook(() => useBackup());

    let created;
    await act(async () => {
      created = await result.current.create(['settings'] as never[]);
    });

    expect(created).toBeNull();
    expect(result.current.error).toBe('Create failed');
    expect(result.current.creating).toBe(false);
  });

  it('should restore backup', async () => {
    const restoreResult = { success: true, restoredItems: 5 };
    mockBackupRestore.mockResolvedValue(restoreResult);
    mockBackupList.mockResolvedValue([]);

    const { result } = renderHook(() => useBackup());

    let restored;
    await act(async () => {
      restored = await result.current.restore('/backup1', ['settings'] as never[]);
    });

    expect(restored).toEqual(restoreResult);
    expect(mockBackupRestore).toHaveBeenCalledWith('/backup1', ['settings']);
    expect(result.current.restoring).toBe(false);
  });

  it('should handle restore error', async () => {
    mockBackupRestore.mockRejectedValue(new Error('Restore failed'));
    mockBackupList.mockResolvedValue([]);

    const { result } = renderHook(() => useBackup());

    let restored;
    await act(async () => {
      restored = await result.current.restore('/backup1', ['settings'] as never[]);
    });

    expect(restored).toBeNull();
    expect(result.current.error).toBe('Restore failed');
  });

  it('should delete backup and refresh', async () => {
    mockBackupDelete.mockResolvedValue(true);
    mockBackupList.mockResolvedValue([]);

    const { result } = renderHook(() => useBackup());

    let deleted;
    await act(async () => {
      deleted = await result.current.remove('/backup1');
    });

    expect(deleted).toBe(true);
    expect(mockBackupDelete).toHaveBeenCalledWith('/backup1');
  });

  it('should handle delete error', async () => {
    mockBackupDelete.mockRejectedValue(new Error('Delete failed'));
    mockBackupList.mockResolvedValue([]);

    const { result } = renderHook(() => useBackup());

    let deleted;
    await act(async () => {
      deleted = await result.current.remove('/backup1');
    });

    expect(deleted).toBe(false);
    expect(result.current.error).toBe('Delete failed');
  });

  it('should validate backup', async () => {
    const validationResult = { valid: true, issues: [] };
    mockBackupValidate.mockResolvedValue(validationResult);
    mockBackupList.mockResolvedValue([]);

    const { result } = renderHook(() => useBackup());

    let validated;
    await act(async () => {
      validated = await result.current.validate('/backup1');
    });

    expect(validated).toEqual(validationResult);
    expect(mockBackupValidate).toHaveBeenCalledWith('/backup1');
  });

  it('should handle validate error', async () => {
    mockBackupValidate.mockRejectedValue(new Error('Validation failed'));
    mockBackupList.mockResolvedValue([]);

    const { result } = renderHook(() => useBackup());

    let validated;
    await act(async () => {
      validated = await result.current.validate('/backup1');
    });

    expect(validated).toBeNull();
    expect(result.current.error).toBe('Validation failed');
  });

  it('should check integrity', async () => {
    const integrityResult = { ok: true, tables: 10, errors: [] };
    mockDbIntegrityCheck.mockResolvedValue(integrityResult);
    mockBackupList.mockResolvedValue([]);

    const { result } = renderHook(() => useBackup());

    let integrity;
    await act(async () => {
      integrity = await result.current.checkIntegrity();
    });

    expect(integrity).toEqual(integrityResult);
  });

  it('should get database info', async () => {
    const dbInfo = { size: 1024, tables: 5, version: '1.0' };
    mockDbGetInfo.mockResolvedValue(dbInfo);
    mockBackupList.mockResolvedValue([]);

    const { result } = renderHook(() => useBackup());

    let info;
    await act(async () => {
      info = await result.current.getDatabaseInfo();
    });

    expect(info).toEqual(dbInfo);
  });

  it('should return null for all actions when not in Tauri', async () => {
    const tauriMock = jest.requireMock('@/lib/tauri');
    tauriMock.isTauri.mockReturnValue(false);

    const { result } = renderHook(() => useBackup());

    await act(async () => {
      const created = await result.current.create(['settings'] as never[]);
      const restored = await result.current.restore('/b', ['settings'] as never[]);
      const deleted = await result.current.remove('/b');
      const validated = await result.current.validate('/b');
      const integrity = await result.current.checkIntegrity();
      const dbInfo = await result.current.getDatabaseInfo();

      expect(created).toBeNull();
      expect(restored).toBeNull();
      expect(deleted).toBe(false);
      expect(validated).toBeNull();
      expect(integrity).toBeNull();
      expect(dbInfo).toBeNull();
    });

    tauriMock.isTauri.mockReturnValue(true);
  });
});
