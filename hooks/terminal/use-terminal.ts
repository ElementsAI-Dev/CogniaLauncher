'use client';

import { useEffect, useState, useCallback } from 'react';
import * as tauri from '@/lib/tauri';
import { isTauri } from '@/lib/platform';
import { useTerminalStore } from '@/lib/stores/terminal';
import { resolveTerminalEditorCapability } from '@/lib/terminal/editor/capability-registry';
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
import type {
  UseTerminalState,
  ProxyMode,
  TerminalResourceKey,
  TerminalReadoutStatus,
  TerminalFrameworkReadout,
  TerminalShellReadout,
} from '@/types/terminal';

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

function buildFrameworkReadoutKey(
  frameworkName: string,
  frameworkPath: string,
  shellType: ShellType,
): string {
  return `${shellType}:${frameworkName}:${frameworkPath}`;
}

function isShellConfigAvailable(
  shell?: { configFiles: Array<{ exists: boolean }> },
): boolean {
  if (!shell) return false;
  return shell.configFiles.some((configFile) => configFile.exists);
}

function createShellReadout(
  shellId: string,
  existing?: TerminalShellReadout,
): TerminalShellReadout {
  return existing ?? {
    shellId,
    status: 'ready',
    degradedReason: null,
    startupStatus: 'idle',
    startupFreshness: null,
    healthStatus: 'idle',
    healthFreshness: null,
    frameworkSummaryCount: 0,
    pluginSummaryCount: 0,
    lastUpdatedAt: null,
  };
}

function buildFrameworkDiscoveryFallback(
  shellType: ShellType,
  hasConfig: boolean,
): {
  status: TerminalShellReadout['status'];
  degradedReason: string | null;
} {
  if (!hasConfig) {
    return {
      status: 'missing-config',
      degradedReason: 'No shell config sources are available for framework discovery.',
    };
  }

  if (!['bash', 'zsh', 'fish', 'powershell'].includes(shellType)) {
    return {
      status: 'unsupported',
      degradedReason: `Framework discovery is unavailable for ${shellType}.`,
    };
  }

  return {
    status: 'ready',
    degradedReason: null,
  };
}

function resolveShellReadoutStatus(
  readout: Pick<
    TerminalShellReadout,
    'status' | 'startupStatus' | 'startupFreshness' | 'healthStatus' | 'healthFreshness'
  >,
): TerminalReadoutStatus {
  if (readout.startupFreshness === 'stale' || readout.healthFreshness === 'stale') {
    return 'stale';
  }
  if (readout.startupStatus === 'failed' || readout.healthStatus === 'failed') {
    return 'failed';
  }
  if (readout.status === 'missing-config' || readout.status === 'unsupported') {
    return readout.status;
  }
  return 'ready';
}

export type UseTerminalReturn = ReturnType<typeof useTerminal>;

export function useTerminal({ t }: UseTerminalOptions) {
  const storeProfiles = useTerminalStore((state) => state.profiles);
  const storeShells = useTerminalStore((state) => state.shells);
  const defaultProfileId = useTerminalStore((state) => state.defaultProfileId);
  const storeLoading = useTerminalStore((state) => state.loading);
  const storeError = useTerminalStore((state) => state.error);
  const hydrateTerminalStore = useTerminalStore((state) => state.hydrate);
  const setStoreProfiles = useTerminalStore((state) => state.setProfiles);
  const setStoreShells = useTerminalStore((state) => state.setShells);
  const setStoreDefaultProfileId = useTerminalStore((state) => state.setDefaultProfileId);
  const upsertStoreProfile = useTerminalStore((state) => state.upsertProfile);
  const removeStoreProfile = useTerminalStore((state) => state.removeProfile);
  const markStoreProfileLaunched = useTerminalStore((state) => state.markProfileLaunched);
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
    shellReadouts: {},
    frameworkReadouts: {},
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
      setStoreShells(shells);
      setState((prev) => ({
        ...prev,
        shellReadouts: shells.reduce<Record<string, TerminalShellReadout>>((acc, shell) => {
          acc[shell.id] = createShellReadout(shell.id, prev.shellReadouts[shell.id]);
          return acc;
        }, { ...prev.shellReadouts }),
        shellsLoading: false,
      }));
    } catch (e) {
      setState((prev) => ({ ...prev, shellsLoading: false, error: String(e) }));
    }
  }, [setStoreShells]);

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
        shellReadouts: {
          ...prev.shellReadouts,
          [shellId]: {
            ...createShellReadout(shellId, prev.shellReadouts[shellId]),
            startupStatus: 'ready',
            startupFreshness: 'fresh',
            status: resolveShellReadoutStatus({
              ...createShellReadout(shellId, prev.shellReadouts[shellId]),
              startupStatus: 'ready',
              startupFreshness: 'fresh',
            }),
            degradedReason:
              resolveShellReadoutStatus({
                ...createShellReadout(shellId, prev.shellReadouts[shellId]),
                startupStatus: 'ready',
                startupFreshness: 'fresh',
              }) === 'ready'
                ? null
                : prev.shellReadouts[shellId]?.degradedReason ?? null,
            lastUpdatedAt: Date.now(),
          },
        },
      }));
    } catch (e) {
      setState((prev) => ({
        ...prev,
        measuringShellId: null,
        shellReadouts: {
          ...prev.shellReadouts,
          [shellId]: {
            ...createShellReadout(shellId, prev.shellReadouts[shellId]),
            startupStatus: prev.startupMeasurements[shellId] ? 'ready' : 'failed',
            startupFreshness: prev.startupMeasurements[shellId] ? 'stale' : null,
            status: prev.startupMeasurements[shellId] ? 'stale' : 'failed',
            degradedReason: String(e),
            lastUpdatedAt: Date.now(),
          },
        },
      }));
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
        shellReadouts: {
          ...prev.shellReadouts,
          [shellId]: {
            ...createShellReadout(shellId, prev.shellReadouts[shellId]),
            healthStatus: 'ready',
            healthFreshness: 'fresh',
            status: resolveShellReadoutStatus({
              ...createShellReadout(shellId, prev.shellReadouts[shellId]),
              healthStatus: 'ready',
              healthFreshness: 'fresh',
            }),
            degradedReason:
              resolveShellReadoutStatus({
                ...createShellReadout(shellId, prev.shellReadouts[shellId]),
                healthStatus: 'ready',
                healthFreshness: 'fresh',
              }) === 'ready'
                ? null
                : prev.shellReadouts[shellId]?.degradedReason ?? null,
            lastUpdatedAt: Date.now(),
          },
        },
      }));
    } catch (e) {
      setState((prev) => ({
        ...prev,
        checkingHealthShellId: null,
        shellReadouts: {
          ...prev.shellReadouts,
          [shellId]: {
            ...createShellReadout(shellId, prev.shellReadouts[shellId]),
            healthStatus: prev.healthResults[shellId] ? 'ready' : 'failed',
            healthFreshness: prev.healthResults[shellId] ? 'stale' : null,
            status: prev.healthResults[shellId] ? 'stale' : 'failed',
            degradedReason: String(e),
            lastUpdatedAt: Date.now(),
          },
        },
      }));
      toast.error(t('terminal.toastCheckHealthFailed', { error: String(e) }));
    }
  }, [t]);

  const getShellInfo = useCallback(async (shellId: string) => {
    if (!isTauri()) return null;
    try {
      const shellInfo = await tauri.terminalGetShellInfo(shellId);
      setState((prev) => ({
        ...prev,
        selectedShellId: shellId,
        shellReadouts: {
          ...prev.shellReadouts,
          [shellId]: {
            ...createShellReadout(shellId, prev.shellReadouts[shellId]),
            lastUpdatedAt: Date.now(),
          },
        },
      }));
      return shellInfo;
    } catch (e) {
      toast.error(t('terminal.toastLoadShellInfoFailed', { error: String(e) }));
      return null;
    }
  }, [t]);

  // Terminal Profiles
  const fetchProfiles = useCallback(async () => {
    if (!isTauri()) return;
    setState((prev) => ({ ...prev, profilesLoading: true }));
    try {
      const profiles = await tauri.terminalListProfiles();
      setStoreProfiles(profiles);
      setState((prev) => ({
        ...prev,
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
  }, [setStoreProfiles, t]);

  const createProfile = useCallback(async (profile: TerminalProfile) => {
    if (!isTauri()) return;
    try {
      const id = await tauri.terminalCreateProfile(profile);
      upsertStoreProfile({
        ...profile,
        id,
      });
      markResourcesStale(['profiles']);
      toast.success(t('terminal.toastProfileCreated'));
      return id;
    } catch (e) {
      toast.error(t('terminal.toastCreateProfileFailed', { error: String(e) }));
    }
  }, [markResourcesStale, t, upsertStoreProfile]);

  const updateProfile = useCallback(async (profile: TerminalProfile) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalUpdateProfile(profile);
      upsertStoreProfile(profile);
      markResourcesStale(['profiles']);
      toast.success(t('terminal.toastProfileUpdated'));
    } catch (e) {
      toast.error(t('terminal.toastUpdateProfileFailed', { error: String(e) }));
    }
  }, [markResourcesStale, t, upsertStoreProfile]);

  const deleteProfile = useCallback(async (id: string) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalDeleteProfile(id);
      removeStoreProfile(id);
      markResourcesStale(['profiles']);
      toast.success(t('terminal.toastProfileDeleted'));
    } catch (e) {
      toast.error(t('terminal.toastDeleteProfileFailed', { error: String(e) }));
    }
  }, [markResourcesStale, removeStoreProfile, t]);

  const setDefaultProfile = useCallback(async (id: string) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalSetDefaultProfile(id);
      setStoreDefaultProfileId(id);
      markResourcesStale(['profiles']);
      toast.success(t('terminal.toastDefaultProfileSet'));
    } catch (e) {
      toast.error(t('terminal.toastSetDefaultFailed', { error: String(e) }));
    }
  }, [markResourcesStale, setStoreDefaultProfileId, t]);

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
        markStoreProfileLaunched(id);
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
  }, [markStoreProfileLaunched, t]);

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
      const enrichedMetadata = metadata.capability
        ? metadata
        : {
            ...metadata,
            capability: resolveTerminalEditorCapability({
              shellType: metadata.shellType ?? shellType,
              configPath: path,
              language: metadata.language,
            }),
          };
      markResourcesFresh(['configMetadata']);
      return enrichedMetadata;
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
      return true;
    } catch (e) {
      toast.error(t('terminal.toastWritePsProfileFailed', { error: String(e) }));
      return false;
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
      return true;
    } catch (e) {
      toast.error(t('terminal.toastSetPolicyFailed', { error: String(e) }));
      return false;
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

  const getPSModuleDetail = useCallback(async (name: string) => {
    if (!isTauri()) return null;
    try {
      return await tauri.terminalPsGetModuleDetail(name);
    } catch (e) {
      toast.error(t('terminal.toastLoadModuleDetailFailed', { error: String(e) }));
      return null;
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
      setState((prev) => {
        const nextFrameworks = [
          ...prev.frameworks.filter((item) => item.shellType !== shellType),
          ...frameworks,
        ];
        const nextShellReadouts = { ...prev.shellReadouts };
        for (const shell of storeShells.filter((item) => item.shellType === shellType)) {
          const fallback = frameworks.length === 0
            ? buildFrameworkDiscoveryFallback(shellType, isShellConfigAvailable(shell))
            : { status: 'ready' as const, degradedReason: null };
          const nextReadout = {
            ...createShellReadout(shell.id, prev.shellReadouts[shell.id]),
            frameworkSummaryCount: frameworks.length,
            status: fallback.status,
            degradedReason: fallback.degradedReason,
            lastUpdatedAt: Date.now(),
          };
          nextShellReadouts[shell.id] = {
            ...nextReadout,
            status:
              fallback.status === 'ready'
                ? resolveShellReadoutStatus(nextReadout)
                : fallback.status,
          };
        }

        const nextFrameworkReadouts = Object.fromEntries(
          Object.entries(prev.frameworkReadouts).filter(
            ([, readout]) => readout.shellType !== shellType,
          ),
        ) as Record<string, TerminalFrameworkReadout>;
        for (const framework of frameworks) {
          const key = buildFrameworkReadoutKey(
            framework.name,
            framework.path,
            framework.shellType,
          );
          nextFrameworkReadouts[key] = {
            key,
            shellType: framework.shellType,
            status:
              framework.pluginSupportStatus === 'supported'
                ? 'ready'
                : framework.pluginSupportStatus,
            degradedReason: framework.pluginSupportReason,
            pluginCount: prev.frameworkReadouts[key]?.pluginCount ?? 0,
            freshness: 'fresh',
            lastUpdatedAt: Date.now(),
          };
        }

        return {
          ...prev,
          frameworks: nextFrameworks,
          shellReadouts: nextShellReadouts,
          frameworkReadouts: nextFrameworkReadouts,
        };
      });
    } catch (e) {
      setState((prev) => {
        const nextShellReadouts = { ...prev.shellReadouts };
        for (const shell of storeShells.filter((item) => item.shellType === shellType)) {
          const previousReadout = createShellReadout(shell.id, prev.shellReadouts[shell.id]);
          const hasStableFrameworkReadout = previousReadout.frameworkSummaryCount > 0;
          nextShellReadouts[shell.id] = {
            ...previousReadout,
            status: hasStableFrameworkReadout ? 'stale' : 'failed',
            degradedReason: String(e),
            lastUpdatedAt: Date.now(),
          };
        }
        return {
          ...prev,
          shellReadouts: nextShellReadouts,
        };
      });
      toast.error(t('terminal.toastDetectFrameworksFailed', { error: String(e) }));
    }
  }, [storeShells, t]);

  const fetchPlugins = useCallback(async (frameworkName: string, frameworkPath: string, shellType: ShellType, configPath?: string | null) => {
    if (!isTauri()) return;
    try {
      const plugins = await tauri.terminalListPlugins(frameworkName, frameworkPath, shellType, configPath);
      setState((prev) => {
        const key = buildFrameworkReadoutKey(frameworkName, frameworkPath, shellType);
        const framework = prev.frameworks.find(
          (item) =>
            item.name === frameworkName
            && item.path === frameworkPath
            && item.shellType === shellType,
        );
        const shell = storeShells.find((item) => item.shellType === shellType);
        const degradedReason =
          plugins.length === 0 && framework?.pluginSupportStatus !== 'supported'
            ? framework?.pluginSupportReason ?? null
            : null;

        return {
          ...prev,
          selectedShellId: shell?.id ?? prev.selectedShellId,
          plugins,
          frameworkReadouts: {
            ...prev.frameworkReadouts,
            [key]: {
              key,
              shellType,
              status:
                plugins.length === 0 && framework?.pluginSupportStatus !== 'supported'
                  ? framework?.pluginSupportStatus ?? 'ready'
                  : 'ready',
              degradedReason,
              pluginCount: plugins.length,
              freshness: 'fresh',
              lastUpdatedAt: Date.now(),
            },
          },
          shellReadouts: shell
            ? {
                ...prev.shellReadouts,
                [shell.id]: {
                  ...createShellReadout(shell.id, prev.shellReadouts[shell.id]),
                  pluginSummaryCount: plugins.length,
                  lastUpdatedAt: Date.now(),
                },
              }
            : prev.shellReadouts,
        };
      });
    } catch (e) {
      setState((prev) => {
        const key = buildFrameworkReadoutKey(frameworkName, frameworkPath, shellType);
        return {
          ...prev,
          frameworkReadouts: {
            ...prev.frameworkReadouts,
            [key]: {
              key,
              shellType,
              status: prev.frameworkReadouts[key]?.pluginCount
                ? 'stale'
                : 'failed',
              degradedReason: String(e),
              pluginCount: prev.frameworkReadouts[key]?.pluginCount ?? 0,
              freshness: prev.frameworkReadouts[key]?.pluginCount
                ? 'stale'
                : prev.frameworkReadouts[key]?.freshness ?? 'fresh',
              lastUpdatedAt: Date.now(),
            },
          },
        };
      });
      toast.error(t('terminal.toastLoadPluginsFailed', { error: String(e) }));
    }
  }, [storeShells, t]);

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

  const getSingleFrameworkCacheInfo = useCallback(async (
    frameworkName: string,
    frameworkPath: string,
    shellType: ShellType,
  ) => {
    if (!isTauri()) return null;
    try {
      return await tauri.terminalGetSingleFrameworkCacheInfo(frameworkName, frameworkPath, shellType);
    } catch (e) {
      toast.error(t('terminal.toastLoadCacheStatsFailed', { error: String(e) }));
      return null;
    }
  }, [t]);

  const cleanFrameworkCache = useCallback(async (frameworkName: string) => {
    if (!isTauri()) return;
    try {
      const freedBytes = await tauri.terminalCleanFrameworkCache(frameworkName);
      const freedMB = (freedBytes / (1024 * 1024)).toFixed(1);
      toast.success(t('terminal.toastCacheCleaned', { size: freedMB, name: frameworkName }));
      await fetchFrameworkCacheStats();
      return freedBytes;
    } catch (e) {
      toast.error(t('terminal.toastCleanCacheFailed', { name: frameworkName, error: String(e) }));
      return null;
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

  const revealShellEnvVar = useCallback(async (key: string) => {
    if (!isTauri()) return null;
    try {
      const result = await tauri.terminalRevealShellEnvVar(key);
      return result.value;
    } catch (e) {
      toast.error(t('terminal.toastLoadEnvVarsFailed', { error: String(e) }));
      return null;
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
      return true;
    } catch (e) {
      toast.error(t('terminal.toastDeleteTemplateFailed', { error: String(e) }));
      return false;
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
      markResourcesStale(['psModules', 'psScripts']);
      await Promise.all([fetchPSModules(), fetchPSScripts()]);
      toast.success(t('terminal.toastModuleInstalled', { name }));
      return true;
    } catch (e) {
      toast.error(t('terminal.toastInstallModuleFailed', { error: String(e) }));
      return false;
    }
  }, [fetchPSModules, fetchPSScripts, markResourcesStale, t]);

  const uninstallPSModule = useCallback(async (name: string) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalPsUninstallModule(name);
      markResourcesStale(['psModules', 'psScripts']);
      await Promise.all([fetchPSModules(), fetchPSScripts()]);
      toast.success(t('terminal.toastModuleUninstalled', { name }));
      return true;
    } catch (e) {
      toast.error(t('terminal.toastUninstallModuleFailed', { error: String(e) }));
      return false;
    }
  }, [fetchPSModules, fetchPSScripts, markResourcesStale, t]);

  const updatePSModule = useCallback(async (name: string) => {
    if (!isTauri()) return;
    try {
      await tauri.terminalPsUpdateModule(name);
      markResourcesStale(['psModules', 'psScripts']);
      await Promise.all([fetchPSModules(), fetchPSScripts()]);
      toast.success(t('terminal.toastModuleUpdated', { name }));
      return true;
    } catch (e) {
      toast.error(t('terminal.toastUpdateModuleFailed', { error: String(e) }));
      return false;
    }
  }, [fetchPSModules, fetchPSScripts, markResourcesStale, t]);

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
        const templatesResult = await tauri.terminalListTemplates();
        await hydrateTerminalStore();

        if (!cancelled) {
          const hydratedShells = useTerminalStore.getState().shells;
          setState((prev) => ({
            ...prev,
            templates: templatesResult,
            shellReadouts: hydratedShells.reduce<Record<string, TerminalShellReadout>>((acc, shell) => {
              acc[shell.id] = createShellReadout(shell.id, prev.shellReadouts[shell.id]);
              return acc;
            }, { ...prev.shellReadouts }),
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
    return () => {
      cancelled = true;
    };
  }, [hydrateTerminalStore]);

  return {
    ...state,
    shells: storeShells,
    profiles: storeProfiles,
    defaultProfileId,
    loading: state.loading || storeLoading,
    error: state.error ?? storeError,
    detectShells,
    measureStartup,
    checkShellHealth,
    getShellInfo,
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
    getPSModuleDetail,
    fetchPSScripts,
    detectFrameworks,
    fetchPlugins,
    fetchFrameworkCacheStats,
    getSingleFrameworkCacheInfo,
    cleanFrameworkCache,
    fetchShellEnvVars,
    revealShellEnvVar,
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
