'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  profileList,
  profileGet,
  profileCreate,
  profileUpdate,
  profileDelete,
  profileApply,
  profileExport,
  profileImport,
  profileCreateFromCurrent,
  type EnvironmentProfile,
  type ProfileEnvironment,
  type ProfileApplyResult,
} from '@/lib/tauri';
import { isTauri } from '@/lib/tauri';

interface UseProfilesReturn {
  profiles: EnvironmentProfile[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getProfile: (id: string) => Promise<EnvironmentProfile | null>;
  createProfile: (
    name: string,
    description: string | null,
    environments: ProfileEnvironment[]
  ) => Promise<EnvironmentProfile | null>;
  updateProfile: (profile: EnvironmentProfile) => Promise<EnvironmentProfile | null>;
  deleteProfile: (id: string) => Promise<boolean>;
  applyProfile: (id: string) => Promise<ProfileApplyResult | null>;
  exportProfile: (id: string) => Promise<string | null>;
  importProfile: (json: string) => Promise<EnvironmentProfile | null>;
  createFromCurrent: (name: string) => Promise<EnvironmentProfile | null>;
}

/**
 * Hook for managing environment profiles
 */
export function useProfiles(): UseProfilesReturn {
  const [profiles, setProfiles] = useState<EnvironmentProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isTauri()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await profileList();
      setProfiles(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const getProfile = useCallback(async (id: string): Promise<EnvironmentProfile | null> => {
    if (!isTauri()) {
      return null;
    }

    try {
      return await profileGet(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, []);

  const createProfile = useCallback(
    async (
      name: string,
      description: string | null,
      environments: ProfileEnvironment[]
    ): Promise<EnvironmentProfile | null> => {
      if (!isTauri()) {
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await profileCreate(name, description, environments);
        await refresh();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [refresh]
  );

  const updateProfile = useCallback(
    async (profile: EnvironmentProfile): Promise<EnvironmentProfile | null> => {
      if (!isTauri()) {
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await profileUpdate(profile);
        await refresh();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [refresh]
  );

  const deleteProfile = useCallback(
    async (id: string): Promise<boolean> => {
      if (!isTauri()) {
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        await profileDelete(id);
        await refresh();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setLoading(false);
      }
    },
    [refresh]
  );

  const applyProfile = useCallback(async (id: string): Promise<ProfileApplyResult | null> => {
    if (!isTauri()) {
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      return await profileApply(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const exportProfileFn = useCallback(async (id: string): Promise<string | null> => {
    if (!isTauri()) {
      return null;
    }

    try {
      return await profileExport(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, []);

  const importProfileFn = useCallback(
    async (json: string): Promise<EnvironmentProfile | null> => {
      if (!isTauri()) {
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await profileImport(json);
        await refresh();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [refresh]
  );

  const createFromCurrent = useCallback(
    async (name: string): Promise<EnvironmentProfile | null> => {
      if (!isTauri()) {
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await profileCreateFromCurrent(name);
        await refresh();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [refresh]
  );

  // Load profiles on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    profiles,
    loading,
    error,
    refresh,
    getProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    applyProfile,
    exportProfile: exportProfileFn,
    importProfile: importProfileFn,
    createFromCurrent,
  };
}
