import type {
  LaunchResult,
  ShellInfo,
  ShellStartupMeasurement,
  ShellHealthResult,
  TerminalConfigMutationResult,
  TerminalProfile,
  TerminalProfileTemplate,
  PSProfileInfo,
  PSModuleInfo,
  PSScriptInfo,
  ShellFrameworkInfo,
  ShellPlugin,
  FrameworkCacheInfo,
} from '@/types/tauri';

export type ProxyMode = 'global' | 'custom' | 'none';
export type TerminalActionStatus = 'idle' | 'loading' | 'success' | 'error';

export interface TerminalActionState<T> {
  status: TerminalActionStatus;
  message: string | null;
  result: T | null;
  updatedAt: number | null;
}

export interface UseTerminalState {
  shells: ShellInfo[];
  profiles: TerminalProfile[];
  templates: TerminalProfileTemplate[];
  psProfiles: PSProfileInfo[];
  psModules: PSModuleInfo[];
  psScripts: PSScriptInfo[];
  executionPolicy: [string, string][];
  frameworks: ShellFrameworkInfo[];
  plugins: ShellPlugin[];
  frameworkCacheStats: FrameworkCacheInfo[];
  frameworkCacheLoading: boolean;
  shellEnvVars: [string, string][];
  proxyEnvVars: [string, string][];
  startupMeasurements: Record<string, ShellStartupMeasurement>;
  healthResults: Record<string, ShellHealthResult>;
  measuringShellId: string | null;
  checkingHealthShellId: string | null;
  selectedShellId: string | null;
  launchingProfileId: string | null;
  lastLaunchResult: {
    profileId: string;
    result: LaunchResult;
  } | null;
  proxyMode: ProxyMode;
  customProxy: string;
  noProxy: string;
  globalProxy: string;
  proxyConfigSaving: boolean;
  configMutationState: TerminalActionState<TerminalConfigMutationResult>;
  proxySyncState: TerminalActionState<{
    proxyMode: ProxyMode;
    customProxy: string;
    noProxy: string;
    globalProxy: string;
    proxyEnvVars: [string, string][];
  }>;
  shellsLoading: boolean;
  profilesLoading: boolean;
  psLoading: boolean;
  loading: boolean;
  error: string | null;
}
