'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useEnvironmentStore } from '../stores/environment';
import { useEnvironments } from './use-environments';
import * as tauri from '../tauri';

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
  const { detectVersions, setGlobalVersion, environments } = useEnvironments();
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
          // Auto-switch to the detected version
          try {
            await setGlobalVersion(envType, detectedVersion);
            lastDetectedRef.current[envType] = detectedVersion;
          } catch {
            // Silently fail - don't interrupt user workflow
          }
        }
      }
    } catch {
      // Silently fail detection errors
    }
  }, [projectPath, detectVersions, setGlobalVersion, environments, getEnvSettings]);

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
 * Hook to get project path from current working directory or user selection.
 * This is a placeholder that can be enhanced with actual directory detection.
 */
export function useProjectPath() {
  // This could be enhanced to:
  // 1. Detect the current working directory
  // 2. Watch for directory changes
  // 3. Store user's preferred project path
  return {
    projectPath: null as string | null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setProjectPath: (_path: string) => { /* placeholder */ },
  };
}
