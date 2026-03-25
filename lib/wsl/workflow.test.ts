import type { WslBatchWorkflowPreset, WslBatchWorkflowSummary } from '@/types/wsl';
import {
  buildWslBatchWorkflowPreflight,
  buildWslDistroHref,
  buildWslOverviewHref,
  getWslBatchWorkflowSteps,
  getRetryableWorkflowTargetNames,
  getWslBatchWorkflowStepMeta,
  legacyActionToWorkflowStep,
  normalizeWslBatchWorkflowPreset,
  normalizeSelectedDistros,
  readWslOverviewContext,
  resolveWslWorkspaceScopedTarget,
  resolveWslBatchWorkflowTargets,
  sanitizeWslOverviewContext,
  summarizeWslBatchWorkflowRun,
  summarizeBatchResults,
} from './workflow';

const distros = [
  { name: 'Ubuntu', state: 'Running', wslVersion: '2', isDefault: true },
  { name: 'Debian', state: 'Stopped', wslVersion: '2', isDefault: false },
  { name: 'Arch', state: 'Running', wslVersion: '2', isDefault: false },
];

describe('resolveWslBatchWorkflowTargets', () => {
  it('resolves selected targets from live inventory', () => {
    const result = resolveWslBatchWorkflowTargets(
      { mode: 'selected' },
      distros,
      new Set(['Arch', 'Missing', 'Ubuntu']),
      {}
    );

    expect(result.resolvedNames).toEqual(['Ubuntu', 'Arch']);
    expect(result.missingNames).toEqual([]);
  });

  it('resolves tag and explicit targets with missing buckets', () => {
    const tagged = resolveWslBatchWorkflowTargets(
      { mode: 'tag', tag: 'dev' },
      distros,
      new Set(),
      { Ubuntu: ['dev'], Debian: ['ops'] }
    );
    expect(tagged.resolvedNames).toEqual(['Ubuntu']);

    const explicit = resolveWslBatchWorkflowTargets(
      { mode: 'explicit', distroNames: ['Debian', 'Missing', 'Ubuntu'] },
      distros,
      new Set(),
      {}
    );
    expect(explicit.resolvedNames).toEqual(['Debian', 'Ubuntu']);
    expect(explicit.missingNames).toEqual(['Missing']);
  });
});

describe('buildWslBatchWorkflowPreflight', () => {
  it('marks already running launch targets as skipped', () => {
    const workflow: WslBatchWorkflowPreset = {
      id: 'wf-1',
      name: 'Launch selected',
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      target: { mode: 'selected' },
      action: { kind: 'lifecycle', operation: 'launch' },
    };

    const result = buildWslBatchWorkflowPreflight({
      workflow,
      distros,
      selectedDistros: new Set(['Ubuntu', 'Debian']),
      distroTags: {},
      capabilities: null,
    });

    expect(result.runnableCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.requiresConfirmation).toBe(false);
    expect(result.targets.find((entry) => entry.distroName === 'Ubuntu')?.status).toBe('skipped');
    expect(result.targets.find((entry) => entry.distroName === 'Debian')?.status).toBe('runnable');
  });

  it('describes ordered maintenance steps and backup coverage in preflight', () => {
    const workflow = {
      id: 'wf-maintenance-protected',
      name: 'Protected maintenance',
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      target: { mode: 'selected' },
      steps: [
        { id: 'backup', kind: 'backup', label: 'Backup distro', destinationPath: 'C:\\WSL-Backups' },
        { id: 'upgrade', kind: 'package-upkeep', mode: 'upgrade', label: 'Upgrade packages' },
        { id: 'health', kind: 'health-check', label: 'Health check' },
      ],
    } as unknown as WslBatchWorkflowPreset;

    const result = buildWslBatchWorkflowPreflight({
      workflow,
      distros,
      selectedDistros: new Set(['Ubuntu', 'Debian']),
      distroTags: {},
      capabilities: null,
    });

    expect(result.steps.map((step) => step.label)).toEqual([
      'Backup distro',
      'Upgrade packages',
      'Health check',
    ]);
    expect(result.backupCoverage).toBe('protected');
    expect(result.longRunning).toBe(true);
    expect(result.requiresConfirmation).toBe(true);
    expect(result.targets.find((entry) => entry.distroName === 'Debian')).toMatchObject({
      status: 'blocked',
      blockingStepLabel: 'Upgrade packages',
    });
  });

  it('warns when mutating maintenance runs do not include backup coverage', () => {
    const workflow = {
      id: 'wf-maintenance-unprotected',
      name: 'Unprotected maintenance',
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      target: { mode: 'explicit', distroNames: ['Ubuntu'] },
      steps: [
        { id: 'upgrade', kind: 'package-upkeep', mode: 'upgrade', label: 'Upgrade packages' },
      ],
    } as unknown as WslBatchWorkflowPreset;

    const result = buildWslBatchWorkflowPreflight({
      workflow,
      distros,
      selectedDistros: new Set(),
      distroTags: {},
      capabilities: null,
    });

    expect(result.backupCoverage).toBe('unprotected');
    expect(result.requiresConfirmation).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('backup')])
    );
  });

  it('treats launch followed by command as runnable for stopped distros', () => {
    const workflow = {
      id: 'wf-launch-command',
      name: 'Launch then diagnose',
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      target: { mode: 'explicit', distroNames: ['Debian'] },
      steps: [
        { id: 'launch', kind: 'lifecycle', operation: 'launch', label: 'Launch distro' },
        { id: 'command', kind: 'command', command: 'echo ok', label: 'Run command' },
      ],
    } as unknown as WslBatchWorkflowPreset;

    const result = buildWslBatchWorkflowPreflight({
      workflow,
      distros,
      selectedDistros: new Set(),
      distroTags: {},
      capabilities: null,
    });

    expect(result.runnableCount).toBe(1);
    expect(result.blockedCount).toBe(0);
    expect(result.targets[0]).toMatchObject({ status: 'runnable' });
    expect(result.targets[0].stepStatuses[1]).toMatchObject({ status: 'runnable' });
  });

  it('blocks unsupported assistance actions and requires confirmation for blocked runs', () => {
    const workflow: WslBatchWorkflowPreset = {
      id: 'wf-2',
      name: 'Enable sparse',
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      target: { mode: 'explicit', distroNames: ['Ubuntu'] },
      action: { kind: 'assistance', actionId: 'distro.enableSparse', label: 'Enable Sparse' },
    };

    const result = buildWslBatchWorkflowPreflight({
      workflow,
      distros,
      selectedDistros: new Set(),
      distroTags: {},
      capabilities: { setSparse: false } as never,
      resolveAssistanceAction: () => ({
        id: 'distro.enableSparse',
        scope: 'distro',
        category: 'repair',
        risk: 'high',
        labelKey: 'wsl.assistance.actions.distroSparse.label',
        descriptionKey: 'wsl.assistance.actions.distroSparse.desc',
        supported: false,
        blockedReason: 'Sparse mode is unavailable.',
      }),
    });

    expect(result.blockedCount).toBe(1);
    expect(result.requiresConfirmation).toBe(true);
    expect(result.targets[0]).toMatchObject({ status: 'blocked', reason: 'Sparse mode is unavailable.' });
  });

  it('marks missing explicit targets and blocked empty commands', () => {
    const workflow = {
      id: 'wf-missing-command',
      name: 'Missing distro and empty command',
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      target: { mode: 'explicit', distroNames: ['Missing', 'Ubuntu'] },
      steps: [
        { id: 'command', kind: 'command', command: '   ', label: 'Run command' },
      ],
    } as unknown as WslBatchWorkflowPreset;

    const result = buildWslBatchWorkflowPreflight({
      workflow,
      distros,
      selectedDistros: new Set(),
      distroTags: {},
      capabilities: null,
    });

    expect(result.missingCount).toBe(1);
    expect(result.blockedCount).toBe(1);
    expect(result.requiresConfirmation).toBe(true);
    expect(result.targets.find((entry) => entry.distroName === 'Missing')).toMatchObject({
      status: 'missing',
    });
    expect(result.targets.find((entry) => entry.distroName === 'Ubuntu')?.stepStatuses[0]).toMatchObject({
      status: 'blocked',
      reason: 'Command is required.',
    });
  });

  it('marks mixed maintenance coverage as partial when only some mutating steps are protected', () => {
    const workflow = {
      id: 'wf-partial-backup',
      name: 'Partial backup coverage',
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      target: { mode: 'explicit', distroNames: ['Ubuntu'] },
      steps: [
        { id: 'upgrade-1', kind: 'package-upkeep', mode: 'update', label: 'Update packages' },
        { id: 'backup', kind: 'backup', label: 'Backup distro', destinationPath: 'C:\\WSL-Backups' },
        { id: 'upgrade-2', kind: 'package-upkeep', mode: 'upgrade', label: 'Upgrade packages' },
      ],
    } as unknown as WslBatchWorkflowPreset;

    const result = buildWslBatchWorkflowPreflight({
      workflow,
      distros,
      selectedDistros: new Set(),
      distroTags: {},
      capabilities: null,
    });

    expect(result.backupCoverage).toBe('partial');
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('Some mutating maintenance steps')]),
    );
  });

  it('keeps backup coverage not-applicable for non-mutating health-only workflows', () => {
    const workflow = {
      id: 'wf-health-only',
      name: 'Health only',
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      target: { mode: 'explicit', distroNames: ['Ubuntu'] },
      action: { kind: 'health-check', label: 'Check health' },
    } as unknown as WslBatchWorkflowPreset;

    const result = buildWslBatchWorkflowPreflight({
      workflow,
      distros,
      selectedDistros: new Set(),
      distroTags: {},
      capabilities: null,
    });

    expect(result.backupCoverage).toBe('not-applicable');
    expect(result.warnings).toEqual([]);
    expect(result.actionLabel).toBe('Check health');
  });

  it('uses workflow name and skipped targets when no actionable steps are configured', () => {
    const workflow = {
      id: 'wf-empty',
      name: 'Empty workflow',
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      target: { mode: 'explicit', distroNames: ['Ubuntu'] },
    } as unknown as WslBatchWorkflowPreset;

    const result = buildWslBatchWorkflowPreflight({
      workflow,
      distros,
      selectedDistros: new Set(),
      distroTags: {},
      capabilities: null,
    });

    expect(result.actionLabel).toBe('Empty workflow');
    expect(result.steps).toEqual([]);
    expect(result.targets[0]).toMatchObject({
      status: 'skipped',
    });
  });

  it('blocks assistance steps when the action descriptor is missing or runtime prerequisites are unmet', () => {
    const missingActionWorkflow = {
      id: 'wf-missing-action',
      name: 'Missing action',
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      target: { mode: 'explicit', distroNames: ['Ubuntu'] },
      action: { kind: 'assistance', actionId: 'distro.unknown', label: 'Unknown assistance' },
    } as unknown as WslBatchWorkflowPreset;

    const missingActionResult = buildWslBatchWorkflowPreflight({
      workflow: missingActionWorkflow,
      distros,
      selectedDistros: new Set(),
      distroTags: {},
      capabilities: null,
    });
    expect(missingActionResult.targets[0]).toMatchObject({
      status: 'blocked',
      reason: 'Assistance action is unavailable.',
    });

    const stoppedRuntimeWorkflow = {
      id: 'wf-terminal-action',
      name: 'Open terminal',
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      target: { mode: 'explicit', distroNames: ['Debian'] },
      action: { kind: 'assistance', actionId: 'distro.openTerminal', label: 'Open terminal' },
    } as unknown as WslBatchWorkflowPreset;

    const stoppedRuntimeResult = buildWslBatchWorkflowPreflight({
      workflow: stoppedRuntimeWorkflow,
      distros,
      selectedDistros: new Set(),
      distroTags: {},
      capabilities: null,
      resolveAssistanceAction: () => ({
        id: 'distro.openTerminal',
        scope: 'distro',
        category: 'inspect',
        risk: 'safe',
        labelKey: 'x',
        descriptionKey: 'y',
        supported: true,
      }),
    });
    expect(stoppedRuntimeResult.targets[0].stepStatuses[0]).toMatchObject({
      status: 'blocked',
      reason: 'Distribution must be running.',
    });
  });

  it('falls back to the generic blocked assistance message and unsupported step handling', () => {
    const unsupportedAssistanceWorkflow = {
      id: 'wf-unsupported-assist',
      name: 'Unsupported assistance',
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      target: { mode: 'explicit', distroNames: ['Ubuntu'] },
      action: { kind: 'assistance', actionId: 'distro.relaunch' },
    } as unknown as WslBatchWorkflowPreset;

    const unsupportedAssistResult = buildWslBatchWorkflowPreflight({
      workflow: unsupportedAssistanceWorkflow,
      distros,
      selectedDistros: new Set(),
      distroTags: {},
      capabilities: null,
      resolveAssistanceAction: () => ({
        id: 'distro.relaunch',
        scope: 'distro',
        category: 'repair',
        risk: 'safe',
        labelKey: 'x',
        descriptionKey: 'y',
        supported: false,
        blockedReason: null,
      }),
    });
    expect(unsupportedAssistResult.targets[0]).toMatchObject({
      status: 'blocked',
      reason: 'Action is blocked.',
    });

    const unsupportedStepWorkflow = {
      id: 'wf-unsupported-step',
      name: 'Unsupported step',
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      target: { mode: 'explicit', distroNames: ['Ubuntu'] },
      steps: [{ id: 'unknown', kind: 'mystery' }],
    } as unknown as WslBatchWorkflowPreset;

    const unsupportedStepResult = buildWslBatchWorkflowPreflight({
      workflow: unsupportedStepWorkflow,
      distros,
      selectedDistros: new Set(),
      distroTags: {},
      capabilities: null,
    });
    expect(unsupportedStepResult.targets[0].stepStatuses[0]).toMatchObject({
      status: 'blocked',
      reason: 'Unsupported workflow step.',
    });
  });
});

describe('wsl workflow helpers', () => {
  it('normalizes overview context and builds stable hrefs', () => {
    expect(sanitizeWslOverviewContext({
      tab: 'available',
      tag: 'dev',
      origin: 'widget',
      activeDistroName: 'Ubuntu',
      continueAction: 'launch',
    } as never)).toEqual({
      tab: 'available',
      tag: 'dev',
      origin: 'widget',
      activeDistroName: 'Ubuntu',
      continueAction: 'launch',
    });
    expect(buildWslOverviewHref({
      tab: 'available',
      tag: 'dev',
      origin: 'widget',
      activeDistroName: 'Ubuntu',
      continueAction: 'launch',
    } as never)).toBe(
      '/wsl?tab=available&tag=dev&origin=widget&active=Ubuntu&continue=launch',
    );
    expect(
      buildWslDistroHref('Ubuntu', {
        origin: 'detail',
        tab: 'available',
        tag: 'dev',
        activeDistroName: 'Ubuntu',
        continueAction: 'relaunch',
      } as never),
    ).toContain('continue=relaunch');
  });

  it('reads overview context from search params with fallback defaults', () => {
    const params = new URLSearchParams('tab=available&tag=ops&origin=assistance&active=Debian&continue=launch');

    expect(readWslOverviewContext(params, { origin: 'sidebar' } as never)).toEqual({
      tab: 'available',
      tag: 'ops',
      origin: 'assistance',
      activeDistroName: 'Debian',
      continueAction: 'launch',
    });
    expect(readWslOverviewContext(null, { tag: 'fallback' } as never)).toEqual({
      tab: 'installed',
      tag: 'fallback',
      origin: 'overview',
      activeDistroName: null,
      continueAction: null,
    });
  });

  it('normalizes selected distros and summarizes batch result tuples', () => {
    expect(normalizeSelectedDistros(new Set(['Ubuntu', 'Missing']), distros)).toEqual(
      new Set(['Ubuntu']),
    );
    expect(summarizeBatchResults([
      ['Ubuntu', true, 'done'],
      ['Debian', false, 'boom'],
    ])).toEqual({
      total: 2,
      failed: 1,
      succeeded: 1,
      details: ['Ubuntu: ok - done', 'Debian: failed - boom'],
    });
  });

  it('prefers active workspace targets over fallback defaults for workspace-scoped modules', () => {
    expect(resolveWslWorkspaceScopedTarget({
      activeWorkspaceDistroName: 'Debian',
      availableDistroNames: distros.map((distro) => distro.name),
      fallbackDistroName: 'Ubuntu',
    })).toEqual({
      distroName: 'Debian',
      source: 'workspace',
      followsWorkspace: true,
    });
  });

  it('preserves valid overrides and falls back cleanly when overrides become invalid', () => {
    expect(resolveWslWorkspaceScopedTarget({
      activeWorkspaceDistroName: 'Debian',
      overrideDistroName: 'Ubuntu',
      availableDistroNames: distros.map((distro) => distro.name),
      fallbackDistroName: 'Debian',
    })).toEqual({
      distroName: 'Ubuntu',
      source: 'override',
      followsWorkspace: false,
    });

    expect(resolveWslWorkspaceScopedTarget({
      activeWorkspaceDistroName: 'Debian',
      overrideDistroName: 'Missing',
      availableDistroNames: distros.map((distro) => distro.name),
      fallbackDistroName: 'Ubuntu',
    })).toEqual({
      distroName: 'Debian',
      source: 'workspace',
      followsWorkspace: true,
    });
  });

  it('maps legacy actions to steps and exposes step metadata', () => {
    const step = legacyActionToWorkflowStep({
      kind: 'command',
      command: 'echo ok',
      label: 'Run command',
    } as never, 1);

    expect(step).toMatchObject({
      id: 'command-2',
      kind: 'command',
      command: 'echo ok',
    });
    expect(getWslBatchWorkflowStepMeta({
      id: 'assist',
      kind: 'assistance',
      actionId: 'distro.openTerminal',
    } as never)).toMatchObject({
      id: 'distro.openInTerminal',
      refreshTargets: [],
    });
  });

  it('normalizes action-driven workflows and fills missing step ids and labels', () => {
    const workflow = normalizeWslBatchWorkflowPreset({
      id: 'wf-action',
      name: 'Action workflow',
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      target: { mode: 'selected' },
      action: { kind: 'package-upkeep', mode: 'update' },
    } as never);

    expect(workflow.steps).toEqual([
      expect.objectContaining({
        id: 'package-upkeep-1',
        kind: 'package-upkeep',
        mode: 'update',
      }),
    ]);
    expect(workflow.action).toEqual({ kind: 'package-upkeep', mode: 'update' });
    expect(getWslBatchWorkflowSteps({
      id: 'wf-empty',
      name: 'Empty',
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      target: { mode: 'selected' },
    } as never)).toEqual([]);
  });

  it('normalizes single-step workflows back into legacy action payloads for multiple step kinds', () => {
    const backupWorkflow = normalizeWslBatchWorkflowPreset({
      id: 'wf-backup',
      name: 'Backup workflow',
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      target: { mode: 'selected' },
      steps: [{ kind: 'backup', destinationPath: 'C:\\WSL-Backups' }],
    } as never);
    expect(backupWorkflow.action).toEqual({
      kind: 'backup',
      destinationPath: 'C:\\WSL-Backups',
      label: undefined,
    });

    const assistanceWorkflow = normalizeWslBatchWorkflowPreset({
      id: 'wf-assist',
      name: 'Assistance workflow',
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      target: { mode: 'selected' },
      steps: [{ kind: 'assistance', actionId: 'distro.healthCheck' }],
    } as never);
    expect(assistanceWorkflow.action).toEqual({
      kind: 'assistance',
      actionId: 'distro.healthCheck',
      label: undefined,
    });

    const upkeepWorkflow = normalizeWslBatchWorkflowPreset({
      id: 'wf-upkeep',
      name: 'Upkeep workflow',
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      target: { mode: 'selected' },
      steps: [{ kind: 'package-upkeep', mode: 'upgrade' }],
    } as never);
    expect(upkeepWorkflow.action).toEqual({
      kind: 'package-upkeep',
      mode: 'upgrade',
      label: undefined,
    });
  });

  it('maps multiple legacy action kinds and metadata branches', () => {
    expect(legacyActionToWorkflowStep({
      kind: 'backup',
      destinationPath: 'C:\\WSL-Backups',
    } as never)).toMatchObject({
      kind: 'backup',
      destinationPath: 'C:\\WSL-Backups',
    });
    expect(legacyActionToWorkflowStep({
      kind: 'assistance',
      actionId: 'distro.relaunch',
    } as never)).toMatchObject({
      kind: 'assistance',
      actionId: 'distro.relaunch',
    });
    expect(getWslBatchWorkflowStepMeta({
      id: 'terminate',
      kind: 'lifecycle',
      operation: 'terminate',
    } as never)).toMatchObject({
      id: 'runtime.batchTerminate',
      risk: 'safe',
    });
    expect(getWslBatchWorkflowStepMeta({
      id: 'relaunch',
      kind: 'lifecycle',
      operation: 'relaunch',
    } as never)).toMatchObject({
      id: 'distro.relaunch',
    });
    expect(getWslBatchWorkflowStepMeta({
      id: 'assist',
      kind: 'assistance',
      actionId: 'distro.healthCheck',
    } as never)).toMatchObject({
      id: 'distro.healthCheck',
    });
    expect(getWslBatchWorkflowStepMeta({
      id: 'backup',
      kind: 'backup',
    } as never)).toMatchObject({
      id: 'backup.create',
    });
    expect(getWslBatchWorkflowStepMeta({
      id: 'upgrade',
      kind: 'package-upkeep',
      mode: 'upgrade',
    } as never)).toMatchObject({
      id: 'distro.packageUpgrade',
    });
  });

  it('uses default overview href when no custom params are provided', () => {
    expect(buildWslOverviewHref()).toBe('/wsl');
    expect(buildWslDistroHref('Ubuntu')).toContain('returnTo=%2Fwsl');
  });
});

describe('summarizeWslBatchWorkflowRun', () => {
  it('combines skipped preflight items with execution results and exposes retryable failures', () => {
    const workflow: WslBatchWorkflowPreset = {
      id: 'wf-3',
      name: 'Diagnostics',
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      target: { mode: 'explicit', distroNames: ['Ubuntu', 'Debian'] },
      action: { kind: 'command', command: 'echo ok', user: 'root', label: 'Echo' },
    };
    const preflight = buildWslBatchWorkflowPreflight({
      workflow,
      distros,
      selectedDistros: new Set(),
      distroTags: {},
      capabilities: null,
    });

    const summary = summarizeWslBatchWorkflowRun({
      workflow,
      preflight,
      startedAt: '2026-03-12T00:00:00.000Z',
      completedAt: '2026-03-12T00:01:00.000Z',
      executionResults: [
        { distroName: 'Ubuntu', status: 'success', detail: 'ok', retryable: false },
      ],
    });

    expect(summary.total).toBe(2);
    expect(summary.succeeded).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.failed).toBe(0);
    expect(getRetryableWorkflowTargetNames(summary)).toEqual([]);
  });

  it('returns only retryable failed targets for retries', () => {
    const summary = {
      id: 'summary-1',
      workflowName: 'Batch work',
      actionLabel: 'Do work',
      startedAt: '2026-03-12T00:00:00.000Z',
      completedAt: '2026-03-12T00:01:00.000Z',
      total: 3,
      succeeded: 1,
      failed: 2,
      skipped: 0,
      refreshTargets: ['runtime'],
      workflow: {
        id: 'wf-4',
        name: 'Batch work',
        createdAt: '2026-03-12T00:00:00.000Z',
        updatedAt: '2026-03-12T00:00:00.000Z',
        target: { mode: 'selected' as const },
        action: { kind: 'health-check' as const, label: 'Health Check' },
      },
      results: [
        { distroName: 'Ubuntu', status: 'success', retryable: false },
        { distroName: 'Debian', status: 'failed', retryable: true },
        { distroName: 'Arch', status: 'failed', retryable: false },
      ],
    } as WslBatchWorkflowSummary;

    expect(getRetryableWorkflowTargetNames(summary)).toEqual(['Debian']);
  });

  it('preserves per-step outcomes and resume position for maintenance retries', () => {
    const workflow = {
      id: 'wf-steps',
      name: 'Nightly maintenance',
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      target: { mode: 'explicit', distroNames: ['Ubuntu', 'Debian'] },
      steps: [
        { id: 'backup', kind: 'backup', label: 'Backup distro', destinationPath: 'C:\\WSL-Backups' },
        { id: 'upgrade', kind: 'package-upkeep', mode: 'upgrade', label: 'Upgrade packages' },
      ],
    } as unknown as WslBatchWorkflowPreset;

    const preflight = buildWslBatchWorkflowPreflight({
      workflow,
      distros,
      selectedDistros: new Set(),
      distroTags: {},
      capabilities: null,
    });

    const summary = summarizeWslBatchWorkflowRun({
      workflow,
      preflight,
      startedAt: '2026-03-12T00:00:00.000Z',
      completedAt: '2026-03-12T00:05:00.000Z',
      executionResults: [
        {
          stepId: 'backup',
          stepLabel: 'Backup distro',
          distroName: 'Ubuntu',
          status: 'success',
          retryable: false,
        },
        {
          stepId: 'backup',
          stepLabel: 'Backup distro',
          distroName: 'Debian',
          status: 'failed',
          detail: 'disk full',
          retryable: true,
        },
        {
          stepId: 'upgrade',
          stepLabel: 'Upgrade packages',
          distroName: 'Ubuntu',
          status: 'success',
          retryable: false,
        },
        {
          stepId: 'upgrade',
          stepLabel: 'Upgrade packages',
          distroName: 'Debian',
          status: 'skipped',
          detail: 'Blocked by failed step: Backup distro',
          retryable: false,
        },
      ] as never,
    });
    const extendedSummary = summary as unknown as {
      stepResults: Array<{
        stepId: string;
        failed: number;
        results: Array<{ distroName: string; status: string }>;
      }>;
      resumeFromStepIndex: number;
    };

    expect(extendedSummary.stepResults).toHaveLength(2);
    expect(extendedSummary.resumeFromStepIndex).toBe(0);
    expect(extendedSummary.stepResults[0]).toMatchObject({
      stepId: 'backup',
      failed: 1,
    });
    expect(extendedSummary.stepResults[1].results.find((entry) => entry.distroName === 'Debian')).toMatchObject({
      status: 'skipped',
    });
    expect(getRetryableWorkflowTargetNames(summary)).toEqual(['Debian']);
  });

  it('tracks retry resume positions per distro when failures happen on different steps', () => {
    const workflow = {
      id: 'wf-multi-retry',
      name: 'Staggered maintenance',
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      target: { mode: 'explicit', distroNames: ['Ubuntu', 'Debian'] },
      steps: [
        { id: 'backup', kind: 'backup', label: 'Backup distro', destinationPath: 'C:\\WSL-Backups' },
        { id: 'upgrade', kind: 'package-upkeep', mode: 'upgrade', label: 'Upgrade packages' },
        { id: 'command', kind: 'command', command: 'echo ok', label: 'Run command' },
      ],
    } as unknown as WslBatchWorkflowPreset;

    const preflight = buildWslBatchWorkflowPreflight({
      workflow,
      distros,
      selectedDistros: new Set(),
      distroTags: {},
      capabilities: null,
    });

    const summary = summarizeWslBatchWorkflowRun({
      workflow,
      preflight,
      startedAt: '2026-03-12T00:00:00.000Z',
      completedAt: '2026-03-12T00:05:00.000Z',
      executionResults: [
        {
          stepId: 'backup',
          stepLabel: 'Backup distro',
          distroName: 'Ubuntu',
          status: 'failed',
          detail: 'disk full',
          retryable: true,
        },
        {
          stepId: 'backup',
          stepLabel: 'Backup distro',
          distroName: 'Debian',
          status: 'success',
          retryable: false,
        },
        {
          stepId: 'upgrade',
          stepLabel: 'Upgrade packages',
          distroName: 'Debian',
          status: 'success',
          retryable: false,
        },
        {
          stepId: 'command',
          stepLabel: 'Run command',
          distroName: 'Debian',
          status: 'failed',
          detail: 'boom',
          retryable: true,
        },
      ] as never,
    });
    const extendedSummary = summary as unknown as {
      resumeFromStepIndex: number;
      resumeFromStepIndexByDistro: Record<string, number>;
    };

    expect(extendedSummary.resumeFromStepIndex).toBe(0);
    expect(extendedSummary.resumeFromStepIndexByDistro).toEqual({
      Ubuntu: 0,
      Debian: 2,
    });
  });

  it('converts missing preflight targets into skipped summary entries', () => {
    const workflow = {
      id: 'wf-missing-summary',
      name: 'Missing target summary',
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      target: { mode: 'explicit', distroNames: ['Missing'] },
      action: { kind: 'health-check', label: 'Health Check' },
    } as unknown as WslBatchWorkflowPreset;

    const preflight = buildWslBatchWorkflowPreflight({
      workflow,
      distros,
      selectedDistros: new Set(),
      distroTags: {},
      capabilities: null,
    });

    const summary = summarizeWslBatchWorkflowRun({
      workflow,
      preflight,
      startedAt: '2026-03-12T00:00:00.000Z',
      completedAt: '2026-03-12T00:01:00.000Z',
      executionResults: [],
    });

    expect(summary).toMatchObject({
      total: 1,
      skipped: 1,
      failed: 0,
      succeeded: 0,
    });
    expect(summary.results[0]).toMatchObject({
      distroName: 'Missing',
      status: 'skipped',
    });
  });
});
