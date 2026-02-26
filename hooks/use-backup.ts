'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  backupCreate,
  backupRestore,
  backupList,
  backupDelete,
  backupValidate,
  dbIntegrityCheck,
  dbGetInfo,
  isTauri,
} from '@/lib/tauri';
import type {
  BackupContentType,
  BackupInfo,
  BackupResult,
  RestoreResult,
  BackupValidationResult,
  IntegrityCheckResult,
  DatabaseInfo,
} from '@/types/tauri';

interface UseBackupReturn {
  backups: BackupInfo[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  restoring: boolean;
  refresh: () => Promise<void>;
  create: (contents: BackupContentType[], note?: string) => Promise<BackupResult | null>;
  restore: (backupPath: string, contents: BackupContentType[]) => Promise<RestoreResult | null>;
  remove: (backupPath: string) => Promise<boolean>;
  validate: (backupPath: string) => Promise<BackupValidationResult | null>;
  checkIntegrity: () => Promise<IntegrityCheckResult | null>;
  getDatabaseInfo: () => Promise<DatabaseInfo | null>;
}

export function useBackup(): UseBackupReturn {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const refresh = useCallback(async () => {
    if (!isTauri()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await backupList();
      setBackups(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (contents: BackupContentType[], note?: string): Promise<BackupResult | null> => {
      if (!isTauri()) return null;
      setCreating(true);
      setError(null);
      try {
        const result = await backupCreate(contents, note);
        await refresh();
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        return null;
      } finally {
        setCreating(false);
      }
    },
    [refresh],
  );

  const restore = useCallback(
    async (backupPath: string, contents: BackupContentType[]): Promise<RestoreResult | null> => {
      if (!isTauri()) return null;
      setRestoring(true);
      setError(null);
      try {
        const result = await backupRestore(backupPath, contents);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        return null;
      } finally {
        setRestoring(false);
      }
    },
    [],
  );

  const remove = useCallback(
    async (backupPath: string): Promise<boolean> => {
      if (!isTauri()) return false;
      setError(null);
      try {
        const result = await backupDelete(backupPath);
        await refresh();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      }
    },
    [refresh],
  );

  const validateBackup = useCallback(
    async (backupPath: string): Promise<BackupValidationResult | null> => {
      if (!isTauri()) return null;
      try {
        return await backupValidate(backupPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [],
  );

  const checkIntegrity = useCallback(async (): Promise<IntegrityCheckResult | null> => {
    if (!isTauri()) return null;
    try {
      return await dbIntegrityCheck();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, []);

  const getDatabaseInfo = useCallback(async (): Promise<DatabaseInfo | null> => {
    if (!isTauri()) return null;
    try {
      return await dbGetInfo();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, []);

  return {
    backups,
    loading,
    error,
    creating,
    restoring,
    refresh,
    create,
    restore,
    remove,
    validate: validateBackup,
    checkIntegrity,
    getDatabaseInfo,
  };
}
