import { preValidatePath, MAX_PATH_LENGTH, DANGEROUS_CHARS_RE, SHELL_INJECTION_RE } from './path';

const mockT = (key: string) => key;

describe('constants', () => {
  it('MAX_PATH_LENGTH is 4096', () => {
    expect(MAX_PATH_LENGTH).toBe(4096);
  });

  it('DANGEROUS_CHARS_RE matches dangerous characters', () => {
    expect(DANGEROUS_CHARS_RE.test('`')).toBe(true);
    expect(DANGEROUS_CHARS_RE.test('$')).toBe(true);
    expect(DANGEROUS_CHARS_RE.test('|')).toBe(true);
    expect(DANGEROUS_CHARS_RE.test(';')).toBe(true);
    expect(DANGEROUS_CHARS_RE.test('>')).toBe(true);
    expect(DANGEROUS_CHARS_RE.test('<')).toBe(true);
  });

  it('SHELL_INJECTION_RE matches injection patterns', () => {
    expect(SHELL_INJECTION_RE.test('$(cmd)')).toBe(true);
    expect(SHELL_INJECTION_RE.test('a && b')).toBe(true);
    expect(SHELL_INJECTION_RE.test('a || b')).toBe(true);
  });
});

describe('preValidatePath', () => {
  it('returns ok for empty value (means default)', () => {
    expect(preValidatePath('', mockT)).toEqual({ ok: true });
    expect(preValidatePath('  ', mockT)).toEqual({ ok: true });
  });

  it('returns error for path exceeding MAX_PATH_LENGTH', () => {
    const longPath = 'C:\\' + 'a'.repeat(MAX_PATH_LENGTH);
    const result = preValidatePath(longPath, mockT);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('tooLong');
  });

  it('returns error for path with dangerous characters', () => {
    const result = preValidatePath('C:\\path;rm -rf /', mockT);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('dangerousChars');
  });

  it('returns error for shell injection patterns', () => {
    const result = preValidatePath('/path/$(whoami)/dir', mockT);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('dangerousChars');
  });

  it('returns error for relative paths', () => {
    const result = preValidatePath('relative/path', mockT);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('mustBeAbsolute');
  });

  it('accepts valid Windows absolute path', () => {
    expect(preValidatePath('C:\\Users\\test', mockT)).toEqual({ ok: true });
    expect(preValidatePath('D:/Projects/app', mockT)).toEqual({ ok: true });
  });

  it('accepts valid Unix absolute path', () => {
    expect(preValidatePath('/home/user/.cognia', mockT)).toEqual({ ok: true });
    expect(preValidatePath('/opt/cognia/data', mockT)).toEqual({ ok: true });
  });

  it('rejects path starting with dot', () => {
    const result = preValidatePath('./relative', mockT);
    expect(result.ok).toBe(false);
  });
});
