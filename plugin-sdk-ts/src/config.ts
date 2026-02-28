import { callHost, callHostJson } from './host';

/**
 * Read a configuration value by key.
 * Requires: config_read permission.
 */
export function get(key: string): string | null {
  const result = callHostJson<{ value: string | null }>(
    'cognia_config_get',
    JSON.stringify({ key }),
  );
  return result.value;
}

/**
 * Write a configuration value.
 * Requires: config_write permission.
 */
export function set(key: string, value: string): void {
  callHost('cognia_config_set', JSON.stringify({ key, value }));
}
