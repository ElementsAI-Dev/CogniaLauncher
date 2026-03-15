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
import { useEnvironmentWorkflow } from '@/hooks/use-environment-workflow';

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
  const { setWorkflowActionState, reconcileEnvironmentWorkflow } = useEnvironmentWorkflow();

  const resolveApplyWorkflowTarget = useCallback((
    profileId: string,
    result?: ProfileApplyResult | null,
  ) => {
    const profile = profiles.find((candidate) => candidate.id === profileId) ?? null;
    const resultTarget =
      result?.successful[0]
      ?? result?.failed[0]
      ?? result?.skipped[0]
      ?? null;
    const profileTarget = profile?.environments[0] ?? null;

    if (!resultTarget && !profileTarget) {
      return null;
    }

    return {
      envType: resultTarget?.env_type ?? profileTarget?.env_type ?? null,
      providerId: resultTarget?.provider_id ?? profileTarget?.provider_id ?? null,
    };
  }, [profiles]);

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

    const initialTarget = resolveApplyWorkflowTarget(id);
    if (initialTarget?.envType) {
      setWorkflowActionState(initialTarget.envType, 'applyProfile', 'running', {
        providerId: initialTarget.providerId,
      });
    }

    try {
      const result = await profileApply(id);
      const completedTarget = resolveApplyWorkflowTarget(id, result) ?? initialTarget;
      await reconcileEnvironmentWorkflow();

      if (completedTarget?.envType) {
        const failedCount = result.failed.length;
        const skippedCount = result.skipped.length;
        const failureMessage = failedCount > 0
          ? `${failedCount} environment(s) failed while applying this profile.`
          : skippedCount > 0
            ? `${skippedCount} environment(s) were skipped while applying this profile.`
            : null;

        setWorkflowActionState(
          completedTarget.envType,
          'applyProfile',
          failedCount > 0 ? 'error' : 'success',
          {
            providerId: completedTarget.providerId,
            error: failureMessage,
            retryable: failedCount > 0,
          },
        );
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const failedTarget = resolveApplyWorkflowTarget(id) ?? initialTarget;
      if (failedTarget?.envType) {
        setWorkflowActionState(failedTarget.envType, 'applyProfile', 'error', {
          providerId: failedTarget.providerId,
          error: errorMessage,
          retryable: true,
        });
      }
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [reconcileEnvironmentWorkflow, resolveApplyWorkflowTarget, setWorkflowActionState]);

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
