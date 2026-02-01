import { create } from 'zustand';
import type { PackageSummary, PackageInfo, InstalledPackage, ProviderInfo, UpdateInfo, SearchFacets } from '../tauri';

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
}

export const usePackageStore = create<PackageState>((set) => ({
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
}));
