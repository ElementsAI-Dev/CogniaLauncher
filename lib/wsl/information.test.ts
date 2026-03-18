import {
  createEmptyWslDistroInfoSnapshot,
  createEmptyWslRuntimeInfoSnapshot,
  deriveWslDistroInfoState,
  deriveWslRuntimeInfoState,
  resolveWslInfoFailure,
  resolveWslInfoSuccess,
} from './information';

describe('wsl information helpers', () => {
  it('creates an empty runtime snapshot with idle section states', () => {
    const snapshot = createEmptyWslRuntimeInfoSnapshot();

    expect(snapshot.state).toBe('idle');
    expect(snapshot.runtime.state).toBe('idle');
    expect(snapshot.status.state).toBe('idle');
    expect(snapshot.capabilities.state).toBe('idle');
    expect(snapshot.versionInfo.state).toBe('idle');
    expect(snapshot.lastUpdatedAt).toBeNull();
  });

  it('marks failed refreshes as stale when prior data exists', () => {
    const readySection = resolveWslInfoSuccess(null, { version: '2.4.0' }, '2026-03-15T12:00:00.000Z');
    const failedRefresh = resolveWslInfoFailure(
      readySection,
      new Error('kernel probe timeout'),
      { reason: 'Refresh failed after a previous success.' },
    );

    expect(failedRefresh.state).toBe('stale');
    expect(failedRefresh.data).toEqual({ version: '2.4.0' });
    expect(failedRefresh.failure?.message).toContain('kernel probe timeout');
    expect(failedRefresh.reason).toBe('Refresh failed after a previous success.');
  });

  it('marks first-time failures as failed when no prior data exists', () => {
    const failedSection = resolveWslInfoFailure(
      null,
      new Error('capability probe unavailable'),
      { reason: 'Capability detection never completed.' },
    );

    expect(failedSection.state).toBe('failed');
    expect(failedSection.data).toBeNull();
    expect(failedSection.failure?.message).toContain('capability probe unavailable');
    expect(failedSection.reason).toBe('Capability detection never completed.');
  });

  it('derives a partial runtime state when sections disagree', () => {
    const snapshot = createEmptyWslRuntimeInfoSnapshot();
    snapshot.runtime = resolveWslInfoSuccess(
      null,
      { state: 'ready', available: true, reasonCode: 'runtime_ready', reason: 'ok', runtimeProbes: [], statusProbe: { ready: true, reasonCode: 'ok' }, capabilityProbe: { ready: true, reasonCode: 'ok' }, distroProbe: { ready: true, reasonCode: 'ok' }, distroCount: 1, degradedReasons: [] },
      '2026-03-15T12:00:00.000Z',
    );
    snapshot.status = resolveWslInfoSuccess(
      null,
      { version: '2.4.0', statusInfo: 'ok', runningDistros: ['Ubuntu'] },
      '2026-03-15T12:00:00.000Z',
    );
    snapshot.capabilities = resolveWslInfoFailure(
      null,
      new Error('capability probe failed'),
      { reason: 'Capabilities could not be detected.' },
    );

    expect(deriveWslRuntimeInfoState(snapshot)).toBe('partial');
  });

  it('derives an unavailable distro info state when live sections are unavailable for a stopped distro', () => {
    const snapshot = createEmptyWslDistroInfoSnapshot('Ubuntu', 'Stopped');
    snapshot.diskUsage = resolveWslInfoSuccess(
      null,
      { totalBytes: 1024, usedBytes: 256, filesystemPath: '\\\\wsl.localhost\\Ubuntu' },
      '2026-03-15T12:00:00.000Z',
    );
    snapshot.environment = {
      state: 'unavailable',
      data: null,
      failure: null,
      reason: 'Distribution is not running.',
      updatedAt: null,
    };
    snapshot.resources = {
      state: 'unavailable',
      data: null,
      failure: null,
      reason: 'Distribution is not running.',
      updatedAt: null,
    };
    snapshot.ipAddress = {
      state: 'unavailable',
      data: null,
      failure: null,
      reason: 'Distribution is not running.',
      updatedAt: null,
    };

    expect(deriveWslDistroInfoState(snapshot)).toBe('partial');
  });
});
