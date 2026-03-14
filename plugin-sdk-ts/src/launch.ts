/**
 * Launch / environment activation module.
 *
 * Execute programs with specific environment configurations
 * and manage environment activation.
 *
 * Requires: `launch` permission (plus `env_read` for queries).
 */
import { callHostJson } from './host';
import type {
  ProcessResult,
  EnvActivationInfo,
  ActivationResult,
} from './types';

/** Execute a command with a specific environment activated. Requires: launch + process_exec */
export function withEnv(
  command: string,
  args: string[],
  envType: string,
  version?: string,
): ProcessResult {
  return callHostJson<ProcessResult>(
    'cognia_launch_with_env',
    JSON.stringify({ command, args, envType, version: version ?? null }),
  );
}

/** Get environment activation info. Requires: env_read */
export function getEnvInfo(envType: string): EnvActivationInfo {
  return callHostJson<EnvActivationInfo>(
    'cognia_launch_get_env_info',
    JSON.stringify({ envType }),
  );
}

/** Locate a program in PATH with optional env context. Requires: env_read */
export function whichProgram(command: string, envType?: string): string | null {
  return callHostJson<string | null>(
    'cognia_launch_which_program',
    JSON.stringify({ command, envType: envType ?? null }),
  );
}

/** Activate a specific environment version. Requires: launch */
export function activate(envType: string, version: string): ActivationResult {
  return callHostJson<ActivationResult>(
    'cognia_launch_activate',
    JSON.stringify({ envType, version }),
  );
}
