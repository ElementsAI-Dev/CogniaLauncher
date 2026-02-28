import { categorizeVar, ENV_VAR_CATEGORY_KEYS, PS_VALID_POLICIES, PS_ALLOWED_SCOPES } from './terminal';

describe('categorizeVar', () => {
  describe('path category', () => {
    it.each(['PATH', 'PNPM_HOME', 'NVM_DIR', 'VOLTA_HOME', 'BUN_INSTALL', 'DENO_DIR', 'PYENV_ROOT', 'SDKMAN_DIR', 'GEM_HOME'])(
      'categorizes %s as path', (key) => {
        expect(categorizeVar(key)).toBe('path');
      }
    );
  });

  describe('language category', () => {
    it.each(['NODE_ENV', 'NPM_CONFIG', 'PYTHONPATH', 'VIRTUAL_ENV', 'CONDA_PREFIX', 'JAVA_HOME', 'GOPATH', 'RUBY_VERSION', 'GEM_PATH', 'CARGO_HOME', 'RUSTUP_HOME'])(
      'categorizes %s as language', (key) => {
        expect(categorizeVar(key)).toBe('language');
      }
    );
  });

  describe('system category', () => {
    it.each(['HOME', 'SHELL', 'TERM', 'EDITOR', 'VISUAL', 'LANG', 'LC_ALL', 'XDG_DATA_HOME', 'COMSPEC', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA'])(
      'categorizes %s as system', (key) => {
        expect(categorizeVar(key)).toBe('system');
      }
    );
  });

  describe('other category', () => {
    it.each(['MY_CUSTOM_VAR', 'FOO', 'DATABASE_URL', 'API_KEY'])(
      'categorizes %s as other', (key) => {
        expect(categorizeVar(key)).toBe('other');
      }
    );
  });

  it('is case-insensitive', () => {
    expect(categorizeVar('path')).toBe('path');
    expect(categorizeVar('Path')).toBe('path');
  });
});

describe('ENV_VAR_CATEGORY_KEYS', () => {
  it('has i18n keys for all categories', () => {
    expect(ENV_VAR_CATEGORY_KEYS.path).toBeTruthy();
    expect(ENV_VAR_CATEGORY_KEYS.language).toBeTruthy();
    expect(ENV_VAR_CATEGORY_KEYS.system).toBeTruthy();
    expect(ENV_VAR_CATEGORY_KEYS.other).toBeTruthy();
  });
});

describe('PS constants', () => {
  it('PS_VALID_POLICIES includes expected policies', () => {
    expect(PS_VALID_POLICIES).toContain('Restricted');
    expect(PS_VALID_POLICIES).toContain('RemoteSigned');
    expect(PS_VALID_POLICIES).toContain('Unrestricted');
  });

  it('PS_ALLOWED_SCOPES includes CurrentUser and Process', () => {
    expect(PS_ALLOWED_SCOPES).toContain('CurrentUser');
    expect(PS_ALLOWED_SCOPES).toContain('Process');
  });
});
