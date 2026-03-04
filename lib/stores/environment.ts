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

// Map provider IDs to their corresponding environment types
export const PROVIDER_ENV_TYPE_MAP: Record<string, string> = {
  fnm: 'node',
  nvm: 'node',
  volta: 'node',
  deno: 'deno',
  pyenv: 'python',
  conda: 'python',
  pipx: 'python',
  goenv: 'go',
  rustup: 'rust',
  rbenv: 'ruby',
  sdkman: 'java',
  phpbrew: 'php',
  dotnet: 'dotnet',
  mise: 'polyglot',
  asdf: 'polyglot',
  nix: 'polyglot',
  'system-node': 'node',
  'system-python': 'python',
  'system-go': 'go',
  'system-rust': 'rust',
  'system-ruby': 'ruby',
  'system-java': 'java',
  'system-php': 'php',
  'system-dotnet': 'dotnet',
  'system-deno': 'deno',
  'system-bun': 'bun',
  'sdkman-kotlin': 'kotlin',
  'sdkman-scala': 'scala',
  'sdkman-gradle': 'java',
  'sdkman-maven': 'java',
  'system-kotlin': 'kotlin',
};

/**
 * Resolve a provider-based env_type (e.g., "fnm", "pyenv") to its logical language type (e.g., "node", "python").
 * Falls back to the availableProviders list, then the static map, then the raw value.
 */
export function getLogicalEnvType(
  providerEnvType: string,
  availableProviders?: { id: string; env_type: string }[],
): string {
  // Check availableProviders first (most accurate, from backend)
  if (availableProviders) {
    const providerInfo = availableProviders.find((p) => p.id === providerEnvType);
    if (providerInfo) return providerInfo.env_type;
  }
  // Fallback to static map
  return PROVIDER_ENV_TYPE_MAP[providerEnvType] || providerEnvType;
}

function normalizeEnvType(envType: string): string {
  return envType.trim().toLowerCase();
}

type ProviderAlias = Pick<EnvironmentProviderInfo, 'id' | 'env_type'>;

function normalizeProviderAliases(providers: ProviderAlias[]): ProviderAlias[] {
  return providers.map((provider) => ({
    id: normalizeEnvType(provider.id),
    env_type: normalizeEnvType(provider.env_type),
  }));
}

function resolveLogicalEnvSettingsType(
  envType: string,
  availableProviders: ProviderAlias[],
): string {
  const normalizedEnvType = normalizeEnvType(envType);
  return normalizeEnvType(
    getLogicalEnvType(normalizedEnvType, normalizeProviderAliases(availableProviders)),
  );
}

// Helper to get default settings for an environment type
function getDefaultEnvSettings(envType: string): EnvironmentSettings {
  const normalizedEnvType = PROVIDER_ENV_TYPE_MAP[normalizeEnvType(envType)] || normalizeEnvType(envType);
  const detectionFiles = (DEFAULT_DETECTION_FILES[normalizedEnvType] || []).map((fileName, idx) => ({
    fileName,
    enabled: idx < 2, // Enable first two by default
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
      setAvailableProviders: (providers) => set({ availableProviders: providers }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      
      updateEnvironment: (env) => set((state) => {
        const exists = state.environments.some((e) => e.env_type === env.env_type);
        if (exists) {
          return {
            environments: state.environments.map((e) =>
              e.env_type === env.env_type ? env : e
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
        viewMode: state.viewMode,
        updateCheckResults: state.updateCheckResults,
        lastEnvUpdateCheck: state.lastEnvUpdateCheck,
        environments: state.environments,
        lastEnvScanTimestamp: state.lastEnvScanTimestamp,
      }),
    }
  )
);
