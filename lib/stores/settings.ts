import { create } from 'zustand';
import type { CacheInfo, CacheSettings, CacheVerificationResult, PlatformInfo } from '../tauri';

interface SettingsState {
  config: Record<string, string>;
  cacheInfo: CacheInfo | null;
  cacheSettings: CacheSettings | null;
  cacheVerification: CacheVerificationResult | null;
  platformInfo: PlatformInfo | null;
  cogniaDir: string | null;
  loading: boolean;
  error: string | null;

  setConfig: (config: Record<string, string>) => void;
  updateConfig: (key: string, value: string) => void;
  setCacheInfo: (info: CacheInfo | null) => void;
  setCacheSettings: (settings: CacheSettings | null) => void;
  setCacheVerification: (result: CacheVerificationResult | null) => void;
  setPlatformInfo: (info: PlatformInfo) => void;
  setCogniaDir: (dir: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  config: {},
  cacheInfo: null,
  cacheSettings: null,
  cacheVerification: null,
  platformInfo: null,
  cogniaDir: null,
  loading: false,
  error: null,

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
}));
