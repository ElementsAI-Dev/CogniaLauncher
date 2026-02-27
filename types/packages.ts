import type {
  BatchResult,
  PackageComparison,
  PackageInfo,
  PackageSummary,
  InstalledPackage,
  ProviderInfo,
  UpdateInfo,
  SearchSuggestion,
  ResolutionResult,
  VersionInfo,
  InstallHistoryEntry,
} from './tauri';
import type { ExportedPackageList } from '@/hooks/use-package-export';

// ============================================================================
// Batch Operations
// ============================================================================

export type OperationType = 'install' | 'uninstall' | 'update';

export interface BatchOperationsProps {
  selectedPackages: string[];
  onBatchInstall: (
    packages: string[],
    options?: { dryRun?: boolean; force?: boolean },
  ) => Promise<BatchResult>;
  onBatchUninstall: (
    packages: string[],
    force?: boolean,
  ) => Promise<BatchResult>;
  onBatchUpdate: (packages?: string[]) => Promise<BatchResult>;
  onClearSelection: () => void;
}

// ============================================================================
// Dependency Tree
// ============================================================================

export interface DependencyTreeProps {
  packageId?: string;
  resolution?: ResolutionResult;
  loading: boolean;
  onResolve: (packageId: string) => Promise<ResolutionResult>;
}

// ============================================================================
// Export / Import
// ============================================================================

export interface ExportImportDialogProps {
  trigger?: React.ReactNode;
  onImport?: (data: ExportedPackageList) => Promise<void>;
}

// ============================================================================
// Installed Filter
// ============================================================================

export interface InstalledFilterState {
  query: string;
  provider: string | null;
}

export interface InstalledFilterBarProps {
  packages: InstalledPackage[];
  providers: ProviderInfo[];
  filter: InstalledFilterState;
  onFilterChange: (filter: InstalledFilterState) => void;
}

// ============================================================================
// Package Comparison
// ============================================================================

export interface ComparisonFeatureKey {
  nameKey: string;
  key: string;
  type: 'boolean' | 'string' | 'array' | 'size';
}

export interface PackageComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageIds: string[];
  onCompare: (packageIds: string[]) => Promise<PackageComparison>;
}

// ============================================================================
// Package Details Dialog
// ============================================================================

export interface PackageDetailsDialogProps {
  pkg: PackageSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall: (name: string, version?: string) => Promise<void>;
  onRollback?: (name: string, version: string) => Promise<void>;
  onPin?: (name: string, version: string) => Promise<void>;
  fetchPackageInfo: (
    name: string,
    provider?: string,
  ) => Promise<PackageInfo | null>;
  isInstalled?: boolean;
  currentVersion?: string;
}

// ============================================================================
// Package List
// ============================================================================

export interface PackageListProps {
  packages: (PackageSummary | InstalledPackage)[];
  type: 'search' | 'installed';
  installing?: string[];
  pinnedPackages?: string[];
  bookmarkedPackages?: string[];
  onInstall?: (name: string) => void;
  onUninstall?: (name: string) => void;
  onSelect?: (pkg: PackageSummary | InstalledPackage) => void;
  onPin?: (name: string) => void;
  onUnpin?: (name: string) => void;
  onBookmark?: (name: string) => void;
  selectable?: boolean;
  showSelectAll?: boolean;
}

// ============================================================================
// Provider Status Badge
// ============================================================================

export interface ProviderStatusBadgeProps {
  providers: ProviderInfo[];
  onProviderToggle?: (providerId: string, enabled: boolean) => void;
  onRefresh?: () => void;
}

// ============================================================================
// Search Bar
// ============================================================================

export interface SearchBarProps {
  providers: ProviderInfo[];
  onSearch: (
    query: string,
    options: {
      providers?: string[];
      installedOnly?: boolean;
      notInstalled?: boolean;
      hasUpdates?: boolean;
      sortBy?: string;
    },
  ) => void;
  onGetSuggestions: (query: string) => Promise<SearchSuggestion[]>;
  loading?: boolean;
}

// ============================================================================
// Stats Overview
// ============================================================================

export interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subLabel?: string;
  variant?: 'default' | 'success' | 'warning' | 'info';
}

export interface StatsOverviewProps {
  installedPackages: InstalledPackage[];
  providers: ProviderInfo[];
  updates: UpdateInfo[];
  pinnedCount: number;
  bookmarkedCount: number;
  defaultExpanded?: boolean;
}

// ============================================================================
// Update Manager
// ============================================================================

/**
 * Extended UpdateInfo with UI-specific fields for the update manager.
 * Extends the base UpdateInfo from tauri with additional metadata.
 */
export interface PackageUpdateInfo extends UpdateInfo {
  package_id: string;
  is_pinned: boolean;
  is_breaking: boolean;
  change_type: 'major' | 'minor' | 'patch' | 'unknown';
  changelog_url?: string;
}

export interface UpdateManagerProps {
  updates: PackageUpdateInfo[];
  loading: boolean;
  onCheckUpdates: () => Promise<void>;
  onUpdateSelected: (packageIds: string[]) => Promise<BatchResult>;
  onUpdateAll: () => Promise<BatchResult>;
  onPinPackage: (packageId: string) => Promise<void>;
  onUnpinPackage: (packageId: string) => Promise<void>;
}

// ============================================================================
// Detail: Package Detail Page
// ============================================================================

export interface PackageDetailPageProps {
  packageName: string;
  providerId?: string;
}

// ============================================================================
// Detail: Package Overview Card
// ============================================================================

export interface PackageOverviewCardProps {
  packageInfo: PackageInfo | null;
  installedPkg: InstalledPackage | null;
  isInstalled: boolean;
  isPinned: boolean;
  isBookmarked: boolean;
  isInstalling: boolean;
  hasUpdate: boolean;
  latestVersion: string | null;
  onInstall: (version?: string) => Promise<void>;
  onUninstall: () => Promise<void>;
  onPin: () => Promise<void>;
  onUnpin: () => Promise<void>;
  onBookmark: () => void;
  onRollback: (version: string) => Promise<void>;
}

// ============================================================================
// Detail: Package Version List
// ============================================================================

export interface PackageVersionListProps {
  versions: VersionInfo[];
  currentVersion: string | null;
  isInstalled: boolean;
  isInstalling: boolean;
  onInstall: (version: string) => Promise<void>;
  onRollback: (version: string) => Promise<void>;
}

// ============================================================================
// Detail: Package Dependency View
// ============================================================================

export interface PackageDependencyViewProps {
  resolution: ResolutionResult | null;
  loading: boolean;
  onResolve: () => Promise<void>;
}

// ============================================================================
// Detail: Package History List
// ============================================================================

export interface PackageHistoryListProps {
  history: InstallHistoryEntry[];
  loading: boolean;
}
