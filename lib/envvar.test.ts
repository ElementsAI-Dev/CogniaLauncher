import {
  validateEnvVarKey,
  getEnvFileExtension,
  downloadEnvFile,
  ENV_FORMAT_EXTENSIONS,
  buildEnvVarRows,
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

describe('buildEnvVarRows', () => {
  it('builds all-scope rows without key deduplication', () => {
    const rows = buildEnvVarRows({
      scopeFilter: 'all',
      processVars: { PATH: 'proc-path', HOME: '/home/user' },
      userPersistentVars: [
        { key: 'PATH', value: 'user-path', regType: 'REG_EXPAND_SZ' },
      ],
      systemPersistentVars: [
        { key: 'PATH', value: 'sys-path', regType: 'REG_SZ' },
      ],
      conflicts: [],
    });

    const pathRows = rows.filter((row) => row.key === 'PATH');
    expect(pathRows).toHaveLength(3);
    expect(pathRows.map((row) => row.scope)).toEqual(['process', 'user', 'system']);
  });

  it('sorts by key (case-insensitive) then scope order', () => {
    const rows = buildEnvVarRows({
      scopeFilter: 'all',
      processVars: { zebra: 'z', Alpha: 'a' },
      userPersistentVars: [{ key: 'alpha', value: 'ua' }],
      systemPersistentVars: [{ key: 'ALPHA', value: 'sa' }],
      conflicts: [],
    });

    expect(rows[0]).toMatchObject({ key: 'Alpha', scope: 'process' });
    expect(rows[1]).toMatchObject({ key: 'alpha', scope: 'user' });
    expect(rows[2]).toMatchObject({ key: 'ALPHA', scope: 'system' });
    expect(rows[3]).toMatchObject({ key: 'zebra', scope: 'process' });
  });

  it('marks user/system conflict rows from conflict list', () => {
    const rows = buildEnvVarRows({
      scopeFilter: 'all',
      processVars: { PATH: 'proc-path' },
      userPersistentVars: [{ key: 'PATH', value: 'user-path' }],
      systemPersistentVars: [{ key: 'Path', value: 'sys-path' }],
      conflicts: [
        {
          key: 'PATH',
          userValue: 'user-path',
          systemValue: 'sys-path',
          effectiveValue: 'user-path',
        },
      ],
    });

    const processPath = rows.find((row) => row.scope === 'process' && row.key === 'PATH');
    const userPath = rows.find((row) => row.scope === 'user' && row.key === 'PATH');
    const systemPath = rows.find((row) => row.scope === 'system' && row.key === 'Path');

    expect(processPath?.conflict).toBeUndefined();
    expect(userPath?.conflict).toBe(true);
    expect(systemPath?.conflict).toBe(true);
  });

  it('returns scope-only rows for user/system filters', () => {
    const userRows = buildEnvVarRows({
      scopeFilter: 'user',
      processVars: { A: '1' },
      userPersistentVars: [{ key: 'U', value: '2' }],
      systemPersistentVars: [{ key: 'S', value: '3' }],
      conflicts: [],
    });
    const systemRows = buildEnvVarRows({
      scopeFilter: 'system',
      processVars: { A: '1' },
      userPersistentVars: [{ key: 'U', value: '2' }],
      systemPersistentVars: [{ key: 'S', value: '3' }],
      conflicts: [],
    });

    expect(userRows).toEqual([{ key: 'U', value: '2', scope: 'user', regType: undefined, conflict: false }]);
    expect(systemRows).toEqual([{ key: 'S', value: '3', scope: 'system', regType: undefined, conflict: false }]);
  });
});
