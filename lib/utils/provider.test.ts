import {
  getProviderStatusReason,
  getProviderStatusSortValue,
  getProviderStatusState,
  getProviderStatusTextKey,
  isProviderStatusAvailable,
  normalizeProviderList,
  normalizeProviderStatus,
} from './provider';

describe('normalizeProviderList', () => {
  it('returns an empty string for blank input', () => {
    expect(normalizeProviderList('   ')).toBe('');
  });

  it('normalizes JSON array values', () => {
    expect(normalizeProviderList('["brew","apt"]')).toBe('brew, apt');
  });

  it('filters falsy JSON array entries', () => {
    expect(normalizeProviderList('["brew","","apt"]')).toBe('brew, apt');
  });

  it('falls back to the raw value when json parsing fails', () => {
    expect(normalizeProviderList('["brew",')).toBe('["brew",');
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

  it('returns undefined for nullish provider statuses', () => {
    expect(normalizeProviderStatus('npm', null)).toBeUndefined();
    expect(normalizeProviderStatus('npm', undefined)).toBeUndefined();
  });

  it('passes through structured provider statuses unchanged', () => {
    const status = {
      id: 'npm',
      display_name: 'npm',
      installed: true,
      platforms: [],
      scope_state: 'available' as const,
      reason: null,
    };

    expect(normalizeProviderStatus('npm', status)).toBe(status);
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

  it('falls back to installed state when scope_state is unknown', () => {
    expect(
      getProviderStatusState({
        id: 'npm',
        display_name: 'npm',
        installed: true,
        platforms: [],
        scope_state: 'mystery' as never,
      }),
    ).toBe('available');

    expect(
      getProviderStatusState({
        id: 'npm',
        display_name: 'npm',
        installed: false,
        platforms: [],
        scope_state: 'mystery' as never,
      }),
    ).toBe('unavailable');
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

  it('returns unknown text and availability for missing statuses', () => {
    expect(getProviderStatusState(undefined)).toBe('unknown');
    expect(isProviderStatusAvailable(undefined)).toBeUndefined();
    expect(getProviderStatusTextKey('unknown')).toBe('providers.statusUnknown');
  });

  it('prefers explicit reason fields in priority order', () => {
    expect(getProviderStatusReason(true)).toBeNull();

    expect(getProviderStatusReason({
      id: 'npm',
      display_name: 'npm',
      installed: false,
      platforms: [],
      scope_state: 'unsupported',
      reason: null,
      reason_code: 'code-reason',
      scope_reason: 'scope-reason',
    })).toBe('code-reason');

    expect(getProviderStatusReason({
      id: 'npm',
      display_name: 'npm',
      installed: false,
      platforms: [],
      scope_state: 'unsupported',
      reason: null,
      reason_code: null,
      scope_reason: 'scope-reason',
    })).toBe('scope-reason');
  });

  it('maps status states to deterministic sort weights', () => {
    expect(getProviderStatusSortValue(true)).toBe(4);
    expect(getProviderStatusSortValue({
      id: 'timeout',
      display_name: 'timeout',
      installed: false,
      platforms: [],
      scope_state: 'timeout',
    })).toBe(3);
    expect(getProviderStatusSortValue({
      id: 'unsupported',
      display_name: 'unsupported',
      installed: false,
      platforms: [],
      scope_state: 'unsupported',
    })).toBe(2);
    expect(getProviderStatusSortValue(false)).toBe(1);
    expect(getProviderStatusSortValue(undefined)).toBe(0);
  });
});
