import type {
  EnvFileFormat,
  EnvVarConflict,
  EnvVarSensitivityReason,
  EnvVarScope,
  EnvVarSummary,
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
  isSensitive?: boolean;
  sensitivityReason?: EnvVarSensitivityReason | null;
  hasValue?: boolean;
  revealedValue?: string | null;
  masked?: boolean;
}

interface BuildEnvVarRowsInput {
  processVars: EnvVarSummary[];
  userPersistentVars: EnvVarSummary[];
  systemPersistentVars: EnvVarSummary[];
  scopeFilter: EnvVarScope | 'all';
  conflicts?: EnvVarConflict[];
  revealedValues?: Record<string, string>;
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
  processVars = [],
  userPersistentVars = [],
  systemPersistentVars = [],
  scopeFilter,
  conflicts = [],
  revealedValues = {},
}: BuildEnvVarRowsInput): EnvVarRow[] {
  const rows: EnvVarRow[] = [];
  const conflictKeys = normalizeConflictKeys(conflicts);
  const getRevealKey = (scope: EnvVarScope, key: string) => `${scope}:${key}`;

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
      ...processVars.map((item) =>
        maybeSetConflict({
          key: item.key,
          value: revealedValues[getRevealKey('process', item.key)] ?? item.value.displayValue,
          revealedValue: revealedValues[getRevealKey('process', item.key)] ?? null,
          scope: 'process' as const,
          isSensitive: item.value.isSensitive,
          sensitivityReason: item.value.sensitivityReason,
          hasValue: item.value.hasValue,
          masked: item.value.masked && !revealedValues[getRevealKey('process', item.key)],
        }),
      ),
    );
  }

  if (scopeFilter === 'all' || scopeFilter === 'user') {
    rows.push(
      ...userPersistentVars.map((item) =>
        maybeSetConflict({
          key: item.key,
          value: revealedValues[getRevealKey('user', item.key)] ?? item.value.displayValue,
          revealedValue: revealedValues[getRevealKey('user', item.key)] ?? null,
          scope: 'user',
          regType: item.regType ?? undefined,
          isSensitive: item.value.isSensitive,
          sensitivityReason: item.value.sensitivityReason,
          hasValue: item.value.hasValue,
          masked: item.value.masked && !revealedValues[getRevealKey('user', item.key)],
        }),
      ),
    );
  }

  if (scopeFilter === 'all' || scopeFilter === 'system') {
    rows.push(
      ...systemPersistentVars.map((item) =>
        maybeSetConflict({
          key: item.key,
          value: revealedValues[getRevealKey('system', item.key)] ?? item.value.displayValue,
          revealedValue: revealedValues[getRevealKey('system', item.key)] ?? null,
          scope: 'system',
          regType: item.regType ?? undefined,
          isSensitive: item.value.isSensitive,
          sensitivityReason: item.value.sensitivityReason,
          hasValue: item.value.hasValue,
          masked: item.value.masked && !revealedValues[getRevealKey('system', item.key)],
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
