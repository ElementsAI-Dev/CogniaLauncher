/**
 * Error handling utilities for CogniaLauncher
 * Provides structured error parsing and user-friendly suggestions
 */

// Re-export types from types/errors.ts
export type { ErrorCode, CogniaError } from '@/types/errors';

import type { ErrorCode, CogniaError } from '@/types/errors';

// Error code detection patterns
const ERROR_PATTERNS: Array<{ pattern: RegExp; code: ErrorCode }> = [
  { pattern: /configuration error/i, code: 'CONFIG_ERROR' },
  { pattern: /provider error/i, code: 'PROVIDER_ERROR' },
  { pattern: /provider not found/i, code: 'PROVIDER_NOT_FOUND' },
  { pattern: /package not found/i, code: 'PACKAGE_NOT_FOUND' },
  { pattern: /version not found/i, code: 'VERSION_NOT_FOUND' },
  { pattern: /version not installed/i, code: 'VERSION_NOT_INSTALLED' },
  { pattern: /dependency resolution/i, code: 'RESOLUTION_ERROR' },
  { pattern: /dependency conflict/i, code: 'CONFLICT_ERROR' },
  { pattern: /installation failed/i, code: 'INSTALLATION_ERROR' },
  { pattern: /checksum mismatch/i, code: 'CHECKSUM_MISMATCH' },
  { pattern: /download failed/i, code: 'DOWNLOAD_ERROR' },
  { pattern: /network error|connection|timeout|ECONNREFUSED|ETIMEDOUT/i, code: 'NETWORK_ERROR' },
  { pattern: /io error|file not found|permission denied|access denied/i, code: 'IO_ERROR' },
  { pattern: /database error/i, code: 'DATABASE_ERROR' },
  { pattern: /parse error|invalid json|syntax error/i, code: 'PARSE_ERROR' },
  { pattern: /platform not supported|unsupported os/i, code: 'PLATFORM_NOT_SUPPORTED' },
  { pattern: /permission denied|elevated|administrator|sudo/i, code: 'PERMISSION_DENIED' },
  { pattern: /cancelled|canceled|aborted/i, code: 'CANCELLED' },
  { pattern: /internal error/i, code: 'INTERNAL_ERROR' },
];

// Suggestions for each error code
const ERROR_SUGGESTIONS: Record<ErrorCode, string> = {
  CONFIG_ERROR: 'Check your configuration file for syntax errors or invalid values.',
  PROVIDER_ERROR: 'The version manager may not be configured correctly. Try reinstalling it.',
  PROVIDER_NOT_FOUND: 'Install the required version manager (nvm, pyenv, rustup, etc.) first.',
  PACKAGE_NOT_FOUND: 'Verify the package name and try searching for similar packages.',
  VERSION_NOT_FOUND: 'This version does not exist. Check available versions and try again.',
  VERSION_NOT_INSTALLED: 'Install this version first before trying to use it.',
  RESOLUTION_ERROR: 'There may be conflicting dependencies. Try updating all packages.',
  CONFLICT_ERROR: 'Multiple packages require incompatible versions. Review your dependencies.',
  INSTALLATION_ERROR: 'Installation failed. Check disk space and try again.',
  CHECKSUM_MISMATCH: 'Download was corrupted. Clear cache and try again.',
  DOWNLOAD_ERROR: 'Download failed. Check your internet connection or try a different mirror.',
  NETWORK_ERROR: 'Check your internet connection. You may need to configure a proxy.',
  IO_ERROR: 'File system operation failed. Check disk space and file permissions.',
  DATABASE_ERROR: 'Cache database error. Try clearing the cache.',
  PARSE_ERROR: 'Invalid data format. The source may be corrupted.',
  PLATFORM_NOT_SUPPORTED: 'This feature is not available on your operating system.',
  PERMISSION_DENIED: 'Run with administrator/sudo privileges or check file permissions.',
  CANCELLED: 'Operation was cancelled.',
  INTERNAL_ERROR: 'An unexpected error occurred. Please report this issue.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Check the logs for more details.',
};

// Localization keys for error codes
export const ERROR_I18N_KEYS: Record<ErrorCode, string> = {
  CONFIG_ERROR: 'errors.config',
  PROVIDER_ERROR: 'errors.provider',
  PROVIDER_NOT_FOUND: 'errors.providerNotFound',
  PACKAGE_NOT_FOUND: 'errors.packageNotFound',
  VERSION_NOT_FOUND: 'errors.versionNotFound',
  VERSION_NOT_INSTALLED: 'errors.versionNotInstalled',
  RESOLUTION_ERROR: 'errors.resolution',
  CONFLICT_ERROR: 'errors.conflict',
  INSTALLATION_ERROR: 'errors.installation',
  CHECKSUM_MISMATCH: 'errors.checksumMismatch',
  DOWNLOAD_ERROR: 'errors.download',
  NETWORK_ERROR: 'errors.network',
  IO_ERROR: 'errors.io',
  DATABASE_ERROR: 'errors.database',
  PARSE_ERROR: 'errors.parse',
  PLATFORM_NOT_SUPPORTED: 'errors.platformNotSupported',
  PERMISSION_DENIED: 'errors.permissionDenied',
  CANCELLED: 'errors.cancelled',
  INTERNAL_ERROR: 'errors.internal',
  UNKNOWN_ERROR: 'errors.unknown',
};

/**
 * Parse an error from the backend into a structured CogniaError
 */
export function parseError(error: unknown): CogniaError {
  const message = error instanceof Error ? error.message : String(error);
  
  // Try to match error patterns
  for (const { pattern, code } of ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return {
        code,
        message,
        suggestion: ERROR_SUGGESTIONS[code],
      };
    }
  }
  
  // Default to unknown error
  return {
    code: 'UNKNOWN_ERROR',
    message,
    suggestion: ERROR_SUGGESTIONS.UNKNOWN_ERROR,
  };
}

/**
 * Get a user-friendly error message with suggestion
 */
export function formatError(error: unknown): string {
  const parsed = parseError(error);
  return parsed.suggestion 
    ? `${parsed.message}\n\n💡 ${parsed.suggestion}`
    : parsed.message;
}

/**
 * Check if an error is recoverable (user can retry)
 */
export function isRecoverableError(error: unknown): boolean {
  const parsed = parseError(error);
  const nonRecoverable: ErrorCode[] = [
    'PLATFORM_NOT_SUPPORTED',
    'CANCELLED',
    'INTERNAL_ERROR',
  ];
  return !nonRecoverable.includes(parsed.code);
}

/**
 * Check if an error is a network-related error
 */
export function isNetworkError(error: unknown): boolean {
  const parsed = parseError(error);
  return parsed.code === 'NETWORK_ERROR' || parsed.code === 'DOWNLOAD_ERROR';
}

/**
 * Check if an error requires elevated permissions
 */
export function requiresElevation(error: unknown): boolean {
  const parsed = parseError(error);
  return parsed.code === 'PERMISSION_DENIED';
}
