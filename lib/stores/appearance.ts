import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AccentColor, ChartColorTheme } from '@/lib/theme/types';

export type { AccentColor } from '@/lib/theme/types';
export type { ChartColorTheme } from '@/lib/theme/types';

interface AppearanceState {
  // State
  accentColor: AccentColor;
  chartColorTheme: ChartColorTheme;
  reducedMotion: boolean;
  
  // Actions
  setAccentColor: (color: AccentColor) => void;
  setChartColorTheme: (theme: ChartColorTheme) => void;
  setReducedMotion: (reduced: boolean) => void;
  reset: () => void;
}

const defaultState = {
  accentColor: 'blue' as AccentColor,
  chartColorTheme: 'default' as ChartColorTheme,
  reducedMotion: false,
};

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      ...defaultState,
      
      setAccentColor: (accentColor) => set({ accentColor }),
      setChartColorTheme: (chartColorTheme) => set({ chartColorTheme }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      reset: () => set(defaultState),
    }),
    {
      name: 'cognia-appearance',
      storage: createJSONStorage(() => localStorage),
      version: 3,
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
        return state as unknown as AppearanceState;
      },
      partialize: (state) => ({
        accentColor: state.accentColor,
        chartColorTheme: state.chartColorTheme,
        reducedMotion: state.reducedMotion,
      }),
    }
  )
);
