export type EnvVarCategory = 'path' | 'language' | 'system' | 'other';

export function categorizeVar(key: string): EnvVarCategory {
  const k = key.toUpperCase();
  if (k === 'PATH' || k === 'PNPM_HOME' || k === 'NVM_DIR' || k === 'VOLTA_HOME'
    || k === 'BUN_INSTALL' || k === 'DENO_DIR' || k === 'PYENV_ROOT'
    || k === 'SDKMAN_DIR' || k === 'GEM_HOME') {
    return 'path';
  }
  if (k.startsWith('NODE_') || k.startsWith('NPM_') || k.startsWith('PYTHON')
    || k.startsWith('VIRTUAL_ENV') || k.startsWith('CONDA_') || k.startsWith('JAVA_')
    || k.startsWith('GO') || k.startsWith('RUBY') || k.startsWith('GEM_')
    || k.startsWith('CARGO_') || k.startsWith('RUST')) {
    return 'language';
  }
  if (k === 'HOME' || k === 'SHELL' || k === 'TERM' || k === 'EDITOR' || k === 'VISUAL'
    || k === 'LANG' || k === 'LC_ALL' || k.startsWith('XDG_') || k === 'COMSPEC'
    || k === 'USERPROFILE' || k === 'APPDATA' || k === 'LOCALAPPDATA') {
    return 'system';
  }
  return 'other';
}

export const ENV_VAR_CATEGORY_LABELS: Record<EnvVarCategory, string> = {
  path: 'PATH & Tools',
  language: 'Language Runtimes',
  system: 'System',
  other: 'Other',
};

export const PS_VALID_POLICIES = ['Restricted', 'AllSigned', 'RemoteSigned', 'Unrestricted', 'Bypass'];
export const PS_ALLOWED_SCOPES = ['CurrentUser', 'Process'];
