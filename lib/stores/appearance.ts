import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AccentColor } from '@/lib/theme/types';

export type { AccentColor } from '@/lib/theme/types';

interface AppearanceState {
  // State
  accentColor: AccentColor;
  reducedMotion: boolean;
  
  // Actions
  setAccentColor: (color: AccentColor) => void;
  setReducedMotion: (reduced: boolean) => void;
  reset: () => void;
}

const defaultState = {
  accentColor: 'blue' as AccentColor,
  reducedMotion: false,
};

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      ...defaultState,
      
      setAccentColor: (accentColor) => set({ accentColor }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      reset: () => set(defaultState),
    }),
    {
      name: 'cognia-appearance',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      partialize: (state) => ({
        accentColor: state.accentColor,
        reducedMotion: state.reducedMotion,
      }),
    }
  )
);
