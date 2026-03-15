import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  EnvironmentInfo,
  DetectedEnvironment,
  VersionInfo,
  EnvironmentProviderInfo,
  EnvUpdateCheckResult,
  EnvInstallProgressEvent,
} from '../tauri';
import { DEFAULT_DETECTION_FILES } from '../constants/environments';
import {
  PROVIDER_ENV_TYPE_MAP,
  getLogicalEnvType,
  normalizeEnvType,
  normalizeProviderId,
  pruneWorkflowSelectedProviders,
  resolveLogicalEnvSettingsType,
  resolveWorkflowProviderSelection,
  type EnvironmentWorkflowAction,
  type EnvironmentWorkflowActionKind,
  type EnvironmentWorkflowContext,
  type EnvironmentWorkflowOrigin,
  type ProviderAlias,
} from '../environment-workflow';

export {
  PROVIDER_ENV_TYPE_MAP,
  getLogicalEnvType,
  type EnvironmentWorkflowAction,
  type EnvironmentWorkflowActionKind,
  type EnvironmentWorkflowContext,
  type EnvironmentWorkflowOrigin,
};

export interface InstallationProgress {
  envType: string;
  version: string;
  provider: string;
  step: EnvInstallProgressEvent['step'];
  phase?: EnvInstallProgressEvent['phase'];
  terminalState?: EnvInstallProgressEvent['terminalState'];
  failureClass?: EnvInstallProgressEvent['failureClass'];
  artifact?: EnvInstallProgressEvent['artifact'];
  stageMessage?: EnvInstallProgressEvent['stageMessage'];
  selectionRationale?: EnvInstallProgressEvent['selectionRationale'];
  retryable?: EnvInstallProgressEvent['retryable'];
  retryAfterSeconds?: EnvInstallProgressEvent['retryAfterSeconds'];
  attempt?: EnvInstallProgressEvent['attempt'];
  maxAttempts?: EnvInstallProgressEvent['maxAttempts'];
  progress: number;
  speed?: string;
  downloadedSize?: string;
  totalSize?: string;
  error?: string;
}

// Environment variable configuration
export interface EnvVariable {
  key: string;
  value: string;
  enabled: boolean;
}

// Detection file configuration
export interface DetectionFileConfig {
  fileName: string;
  enabled: boolean;
}

// Persisted settings per environment type
export interface EnvironmentSettings {
  envVariables: EnvVariable[];
  detectionFiles: DetectionFileConfig[];
  autoSwitch: boolean;
}

// Filter types for environment list
export type EnvironmentStatusFilter = 'all' | 'available' | 'unavailable';
export type EnvironmentSortBy = 'name' | 'installed_count' | 'provider';
export type EnvironmentViewMode = 'grid' | 'list';

interface EnvironmentState {
  environments: EnvironmentInfo[];
  selectedEnv: string | null;
  detectedVersions: DetectedEnvironment[];
  availableVersions: Record<string, VersionInfo[]>;
  availableProviders: EnvironmentProviderInfo[];
  loading: boolean;
  error: string | null;
  
  // Search and filter state
  searchQuery: string;
  statusFilter: EnvironmentStatusFilter;
  sortBy: EnvironmentSortBy;
  viewMode: EnvironmentViewMode;
  
  // Persisted settings per environment type
  envSettings: Record<string, EnvironmentSettings>;
  selectedProviders: Record<string, string>;

  // Workflow continuity state
  workflowContext: EnvironmentWorkflowContext | null;
  workflowAction: EnvironmentWorkflowAction | null;
  
  // Dialog states
  addDialogOpen: boolean;
  progressDialogOpen: boolean;
  installationProgress: InstallationProgress | null;
  
  // Panel states
  versionBrowserOpen: boolean;
  versionBrowserEnvType: string | null;
  detailsPanelOpen: boolean;
  detailsPanelEnvType: string | null;
  
  // Update check state
  updateCheckResults: Record<string, EnvUpdateCheckResult>;
  lastEnvUpdateCheck: number | null;
  lastEnvScanTimestamp: number | null;
  
  // Actions
  setEnvironments: (envs: EnvironmentInfo[]) => void;
  setSelectedEnv: (envType: string | null) => void;
  setDetectedVersions: (versions: DetectedEnvironment[]) => void;
  setAvailableVersions: (envType: string, versions: VersionInfo[]) => void;
  setAvailableProviders: (providers: EnvironmentProviderInfo[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateEnvironment: (env: EnvironmentInfo) => void;
  
  // Environment settings actions
  getEnvSettings: (envType: string) => EnvironmentSettings;
  setEnvSettings: (envType: string, settings: EnvironmentSettings) => void;
  setEnvVariables: (envType: string, variables: EnvVariable[]) => void;
  addEnvVariable: (envType: string, variable: EnvVariable) => void;
  removeEnvVariable: (envType: string, key: string) => void;
  updateEnvVariable: (envType: string, key: string, updates: Partial<EnvVariable>) => void;
  setDetectionFiles: (envType: string, files: DetectionFileConfig[]) => void;
  toggleDetectionFile: (envType: string, fileName: string, enabled: boolean) => void;
  setAutoSwitch: (envType: string, enabled: boolean) => void;
  setSelectedProvider: (envType: string, providerId: string) => void;
  clearSelectedProvider: (envType: string) => void;
  getSelectedProvider: (envType: string, fallbackProviderId?: string | null) => string;

  // Workflow continuity actions
  setWorkflowContext: (context: EnvironmentWorkflowContext | null) => void;
  clearWorkflowContext: () => void;
  setWorkflowAction: (action: EnvironmentWorkflowAction | null) => void;
  clearWorkflowAction: () => void;
  
  // Installation state
  currentInstallation: { envType: string; version: string } | null;
  setCurrentInstallation: (installation: { envType: string; version: string } | null) => void;
  
  // Batch operations
  selectedVersions: { envType: string; version: string }[];
  toggleVersionSelection: (envType: string, version: string) => void;
  clearVersionSelection: () => void;
  selectAllVersions: (envType: string, versions: string[]) => void;
  isVersionSelected: (envType: string, version: string) => boolean;
  
  // Dialog actions
  openAddDialog: () => void;
  closeAddDialog: () => void;
  openProgressDialog: (progress: InstallationProgress) => void;
  closeProgressDialog: () => void;
  updateInstallationProgress: (progress: Partial<InstallationProgress>) => void;
  
  // Panel actions
  openVersionBrowser: (envType: string) => void;
  closeVersionBrowser: () => void;
  openDetailsPanel: (envType: string) => void;
  closeDetailsPanel: () => void;
  
  // Update check actions
  setUpdateCheckResult: (envType: string, result: EnvUpdateCheckResult) => void;
  setAllUpdateCheckResults: (results: EnvUpdateCheckResult[]) => void;
  setLastEnvUpdateCheck: (timestamp: number) => void;
  setLastEnvScanTimestamp: (timestamp: number | null) => void;
  isScanFresh: () => boolean;
  
  // Search and filter actions
  setSearchQuery: (query: string) => void;
  setStatusFilter: (filter: EnvironmentStatusFilter) => void;
  setSortBy: (sort: EnvironmentSortBy) => void;
  setViewMode: (mode: EnvironmentViewMode) => void;
  clearFilters: () => void;
}

function matchesEnvironmentIdentity(
  current: Pick<EnvironmentInfo, 'env_type' | 'provider_id'>,
  next: Pick<EnvironmentInfo, 'env_type' | 'provider_id'>,
): boolean {
  if (normalizeEnvType(current.env_type) !== normalizeEnvType(next.env_type)) {
    return false;
  }

  const currentProviderId = normalizeProviderId(current.provider_id);
  const nextProviderId = normalizeProviderId(next.provider_id);

  if (currentProviderId && nextProviderId) {
    return currentProviderId === nextProviderId;
  }

  return true;
}
// Helper to get default settings for an environment type
function getDefaultEnvSettings(envType: string): EnvironmentSettings {
  const normalizedEnvType = PROVIDER_ENV_TYPE_MAP[normalizeEnvType(envType)] || normalizeEnvType(envType);
  const detectionFiles = (DEFAULT_DETECTION_FILES[normalizedEnvType] || []).map((fileName) => ({
    fileName,
    enabled: true,
  }));
  
  return {
    envVariables: [],
    detectionFiles,
    autoSwitch: false,
  };
}

function resolveEnvSettingsEntry(
  envSettings: Record<string, EnvironmentSettings>,
  envType: string,
  availableProviders: ProviderAlias[],
): {
  logicalEnvType: string;
  sourceKey: string | null;
  settings: EnvironmentSettings;
} {
  const normalizedEnvType = normalizeEnvType(envType);
  const logicalEnvType = resolveLogicalEnvSettingsType(normalizedEnvType, availableProviders);

  if (envSettings[logicalEnvType]) {
    return {
      logicalEnvType,
      sourceKey: logicalEnvType,
      settings: envSettings[logicalEnvType],
    };
  }

  if (envSettings[normalizedEnvType]) {
    return {
      logicalEnvType,
      sourceKey: normalizedEnvType,
      settings: envSettings[normalizedEnvType],
    };
  }

  for (const [key, settings] of Object.entries(envSettings)) {
    if (resolveLogicalEnvSettingsType(key, availableProviders) === logicalEnvType) {
      return {
        logicalEnvType,
        sourceKey: key,
        settings,
      };
    }
  }

  return {
    logicalEnvType,
    sourceKey: null,
    settings: getDefaultEnvSettings(logicalEnvType),
  };
}

function upsertEnvSettings(
  envSettings: Record<string, EnvironmentSettings>,
  envType: string,
  availableProviders: ProviderAlias[],
  updater: (settings: EnvironmentSettings, logicalEnvType: string) => EnvironmentSettings,
): Record<string, EnvironmentSettings> {
  const normalizedEnvType = normalizeEnvType(envType);
  const { logicalEnvType, sourceKey, settings } = resolveEnvSettingsEntry(
    envSettings,
    normalizedEnvType,
    availableProviders,
  );
  const nextEnvSettings = {
    ...envSettings,
    [logicalEnvType]: updater(settings, logicalEnvType),
  };

  // Migrate legacy provider-id keys to logical env-type keys after write.
  if (sourceKey && sourceKey !== logicalEnvType) {
    delete nextEnvSettings[sourceKey];
  }
  if (normalizedEnvType !== logicalEnvType) {
    delete nextEnvSettings[normalizedEnvType];
  }

  return nextEnvSettings;
}

export const useEnvironmentStore = create<EnvironmentState>()(
  persist(
    (set, get) => ({
      environments: [],
      selectedEnv: null,
      detectedVersions: [],
      availableVersions: {},
      availableProviders: [],
      loading: false,
      error: null,
      
      // Persisted settings
      envSettings: {},
      
      // Installation state
      currentInstallation: null,
      
      // Batch operations
      selectedVersions: [],
      
      // Dialog states
      addDialogOpen: false,
      progressDialogOpen: false,
      installationProgress: null,
      
      // Panel states
      versionBrowserOpen: false,
      versionBrowserEnvType: null,
      detailsPanelOpen: false,
      detailsPanelEnvType: null,
      
      // Search and filter state
      searchQuery: '',
      statusFilter: 'all' as EnvironmentStatusFilter,
      sortBy: 'name' as EnvironmentSortBy,
      viewMode: 'grid' as EnvironmentViewMode,

      // Workflow state
      selectedProviders: {},
      workflowContext: null,
      workflowAction: null,

      // Update check state
      updateCheckResults: {},
      lastEnvUpdateCheck: null,
      lastEnvScanTimestamp: null,

      setEnvironments: (environments) => set({ environments }),
      setSelectedEnv: (selectedEnv) => set({ selectedEnv }),
      setDetectedVersions: (detectedVersions) => set({ detectedVersions }),
      setAvailableVersions: (envType, versions) => set((state) => ({
        availableVersions: { ...state.availableVersions, [envType]: versions }
      })),
      setAvailableProviders: (providers) => set((state) => ({
        availableProviders: providers,
        selectedProviders: pruneWorkflowSelectedProviders(state.selectedProviders, providers),
      })),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      
      updateEnvironment: (env) => set((state) => {
        const exists = state.environments.some((e) => matchesEnvironmentIdentity(e, env));
        if (exists) {
          return {
            environments: state.environments.map((e) =>
              matchesEnvironmentIdentity(e, env) ? env : e
            ),
          };
        }
        return { environments: [...state.environments, env] };
      }),
      
      // Environment settings actions
      getEnvSettings: (envType: string) => {
        const state = get();
        return resolveEnvSettingsEntry(
          state.envSettings,
          envType,
          state.availableProviders,
        ).settings;
      },

      setEnvSettings: (envType, settings) => set((state) => ({
        envSettings: upsertEnvSettings(
          state.envSettings,
          envType,
          state.availableProviders,
          () => settings,
        ),
      })),
      
      setEnvVariables: (envType, variables) => set((state) => ({
        envSettings: upsertEnvSettings(
          state.envSettings,
          envType,
          state.availableProviders,
          (current) => ({
            ...current,
            envVariables: variables,
          }),
        ),
      })),
      
      addEnvVariable: (envType, variable) => set((state) => {
        return {
          envSettings: upsertEnvSettings(
            state.envSettings,
            envType,
            state.availableProviders,
            (current) => ({
              ...current,
              envVariables: [...current.envVariables, variable],
            }),
          ),
        };
      }),
      
      removeEnvVariable: (envType, key) => set((state) => {
        return {
          envSettings: upsertEnvSettings(
            state.envSettings,
            envType,
            state.availableProviders,
            (current) => ({
              ...current,
              envVariables: current.envVariables.filter((v) => v.key !== key),
            }),
          ),
        };
      }),
      
      updateEnvVariable: (envType, key, updates) => set((state) => {
        return {
          envSettings: upsertEnvSettings(
            state.envSettings,
            envType,
            state.availableProviders,
            (current) => ({
              ...current,
              envVariables: current.envVariables.map((v) =>
                v.key === key ? { ...v, ...updates } : v
              ),
            }),
          ),
        };
      }),
      
      setDetectionFiles: (envType, files) => set((state) => ({
        envSettings: upsertEnvSettings(
          state.envSettings,
          envType,
          state.availableProviders,
          (current) => ({
            ...current,
            detectionFiles: files,
          }),
        ),
      })),
      
      toggleDetectionFile: (envType, fileName, enabled) => set((state) => {
        return {
          envSettings: upsertEnvSettings(
            state.envSettings,
            envType,
            state.availableProviders,
            (current) => ({
              ...current,
              detectionFiles: current.detectionFiles.map((f) =>
                f.fileName === fileName ? { ...f, enabled } : f
              ),
            }),
          ),
        };
      }),
      
      setAutoSwitch: (envType, enabled) => set((state) => ({
        envSettings: upsertEnvSettings(
          state.envSettings,
          envType,
          state.availableProviders,
          (current) => ({
            ...current,
            autoSwitch: enabled,
          }),
        ),
      })),

      setSelectedProvider: (envType, providerId) => set((state) => {
        const logicalEnvType = resolveLogicalEnvSettingsType(envType, state.availableProviders);
        return {
          selectedProviders: {
            ...state.selectedProviders,
            [logicalEnvType]: normalizeEnvType(providerId),
          },
        };
      }),

      clearSelectedProvider: (envType) => set((state) => {
        const logicalEnvType = resolveLogicalEnvSettingsType(envType, state.availableProviders);
        const nextSelectedProviders = { ...state.selectedProviders };
        delete nextSelectedProviders[logicalEnvType];
        return {
          selectedProviders: nextSelectedProviders,
        };
      }),

      getSelectedProvider: (envType, fallbackProviderId) => {
        const state = get();
        return resolveWorkflowProviderSelection({
          envType,
          selectedProviders: state.selectedProviders,
          availableProviders: state.availableProviders,
          fallbackProviderId,
        });
      },

      setWorkflowContext: (workflowContext) => set({ workflowContext }),
      clearWorkflowContext: () => set({ workflowContext: null }),
      setWorkflowAction: (workflowAction) => set({ workflowAction }),
      clearWorkflowAction: () => set({ workflowAction: null }),
      
      // Installation state
      setCurrentInstallation: (installation) => set({ currentInstallation: installation }),
      
      // Batch operations
      toggleVersionSelection: (envType, version) => set((state) => {
        const exists = state.selectedVersions.some(
          (v) => v.envType === envType && v.version === version
        );
        return {
          selectedVersions: exists
            ? state.selectedVersions.filter(
                (v) => !(v.envType === envType && v.version === version)
              )
            : [...state.selectedVersions, { envType, version }],
        };
      }),
      
      clearVersionSelection: () => set({ selectedVersions: [] }),
      
      selectAllVersions: (envType, versions) => set((state) => {
        const otherSelections = state.selectedVersions.filter((v) => v.envType !== envType);
        const newSelections = versions.map((version) => ({ envType, version }));
        return { selectedVersions: [...otherSelections, ...newSelections] };
      }),
      
      isVersionSelected: (envType: string, version: string) => {
        const state = get();
        return state.selectedVersions.some(
          (v) => v.envType === envType && v.version === version
        );
      },
      
      // Dialog actions
      openAddDialog: () => set({ addDialogOpen: true }),
      closeAddDialog: () => set({ addDialogOpen: false }),
      openProgressDialog: (progress) => set({ 
        progressDialogOpen: true, 
        installationProgress: progress 
      }),
      closeProgressDialog: () => set({ 
        progressDialogOpen: false, 
        installationProgress: null 
      }),
      updateInstallationProgress: (progress) => set((state) => ({
        installationProgress: state.installationProgress 
          ? { ...state.installationProgress, ...progress }
          : null
      })),
      
      // Panel actions
      openVersionBrowser: (envType) => set({ versionBrowserOpen: true, versionBrowserEnvType: envType }),
      closeVersionBrowser: () => set({ versionBrowserOpen: false, versionBrowserEnvType: null }),
      openDetailsPanel: (envType) => set({ detailsPanelOpen: true, detailsPanelEnvType: envType }),
      closeDetailsPanel: () => set({ detailsPanelOpen: false, detailsPanelEnvType: null }),
      
      // Update check actions
      setUpdateCheckResult: (envType, result) => set((state) => ({
        updateCheckResults: { ...state.updateCheckResults, [envType]: result },
      })),
      setAllUpdateCheckResults: (results) => set(() => {
        const map: Record<string, import('../tauri').EnvUpdateCheckResult> = {};
        for (const r of results) { map[r.envType] = r; }
        return { updateCheckResults: map };
      }),
      setLastEnvUpdateCheck: (timestamp) => set({ lastEnvUpdateCheck: timestamp }),
      setLastEnvScanTimestamp: (lastEnvScanTimestamp) => set({ lastEnvScanTimestamp }),
      isScanFresh: () => {
        const ts = get().lastEnvScanTimestamp;
        if (!ts) return false;
        return Date.now() - ts < 5 * 60 * 1000; // 5 minutes
      },
      
      // Search and filter actions
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setStatusFilter: (statusFilter) => set({ statusFilter }),
      setSortBy: (sortBy) => set({ sortBy }),
      setViewMode: (viewMode) => set({ viewMode }),
      clearFilters: () => set({ searchQuery: '', statusFilter: 'all', sortBy: 'name' }),
    }),
    {
      name: 'cognia-environment-settings',
      version: 1,
      migrate: (persisted) => persisted as EnvironmentState,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        envSettings: state.envSettings,
        selectedProviders: state.selectedProviders,
        viewMode: state.viewMode,
        updateCheckResults: state.updateCheckResults,
        lastEnvUpdateCheck: state.lastEnvUpdateCheck,
        environments: state.environments,
        lastEnvScanTimestamp: state.lastEnvScanTimestamp,
      }),
    }
  )
);
