'use client';

import { useEffect, useState, useCallback } from 'react';
import * as tauri from '@/lib/tauri';
import { isTauri } from '@/lib/platform';
import { toast } from 'sonner';
import type {
  ShellType,
  TerminalProfile,
  TerminalProfileTemplate,
} from '@/types/tauri';
import type { UseTerminalState, ProxyMode } from '@/types/terminal';

export function useTerminal() {
  const [state, setState] = useState<UseTerminalState>({
    shells: [],
    profiles: [],
    templates: [],
    psProfiles: [],
    psModules: [],
    psScripts: [],
    executionPolicy: [],
    frameworks: [],
    plugins: [],
    frameworkCacheStats: [],
    frameworkCacheLoading: false,
    shellEnvVars: [],
    proxyEnvVars: [],
    selectedShellId: null,
    proxyMode: 'global',
    customProxy: '',
    noProxy: '',
    globalProxy: '',
    proxyConfigSaving: false,
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

  const parseConfigContent = useCallback(async (content: string, shellType: ShellType) => {
    if (!isTauri()) return null;
    try {
      return await tauri.terminalParseConfigContent(content, shellType);
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

  const fetchPlugins = useCallback(async (frameworkName: string, frameworkPath: string, shellType: ShellType, configPath?: string | null) => {
    if (!isTauri()) return;
    try {
      const plugins = await tauri.terminalListPlugins(frameworkName, frameworkPath, shellType, configPath);
      setState((prev) => ({ ...prev, plugins }));
    } catch (e) {
      toast.error(`Failed to load plugins: ${e}`);
    }
  }, []);

  // Framework Cache Management
  const fetchFrameworkCacheStats = useCallback(async () => {
    if (!isTauri()) return;
    setState((prev) => ({ ...prev, frameworkCacheLoading: true }));
    try {
      const frameworkCacheStats = await tauri.terminalGetFrameworkCacheStats();
      setState((prev) => ({ ...prev, frameworkCacheStats, frameworkCacheLoading: false }));
    } catch (e) {
      setState((prev) => ({ ...prev, frameworkCacheLoading: false }));
      toast.error(`Failed to load framework cache stats: ${e}`);
    }
  }, []);

  const cleanFrameworkCache = useCallback(async (frameworkName: string) => {
    if (!isTauri()) return;
    try {
      const freedBytes = await tauri.terminalCleanFrameworkCache(frameworkName);
      const freedMB = (freedBytes / (1024 * 1024)).toFixed(1);
      toast.success(`Cleaned ${freedMB} MB from ${frameworkName} cache`);
      await fetchFrameworkCacheStats();
    } catch (e) {
      toast.error(`Failed to clean ${frameworkName} cache: ${e}`);
    }
  }, [fetchFrameworkCacheStats]);

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

  // Profile Duplicate / Import / Export
  const duplicateProfile = useCallback(async (id: string) => {
    if (!isTauri()) return;
    try {
      const newId = await tauri.terminalDuplicateProfile(id);
      await fetchProfiles();
      toast.success('Profile duplicated');
      return newId;
    } catch (e) {
      toast.error(`Failed to duplicate profile: ${e}`);
    }
  }, [fetchProfiles]);

  const exportProfiles = useCallback(async () => {
    if (!isTauri()) return '';
    try {
      const json = await tauri.terminalExportProfiles();
      toast.success('Profiles exported');
      return json;
    } catch (e) {
      toast.error(`Failed to export profiles: ${e}`);
      return '';
    }
  }, []);

  const importProfiles = useCallback(async (json: string, merge: boolean) => {
    if (!isTauri()) return 0;
    try {
      const count = await tauri.terminalImportProfiles(json, merge);
      await fetchProfiles();
      toast.success(`Imported ${count} profile(s)`);
      return count;
    } catch (e) {
      toast.error(`Failed to import profiles: ${e}`);
      return 0;
    }
  }, [fetchProfiles]);

  // Templates
  const fetchTemplates = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const templates = await tauri.terminalListTemplates();
      setState((prev) => ({ ...prev, templates }));
    } catch (e) {
      toast.error(`Failed to load templates: ${e}`);
    }
  }, []);

  const createCustomTemplate = useCallback(async (template: TerminalProfileTemplate) => {
    if (!isTauri()) return;
    try {
      const id = await tauri.terminalCreateCustomTemplate(template);
      await fetchTemplates();
      toast.success('Template created');
      return id;
    } catch (e) {
      toast.error(`Failed to create template: ${e}`);
    }
  }, [fetchTemplates]);

  const deleteCustomTemplate = useCallback(async (id: string) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalDeleteCustomTemplate(id);
      await fetchTemplates();
      toast.success('Template deleted');
    } catch (e) {
      toast.error(`Failed to delete template: ${e}`);
    }
  }, [fetchTemplates]);

  const saveProfileAsTemplate = useCallback(async (
    profileId: string,
    templateName: string,
    templateDescription: string,
  ) => {
    if (!isTauri()) return;
    try {
      const id = await tauri.terminalSaveProfileAsTemplate(profileId, templateName, templateDescription);
      await fetchTemplates();
      toast.success('Profile saved as template');
      return id;
    } catch (e) {
      toast.error(`Failed to save as template: ${e}`);
    }
  }, [fetchTemplates]);

  const createProfileFromTemplate = useCallback(async (templateId: string) => {
    if (!isTauri()) return undefined;
    try {
      return await tauri.terminalCreateProfileFromTemplate(templateId);
    } catch (e) {
      toast.error(`Failed to create from template: ${e}`);
      return undefined;
    }
  }, []);

  // Shell Config Write
  const writeShellConfig = useCallback(async (path: string, content: string) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalWriteConfig(path, content);
      toast.success('Config saved (backup created)');
    } catch (e) {
      toast.error(`Failed to save config: ${e}`);
    }
  }, []);

  // PowerShell Module Management
  const installPSModule = useCallback(async (name: string, scope: string) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalPsInstallModule(name, scope);
      await fetchPSModules();
      toast.success(`Module '${name}' installed`);
    } catch (e) {
      toast.error(`Failed to install module: ${e}`);
    }
  }, [fetchPSModules]);

  const uninstallPSModule = useCallback(async (name: string) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalPsUninstallModule(name);
      await fetchPSModules();
      toast.success(`Module '${name}' uninstalled`);
    } catch (e) {
      toast.error(`Failed to uninstall module: ${e}`);
    }
  }, [fetchPSModules]);

  const updatePSModule = useCallback(async (name: string) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalPsUpdateModule(name);
      await fetchPSModules();
      toast.success(`Module '${name}' updated`);
    } catch (e) {
      toast.error(`Failed to update module: ${e}`);
    }
  }, [fetchPSModules]);

  const searchPSModules = useCallback(async (query: string) => {
    if (!isTauri()) return [];
    try {
      return await tauri.terminalPsFindModule(query);
    } catch (e) {
      toast.error(`Failed to search modules: ${e}`);
      return [];
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

  // Proxy Config Management
  const loadProxyConfig = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const config = await tauri.configList();
      const configMap: Record<string, string> = {};
      for (const [k, v] of config) {
        configMap[k] = v;
      }
      setState((prev) => ({
        ...prev,
        proxyMode: (configMap['terminal.proxy_mode'] || 'global') as ProxyMode,
        customProxy: configMap['terminal.custom_proxy'] || '',
        noProxy: configMap['terminal.no_proxy'] || '',
        globalProxy: configMap['network.proxy'] || '',
      }));
    } catch {
      // fallback to defaults
    }
  }, []);

  const updateProxyMode = useCallback(async (mode: ProxyMode) => {
    setState((prev) => ({ ...prev, proxyMode: mode }));
    if (!isTauri()) return;
    setState((prev) => ({ ...prev, proxyConfigSaving: true }));
    try {
      await tauri.configSet('terminal.proxy_mode', mode);
      const proxyEnvVars = await tauri.terminalGetProxyEnvVars();
      setState((prev) => ({ ...prev, proxyEnvVars, proxyConfigSaving: false }));
    } catch (e) {
      setState((prev) => ({ ...prev, proxyConfigSaving: false }));
      toast.error(`Failed to set proxy mode: ${e}`);
    }
  }, []);

  const updateCustomProxy = useCallback(async (value: string) => {
    setState((prev) => ({ ...prev, customProxy: value }));
  }, []);

  const saveCustomProxy = useCallback(async () => {
    if (!isTauri()) return;
    setState((prev) => ({ ...prev, proxyConfigSaving: true }));
    try {
      await tauri.configSet('terminal.custom_proxy', state.customProxy);
      const proxyEnvVars = await tauri.terminalGetProxyEnvVars();
      setState((prev) => ({ ...prev, proxyEnvVars, proxyConfigSaving: false }));
    } catch (e) {
      setState((prev) => ({ ...prev, proxyConfigSaving: false }));
      toast.error(`Failed to save custom proxy: ${e}`);
    }
  }, [state.customProxy]);

  const updateNoProxy = useCallback(async (value: string) => {
    setState((prev) => ({ ...prev, noProxy: value }));
  }, []);

  const saveNoProxy = useCallback(async () => {
    if (!isTauri()) return;
    setState((prev) => ({ ...prev, proxyConfigSaving: true }));
    try {
      await tauri.configSet('terminal.no_proxy', state.noProxy);
      const proxyEnvVars = await tauri.terminalGetProxyEnvVars();
      setState((prev) => ({ ...prev, proxyEnvVars, proxyConfigSaving: false }));
    } catch (e) {
      setState((prev) => ({ ...prev, proxyConfigSaving: false }));
      toast.error(`Failed to save no-proxy list: ${e}`);
    }
  }, [state.noProxy]);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isTauri()) return;
      try {
        const [shellsResult, profilesResult, templatesResult] = await Promise.all([
          tauri.terminalDetectShells(),
          tauri.terminalListProfiles(),
          tauri.terminalListTemplates(),
        ]);
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            shells: shellsResult,
            profiles: profilesResult,
            templates: templatesResult,
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
    parseConfigContent,
    fetchPSProfiles,
    readPSProfile,
    writePSProfile,
    fetchExecutionPolicy,
    setExecutionPolicy,
    fetchPSModules,
    fetchPSScripts,
    detectFrameworks,
    fetchPlugins,
    fetchFrameworkCacheStats,
    cleanFrameworkCache,
    fetchShellEnvVars,
    fetchProxyEnvVars,
    duplicateProfile,
    exportProfiles,
    importProfiles,
    fetchTemplates,
    createCustomTemplate,
    deleteCustomTemplate,
    saveProfileAsTemplate,
    createProfileFromTemplate,
    writeShellConfig,
    installPSModule,
    uninstallPSModule,
    updatePSModule,
    searchPSModules,
    loadProxyConfig,
    updateProxyMode,
    updateCustomProxy,
    saveCustomProxy,
    updateNoProxy,
    saveNoProxy,
  };
}
