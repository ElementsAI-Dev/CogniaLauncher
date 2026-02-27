import type {
  LaunchResult,
  ShellInfo,
  TerminalProfile,
  PSProfileInfo,
  PSModuleInfo,
  PSScriptInfo,
  ShellFrameworkInfo,
  ShellPlugin,
} from '@/types/tauri';

export type ProxyMode = 'global' | 'custom' | 'none';

export interface UseTerminalState {
  shells: ShellInfo[];
  profiles: TerminalProfile[];
  psProfiles: PSProfileInfo[];
  psModules: PSModuleInfo[];
  psScripts: PSScriptInfo[];
  executionPolicy: [string, string][];
  frameworks: ShellFrameworkInfo[];
  plugins: ShellPlugin[];
  shellEnvVars: [string, string][];
  proxyEnvVars: [string, string][];
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
  loading: boolean;
  error: string | null;
}
