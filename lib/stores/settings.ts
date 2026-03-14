import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  CacheInfo,
  CacheSettings,
  CacheVerificationResult,
  PlatformInfo,
  TrayClickBehavior,
  TrayNotificationLevel,
} from '../tauri';
import {
  DEFAULT_SIDEBAR_ITEM_ORDER,
  normalizeSidebarItemOrder,
  type SidebarItemId,
} from '@/lib/sidebar/order';

export type UpdateSourceMode = 'official' | 'mirror' | 'custom';

export interface AppSettings {
  checkUpdatesOnStart: boolean;
  autoInstallUpdates: boolean;
  notifyOnUpdates: boolean;
  updateSourceMode: UpdateSourceMode;
  updateCustomEndpoints: string[];
  updateFallbackToOfficial: boolean;
  minimizeToTray: boolean;
  startMinimized: boolean;
  autostart: boolean;
  trayClickBehavior: TrayClickBehavior;
  showNotifications: boolean;
  trayNotificationLevel: TrayNotificationLevel;
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
  updateSourceMode: 'official',
  updateCustomEndpoints: [],
  updateFallbackToOfficial: true,
  minimizeToTray: true,
  startMinimized: false,
  autostart: false,
  trayClickBehavior: 'toggle_window',
  showNotifications: true,
  trayNotificationLevel: 'all',
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
      version: 4,
      migrate: (persistedState, version) => {
        const state = (persistedState ?? {}) as Partial<SettingsState> & {
          appSettings?: Partial<AppSettings>;
        };

        const appSettings: Partial<AppSettings> = state.appSettings ?? {};
        const rawSidebarItemOrder = (appSettings as Record<string, unknown>)
          .sidebarItemOrder;
        const rawUpdateCustomEndpoints = (appSettings as Record<string, unknown>)
          .updateCustomEndpoints;

        const parseUpdateSourceMode = (
          value: unknown,
          fallback: UpdateSourceMode,
        ): UpdateSourceMode => {
          if (value === 'official' || value === 'mirror' || value === 'custom') {
            return value;
          }
          return fallback;
        };

        const parseUpdateCustomEndpoints = (value: unknown): string[] => {
          if (Array.isArray(value)) {
            return value
              .filter((item): item is string => typeof item === 'string')
              .map((item) => item.trim())
              .filter((item) => item.length > 0);
          }

          if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return [];
            return trimmed
              .replace(/\r/g, '')
              .replace(/\n/g, ',')
              .split(',')
              .map((item) => item.trim())
              .filter((item) => item.length > 0);
          }

          return [];
        };

        // Keep backward compatibility with older persisted payloads.
        // New keys always fall back to defaults.
        const migrated: AppSettings = {
          checkUpdatesOnStart:
            appSettings.checkUpdatesOnStart ?? DEFAULT_APP_SETTINGS.checkUpdatesOnStart,
          autoInstallUpdates:
            appSettings.autoInstallUpdates ?? DEFAULT_APP_SETTINGS.autoInstallUpdates,
          notifyOnUpdates:
            appSettings.notifyOnUpdates ?? DEFAULT_APP_SETTINGS.notifyOnUpdates,
          updateSourceMode: parseUpdateSourceMode(
            appSettings.updateSourceMode,
            DEFAULT_APP_SETTINGS.updateSourceMode,
          ),
          updateCustomEndpoints: parseUpdateCustomEndpoints(rawUpdateCustomEndpoints),
          updateFallbackToOfficial:
            appSettings.updateFallbackToOfficial
            ?? DEFAULT_APP_SETTINGS.updateFallbackToOfficial,
          minimizeToTray:
            appSettings.minimizeToTray ?? DEFAULT_APP_SETTINGS.minimizeToTray,
          startMinimized:
            appSettings.startMinimized ?? DEFAULT_APP_SETTINGS.startMinimized,
          autostart: appSettings.autostart ?? DEFAULT_APP_SETTINGS.autostart,
          trayClickBehavior:
            appSettings.trayClickBehavior ?? DEFAULT_APP_SETTINGS.trayClickBehavior,
          showNotifications:
            appSettings.showNotifications ?? DEFAULT_APP_SETTINGS.showNotifications,
          trayNotificationLevel:
            appSettings.trayNotificationLevel ?? DEFAULT_APP_SETTINGS.trayNotificationLevel,
          sidebarItemOrder: normalizeSidebarItemOrder(
            Array.isArray(rawSidebarItemOrder)
              ? (rawSidebarItemOrder as string[])
              : DEFAULT_APP_SETTINGS.sidebarItemOrder,
          ),
        };

        if (version < 4) {
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
