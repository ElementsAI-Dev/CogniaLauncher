import { useState, useCallback } from 'react';
import * as tauri from '@/lib/tauri';
import type {
  RustComponent,
  RustTarget,
  RustupShowInfo,
  RustupOverride,
  RustupOperationError,
  RustupOperationResult,
  RustupScopedListResult,
  RustupProfileResult,
} from '@/types/tauri';

export interface UseRustupReturn {
  // State
  components: RustComponent[];
  targets: RustTarget[];
  overrides: RustupOverride[];
  showInfo: RustupShowInfo | null;
  profile: string | null;
  loading: boolean;
  error: string | null;
  lastOperationError: RustupOperationError | null;

  // Component management
  listComponents: (toolchain?: string) => Promise<RustComponent[]>;
  addComponent: (component: string, toolchain?: string) => Promise<void>;
  removeComponent: (component: string, toolchain?: string) => Promise<void>;

  // Target management
  listTargets: (toolchain?: string) => Promise<RustTarget[]>;
  addTarget: (target: string, toolchain?: string) => Promise<void>;
  removeTarget: (target: string, toolchain?: string) => Promise<void>;

  // Override management
  overrideSet: (toolchain: string, path?: string) => Promise<void>;
  overrideUnset: (path?: string) => Promise<void>;
  overrideList: () => Promise<RustupOverride[]>;

  // Info & updates
  show: () => Promise<RustupShowInfo>;
  selfUpdate: () => Promise<void>;
  updateAll: () => Promise<string>;

  // Run & which
  run: (toolchain: string, command: string, args?: string[]) => Promise<string>;
  which: (binary: string) => Promise<string>;

  // Profile
  getProfile: () => Promise<string>;
  setProfile: (profile: string) => Promise<void>;

  // Refresh all state
  refreshAll: () => Promise<void>;
}

/**
 * Hook for managing Rust toolchains via rustup.
 *
 * Provides state and actions for:
 * - Component management (list, add, remove)
 * - Target management (list, add, remove)
 * - Override management (set, unset, list)
 * - Toolchain info and updates
 * - Running commands with specific toolchains
 * - Profile management
 */
export function useRustup(): UseRustupReturn {
  const [components, setComponents] = useState<RustComponent[]>([]);
  const [targets, setTargets] = useState<RustTarget[]>([]);
  const [overrides, setOverrides] = useState<RustupOverride[]>([]);
  const [showInfo, setShowInfo] = useState<RustupShowInfo | null>(null);
  const [profile, setProfileState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOperationError, setLastOperationError] =
    useState<RustupOperationError | null>(null);

  const withLoading = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T> => {
      setLoading(true);
      setError(null);
      try {
        return await fn();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const throwRustupError = useCallback((fallbackMessage: string, detail?: RustupOperationError | null): never => {
    const message = detail
      ? `${detail.class}: ${detail.message}${detail.retryable ? ' (retryable)' : ''}`
      : fallbackMessage;
    if (detail) {
      setLastOperationError(detail);
    }
    throw new Error(message);
  }, []);

  const requireRustupListSuccess = useCallback(
    <T,>(result: RustupScopedListResult<T>, fallbackMessage: string): T[] => {
      if (!result.success) {
        return throwRustupError(fallbackMessage, result.error ?? null);
      }
      setLastOperationError(null);
      return result.items;
    },
    [throwRustupError],
  );

  const requireRustupOperationSuccess = useCallback(
    (result: RustupOperationResult, fallbackMessage: string): void => {
      if (!result.success) {
        return throwRustupError(fallbackMessage, result.error ?? null);
      }
      setLastOperationError(null);
    },
    [throwRustupError],
  );

  const requireRustupProfileSuccess = useCallback(
    (result: RustupProfileResult, fallbackMessage: string): string => {
      if (!result.success || !result.profile) {
        return throwRustupError(fallbackMessage, result.error ?? null);
      }
      setLastOperationError(null);
      return result.profile;
    },
    [throwRustupError],
  );

  // ── Component management ──

  const listComponents = useCallback(
    async (toolchain?: string): Promise<RustComponent[]> => {
      return withLoading(async () => {
        const result = await tauri.rustupListComponents(toolchain);
        const items = requireRustupListSuccess(
          result,
          'Failed to list rustup components',
        );
        setComponents(items);
        return items;
      });
    },
    [requireRustupListSuccess, withLoading],
  );

  const addComponent = useCallback(
    async (component: string, toolchain?: string): Promise<void> => {
      await withLoading(async () => {
        const result = await tauri.rustupAddComponent(component, toolchain);
        requireRustupOperationSuccess(result, 'Failed to add rustup component');
      });
    },
    [requireRustupOperationSuccess, withLoading],
  );

  const removeComponent = useCallback(
    async (component: string, toolchain?: string): Promise<void> => {
      await withLoading(async () => {
        const result = await tauri.rustupRemoveComponent(component, toolchain);
        requireRustupOperationSuccess(
          result,
          'Failed to remove rustup component',
        );
      });
    },
    [requireRustupOperationSuccess, withLoading],
  );

  // ── Target management ──

  const listTargets = useCallback(
    async (toolchain?: string): Promise<RustTarget[]> => {
      return withLoading(async () => {
        const result = await tauri.rustupListTargets(toolchain);
        const items = requireRustupListSuccess(
          result,
          'Failed to list rustup targets',
        );
        setTargets(items);
        return items;
      });
    },
    [requireRustupListSuccess, withLoading],
  );

  const addTarget = useCallback(
    async (target: string, toolchain?: string): Promise<void> => {
      await withLoading(async () => {
        const result = await tauri.rustupAddTarget(target, toolchain);
        requireRustupOperationSuccess(result, 'Failed to add rustup target');
      });
    },
    [requireRustupOperationSuccess, withLoading],
  );

  const removeTarget = useCallback(
    async (target: string, toolchain?: string): Promise<void> => {
      await withLoading(async () => {
        const result = await tauri.rustupRemoveTarget(target, toolchain);
        requireRustupOperationSuccess(result, 'Failed to remove rustup target');
      });
    },
    [requireRustupOperationSuccess, withLoading],
  );

  // ── Override management ──

  const overrideSet = useCallback(
    async (toolchain: string, path?: string): Promise<void> => {
      await withLoading(async () => {
        const result = await tauri.rustupOverrideSet(toolchain, path);
        requireRustupOperationSuccess(result, 'Failed to set rustup override');
      });
    },
    [requireRustupOperationSuccess, withLoading],
  );

  const overrideUnset = useCallback(
    async (path?: string): Promise<void> => {
      await withLoading(async () => {
        const result = await tauri.rustupOverrideUnset(path);
        requireRustupOperationSuccess(result, 'Failed to unset rustup override');
      });
    },
    [requireRustupOperationSuccess, withLoading],
  );

  const overrideList = useCallback(async (): Promise<RustupOverride[]> => {
    return withLoading(async () => {
      const result = await tauri.rustupOverrideList();
      const items = requireRustupListSuccess(
        result,
        'Failed to list rustup overrides',
      );
      setOverrides(items);
      return items;
    });
  }, [requireRustupListSuccess, withLoading]);

  // ── Info & updates ──

  const show = useCallback(async (): Promise<RustupShowInfo> => {
    return withLoading(async () => {
      const result = await tauri.rustupShow();
      setShowInfo(result);
      return result;
    });
  }, [withLoading]);

  const selfUpdate = useCallback(async (): Promise<void> => {
    await withLoading(() => tauri.rustupSelfUpdate());
  }, [withLoading]);

  const updateAll = useCallback(async (): Promise<string> => {
    return withLoading(() => tauri.rustupUpdateAll());
  }, [withLoading]);

  // ── Run & which ──

  const run = useCallback(
    async (
      toolchain: string,
      command: string,
      args?: string[],
    ): Promise<string> => {
      return withLoading(() => tauri.rustupRun(toolchain, command, args));
    },
    [withLoading],
  );

  const which = useCallback(
    async (binary: string): Promise<string> => {
      return withLoading(() => tauri.rustupWhich(binary));
    },
    [withLoading],
  );

  // ── Profile ──

  const getProfile = useCallback(async (): Promise<string> => {
    return withLoading(async () => {
      const result = await tauri.rustupGetProfile();
      const profileValue = requireRustupProfileSuccess(
        result,
        'Failed to get rustup profile',
      );
      setProfileState(profileValue);
      return profileValue;
    });
  }, [requireRustupProfileSuccess, withLoading]);

  const setProfile = useCallback(
    async (newProfile: string): Promise<void> => {
      await withLoading(async () => {
        const result = await tauri.rustupSetProfile(newProfile);
        requireRustupOperationSuccess(result, 'Failed to set rustup profile');
        setProfileState(newProfile.trim().toLowerCase());
      });
    },
    [requireRustupOperationSuccess, withLoading],
  );

  // ── Refresh all ──

  const refreshAll = useCallback(async (): Promise<void> => {
    if (!tauri.isTauri()) return;
    setLoading(true);
    setError(null);
    try {
      const [comps, tgts, ovrs, info, prof] = await Promise.all([
        tauri.rustupListComponents().then((r) => r.items).catch(() => [] as RustComponent[]),
        tauri.rustupListTargets().then((r) => r.items).catch(() => [] as RustTarget[]),
        tauri.rustupOverrideList().then((r) => r.items).catch(() => [] as RustupOverride[]),
        tauri.rustupShow().catch(() => null),
        tauri.rustupGetProfile().then((r) => (r.success ? (r.profile ?? null) : null)).catch(() => null),
      ]);
      setComponents(comps);
      setTargets(tgts);
      setOverrides(ovrs);
      setShowInfo(info);
      setProfileState(prof);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    components,
    targets,
    overrides,
    showInfo,
    profile,
    loading,
    error,
    lastOperationError,
    listComponents,
    addComponent,
    removeComponent,
    listTargets,
    addTarget,
    removeTarget,
    overrideSet,
    overrideUnset,
    overrideList,
    show,
    selfUpdate,
    updateAll,
    run,
    which,
    getProfile,
    setProfile,
    refreshAll,
  };
}
