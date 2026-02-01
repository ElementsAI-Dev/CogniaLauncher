import { create } from 'zustand';
import type { EnvironmentInfo, DetectedEnvironment, VersionInfo } from '../tauri';

export interface InstallationProgress {
  envType: string;
  version: string;
  provider: string;
  step: 'fetching' | 'downloading' | 'extracting' | 'configuring' | 'done' | 'error';
  progress: number;
  speed?: string;
  downloadedSize?: string;
  totalSize?: string;
  error?: string;
}

interface EnvironmentState {
  environments: EnvironmentInfo[];
  selectedEnv: string | null;
  detectedVersions: DetectedEnvironment[];
  availableVersions: Record<string, VersionInfo[]>;
  loading: boolean;
  error: string | null;
  
  // Dialog states
  addDialogOpen: boolean;
  progressDialogOpen: boolean;
  installationProgress: InstallationProgress | null;
  
  // Panel states
  versionBrowserOpen: boolean;
  versionBrowserEnvType: string | null;
  detailsPanelOpen: boolean;
  detailsPanelEnvType: string | null;
  
  // Actions
  setEnvironments: (envs: EnvironmentInfo[]) => void;
  setSelectedEnv: (envType: string | null) => void;
  setDetectedVersions: (versions: DetectedEnvironment[]) => void;
  setAvailableVersions: (envType: string, versions: VersionInfo[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateEnvironment: (env: EnvironmentInfo) => void;
  
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
}

export const useEnvironmentStore = create<EnvironmentState>((set) => ({
  environments: [],
  selectedEnv: null,
  detectedVersions: [],
  availableVersions: {},
  loading: false,
  error: null,
  
  // Dialog states
  addDialogOpen: false,
  progressDialogOpen: false,
  installationProgress: null,
  
  // Panel states
  versionBrowserOpen: false,
  versionBrowserEnvType: null,
  detailsPanelOpen: false,
  detailsPanelEnvType: null,

  setEnvironments: (environments) => set({ environments }),
  setSelectedEnv: (selectedEnv) => set({ selectedEnv }),
  setDetectedVersions: (detectedVersions) => set({ detectedVersions }),
  setAvailableVersions: (envType, versions) => set((state) => ({
    availableVersions: { ...state.availableVersions, [envType]: versions }
  })),
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
}));
