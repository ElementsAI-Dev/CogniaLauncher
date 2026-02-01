import { create } from 'zustand';
import type { CacheInfo, PlatformInfo } from '../tauri';

interface SettingsState {
  config: Record<string, string>;
  cacheInfo: CacheInfo | null;
  platformInfo: PlatformInfo | null;
  cogniaDir: string | null;
  loading: boolean;
  error: string | null;

  setConfig: (config: Record<string, string>) => void;
  updateConfig: (key: string, value: string) => void;
  setCacheInfo: (info: CacheInfo | null) => void;
  setPlatformInfo: (info: PlatformInfo) => void;
  setCogniaDir: (dir: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  config: {},
  cacheInfo: null,
  platformInfo: null,
  cogniaDir: null,
  loading: false,
  error: null,

  setConfig: (config) => set({ config }),
  updateConfig: (key, value) => set((state) => ({
    config: { ...state.config, [key]: value },
  })),
  setCacheInfo: (cacheInfo) => set({ cacheInfo }),
  setPlatformInfo: (platformInfo) => set({ platformInfo }),
  setCogniaDir: (cogniaDir) => set({ cogniaDir }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
