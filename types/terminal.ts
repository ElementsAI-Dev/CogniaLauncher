import type {
  LaunchResult,
  ShellInfo,
  ShellStartupMeasurement,
  ShellHealthResult,
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
  shellsLoading: boolean;
  profilesLoading: boolean;
  psLoading: boolean;
  loading: boolean;
  error: string | null;
}
