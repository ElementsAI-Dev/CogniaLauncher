import type {
  ExternalCacheInfo,
  ExternalCachePathInfo,
} from '@/lib/tauri';
import type { CleanType } from '@/types/cache';

export type CacheMaintenanceMode =
  | 'preview_required'
  | 'direct_clean_only'
  | 'repair_first'
  | 'disabled';

export type CacheMaintenanceScopeKind =
  | 'internal'
  | 'default_downloads'
  | 'external'
  | 'custom';

export interface CleanTypeMaintenanceMetadata {
  scopeKind: Extract<CacheMaintenanceScopeKind, 'internal' | 'default_downloads'>;
  cleanupMode: Extract<CacheMaintenanceMode, 'preview_required' | 'repair_first'>;
  explanationKey: string;
  defaultDownloadsRoot?: string | null;
}

export interface ExternalCacheMaintenanceMetadata {
  scopeKind: Extract<CacheMaintenanceScopeKind, 'external' | 'custom'>;
  cleanupMode: Extract<CacheMaintenanceMode, 'direct_clean_only' | 'disabled'>;
  explanationKey: string;
  reason: string | null;
}

export function deriveCleanTypeMaintenanceMetadata(
  cleanType: CleanType,
  options?: {
    defaultDownloadsRoot?: string | null;
    repairFirst?: boolean;
  },
): CleanTypeMaintenanceMetadata {
  if (cleanType === 'default_downloads') {
    return {
      scopeKind: 'default_downloads',
      cleanupMode: 'preview_required',
      explanationKey: 'cache.defaultDownloadsSafetyNote',
      defaultDownloadsRoot: options?.defaultDownloadsRoot ?? null,
    };
  }

  return {
    scopeKind: 'internal',
    cleanupMode: options?.repairFirst ? 'repair_first' : 'preview_required',
    explanationKey: options?.repairFirst
      ? 'cache.cleanupRepairFirst'
      : 'cache.cleanupPreviewRequired',
  };
}

export function deriveExternalCacheMaintenanceMetadata(
  cache: ExternalCacheInfo,
  pathInfo?: ExternalCachePathInfo | null,
): ExternalCacheMaintenanceMetadata {
  const scopeKind: ExternalCacheMaintenanceMetadata['scopeKind'] =
    cache.scopeType === 'custom' || cache.isCustom
      ? 'custom'
      : 'external';

  const cleanupMode: ExternalCacheMaintenanceMetadata['cleanupMode'] =
    cache.cleanupMode === 'disabled' || !cache.canClean
      ? 'disabled'
      : 'direct_clean_only';

  if (cleanupMode === 'disabled') {
    return {
      scopeKind,
      cleanupMode,
      explanationKey:
        scopeKind === 'custom'
          ? 'cache.externalCleanupDisabledCustom'
          : 'cache.externalCleanupDisabled',
      reason: cache.detectionReason ?? pathInfo?.detectionReason ?? null,
    };
  }

  return {
    scopeKind,
    cleanupMode,
    explanationKey: pathInfo?.hasCleanCommand
      ? 'cache.externalCleanupDirectCommand'
      : 'cache.externalCleanupDirectOnly',
    reason: cache.detectionReason ?? pathInfo?.detectionReason ?? null,
  };
}
