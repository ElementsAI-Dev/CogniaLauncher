import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CacheInfo, CacheSettings, CacheVerificationResult, PlatformInfo } from '../tauri';

export interface AppSettings {
  checkUpdatesOnStart: boolean;
  autoInstallUpdates: boolean;
  notifyOnUpdates: boolean;
}

interface SettingsState {
  config: Record<string, string>;
  cacheInfo: CacheInfo | null;
  cacheSettings: CacheSettings | null;
  cacheVerification: CacheVerificationResult | null;
  platformInfo: PlatformInfo | null;
  cogniaDir: string | null;
  loading: boolean;
  error: string | null;
  appSettings: AppSettings;

  setConfig: (config: Record<string, string>) => void;
  updateConfig: (key: string, value: string) => void;
  setCacheInfo: (info: CacheInfo | null) => void;
  setCacheSettings: (settings: CacheSettings | null) => void;
  setCacheVerification: (result: CacheVerificationResult | null) => void;
  setPlatformInfo: (info: PlatformInfo) => void;
  setCogniaDir: (dir: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAppSettings: (settings: Partial<AppSettings>) => void;
}

const defaultAppSettings: AppSettings = {
  checkUpdatesOnStart: true,
  autoInstallUpdates: false,
  notifyOnUpdates: true,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      config: {},
      cacheInfo: null,
      cacheSettings: null,
      cacheVerification: null,
      platformInfo: null,
      cogniaDir: null,
      loading: false,
      error: null,
      appSettings: defaultAppSettings,

      setConfig: (config) => set({ config }),
      updateConfig: (key, value) => set((state) => ({
        config: { ...state.config, [key]: value },
      })),
      setCacheInfo: (cacheInfo) => set({ cacheInfo }),
      setCacheSettings: (cacheSettings) => set({ cacheSettings }),
      setCacheVerification: (cacheVerification) => set({ cacheVerification }),
      setPlatformInfo: (platformInfo) => set({ platformInfo }),
      setCogniaDir: (cogniaDir) => set({ cogniaDir }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      setAppSettings: (settings) => set((state) => ({
        appSettings: { ...state.appSettings, ...settings },
      })),
    }),
    {
      name: 'cognia-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        appSettings: state.appSettings,
      }),
    }
  )
);
