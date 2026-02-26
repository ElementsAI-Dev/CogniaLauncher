'use client';

import { useEffect, useState, useCallback } from 'react';
import * as tauri from '@/lib/tauri';
import { isTauri } from '@/lib/platform';
import { toast } from 'sonner';
import type {
  LaunchResult,
  ShellType,
  ShellInfo,
  TerminalProfile,
  PSProfileInfo,
  PSModuleInfo,
  PSScriptInfo,
  ShellFrameworkInfo,
  ShellPlugin,
} from '@/types/tauri';

interface UseTerminalState {
  shells: ShellInfo[];
  profiles: TerminalProfile[];
  psProfiles: PSProfileInfo[];
  psModules: PSModuleInfo[];
  psScripts: PSScriptInfo[];
  executionPolicy: [string, string][];
  frameworks: ShellFrameworkInfo[];
  plugins: ShellPlugin[];
  shellEnvVars: [string, string][];
  proxyEnvVars: [string, string][];
  selectedShellId: string | null;
  launchingProfileId: string | null;
  lastLaunchResult: {
    profileId: string;
    result: LaunchResult;
  } | null;
  loading: boolean;
  error: string | null;
}

export function useTerminal() {
  const [state, setState] = useState<UseTerminalState>({
    shells: [],
    profiles: [],
    psProfiles: [],
    psModules: [],
    psScripts: [],
    executionPolicy: [],
    frameworks: [],
    plugins: [],
    shellEnvVars: [],
    proxyEnvVars: [],
    selectedShellId: null,
    launchingProfileId: null,
    lastLaunchResult: null,
    loading: false,
    error: null,
  });

  const setLoading = (loading: boolean) =>
    setState((prev) => ({ ...prev, loading }));

  const setError = (error: string | null) =>
    setState((prev) => ({ ...prev, error, loading: false }));

  // Shell Detection
  const detectShells = useCallback(async () => {
    if (!isTauri()) return;
    setLoading(true);
    try {
      const shells = await tauri.terminalDetectShells();
      setState((prev) => ({ ...prev, shells, loading: false }));
    } catch (e) {
      setError(String(e));
    }
  }, []);

  // Terminal Profiles
  const fetchProfiles = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const profiles = await tauri.terminalListProfiles();
      setState((prev) => ({ ...prev, profiles }));
    } catch (e) {
      toast.error(`Failed to load profiles: ${e}`);
    }
  }, []);

  const createProfile = useCallback(async (profile: TerminalProfile) => {
    if (!isTauri()) return;
    try {
      const id = await tauri.terminalCreateProfile(profile);
      await fetchProfiles();
      toast.success('Profile created');
      return id;
    } catch (e) {
      toast.error(`Failed to create profile: ${e}`);
    }
  }, [fetchProfiles]);

  const updateProfile = useCallback(async (profile: TerminalProfile) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalUpdateProfile(profile);
      await fetchProfiles();
      toast.success('Profile updated');
    } catch (e) {
      toast.error(`Failed to update profile: ${e}`);
    }
  }, [fetchProfiles]);

  const deleteProfile = useCallback(async (id: string) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalDeleteProfile(id);
      await fetchProfiles();
      toast.success('Profile deleted');
    } catch (e) {
      toast.error(`Failed to delete profile: ${e}`);
    }
  }, [fetchProfiles]);

  const setDefaultProfile = useCallback(async (id: string) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalSetDefaultProfile(id);
      await fetchProfiles();
      toast.success('Default profile set');
    } catch (e) {
      toast.error(`Failed to set default: ${e}`);
    }
  }, [fetchProfiles]);

  const launchProfile = useCallback(async (id: string) => {
    if (!isTauri()) return;
    setState((prev) => ({ ...prev, launchingProfileId: id }));
    try {
      const result = await tauri.terminalLaunchProfileDetailed(id);
      setState((prev) => ({
        ...prev,
        launchingProfileId: null,
        lastLaunchResult: { profileId: id, result },
      }));

      if (result.success) {
        toast.success('Profile launched');
      } else {
        const errorMessage = result.stderr.trim();
        toast.error(
          errorMessage
            ? `Profile launch failed: ${errorMessage}`
            : `Profile launch failed (exit code ${result.exitCode})`,
        );
      }

      return result;
    } catch (e) {
      const errorMessage = String(e);
      setState((prev) => ({
        ...prev,
        launchingProfileId: null,
        lastLaunchResult: {
          profileId: id,
          result: {
            exitCode: -1,
            stdout: '',
            stderr: errorMessage,
            success: false,
          },
        },
      }));
      toast.error(`Failed to launch profile: ${errorMessage}`);
      return undefined;
    }
  }, []);

  const clearLaunchResult = useCallback(() => {
    setState((prev) => ({ ...prev, lastLaunchResult: null }));
  }, []);

  // Shell Config
  const readShellConfig = useCallback(async (path: string) => {
    if (!isTauri()) return '';
    try {
      return await tauri.terminalReadConfig(path);
    } catch (e) {
      toast.error(`Failed to read config: ${e}`);
      return '';
    }
  }, []);

  const backupShellConfig = useCallback(async (path: string) => {
    if (!isTauri()) return;
    try {
      const backupPath = await tauri.terminalBackupConfig(path);
      toast.success(`Backup created: ${backupPath}`);
      return backupPath;
    } catch (e) {
      toast.error(`Failed to backup: ${e}`);
    }
  }, []);

  const appendToShellConfig = useCallback(async (path: string, content: string) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalAppendToConfig(path, content);
      toast.success('Config updated');
    } catch (e) {
      toast.error(`Failed to update config: ${e}`);
    }
  }, []);

  const fetchConfigEntries = useCallback(async (path: string, shellType: ShellType) => {
    if (!isTauri()) return null;
    try {
      return await tauri.terminalGetConfigEntries(path, shellType);
    } catch (e) {
      toast.error(`Failed to parse config: ${e}`);
      return null;
    }
  }, []);

  // PowerShell Management
  const fetchPSProfiles = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const psProfiles = await tauri.terminalPsListProfiles();
      setState((prev) => ({ ...prev, psProfiles }));
    } catch (e) {
      toast.error(`Failed to load PS profiles: ${e}`);
    }
  }, []);

  const readPSProfile = useCallback(async (scope: string) => {
    if (!isTauri()) return '';
    try {
      return await tauri.terminalPsReadProfile(scope);
    } catch (e) {
      toast.error(`Failed to read PS profile: ${e}`);
      return '';
    }
  }, []);

  const writePSProfile = useCallback(async (scope: string, content: string) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalPsWriteProfile(scope, content);
      await fetchPSProfiles();
      toast.success('PS profile updated');
    } catch (e) {
      toast.error(`Failed to write PS profile: ${e}`);
    }
  }, [fetchPSProfiles]);

  const fetchExecutionPolicy = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const executionPolicy = await tauri.terminalPsGetExecutionPolicy();
      setState((prev) => ({ ...prev, executionPolicy }));
    } catch (e) {
      toast.error(`Failed to get execution policy: ${e}`);
    }
  }, []);

  const setExecutionPolicy = useCallback(async (policy: string, scope: string) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalPsSetExecutionPolicy(policy, scope);
      await fetchExecutionPolicy();
      toast.success(`Execution policy set to ${policy}`);
    } catch (e) {
      toast.error(`Failed to set execution policy: ${e}`);
    }
  }, [fetchExecutionPolicy]);

  const fetchPSModules = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const psModules = await tauri.terminalPsListAllModules();
      setState((prev) => ({ ...prev, psModules }));
    } catch (e) {
      toast.error(`Failed to load PS modules: ${e}`);
    }
  }, []);

  const fetchPSScripts = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const psScripts = await tauri.terminalPsListInstalledScripts();
      setState((prev) => ({ ...prev, psScripts }));
    } catch (e) {
      toast.error(`Failed to load PS scripts: ${e}`);
    }
  }, []);

  // Shell Framework & Plugins
  const detectFrameworks = useCallback(async (shellType: ShellType) => {
    if (!isTauri()) return;
    try {
      const frameworks = await tauri.terminalDetectFramework(shellType);
      setState((prev) => ({
        ...prev,
        frameworks: [
          ...prev.frameworks.filter((item) => item.shellType !== shellType),
          ...frameworks,
        ],
      }));
    } catch (e) {
      toast.error(`Failed to detect frameworks: ${e}`);
    }
  }, []);

  const fetchPlugins = useCallback(async (frameworkName: string, frameworkPath: string, shellType: ShellType) => {
    if (!isTauri()) return;
    try {
      const plugins = await tauri.terminalListPlugins(frameworkName, frameworkPath, shellType);
      setState((prev) => ({ ...prev, plugins }));
    } catch (e) {
      toast.error(`Failed to load plugins: ${e}`);
    }
  }, []);

  // Shell Environment Variables
  const fetchShellEnvVars = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const shellEnvVars = await tauri.terminalGetShellEnvVars();
      setState((prev) => ({ ...prev, shellEnvVars }));
    } catch (e) {
      toast.error(`Failed to load env vars: ${e}`);
    }
  }, []);

  // Proxy Environment Variables
  const fetchProxyEnvVars = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const proxyEnvVars = await tauri.terminalGetProxyEnvVars();
      setState((prev) => ({ ...prev, proxyEnvVars }));
    } catch (e) {
      toast.error(`Failed to load proxy env vars: ${e}`);
    }
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isTauri()) return;
      try {
        const [shellsResult, profilesResult] = await Promise.all([
          tauri.terminalDetectShells(),
          tauri.terminalListProfiles(),
        ]);
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            shells: shellsResult,
            profiles: profilesResult,
            loading: false,
          }));
        }
      } catch (e) {
        if (!cancelled) {
          setState((prev) => ({ ...prev, error: String(e), loading: false }));
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return {
    ...state,
    detectShells,
    fetchProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
    setDefaultProfile,
    launchProfile,
    clearLaunchResult,
    readShellConfig,
    backupShellConfig,
    appendToShellConfig,
    fetchConfigEntries,
    fetchPSProfiles,
    readPSProfile,
    writePSProfile,
    fetchExecutionPolicy,
    setExecutionPolicy,
    fetchPSModules,
    fetchPSScripts,
    detectFrameworks,
    fetchPlugins,
    fetchShellEnvVars,
    fetchProxyEnvVars,
  };
}
