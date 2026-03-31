"use client";

import { create } from "zustand";
import * as tauri from "@/lib/tauri";
import { isTauri } from "@/lib/platform";
import type { ShellInfo, TerminalProfile } from "@/types/tauri";

type TerminalStoreState = {
  profiles: TerminalProfile[];
  shells: ShellInfo[];
  defaultProfileId: string | null;
  recentlyLaunchedIds: string[];
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  setProfiles: (profiles: TerminalProfile[]) => void;
  setShells: (shells: ShellInfo[]) => void;
  setDefaultProfileId: (profileId: string | null) => void;
  upsertProfile: (profile: TerminalProfile) => void;
  removeProfile: (profileId: string) => void;
  markProfileLaunched: (profileId: string) => void;
};

function syncDefaultProfile(
  profiles: TerminalProfile[],
  defaultProfileId: string | null,
): TerminalProfile[] {
  return profiles.map((profile) => ({
    ...profile,
    isDefault: profile.id === defaultProfileId,
  }));
}

function resolveDefaultProfileId(
  profiles: TerminalProfile[],
  currentDefaultProfileId: string | null,
): string | null {
  if (
    currentDefaultProfileId &&
    profiles.some((profile) => profile.id === currentDefaultProfileId)
  ) {
    return currentDefaultProfileId;
  }

  return profiles.find((profile) => profile.isDefault)?.id ?? null;
}

export const useTerminalStore = create<TerminalStoreState>((set) => ({
  profiles: [],
  shells: [],
  defaultProfileId: null,
  recentlyLaunchedIds: [],
  loading: false,
  error: null,

  hydrate: async () => {
    if (!isTauri()) {
      set({ loading: false, error: null });
      return;
    }

    set({ loading: true, error: null });

    try {
      const [profiles, shells, defaultProfile] = await Promise.all([
        tauri.terminalListProfiles(),
        tauri.terminalDetectShells(),
        tauri.terminalGetDefaultProfile(),
      ]);
      const defaultProfileId =
        defaultProfile?.id ?? profiles.find((profile) => profile.isDefault)?.id ?? null;

      set({
        profiles: syncDefaultProfile(profiles, defaultProfileId),
        shells,
        defaultProfileId,
        loading: false,
        error: null,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  setProfiles: (profiles) =>
    set((state) => {
      const defaultProfileId = resolveDefaultProfileId(
        profiles,
        state.defaultProfileId,
      );

      return {
        profiles: syncDefaultProfile(profiles, defaultProfileId),
        defaultProfileId,
      };
    }),

  setShells: (shells) => set({ shells }),

  setDefaultProfileId: (profileId) =>
    set((state) => ({
      defaultProfileId: profileId,
      profiles: syncDefaultProfile(state.profiles, profileId),
    })),

  upsertProfile: (profile) =>
    set((state) => {
      const existingIndex = state.profiles.findIndex(
        (item) => item.id === profile.id,
      );
      const profiles =
        existingIndex >= 0
          ? state.profiles.map((item, index) =>
              index === existingIndex ? profile : item,
            )
          : [profile, ...state.profiles];
      const defaultProfileId = profile.isDefault
        ? profile.id
        : resolveDefaultProfileId(profiles, state.defaultProfileId);

      return {
        profiles: syncDefaultProfile(profiles, defaultProfileId),
        defaultProfileId,
      };
    }),

  removeProfile: (profileId) =>
    set((state) => {
      const profiles = state.profiles.filter((profile) => profile.id !== profileId);
      const defaultProfileId =
        state.defaultProfileId === profileId
          ? resolveDefaultProfileId(profiles, null)
          : resolveDefaultProfileId(profiles, state.defaultProfileId);

      return {
        profiles: syncDefaultProfile(profiles, defaultProfileId),
        defaultProfileId,
        recentlyLaunchedIds: state.recentlyLaunchedIds.filter((id) => id !== profileId),
      };
    }),

  markProfileLaunched: (profileId) =>
    set((state) => ({
      recentlyLaunchedIds: [
        profileId,
        ...state.recentlyLaunchedIds.filter((id) => id !== profileId),
      ].slice(0, 3),
    })),
}));
