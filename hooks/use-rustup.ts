import { useState, useCallback } from 'react';
import * as tauri from '@/lib/tauri';
import type {
  RustComponent,
  RustTarget,
  RustupShowInfo,
  RustupOverride,
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

  // ── Component management ──

  const listComponents = useCallback(
    async (toolchain?: string): Promise<RustComponent[]> => {
      return withLoading(async () => {
        const result = await tauri.rustupListComponents(toolchain);
        setComponents(result);
        return result;
      });
    },
    [withLoading],
  );

  const addComponent = useCallback(
    async (component: string, toolchain?: string): Promise<void> => {
      await withLoading(() => tauri.rustupAddComponent(component, toolchain));
    },
    [withLoading],
  );

  const removeComponent = useCallback(
    async (component: string, toolchain?: string): Promise<void> => {
      await withLoading(() =>
        tauri.rustupRemoveComponent(component, toolchain),
      );
    },
    [withLoading],
  );

  // ── Target management ──

  const listTargets = useCallback(
    async (toolchain?: string): Promise<RustTarget[]> => {
      return withLoading(async () => {
        const result = await tauri.rustupListTargets(toolchain);
        setTargets(result);
        return result;
      });
    },
    [withLoading],
  );

  const addTarget = useCallback(
    async (target: string, toolchain?: string): Promise<void> => {
      await withLoading(() => tauri.rustupAddTarget(target, toolchain));
    },
    [withLoading],
  );

  const removeTarget = useCallback(
    async (target: string, toolchain?: string): Promise<void> => {
      await withLoading(() => tauri.rustupRemoveTarget(target, toolchain));
    },
    [withLoading],
  );

  // ── Override management ──

  const overrideSet = useCallback(
    async (toolchain: string, path?: string): Promise<void> => {
      await withLoading(() => tauri.rustupOverrideSet(toolchain, path));
    },
    [withLoading],
  );

  const overrideUnset = useCallback(
    async (path?: string): Promise<void> => {
      await withLoading(() => tauri.rustupOverrideUnset(path));
    },
    [withLoading],
  );

  const overrideList = useCallback(async (): Promise<RustupOverride[]> => {
    return withLoading(async () => {
      const result = await tauri.rustupOverrideList();
      setOverrides(result);
      return result;
    });
  }, [withLoading]);

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
      setProfileState(result);
      return result;
    });
  }, [withLoading]);

  const setProfile = useCallback(
    async (newProfile: string): Promise<void> => {
      await withLoading(async () => {
        await tauri.rustupSetProfile(newProfile);
        setProfileState(newProfile);
      });
    },
    [withLoading],
  );

  // ── Refresh all ──

  const refreshAll = useCallback(async (): Promise<void> => {
    if (!tauri.isTauri()) return;
    setLoading(true);
    setError(null);
    try {
      const [comps, tgts, ovrs, info, prof] = await Promise.all([
        tauri.rustupListComponents().catch(() => [] as RustComponent[]),
        tauri.rustupListTargets().catch(() => [] as RustTarget[]),
        tauri.rustupOverrideList().catch(() => [] as RustupOverride[]),
        tauri.rustupShow().catch(() => null),
        tauri.rustupGetProfile().catch(() => null),
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
