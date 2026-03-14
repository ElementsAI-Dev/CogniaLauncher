import type {
  SelfUpdateErrorCategory,
  SelfUpdateInfo,
  SelfUpdateProgressEvent,
} from '@/lib/tauri';
import type { UpdateErrorCategory, UpdateStatus } from '@/types/about';

export interface NormalizedSelfUpdateInfo extends SelfUpdateInfo {
  latest_version: string;
  selected_source: SelfUpdateInfo['selected_source'];
  attempted_sources: NonNullable<SelfUpdateInfo['attempted_sources']>;
  error_category: SelfUpdateErrorCategory | null;
  error_message: string | null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.toLowerCase();
  }
  return String(error).toLowerCase();
}

export function mapSelfUpdateErrorCategory(
  category: SelfUpdateErrorCategory | null | undefined,
): UpdateErrorCategory | null {
  switch (category) {
    case 'source_unavailable':
      return 'source_unavailable_error';
    case 'network':
      return 'network_error';
    case 'timeout':
      return 'timeout_error';
    case 'validation':
      return 'validation_error';
    case 'signature':
      return 'signature_error';
    case 'no_update':
      return 'update_check_failed';
    case 'unknown':
      return 'unknown_error';
    default:
      return null;
  }
}

function parseBackendErrorCategory(error: unknown): SelfUpdateErrorCategory | null {
  if (!error) return null;

  if (typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const rawCategory = record.error_category ?? record.errorCategory;
    if (
      rawCategory === 'source_unavailable' ||
      rawCategory === 'network' ||
      rawCategory === 'timeout' ||
      rawCategory === 'validation' ||
      rawCategory === 'signature' ||
      rawCategory === 'no_update' ||
      rawCategory === 'unknown'
    ) {
      return rawCategory;
    }
  }

  const message = getErrorMessage(error);
  const leading = message.match(
    /^(source_unavailable|network|timeout|validation|signature|no_update|unknown)\b/,
  );
  if (leading) {
    return leading[1] as SelfUpdateErrorCategory;
  }

  const contains = message.match(
    /(source_unavailable|network|timeout|validation|signature|no_update|unknown)/,
  );
  if (contains) {
    return contains[1] as SelfUpdateErrorCategory;
  }

  return null;
}

export function categorizeUpdateError(error: unknown): UpdateErrorCategory {
  const backendCategory = parseBackendErrorCategory(error);
  const mapped = mapSelfUpdateErrorCategory(backendCategory);
  if (mapped) {
    return mapped;
  }

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
    selected_source: info.selected_source ?? null,
    attempted_sources: Array.isArray(info.attempted_sources)
      ? info.attempted_sources
      : [],
    error_category: info.error_category ?? null,
    error_message: info.error_message ?? null,
  };
}

export function deriveStatusFromUpdateInfo(
  info: SelfUpdateInfo | null,
): UpdateStatus {
  if (!info) return 'idle';
  if (info.error_category || info.error_message) return 'error';
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
