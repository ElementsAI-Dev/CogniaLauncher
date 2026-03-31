'use client';

import { useCallback } from 'react';
import {
  createBlockedWorkflowAction,
  getLogicalEnvType,
  type EnvironmentWorkflowActionKind,
  type EnvironmentWorkflowActionStatus,
  type EnvironmentWorkflowOrigin,
} from '@/lib/environment-workflow';
import { useEnvironmentStore } from '@/lib/stores/environment';
import * as tauri from '@/lib/tauri';
import type { PathStatusInfo } from '@/types/tauri';

function getPersistedProjectPath(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem('cognia-project-path');
}

interface WorkflowContextOptions {
  origin?: EnvironmentWorkflowOrigin;
  returnHref?: string | null;
  providerId?: string | null;
  projectPath?: string | null;
}

interface WorkflowActionOptions extends WorkflowContextOptions {
  version?: string | null;
  error?: string | null;
  retryable?: boolean;
}

interface ProjectPathPreflightOptions extends WorkflowActionOptions {
  envType: string;
  action: EnvironmentWorkflowActionKind;
  reason: string;
}

interface PathPreflightOptions extends WorkflowActionOptions {
  envType: string;
  action: EnvironmentWorkflowActionKind;
  pathStatus?: Pick<PathStatusInfo, 'isInPath'> | null;
  reason: string;
}

interface ReconcileEnvironmentWorkflowOptions {
  projectPath?: string | null;
  refreshProviders?: boolean;
}

export function useEnvironmentWorkflow() {
  const availableProviders = useEnvironmentStore((state) => state.availableProviders);
  const setWorkflowContext = useEnvironmentStore((state) => state.setWorkflowContext);
  const setWorkflowAction = useEnvironmentStore((state) => state.setWorkflowAction);
  const setEnvironments = useEnvironmentStore((state) => state.setEnvironments);
  const setAvailableProviders = useEnvironmentStore((state) => state.setAvailableProviders);
  const setDetectedVersions = useEnvironmentStore((state) => state.setDetectedVersions);
  const setLastEnvScanTimestamp = useEnvironmentStore((state) => state.setLastEnvScanTimestamp);

  const toLogicalEnvType = useCallback((envType: string) => {
    return getLogicalEnvType(envType, availableProviders).trim().toLowerCase();
  }, [availableProviders]);

  const syncWorkflowContext = useCallback((
    envType: string,
    options?: WorkflowContextOptions,
  ) => {
    const store = useEnvironmentStore.getState();
    const logicalEnvType = toLogicalEnvType(envType);
    const currentContext = store.workflowContext;
    const sameTarget = currentContext?.envType === logicalEnvType;
    const resolvedProjectPath =
      options?.projectPath
      ?? (sameTarget ? currentContext?.projectPath : null)
      ?? getPersistedProjectPath();
    const resolvedProviderId =
      options?.providerId
      ?? (sameTarget ? currentContext?.providerId : null)
      ?? store.getSelectedProvider(logicalEnvType, options?.providerId ?? envType);

    const nextContext = {
      envType: logicalEnvType,
      origin: options?.origin ?? (sameTarget ? currentContext?.origin ?? 'direct' : 'direct'),
      returnHref:
        options?.returnHref
        ?? (sameTarget ? currentContext?.returnHref ?? '/environments' : '/environments'),
      projectPath: resolvedProjectPath,
      providerId: resolvedProviderId,
      updatedAt: Date.now(),
    } as const;

    setWorkflowContext(nextContext);

    return {
      logicalEnvType,
      projectPath: resolvedProjectPath,
      providerId: resolvedProviderId,
      context: nextContext,
    };
  }, [setWorkflowContext, toLogicalEnvType]);

  const setWorkflowActionState = useCallback((
    envType: string,
    action: EnvironmentWorkflowActionKind,
    status: EnvironmentWorkflowActionStatus,
    options?: WorkflowActionOptions,
  ) => {
    const synced = syncWorkflowContext(envType, options);

    setWorkflowAction({
      envType: synced.logicalEnvType,
      action,
      status,
      version: options?.version ?? null,
      providerId: synced.providerId,
      projectPath: synced.projectPath,
      error: options?.error ?? null,
      retryable: options?.retryable,
      updatedAt: Date.now(),
    });

    return synced;
  }, [setWorkflowAction, syncWorkflowContext]);

  const requireProjectPath = useCallback((options: ProjectPathPreflightOptions) => {
    const synced = syncWorkflowContext(options.envType, options);
    if (synced.projectPath) {
      return synced.projectPath;
    }

    setWorkflowAction(
      createBlockedWorkflowAction({
        envType: synced.logicalEnvType,
        action: options.action,
        availableProviders,
        providerId: synced.providerId,
        projectPath: null,
        reason: options.reason,
        version: options.version,
      }),
    );

    return null;
  }, [availableProviders, setWorkflowAction, syncWorkflowContext]);

  const requirePathConfigured = useCallback((options: PathPreflightOptions) => {
    const synced = syncWorkflowContext(options.envType, options);
    if (options.pathStatus?.isInPath) {
      return true;
    }

    setWorkflowAction(
      createBlockedWorkflowAction({
        envType: synced.logicalEnvType,
        action: options.action,
        availableProviders,
        providerId: synced.providerId,
        projectPath: synced.projectPath,
        reason: options.reason,
        version: options.version,
      }),
    );

    return false;
  }, [availableProviders, setWorkflowAction, syncWorkflowContext]);

  const reconcileEnvironmentWorkflow = useCallback(async (
    options?: ReconcileEnvironmentWorkflowOptions,
  ) => {
    if (!tauri.isTauri()) {
      return {
        envs: [] as tauri.EnvironmentInfo[],
        providers: null as tauri.EnvironmentProviderInfo[] | null,
        detected: null as tauri.DetectedEnvironment[] | null,
        projectPath: null as string | null,
      };
    }

    const resolvedProjectPath =
      options?.projectPath
      ?? useEnvironmentStore.getState().workflowContext?.projectPath
      ?? getPersistedProjectPath();

    const envPromise = tauri.envList(true).then((envs) => {
      setEnvironments(envs);
      setLastEnvScanTimestamp(Date.now());
      return envs;
    });

    const providersPromise = options?.refreshProviders
      ? tauri.envListProviders(true).then((providers) => {
          setAvailableProviders(providers);
          return providers;
        })
      : Promise.resolve(null);

    const detectedPromise = resolvedProjectPath
      ? tauri.envDetectAll(resolvedProjectPath).then((detected) => {
          setDetectedVersions(detected);
          return detected;
        })
      : Promise.resolve(null);

    const [envs, providers, detected] = await Promise.all([
      envPromise,
      providersPromise,
      detectedPromise,
    ]);

    return {
      envs,
      providers,
      detected,
      projectPath: resolvedProjectPath,
    };
  }, [
    setAvailableProviders,
    setDetectedVersions,
    setEnvironments,
    setLastEnvScanTimestamp,
  ]);

  return {
    syncWorkflowContext,
    setWorkflowActionState,
    requireProjectPath,
    requirePathConfigured,
    reconcileEnvironmentWorkflow,
  };
}
