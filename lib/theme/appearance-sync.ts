import {
  normalizeAccentColor,
  normalizeChartColorTheme,
  normalizeInterfaceDensity,
  normalizeInterfaceRadius,
  type AppearanceConfigPath,
  normalizeAppearanceConfigValue,
  normalizeReducedMotion,
  normalizeThemeMode,
  normalizeWindowEffect,
} from '@/lib/theme/appearance';
import type { AppearancePresetConfig, BackgroundFit } from '@/lib/stores/appearance';

const BACKGROUND_FITS: BackgroundFit[] = ['cover', 'contain', 'fill', 'tile'];

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeBackgroundEnabled(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function normalizeBackgroundFit(value: unknown, fallback: BackgroundFit = 'cover'): BackgroundFit {
  return typeof value === 'string' && (BACKGROUND_FITS as readonly string[]).includes(value)
    ? (value as BackgroundFit)
    : fallback;
}

export interface SyncAppearanceConfigValueOptions {
  key: AppearanceConfigPath;
  value: string;
  updateConfigValue: (key: string, value: string) => Promise<void>;
  fetchConfig: () => Promise<Record<string, string>>;
}

export interface SyncAppearancePresetConfigOptions {
  preset: AppearancePresetConfig;
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

export async function syncAppearancePresetConfig({
  preset,
  updateConfigValue,
  fetchConfig,
}: SyncAppearancePresetConfigOptions): Promise<AppearancePresetConfig> {
  const normalizedPreset: AppearancePresetConfig = {
    theme: normalizeThemeMode(preset.theme),
    accentColor: normalizeAccentColor(preset.accentColor),
    chartColorTheme: normalizeChartColorTheme(preset.chartColorTheme),
    interfaceRadius: normalizeInterfaceRadius(preset.interfaceRadius),
    interfaceDensity: normalizeInterfaceDensity(preset.interfaceDensity),
    reducedMotion: normalizeReducedMotion(preset.reducedMotion),
    backgroundEnabled: normalizeBackgroundEnabled(preset.backgroundEnabled),
    backgroundOpacity: clampNumber(preset.backgroundOpacity, 0, 100, 20),
    backgroundBlur: clampNumber(preset.backgroundBlur, 0, 20, 0),
    backgroundFit: normalizeBackgroundFit(preset.backgroundFit),
    windowEffect: normalizeWindowEffect(preset.windowEffect),
  };

  const canonicalTheme = await syncAppearanceConfigValue({
    key: 'appearance.theme',
    value: normalizedPreset.theme,
    updateConfigValue,
    fetchConfig,
  });
  const canonicalAccentColor = await syncAppearanceConfigValue({
    key: 'appearance.accent_color',
    value: normalizedPreset.accentColor,
    updateConfigValue,
    fetchConfig,
  });
  const canonicalChartTheme = await syncAppearanceConfigValue({
    key: 'appearance.chart_color_theme',
    value: normalizedPreset.chartColorTheme,
    updateConfigValue,
    fetchConfig,
  });
  const canonicalRadius = await syncAppearanceConfigValue({
    key: 'appearance.interface_radius',
    value: String(normalizedPreset.interfaceRadius),
    updateConfigValue,
    fetchConfig,
  });
  const canonicalDensity = await syncAppearanceConfigValue({
    key: 'appearance.interface_density',
    value: normalizedPreset.interfaceDensity,
    updateConfigValue,
    fetchConfig,
  });
  const canonicalReducedMotion = await syncAppearanceConfigValue({
    key: 'appearance.reduced_motion',
    value: String(normalizedPreset.reducedMotion),
    updateConfigValue,
    fetchConfig,
  });
  const canonicalWindowEffect = await syncAppearanceConfigValue({
    key: 'appearance.window_effect',
    value: normalizedPreset.windowEffect,
    updateConfigValue,
    fetchConfig,
  });

  return {
    ...normalizedPreset,
    theme: normalizeThemeMode(canonicalTheme),
    accentColor: normalizeAccentColor(canonicalAccentColor),
    chartColorTheme: normalizeChartColorTheme(canonicalChartTheme),
    interfaceRadius: normalizeInterfaceRadius(canonicalRadius),
    interfaceDensity: normalizeInterfaceDensity(canonicalDensity),
    reducedMotion: normalizeReducedMotion(canonicalReducedMotion),
    windowEffect: normalizeWindowEffect(canonicalWindowEffect),
  };
}
