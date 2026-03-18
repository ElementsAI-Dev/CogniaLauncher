import { useEnvironmentStore, getLogicalEnvType, PROVIDER_ENV_TYPE_MAP } from './environment';

describe('useEnvironmentStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useEnvironmentStore.setState({
      environments: [],
      selectedEnv: null,
      detectedVersions: [],
      availableVersions: {},
      availableProviders: [],
      loading: false,
      error: null,
      envSettings: {},
      selectedProviders: {},
      workflowContext: null,
      workflowAction: null,
      currentInstallation: null,
      selectedVersions: [],
      addDialogOpen: false,
      progressDialogOpen: false,
      installationProgress: null,
      versionBrowserOpen: false,
      versionBrowserEnvType: null,
      detailsPanelOpen: false,
      detailsPanelEnvType: null,
      // Update check state
      updateCheckResults: {},
      lastEnvUpdateCheck: null,
      lastEnvScanTimestamp: null,
      // Search and filter state
      searchQuery: '',
      statusFilter: 'all',
      sortBy: 'name',
      viewMode: 'grid',
    });
  });

  describe('environments', () => {
    it('should set environments', () => {
      const mockEnvs = [
        { env_type: 'node', provider_id: 'fnm', provider: 'fnm', current_version: '20.10.0', installed_versions: [], available: true, total_size: 0, version_count: 0 },
      ];

      useEnvironmentStore.getState().setEnvironments(mockEnvs);
      expect(useEnvironmentStore.getState().environments).toEqual(mockEnvs);
    });

    it('should update existing environment', () => {
      const initialEnv = { env_type: 'node', provider_id: 'fnm', provider: 'fnm', current_version: '18.0.0', installed_versions: [], available: true, total_size: 0, version_count: 0 };
      const updatedEnv = { env_type: 'node', provider_id: 'fnm', provider: 'fnm', current_version: '20.10.0', installed_versions: [], available: true, total_size: 0, version_count: 0 };

      useEnvironmentStore.getState().setEnvironments([initialEnv]);
      useEnvironmentStore.getState().updateEnvironment(updatedEnv);

      const envs = useEnvironmentStore.getState().environments;
      expect(envs.length).toBe(1);
      expect(envs[0].current_version).toBe('20.10.0');
    });

    it('should add new environment if not exists', () => {
      const nodeEnv = { env_type: 'node', provider_id: 'fnm', provider: 'fnm', current_version: '20.10.0', installed_versions: [], available: true, total_size: 0, version_count: 0 };
      const pythonEnv = { env_type: 'python', provider_id: 'pyenv', provider: 'pyenv', current_version: '3.11.0', installed_versions: [], available: true, total_size: 0, version_count: 0 };

      useEnvironmentStore.getState().setEnvironments([nodeEnv]);
      useEnvironmentStore.getState().updateEnvironment(pythonEnv);

      expect(useEnvironmentStore.getState().environments.length).toBe(2);
    });

    it('retains multiple providers for the same env_type', () => {
      const cppMsvc = { env_type: 'cpp', provider_id: 'msvc', provider: 'MSVC', current_version: '19.40', installed_versions: [], available: true, total_size: 0, version_count: 0 };
      const cppMsys2 = { env_type: 'cpp', provider_id: 'msys2', provider: 'MSYS2', current_version: '13.2', installed_versions: [], available: true, total_size: 0, version_count: 0 };

      useEnvironmentStore.getState().setEnvironments([cppMsvc]);
      useEnvironmentStore.getState().updateEnvironment(cppMsys2);

      const envs = useEnvironmentStore.getState().environments;
      expect(envs).toHaveLength(2);
      expect(envs).toEqual(expect.arrayContaining([
        expect.objectContaining({ provider_id: 'msvc' }),
        expect.objectContaining({ provider_id: 'msys2' }),
      ]));
    });

    it('updates only matching provider row when env_type is shared', () => {
      const cppMsvc = { env_type: 'cpp', provider_id: 'msvc', provider: 'MSVC', current_version: '19.30', installed_versions: [], available: true, total_size: 0, version_count: 0 };
      const cppMsys2 = { env_type: 'cpp', provider_id: 'msys2', provider: 'MSYS2', current_version: '13.1', installed_versions: [], available: true, total_size: 0, version_count: 0 };
      const cppMsys2Updated = { ...cppMsys2, current_version: '13.2' };

      useEnvironmentStore.getState().setEnvironments([cppMsvc, cppMsys2]);
      useEnvironmentStore.getState().updateEnvironment(cppMsys2Updated);

      const envs = useEnvironmentStore.getState().environments;
      expect(envs.find((env) => env.provider_id === 'msvc')?.current_version).toBe('19.30');
      expect(envs.find((env) => env.provider_id === 'msys2')?.current_version).toBe('13.2');
    });
  });

  describe('selectedEnv', () => {
    it('should set selected environment', () => {
      useEnvironmentStore.getState().setSelectedEnv('node');
      expect(useEnvironmentStore.getState().selectedEnv).toBe('node');
    });

    it('should clear selected environment', () => {
      useEnvironmentStore.getState().setSelectedEnv(null);
      expect(useEnvironmentStore.getState().selectedEnv).toBeNull();
    });
  });

  describe('detectedVersions', () => {
    it('should set detected versions', () => {
      const mockDetected = [
        { env_type: 'node', version: '20.10.0', source: '.nvmrc', source_path: '/project/.nvmrc' },
      ];

      useEnvironmentStore.getState().setDetectedVersions(mockDetected);
      expect(useEnvironmentStore.getState().detectedVersions).toEqual(mockDetected);
    });
  });

  describe('availableVersions', () => {
    it('should set available versions for environment type', () => {
      const mockVersions = [
        { version: '20.10.0', release_date: '2023-11-22', deprecated: false, yanked: false },
        { version: '18.19.0', release_date: '2023-11-29', deprecated: false, yanked: false },
      ];

      useEnvironmentStore.getState().setAvailableVersions('node', mockVersions);
      expect(useEnvironmentStore.getState().availableVersions.node).toEqual(mockVersions);
    });

    it('should preserve versions for other environment types', () => {
      const nodeVersions = [{ version: '20.10.0', release_date: null, deprecated: false, yanked: false }];
      const pythonVersions = [{ version: '3.11.0', release_date: null, deprecated: false, yanked: false }];

      useEnvironmentStore.getState().setAvailableVersions('node', nodeVersions);
      useEnvironmentStore.getState().setAvailableVersions('python', pythonVersions);

      expect(useEnvironmentStore.getState().availableVersions.node).toEqual(nodeVersions);
      expect(useEnvironmentStore.getState().availableVersions.python).toEqual(pythonVersions);
    });
  });

  describe('loading and error', () => {
    it('should set loading state', () => {
      useEnvironmentStore.getState().setLoading(true);
      expect(useEnvironmentStore.getState().loading).toBe(true);

      useEnvironmentStore.getState().setLoading(false);
      expect(useEnvironmentStore.getState().loading).toBe(false);
    });

    it('should set error message', () => {
      useEnvironmentStore.getState().setError('Network error');
      expect(useEnvironmentStore.getState().error).toBe('Network error');
    });

    it('should clear error message', () => {
      useEnvironmentStore.getState().setError('Error');
      useEnvironmentStore.getState().setError(null);
      expect(useEnvironmentStore.getState().error).toBeNull();
    });
  });

  describe('envSettings persistence', () => {
    it('should get default env settings', () => {
      const settings = useEnvironmentStore.getState().getEnvSettings('node');
      expect(settings.envVariables).toEqual([]);
      expect(settings.autoSwitch).toBe(false);
      expect(settings.detectionFiles).toBeDefined();
    });

    it('resolves provider-id keyed settings via logical env type', () => {
      const legacySettings = {
        envVariables: [{ key: 'NODE_ENV', value: 'legacy', enabled: true }],
        detectionFiles: [{ fileName: '.nvmrc', enabled: true }],
        autoSwitch: true,
      };
      useEnvironmentStore.setState({
        envSettings: { fnm: legacySettings },
      });

      expect(useEnvironmentStore.getState().getEnvSettings('node')).toEqual(legacySettings);
    });

    it('should add environment variable', () => {
      useEnvironmentStore.getState().addEnvVariable('node', { key: 'NODE_ENV', value: 'production', enabled: true });
      
      const settings = useEnvironmentStore.getState().getEnvSettings('node');
      expect(settings.envVariables.length).toBe(1);
      expect(settings.envVariables[0].key).toBe('NODE_ENV');
    });

    it('should remove environment variable', () => {
      useEnvironmentStore.getState().addEnvVariable('node', { key: 'NODE_ENV', value: 'production', enabled: true });
      useEnvironmentStore.getState().removeEnvVariable('node', 'NODE_ENV');
      
      const settings = useEnvironmentStore.getState().getEnvSettings('node');
      expect(settings.envVariables.length).toBe(0);
    });

    it('should update environment variable', () => {
      useEnvironmentStore.getState().addEnvVariable('node', { key: 'NODE_ENV', value: 'development', enabled: true });
      useEnvironmentStore.getState().updateEnvVariable('node', 'NODE_ENV', { value: 'production' });
      
      const settings = useEnvironmentStore.getState().getEnvSettings('node');
      expect(settings.envVariables[0].value).toBe('production');
    });

    it('should set auto switch', () => {
      useEnvironmentStore.getState().setAutoSwitch('node', true);
      
      const settings = useEnvironmentStore.getState().getEnvSettings('node');
      expect(settings.autoSwitch).toBe(true);
    });

    it('should toggle detection file', () => {
      // First get default settings to ensure detection files exist
      const initialSettings = useEnvironmentStore.getState().getEnvSettings('node');
      const fileName = initialSettings.detectionFiles[0]?.fileName;
      
      if (fileName) {
        useEnvironmentStore.getState().toggleDetectionFile('node', fileName, false);
        
        const settings = useEnvironmentStore.getState().getEnvSettings('node');
        const file = settings.detectionFiles.find(f => f.fileName === fileName);
        expect(file?.enabled).toBe(false);
      }
    });
  });

  describe('currentInstallation', () => {
    it('should set current installation', () => {
      useEnvironmentStore.getState().setCurrentInstallation({ envType: 'node', version: '20.10.0' });
      expect(useEnvironmentStore.getState().currentInstallation).toEqual({ envType: 'node', version: '20.10.0' });
    });

    it('should clear current installation', () => {
      useEnvironmentStore.getState().setCurrentInstallation({ envType: 'node', version: '20.10.0' });
      useEnvironmentStore.getState().setCurrentInstallation(null);
      expect(useEnvironmentStore.getState().currentInstallation).toBeNull();
    });
  });

  describe('batch operations - selectedVersions', () => {
    it('should toggle version selection', () => {
      useEnvironmentStore.getState().toggleVersionSelection('node', '20.10.0');
      expect(useEnvironmentStore.getState().selectedVersions).toContainEqual({ envType: 'node', version: '20.10.0' });

      useEnvironmentStore.getState().toggleVersionSelection('node', '20.10.0');
      expect(useEnvironmentStore.getState().selectedVersions).not.toContainEqual({ envType: 'node', version: '20.10.0' });
    });

    it('should select all versions for an environment type', () => {
      useEnvironmentStore.getState().selectAllVersions('node', ['18.0.0', '20.0.0', '22.0.0']);
      
      const selected = useEnvironmentStore.getState().selectedVersions;
      expect(selected.length).toBe(3);
      expect(selected).toContainEqual({ envType: 'node', version: '18.0.0' });
      expect(selected).toContainEqual({ envType: 'node', version: '20.0.0' });
      expect(selected).toContainEqual({ envType: 'node', version: '22.0.0' });
    });

    it('should clear version selection', () => {
      useEnvironmentStore.getState().selectAllVersions('node', ['18.0.0', '20.0.0']);
      useEnvironmentStore.getState().clearVersionSelection();
      expect(useEnvironmentStore.getState().selectedVersions).toEqual([]);
    });

    it('should check if version is selected', () => {
      useEnvironmentStore.getState().toggleVersionSelection('node', '20.10.0');
      
      expect(useEnvironmentStore.getState().isVersionSelected('node', '20.10.0')).toBe(true);
      expect(useEnvironmentStore.getState().isVersionSelected('node', '18.0.0')).toBe(false);
    });

    it('should preserve selections from other environment types', () => {
      useEnvironmentStore.getState().toggleVersionSelection('node', '20.10.0');
      useEnvironmentStore.getState().toggleVersionSelection('python', '3.11.0');
      useEnvironmentStore.getState().selectAllVersions('node', ['18.0.0', '22.0.0']);
      
      const selected = useEnvironmentStore.getState().selectedVersions;
      expect(selected).toContainEqual({ envType: 'python', version: '3.11.0' });
      expect(selected).not.toContainEqual({ envType: 'node', version: '20.10.0' });
    });
  });

  describe('dialog actions', () => {
    it('should open and close add dialog', () => {
      useEnvironmentStore.getState().openAddDialog();
      expect(useEnvironmentStore.getState().addDialogOpen).toBe(true);

      useEnvironmentStore.getState().closeAddDialog();
      expect(useEnvironmentStore.getState().addDialogOpen).toBe(false);
    });

    it('should open progress dialog with progress', () => {
      const progress = {
        envType: 'node',
        version: '20.10.0',
        provider: 'fnm',
        step: 'downloading' as const,
        progress: 50,
      };

      useEnvironmentStore.getState().openProgressDialog(progress);
      expect(useEnvironmentStore.getState().progressDialogOpen).toBe(true);
      expect(useEnvironmentStore.getState().installationProgress).toEqual(progress);
    });

    it('should close progress dialog and clear progress', () => {
      useEnvironmentStore.getState().openProgressDialog({
        envType: 'node',
        version: '20.10.0',
        provider: 'fnm',
        step: 'downloading',
        progress: 50,
      });
      useEnvironmentStore.getState().closeProgressDialog();

      expect(useEnvironmentStore.getState().progressDialogOpen).toBe(false);
      expect(useEnvironmentStore.getState().installationProgress).toBeNull();
    });

    it('should update installation progress', () => {
      useEnvironmentStore.getState().openProgressDialog({
        envType: 'node',
        version: '20.10.0',
        provider: 'fnm',
        step: 'downloading',
        progress: 0,
      });

      useEnvironmentStore.getState().updateInstallationProgress({ progress: 75, step: 'extracting' });

      const progress = useEnvironmentStore.getState().installationProgress;
      expect(progress?.progress).toBe(75);
      expect(progress?.step).toBe('extracting');
    });
  });

  describe('panel actions', () => {
    it('should open and close version browser', () => {
      useEnvironmentStore.getState().openVersionBrowser('node');
      expect(useEnvironmentStore.getState().versionBrowserOpen).toBe(true);
      expect(useEnvironmentStore.getState().versionBrowserEnvType).toBe('node');

      useEnvironmentStore.getState().closeVersionBrowser();
      expect(useEnvironmentStore.getState().versionBrowserOpen).toBe(false);
      expect(useEnvironmentStore.getState().versionBrowserEnvType).toBeNull();
    });

    it('should open and close details panel', () => {
      useEnvironmentStore.getState().openDetailsPanel('python');
      expect(useEnvironmentStore.getState().detailsPanelOpen).toBe(true);
      expect(useEnvironmentStore.getState().detailsPanelEnvType).toBe('python');

      useEnvironmentStore.getState().closeDetailsPanel();
      expect(useEnvironmentStore.getState().detailsPanelOpen).toBe(false);
      expect(useEnvironmentStore.getState().detailsPanelEnvType).toBeNull();
    });
  });

  describe('update check actions', () => {
    it('should set update check result for a single env type', () => {
      const result = {
        envType: 'node',
        providerId: 'fnm',
        currentVersion: '20.10.0',
        latestVersion: '22.0.0',
        latestLts: '22.0.0',
        newerCount: 5,
        isOutdated: true,
      };
      useEnvironmentStore.getState().setUpdateCheckResult('node', result);
      expect(useEnvironmentStore.getState().updateCheckResults.node).toEqual(result);
    });

    it('should set all update check results at once', () => {
      const results = [
        { envType: 'node', providerId: 'fnm', currentVersion: '20.10.0', latestVersion: '22.0.0', latestLts: '22.0.0', newerCount: 5, isOutdated: true },
        { envType: 'python', providerId: 'pyenv', currentVersion: '3.11.0', latestVersion: '3.12.0', latestLts: '3.12.0', newerCount: 2, isOutdated: true },
      ];
      useEnvironmentStore.getState().setAllUpdateCheckResults(results);
      const state = useEnvironmentStore.getState().updateCheckResults;
      expect(state.node?.envType).toBe('node');
      expect(state.python?.envType).toBe('python');
      expect(Object.keys(state)).toHaveLength(2);
    });

    it('should overwrite previous results when setting all', () => {
      useEnvironmentStore.getState().setUpdateCheckResult('go', {
        envType: 'go', providerId: 'goenv', currentVersion: '1.21.0', latestVersion: '1.22.0', latestLts: '1.22.0', newerCount: 1, isOutdated: true,
      });
      useEnvironmentStore.getState().setAllUpdateCheckResults([
        { envType: 'node', providerId: 'fnm', currentVersion: '22.0.0', latestVersion: '22.0.0', latestLts: '22.0.0', newerCount: 0, isOutdated: false },
      ]);
      const state = useEnvironmentStore.getState().updateCheckResults;
      expect(state.go).toBeUndefined();
      expect(state.node).toBeDefined();
    });

    it('should set last env update check timestamp', () => {
      const now = Date.now();
      useEnvironmentStore.getState().setLastEnvUpdateCheck(now);
      expect(useEnvironmentStore.getState().lastEnvUpdateCheck).toBe(now);
    });

    it('should preserve update check results when updating other state', () => {
      useEnvironmentStore.getState().setUpdateCheckResult('node', {
        envType: 'node', providerId: 'fnm', currentVersion: '20.10.0', latestVersion: '22.0.0', latestLts: '22.0.0', newerCount: 5, isOutdated: true,
      });
      useEnvironmentStore.getState().setSearchQuery('python');
      expect(useEnvironmentStore.getState().updateCheckResults.node).toBeDefined();
    });
  });

  describe('search and filter actions', () => {
    it('should set search query', () => {
      useEnvironmentStore.getState().setSearchQuery('node');
      expect(useEnvironmentStore.getState().searchQuery).toBe('node');
    });

    it('should clear search query', () => {
      useEnvironmentStore.getState().setSearchQuery('node');
      useEnvironmentStore.getState().setSearchQuery('');
      expect(useEnvironmentStore.getState().searchQuery).toBe('');
    });

    it('should set status filter', () => {
      useEnvironmentStore.getState().setStatusFilter('available');
      expect(useEnvironmentStore.getState().statusFilter).toBe('available');

      useEnvironmentStore.getState().setStatusFilter('unavailable');
      expect(useEnvironmentStore.getState().statusFilter).toBe('unavailable');

      useEnvironmentStore.getState().setStatusFilter('all');
      expect(useEnvironmentStore.getState().statusFilter).toBe('all');
    });

    it('should set sort by', () => {
      useEnvironmentStore.getState().setSortBy('installed_count');
      expect(useEnvironmentStore.getState().sortBy).toBe('installed_count');

      useEnvironmentStore.getState().setSortBy('provider');
      expect(useEnvironmentStore.getState().sortBy).toBe('provider');

      useEnvironmentStore.getState().setSortBy('name');
      expect(useEnvironmentStore.getState().sortBy).toBe('name');
    });

    it('should clear all filters', () => {
      useEnvironmentStore.getState().setSearchQuery('python');
      useEnvironmentStore.getState().setStatusFilter('available');
      useEnvironmentStore.getState().setSortBy('provider');

      useEnvironmentStore.getState().clearFilters();

      expect(useEnvironmentStore.getState().searchQuery).toBe('');
      expect(useEnvironmentStore.getState().statusFilter).toBe('all');
      expect(useEnvironmentStore.getState().sortBy).toBe('name');
    });

    it('should preserve other state when updating filters', () => {
      const mockEnvs = [
        { env_type: 'node', provider_id: 'fnm', provider: 'fnm', current_version: '20.10.0', installed_versions: [], available: true, total_size: 0, version_count: 0 },
      ];
      useEnvironmentStore.getState().setEnvironments(mockEnvs);
      useEnvironmentStore.getState().setSearchQuery('node');

      expect(useEnvironmentStore.getState().environments).toEqual(mockEnvs);
      expect(useEnvironmentStore.getState().searchQuery).toBe('node');
    });

    it('should set view mode', () => {
      useEnvironmentStore.getState().setViewMode('list');
      expect(useEnvironmentStore.getState().viewMode).toBe('list');

      useEnvironmentStore.getState().setViewMode('grid');
      expect(useEnvironmentStore.getState().viewMode).toBe('grid');
    });
  });

  describe('setAvailableProviders', () => {
    it('should set available providers', () => {
      const providers = [
        { id: 'fnm', display_name: 'fnm', env_type: 'node', description: 'Fast Node Manager' },
      ];
      useEnvironmentStore.getState().setAvailableProviders(providers);
      expect(useEnvironmentStore.getState().availableProviders).toEqual(providers);
    });

    it('prunes incompatible persisted provider selections when provider list changes', () => {
      useEnvironmentStore.setState({
        selectedProviders: {
          node: 'fnm',
          python: 'pyenv',
        },
      });

      // Only keep python provider available; node selection should be dropped.
      useEnvironmentStore.getState().setAvailableProviders([
        { id: 'pyenv', display_name: 'pyenv', env_type: 'python', description: '' },
      ]);

      expect(useEnvironmentStore.getState().selectedProviders).toEqual({
        python: 'pyenv',
      });
    });
  });

  describe('provider selection', () => {
    it('keys provider selection by logical env type and normalizes provider id', () => {
      useEnvironmentStore.getState().setAvailableProviders([
        { id: 'fnm', display_name: 'fnm', env_type: 'node', description: '' },
      ]);

      useEnvironmentStore.getState().setSelectedProvider('fnm', 'FNM');

      expect(useEnvironmentStore.getState().selectedProviders).toEqual({
        node: 'fnm',
      });
    });

    it('clears provider selection by logical env type', () => {
      useEnvironmentStore.getState().setAvailableProviders([
        { id: 'fnm', display_name: 'fnm', env_type: 'node', description: '' },
      ]);
      useEnvironmentStore.getState().setSelectedProvider('node', 'fnm');
      expect(useEnvironmentStore.getState().selectedProviders.node).toBe('fnm');

      useEnvironmentStore.getState().clearSelectedProvider('node');
      expect(useEnvironmentStore.getState().selectedProviders.node).toBeUndefined();
    });

    it('resolves selected provider only when compatible, otherwise falls back deterministically', () => {
      useEnvironmentStore.getState().setAvailableProviders([
        { id: 'fnm', display_name: 'fnm', env_type: 'node', description: '' },
        { id: 'nvm', display_name: 'nvm', env_type: 'node', description: '' },
        { id: 'pyenv', display_name: 'pyenv', env_type: 'python', description: '' },
      ]);

      useEnvironmentStore.setState({
        selectedProviders: {
          node: 'missing-provider',
        },
      });

      // Incompatible selection should not win; fallbackProviderId is compatible, so it should win.
      expect(useEnvironmentStore.getState().getSelectedProvider('node', 'nvm')).toBe('nvm');

      // If fallback is also incompatible, the first matching provider wins.
      expect(useEnvironmentStore.getState().getSelectedProvider('node', 'not-a-provider')).toBe('fnm');
    });

    it('includes selectedProviders in persisted partial state (and excludes workflow-only state)', () => {
      useEnvironmentStore.getState().setAvailableProviders([
        { id: 'fnm', display_name: 'fnm', env_type: 'node', description: '' },
      ]);
      useEnvironmentStore.getState().setSelectedProvider('node', 'fnm');
      useEnvironmentStore.getState().setWorkflowContext({
        envType: 'node',
        origin: 'overview',
        updatedAt: Date.now(),
      });

      const storeAny = useEnvironmentStore as unknown as {
        persist?: { getOptions: () => { partialize: (state: unknown) => Record<string, unknown> } };
      };
      expect(storeAny.persist?.getOptions).toBeDefined();

      const partialize = storeAny.persist!.getOptions().partialize;
      const persisted = partialize(useEnvironmentStore.getState());
      expect(persisted.selectedProviders).toEqual({ node: 'fnm' });
      expect(persisted.workflowContext).toBeUndefined();
      expect(persisted.workflowAction).toBeUndefined();
    });
  });

  describe('workflow continuity', () => {
    it('writes workflow context and action without mutating provider selections', () => {
      useEnvironmentStore.setState({
        selectedProviders: { node: 'fnm' },
      });

      useEnvironmentStore.getState().setWorkflowContext({
        envType: 'node',
        origin: 'overview',
        returnHref: '/environments',
        projectPath: '/project',
        providerId: 'fnm',
        updatedAt: 123,
      });
      useEnvironmentStore.getState().setWorkflowAction({
        envType: 'node',
        action: 'refresh',
        status: 'running',
        providerId: 'fnm',
        projectPath: '/project',
        updatedAt: 456,
      });

      const state = useEnvironmentStore.getState();
      expect(state.workflowContext?.providerId).toBe('fnm');
      expect(state.workflowAction?.status).toBe('running');
      expect(state.selectedProviders).toEqual({ node: 'fnm' });

      useEnvironmentStore.getState().clearWorkflowContext();
      useEnvironmentStore.getState().clearWorkflowAction();
      expect(useEnvironmentStore.getState().workflowContext).toBeNull();
      expect(useEnvironmentStore.getState().workflowAction).toBeNull();
    });
  });

  describe('setEnvVariables', () => {
    it('should set env variables directly', () => {
      const vars = [
        { key: 'NODE_ENV', value: 'production', enabled: true },
        { key: 'PORT', value: '3000', enabled: false },
      ];
      useEnvironmentStore.getState().setEnvVariables('node', vars);
      const settings = useEnvironmentStore.getState().getEnvSettings('node');
      expect(settings.envVariables).toEqual(vars);
    });
  });

  describe('setEnvSettings', () => {
    it('should set entire env settings object', () => {
      const settings = {
        envVariables: [{ key: 'TEST', value: '1', enabled: true }],
        detectionFiles: [{ fileName: '.nvmrc', enabled: true }],
        autoSwitch: true,
      };
      useEnvironmentStore.getState().setEnvSettings('node', settings);
      expect(useEnvironmentStore.getState().getEnvSettings('node')).toEqual(settings);
    });

    it('normalizes provider-id writes to logical env settings key', () => {
      const settings = {
        envVariables: [{ key: 'NODE_ENV', value: 'production', enabled: true }],
        detectionFiles: [{ fileName: '.nvmrc', enabled: true }],
        autoSwitch: true,
      };

      useEnvironmentStore.getState().setEnvSettings('fnm', settings);

      const state = useEnvironmentStore.getState();
      expect(state.envSettings.node).toEqual(settings);
      expect(state.envSettings.fnm).toBeUndefined();
    });

    it('migrates legacy provider-id key when updating logical env settings', () => {
      useEnvironmentStore.setState({
        envSettings: {
          fnm: {
            envVariables: [],
            detectionFiles: [{ fileName: '.nvmrc', enabled: true }],
            autoSwitch: false,
          },
        },
      });

      useEnvironmentStore.getState().setAutoSwitch('node', true);

      const state = useEnvironmentStore.getState();
      expect(state.envSettings.node?.autoSwitch).toBe(true);
      expect(state.envSettings.fnm).toBeUndefined();
    });

    it('keeps C/C++ provider settings under shared logical key', () => {
      const cppSettings = {
        envVariables: [{ key: 'CC', value: 'clang', enabled: true }],
        detectionFiles: [{ fileName: 'CMakeLists.txt (CMAKE_CXX_STANDARD)', enabled: true }],
        autoSwitch: false,
      };

      useEnvironmentStore.getState().setEnvSettings('msvc', cppSettings);
      useEnvironmentStore.getState().setAutoSwitch('msys2', true);

      const state = useEnvironmentStore.getState();
      expect(state.envSettings.cpp?.envVariables).toEqual(cppSettings.envVariables);
      expect(state.envSettings.cpp?.autoSwitch).toBe(true);
      expect(state.envSettings.msvc).toBeUndefined();
      expect(state.envSettings.msys2).toBeUndefined();
    });
  });

  describe('setDetectionFiles', () => {
    it('should set detection files directly', () => {
      const files = [
        { fileName: '.nvmrc', enabled: true },
        { fileName: '.node-version', enabled: false },
      ];
      useEnvironmentStore.getState().setDetectionFiles('node', files);
      const settings = useEnvironmentStore.getState().getEnvSettings('node');
      expect(settings.detectionFiles).toEqual(files);
    });
  });

  describe('updateInstallationProgress when null', () => {
    it('should remain null when no progress dialog is open', () => {
      useEnvironmentStore.getState().updateInstallationProgress({ progress: 50 });
      expect(useEnvironmentStore.getState().installationProgress).toBeNull();
    });
  });
});

describe('getLogicalEnvType', () => {
  it('resolves provider id via availableProviders first', () => {
    const providers = [{ id: 'fnm', env_type: 'node' }];
    expect(getLogicalEnvType('fnm', providers)).toBe('node');
  });

  it('falls back to static PROVIDER_ENV_TYPE_MAP', () => {
    expect(getLogicalEnvType('pyenv')).toBe('python');
    expect(getLogicalEnvType('rustup')).toBe('rust');
    expect(getLogicalEnvType('msvc')).toBe('cpp');
    expect(getLogicalEnvType('msys2')).toBe('cpp');
  });

  it('returns raw value if not in map', () => {
    expect(getLogicalEnvType('unknown-provider')).toBe('unknown-provider');
  });

  it('prefers availableProviders over static map', () => {
    const providers = [{ id: 'fnm', env_type: 'custom-node' }];
    expect(getLogicalEnvType('fnm', providers)).toBe('custom-node');
  });

  it('uses backend mapping for sdkman gradle/maven providers when available', () => {
    const providers = [
      { id: 'sdkman-gradle', env_type: 'gradle' },
      { id: 'sdkman-maven', env_type: 'maven' },
    ];
    expect(getLogicalEnvType('sdkman-gradle', providers)).toBe('gradle');
    expect(getLogicalEnvType('sdkman-maven', providers)).toBe('maven');
  });
});

describe('PROVIDER_ENV_TYPE_MAP', () => {
  it('maps node providers correctly', () => {
    expect(PROVIDER_ENV_TYPE_MAP['fnm']).toBe('node');
    expect(PROVIDER_ENV_TYPE_MAP['nvm']).toBe('node');
    expect(PROVIDER_ENV_TYPE_MAP['volta']).toBe('node');
    expect(PROVIDER_ENV_TYPE_MAP['system-node']).toBe('node');
  });

  it('maps python providers correctly', () => {
    expect(PROVIDER_ENV_TYPE_MAP['pyenv']).toBe('python');
    expect(PROVIDER_ENV_TYPE_MAP['conda']).toBe('python');
    expect(PROVIDER_ENV_TYPE_MAP['system-python']).toBe('python');
  });

  it('maps other providers correctly', () => {
    expect(PROVIDER_ENV_TYPE_MAP['rustup']).toBe('rust');
    expect(PROVIDER_ENV_TYPE_MAP['goenv']).toBe('go');
    expect(PROVIDER_ENV_TYPE_MAP['rbenv']).toBe('ruby');
    expect(PROVIDER_ENV_TYPE_MAP['sdkman']).toBe('java');
    expect(PROVIDER_ENV_TYPE_MAP['sdkman-gradle']).toBe('java');
    expect(PROVIDER_ENV_TYPE_MAP['sdkman-maven']).toBe('java');
    expect(PROVIDER_ENV_TYPE_MAP['dotnet']).toBe('dotnet');
    expect(PROVIDER_ENV_TYPE_MAP['deno']).toBe('deno');
    expect(PROVIDER_ENV_TYPE_MAP['msvc']).toBe('cpp');
    expect(PROVIDER_ENV_TYPE_MAP['msys2']).toBe('cpp');
    expect(PROVIDER_ENV_TYPE_MAP['system-c']).toBe('c');
    expect(PROVIDER_ENV_TYPE_MAP['system-cpp']).toBe('cpp');
  });
});
