import {
  validateEnvVarKey,
  getEnvFileExtension,
  downloadEnvFile,
  ENV_FORMAT_EXTENSIONS,
} from './envvar';
import type { EnvFileFormat } from '@/types/tauri';

describe('validateEnvVarKey', () => {
  it('returns invalid with error "empty" for empty string', () => {
    expect(validateEnvVarKey('')).toEqual({ valid: false, error: 'empty' });
  });

  it('returns invalid with error "empty" for whitespace-only', () => {
    expect(validateEnvVarKey('   ')).toEqual({ valid: false, error: 'empty' });
  });

  it('returns valid for a normal key', () => {
    expect(validateEnvVarKey('MY_VAR')).toEqual({ valid: true });
  });

  it('returns valid for key with numbers and underscores', () => {
    expect(validateEnvVarKey('APP_VERSION_2')).toEqual({ valid: true });
  });

  it('returns invalid with error "invalid" for key with spaces', () => {
    expect(validateEnvVarKey('BAD KEY')).toEqual({ valid: false, error: 'invalid' });
  });

  it('returns invalid with error "invalid" for key with equals sign', () => {
    expect(validateEnvVarKey('KEY=VAL')).toEqual({ valid: false, error: 'invalid' });
  });

  it('returns invalid with error "invalid" for key with null byte', () => {
    expect(validateEnvVarKey('KEY\0')).toEqual({ valid: false, error: 'invalid' });
  });

  it('returns valid for key with leading/trailing spaces (trimmed)', () => {
    expect(validateEnvVarKey('  VALID_KEY  ')).toEqual({ valid: true });
  });
});

describe('ENV_FORMAT_EXTENSIONS', () => {
  it('has entries for all formats', () => {
    const formats: EnvFileFormat[] = ['dotenv', 'shell', 'fish', 'powershell', 'nushell'];
    for (const fmt of formats) {
      expect(ENV_FORMAT_EXTENSIONS[fmt]).toBeDefined();
      expect(ENV_FORMAT_EXTENSIONS[fmt].startsWith('.')).toBe(true);
    }
  });
});

describe('getEnvFileExtension', () => {
  it('returns .env for dotenv', () => {
    expect(getEnvFileExtension('dotenv')).toBe('.env');
  });

  it('returns .ps1 for powershell', () => {
    expect(getEnvFileExtension('powershell')).toBe('.ps1');
  });

  it('returns .sh for shell', () => {
    expect(getEnvFileExtension('shell')).toBe('.sh');
  });

  it('returns .fish for fish', () => {
    expect(getEnvFileExtension('fish')).toBe('.fish');
  });

  it('returns .nu for nushell', () => {
    expect(getEnvFileExtension('nushell')).toBe('.nu');
  });
});

describe('downloadEnvFile', () => {
  let createObjectURL: jest.Mock;
  let revokeObjectURL: jest.Mock;
  let appendChildSpy: jest.SpyInstance;
  let removeChildSpy: jest.SpyInstance;
  let clickSpy: jest.Mock;

  beforeEach(() => {
    createObjectURL = jest.fn().mockReturnValue('blob:test-url');
    revokeObjectURL = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, writable: true });

    clickSpy = jest.fn();
    jest.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: clickSpy,
    } as unknown as HTMLAnchorElement);

    appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a blob and triggers download', () => {
    downloadEnvFile('FOO=bar', 'dotenv');

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
  });

  it('uses correct filename for powershell format', () => {
    const mockAnchor = {
      href: '',
      download: '',
      click: jest.fn(),
    } as unknown as HTMLAnchorElement;
    jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor);

    downloadEnvFile('$env:FOO="bar"', 'powershell');

    expect((mockAnchor as unknown as { download: string }).download).toBe('environment.ps1');
  });

  it('appends and removes anchor from body', () => {
    downloadEnvFile('export FOO=bar', 'shell');

    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
  });
});
