import type {
  LaunchResult,
  ShellInfo,
  ShellType,
  ShellStartupMeasurement,
  ShellHealthResult,
  TerminalConfigMutationResult,
  TerminalConfigRestoreResult,
  TerminalProfile,
  TerminalEnvVarSummary,
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
export type TerminalConfigActionResult =
  | TerminalConfigMutationResult
  | TerminalConfigRestoreResult;
export type TerminalResourceKey =
  | 'profiles'
  | 'templates'
  | 'configEntries'
  | 'configMetadata'
  | 'proxyConfig'
  | 'proxyEnvVars'
  | 'shellEnvVars'
  | 'psProfiles'
  | 'psModules'
  | 'psScripts'
  | 'executionPolicy';

export type TerminalResourceState = Record<TerminalResourceKey, boolean>;

export type TerminalReadoutStatus =
  | 'ready'
  | 'missing-config'
  | 'unsupported'
  | 'failed'
  | 'stale';

export type TerminalReadoutFreshness = 'fresh' | 'stale';

export interface TerminalShellReadout {
  shellId: string;
  status: TerminalReadoutStatus;
  degradedReason: string | null;
  startupStatus: 'idle' | 'ready' | 'failed';
  startupFreshness: TerminalReadoutFreshness | null;
  healthStatus: 'idle' | 'ready' | 'failed';
  healthFreshness: TerminalReadoutFreshness | null;
  frameworkSummaryCount: number;
  pluginSummaryCount: number;
  lastUpdatedAt: number | null;
}

export interface TerminalFrameworkReadout {
  key: string;
  shellType: ShellType;
  status: TerminalReadoutStatus;
  degradedReason: string | null;
  pluginCount: number;
  freshness: TerminalReadoutFreshness;
  lastUpdatedAt: number | null;
}

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
  shellEnvVars: TerminalEnvVarSummary[];
  proxyEnvVars: [string, string][];
  startupMeasurements: Record<string, ShellStartupMeasurement>;
  healthResults: Record<string, ShellHealthResult>;
  shellReadouts: Record<string, TerminalShellReadout>;
  frameworkReadouts: Record<string, TerminalFrameworkReadout>;
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
  configMutationState: TerminalActionState<TerminalConfigActionResult>;
  proxySyncState: TerminalActionState<{
    proxyMode: ProxyMode;
    customProxy: string;
    noProxy: string;
    globalProxy: string;
    proxyEnvVars: [string, string][];
  }>;
  resourceStale: TerminalResourceState;
  shellsLoading: boolean;
  profilesLoading: boolean;
  psLoading: boolean;
  loading: boolean;
  error: string | null;
}
