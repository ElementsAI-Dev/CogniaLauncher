import { callHost, callHostJson } from './host';

/**
 * Emit an event that can be observed by the host and other plugins.
 */
export function emit(name: string, payload: unknown): void {
  callHost(
    'cognia_event_emit',
    JSON.stringify({ name, payload }),
  );
}

/**
 * Emit an event with a simple string payload.
 */
export function emitStr(name: string, message: string): void {
  emit(name, message);
}

/**
 * Get the current plugin's own ID.
 */
export function getPluginId(): string {
  const result = callHostJson<{ pluginId: string }>(
    'cognia_get_plugin_id',
    '',
  );
  return result.pluginId;
}
