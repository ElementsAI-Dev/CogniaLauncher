import { usePackageStore } from './packages';

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
      bookmarkedPackages: [],
      updateCheckProgress: null,
      updateCheckErrors: [],
      isCheckingUpdates: false,
      lastUpdateCheck: null,
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

  describe('bookmarked packages', () => {
    it('should toggle bookmark on', () => {
      usePackageStore.getState().toggleBookmark('lodash');
      expect(usePackageStore.getState().bookmarkedPackages).toContain('lodash');
    });

    it('should toggle bookmark off', () => {
      usePackageStore.getState().toggleBookmark('lodash');
      usePackageStore.getState().toggleBookmark('lodash');
      expect(usePackageStore.getState().bookmarkedPackages).not.toContain('lodash');
    });

    it('should handle multiple bookmarks', () => {
      usePackageStore.getState().toggleBookmark('lodash');
      usePackageStore.getState().toggleBookmark('express');
      expect(usePackageStore.getState().bookmarkedPackages).toEqual(['lodash', 'express']);
    });
  });

  describe('search meta', () => {
    it('should set search meta', () => {
      const meta = { total: 100, page: 1, pageSize: 20, facets: { providers: { npm: 50 }, licenses: { MIT: 30 } } };
      usePackageStore.getState().setSearchMeta(meta);
      expect(usePackageStore.getState().searchMeta).toEqual(meta);
    });

    it('should clear search meta', () => {
      usePackageStore.getState().setSearchMeta({ total: 100, page: 1, pageSize: 20, facets: { providers: {}, licenses: {} } });
      usePackageStore.getState().setSearchMeta(null);
      expect(usePackageStore.getState().searchMeta).toBeNull();
    });
  });

  describe('update check state', () => {
    it('should set update check progress', () => {
      const progress = { phase: 'checking', current: 5, total: 10, current_package: 'lodash', current_provider: 'npm', found_updates: 2, errors: 0 };
      usePackageStore.getState().setUpdateCheckProgress(progress);
      expect(usePackageStore.getState().updateCheckProgress).toEqual(progress);
    });

    it('should clear update check progress', () => {
      usePackageStore.getState().setUpdateCheckProgress({ phase: 'checking', current: 5, total: 10, current_package: 'lodash', current_provider: 'npm', found_updates: 2, errors: 0 });
      usePackageStore.getState().setUpdateCheckProgress(null);
      expect(usePackageStore.getState().updateCheckProgress).toBeNull();
    });

    it('should set update check errors', () => {
      const errors = [{ provider: 'npm', package: null, message: 'Network error' }];
      usePackageStore.getState().setUpdateCheckErrors(errors);
      expect(usePackageStore.getState().updateCheckErrors).toEqual(errors);
    });

    it('should set isCheckingUpdates', () => {
      usePackageStore.getState().setIsCheckingUpdates(true);
      expect(usePackageStore.getState().isCheckingUpdates).toBe(true);

      usePackageStore.getState().setIsCheckingUpdates(false);
      expect(usePackageStore.getState().isCheckingUpdates).toBe(false);
    });

    it('should set lastUpdateCheck', () => {
      const now = Date.now();
      usePackageStore.getState().setLastUpdateCheck(now);
      expect(usePackageStore.getState().lastUpdateCheck).toBe(now);
    });

    it('should clear lastUpdateCheck', () => {
      usePackageStore.getState().setLastUpdateCheck(Date.now());
      usePackageStore.getState().setLastUpdateCheck(null);
      expect(usePackageStore.getState().lastUpdateCheck).toBeNull();
    });
  });
});
