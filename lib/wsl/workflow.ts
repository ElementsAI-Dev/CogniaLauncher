'use client';

import type {
  WslCapabilities,
  WslDistroStatus,
} from '@/types/tauri';
import type {
  WslAssistanceActionDescriptor,
  WslBatchWorkflowAction,
  WslBatchWorkflowBackupCoverage,
  WslBatchWorkflowItemResult,
  WslBatchWorkflowPreflight,
  WslBatchWorkflowPreflightStep,
  WslBatchWorkflowPreset,
  WslBatchWorkflowResolvedTarget,
  WslBatchWorkflowResolvedTargetStepStatus,
  WslBatchWorkflowStep,
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
  'distro.relaunch': { id: 'distro.relaunch', scope: 'distro', risk: 'safe', refreshTargets: ['inventory', 'runtime'] },
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
  'distro.packageUpdate': { id: 'distro.packageUpdate', scope: 'distro', risk: 'safe', refreshTargets: ['runtime'], longRunning: true },
  'distro.packageUpgrade': { id: 'distro.packageUpgrade', scope: 'distro', risk: 'safe', refreshTargets: ['runtime'], longRunning: true },
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

const WORKFLOW_COMMAND_META: WslActionInventoryItem = {
  id: 'workflow.command',
  scope: 'batch',
  risk: 'safe',
  refreshTargets: [],
  longRunning: false,
};

function createWorkflowStepId(kind: string, index: number) {
  return `${kind}-${index + 1}`;
}

function toLegacyWorkflowAction(step: WslBatchWorkflowStep): WslBatchWorkflowAction | undefined {
  switch (step.kind) {
    case 'lifecycle':
      return { kind: 'lifecycle', operation: step.operation, label: step.label };
    case 'command':
      return {
        kind: 'command',
        command: step.command,
        user: step.user,
        savedCommandId: step.savedCommandId,
        label: step.label,
      };
    case 'health-check':
      return { kind: 'health-check', label: step.label };
    case 'assistance':
      return { kind: 'assistance', actionId: step.actionId, label: step.label };
    case 'backup':
      return { kind: 'backup', destinationPath: step.destinationPath, label: step.label };
    case 'package-upkeep':
      return { kind: 'package-upkeep', mode: step.mode, label: step.label };
    default:
      return undefined;
  }
}

export function legacyActionToWorkflowStep(action: WslBatchWorkflowAction, index = 0): WslBatchWorkflowStep {
  const id = createWorkflowStepId(action.kind, index);

  switch (action.kind) {
    case 'lifecycle':
      return { id, kind: 'lifecycle', operation: action.operation, label: action.label };
    case 'command':
      return {
        id,
        kind: 'command',
        command: action.command,
        user: action.user,
        savedCommandId: action.savedCommandId,
        label: action.label,
      };
    case 'health-check':
      return { id, kind: 'health-check', label: action.label };
    case 'assistance':
      return { id, kind: 'assistance', actionId: action.actionId, label: action.label };
    case 'backup':
      return { id, kind: 'backup', destinationPath: action.destinationPath, label: action.label };
    case 'package-upkeep':
      return { id, kind: 'package-upkeep', mode: action.mode, label: action.label };
    default:
      return { id, kind: 'health-check' };
  }
}

export function getWslBatchWorkflowSteps(workflow: WslBatchWorkflowPreset): WslBatchWorkflowStep[] {
  if (Array.isArray(workflow.steps) && workflow.steps.length > 0) {
    return workflow.steps.map((step, index) => ({
      ...step,
      id: step.id || createWorkflowStepId(step.kind, index),
    }));
  }

  if (workflow.action) {
    return [legacyActionToWorkflowStep(workflow.action)];
  }

  return [];
}

export function normalizeWslBatchWorkflowPreset(workflow: WslBatchWorkflowPreset): WslBatchWorkflowPreset {
  const steps = getWslBatchWorkflowSteps(workflow);
  const normalizedAction = workflow.action ?? (steps.length === 1 ? toLegacyWorkflowAction(steps[0]) : undefined);

  return {
    ...workflow,
    steps,
    action: normalizedAction,
  };
}

function getWorkflowStepLabel(step: WslBatchWorkflowStep, index: number): string {
  if (step.label) {
    return step.label;
  }

  switch (step.kind) {
    case 'lifecycle':
      return step.operation === 'launch'
        ? 'Launch'
        : step.operation === 'terminate'
          ? 'Terminate'
          : 'Relaunch';
    case 'command':
      return step.savedCommandId ? 'Saved command' : step.command || `Command ${index + 1}`;
    case 'health-check':
      return 'Health Check';
    case 'assistance':
      return step.actionId;
    case 'backup':
      return 'Backup';
    case 'package-upkeep':
      return step.mode === 'upgrade' ? 'Upgrade packages' : 'Update packages';
    default:
      return `Step ${index + 1}`;
  }
}

function isMutatingWorkflowStep(step: WslBatchWorkflowStep): boolean {
  if (step.kind === 'package-upkeep' || step.kind === 'lifecycle') {
    return true;
  }

  if (step.kind !== 'assistance') {
    return false;
  }

  return ![
    'distro.preflight',
    'distro.healthCheck',
    'distro.openTerminal',
  ].includes(step.actionId);
}

function hasMaintenanceBackupSemantics(steps: WslBatchWorkflowStep[]): boolean {
  return steps.length > 1 || steps.some((step) => step.kind === 'backup' || step.kind === 'package-upkeep');
}

function getStepInventoryMeta(step: WslBatchWorkflowStep): WslActionInventoryItem {
  switch (step.kind) {
    case 'lifecycle':
      if (step.operation === 'terminate') {
        return WSL_ACTION_INVENTORY['runtime.batchTerminate'];
      }
      if (step.operation === 'relaunch') {
        return WSL_ACTION_INVENTORY['distro.relaunch'];
      }
      return WSL_ACTION_INVENTORY['runtime.batchLaunch'];
    case 'health-check':
      return WSL_ACTION_INVENTORY['distro.healthCheck'];
    case 'assistance':
      if (step.actionId === 'distro.healthCheck') {
        return WSL_ACTION_INVENTORY['distro.healthCheck'];
      }
      if (step.actionId === 'distro.enableSparse') {
        return WSL_ACTION_INVENTORY['distro.sparse'];
      }
      if (step.actionId === 'distro.openTerminal') {
        return WSL_ACTION_INVENTORY['distro.openInTerminal'];
      }
      if (step.actionId === 'distro.relaunch') {
        return WSL_ACTION_INVENTORY['distro.relaunch'];
      }
      return WSL_ACTION_INVENTORY['distro.assistance'];
    case 'backup':
      return WSL_ACTION_INVENTORY['backup.create'];
    case 'package-upkeep':
      return step.mode === 'upgrade'
        ? WSL_ACTION_INVENTORY['distro.packageUpgrade']
        : WSL_ACTION_INVENTORY['distro.packageUpdate'];
    case 'command':
    default:
      return WORKFLOW_COMMAND_META;
  }
}

export function getWslBatchWorkflowStepMeta(step: WslBatchWorkflowStep): WslActionInventoryItem {
  return getStepInventoryMeta(step);
}

function getWorkflowActionLabel(workflow: WslBatchWorkflowPreset, steps: WslBatchWorkflowStep[]): string {
  if (steps.length === 0) {
    return workflow.name;
  }

  if (steps.length === 1) {
    return getWorkflowStepLabel(steps[0], 0);
  }

  return `${steps.length} steps`;
}

function getStepBackupCoverage(
  steps: WslBatchWorkflowStep[],
  stepIndex: number,
): WslBatchWorkflowBackupCoverage {
  if (!hasMaintenanceBackupSemantics(steps)) {
    return 'not-applicable';
  }

  const step = steps[stepIndex];
  if (!isMutatingWorkflowStep(step)) {
    return 'not-applicable';
  }

  const protectedByBackup = steps.slice(0, stepIndex).some((candidate) => candidate.kind === 'backup');
  return protectedByBackup ? 'protected' : 'unprotected';
}

function getWorkflowBackupCoverage(steps: WslBatchWorkflowStep[]): WslBatchWorkflowBackupCoverage {
  const mutatingCoverages = steps
    .map((_, index) => getStepBackupCoverage(steps, index))
    .filter((coverage) => coverage !== 'not-applicable');

  if (mutatingCoverages.length === 0) {
    return 'not-applicable';
  }

  if (mutatingCoverages.every((coverage) => coverage === 'protected')) {
    return 'protected';
  }

  if (mutatingCoverages.every((coverage) => coverage === 'unprotected')) {
    return 'unprotected';
  }

  return 'partial';
}

function getBackupCoverageWarnings(coverage: WslBatchWorkflowBackupCoverage): string[] {
  if (coverage === 'unprotected') {
    return ['Mutating maintenance steps do not have backup coverage.'];
  }
  if (coverage === 'partial') {
    return ['Some mutating maintenance steps are not protected by an earlier backup step.'];
  }
  return [];
}

function isDistroRunning(distro?: WslDistroStatus) {
  return distro?.state.toLowerCase() === 'running';
}

function buildStepTargetReason(
  step: WslBatchWorkflowStep,
  distro: WslDistroStatus | undefined,
  capabilities: WslCapabilities | null,
  assistanceAction?: WslAssistanceActionDescriptor,
  runningOverride?: boolean,
): Pick<WslBatchWorkflowResolvedTargetStepStatus, 'status' | 'reason'> {
  const running = runningOverride ?? isDistroRunning(distro);

  switch (step.kind) {
    case 'lifecycle':
      if (step.operation === 'launch' && running) {
        return { status: 'skipped', reason: 'Distribution is already running.' };
      }
      if (step.operation === 'terminate' && !running) {
        return { status: 'skipped', reason: 'Distribution is already stopped.' };
      }
      return { status: 'runnable' };
    case 'command':
      if (!step.command.trim()) {
        return { status: 'blocked', reason: 'Command is required.' };
      }
      if (!running) {
        return { status: 'blocked', reason: 'Distribution must be running.' };
      }
      return { status: 'runnable' };
    case 'health-check':
    case 'package-upkeep':
      if (!running) {
        return { status: 'blocked', reason: 'Distribution must be running.' };
      }
      return { status: 'runnable' };
    case 'backup':
      return { status: 'runnable' };
    case 'assistance':
      if (!assistanceAction) {
        return { status: 'blocked', reason: 'Assistance action is unavailable.' };
      }
      if (!assistanceAction.supported) {
        return { status: 'blocked', reason: assistanceAction.blockedReason ?? 'Action is blocked.' };
      }
      if (
        (step.actionId === 'distro.healthCheck' || step.actionId === 'distro.openTerminal')
        && !running
      ) {
        return { status: 'blocked', reason: 'Distribution must be running.' };
      }
      if (step.actionId === 'distro.enableSparse' && capabilities?.setSparse === false) {
        return { status: 'blocked', reason: 'Sparse mode is unavailable.' };
      }
      return { status: 'runnable' };
    default:
      return { status: 'blocked', reason: 'Unsupported workflow step.' };
  }
}

function buildPreflightSteps(steps: WslBatchWorkflowStep[]): WslBatchWorkflowPreflightStep[] {
  return steps.map((step, index) => {
    const meta = getStepInventoryMeta(step);
    return {
      stepId: step.id,
      label: getWorkflowStepLabel(step, index),
      kind: step.kind,
      risk: meta.risk,
      longRunning: Boolean(meta.longRunning),
      mutating: isMutatingWorkflowStep(step),
      backupCoverage: getStepBackupCoverage(steps, index),
    };
  });
}

function buildResolvedTarget({
  distroName,
  distro,
  steps,
  capabilities,
  resolveAssistanceAction,
}: {
  distroName: string;
  distro: WslDistroStatus | undefined;
  steps: WslBatchWorkflowStep[];
  capabilities: WslCapabilities | null;
  resolveAssistanceAction?: (distroName: string, actionId: string) => WslAssistanceActionDescriptor | undefined;
}): WslBatchWorkflowResolvedTarget {
  const backupCoverage = getWorkflowBackupCoverage(steps);
  let blockingStep: { id: string; label: string; reason?: string } | null = null;
  let simulatedRunning = isDistroRunning(distro);

  const stepStatuses = steps.map<WslBatchWorkflowResolvedTargetStepStatus>((step, index) => {
    const stepLabel = getWorkflowStepLabel(step, index);
    const stepBackupCoverage = getStepBackupCoverage(steps, index);

    if (blockingStep) {
      return {
        stepId: step.id,
        stepLabel,
        status: 'skipped',
        reason: `Blocked by step: ${blockingStep.label}`,
        backupCoverage: stepBackupCoverage,
      };
    }

    const assistanceAction = step.kind === 'assistance'
      ? resolveAssistanceAction?.(distroName, step.actionId)
      : undefined;
    const targetState = buildStepTargetReason(step, distro, capabilities, assistanceAction, simulatedRunning);

    if (targetState.status === 'blocked') {
      blockingStep = {
        id: step.id,
        label: stepLabel,
        reason: targetState.reason,
      };
    }

    if (targetState.status !== 'blocked' && step.kind === 'lifecycle') {
      if (step.operation === 'launch' || step.operation === 'relaunch') {
        simulatedRunning = true;
      }
      if (step.operation === 'terminate') {
        simulatedRunning = false;
      }
    }

    return {
      stepId: step.id,
      stepLabel,
      status: targetState.status,
      reason: targetState.reason,
      backupCoverage: stepBackupCoverage,
    };
  });

  const firstBlockedStep = stepStatuses.find((step) => step.status === 'blocked');
  const hasRunnableStep = stepStatuses.some((step) => step.status === 'runnable');
  const status = firstBlockedStep
    ? 'blocked'
    : hasRunnableStep
      ? 'runnable'
      : 'skipped';

  return {
    distroName,
    status,
    reason: firstBlockedStep?.reason ?? stepStatuses.find((step) => step.status === 'skipped')?.reason,
    blockingStepId: firstBlockedStep?.stepId,
    blockingStepLabel: firstBlockedStep?.stepLabel,
    backupCoverage,
    stepStatuses,
  };
}

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
  const normalizedWorkflow = normalizeWslBatchWorkflowPreset(workflow);
  const steps = getWslBatchWorkflowSteps(normalizedWorkflow);
  const preflightSteps = buildPreflightSteps(steps);
  const workflowBackupCoverage = getWorkflowBackupCoverage(steps);
  const warnings = getBackupCoverageWarnings(workflowBackupCoverage);
  const targetResolution = resolveWslBatchWorkflowTargets(
    normalizedWorkflow.target,
    distros,
    selectedDistros,
    distroTags
  );
  const distrosByName = new Map(distros.map((distro) => [distro.name, distro]));
  const targets: WslBatchWorkflowResolvedTarget[] = targetResolution.resolvedNames.map((distroName) =>
    buildResolvedTarget({
      distroName,
      distro: distrosByName.get(distroName),
      steps,
      capabilities,
      resolveAssistanceAction,
    })
  );

  for (const missingName of targetResolution.missingNames) {
    targets.push({
      distroName: missingName,
      status: 'missing',
      reason: 'Distribution is not present in the current inventory.',
      backupCoverage: workflowBackupCoverage,
      stepStatuses: [],
    });
  }

  const refreshTargets = Array.from(new Set(
    preflightSteps.flatMap((step, index) => getStepInventoryMeta(steps[index]).refreshTargets)
  ));
  const risk = preflightSteps.some((step) => step.risk === 'high') ? 'high' : 'safe';
  const longRunning = preflightSteps.some((step) => step.longRunning);
  const runnableCount = targets.filter((target) => target.status === 'runnable').length;
  const blockedCount = targets.filter((target) => target.status === 'blocked').length;
  const skippedCount = targets.filter((target) => target.status === 'skipped').length;
  const missingCount = targets.filter((target) => target.status === 'missing').length;

  return {
    workflowName: normalizedWorkflow.name,
    actionLabel: getWorkflowActionLabel(normalizedWorkflow, steps),
    risk,
    longRunning,
    requiresConfirmation:
      risk === 'high'
      || longRunning
      || blockedCount > 0
      || missingCount > 0
      || workflowBackupCoverage === 'unprotected'
      || workflowBackupCoverage === 'partial',
    backupCoverage: workflowBackupCoverage,
    warnings,
    refreshTargets,
    steps: preflightSteps,
    targets,
    runnableCount,
    blockedCount,
    skippedCount,
    missingCount,
  };
}

function groupStepResults(
  workflow: WslBatchWorkflowPreset,
  results: WslBatchWorkflowItemResult[],
) {
  const steps = getWslBatchWorkflowSteps(workflow);
  return steps
    .map((step, index) => {
      const stepLabel = getWorkflowStepLabel(step, index);
      const stepResults = results.filter((result) => result.stepId === step.id);
      return {
        stepId: step.id,
        stepLabel,
        succeeded: stepResults.filter((result) => result.status === 'success').length,
        failed: stepResults.filter((result) => result.status === 'failed').length,
        skipped: stepResults.filter((result) => result.status === 'skipped').length,
        results: stepResults,
      };
    })
    .filter((step) => step.results.length > 0);
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
  const normalizedWorkflow = normalizeWslBatchWorkflowPreset(workflow);
  const skippedStepResults: WslBatchWorkflowItemResult[] = [];
  const nonStepTargetResults: WslBatchWorkflowItemResult[] = [];

  for (const target of preflight.targets) {
    if (target.status === 'runnable') {
      continue;
    }

    if (target.stepStatuses.length === 0) {
      nonStepTargetResults.push({
        distroName: target.distroName,
        status: 'skipped',
        detail: target.reason,
        retryable: false,
      });
      continue;
    }

    for (const stepStatus of target.stepStatuses) {
      if (stepStatus.status === 'runnable') {
        continue;
      }

      skippedStepResults.push({
        stepId: stepStatus.stepId,
        stepLabel: stepStatus.stepLabel,
        distroName: target.distroName,
        status: 'skipped',
        detail: stepStatus.reason,
        retryable: false,
      });
    }
  }

  const stepLevelResults = [...executionResults, ...skippedStepResults];
  const stepResults = groupStepResults(normalizedWorkflow, stepLevelResults);
  const aggregateByDistro = new Map<string, WslBatchWorkflowItemResult>();

  const upsertAggregate = (result: WslBatchWorkflowItemResult) => {
    const existing = aggregateByDistro.get(result.distroName);
    if (!existing) {
      aggregateByDistro.set(result.distroName, {
        distroName: result.distroName,
        status: result.status,
        detail: result.detail,
        retryable: result.retryable,
      });
      return;
    }

    if (result.status === 'failed') {
      aggregateByDistro.set(result.distroName, {
        distroName: result.distroName,
        status: 'failed',
        detail: result.detail ?? existing.detail,
        retryable: existing.retryable || result.retryable,
      });
      return;
    }

    if (existing.status === 'failed') {
      return;
    }

    if (result.status === 'success') {
      aggregateByDistro.set(result.distroName, {
        distroName: result.distroName,
        status: 'success',
        detail: existing.detail,
        retryable: existing.retryable || result.retryable,
      });
      return;
    }

    if (existing.status !== 'success') {
      aggregateByDistro.set(result.distroName, {
        distroName: result.distroName,
        status: 'skipped',
        detail: existing.detail ?? result.detail,
        retryable: existing.retryable || result.retryable,
      });
    }
  };

  for (const result of stepLevelResults) {
    upsertAggregate(result);
  }
  for (const result of nonStepTargetResults) {
    upsertAggregate(result);
  }

  const results = Array.from(aggregateByDistro.values());
  const resumeFromStepIndexByDistro = stepResults.reduce<Record<string, number>>((acc, stepSummary) => {
    const stepIndex = normalizedWorkflow.steps?.findIndex((step) => step.id === stepSummary.stepId) ?? -1;
    if (stepIndex < 0) {
      return acc;
    }

    for (const result of stepSummary.results) {
      if (result.status !== 'failed' || !result.retryable) {
        continue;
      }

      acc[result.distroName] = Math.min(acc[result.distroName] ?? stepIndex, stepIndex);
    }

    return acc;
  }, {});
  const retryableStepIndexes = Object.values(resumeFromStepIndexByDistro);
  const resumeFromStepIndex = retryableStepIndexes.length > 0
    ? Math.min(...retryableStepIndexes)
    : null;

  return {
    id: `summary-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    workflowName: normalizedWorkflow.name,
    actionLabel: preflight.actionLabel,
    startedAt,
    completedAt,
    total: results.length,
    succeeded: results.filter((result) => result.status === 'success').length,
    failed: results.filter((result) => result.status === 'failed').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    refreshTargets: [...preflight.refreshTargets],
    workflow: normalizedWorkflow,
    results,
    stepResults,
    resumeFromStepIndex,
    resumeFromStepIndexByDistro,
  };
}

export function getRetryableWorkflowTargetNames(summary: WslBatchWorkflowSummary) {
  if ((summary.stepResults?.length ?? 0) > 0) {
    return Array.from(new Set(
      (summary.stepResults ?? [])
        .flatMap((step) => step.results)
        .filter((result) => result.status === 'failed' && result.retryable)
        .map((result) => result.distroName)
    ));
  }

  return summary.results
    .filter((result) => result.status === 'failed' && result.retryable)
    .map((result) => result.distroName);
}
