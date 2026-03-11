import {
  buildWslFailure,
  deriveWslCompleteness,
  resolveWslOperationGate,
} from './completeness';

describe('resolveWslOperationGate', () => {
  it('blocks operations when runtime is unavailable', () => {
    const gate = resolveWslOperationGate('runtime.mount', false, null);
    expect(gate.supported).toBe(false);
    expect(gate.reason).toContain('unavailable');
  });

  it('blocks capability-gated operations when capability is explicitly false', () => {
    const gate = resolveWslOperationGate(
      'distro.setSparse',
      true,
      {
        manage: true,
        move: true,
        resize: true,
        setSparse: false,
        setDefaultUser: true,
        mountOptions: true,
        shutdownForce: true,
        exportFormat: true,
        importInPlace: true,
      }
    );
    expect(gate.supported).toBe(false);
    expect(gate.capability).toBe('setSparse');
  });

  it('blocks capability-gated operations when runtime capability probe is degraded', () => {
    const gate = resolveWslOperationGate(
      'runtime.importInPlace',
      true,
      null,
      {
        state: 'degraded',
        available: true,
        reasonCode: 'runtime_degraded',
        reason: 'Capability probe unavailable',
        runtimeProbes: [],
        statusProbe: { ready: true, reasonCode: 'ok' },
        capabilityProbe: {
          ready: false,
          reasonCode: 'capability_probe_failed',
          detail: 'Capability probe unavailable',
        },
        distroProbe: { ready: true, reasonCode: 'ok' },
        distroCount: 1,
        degradedReasons: ['Runtime capabilities could not be detected.'],
      }
    );
    expect(gate.supported).toBe(false);
    expect(gate.reason).toContain('Capability probe unavailable');
  });
});

describe('buildWslFailure', () => {
  it('classifies unsupported failures', () => {
    const failure = buildWslFailure('[WSL_UNSUPPORTED:runtime.mount] not supported');
    expect(failure.category).toBe('unsupported');
  });

  it('classifies permission failures', () => {
    const failure = buildWslFailure('Access is denied');
    expect(failure.category).toBe('permission');
  });

  it('classifies runtime precondition failures', () => {
    const failure = buildWslFailure('[WSL_RUNTIME:distro.launch] runtime unavailable');
    expect(failure.category).toBe('runtime');
  });
});

describe('deriveWslCompleteness', () => {
  it('returns unavailable state when runtime is unavailable', () => {
    const snapshot = deriveWslCompleteness(false, [], null, null);
    expect(snapshot.state).toBe('unavailable');
    expect(snapshot.available).toBe(false);
  });

  it('returns empty state when runtime is available but no distros exist', () => {
    const snapshot = deriveWslCompleteness(true, [], { version: '2.4.0', statusInfo: '', runningDistros: [] }, null);
    expect(snapshot.state).toBe('empty');
  });

  it('returns degraded state when runtime metadata is incomplete', () => {
    const snapshot = deriveWslCompleteness(
      true,
      [{ name: 'Ubuntu', state: 'Stopped', wslVersion: '2', isDefault: true }],
      null,
      null
    );
    expect(snapshot.state).toBe('degraded');
    expect(snapshot.degradedReasons.length).toBeGreaterThan(0);
  });

  it('prefers staged runtime snapshot state when provided', () => {
    const snapshot = deriveWslCompleteness(
      true,
      [],
      null,
      null,
      {
        state: 'degraded',
        available: true,
        reasonCode: 'runtime_degraded',
        reason: 'Runtime status data is unavailable.',
        runtimeProbes: [],
        statusProbe: {
          ready: false,
          reasonCode: 'status_probe_failed',
          detail: 'Status probe failed',
        },
        capabilityProbe: { ready: true, reasonCode: 'ok' },
        distroProbe: { ready: true, reasonCode: 'ok' },
        distroCount: 2,
        degradedReasons: ['Runtime status data is unavailable.'],
      }
    );
    expect(snapshot.state).toBe('degraded');
    expect(snapshot.distroCount).toBe(2);
    expect(snapshot.degradedReasons[0]).toContain('Runtime status data is unavailable');
  });
});
