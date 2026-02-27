import type { EnvFileFormat } from '@/types/tauri';

/**
 * Validation result for environment variable key.
 */
export type EnvVarKeyValidation =
  | { valid: true }
  | { valid: false; error: 'empty' | 'invalid' };

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
