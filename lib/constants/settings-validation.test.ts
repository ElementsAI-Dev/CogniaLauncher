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

  it('has rules for general.update_check_concurrency', () => {
    const rule = VALIDATION_RULES['general.update_check_concurrency'];
    expect(rule).toBeDefined();
    expect(rule.min).toBe(1);
    expect(rule.max).toBe(32);
  });

  it('has rules for general.package_download_threshold_mb', () => {
    const rule = VALIDATION_RULES['general.package_download_threshold_mb'];
    expect(rule).toBeDefined();
    expect(rule.min).toBe(0);
    expect(rule.max).toBe(10240);
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

  it('returns error when update_check_concurrency is below min', () => {
    const result = validateField('general.update_check_concurrency', '0', mockT);
    expect(result).toContain('min');
  });

  it('returns error when update_check_concurrency is above max', () => {
    const result = validateField('general.update_check_concurrency', '64', mockT);
    expect(result).toContain('max');
  });

  it('returns null for valid update_check_concurrency', () => {
    expect(validateField('general.update_check_concurrency', '8', mockT)).toBeNull();
    expect(validateField('general.update_check_concurrency', '1', mockT)).toBeNull();
    expect(validateField('general.update_check_concurrency', '32', mockT)).toBeNull();
  });

  it('validates package_download_threshold_mb range', () => {
    expect(validateField('general.package_download_threshold_mb', '0', mockT)).toBeNull();
    expect(validateField('general.package_download_threshold_mb', '512', mockT)).toBeNull();
    expect(validateField('general.package_download_threshold_mb', '-1', mockT)).toContain('min');
    expect(validateField('general.package_download_threshold_mb', '20000', mockT)).toContain('max');
  });

  it('validates dynamic provider priority keys as numeric-or-empty', () => {
    expect(validateField('providers.npm.priority', '', mockT)).toBeNull();
    expect(validateField('providers.npm.priority', '120', mockT)).toBeNull();
    expect(validateField('providers.npm.priority', 'abc', mockT)).toContain('mustBeNumber');
  });
});
