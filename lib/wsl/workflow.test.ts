import type { WslBatchWorkflowPreset, WslBatchWorkflowSummary } from '@/types/wsl';
import {
  buildWslBatchWorkflowPreflight,
  getRetryableWorkflowTargetNames,
  resolveWslBatchWorkflowTargets,
  summarizeWslBatchWorkflowRun,
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
});
