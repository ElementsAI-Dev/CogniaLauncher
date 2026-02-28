import { renderHook, act, waitFor } from '@testing-library/react';
import { useBackup } from './use-backup';

const mockBackupCreate = jest.fn();
const mockBackupRestore = jest.fn();
const mockBackupList = jest.fn();
const mockBackupDelete = jest.fn();
const mockBackupValidate = jest.fn();
const mockBackupExport = jest.fn();
const mockBackupImport = jest.fn();
const mockBackupCleanup = jest.fn();
const mockDbIntegrityCheck = jest.fn();
const mockDbGetInfo = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(() => true),
  backupCreate: (...args: unknown[]) => mockBackupCreate(...args),
  backupRestore: (...args: unknown[]) => mockBackupRestore(...args),
  backupList: (...args: unknown[]) => mockBackupList(...args),
  backupDelete: (...args: unknown[]) => mockBackupDelete(...args),
  backupValidate: (...args: unknown[]) => mockBackupValidate(...args),
  backupExport: (...args: unknown[]) => mockBackupExport(...args),
  backupImport: (...args: unknown[]) => mockBackupImport(...args),
  backupCleanup: (...args: unknown[]) => mockBackupCleanup(...args),
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

  it('should export backup', async () => {
    mockBackupExport.mockResolvedValue(2048);
    mockBackupList.mockResolvedValue([]);

    const { result } = renderHook(() => useBackup());

    let size;
    await act(async () => {
      size = await result.current.exportBackup('/backup1', '/dest/backup.zip');
    });

    expect(size).toBe(2048);
    expect(mockBackupExport).toHaveBeenCalledWith('/backup1', '/dest/backup.zip');
  });

  it('should handle export error', async () => {
    mockBackupExport.mockRejectedValue(new Error('Export failed'));
    mockBackupList.mockResolvedValue([]);

    const { result } = renderHook(() => useBackup());

    let size;
    await act(async () => {
      size = await result.current.exportBackup('/backup1', '/dest/backup.zip');
    });

    expect(size).toBe(0);
    expect(result.current.error).toBe('Export failed');
  });

  it('should import backup and refresh', async () => {
    const importedInfo = { path: '/backups/imported', name: 'imported', size: 512 };
    mockBackupImport.mockResolvedValue(importedInfo);
    mockBackupList.mockResolvedValue([]);

    const { result } = renderHook(() => useBackup());

    let info;
    await act(async () => {
      info = await result.current.importBackup('/path/to/backup.zip');
    });

    expect(info).toEqual(importedInfo);
    expect(mockBackupImport).toHaveBeenCalledWith('/path/to/backup.zip');
    // Should have refreshed after import
    expect(mockBackupList).toHaveBeenCalledTimes(2); // once on mount + once after import
  });

  it('should handle import error', async () => {
    mockBackupImport.mockRejectedValue(new Error('Invalid ZIP'));
    mockBackupList.mockResolvedValue([]);

    const { result } = renderHook(() => useBackup());

    let info;
    await act(async () => {
      info = await result.current.importBackup('/bad.zip');
    });

    expect(info).toBeNull();
    expect(result.current.error).toBe('Invalid ZIP');
  });

  it('should cleanup old backups', async () => {
    mockBackupCleanup.mockResolvedValue(3);
    mockBackupList.mockResolvedValue([]);

    const { result } = renderHook(() => useBackup());

    let deleted;
    await act(async () => {
      deleted = await result.current.cleanup(5, 30);
    });

    expect(deleted).toBe(3);
    expect(mockBackupCleanup).toHaveBeenCalledWith(5, 30);
    // Should have refreshed since deleted > 0
    expect(mockBackupList).toHaveBeenCalledTimes(2);
  });

  it('should handle cleanup with zero deletions (no refresh)', async () => {
    mockBackupCleanup.mockResolvedValue(0);
    mockBackupList.mockResolvedValue([]);

    const { result } = renderHook(() => useBackup());

    // Wait for initial mount refresh
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const callsBefore = mockBackupList.mock.calls.length;

    await act(async () => {
      await result.current.cleanup(10, 0);
    });

    // Should NOT have refreshed since deleted === 0
    expect(mockBackupList).toHaveBeenCalledTimes(callsBefore);
  });

  it('should handle cleanup error', async () => {
    mockBackupCleanup.mockRejectedValue(new Error('Cleanup failed'));
    mockBackupList.mockResolvedValue([]);

    const { result } = renderHook(() => useBackup());

    let deleted;
    await act(async () => {
      deleted = await result.current.cleanup(5, 30);
    });

    expect(deleted).toBe(0);
    expect(result.current.error).toBe('Cleanup failed');
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
      const exported = await result.current.exportBackup('/b', '/out.zip');
      const imported = await result.current.importBackup('/in.zip');
      const cleaned = await result.current.cleanup(5, 30);
      const integrity = await result.current.checkIntegrity();
      const dbInfo = await result.current.getDatabaseInfo();

      expect(created).toBeNull();
      expect(restored).toBeNull();
      expect(deleted).toBe(false);
      expect(validated).toBeNull();
      expect(exported).toBe(0);
      expect(imported).toBeNull();
      expect(cleaned).toBe(0);
      expect(integrity).toBeNull();
      expect(dbInfo).toBeNull();
    });

    tauriMock.isTauri.mockReturnValue(true);
  });
});
