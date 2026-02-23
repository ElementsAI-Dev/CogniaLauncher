import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AccentColor, ChartColorTheme, InterfaceRadius, InterfaceDensity } from '@/lib/theme/types';
import { removeBackgroundImage } from '@/lib/theme/background';

export type { AccentColor } from '@/lib/theme/types';
export type { ChartColorTheme } from '@/lib/theme/types';
export type { InterfaceRadius } from '@/lib/theme/types';
export type { InterfaceDensity } from '@/lib/theme/types';

export type BackgroundFit = 'cover' | 'contain' | 'fill' | 'tile';

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
  clearBackground: () => void;
  reset: () => void;
}

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
};

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      ...defaultState,
      
      setAccentColor: (accentColor) => set({ accentColor }),
      setChartColorTheme: (chartColorTheme) => set({ chartColorTheme }),
      setInterfaceRadius: (interfaceRadius) => set({ interfaceRadius }),
      setInterfaceDensity: (interfaceDensity) => set({ interfaceDensity }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setBackgroundEnabled: (backgroundEnabled) => set({ backgroundEnabled }),
      setBackgroundOpacity: (backgroundOpacity) => set({ backgroundOpacity }),
      setBackgroundBlur: (backgroundBlur) => set({ backgroundBlur }),
      setBackgroundFit: (backgroundFit) => set({ backgroundFit }),
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
      version: 6,
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
        return state as unknown as AppearanceState;
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
      }),
    }
  )
);
