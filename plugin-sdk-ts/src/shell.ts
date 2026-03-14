/**
 * Shell / terminal information module.
 *
 * Provides read-only access to shell detection, profiles,
 * and framework information.
 *
 * Requires: `shell_read` permission.
 */
import { callHostJson } from './host';
import type {
  DetectedShell,
  ShellProfile,
  ShellInfo,
  ShellHealthReport,
  ShellFramework,
} from './types';

/** Detect installed shells. Requires: shell_read */
export function detectShells(): DetectedShell[] {
  return callHostJson<DetectedShell[]>('cognia_shell_detect_shells', '');
}

/** List terminal profiles. Requires: shell_read */
export function listProfiles(): ShellProfile[] {
  return callHostJson<ShellProfile[]>('cognia_shell_list_profiles', '');
}

/** Get the default terminal profile. Requires: shell_read */
export function getDefaultProfile(): ShellProfile | null {
  return callHostJson<ShellProfile | null>('cognia_shell_get_default_profile', '');
}

/** Get a terminal profile by ID. Requires: shell_read */
export function getProfile(id: string): ShellProfile | null {
  return callHostJson<ShellProfile | null>(
    'cognia_shell_get_profile',
    JSON.stringify({ id }),
  );
}

/** Get detailed shell information. Requires: shell_read */
export function getShellInfo(shell: string): ShellInfo {
  return callHostJson<ShellInfo>(
    'cognia_shell_get_info',
    JSON.stringify({ shell }),
  );
}

/** Get environment variables for a shell. Requires: shell_read */
export function getEnvVars(shell?: string): Record<string, string> {
  return callHostJson<Record<string, string>>(
    'cognia_shell_get_env_vars',
    JSON.stringify({ shell: shell ?? null }),
  );
}

/** Check shell health. Requires: shell_read */
export function checkHealth(shell?: string): ShellHealthReport {
  return callHostJson<ShellHealthReport>(
    'cognia_shell_check_health',
    JSON.stringify({ shell: shell ?? null }),
  );
}

/** Detect shell framework (oh-my-zsh, etc). Requires: shell_read */
export function detectFramework(shell: string): ShellFramework | null {
  return callHostJson<ShellFramework | null>(
    'cognia_shell_detect_framework',
    JSON.stringify({ shell }),
  );
}
