import type { ExternalCacheInfo } from '@/lib/tauri';

// ============================================================================
// Component Props Types
// ============================================================================

export interface CacheMigrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMigrationComplete?: () => void;
}

export interface CacheMonitorCardProps {
  refreshTrigger?: number;
  autoRefreshInterval?: number; // in seconds, 0 = disabled
}

export interface CachePathCardProps {
  refreshTrigger?: number;
  onPathChanged?: () => void;
}

export interface ExternalCacheSectionProps {
  useTrash: boolean;
  setUseTrash: (value: boolean) => void;
}

export interface CacheDetailPageClientProps {
  cacheType: string;
}

// ============================================================================
// Cache Page Types
// ============================================================================

export type CleanType = 'downloads' | 'metadata' | 'all';
export type OperationType = 'clean' | 'verify' | 'repair' | 'settings';

// ============================================================================
// Cache Category Grouping
// ============================================================================

export type CacheCategory = 'system' | 'devtools' | 'package_manager' | 'other';

export type GroupedCaches = Record<string, ExternalCacheInfo[]>;
