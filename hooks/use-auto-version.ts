'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useEnvironmentStore } from '@/lib/stores/environment';
import { useEnvironments } from './use-environments';
import * as tauri from '@/lib/tauri';

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
  pollInterval = 5000,
}: UseAutoVersionSwitchOptions) {
  const { detectVersions, setLocalVersion, environments } = useEnvironments();
  const { getEnvSettings } = useEnvironmentStore();
  const lastDetectedRef = useRef<Record<string, string>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkAndSwitch = useCallback(async () => {
    if (!projectPath || !tauri.isTauri()) return;

    try {
      const detected = await detectVersions(projectPath);
      
      for (const detection of detected) {
        const envType = detection.env_type;
        const detectedVersion = detection.version;
        
        if (!detectedVersion) continue;
        
        // Check if auto-switch is enabled for this environment type
        const settings = getEnvSettings(envType);
        if (!settings.autoSwitch) continue;
        
        // Skip if we already switched to this version
        if (lastDetectedRef.current[envType] === detectedVersion) continue;
        
        // Find the environment
        const env = environments.find(e => e.env_type === envType);
        if (!env) continue;
        
        // Check if the version is installed
        const isInstalled = env.installed_versions.some(
          v => v.version === detectedVersion || v.version.includes(detectedVersion)
        );
        
        if (isInstalled) {
          // Auto-switch to the detected version using local (project-scoped) version
          // to avoid affecting other terminal sessions or projects
          try {
            await setLocalVersion(envType, detectedVersion, projectPath);
            lastDetectedRef.current[envType] = detectedVersion;
          } catch {
            // Silently fail - don't interrupt user workflow
          }
        }
      }
    } catch {
      // Silently fail detection errors
    }
  }, [projectPath, detectVersions, setLocalVersion, environments, getEnvSettings]);

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
