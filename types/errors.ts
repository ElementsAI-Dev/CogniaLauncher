/**
 * Error types for CogniaLauncher
 * Extracted from lib/errors.ts for better code organization
 */

/** Error codes mapped from backend CogniaError variants */
export type ErrorCode =
  | 'CONFIG_ERROR'
  | 'PROVIDER_ERROR'
  | 'PROVIDER_NOT_FOUND'
  | 'PACKAGE_NOT_FOUND'
  | 'VERSION_NOT_FOUND'
  | 'VERSION_NOT_INSTALLED'
  | 'RESOLUTION_ERROR'
  | 'CONFLICT_ERROR'
  | 'INSTALLATION_ERROR'
  | 'CHECKSUM_MISMATCH'
  | 'DOWNLOAD_ERROR'
  | 'NETWORK_ERROR'
  | 'IO_ERROR'
  | 'DATABASE_ERROR'
  | 'PARSE_ERROR'
  | 'PLATFORM_NOT_SUPPORTED'
  | 'PERMISSION_DENIED'
  | 'CANCELLED'
  | 'INTERNAL_ERROR'
  | 'UNKNOWN_ERROR';

export interface CogniaError {
  code: ErrorCode;
  message: string;
  suggestion?: string;
  details?: string;
}
