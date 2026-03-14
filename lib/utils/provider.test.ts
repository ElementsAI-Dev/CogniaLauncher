import {
  getProviderStatusReason,
  getProviderStatusState,
  getProviderStatusTextKey,
  isProviderStatusAvailable,
  normalizeProviderList,
  normalizeProviderStatus,
} from './provider';

describe('normalizeProviderList', () => {
  it('normalizes JSON array values', () => {
    expect(normalizeProviderList('["brew","apt"]')).toBe('brew, apt');
  });

  it('passes through plain comma-separated values', () => {
    expect(normalizeProviderList('brew, apt')).toBe('brew, apt');
  });
});

describe('provider status helpers', () => {
  it('normalizes boolean status into provider status shape', () => {
    expect(normalizeProviderStatus('npm', true)).toMatchObject({
      id: 'npm',
      scope_state: 'available',
      installed: true,
    });
    expect(normalizeProviderStatus('npm', false)).toMatchObject({
      id: 'npm',
      scope_state: 'unavailable',
      installed: false,
    });
  });

  it('preserves richer scope states', () => {
    expect(
      getProviderStatusState({
        id: 'npm',
        display_name: 'npm',
        installed: false,
        platforms: [],
        scope_state: 'timeout',
      }),
    ).toBe('timeout');

    expect(
      getProviderStatusState({
        id: 'npm',
        display_name: 'npm',
        installed: false,
        platforms: [],
        scope_state: 'unsupported',
      }),
    ).toBe('unsupported');
  });

  it('returns correct availability and text keys', () => {
    const unsupportedStatus = {
      id: 'npm',
      display_name: 'npm',
      installed: false,
      platforms: [],
      scope_state: 'unsupported' as const,
      reason: 'Unsupported platform',
    };

    expect(isProviderStatusAvailable(unsupportedStatus)).toBe(false);
    expect(getProviderStatusTextKey(getProviderStatusState(unsupportedStatus))).toBe(
      'providers.statusUnsupported',
    );
    expect(getProviderStatusReason(unsupportedStatus)).toBe('Unsupported platform');
  });
});
