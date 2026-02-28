import { VALIDATION_RULES, validateField } from './settings-validation';

const mockT = (key: string, params?: Record<string, string | number>) => {
  if (params) return `${key}:${JSON.stringify(params)}`;
  return key;
};

describe('VALIDATION_RULES', () => {
  it('has rules for general.parallel_downloads', () => {
    const rule = VALIDATION_RULES['general.parallel_downloads'];
    expect(rule).toBeDefined();
    expect(rule.min).toBe(1);
    expect(rule.max).toBe(16);
  });

  it('has rules for network.proxy with pattern', () => {
    const rule = VALIDATION_RULES['network.proxy'];
    expect(rule).toBeDefined();
    expect(rule.pattern).toBeInstanceOf(RegExp);
  });

  it('has rules for mirror URLs', () => {
    expect(VALIDATION_RULES['mirrors.npm']).toBeDefined();
    expect(VALIDATION_RULES['mirrors.pypi']).toBeDefined();
    expect(VALIDATION_RULES['mirrors.crates']).toBeDefined();
    expect(VALIDATION_RULES['mirrors.go']).toBeDefined();
  });
});

describe('validateField', () => {
  it('returns null for key with no rules', () => {
    expect(validateField('nonexistent.key', '123', mockT)).toBeNull();
  });

  it('returns error for non-numeric value in numeric field', () => {
    const result = validateField('general.parallel_downloads', 'abc', mockT);
    expect(result).toContain('mustBeNumber');
  });

  it('returns error when below min', () => {
    const result = validateField('general.parallel_downloads', '0', mockT);
    expect(result).toContain('min');
  });

  it('returns error when above max', () => {
    const result = validateField('general.parallel_downloads', '100', mockT);
    expect(result).toContain('max');
  });

  it('returns null for valid numeric value', () => {
    expect(validateField('general.parallel_downloads', '8', mockT)).toBeNull();
  });

  it('returns error for invalid proxy URL pattern', () => {
    const result = validateField('network.proxy', 'not-a-url', mockT);
    expect(result).toBeTruthy();
  });

  it('returns null for valid proxy URL', () => {
    expect(validateField('network.proxy', 'http://proxy.example.com:8080', mockT)).toBeNull();
  });

  it('returns null for empty proxy (allowed)', () => {
    expect(validateField('network.proxy', '', mockT)).toBeNull();
  });

  it('returns error for invalid mirror URL', () => {
    const result = validateField('mirrors.npm', 'ftp://bad', mockT);
    expect(result).toBeTruthy();
  });

  it('returns null for valid mirror URL', () => {
    expect(validateField('mirrors.npm', 'https://registry.npmjs.org', mockT)).toBeNull();
  });
});
