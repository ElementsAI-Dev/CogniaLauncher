import {
  invalidateRequestWave,
  isRequestWaveCurrent,
  startRequestWave,
} from './request-wave';

describe('request-wave helpers', () => {
  it('increments wave numbers and marks only latest wave as current', () => {
    const ref = { current: 0 };

    const first = startRequestWave(ref);
    expect(first).toBe(1);
    expect(isRequestWaveCurrent(ref, first)).toBe(true);

    const second = startRequestWave(ref);
    expect(second).toBe(2);
    expect(isRequestWaveCurrent(ref, first)).toBe(false);
    expect(isRequestWaveCurrent(ref, second)).toBe(true);
  });

  it('invalidates active wave explicitly', () => {
    const ref = { current: 0 };
    const wave = startRequestWave(ref);

    invalidateRequestWave(ref);

    expect(isRequestWaveCurrent(ref, wave)).toBe(false);
  });
});
