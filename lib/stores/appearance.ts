import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AccentColor, ChartColorTheme, InterfaceRadius, InterfaceDensity, ThemeMode, WindowEffect } from '@/lib/theme/types';
import {
  normalizeAccentColor,
  normalizeChartColorTheme,
  normalizeInterfaceDensity,
  normalizeInterfaceRadius,
  normalizeReducedMotion,
  normalizeThemeMode,
  normalizeWindowEffect,
} from '@/lib/theme/appearance';
import { removeBackgroundImage } from '@/lib/theme/background';

export type { AccentColor } from '@/lib/theme/types';
export type { ChartColorTheme } from '@/lib/theme/types';
export type { InterfaceRadius } from '@/lib/theme/types';
export type { InterfaceDensity } from '@/lib/theme/types';
export type { ThemeMode } from '@/lib/theme/types';
export type { WindowEffect } from '@/lib/theme/types';

export type BackgroundFit = 'cover' | 'contain' | 'fill' | 'tile';
const BACKGROUND_FITS: BackgroundFit[] = ['cover', 'contain', 'fill', 'tile'];
const BACKGROUND_OPACITY_MIN = 0;
const BACKGROUND_OPACITY_MAX = 100;
const BACKGROUND_BLUR_MIN = 0;
const BACKGROUND_BLUR_MAX = 20;
export const DEFAULT_APPEARANCE_PRESET_ID = 'default';
const DEFAULT_APPEARANCE_PRESET_NAME = 'Default';

export interface AppearancePresetConfig {
  theme: ThemeMode;
  accentColor: AccentColor;
  chartColorTheme: ChartColorTheme;
  interfaceRadius: InterfaceRadius;
  interfaceDensity: InterfaceDensity;
  reducedMotion: boolean;
  backgroundEnabled: boolean;
  backgroundOpacity: number;
  backgroundBlur: number;
  backgroundFit: BackgroundFit;
  windowEffect: WindowEffect;
}

export interface AppearancePreset {
  id: string;
  name: string;
  config: AppearancePresetConfig;
}

interface AppearanceState {
  // State
  accentColor: AccentColor;
  chartColorTheme: ChartColorTheme;
  interfaceRadius: InterfaceRadius;
  interfaceDensity: InterfaceDensity;
  reducedMotion: boolean;
  backgroundEnabled: boolean;
  backgroundOpacity: number;
  backgroundBlur: number;
  backgroundFit: BackgroundFit;
  windowEffect: WindowEffect;
  presets: AppearancePreset[];
  activePresetId: string;
  
  // Actions
  setAccentColor: (color: AccentColor) => void;
  setChartColorTheme: (theme: ChartColorTheme) => void;
  setInterfaceRadius: (radius: InterfaceRadius) => void;
  setInterfaceDensity: (density: InterfaceDensity) => void;
  setReducedMotion: (reduced: boolean) => void;
  setBackgroundEnabled: (enabled: boolean) => void;
  setBackgroundOpacity: (opacity: number) => void;
  setBackgroundBlur: (blur: number) => void;
  setBackgroundFit: (fit: BackgroundFit) => void;
  setWindowEffect: (effect: WindowEffect) => void;
  createPreset: (name: string, config: AppearancePresetConfig) => string;
  renamePreset: (id: string, name: string) => void;
  updatePresetConfig: (id: string, config: AppearancePresetConfig) => void;
  deletePreset: (id: string) => void;
  setActivePresetId: (id: string) => void;
  applyPreset: (id: string) => AppearancePresetConfig | null;
  replacePresetCollection: (presets: AppearancePreset[], activePresetId?: string) => void;
  clearBackground: () => void;
  reset: () => void;
}

type AppearanceValueState = Pick<
  AppearanceState,
  | 'accentColor'
  | 'chartColorTheme'
  | 'interfaceRadius'
  | 'interfaceDensity'
  | 'reducedMotion'
  | 'backgroundEnabled'
  | 'backgroundOpacity'
  | 'backgroundBlur'
  | 'backgroundFit'
  | 'windowEffect'
>;

type PersistedAppearanceState = Pick<
  AppearanceState,
  | 'accentColor'
  | 'chartColorTheme'
  | 'interfaceRadius'
  | 'interfaceDensity'
  | 'reducedMotion'
  | 'backgroundEnabled'
  | 'backgroundOpacity'
  | 'backgroundBlur'
  | 'backgroundFit'
  | 'windowEffect'
  | 'presets'
  | 'activePresetId'
>;

const defaultState = {
  accentColor: 'blue' as AccentColor,
  chartColorTheme: 'default' as ChartColorTheme,
  interfaceRadius: 0.625 as InterfaceRadius,
  interfaceDensity: 'comfortable' as InterfaceDensity,
  reducedMotion: false,
  backgroundEnabled: false,
  backgroundOpacity: 20,
  backgroundBlur: 0,
  backgroundFit: 'cover' as BackgroundFit,
  windowEffect: 'auto' as WindowEffect,
};
const defaultPresetConfig: AppearancePresetConfig = {
  theme: 'system',
  ...defaultState,
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeBackgroundEnabled(value: unknown, fallback: boolean = defaultState.backgroundEnabled): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function normalizeBackgroundFit(value: unknown, fallback: BackgroundFit = defaultState.backgroundFit): BackgroundFit {
  return typeof value === 'string' && (BACKGROUND_FITS as readonly string[]).includes(value)
    ? (value as BackgroundFit)
    : fallback;
}

function normalizeAppearanceValues(state: Record<string, unknown>): AppearanceValueState {
  return {
    accentColor: normalizeAccentColor(state.accentColor as string | undefined),
    chartColorTheme: normalizeChartColorTheme(state.chartColorTheme as string | undefined),
    interfaceRadius: normalizeInterfaceRadius(state.interfaceRadius as string | number | undefined),
    interfaceDensity: normalizeInterfaceDensity(state.interfaceDensity as string | undefined),
    reducedMotion: normalizeReducedMotion(state.reducedMotion as string | boolean | undefined),
    backgroundEnabled: normalizeBackgroundEnabled(state.backgroundEnabled),
    backgroundOpacity: clampNumber(
      state.backgroundOpacity,
      BACKGROUND_OPACITY_MIN,
      BACKGROUND_OPACITY_MAX,
      defaultState.backgroundOpacity,
    ),
    backgroundBlur: clampNumber(
      state.backgroundBlur,
      BACKGROUND_BLUR_MIN,
      BACKGROUND_BLUR_MAX,
      defaultState.backgroundBlur,
    ),
    backgroundFit: normalizeBackgroundFit(state.backgroundFit),
    windowEffect: normalizeWindowEffect(state.windowEffect as string | undefined),
  };
}

function normalizePresetName(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizePresetConfig(
  value: unknown,
  fallback: AppearancePresetConfig,
): AppearancePresetConfig {
  const raw = value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};

  return {
    theme: normalizeThemeMode(raw.theme as string | undefined, fallback.theme),
    accentColor: normalizeAccentColor(raw.accentColor as string | undefined, fallback.accentColor),
    chartColorTheme: normalizeChartColorTheme(raw.chartColorTheme as string | undefined, fallback.chartColorTheme),
    interfaceRadius: normalizeInterfaceRadius(raw.interfaceRadius as string | number | undefined, fallback.interfaceRadius),
    interfaceDensity: normalizeInterfaceDensity(raw.interfaceDensity as string | undefined, fallback.interfaceDensity),
    reducedMotion: normalizeReducedMotion(raw.reducedMotion as string | boolean | undefined, fallback.reducedMotion),
    backgroundEnabled: normalizeBackgroundEnabled(raw.backgroundEnabled, fallback.backgroundEnabled),
    backgroundOpacity: clampNumber(
      raw.backgroundOpacity,
      BACKGROUND_OPACITY_MIN,
      BACKGROUND_OPACITY_MAX,
      fallback.backgroundOpacity,
    ),
    backgroundBlur: clampNumber(
      raw.backgroundBlur,
      BACKGROUND_BLUR_MIN,
      BACKGROUND_BLUR_MAX,
      fallback.backgroundBlur,
    ),
    backgroundFit: normalizeBackgroundFit(raw.backgroundFit, fallback.backgroundFit),
    windowEffect: normalizeWindowEffect(raw.windowEffect as string | undefined, fallback.windowEffect),
  };
}

function buildDefaultPreset(config: AppearancePresetConfig): AppearancePreset {
  return {
    id: DEFAULT_APPEARANCE_PRESET_ID,
    name: DEFAULT_APPEARANCE_PRESET_NAME,
    config,
  };
}

function normalizePresetCollection(
  presetsValue: unknown,
  activePresetIdValue: unknown,
  fallbackConfig: AppearancePresetConfig,
): Pick<PersistedAppearanceState, 'presets' | 'activePresetId'> {
  const rawPresets = Array.isArray(presetsValue) ? presetsValue : [];
  const normalizedPresets: AppearancePreset[] = [];
  const usedIds = new Set<string>();

  for (let i = 0; i < rawPresets.length; i += 1) {
    const rawPreset = rawPresets[i] && typeof rawPresets[i] === 'object'
      ? (rawPresets[i] as Record<string, unknown>)
      : {};
    let id = typeof rawPreset.id === 'string' && rawPreset.id.trim().length > 0
      ? rawPreset.id.trim()
      : `preset-${i + 1}`;
    if (usedIds.has(id)) {
      id = `${id}-${i + 1}`;
    }
    usedIds.add(id);

    const fallbackName = id === DEFAULT_APPEARANCE_PRESET_ID
      ? DEFAULT_APPEARANCE_PRESET_NAME
      : `Preset ${i + 1}`;

    normalizedPresets.push({
      id,
      name: normalizePresetName(rawPreset.name, fallbackName),
      config: normalizePresetConfig(rawPreset.config, fallbackConfig),
    });
  }

  const defaultPreset = normalizedPresets.find((preset) => preset.id === DEFAULT_APPEARANCE_PRESET_ID);
  if (!defaultPreset) {
    normalizedPresets.unshift(buildDefaultPreset(fallbackConfig));
  } else {
    defaultPreset.name = DEFAULT_APPEARANCE_PRESET_NAME;
    defaultPreset.config = normalizePresetConfig(defaultPreset.config, fallbackConfig);
  }

  const activePresetId = typeof activePresetIdValue === 'string'
    ? activePresetIdValue
    : DEFAULT_APPEARANCE_PRESET_ID;

  return {
    presets: normalizedPresets,
    activePresetId: normalizedPresets.some((preset) => preset.id === activePresetId)
      ? activePresetId
      : DEFAULT_APPEARANCE_PRESET_ID,
  };
}

function normalizePersistedAppearanceState(state: Record<string, unknown>): PersistedAppearanceState {
  const normalizedValues = normalizeAppearanceValues(state);
  const fallbackPresetConfig: AppearancePresetConfig = {
    theme: normalizeThemeMode(state.theme as string | undefined, defaultPresetConfig.theme),
    ...normalizedValues,
  };
  const normalizedPresets = normalizePresetCollection(
    state.presets,
    state.activePresetId,
    fallbackPresetConfig,
  );

  return {
    ...normalizedValues,
    ...normalizedPresets,
  };
}

function createPresetId(): string {
  return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function pickAppearanceValues(state: AppearanceValueState): AppearanceValueState {
  return {
    accentColor: state.accentColor,
    chartColorTheme: state.chartColorTheme,
    interfaceRadius: state.interfaceRadius,
    interfaceDensity: state.interfaceDensity,
    reducedMotion: state.reducedMotion,
    backgroundEnabled: state.backgroundEnabled,
    backgroundOpacity: state.backgroundOpacity,
    backgroundBlur: state.backgroundBlur,
    backgroundFit: state.backgroundFit,
    windowEffect: state.windowEffect,
  };
}

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      ...defaultState,
      presets: [buildDefaultPreset(defaultPresetConfig)],
      activePresetId: DEFAULT_APPEARANCE_PRESET_ID,
      
      setAccentColor: (accentColor) => set({ accentColor: normalizeAccentColor(accentColor) }),
      setChartColorTheme: (chartColorTheme) => set({ chartColorTheme: normalizeChartColorTheme(chartColorTheme) }),
      setInterfaceRadius: (interfaceRadius) => set({ interfaceRadius: normalizeInterfaceRadius(interfaceRadius) }),
      setInterfaceDensity: (interfaceDensity) => set({ interfaceDensity: normalizeInterfaceDensity(interfaceDensity) }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion: normalizeReducedMotion(reducedMotion) }),
      setBackgroundEnabled: (backgroundEnabled) => set({ backgroundEnabled }),
      setBackgroundOpacity: (backgroundOpacity) => set({
        backgroundOpacity: clampNumber(
          backgroundOpacity,
          BACKGROUND_OPACITY_MIN,
          BACKGROUND_OPACITY_MAX,
          defaultState.backgroundOpacity,
        ),
      }),
      setBackgroundBlur: (backgroundBlur) => set({
        backgroundBlur: clampNumber(
          backgroundBlur,
          BACKGROUND_BLUR_MIN,
          BACKGROUND_BLUR_MAX,
          defaultState.backgroundBlur,
        ),
      }),
      setBackgroundFit: (backgroundFit) => set({ backgroundFit: normalizeBackgroundFit(backgroundFit) }),
      setWindowEffect: (windowEffect) => set({ windowEffect: normalizeWindowEffect(windowEffect) }),
      createPreset: (name, config) => {
        const id = createPresetId();
        const normalizedConfig = normalizePresetConfig(config, defaultPresetConfig);
        set((state) => ({
          presets: [
            ...state.presets,
            {
              id,
              name: normalizePresetName(name, `Preset ${state.presets.length}`),
              config: normalizedConfig,
            },
          ],
          activePresetId: id,
        }));
        return id;
      },
      renamePreset: (id, name) => {
        if (id === DEFAULT_APPEARANCE_PRESET_ID) return;
        set((state) => ({
          presets: state.presets.map((preset) => (
            preset.id === id
              ? { ...preset, name: normalizePresetName(name, preset.name) }
              : preset
          )),
        }));
      },
      updatePresetConfig: (id, config) => {
        const normalizedConfig = normalizePresetConfig(config, defaultPresetConfig);
        set((state) => ({
          presets: state.presets.map((preset) => (
            preset.id === id
              ? { ...preset, config: normalizedConfig }
              : preset
          )),
        }));
      },
      deletePreset: (id) => {
        if (id === DEFAULT_APPEARANCE_PRESET_ID) return;
        set((state) => {
          const nextPresets = state.presets.filter((preset) => preset.id !== id);
          return {
            presets: nextPresets.length > 0 ? nextPresets : [buildDefaultPreset(defaultPresetConfig)],
            activePresetId: nextPresets.some((preset) => preset.id === state.activePresetId)
              ? state.activePresetId
              : DEFAULT_APPEARANCE_PRESET_ID,
          };
        });
      },
      setActivePresetId: (id) => set((state) => ({
        activePresetId: state.presets.some((preset) => preset.id === id)
          ? id
          : state.activePresetId,
      })),
      applyPreset: (id) => {
        let appliedConfig: AppearancePresetConfig | null = null;
        set((state) => {
          const preset = state.presets.find((candidate) => candidate.id === id);
          if (!preset) return state;
          const normalizedConfig = normalizePresetConfig(preset.config, defaultPresetConfig);
          appliedConfig = normalizedConfig;
          return {
            ...pickAppearanceValues(normalizedConfig),
            activePresetId: id,
          };
        });
        return appliedConfig;
      },
      replacePresetCollection: (presets, activePresetId) => set((state) => {
        const normalized = normalizePresetCollection(
          presets,
          activePresetId ?? state.activePresetId,
          {
            theme: defaultPresetConfig.theme,
            ...pickAppearanceValues(state),
          },
        );
        return normalized;
      }),
      clearBackground: () => {
        removeBackgroundImage();
        set({
          backgroundEnabled: false,
          backgroundOpacity: defaultState.backgroundOpacity,
          backgroundBlur: defaultState.backgroundBlur,
          backgroundFit: defaultState.backgroundFit,
        });
      },
      reset: () => {
        removeBackgroundImage();
        set({
          ...defaultState,
          presets: [buildDefaultPreset(defaultPresetConfig)],
          activePresetId: DEFAULT_APPEARANCE_PRESET_ID,
        });
      },
    }),
    {
      name: 'cognia-appearance',
      storage: createJSONStorage(() => localStorage),
      version: 8,
      migrate: (persistedState, version) => {
        const state = persistedState as Record<string, unknown>;
        if (version < 2) {
          // v1 → v2: added reducedMotion
          if (!('reducedMotion' in state)) {
            state.reducedMotion = defaultState.reducedMotion;
          }
        }
        if (version < 3) {
          // v2 → v3: added chartColorTheme
          if (!('chartColorTheme' in state)) {
            state.chartColorTheme = defaultState.chartColorTheme;
          }
        }
        if (version < 4) {
          // v3 → v4: added interfaceRadius
          if (!('interfaceRadius' in state)) {
            state.interfaceRadius = defaultState.interfaceRadius;
          }
        }
        if (version < 5) {
          // v4 → v5: added interfaceDensity
          if (!('interfaceDensity' in state)) {
            state.interfaceDensity = defaultState.interfaceDensity;
          }
        }
        if (version < 6) {
          // v5 → v6: added background customization
          if (!('backgroundEnabled' in state)) {
            state.backgroundEnabled = defaultState.backgroundEnabled;
          }
          if (!('backgroundOpacity' in state)) {
            state.backgroundOpacity = defaultState.backgroundOpacity;
          }
          if (!('backgroundBlur' in state)) {
            state.backgroundBlur = defaultState.backgroundBlur;
          }
          if (!('backgroundFit' in state)) {
            state.backgroundFit = defaultState.backgroundFit;
          }
        }
        if (version < 7) {
          // v6 → v7: added window effect (native transparency)
          if (!('windowEffect' in state)) {
            state.windowEffect = defaultState.windowEffect;
          }
        }
        if (version < 8) {
          // v7 → v8: added appearance presets
          const normalizedValues = normalizeAppearanceValues(state);
          const migratedPresetConfig: AppearancePresetConfig = {
            theme: normalizeThemeMode(state.theme as string | undefined, defaultPresetConfig.theme),
            ...normalizedValues,
          };
          state.presets = [buildDefaultPreset(migratedPresetConfig)];
          state.activePresetId = DEFAULT_APPEARANCE_PRESET_ID;
        }
        return normalizePersistedAppearanceState(state) as unknown as AppearanceState;
      },
      partialize: (state) => ({
        accentColor: state.accentColor,
        chartColorTheme: state.chartColorTheme,
        interfaceRadius: state.interfaceRadius,
        interfaceDensity: state.interfaceDensity,
        reducedMotion: state.reducedMotion,
        backgroundEnabled: state.backgroundEnabled,
        backgroundOpacity: state.backgroundOpacity,
        backgroundBlur: state.backgroundBlur,
        backgroundFit: state.backgroundFit,
        windowEffect: state.windowEffect,
        presets: state.presets,
        activePresetId: state.activePresetId,
      }),
    }
  )
);
