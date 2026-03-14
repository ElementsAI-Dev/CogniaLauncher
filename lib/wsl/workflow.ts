'use client';

import type {
  WslCapabilities,
  WslDistroStatus,
} from '@/types/tauri';
import type {
  WslAssistanceActionDescriptor,
  WslBatchWorkflowItemResult,
  WslBatchWorkflowPreflight,
  WslBatchWorkflowPreset,
  WslBatchWorkflowResolvedTarget,
  WslBatchWorkflowSummary,
  WslBatchWorkflowTarget,
  WslBatchWorkflowTargetResolution,
} from '@/types/wsl';

export type WslOverviewTab = 'installed' | 'available';
export type WslWorkflowOrigin = 'overview' | 'sidebar' | 'widget' | 'detail' | 'assistance';
export type WslActionScope = 'runtime' | 'distro' | 'batch' | 'backup' | 'network';
export type WslActionRisk = 'safe' | 'high';
export type WslRefreshTarget = 'inventory' | 'runtime' | 'config' | 'backup' | 'network';

export interface WslOverviewContext {
  tab: WslOverviewTab;
  tag: string | null;
  origin: WslWorkflowOrigin;
}

export interface WslActionInventoryItem {
  id: string;
  scope: WslActionScope;
  risk: WslActionRisk;
  refreshTargets: WslRefreshTarget[];
  longRunning?: boolean;
}

export const DEFAULT_WSL_OVERVIEW_CONTEXT: WslOverviewContext = {
  tab: 'installed',
  tag: null,
  origin: 'overview',
};

export const WSL_ACTION_INVENTORY: Record<string, WslActionInventoryItem> = {
  'runtime.installOnline': { id: 'runtime.installOnline', scope: 'runtime', risk: 'safe', refreshTargets: ['inventory', 'runtime'], longRunning: true },
  'runtime.installWithLocation': { id: 'runtime.installWithLocation', scope: 'runtime', risk: 'safe', refreshTargets: ['inventory', 'runtime'], longRunning: true },
  'runtime.installWslOnly': { id: 'runtime.installWslOnly', scope: 'runtime', risk: 'safe', refreshTargets: ['inventory', 'runtime'], longRunning: true },
  'runtime.import': { id: 'runtime.import', scope: 'runtime', risk: 'safe', refreshTargets: ['inventory', 'runtime'], longRunning: true },
  'runtime.importInPlace': { id: 'runtime.importInPlace', scope: 'runtime', risk: 'safe', refreshTargets: ['inventory', 'runtime'], longRunning: true },
  'runtime.export': { id: 'runtime.export', scope: 'runtime', risk: 'safe', refreshTargets: ['backup'], longRunning: true },
  'runtime.update': { id: 'runtime.update', scope: 'runtime', risk: 'safe', refreshTargets: ['runtime'], longRunning: true },
  'runtime.setDefaultVersion': { id: 'runtime.setDefaultVersion', scope: 'runtime', risk: 'safe', refreshTargets: ['runtime'] },
  'runtime.shutdown': { id: 'runtime.shutdown', scope: 'runtime', risk: 'high', refreshTargets: ['runtime'] },
  'runtime.mount': { id: 'runtime.mount', scope: 'runtime', risk: 'high', refreshTargets: ['runtime'] },
  'runtime.unmount': { id: 'runtime.unmount', scope: 'runtime', risk: 'high', refreshTargets: ['runtime'] },
  'runtime.batchLaunch': { id: 'runtime.batchLaunch', scope: 'batch', risk: 'safe', refreshTargets: ['inventory', 'runtime'] },
  'runtime.batchTerminate': { id: 'runtime.batchTerminate', scope: 'batch', risk: 'safe', refreshTargets: ['inventory', 'runtime'] },
  'runtime.assistance': { id: 'runtime.assistance', scope: 'runtime', risk: 'high', refreshTargets: ['runtime', 'config'] },
  'distro.launch': { id: 'distro.launch', scope: 'distro', risk: 'safe', refreshTargets: ['inventory', 'runtime'] },
  'distro.terminate': { id: 'distro.terminate', scope: 'distro', risk: 'high', refreshTargets: ['inventory', 'runtime'] },
  'distro.setDefault': { id: 'distro.setDefault', scope: 'distro', risk: 'safe', refreshTargets: ['inventory', 'runtime'] },
  'distro.setVersion': { id: 'distro.setVersion', scope: 'distro', risk: 'safe', refreshTargets: ['inventory', 'runtime'], longRunning: true },
  'distro.changeDefaultUser': { id: 'distro.changeDefaultUser', scope: 'distro', risk: 'safe', refreshTargets: ['inventory'] },
  'distro.unregister': { id: 'distro.unregister', scope: 'distro', risk: 'high', refreshTargets: ['inventory', 'runtime', 'config'] },
  'distro.clone': { id: 'distro.clone', scope: 'distro', risk: 'safe', refreshTargets: ['inventory', 'runtime'], longRunning: true },
  'distro.move': { id: 'distro.move', scope: 'distro', risk: 'high', refreshTargets: ['inventory', 'runtime'], longRunning: true },
  'distro.resize': { id: 'distro.resize', scope: 'distro', risk: 'high', refreshTargets: ['inventory', 'runtime'], longRunning: true },
  'distro.sparse': { id: 'distro.sparse', scope: 'distro', risk: 'safe', refreshTargets: ['inventory'] },
  'distro.openInExplorer': { id: 'distro.openInExplorer', scope: 'distro', risk: 'safe', refreshTargets: [] },
  'distro.openInTerminal': { id: 'distro.openInTerminal', scope: 'distro', risk: 'safe', refreshTargets: [] },
  'distro.healthCheck': { id: 'distro.healthCheck', scope: 'distro', risk: 'safe', refreshTargets: ['runtime'] },
  'distro.assistance': { id: 'distro.assistance', scope: 'distro', risk: 'high', refreshTargets: ['inventory', 'runtime', 'config'] },
  'network.addPortForward': { id: 'network.addPortForward', scope: 'network', risk: 'high', refreshTargets: ['network'] },
  'network.removePortForward': { id: 'network.removePortForward', scope: 'network', risk: 'high', refreshTargets: ['network'] },
  'config.runtime': { id: 'config.runtime', scope: 'runtime', risk: 'safe', refreshTargets: ['config', 'runtime'] },
  'config.distro': { id: 'config.distro', scope: 'distro', risk: 'safe', refreshTargets: ['config', 'inventory'] },
  'backup.create': { id: 'backup.create', scope: 'backup', risk: 'safe', refreshTargets: ['backup'], longRunning: true },
  'backup.restore': { id: 'backup.restore', scope: 'backup', risk: 'high', refreshTargets: ['backup', 'inventory', 'runtime', 'config'], longRunning: true },
  'backup.delete': { id: 'backup.delete', scope: 'backup', risk: 'high', refreshTargets: ['backup'] },
};

type SearchParamReader = {
  get: (key: string) => string | null;
};

export function sanitizeWslOverviewContext(
  context?: Partial<WslOverviewContext>
): WslOverviewContext {
  return {
    tab: context?.tab === 'available' ? 'available' : 'installed',
    tag: context?.tag ?? null,
    origin: context?.origin ?? DEFAULT_WSL_OVERVIEW_CONTEXT.origin,
  };
}

export function readWslOverviewContext(
  searchParams?: SearchParamReader | null,
  fallback?: Partial<WslOverviewContext>
): WslOverviewContext {
  const fallbackContext = sanitizeWslOverviewContext(fallback);
  if (!searchParams) return fallbackContext;

  const tabParam = searchParams.get('tab');
  const tagParam = searchParams.get('tag');
  const originParam = searchParams.get('origin') as WslWorkflowOrigin | null;

  return sanitizeWslOverviewContext({
    tab: tabParam === 'available' ? 'available' : fallbackContext.tab,
    tag: tagParam ?? fallbackContext.tag,
    origin: originParam ?? fallbackContext.origin,
  });
}

export function buildWslOverviewHref(
  context?: Partial<WslOverviewContext>
): string {
  const resolved = sanitizeWslOverviewContext(context);
  const params = new URLSearchParams();

  if (resolved.tab !== DEFAULT_WSL_OVERVIEW_CONTEXT.tab) {
    params.set('tab', resolved.tab);
  }
  if (resolved.tag) {
    params.set('tag', resolved.tag);
  }
  if (resolved.origin !== DEFAULT_WSL_OVERVIEW_CONTEXT.origin) {
    params.set('origin', resolved.origin);
  }

  const query = params.toString();
  return query ? `/wsl?${query}` : '/wsl';
}

export function buildWslDistroHref(
  distroName: string,
  options?: Partial<WslOverviewContext> & {
    origin?: WslWorkflowOrigin;
    returnTo?: string;
    continueAction?: string;
  }
): string {
  const params = new URLSearchParams({ name: distroName });
  const resolved = sanitizeWslOverviewContext(options);

  params.set('origin', options?.origin ?? resolved.origin);
  params.set('returnTo', options?.returnTo ?? buildWslOverviewHref(resolved));

  if (options?.continueAction) {
    params.set('continue', options.continueAction);
  }

  return `/wsl/distro?${params.toString()}`;
}

export function normalizeSelectedDistros(
  selected: Iterable<string>,
  distros: Array<{ name: string }>
): Set<string> {
  const validNames = new Set(distros.map((distro) => distro.name));
  return new Set(Array.from(selected).filter((name) => validNames.has(name)));
}

export function summarizeBatchResults(results: [string, boolean, string][]) {
  return {
    total: results.length,
    failed: results.filter(([, ok]) => !ok).length,
    succeeded: results.filter(([, ok]) => ok).length,
    details: results.map(([name, ok, detail]) =>
      `${name}: ${ok ? 'ok' : 'failed'}${detail ? ` - ${detail}` : ''}`
    ),
  };
}

function getBatchWorkflowActionLabel(workflow: WslBatchWorkflowPreset): string {
  if (workflow.action.label) {
    return workflow.action.label;
  }

  switch (workflow.action.kind) {
    case 'lifecycle':
      return workflow.action.operation === 'launch' ? 'Launch' : 'Terminate';
    case 'command':
      return workflow.action.savedCommandId ? workflow.name : workflow.action.command;
    case 'health-check':
      return 'Health Check';
    case 'assistance':
      return workflow.action.actionId;
    default:
      return workflow.name;
  }
}

function getBatchWorkflowInventoryMeta(workflow: WslBatchWorkflowPreset) {
  if (workflow.action.kind === 'lifecycle') {
    return workflow.action.operation === 'launch'
      ? WSL_ACTION_INVENTORY['runtime.batchLaunch']
      : WSL_ACTION_INVENTORY['runtime.batchTerminate'];
  }

  if (workflow.action.kind === 'health-check') {
    return WSL_ACTION_INVENTORY['distro.healthCheck'];
  }

  if (workflow.action.kind === 'assistance') {
    if (workflow.action.actionId === 'distro.healthCheck') {
      return WSL_ACTION_INVENTORY['distro.healthCheck'];
    }
    if (workflow.action.actionId === 'distro.enableSparse') {
      return WSL_ACTION_INVENTORY['distro.sparse'];
    }
    if (workflow.action.actionId === 'distro.openTerminal') {
      return WSL_ACTION_INVENTORY['distro.openInTerminal'];
    }
    return WSL_ACTION_INVENTORY['distro.assistance'];
  }

  return {
    id: 'workflow.command',
    scope: 'batch' as const,
    risk: 'safe' as const,
    refreshTargets: [] as WslRefreshTarget[],
    longRunning: false,
  };
}

export function resolveWslBatchWorkflowTargets(
  target: WslBatchWorkflowTarget,
  distros: WslDistroStatus[],
  selectedDistros: Iterable<string>,
  distroTags: Record<string, string[]>
): WslBatchWorkflowTargetResolution {
  if (target.mode === 'explicit') {
    const availableNames = new Set(distros.map((distro) => distro.name));
    const resolvedNames: string[] = [];
    const missingNames: string[] = [];

    for (const distroName of target.distroNames ?? []) {
      if (availableNames.has(distroName)) {
        if (!resolvedNames.includes(distroName)) {
          resolvedNames.push(distroName);
        }
      } else if (!missingNames.includes(distroName)) {
        missingNames.push(distroName);
      }
    }

    return { resolvedNames, missingNames };
  }

  if (target.mode === 'tag') {
    return {
      resolvedNames: distros
        .filter((distro) => (distroTags[distro.name] ?? []).includes(target.tag ?? ''))
        .map((distro) => distro.name),
      missingNames: [],
    };
  }

  const normalizedSelection = normalizeSelectedDistros(selectedDistros, distros);
  return {
    resolvedNames: distros
      .filter((distro) => normalizedSelection.has(distro.name))
      .map((distro) => distro.name),
    missingNames: [],
  };
}

function isDistroRunning(distro?: WslDistroStatus) {
  return distro?.state.toLowerCase() === 'running';
}

function buildTargetReason(
  workflow: WslBatchWorkflowPreset,
  distro: WslDistroStatus | undefined,
  capabilities: WslCapabilities | null,
  assistanceAction?: WslAssistanceActionDescriptor
): Pick<WslBatchWorkflowResolvedTarget, 'status' | 'reason'> {
  switch (workflow.action.kind) {
    case 'lifecycle':
      if (workflow.action.operation === 'launch' && isDistroRunning(distro)) {
        return { status: 'skipped', reason: 'Distribution is already running.' };
      }
      if (workflow.action.operation === 'terminate' && !isDistroRunning(distro)) {
        return { status: 'skipped', reason: 'Distribution is already stopped.' };
      }
      return { status: 'runnable' };
    case 'command':
      if (!workflow.action.command.trim()) {
        return { status: 'blocked', reason: 'Command is required.' };
      }
      if (!isDistroRunning(distro)) {
        return { status: 'blocked', reason: 'Distribution must be running.' };
      }
      return { status: 'runnable' };
    case 'health-check':
      if (!isDistroRunning(distro)) {
        return { status: 'blocked', reason: 'Distribution must be running.' };
      }
      return { status: 'runnable' };
    case 'assistance':
      if (!assistanceAction) {
        return { status: 'blocked', reason: 'Assistance action is unavailable.' };
      }
      if (!assistanceAction.supported) {
        return { status: 'blocked', reason: assistanceAction.blockedReason ?? 'Action is blocked.' };
      }
      if (
        (workflow.action.actionId === 'distro.healthCheck' || workflow.action.actionId === 'distro.openTerminal')
        && !isDistroRunning(distro)
      ) {
        return { status: 'blocked', reason: 'Distribution must be running.' };
      }
      if (workflow.action.actionId === 'distro.enableSparse' && capabilities?.setSparse === false) {
        return { status: 'blocked', reason: 'Sparse mode is unavailable.' };
      }
      return { status: 'runnable' };
    default:
      return { status: 'blocked', reason: 'Unsupported workflow action.' };
  }
}

export function buildWslBatchWorkflowPreflight({
  workflow,
  distros,
  selectedDistros,
  distroTags,
  capabilities,
  resolveAssistanceAction,
}: {
  workflow: WslBatchWorkflowPreset;
  distros: WslDistroStatus[];
  selectedDistros: Iterable<string>;
  distroTags: Record<string, string[]>;
  capabilities: WslCapabilities | null;
  resolveAssistanceAction?: (distroName: string, actionId: string) => WslAssistanceActionDescriptor | undefined;
}): WslBatchWorkflowPreflight {
  const targetResolution = resolveWslBatchWorkflowTargets(
    workflow.target,
    distros,
    selectedDistros,
    distroTags
  );
  const distrosByName = new Map(distros.map((distro) => [distro.name, distro]));
  const inventoryMeta = getBatchWorkflowInventoryMeta(workflow);
  const targets: WslBatchWorkflowResolvedTarget[] = targetResolution.resolvedNames.map((distroName) => {
    const distro = distrosByName.get(distroName);
    const assistanceAction = workflow.action.kind === 'assistance'
      ? resolveAssistanceAction?.(distroName, workflow.action.actionId)
      : undefined;
    const targetState = buildTargetReason(workflow, distro, capabilities, assistanceAction);

    return {
      distroName,
      ...targetState,
    };
  });

  for (const missingName of targetResolution.missingNames) {
    targets.push({
      distroName: missingName,
      status: 'missing',
      reason: 'Distribution is not present in the current inventory.',
    });
  }

  const runnableCount = targets.filter((target) => target.status === 'runnable').length;
  const blockedCount = targets.filter((target) => target.status === 'blocked').length;
  const skippedCount = targets.filter((target) => target.status === 'skipped').length;
  const missingCount = targets.filter((target) => target.status === 'missing').length;

  return {
    workflowName: workflow.name,
    actionLabel: getBatchWorkflowActionLabel(workflow),
    risk: inventoryMeta.risk,
    longRunning: Boolean(inventoryMeta.longRunning),
    requiresConfirmation: inventoryMeta.risk === 'high' || blockedCount > 0 || missingCount > 0,
    refreshTargets: [...inventoryMeta.refreshTargets],
    targets,
    runnableCount,
    blockedCount,
    skippedCount,
    missingCount,
  };
}

export function summarizeWslBatchWorkflowRun({
  workflow,
  preflight,
  startedAt,
  completedAt,
  executionResults,
}: {
  workflow: WslBatchWorkflowPreset;
  preflight: WslBatchWorkflowPreflight;
  startedAt: string;
  completedAt: string;
  executionResults: WslBatchWorkflowItemResult[];
}): WslBatchWorkflowSummary {
  const preflightResults: WslBatchWorkflowItemResult[] = preflight.targets
    .filter((target) => target.status !== 'runnable')
    .map((target) => ({
      distroName: target.distroName,
      status: 'skipped',
      detail: target.reason,
      retryable: false,
    }));
  const results = [...executionResults, ...preflightResults];

  return {
    id: `summary-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    workflowName: workflow.name,
    actionLabel: preflight.actionLabel,
    startedAt,
    completedAt,
    total: results.length,
    succeeded: results.filter((result) => result.status === 'success').length,
    failed: results.filter((result) => result.status === 'failed').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    refreshTargets: [...preflight.refreshTargets],
    workflow,
    results,
  };
}

export function getRetryableWorkflowTargetNames(summary: WslBatchWorkflowSummary) {
  return summary.results
    .filter((result) => result.status === 'failed' && result.retryable)
    .map((result) => result.distroName);
}
