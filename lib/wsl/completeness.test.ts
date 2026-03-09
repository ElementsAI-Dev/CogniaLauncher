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
});
