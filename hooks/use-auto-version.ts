'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useEnvironmentStore } from '@/lib/stores/environment';
import { useEnvironments } from './use-environments';
import * as tauri from '@/lib/tauri';
import {
  isDetectedVersionCompatible,
  matchDetectedByEnvType,
  toLogicalEnvType,
} from '@/lib/environment-detection';

interface UseAutoVersionSwitchOptions {
  projectPath: string | null;
  enabled?: boolean;
  pollInterval?: number;
}

/**
 * Hook for automatic version detection and switching based on project files.
 * 
 * Monitors the project directory for version specification files like:
 * - .nvmrc, .node-version, package.json (for Node.js)
 * - .python-version, pyproject.toml (for Python)
 * - rust-toolchain.toml (for Rust)
 * - go.mod, .go-version (for Go)
 * 
 * When detected, it can automatically switch to the specified version.
 */
export function useAutoVersionSwitch({
  projectPath,
  enabled = true,
  pollInterval = 30000,
}: UseAutoVersionSwitchOptions) {
  const { detectVersions, setLocalVersion } = useEnvironments();
  const { getEnvSettings } = useEnvironmentStore();
  const lastDetectedRef = useRef<Record<string, string>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkAndSwitch = useCallback(async () => {
    if (!projectPath || !tauri.isTauri()) return;

    try {
      const detected = await detectVersions(projectPath);

      // Read the latest environments/providers from the store to avoid stale closures.
      const { environments, availableProviders } = useEnvironmentStore.getState();

      for (const env of environments) {
        const detection = matchDetectedByEnvType(
          env.env_type,
          detected,
          availableProviders,
        );
        const detectedVersion = detection?.version;

        if (!detectedVersion) continue;

        const normalizedProviderEnvType = env.env_type.trim().toLowerCase();
        const logicalEnvType = toLogicalEnvType(
          normalizedProviderEnvType,
          availableProviders,
        );
        const logicalSettings = getEnvSettings(logicalEnvType);
        const providerSettings = logicalEnvType === normalizedProviderEnvType
          ? logicalSettings
          : getEnvSettings(normalizedProviderEnvType);

        if (!(logicalSettings.autoSwitch || providerSettings.autoSwitch)) continue;

        // Skip if we already switched to this version
        if (lastDetectedRef.current[env.env_type] === detectedVersion) continue;

        // Check if a compatible version is installed and use the exact installed version.
        const installedVersion = env.installed_versions.find((v) =>
          isDetectedVersionCompatible(v.version, detectedVersion),
        )?.version;

        if (installedVersion) {
          // Auto-switch to the detected version using local (project-scoped) version
          // to avoid affecting other terminal sessions or projects
          try {
            await setLocalVersion(env.env_type, installedVersion, projectPath);
            lastDetectedRef.current[env.env_type] = detectedVersion;
          } catch {
            // Silently fail - don't interrupt user workflow
          }
        }
      }
    } catch {
      // Silently fail detection errors
    }
  }, [projectPath, detectVersions, setLocalVersion, getEnvSettings]);

  useEffect(() => {
    if (!enabled || !projectPath) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial check
    checkAndSwitch();

    // Set up polling
    intervalRef.current = setInterval(checkAndSwitch, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, projectPath, pollInterval, checkAndSwitch]);

  // Manual trigger function
  const triggerCheck = useCallback(() => {
    checkAndSwitch();
  }, [checkAndSwitch]);

  // Reset last detected versions (useful when changing projects)
  const resetDetection = useCallback(() => {
    lastDetectedRef.current = {};
  }, []);

  return {
    triggerCheck,
    resetDetection,
  };
}

/**
 * Hook to get project path from user selection with localStorage persistence.
 */
export function useProjectPath() {
  const [projectPath, setProjectPathState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('cognia-project-path');
  });

  const setProjectPath = useCallback((path: string | null) => {
    setProjectPathState(path);
    if (path) {
      localStorage.setItem('cognia-project-path', path);
    } else {
      localStorage.removeItem('cognia-project-path');
    }
  }, []);

  const clearProjectPath = useCallback(() => {
    setProjectPathState(null);
    localStorage.removeItem('cognia-project-path');
  }, []);

  return {
    projectPath,
    setProjectPath,
    clearProjectPath,
  };
}
