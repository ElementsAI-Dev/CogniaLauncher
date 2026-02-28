import { callHost, callHostJson } from './host';
import type { EnvDetectResult, EnvEntry, EnvVersionEntry } from './types';

/**
 * List all available environment providers.
 * Requires: env_read permission.
 */
export function list(): EnvEntry[] {
  return callHostJson<EnvEntry[]>('cognia_env_list', '');
}

/**
 * List all available package/environment providers with full info.
 * Requires: env_read permission.
 */
export function providerList(): unknown {
  return callHostJson<unknown>('cognia_provider_list', '');
}

/**
 * Detect an environment by type (e.g. "node", "python", "rust").
 * Requires: env_read permission.
 */
export function detect(envType: string): EnvDetectResult {
  return callHostJson<EnvDetectResult>(
    'cognia_env_detect',
    JSON.stringify({ envType }),
  );
}

/**
 * Get the current active version for an environment type.
 * Requires: env_read permission.
 */
export function getCurrent(envType: string): string | null {
  const result = callHostJson<{ version: string | null }>(
    'cognia_env_get_current',
    JSON.stringify({ envType }),
  );
  return result.version;
}

/**
 * List installed versions for an environment type.
 * Requires: env_read permission.
 */
export function listVersions(envType: string): EnvVersionEntry[] {
  return callHostJson<EnvVersionEntry[]>(
    'cognia_env_list_versions',
    JSON.stringify({ envType }),
  );
}

/**
 * Install a specific version of an environment.
 * Requires: pkg_install permission.
 */
export function installVersion(envType: string, version: string): void {
  callHost(
    'cognia_env_install_version',
    JSON.stringify({ envType, version }),
  );
}

/**
 * Switch to a specific version of an environment.
 * Requires: pkg_install permission.
 */
export function setVersion(envType: string, version: string): void {
  callHost(
    'cognia_env_set_version',
    JSON.stringify({ envType, version }),
  );
}
