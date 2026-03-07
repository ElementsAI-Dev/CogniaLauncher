import {
  type AppearanceConfigPath,
  normalizeAppearanceConfigValue,
} from '@/lib/theme/appearance';

export interface SyncAppearanceConfigValueOptions {
  key: AppearanceConfigPath;
  value: string;
  updateConfigValue: (key: string, value: string) => Promise<void>;
  fetchConfig: () => Promise<Record<string, string>>;
}

/**
 * Shared write pipeline for appearance settings:
 * optimistic caller update -> normalized backend write -> canonical readback reconciliation.
 */
export async function syncAppearanceConfigValue({
  key,
  value,
  updateConfigValue,
  fetchConfig,
}: SyncAppearanceConfigValueOptions): Promise<string> {
  const normalizedWriteValue = normalizeAppearanceConfigValue(key, value);
  await updateConfigValue(key, normalizedWriteValue);

  const configSnapshot = await fetchConfig();
  const readbackRaw = configSnapshot[key] ?? normalizedWriteValue;
  const canonicalReadback = normalizeAppearanceConfigValue(key, readbackRaw);

  if (canonicalReadback !== readbackRaw) {
    await updateConfigValue(key, canonicalReadback);
  }

  return canonicalReadback;
}
