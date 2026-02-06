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
      partialize: (state) => ({
        accentColor: state.accentColor,
        chartColorTheme: state.chartColorTheme,
        reducedMotion: state.reducedMotion,
      }),
    }
  )
);
