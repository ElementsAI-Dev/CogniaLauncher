import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AccentColor, ChartColorTheme, InterfaceRadius, InterfaceDensity, WindowEffect } from '@/lib/theme/types';
import {
  normalizeAccentColor,
  normalizeChartColorTheme,
  normalizeInterfaceDensity,
  normalizeInterfaceRadius,
  normalizeReducedMotion,
  normalizeWindowEffect,
} from '@/lib/theme/appearance';
import { removeBackgroundImage } from '@/lib/theme/background';

export type { AccentColor } from '@/lib/theme/types';
export type { ChartColorTheme } from '@/lib/theme/types';
export type { InterfaceRadius } from '@/lib/theme/types';
export type { InterfaceDensity } from '@/lib/theme/types';
export type { WindowEffect } from '@/lib/theme/types';

export type BackgroundFit = 'cover' | 'contain' | 'fill' | 'tile';
const BACKGROUND_FITS: BackgroundFit[] = ['cover', 'contain', 'fill', 'tile'];
const BACKGROUND_OPACITY_MIN = 0;
const BACKGROUND_OPACITY_MAX = 100;
const BACKGROUND_BLUR_MIN = 0;
const BACKGROUND_BLUR_MAX = 20;

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
  clearBackground: () => void;
  reset: () => void;
}

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

function normalizePersistedAppearanceState(state: Record<string, unknown>): PersistedAppearanceState {
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

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      ...defaultState,
      
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
        set(defaultState);
      },
    }),
    {
      name: 'cognia-appearance',
      storage: createJSONStorage(() => localStorage),
      version: 7,
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
      }),
    }
  )
);
