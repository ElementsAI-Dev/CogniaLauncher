import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CacheInfo, CacheSettings, CacheVerificationResult, PlatformInfo, TrayClickBehavior } from '../tauri';
import {
  DEFAULT_SIDEBAR_ITEM_ORDER,
  normalizeSidebarItemOrder,
  type SidebarItemId,
} from '@/lib/sidebar/order';

export interface AppSettings {
  checkUpdatesOnStart: boolean;
  autoInstallUpdates: boolean;
  notifyOnUpdates: boolean;
  minimizeToTray: boolean;
  startMinimized: boolean;
  autostart: boolean;
  trayClickBehavior: TrayClickBehavior;
  showNotifications: boolean;
  sidebarItemOrder: SidebarItemId[];
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

export const DEFAULT_APP_SETTINGS: AppSettings = {
  checkUpdatesOnStart: true,
  autoInstallUpdates: false,
  notifyOnUpdates: true,
  minimizeToTray: true,
  startMinimized: false,
  autostart: false,
  trayClickBehavior: 'toggle_window',
  showNotifications: true,
  sidebarItemOrder: [...DEFAULT_SIDEBAR_ITEM_ORDER],
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
      appSettings: DEFAULT_APP_SETTINGS,

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
      version: 3,
      migrate: (persistedState, version) => {
        const state = (persistedState ?? {}) as Partial<SettingsState> & {
          appSettings?: Partial<AppSettings>;
        };

        const appSettings: Partial<AppSettings> = state.appSettings ?? {};
        const rawSidebarItemOrder = (appSettings as Record<string, unknown>)
          .sidebarItemOrder;

        // Keep backward compatibility with older persisted payloads.
        // New keys always fall back to defaults.
        const migrated: AppSettings = {
          checkUpdatesOnStart:
            appSettings.checkUpdatesOnStart ?? DEFAULT_APP_SETTINGS.checkUpdatesOnStart,
          autoInstallUpdates:
            appSettings.autoInstallUpdates ?? DEFAULT_APP_SETTINGS.autoInstallUpdates,
          notifyOnUpdates:
            appSettings.notifyOnUpdates ?? DEFAULT_APP_SETTINGS.notifyOnUpdates,
          minimizeToTray:
            appSettings.minimizeToTray ?? DEFAULT_APP_SETTINGS.minimizeToTray,
          startMinimized:
            appSettings.startMinimized ?? DEFAULT_APP_SETTINGS.startMinimized,
          autostart: appSettings.autostart ?? DEFAULT_APP_SETTINGS.autostart,
          trayClickBehavior:
            appSettings.trayClickBehavior ?? DEFAULT_APP_SETTINGS.trayClickBehavior,
          showNotifications:
            appSettings.showNotifications ?? DEFAULT_APP_SETTINGS.showNotifications,
          sidebarItemOrder: normalizeSidebarItemOrder(
            Array.isArray(rawSidebarItemOrder)
              ? (rawSidebarItemOrder as string[])
              : DEFAULT_APP_SETTINGS.sidebarItemOrder,
          ),
        };

        if (version < 3) {
          return { ...state, appSettings: migrated } as SettingsState;
        }

        return { ...state, appSettings: migrated } as SettingsState;
      },
      partialize: (state) => ({
        appSettings: state.appSettings,
      }),
    }
  )
);
