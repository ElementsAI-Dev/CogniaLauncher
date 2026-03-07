import type { SelfUpdateInfo, SelfUpdateProgressEvent } from '@/lib/tauri';
import type { UpdateErrorCategory, UpdateStatus } from '@/types/about';

export interface NormalizedSelfUpdateInfo extends SelfUpdateInfo {
  latest_version: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.toLowerCase();
  }
  return String(error).toLowerCase();
}

export function categorizeUpdateError(error: unknown): UpdateErrorCategory {
  const message = getErrorMessage(error);

  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('connection')
  ) {
    return 'network_error';
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'timeout_error';
  }
  if (message.includes('permission') || message.includes('denied')) {
    return 'permission_error';
  }
  if (message.includes('unsupported') || message.includes('not available')) {
    return 'unsupported_error';
  }
  return 'unknown_error';
}

export function normalizeSelfUpdateInfo(
  info: SelfUpdateInfo,
  fallbackVersion: string,
): NormalizedSelfUpdateInfo {
  const current = info.current_version || fallbackVersion;
  return {
    ...info,
    current_version: current,
    latest_version: info.latest_version || current,
  };
}

export function deriveStatusFromUpdateInfo(
  info: SelfUpdateInfo | null,
): UpdateStatus {
  if (!info) return 'idle';
  return info.update_available ? 'update_available' : 'up_to_date';
}

export function mapProgressToUpdateStatus(
  status: SelfUpdateProgressEvent['status'],
): UpdateStatus {
  switch (status) {
    case 'downloading':
      return 'downloading';
    case 'installing':
      return 'installing';
    case 'done':
      return 'done';
    case 'error':
      return 'error';
    default:
      return 'error';
  }
}

export function getStatusLabelKey(status: UpdateStatus): string {
  switch (status) {
    case 'checking':
      return 'about.checkForUpdates';
    case 'update_available':
      return 'about.updateAvailable';
    case 'up_to_date':
      return 'about.upToDate';
    case 'downloading':
      return 'about.downloading';
    case 'installing':
      return 'about.installing';
    case 'done':
      return 'about.updateStarted';
    case 'error':
      return 'about.updateCheckFailed';
    case 'idle':
    default:
      return 'about.updateDescription';
  }
}
