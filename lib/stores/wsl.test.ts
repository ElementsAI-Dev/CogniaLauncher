import { useWslStore } from './wsl';

describe('useWslStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useWslStore.setState({
      savedCommands: [],
      distroTags: {},
      availableTags: ['dev', 'test', 'prod', 'experiment'],
      customProfiles: [],
      workflowPresets: [],
      workflowSummaries: [],
      overviewContext: { tab: 'installed', tag: null, origin: 'overview' },
    });
  });

  it('adds, updates, and removes saved commands', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.123456);

    useWslStore.getState().addSavedCommand({
      name: 'List files',
      command: 'ls -la',
      user: 'root',
    });
    const added = useWslStore.getState().savedCommands[0];
    expect(added.name).toBe('List files');
    expect(added.id.startsWith('cmd-1700000000000-')).toBe(true);

    useWslStore.getState().updateSavedCommand(added.id, { name: 'List all files' });
    expect(useWslStore.getState().savedCommands[0].name).toBe('List all files');

    useWslStore.getState().removeSavedCommand(added.id);
    expect(useWslStore.getState().savedCommands).toEqual([]);

    nowSpy.mockRestore();
    randomSpy.mockRestore();
  });

  it('manages distro tags and available tag catalog without duplicates', () => {
    useWslStore.getState().setDistroTags('Ubuntu', ['dev', 'prod']);
    expect(useWslStore.getState().distroTags.Ubuntu).toEqual(['dev', 'prod']);

    useWslStore.getState().addAvailableTag('qa');
    useWslStore.getState().addAvailableTag('qa');
    expect(useWslStore.getState().availableTags.filter((tag) => tag === 'qa')).toHaveLength(1);

    useWslStore.getState().removeAvailableTag('dev');
    const state = useWslStore.getState();
    expect(state.availableTags).not.toContain('dev');
    expect(state.distroTags.Ubuntu).toEqual(['prod']);
  });

  it('adds, updates, and removes custom network profiles', () => {
    const profile = {
      id: 'custom-1',
      labelKey: 'wsl.custom.label',
      descKey: 'wsl.custom.desc',
      settings: [{ section: 'wsl2' as const, key: 'memory', value: '6GB' }],
    };
    useWslStore.getState().addCustomProfile(profile);
    expect(useWslStore.getState().customProfiles).toHaveLength(1);

    useWslStore.getState().updateCustomProfile('custom-1', { descKey: 'wsl.custom.updated' });
    expect(useWslStore.getState().customProfiles[0].descKey).toBe('wsl.custom.updated');

    useWslStore.getState().removeCustomProfile('custom-1');
    expect(useWslStore.getState().customProfiles).toEqual([]);
  });

  it('stores WSL overview workflow context', () => {
    useWslStore.getState().setOverviewContext({
      tab: 'available',
      tag: 'dev',
      origin: 'sidebar',
    });

    expect(useWslStore.getState().overviewContext).toEqual({
      tab: 'available',
      tag: 'dev',
      origin: 'sidebar',
    });
  });

  it('adds, updates, and removes workflow presets', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.654321);

    useWslStore.getState().addWorkflowPreset({
      name: 'Launch selected',
      target: { mode: 'selected' },
      steps: [{ id: 'launch', kind: 'lifecycle', operation: 'launch', label: 'Launch' }],
    } as never);

    const added = useWslStore.getState().workflowPresets[0];
    expect(added.id.startsWith('workflow-1700000000000-')).toBe(true);
    expect(added.name).toBe('Launch selected');

    useWslStore.getState().updateWorkflowPreset(added.id, { name: 'Launch active selection' });
    expect(useWslStore.getState().workflowPresets[0].name).toBe('Launch active selection');

    useWslStore.getState().removeWorkflowPreset(added.id);
    expect(useWslStore.getState().workflowPresets).toEqual([]);

    nowSpy.mockRestore();
    randomSpy.mockRestore();
  });

  it('migrates legacy action-based presets and summaries into one-step playbooks', () => {
    const getPersistConfig = () =>
      (useWslStore as unknown as {
        persist: {
          getOptions: () => { migrate: (state: unknown, version: number) => unknown };
        };
      }).persist.getOptions();

    const migrated = getPersistConfig().migrate({
      workflowPresets: [
        {
          id: 'wf-legacy',
          name: 'Legacy workflow',
          createdAt: '2026-03-12T00:00:00.000Z',
          updatedAt: '2026-03-12T00:00:00.000Z',
          target: { mode: 'selected' },
          action: { kind: 'health-check', label: 'Health Check' },
        },
      ],
      workflowSummaries: [
        {
          id: 'summary-legacy',
          workflowName: 'Legacy workflow',
          actionLabel: 'Health Check',
          startedAt: '2026-03-12T00:00:00.000Z',
          completedAt: '2026-03-12T00:01:00.000Z',
          total: 1,
          succeeded: 1,
          failed: 0,
          skipped: 0,
          refreshTargets: ['runtime'],
          workflow: {
            id: 'wf-legacy',
            name: 'Legacy workflow',
            createdAt: '2026-03-12T00:00:00.000Z',
            updatedAt: '2026-03-12T00:00:00.000Z',
            target: { mode: 'selected' },
            action: { kind: 'health-check', label: 'Health Check' },
          },
          results: [{ distroName: 'Ubuntu', status: 'success', retryable: false }],
        },
      ],
    }, 2) as {
      workflowPresets: Array<{ steps?: Array<{ kind: string }> }>;
      workflowSummaries: Array<{ workflow: { steps?: Array<{ kind: string }> } }>;
    };

    expect(migrated.workflowPresets[0].steps).toHaveLength(1);
    expect(migrated.workflowPresets[0].steps?.[0]).toMatchObject({ kind: 'health-check' });
    expect(migrated.workflowSummaries[0].workflow.steps).toHaveLength(1);
    expect(migrated.workflowSummaries[0].workflow.steps?.[0]).toMatchObject({ kind: 'health-check' });
  });

  it('records workflow summaries with newest first', () => {
    useWslStore.getState().recordWorkflowSummary({
      id: 'summary-1',
      workflowName: 'Health checks',
      actionLabel: 'Health Check',
      startedAt: '2026-03-12T00:00:00.000Z',
      completedAt: '2026-03-12T00:01:00.000Z',
      total: 1,
      succeeded: 1,
      failed: 0,
      skipped: 0,
      refreshTargets: ['runtime'],
      workflow: {
        id: 'wf-1',
        name: 'Health checks',
        createdAt: '2026-03-12T00:00:00.000Z',
        updatedAt: '2026-03-12T00:00:00.000Z',
        target: { mode: 'selected' },
        steps: [{ id: 'health', kind: 'health-check', label: 'Health Check' }],
      },
      results: [{ distroName: 'Ubuntu', status: 'success', retryable: false }],
      stepResults: [
        {
          stepId: 'health',
          stepLabel: 'Health Check',
          succeeded: 1,
          failed: 0,
          skipped: 0,
          results: [{ distroName: 'Ubuntu', status: 'success', retryable: false }],
        },
      ],
    } as never);
    useWslStore.getState().recordWorkflowSummary({
      id: 'summary-2',
      workflowName: 'Launch',
      actionLabel: 'Launch',
      startedAt: '2026-03-12T00:02:00.000Z',
      completedAt: '2026-03-12T00:03:00.000Z',
      total: 1,
      succeeded: 1,
      failed: 0,
      skipped: 0,
      refreshTargets: ['runtime'],
      workflow: {
        id: 'wf-2',
        name: 'Launch',
        createdAt: '2026-03-12T00:02:00.000Z',
        updatedAt: '2026-03-12T00:02:00.000Z',
        target: { mode: 'selected' },
        steps: [{ id: 'launch', kind: 'lifecycle', operation: 'launch', label: 'Launch' }],
      },
      results: [{ distroName: 'Ubuntu', status: 'success', retryable: false }],
      stepResults: [
        {
          stepId: 'launch',
          stepLabel: 'Launch',
          succeeded: 1,
          failed: 0,
          skipped: 0,
          results: [{ distroName: 'Ubuntu', status: 'success', retryable: false }],
        },
      ],
    } as never);

    expect(useWslStore.getState().workflowSummaries.map((entry) => entry.id)).toEqual([
      'summary-2',
      'summary-1',
    ]);
  });
});
