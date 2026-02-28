import { normalizeProviderList } from './provider';

describe('normalizeProviderList', () => {
  it('parses JSON array into comma-separated string', () => {
    expect(normalizeProviderList('["npm","pip","cargo"]')).toBe('npm, pip, cargo');
  });

  it('returns comma-separated string as-is', () => {
    expect(normalizeProviderList('npm, pip, cargo')).toBe('npm, pip, cargo');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeProviderList('')).toBe('');
    expect(normalizeProviderList('  ')).toBe('');
  });

  it('filters out empty/falsy values in JSON array', () => {
    expect(normalizeProviderList('["npm","","cargo"]')).toBe('npm, cargo');
  });

  it('returns raw value for invalid JSON starting with [', () => {
    expect(normalizeProviderList('[invalid')).toBe('[invalid');
  });

  it('returns raw value for non-array JSON', () => {
    expect(normalizeProviderList('{"key":"value"}')).toBe('{"key":"value"}');
  });

  it('handles single-element array', () => {
    expect(normalizeProviderList('["npm"]')).toBe('npm');
  });

  it('handles empty JSON array', () => {
    expect(normalizeProviderList('[]')).toBe('');
  });
});
