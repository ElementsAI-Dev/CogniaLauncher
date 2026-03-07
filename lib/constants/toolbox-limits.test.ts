import { TOOLBOX_LIMITS } from './toolbox-limits';

describe('TOOLBOX_LIMITS', () => {
  it('has all expected keys', () => {
    expect(Object.keys(TOOLBOX_LIMITS).sort()).toEqual([
      'converterChars',
      'cronExpressionChars',
      'cronPreviewCount',
      'diffCharsPerInput',
      'diffLines',
      'generatorCount',
      'jsonChars',
      'markdownPreviewChars',
      'numberBaseChars',
      'regexChars',
      'regexMatches',
    ]);
  });

  it('uses positive numeric limits', () => {
    Object.values(TOOLBOX_LIMITS).forEach((value) => {
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThan(0);
    });
  });

  it('keeps json converter limits ordered by payload size', () => {
    expect(TOOLBOX_LIMITS.jsonChars).toBeGreaterThan(TOOLBOX_LIMITS.converterChars);
    expect(TOOLBOX_LIMITS.converterChars).toBeGreaterThan(TOOLBOX_LIMITS.numberBaseChars);
  });
});
