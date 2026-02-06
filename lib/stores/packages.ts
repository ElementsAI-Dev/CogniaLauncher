import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PackageSummary, PackageInfo, InstalledPackage, ProviderInfo, UpdateInfo, UpdateCheckProgress, UpdateCheckError, SearchFacets } from '../tauri';

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
  isCheckingUpdates: boolean;
  lastUpdateCheck: number | null;

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
  addPinnedPackage: (name: string) => void;
  removePinnedPackage: (name: string) => void;
  togglePackageSelection: (name: string) => void;
  clearPackageSelection: () => void;
  selectAllPackages: (names: string[]) => void;
  setSearchMeta: (meta: SearchMeta | null) => void;
  toggleBookmark: (name: string) => void;
  setUpdateCheckProgress: (progress: UpdateCheckProgress | null) => void;
  setUpdateCheckErrors: (errors: UpdateCheckError[]) => void;
  setIsCheckingUpdates: (checking: boolean) => void;
  setLastUpdateCheck: (timestamp: number | null) => void;
}

export const usePackageStore = create<PackageState>()(
  persist(
    (set) => ({
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
      isCheckingUpdates: false,
      lastUpdateCheck: null,

      setSearchResults: (searchResults) => set({ searchResults }),
      setInstalledPackages: (installedPackages) => set({ installedPackages }),
      setSelectedPackage: (selectedPackage) => set({ selectedPackage }),
      setProviders: (providers) => set({ providers }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSelectedProvider: (selectedProvider) => set({ selectedProvider }),
      setLoading: (loading) => set({ loading }),
      addInstalling: (name) => set((state) => ({ installing: [...state.installing, name] })),
      removeInstalling: (name) => set((state) => ({ installing: state.installing.filter((n) => n !== name) })),
      setError: (error) => set({ error }),
      setAvailableUpdates: (availableUpdates) => set({ availableUpdates }),
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
      toggleBookmark: (name) => set((state) => ({
        bookmarkedPackages: state.bookmarkedPackages.includes(name)
          ? state.bookmarkedPackages.filter((n) => n !== name)
          : [...state.bookmarkedPackages, name]
      })),
      setUpdateCheckProgress: (updateCheckProgress) => set({ updateCheckProgress }),
      setUpdateCheckErrors: (updateCheckErrors) => set({ updateCheckErrors }),
      setIsCheckingUpdates: (isCheckingUpdates) => set({ isCheckingUpdates }),
      setLastUpdateCheck: (lastUpdateCheck) => set({ lastUpdateCheck }),
    }),
    {
      name: 'cognia-packages',
      partialize: (state) => ({
        pinnedPackages: state.pinnedPackages,
        selectedProvider: state.selectedProvider,
        searchQuery: state.searchQuery,
        bookmarkedPackages: state.bookmarkedPackages,
      }),
    }
  )
);
