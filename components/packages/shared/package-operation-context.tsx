"use client";

import {
  createContext,
  useContext,
  type ReactNode,
  type RefObject,
} from "react";
import type {
  BatchResult,
  InstalledPackage,
  PackagePreflightSummary,
  PackageSummary,
  ProviderInfo,
  SearchFacets,
  SearchSuggestion,
  UpdateInfo,
} from "@/lib/tauri";

export type PackageOperationMode = "full" | "environment" | "provider";

export interface PackageOperationTabDefinition {
  id: string;
  label: string;
  content: ReactNode;
}

export type PackageOperationDefaultTab =
  | "installed"
  | "search"
  | "updates"
  | "dependencies"
  | "history";

export interface PackageOperationFeatures {
  installed?: boolean;
  search?: boolean;
  updates?: boolean;
  dependencies?: boolean;
  history?: boolean;
  batch?: boolean;
  stats?: boolean;
  providerStatus?: boolean;
  exportImport?: boolean;
  bookmarks?: boolean;
  pinning?: boolean;
  installedFilter?: boolean;
}

export interface PackageSearchMeta {
  total: number;
  page: number;
  pageSize: number;
  facets: SearchFacets;
}

export interface PackageOperationContextValue {
  mode: PackageOperationMode;
  features?: PackageOperationFeatures;
  providers: ProviderInfo[];
  installedPackages: InstalledPackage[];
  searchResults: PackageSummary[];
  availableUpdates?: UpdateInfo[];
  selectedPackages?: string[];
  installing?: string[];
  pinnedPackages?: string[];
  bookmarkedPackages?: string[];
  loading?: boolean;
  error?: string | null;
  searchMeta?: PackageSearchMeta | null;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  activeSearchRequest?: {
    query: string;
    providers?: string[];
    filterCount?: number;
    sortBy?: string;
  } | null;
  headerActions?: ReactNode;
  topContent?: ReactNode;
  bottomContent?: ReactNode;
  extraTabs?: PackageOperationTabDefinition[];
  tabContentOverrides?: Partial<Record<PackageOperationDefaultTab, ReactNode>>;
  preflightSummary?: PackagePreflightSummary | null;
  preflightPackages?: string[];
  isPreflightOpen?: boolean;
  onSearch: (
    query: string,
    options: {
      providers?: string[];
      installedOnly?: boolean;
      notInstalled?: boolean;
      hasUpdates?: boolean;
      license?: string[];
      minVersion?: string;
      maxVersion?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
      limit?: number;
      offset?: number;
    },
  ) => void | Promise<void>;
  onSearchPageChange?: (page: number) => void | Promise<void>;
  onGetSuggestions: (query: string) => Promise<SearchSuggestion[]>;
  onInstall?: (name: string) => void | Promise<void>;
  onUninstall?: (name: string) => void | Promise<void>;
  onSelect?: (pkg: PackageSummary | InstalledPackage) => void;
  onResolveDependencies?: (
    pkg: PackageSummary | InstalledPackage,
    source: "search" | "installed",
  ) => void;
  onPin?: (name: string, version?: string, provider?: string) => void | Promise<void>;
  onUnpin?: (name: string, provider?: string) => void | Promise<void>;
  onRollback?: (name: string, version?: string, provider?: string) => void | Promise<void>;
  onBookmark?: (name: string, provider?: string) => void;
  onUpdateSelected?: (packageIds: string[]) => Promise<BatchResult>;
  onUpdateAll?: () => Promise<BatchResult>;
  onCheckUpdates?: () => Promise<void>;
  onBatchInstall?: (
    packages: string[],
    options?: {
      dryRun?: boolean;
      force?: boolean;
      parallel?: boolean;
      global?: boolean;
    },
  ) => Promise<BatchResult>;
  onBatchUninstall?: (
    packages: string[],
    force?: boolean,
  ) => Promise<BatchResult>;
  onBatchUpdate?: (packages?: string[]) => Promise<BatchResult>;
  onClearSelection?: () => void;
  onConfirmPreflight?: () => void;
  onDismissPreflight?: () => void;
}

const PackageOperationContext = createContext<PackageOperationContextValue | null>(
  null,
);

export function resolvePackageOperationFeatures(
  mode: PackageOperationMode,
  overrides?: PackageOperationFeatures,
): Required<PackageOperationFeatures> {
  const defaults: Record<PackageOperationMode, Required<PackageOperationFeatures>> = {
    full: {
      installed: true,
      search: true,
      updates: true,
      dependencies: true,
      history: true,
      batch: true,
      stats: true,
      providerStatus: true,
      exportImport: true,
      bookmarks: true,
      pinning: true,
      installedFilter: true,
    },
    environment: {
      installed: true,
      search: true,
      updates: true,
      dependencies: false,
      history: false,
      batch: false,
      stats: false,
      providerStatus: false,
      exportImport: false,
      bookmarks: false,
      pinning: false,
      installedFilter: false,
    },
    provider: {
      installed: true,
      search: true,
      updates: true,
      dependencies: false,
      history: false,
      batch: true,
      stats: false,
      providerStatus: false,
      exportImport: false,
      bookmarks: false,
      pinning: true,
      installedFilter: true,
    },
  };

  return {
    ...defaults[mode],
    ...overrides,
  };
}

export function PackageOperationProvider({
  value,
  children,
}: {
  value: PackageOperationContextValue;
  children: ReactNode;
}) {
  return (
    <PackageOperationContext.Provider value={value}>
      {children}
    </PackageOperationContext.Provider>
  );
}

export function usePackageOperationContext() {
  const context = useContext(PackageOperationContext);
  if (!context) {
    throw new Error(
      "usePackageOperationContext must be used within PackageOperationProvider",
    );
  }
  return context;
}
