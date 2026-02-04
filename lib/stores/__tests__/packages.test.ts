import { usePackageStore } from '../packages';

describe('usePackageStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    usePackageStore.setState({
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
    });
  });

  describe('searchResults', () => {
    it('should set search results', () => {
      const mockResults = [
        { name: 'lodash', description: 'Utility library', latest_version: '4.17.21', provider: 'npm' },
      ];

      usePackageStore.getState().setSearchResults(mockResults);
      expect(usePackageStore.getState().searchResults).toEqual(mockResults);
    });
  });

  describe('installedPackages', () => {
    it('should set installed packages', () => {
      const mockInstalled = [
        { name: 'lodash', version: '4.17.21', provider: 'npm', install_path: '/usr/local', installed_at: '2024-01-01', is_global: true },
      ];

      usePackageStore.getState().setInstalledPackages(mockInstalled);
      expect(usePackageStore.getState().installedPackages).toEqual(mockInstalled);
    });
  });

  describe('selectedPackage', () => {
    it('should set selected package', () => {
      const mockPackage = {
        name: 'lodash',
        display_name: 'Lodash',
        description: 'A modern JavaScript utility library',
        homepage: 'https://lodash.com',
        license: 'MIT',
        repository: 'https://github.com/lodash/lodash',
        versions: [],
        provider: 'npm',
      };

      usePackageStore.getState().setSelectedPackage(mockPackage);
      expect(usePackageStore.getState().selectedPackage).toEqual(mockPackage);
    });

    it('should clear selected package', () => {
      usePackageStore.getState().setSelectedPackage(null);
      expect(usePackageStore.getState().selectedPackage).toBeNull();
    });
  });

  describe('loading state', () => {
    it('should set loading state', () => {
      usePackageStore.getState().setLoading(true);
      expect(usePackageStore.getState().loading).toBe(true);

      usePackageStore.getState().setLoading(false);
      expect(usePackageStore.getState().loading).toBe(false);
    });
  });

  describe('installing packages', () => {
    it('should add package to installing list', () => {
      usePackageStore.getState().addInstalling('lodash');
      expect(usePackageStore.getState().installing).toContain('lodash');
    });

    it('should remove package from installing list', () => {
      usePackageStore.getState().addInstalling('lodash');
      usePackageStore.getState().removeInstalling('lodash');
      expect(usePackageStore.getState().installing).not.toContain('lodash');
    });
  });

  describe('error handling', () => {
    it('should set error message', () => {
      usePackageStore.getState().setError('Network error');
      expect(usePackageStore.getState().error).toBe('Network error');
    });

    it('should clear error message', () => {
      usePackageStore.getState().setError('Error');
      usePackageStore.getState().setError(null);
      expect(usePackageStore.getState().error).toBeNull();
    });
  });

  describe('pinned packages', () => {
    it('should add pinned package', () => {
      usePackageStore.getState().addPinnedPackage('lodash');
      expect(usePackageStore.getState().pinnedPackages).toContain('lodash');
    });

    it('should not add duplicate pinned package', () => {
      usePackageStore.getState().addPinnedPackage('lodash');
      usePackageStore.getState().addPinnedPackage('lodash');
      expect(usePackageStore.getState().pinnedPackages.filter(p => p === 'lodash').length).toBe(1);
    });

    it('should remove pinned package', () => {
      usePackageStore.getState().addPinnedPackage('lodash');
      usePackageStore.getState().removePinnedPackage('lodash');
      expect(usePackageStore.getState().pinnedPackages).not.toContain('lodash');
    });
  });

  describe('package selection', () => {
    it('should toggle package selection', () => {
      usePackageStore.getState().togglePackageSelection('lodash');
      expect(usePackageStore.getState().selectedPackages).toContain('lodash');

      usePackageStore.getState().togglePackageSelection('lodash');
      expect(usePackageStore.getState().selectedPackages).not.toContain('lodash');
    });

    it('should select all packages', () => {
      usePackageStore.getState().selectAllPackages(['lodash', 'express', 'react']);
      expect(usePackageStore.getState().selectedPackages).toEqual(['lodash', 'express', 'react']);
    });

    it('should clear package selection', () => {
      usePackageStore.getState().selectAllPackages(['lodash', 'express']);
      usePackageStore.getState().clearPackageSelection();
      expect(usePackageStore.getState().selectedPackages).toEqual([]);
    });
  });

  describe('providers', () => {
    it('should set providers', () => {
      const mockProviders = [
        {
          id: 'npm',
          display_name: 'npm',
          capabilities: ['install'],
          platforms: ['windows'],
          priority: 100,
          is_environment_provider: false,
          enabled: true,
        },
      ];

      usePackageStore.getState().setProviders(mockProviders);
      expect(usePackageStore.getState().providers).toEqual(mockProviders);
    });

    it('should set selected provider', () => {
      usePackageStore.getState().setSelectedProvider('npm');
      expect(usePackageStore.getState().selectedProvider).toBe('npm');
    });
  });

  describe('search query', () => {
    it('should set search query', () => {
      usePackageStore.getState().setSearchQuery('lodash');
      expect(usePackageStore.getState().searchQuery).toBe('lodash');
    });
  });

  describe('available updates', () => {
    it('should set available updates', () => {
      const mockUpdates = [
        { name: 'lodash', current_version: '4.17.20', latest_version: '4.17.21', provider: 'npm' },
      ];

      usePackageStore.getState().setAvailableUpdates(mockUpdates);
      expect(usePackageStore.getState().availableUpdates).toEqual(mockUpdates);
    });
  });
});
