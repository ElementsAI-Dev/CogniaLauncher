import { useHealthCheckStore } from './health-check';

describe('useHealthCheckStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useHealthCheckStore.setState({
      systemHealth: null,
      environmentHealth: {},
      loading: false,
      error: null,
      progress: null,
      lastCheckedAt: null,
    });
  });

  it('sets system health, updates environment map, and records timestamp', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const result = {
      overall_status: 'healthy',
      environments: [
        {
          env_type: 'node',
          provider_id: 'fnm',
          status: 'healthy',
          issues: [],
          suggestions: [],
          current_version: '20.11.0',
          installed_count: 1,
          checked_at: '2026-03-05T00:00:00Z',
        },
      ],
      package_managers: [],
      system_issues: [],
      skipped_providers: [],
      checked_at: '2026-03-05T00:00:00Z',
    } as const;

    useHealthCheckStore.getState().setSystemHealth(result);
    const state = useHealthCheckStore.getState();

    expect(state.systemHealth).toEqual(result);
    expect(state.environmentHealth.node).toEqual(result.environments[0]);
    expect(state.lastCheckedAt).toBe(1700000000000);
    nowSpy.mockRestore();
  });

  it('updates individual environment health entries', () => {
    const envResult = {
      env_type: 'python',
      provider_id: 'uv',
      status: 'warning',
      issues: [],
      suggestions: [],
      current_version: '3.11',
      installed_count: 2,
      checked_at: '2026-03-05T00:00:00Z',
    } as const;

    useHealthCheckStore.getState().setEnvironmentHealth('python', envResult);
    expect(useHealthCheckStore.getState().environmentHealth.python).toEqual(envResult);
  });

  it('tracks loading, error, and progress transitions', () => {
    useHealthCheckStore.getState().setLoading(true);
    useHealthCheckStore.getState().setError('network timeout');
    useHealthCheckStore.getState().setProgress({
      completed: 2,
      total: 4,
      currentProvider: 'fnm',
      phase: 'download',
    });

    const state = useHealthCheckStore.getState();
    expect(state.loading).toBe(true);
    expect(state.error).toBe('network timeout');
    expect(state.progress?.completed).toBe(2);
  });

  it('clears transient results but keeps lastCheckedAt for staleness checks', () => {
    useHealthCheckStore.setState({
      systemHealth: { overall_status: 'healthy', environments: [], package_managers: [], system_issues: [], skipped_providers: [], checked_at: 'x' } as never,
      environmentHealth: { node: { env_type: 'node' } as never },
      error: 'boom',
      progress: { completed: 1, total: 2, currentProvider: 'fnm', phase: 'done' },
      lastCheckedAt: 123,
    });

    useHealthCheckStore.getState().clearResults();
    const state = useHealthCheckStore.getState();
    expect(state.systemHealth).toBeNull();
    expect(state.environmentHealth).toEqual({});
    expect(state.error).toBeNull();
    expect(state.progress).toBeNull();
    expect(state.lastCheckedAt).toBe(123);
  });

  it('evaluates staleness with a 10-minute threshold', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(10 * 60 * 1000 + 1000);

    useHealthCheckStore.setState({ lastCheckedAt: null });
    expect(useHealthCheckStore.getState().isStale()).toBe(true);

    useHealthCheckStore.setState({ lastCheckedAt: 2000 });
    expect(useHealthCheckStore.getState().isStale()).toBe(false);

    useHealthCheckStore.setState({ lastCheckedAt: 500 });
    expect(useHealthCheckStore.getState().isStale()).toBe(true);

    nowSpy.mockRestore();
  });
});
