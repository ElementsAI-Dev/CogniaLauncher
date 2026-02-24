import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface ChangelogState {
  /** The last app version the user has seen the changelog for */
  lastSeenVersion: string;
  /** Whether the "What's New" dialog is currently open */
  whatsNewOpen: boolean;

  // Actions
  setLastSeenVersion: (version: string) => void;
  setWhatsNewOpen: (open: boolean) => void;
  dismissWhatsNew: (currentVersion: string) => void;
}

export const useChangelogStore = create<ChangelogState>()(
  persist(
    (set) => ({
      lastSeenVersion: '',
      whatsNewOpen: false,

      setLastSeenVersion: (lastSeenVersion) => set({ lastSeenVersion }),
      setWhatsNewOpen: (whatsNewOpen) => set({ whatsNewOpen }),
      dismissWhatsNew: (currentVersion) =>
        set({ lastSeenVersion: currentVersion, whatsNewOpen: false }),
    }),
    {
      name: 'cognia-changelog',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        lastSeenVersion: state.lastSeenVersion,
      }),
    },
  ),
);
