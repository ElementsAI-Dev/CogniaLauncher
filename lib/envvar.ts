import type {
  EnvFileFormat,
  EnvVarConflict,
  EnvVarScope,
  PersistentEnvVar,
} from '@/types/tauri';

/**
 * Validation result for environment variable key.
 */
export type EnvVarKeyValidation =
  | { valid: true }
  | { valid: false; error: 'empty' | 'invalid' };

export interface EnvVarRow {
  key: string;
  value: string;
  scope: EnvVarScope;
  regType?: string;
  conflict?: boolean;
}

interface BuildEnvVarRowsInput {
  processVars: Record<string, string>;
  userPersistentVars: PersistentEnvVar[];
  systemPersistentVars: PersistentEnvVar[];
  scopeFilter: EnvVarScope | 'all';
  conflicts?: EnvVarConflict[];
}

const ENV_SCOPE_ORDER: Record<EnvVarScope, number> = {
  process: 0,
  user: 1,
  system: 2,
};

function normalizeConflictKeys(conflicts: EnvVarConflict[]): Set<string> {
  return new Set(conflicts.map((item) => item.key.toLowerCase()));
}

/**
 * Build render rows for env-var table.
 * In "all" scope, entries are expanded by source scope without key-level deduplication.
 */
export function buildEnvVarRows({
  processVars,
  userPersistentVars,
  systemPersistentVars,
  scopeFilter,
  conflicts = [],
}: BuildEnvVarRowsInput): EnvVarRow[] {
  const rows: EnvVarRow[] = [];
  const conflictKeys = normalizeConflictKeys(conflicts);

  const maybeSetConflict = (row: EnvVarRow): EnvVarRow => {
    if (row.scope === 'user' || row.scope === 'system') {
      return {
        ...row,
        conflict: conflictKeys.has(row.key.toLowerCase()),
      };
    }
    return row;
  };

  if (scopeFilter === 'all' || scopeFilter === 'process') {
    rows.push(
      ...Object.entries(processVars).map(([key, value]) => ({
        key,
        value,
        scope: 'process' as const,
      })),
    );
  }

  if (scopeFilter === 'all' || scopeFilter === 'user') {
    rows.push(
      ...userPersistentVars.map((item) =>
        maybeSetConflict({
          key: item.key,
          value: item.value,
          scope: 'user',
          regType: item.regType,
        }),
      ),
    );
  }

  if (scopeFilter === 'all' || scopeFilter === 'system') {
    rows.push(
      ...systemPersistentVars.map((item) =>
        maybeSetConflict({
          key: item.key,
          value: item.value,
          scope: 'system',
          regType: item.regType,
        }),
      ),
    );
  }

  rows.sort((a, b) => {
    const byKey = a.key.localeCompare(b.key, undefined, { sensitivity: 'base' });
    if (byKey !== 0) return byKey;
    return ENV_SCOPE_ORDER[a.scope] - ENV_SCOPE_ORDER[b.scope];
  });

  return rows;
}

/**
 * Validate an environment variable key.
 * Returns { valid: true } if the key is acceptable,
 * or { valid: false, error } describing the issue.
 */
export function validateEnvVarKey(key: string): EnvVarKeyValidation {
  const trimmed = key.trim();
  if (!trimmed) {
    return { valid: false, error: 'empty' };
  }
  if (/[\s=\0]/.test(trimmed)) {
    return { valid: false, error: 'invalid' };
  }
  return { valid: true };
}

/**
 * Map from EnvFileFormat to file extension (including leading dot).
 */
export const ENV_FORMAT_EXTENSIONS: Record<EnvFileFormat, string> = {
  dotenv: '.env',
  powershell: '.ps1',
  shell: '.sh',
  fish: '.fish',
  nushell: '.nu',
};

/**
 * Get the file extension for a given environment file format.
 */
export function getEnvFileExtension(format: EnvFileFormat): string {
  return ENV_FORMAT_EXTENSIONS[format] ?? '.env';
}

/**
 * Download text content as a file using a temporary anchor element.
 */
export function downloadEnvFile(content: string, format: EnvFileFormat): void {
  const ext = getEnvFileExtension(format);
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `environment${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
