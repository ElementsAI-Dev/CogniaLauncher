import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AccentColor = 'zinc' | 'blue' | 'green' | 'purple' | 'orange' | 'rose';
export type ThemeMode = 'light' | 'dark' | 'system';

interface AppearanceState {
  // State
  themeMode: ThemeMode;
  accentColor: AccentColor;
  reducedMotion: boolean;
  
  // Actions
  setThemeMode: (mode: ThemeMode) => void;
  setAccentColor: (color: AccentColor) => void;
  setReducedMotion: (reduced: boolean) => void;
  reset: () => void;
}

const defaultState = {
  themeMode: 'system' as ThemeMode,
  accentColor: 'blue' as AccentColor,
  reducedMotion: false,
};

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      ...defaultState,
      
      setThemeMode: (themeMode) => set({ themeMode }),
      setAccentColor: (accentColor) => set({ accentColor }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      reset: () => set(defaultState),
    }),
    {
      name: 'cognia-appearance',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        themeMode: state.themeMode,
        accentColor: state.accentColor,
        reducedMotion: state.reducedMotion,
      }),
    }
  )
);
