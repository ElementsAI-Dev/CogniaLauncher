import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  normalizeBookmarkedPackages,
  togglePackageBookmark,
} from '../packages';
import type {
  ConflictInfo,
  PackageSummary,
  PackageInfo,
  InstalledPackage,
  ProviderInfo,
  UpdateInfo,
  UpdateCheckProgress,
  UpdateCheckError,
  UpdateCheckProviderOutcome,
  UpdateCheckCoverage,
  SearchFacets,
} from '../tauri';

interface SearchMeta {
  total: number;
  page: number;
  pageSize: number;
  facets: SearchFacets;
}

interface PackageState {
  searchResults: PackageSummary[];
  installedPackages: InstalledPackage[];
  selectedPackage: PackageInfo | null;
  providers: ProviderInfo[];
  searchQuery: string;
  selectedProvider: string | null;
  loading: boolean;
  installing: string[];
  error: string | null;
  availableUpdates: UpdateInfo[];
  pinnedPackages: string[];
  selectedPackages: string[];
  searchMeta: SearchMeta | null;
  bookmarkedPackages: string[];
  updateCheckProgress: UpdateCheckProgress | null;
  updateCheckErrors: UpdateCheckError[];
  updateCheckProviderOutcomes: UpdateCheckProviderOutcome[];
  updateCheckCoverage: UpdateCheckCoverage | null;
  isCheckingUpdates: boolean;
  lastUpdateCheck: number | null;
  lastScanTimestamp: number | null;
  pendingConflicts: ConflictInfo[];
  resolvedVersions: Record<string, string>;

  setSearchResults: (results: PackageSummary[]) => void;
  setInstalledPackages: (packages: InstalledPackage[]) => void;
  setSelectedPackage: (pkg: PackageInfo | null) => void;
  setProviders: (providers: ProviderInfo[]) => void;
  setSearchQuery: (query: string) => void;
  setSelectedProvider: (provider: string | null) => void;
  setLoading: (loading: boolean) => void;
  addInstalling: (name: string) => void;
  removeInstalling: (name: string) => void;
  setError: (error: string | null) => void;
  setAvailableUpdates: (updates: UpdateInfo[]) => void;
  setPinnedPackages: (names: string[]) => void;
  addPinnedPackage: (name: string) => void;
  removePinnedPackage: (name: string) => void;
  togglePackageSelection: (name: string) => void;
  clearPackageSelection: () => void;
  selectAllPackages: (names: string[]) => void;
  setSearchMeta: (meta: SearchMeta | null) => void;
  toggleBookmark: (name: string, provider?: string | null) => void;
  restoreBookmarks: (
    bookmarks: string[],
    packageContexts?: Array<{ name: string; provider?: string | null }>,
  ) => void;
  setUpdateCheckProgress: (progress: UpdateCheckProgress | null) => void;
  setUpdateCheckErrors: (errors: UpdateCheckError[]) => void;
  setUpdateCheckProviderOutcomes: (outcomes: UpdateCheckProviderOutcome[]) => void;
  setUpdateCheckCoverage: (coverage: UpdateCheckCoverage | null) => void;
  setIsCheckingUpdates: (checking: boolean) => void;
  setLastUpdateCheck: (timestamp: number | null) => void;
  setLastScanTimestamp: (timestamp: number | null) => void;
  setPendingConflicts: (conflicts: ConflictInfo[]) => void;
  clearPendingConflicts: () => void;
  setResolvedVersion: (packageName: string, version: string) => void;
  clearResolvedVersion: (packageName: string) => void;
  isScanFresh: () => boolean;
}

export const usePackageStore = create<PackageState>()(
  persist(
    (set, get) => ({
      searchResults: [],
      installedPackages: [],
      selectedPackage: null,
      providers: [],
      searchQuery: '',
      selectedProvider: null,
      loading: false,
      installing: [],
      error: null,
      availableUpdates: [],
      pinnedPackages: [],
      selectedPackages: [],
      searchMeta: null,
      bookmarkedPackages: [],
      updateCheckProgress: null,
      updateCheckErrors: [],
      updateCheckProviderOutcomes: [],
      updateCheckCoverage: null,
      isCheckingUpdates: false,
      lastUpdateCheck: null,
      lastScanTimestamp: null,
      pendingConflicts: [],
      resolvedVersions: {},

      setSearchResults: (searchResults) => set({ searchResults }),
      setInstalledPackages: (installedPackages) => set((state) => ({
        installedPackages,
        bookmarkedPackages: normalizeBookmarkedPackages(
          state.bookmarkedPackages,
          installedPackages,
        ),
      })),
      setSelectedPackage: (selectedPackage) => set({ selectedPackage }),
      setProviders: (providers) => set({ providers }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSelectedProvider: (selectedProvider) => set({ selectedProvider }),
      setLoading: (loading) => set({ loading }),
      addInstalling: (name) => set((state) => ({ installing: [...state.installing, name] })),
      removeInstalling: (name) => set((state) => ({ installing: state.installing.filter((n) => n !== name) })),
      setError: (error) => set({ error }),
      setAvailableUpdates: (availableUpdates) => set({ availableUpdates }),
      setPinnedPackages: (pinnedPackages) => set({ pinnedPackages }),
      addPinnedPackage: (name) => set((state) => ({ 
        pinnedPackages: state.pinnedPackages.includes(name) 
          ? state.pinnedPackages 
          : [...state.pinnedPackages, name] 
      })),
      removePinnedPackage: (name) => set((state) => ({ 
        pinnedPackages: state.pinnedPackages.filter((n) => n !== name) 
      })),
      togglePackageSelection: (name) => set((state) => ({
        selectedPackages: state.selectedPackages.includes(name)
          ? state.selectedPackages.filter((n) => n !== name)
          : [...state.selectedPackages, name]
      })),
      clearPackageSelection: () => set({ selectedPackages: [] }),
      selectAllPackages: (names) => set({ selectedPackages: names }),
      setSearchMeta: (searchMeta) => set({ searchMeta }),
      toggleBookmark: (name, provider) => set((state) => ({
        bookmarkedPackages: togglePackageBookmark(
          state.bookmarkedPackages,
          name,
          provider,
        ),
      })),
      restoreBookmarks: (bookmarks, packageContexts = []) => set((state) => ({
        bookmarkedPackages: normalizeBookmarkedPackages(
          [...state.bookmarkedPackages, ...bookmarks],
          [...state.installedPackages, ...packageContexts],
          { expandLegacyMatches: true },
        ),
      })),
      setUpdateCheckProgress: (updateCheckProgress) => set({ updateCheckProgress }),
      setUpdateCheckErrors: (updateCheckErrors) => set({ updateCheckErrors }),
      setUpdateCheckProviderOutcomes: (updateCheckProviderOutcomes) => set({ updateCheckProviderOutcomes }),
      setUpdateCheckCoverage: (updateCheckCoverage) => set({ updateCheckCoverage }),
      setIsCheckingUpdates: (isCheckingUpdates) => set({ isCheckingUpdates }),
      setLastUpdateCheck: (lastUpdateCheck) => set({ lastUpdateCheck }),
      setLastScanTimestamp: (lastScanTimestamp) => set({ lastScanTimestamp }),
      setPendingConflicts: (pendingConflicts) => set({ pendingConflicts }),
      clearPendingConflicts: () => set({ pendingConflicts: [] }),
      setResolvedVersion: (packageName, version) => set((state) => ({
        resolvedVersions: {
          ...state.resolvedVersions,
          [packageName]: version,
        },
      })),
      clearResolvedVersion: (packageName) => set((state) => {
        const next = { ...state.resolvedVersions };
        delete next[packageName];
        return { resolvedVersions: next };
      }),
      isScanFresh: () => {
        const ts = get().lastScanTimestamp;
        if (!ts) return false;
        return Date.now() - ts < 5 * 60 * 1000; // 5 minutes
      },
    }),
    {
      name: 'cognia-packages',
      version: 4,
      migrate: (persisted) => {
        const state = persisted as Partial<PackageState>;
        const installedPackages = Array.isArray(state.installedPackages)
          ? state.installedPackages
          : [];
        const bookmarkedPackages = Array.isArray(state.bookmarkedPackages)
          ? state.bookmarkedPackages
          : [];

        return {
          selectedProvider: typeof state.selectedProvider === 'string' ? state.selectedProvider : null,
          searchQuery: typeof state.searchQuery === 'string' ? state.searchQuery : '',
          bookmarkedPackages: normalizeBookmarkedPackages(
            bookmarkedPackages,
            installedPackages,
          ),
          installedPackages,
          lastScanTimestamp: typeof state.lastScanTimestamp === 'number' ? state.lastScanTimestamp : null,
          pendingConflicts: Array.isArray(state.pendingConflicts) ? state.pendingConflicts : [],
          resolvedVersions:
            state.resolvedVersions && typeof state.resolvedVersions === 'object'
              ? state.resolvedVersions
              : {},
        };
      },
      partialize: (state) => ({
        selectedProvider: state.selectedProvider,
        searchQuery: state.searchQuery,
        bookmarkedPackages: state.bookmarkedPackages,
        installedPackages: state.installedPackages,
        lastScanTimestamp: state.lastScanTimestamp,
        pendingConflicts: state.pendingConflicts,
        resolvedVersions: state.resolvedVersions,
      }),
    }
  )
);
