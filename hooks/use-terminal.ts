'use client';

import { useEffect, useState, useCallback } from 'react';
import * as tauri from '@/lib/tauri';
import { isTauri } from '@/lib/platform';
import { toast } from 'sonner';
import type {
  ShellType,
  TerminalConfigDiagnostic,
  TerminalConfigMutationResult,
  TerminalConfigEditorMetadata,
  TerminalConfigRestoreResult,
  TerminalProfile,
  TerminalProfileTemplate,
} from '@/types/tauri';
import type { UseTerminalState, ProxyMode, TerminalResourceKey } from '@/types/terminal';

interface UseTerminalOptions {
  t: (key: string, params?: Record<string, string | number>) => string;
}

function inferShellTypeFromConfigPath(path: string): ShellType {
  const lower = path.toLowerCase();
  if (lower.endsWith('.ps1') || lower.includes('powershell_profile')) return 'powershell';
  if (lower.endsWith('.nu') || lower.includes('nushell')) return 'nushell';
  if (lower.includes('fish') || lower.endsWith('.fish')) return 'fish';
  if (lower.endsWith('.cmd') || lower.endsWith('.bat')) return 'cmd';
  if (lower.includes('zsh')) return 'zsh';
  return 'bash';
}

function buildValidationFailureResult(
  path: string,
  diagnostics: TerminalConfigDiagnostic[],
): TerminalConfigMutationResult {
  return {
    operation: 'write',
    path,
    backupPath: null,
    bytesWritten: 0,
    verified: false,
    diagnostics: diagnostics.map((item) => item.message),
    diagnosticDetails: diagnostics,
    snapshotPath: null,
    fingerprint: null,
  };
}

export function useTerminal({ t }: UseTerminalOptions) {
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
    startupMeasurements: {},
    healthResults: {},
    measuringShellId: null,
    checkingHealthShellId: null,
    selectedShellId: null,
    proxyMode: 'global',
    customProxy: '',
    noProxy: '',
    globalProxy: '',
    proxyConfigSaving: false,
    configMutationState: {
      status: 'idle',
      message: null,
      result: null,
      updatedAt: null,
    },
    proxySyncState: {
      status: 'idle',
      message: null,
      result: null,
      updatedAt: null,
    },
    resourceStale: {
      profiles: false,
      templates: false,
      configEntries: false,
      configMetadata: false,
      proxyConfig: true,
      proxyEnvVars: true,
      shellEnvVars: true,
      psProfiles: true,
      psModules: true,
      psScripts: true,
      executionPolicy: true,
    },
    launchingProfileId: null,
    lastLaunchResult: null,
    shellsLoading: false,
    profilesLoading: false,
    psLoading: false,
    loading: false,
    error: null,
  });

  const markResourcesStale = useCallback((resources: TerminalResourceKey[]) => {
    if (resources.length === 0) return;
    setState((prev) => {
      const next = { ...prev.resourceStale };
      for (const key of resources) next[key] = true;
      return {
        ...prev,
        resourceStale: next,
      };
    });
  }, []);

  const markResourcesFresh = useCallback((resources: TerminalResourceKey[]) => {
    if (resources.length === 0) return;
    setState((prev) => {
      const next = { ...prev.resourceStale };
      for (const key of resources) next[key] = false;
      return {
        ...prev,
        resourceStale: next,
      };
    });
  }, []);

  // Shell Detection
  const detectShells = useCallback(async () => {
    if (!isTauri()) return;
    setState((prev) => ({ ...prev, shellsLoading: true }));
    try {
      const shells = await tauri.terminalDetectShells();
      setState((prev) => ({ ...prev, shells, shellsLoading: false }));
    } catch (e) {
      setState((prev) => ({ ...prev, shellsLoading: false, error: String(e) }));
    }
  }, []);

  // Shell Startup Measurement
  const measureStartup = useCallback(async (shellId: string) => {
    if (!isTauri()) return;
    setState((prev) => ({ ...prev, measuringShellId: shellId }));
    try {
      const measurement = await tauri.terminalMeasureStartup(shellId);
      setState((prev) => ({
        ...prev,
        measuringShellId: null,
        startupMeasurements: { ...prev.startupMeasurements, [shellId]: measurement },
      }));
    } catch (e) {
      setState((prev) => ({ ...prev, measuringShellId: null }));
      toast.error(t('terminal.toastMeasureStartupFailed', { error: String(e) }));
    }
  }, [t]);

  // Shell Health Check
  const checkShellHealth = useCallback(async (shellId: string) => {
    if (!isTauri()) return;
    setState((prev) => ({ ...prev, checkingHealthShellId: shellId }));
    try {
      const result = await tauri.terminalCheckShellHealth(shellId);
      setState((prev) => ({
        ...prev,
        checkingHealthShellId: null,
        healthResults: { ...prev.healthResults, [shellId]: result },
      }));
    } catch (e) {
      setState((prev) => ({ ...prev, checkingHealthShellId: null }));
      toast.error(t('terminal.toastCheckHealthFailed', { error: String(e) }));
    }
  }, [t]);

  // Terminal Profiles
  const fetchProfiles = useCallback(async () => {
    if (!isTauri()) return;
    setState((prev) => ({ ...prev, profilesLoading: true }));
    try {
      const profiles = await tauri.terminalListProfiles();
      setState((prev) => ({
        ...prev,
        profiles,
        profilesLoading: false,
        resourceStale: {
          ...prev.resourceStale,
          profiles: false,
        },
      }));
    } catch (e) {
      setState((prev) => ({ ...prev, profilesLoading: false }));
      toast.error(t('terminal.toastLoadProfilesFailed', { error: String(e) }));
    }
  }, [t]);

  const createProfile = useCallback(async (profile: TerminalProfile) => {
    if (!isTauri()) return;
    try {
      const id = await tauri.terminalCreateProfile(profile);
      markResourcesStale(['profiles']);
      await fetchProfiles();
      toast.success(t('terminal.toastProfileCreated'));
      return id;
    } catch (e) {
      toast.error(t('terminal.toastCreateProfileFailed', { error: String(e) }));
    }
  }, [fetchProfiles, markResourcesStale, t]);

  const updateProfile = useCallback(async (profile: TerminalProfile) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalUpdateProfile(profile);
      markResourcesStale(['profiles']);
      await fetchProfiles();
      toast.success(t('terminal.toastProfileUpdated'));
    } catch (e) {
      toast.error(t('terminal.toastUpdateProfileFailed', { error: String(e) }));
    }
  }, [fetchProfiles, markResourcesStale, t]);

  const deleteProfile = useCallback(async (id: string) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalDeleteProfile(id);
      markResourcesStale(['profiles']);
      await fetchProfiles();
      toast.success(t('terminal.toastProfileDeleted'));
    } catch (e) {
      toast.error(t('terminal.toastDeleteProfileFailed', { error: String(e) }));
    }
  }, [fetchProfiles, markResourcesStale, t]);

  const setDefaultProfile = useCallback(async (id: string) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalSetDefaultProfile(id);
      markResourcesStale(['profiles']);
      await fetchProfiles();
      toast.success(t('terminal.toastDefaultProfileSet'));
    } catch (e) {
      toast.error(t('terminal.toastSetDefaultFailed', { error: String(e) }));
    }
  }, [fetchProfiles, markResourcesStale, t]);

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
        toast.success(t('terminal.toastProfileLaunched'));
      } else {
        const errorMessage = result.stderr.trim();
        toast.error(
          errorMessage
            ? t('terminal.toastLaunchFailedMessage', { error: errorMessage })
            : t('terminal.toastLaunchFailedCode', { code: result.exitCode }),
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
      toast.error(t('terminal.toastLaunchFailed', { error: errorMessage }));
      return undefined;
    }
  }, [t]);

  const clearLaunchResult = useCallback(() => {
    setState((prev) => ({ ...prev, lastLaunchResult: null }));
  }, []);

  const clearConfigMutationState = useCallback(() => {
    setState((prev) => ({
      ...prev,
      configMutationState: {
        status: 'idle',
        message: null,
        result: null,
        updatedAt: Date.now(),
      },
    }));
  }, []);

  const clearProxySyncState = useCallback(() => {
    setState((prev) => ({
      ...prev,
      proxySyncState: {
        status: 'idle',
        message: null,
        result: null,
        updatedAt: Date.now(),
      },
    }));
  }, []);

  // Shell Config
  const readShellConfig = useCallback(async (path: string) => {
    if (!isTauri()) return '';
    try {
      return await tauri.terminalReadConfig(path);
    } catch (e) {
      toast.error(t('terminal.toastReadConfigFailed', { error: String(e) }));
      return '';
    }
  }, [t]);

  const backupShellConfig = useCallback(async (path: string) => {
    if (!isTauri()) return;
    setState((prev) => ({
      ...prev,
      configMutationState: {
        status: 'loading',
        message: null,
        result: null,
        updatedAt: Date.now(),
      },
    }));
    try {
      const result = await tauri.terminalBackupConfigVerified(path);
      const backupPath = result.backupPath ?? '';
      const message = t('terminal.toastBackupCreated', { path: String(backupPath) });
      setState((prev) => ({
        ...prev,
        configMutationState: {
          status: 'success',
          message,
          result,
          updatedAt: Date.now(),
        },
      }));
      toast.success(t('terminal.toastBackupCreated', { path: String(backupPath) }));
      return backupPath;
    } catch (e) {
      const message = t('terminal.toastBackupFailed', { error: String(e) });
      setState((prev) => ({
        ...prev,
        configMutationState: {
          status: 'error',
          message,
          result: null,
          updatedAt: Date.now(),
        },
      }));
      toast.error(message);
    }
  }, [t]);

  const appendToShellConfig = useCallback(async (path: string, content: string) => {
    if (!isTauri()) return;
    setState((prev) => ({
      ...prev,
      configMutationState: {
        status: 'loading',
        message: null,
        result: null,
        updatedAt: Date.now(),
      },
    }));
    try {
      const result = await tauri.terminalAppendToConfigVerified(path, content);
      const message = t('terminal.toastConfigUpdated');
      setState((prev) => ({
        ...prev,
        configMutationState: {
          status: 'success',
          message,
          result,
          updatedAt: Date.now(),
        },
      }));
      markResourcesStale(['configEntries', 'configMetadata']);
      toast.success(message);
    } catch (e) {
      const message = t('terminal.toastUpdateConfigFailed', { error: String(e) });
      setState((prev) => ({
        ...prev,
        configMutationState: {
          status: 'error',
          message,
          result: null,
          updatedAt: Date.now(),
        },
      }));
      toast.error(message);
    }
  }, [markResourcesStale, t]);

  const fetchConfigEntries = useCallback(async (path: string, shellType: ShellType) => {
    if (!isTauri()) return null;
    try {
      const entries = await tauri.terminalGetConfigEntries(path, shellType);
      markResourcesFresh(['configEntries']);
      return entries;
    } catch (e) {
      toast.error(t('terminal.toastParseConfigFailed', { error: String(e) }));
      return null;
    }
  }, [markResourcesFresh, t]);

  const parseConfigContent = useCallback(async (content: string, shellType: ShellType) => {
    if (!isTauri()) return null;
    try {
      return await tauri.terminalParseConfigContent(content, shellType);
    } catch (e) {
      toast.error(t('terminal.toastParseConfigFailed', { error: String(e) }));
      return null;
    }
  }, [t]);

  const validateConfigContent = useCallback(async (
    content: string,
    shellType: ShellType,
  ) => {
    if (!isTauri()) return [] as TerminalConfigDiagnostic[];
    try {
      return await tauri.terminalValidateConfigContent(content, shellType);
    } catch (e) {
      toast.error(t('terminal.toastParseConfigFailed', { error: String(e) }));
      return [] as TerminalConfigDiagnostic[];
    }
  }, [t]);

  const getConfigEditorMetadata = useCallback(async (
    path: string,
    shellType: ShellType,
  ): Promise<TerminalConfigEditorMetadata | null> => {
    if (!isTauri()) return null;
    try {
      const metadata = await tauri.terminalGetConfigEditorMetadata(path, shellType);
      markResourcesFresh(['configMetadata']);
      return metadata;
    } catch (e) {
      toast.error(t('terminal.toastReadConfigFailed', { error: String(e) }));
      return null;
    }
  }, [markResourcesFresh, t]);

  // PowerShell Management
  const fetchPSProfiles = useCallback(async () => {
    if (!isTauri()) return;
    setState((prev) => ({ ...prev, psLoading: true }));
    try {
      const psProfiles = await tauri.terminalPsListProfiles();
      setState((prev) => ({
        ...prev,
        psProfiles,
        psLoading: false,
        resourceStale: {
          ...prev.resourceStale,
          psProfiles: false,
        },
      }));
    } catch (e) {
      setState((prev) => ({ ...prev, psLoading: false }));
      toast.error(t('terminal.toastLoadPsProfilesFailed', { error: String(e) }));
    }
  }, [t]);

  const readPSProfile = useCallback(async (scope: string) => {
    if (!isTauri()) return '';
    try {
      return await tauri.terminalPsReadProfile(scope);
    } catch (e) {
      toast.error(t('terminal.toastReadPsProfileFailed', { error: String(e) }));
      return '';
    }
  }, [t]);

  const writePSProfile = useCallback(async (scope: string, content: string) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalPsWriteProfile(scope, content);
      markResourcesStale(['psProfiles']);
      await fetchPSProfiles();
      toast.success(t('terminal.toastPsProfileUpdated'));
    } catch (e) {
      toast.error(t('terminal.toastWritePsProfileFailed', { error: String(e) }));
    }
  }, [fetchPSProfiles, markResourcesStale, t]);

  const fetchExecutionPolicy = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const executionPolicy = await tauri.terminalPsGetExecutionPolicy();
      setState((prev) => ({
        ...prev,
        executionPolicy,
        resourceStale: {
          ...prev.resourceStale,
          executionPolicy: false,
        },
      }));
    } catch (e) {
      toast.error(t('terminal.toastGetPolicyFailed', { error: String(e) }));
    }
  }, [t]);

  const setExecutionPolicy = useCallback(async (policy: string, scope: string) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalPsSetExecutionPolicy(policy, scope);
      markResourcesStale(['executionPolicy']);
      await fetchExecutionPolicy();
      toast.success(t('terminal.toastPolicySet', { policy }));
    } catch (e) {
      toast.error(t('terminal.toastSetPolicyFailed', { error: String(e) }));
    }
  }, [fetchExecutionPolicy, markResourcesStale, t]);

  const fetchPSModules = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const psModules = await tauri.terminalPsListAllModules();
      setState((prev) => ({
        ...prev,
        psModules,
        resourceStale: {
          ...prev.resourceStale,
          psModules: false,
        },
      }));
    } catch (e) {
      toast.error(t('terminal.toastLoadModulesFailed', { error: String(e) }));
    }
  }, [t]);

  const fetchPSScripts = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const psScripts = await tauri.terminalPsListInstalledScripts();
      setState((prev) => ({
        ...prev,
        psScripts,
        resourceStale: {
          ...prev.resourceStale,
          psScripts: false,
        },
      }));
    } catch (e) {
      toast.error(t('terminal.toastLoadScriptsFailed', { error: String(e) }));
    }
  }, [t]);

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
      toast.error(t('terminal.toastDetectFrameworksFailed', { error: String(e) }));
    }
  }, [t]);

  const fetchPlugins = useCallback(async (frameworkName: string, frameworkPath: string, shellType: ShellType, configPath?: string | null) => {
    if (!isTauri()) return;
    try {
      const plugins = await tauri.terminalListPlugins(frameworkName, frameworkPath, shellType, configPath);
      setState((prev) => ({ ...prev, plugins }));
    } catch (e) {
      toast.error(t('terminal.toastLoadPluginsFailed', { error: String(e) }));
    }
  }, [t]);

  // Framework Cache Management
  const fetchFrameworkCacheStats = useCallback(async () => {
    if (!isTauri()) return;
    setState((prev) => ({ ...prev, frameworkCacheLoading: true }));
    try {
      const frameworkCacheStats = await tauri.terminalGetFrameworkCacheStats();
      setState((prev) => ({ ...prev, frameworkCacheStats, frameworkCacheLoading: false }));
    } catch (e) {
      setState((prev) => ({ ...prev, frameworkCacheLoading: false }));
      toast.error(t('terminal.toastLoadCacheStatsFailed', { error: String(e) }));
    }
  }, [t]);

  const cleanFrameworkCache = useCallback(async (frameworkName: string) => {
    if (!isTauri()) return;
    try {
      const freedBytes = await tauri.terminalCleanFrameworkCache(frameworkName);
      const freedMB = (freedBytes / (1024 * 1024)).toFixed(1);
      toast.success(t('terminal.toastCacheCleaned', { size: freedMB, name: frameworkName }));
      await fetchFrameworkCacheStats();
    } catch (e) {
      toast.error(t('terminal.toastCleanCacheFailed', { name: frameworkName, error: String(e) }));
    }
  }, [fetchFrameworkCacheStats, t]);

  // Shell Environment Variables
  const fetchShellEnvVars = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const shellEnvVars = await tauri.terminalGetShellEnvVars();
      setState((prev) => ({
        ...prev,
        shellEnvVars,
        resourceStale: {
          ...prev.resourceStale,
          shellEnvVars: false,
        },
      }));
    } catch (e) {
      toast.error(t('terminal.toastLoadEnvVarsFailed', { error: String(e) }));
    }
  }, [t]);

  // Profile Duplicate / Import / Export
  const duplicateProfile = useCallback(async (id: string) => {
    if (!isTauri()) return;
    try {
      const newId = await tauri.terminalDuplicateProfile(id);
      markResourcesStale(['profiles']);
      await fetchProfiles();
      toast.success(t('terminal.toastProfileDuplicated'));
      return newId;
    } catch (e) {
      toast.error(t('terminal.toastDuplicateFailed', { error: String(e) }));
    }
  }, [fetchProfiles, markResourcesStale, t]);

  const exportProfiles = useCallback(async () => {
    if (!isTauri()) return '';
    try {
      const json = await tauri.terminalExportProfiles();
      toast.success(t('terminal.toastProfilesExported'));
      return json;
    } catch (e) {
      toast.error(t('terminal.toastExportFailed', { error: String(e) }));
      return '';
    }
  }, [t]);

  const importProfiles = useCallback(async (json: string, merge: boolean) => {
    if (!isTauri()) return 0;
    try {
      const count = await tauri.terminalImportProfiles(json, merge);
      markResourcesStale(['profiles']);
      await fetchProfiles();
      toast.success(t('terminal.toastProfilesImported', { count }));
      return count;
    } catch (e) {
      toast.error(t('terminal.toastImportFailed', { error: String(e) }));
      return 0;
    }
  }, [fetchProfiles, markResourcesStale, t]);

  // Templates
  const fetchTemplates = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const templates = await tauri.terminalListTemplates();
      setState((prev) => ({
        ...prev,
        templates,
        resourceStale: {
          ...prev.resourceStale,
          templates: false,
        },
      }));
    } catch (e) {
      toast.error(t('terminal.toastLoadTemplatesFailed', { error: String(e) }));
    }
  }, [t]);

  const createCustomTemplate = useCallback(async (template: TerminalProfileTemplate) => {
    if (!isTauri()) return;
    try {
      const id = await tauri.terminalCreateCustomTemplate(template);
      markResourcesStale(['templates']);
      await fetchTemplates();
      toast.success(t('terminal.toastTemplateCreated'));
      return id;
    } catch (e) {
      toast.error(t('terminal.toastCreateTemplateFailed', { error: String(e) }));
    }
  }, [fetchTemplates, markResourcesStale, t]);

  const deleteCustomTemplate = useCallback(async (id: string) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalDeleteCustomTemplate(id);
      markResourcesStale(['templates']);
      await fetchTemplates();
      toast.success(t('terminal.toastTemplateDeleted'));
    } catch (e) {
      toast.error(t('terminal.toastDeleteTemplateFailed', { error: String(e) }));
    }
  }, [fetchTemplates, markResourcesStale, t]);

  const saveProfileAsTemplate = useCallback(async (
    profileId: string,
    templateName: string,
    templateDescription: string,
  ) => {
    if (!isTauri()) return;
    try {
      const id = await tauri.terminalSaveProfileAsTemplate(profileId, templateName, templateDescription);
      markResourcesStale(['templates']);
      await fetchTemplates();
      toast.success(t('terminal.toastProfileSavedAsTemplate'));
      return id;
    } catch (e) {
      toast.error(t('terminal.toastSaveAsTemplateFailed', { error: String(e) }));
    }
  }, [fetchTemplates, markResourcesStale, t]);

  const createProfileFromTemplate = useCallback(async (templateId: string) => {
    if (!isTauri()) return undefined;
    try {
      return await tauri.terminalCreateProfileFromTemplate(templateId);
    } catch (e) {
      toast.error(t('terminal.toastCreateFromTemplateFailed', { error: String(e) }));
      return undefined;
    }
  }, [t]);

  // Shell Config Write
  const writeShellConfig = useCallback(async (
    path: string,
    content: string,
    shellType?: ShellType,
  ) => {
    if (!isTauri()) return;
    setState((prev) => ({
      ...prev,
      configMutationState: {
        status: 'loading',
        message: null,
        result: null,
        updatedAt: Date.now(),
      },
    }));
    try {
      const diagnostics = await tauri.terminalValidateConfigContent(
        content,
        shellType ?? inferShellTypeFromConfigPath(path),
      );
      if (diagnostics.length > 0) {
        const result = buildValidationFailureResult(path, diagnostics);
        const message = t('terminal.toastSaveConfigFailed', { error: diagnostics[0].message });
        setState((prev) => ({
          ...prev,
          configMutationState: {
            status: 'error',
            message,
            result,
            updatedAt: Date.now(),
          },
        }));
        toast.error(message);
        return result;
      }

      const result = await tauri.terminalWriteConfigVerified(path, content);
      const isSuccess = result.verified;
      const message = isSuccess
        ? t('terminal.toastConfigSaved')
        : t('terminal.toastSaveConfigFailed', {
          error: result.diagnostics[0] ?? 'Config verification failed',
        });
      setState((prev) => ({
        ...prev,
        configMutationState: {
          status: isSuccess ? 'success' : 'error',
          message,
          result,
          updatedAt: Date.now(),
        },
      }));
      if (isSuccess) {
        markResourcesStale(['configEntries', 'configMetadata']);
        toast.success(message);
      } else {
        toast.error(message);
      }
      return result;
    } catch (e) {
      const message = t('terminal.toastSaveConfigFailed', { error: String(e) });
      setState((prev) => ({
        ...prev,
        configMutationState: {
          status: 'error',
          message,
          result: null,
          updatedAt: Date.now(),
        },
      }));
      toast.error(message);
      return undefined;
    }
  }, [markResourcesStale, t]);

  const restoreConfigSnapshot = useCallback(async (
    path: string,
  ): Promise<TerminalConfigRestoreResult | undefined> => {
    if (!isTauri()) return undefined;
    setState((prev) => ({
      ...prev,
      configMutationState: {
        status: 'loading',
        message: null,
        result: null,
        updatedAt: Date.now(),
      },
    }));
    try {
      const result = await tauri.terminalRestoreConfigSnapshot(path);
      const isSuccess = result.verified;
      const message = isSuccess
        ? t('terminal.toastConfigUpdated')
        : t('terminal.toastSaveConfigFailed', {
          error: result.diagnostics[0] ?? 'Restore verification failed',
        });
      setState((prev) => ({
        ...prev,
        configMutationState: {
          status: isSuccess ? 'success' : 'error',
          message,
          result,
          updatedAt: Date.now(),
        },
      }));
      if (isSuccess) {
        markResourcesStale(['configEntries', 'configMetadata']);
        toast.success(message);
      } else {
        toast.error(message);
      }
      return result;
    } catch (e) {
      const message = t('terminal.toastSaveConfigFailed', { error: String(e) });
      setState((prev) => ({
        ...prev,
        configMutationState: {
          status: 'error',
          message,
          result: null,
          updatedAt: Date.now(),
        },
      }));
      toast.error(message);
      return undefined;
    }
  }, [markResourcesStale, t]);

  // PowerShell Module Management
  const installPSModule = useCallback(async (name: string, scope: string) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalPsInstallModule(name, scope);
      markResourcesStale(['psModules']);
      await fetchPSModules();
      toast.success(t('terminal.toastModuleInstalled', { name }));
    } catch (e) {
      toast.error(t('terminal.toastInstallModuleFailed', { error: String(e) }));
    }
  }, [fetchPSModules, markResourcesStale, t]);

  const uninstallPSModule = useCallback(async (name: string) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalPsUninstallModule(name);
      markResourcesStale(['psModules']);
      await fetchPSModules();
      toast.success(t('terminal.toastModuleUninstalled', { name }));
    } catch (e) {
      toast.error(t('terminal.toastUninstallModuleFailed', { error: String(e) }));
    }
  }, [fetchPSModules, markResourcesStale, t]);

  const updatePSModule = useCallback(async (name: string) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalPsUpdateModule(name);
      markResourcesStale(['psModules']);
      await fetchPSModules();
      toast.success(t('terminal.toastModuleUpdated', { name }));
    } catch (e) {
      toast.error(t('terminal.toastUpdateModuleFailed', { error: String(e) }));
    }
  }, [fetchPSModules, markResourcesStale, t]);

  const searchPSModules = useCallback(async (query: string) => {
    if (!isTauri()) return [];
    try {
      return await tauri.terminalPsFindModule(query);
    } catch (e) {
      toast.error(t('terminal.toastSearchModulesFailed', { error: String(e) }));
      return [];
    }
  }, [t]);

  // Proxy Environment Variables
  const fetchProxyEnvVars = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const proxyEnvVars = await tauri.terminalGetProxyEnvVars();
      setState((prev) => ({
        ...prev,
        proxyEnvVars,
        resourceStale: {
          ...prev.resourceStale,
          proxyEnvVars: false,
        },
      }));
    } catch (e) {
      toast.error(t('terminal.toastLoadProxyVarsFailed', { error: String(e) }));
    }
  }, [t]);

  // Proxy Config Management
  const parseProxyConfigMap = useCallback((config: [string, string][]) => {
    const configMap: Record<string, string> = {};
    for (const [k, v] of config) {
      configMap[k] = v;
    }
    const normalizedMode = (configMap['terminal.proxy_mode'] || 'global').trim();
    const proxyMode: ProxyMode = normalizedMode === 'custom' || normalizedMode === 'none'
      ? normalizedMode
      : 'global';
    return {
      proxyMode,
      customProxy: (configMap['terminal.custom_proxy'] || '').trim(),
      noProxy: (configMap['terminal.no_proxy'] || '').trim(),
      globalProxy: (configMap['network.proxy'] || '').trim(),
    };
  }, []);

  const reloadCanonicalProxyState = useCallback(async () => {
    const config = await tauri.configList();
    const parsed = parseProxyConfigMap(config);
    const proxyEnvVars = await tauri.terminalGetProxyEnvVars();
    setState((prev) => ({
      ...prev,
      ...parsed,
      proxyEnvVars,
      resourceStale: {
        ...prev.resourceStale,
        proxyConfig: false,
        proxyEnvVars: false,
      },
    }));
    return {
      ...parsed,
      proxyEnvVars,
    };
  }, [parseProxyConfigMap]);

  const setProxySyncLoading = useCallback((saving: boolean) => {
    setState((prev) => ({
      ...prev,
      proxyConfigSaving: saving,
      proxySyncState: {
        status: 'loading',
        message: null,
        result: null,
        updatedAt: Date.now(),
      },
    }));
  }, []);

  const setProxySyncResult = useCallback((
    status: 'success' | 'error',
    message: string | null,
    result: UseTerminalState['proxySyncState']['result'],
  ) => {
    setState((prev) => ({
      ...prev,
      proxyConfigSaving: false,
      proxySyncState: {
        status,
        message,
        result,
        updatedAt: Date.now(),
      },
    }));
  }, []);

  const finalizeProxySyncError = useCallback(async (message: string) => {
    let recovered: UseTerminalState['proxySyncState']['result'] = null;
    try {
      recovered = await reloadCanonicalProxyState();
    } catch {
      // Keep recovered result null when canonical reload is unavailable.
    }
    setProxySyncResult('error', message, recovered);
    toast.error(message);
  }, [reloadCanonicalProxyState, setProxySyncResult]);

  const loadProxyConfig = useCallback(async () => {
    if (!isTauri()) return;
    setProxySyncLoading(false);
    try {
      const result = await reloadCanonicalProxyState();
      setProxySyncResult('success', null, result);
    } catch (e) {
      const message = t('terminal.toastLoadProxyVarsFailed', { error: String(e) });
      setProxySyncResult('error', message, null);
      toast.error(message);
    }
  }, [reloadCanonicalProxyState, setProxySyncLoading, setProxySyncResult, t]);

  const updateProxyMode = useCallback(async (mode: ProxyMode) => {
    setState((prev) => ({ ...prev, proxyMode: mode }));
    if (!isTauri()) return;
    setProxySyncLoading(true);
    try {
      await tauri.configSet('terminal.proxy_mode', mode);
      const result = await reloadCanonicalProxyState();
      setProxySyncResult('success', t('terminal.toastConfigUpdated'), result);
      markResourcesStale(['proxyConfig', 'proxyEnvVars', 'shellEnvVars']);
    } catch (e) {
      const message = t('terminal.toastSetProxyModeFailed', { error: String(e) });
      await finalizeProxySyncError(message);
    }
  }, [
    finalizeProxySyncError,
    markResourcesStale,
    reloadCanonicalProxyState,
    setProxySyncLoading,
    setProxySyncResult,
    t,
  ]);

  const updateCustomProxy = useCallback(async (value: string) => {
    setState((prev) => ({ ...prev, customProxy: value }));
  }, []);

  const saveCustomProxy = useCallback(async () => {
    if (!isTauri()) return;
    setProxySyncLoading(true);
    try {
      await tauri.configSet('terminal.custom_proxy', state.customProxy.trim());
      const result = await reloadCanonicalProxyState();
      setProxySyncResult('success', t('terminal.toastConfigSaved'), result);
      markResourcesStale(['proxyConfig', 'proxyEnvVars', 'shellEnvVars']);
    } catch (e) {
      const message = t('terminal.toastSaveProxyFailed', { error: String(e) });
      await finalizeProxySyncError(message);
    }
  }, [
    finalizeProxySyncError,
    markResourcesStale,
    reloadCanonicalProxyState,
    setProxySyncLoading,
    setProxySyncResult,
    state.customProxy,
    t,
  ]);

  const updateNoProxy = useCallback(async (value: string) => {
    setState((prev) => ({ ...prev, noProxy: value }));
  }, []);

  const saveNoProxy = useCallback(async () => {
    if (!isTauri()) return;
    setProxySyncLoading(true);
    try {
      await tauri.configSet('terminal.no_proxy', state.noProxy.trim());
      const result = await reloadCanonicalProxyState();
      setProxySyncResult('success', t('terminal.toastConfigSaved'), result);
      markResourcesStale(['proxyConfig', 'proxyEnvVars', 'shellEnvVars']);
    } catch (e) {
      const message = t('terminal.toastSaveNoProxyFailed', { error: String(e) });
      await finalizeProxySyncError(message);
    }
  }, [
    finalizeProxySyncError,
    markResourcesStale,
    reloadCanonicalProxyState,
    setProxySyncLoading,
    setProxySyncResult,
    state.noProxy,
    t,
  ]);

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
            resourceStale: {
              ...prev.resourceStale,
              profiles: false,
              templates: false,
            },
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
    measureStartup,
    checkShellHealth,
    fetchProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
    setDefaultProfile,
    launchProfile,
    clearLaunchResult,
    clearConfigMutationState,
    clearProxySyncState,
    markResourcesStale,
    markResourcesFresh,
    readShellConfig,
    backupShellConfig,
    appendToShellConfig,
    fetchConfigEntries,
    parseConfigContent,
    validateConfigContent,
    getConfigEditorMetadata,
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
    restoreConfigSnapshot,
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
