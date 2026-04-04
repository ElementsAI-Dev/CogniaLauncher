'use client';

import { CacheSettingsCard } from './cache-settings-card';
import { CachePathCard } from './cache-path-card';
import { CacheScanSettings } from './cache-scan-settings';
import type { CacheSettings } from '@/lib/tauri';

export interface CacheSidebarProps {
  // Settings props
  localSettings: CacheSettings | null;
  settingsDirty: boolean;
  settingsLoading: boolean;
  isSavingSettings: boolean;
  handleSettingsChange: <K extends keyof CacheSettings>(
    key: K,
    value: CacheSettings[K],
  ) => void;
  handleSaveSettings: () => void;
  // Path props
  pathRefreshTrigger: number;
  onPathChanged: () => void;
}

export function CacheSidebar({
  localSettings,
  settingsDirty,
  settingsLoading,
  isSavingSettings,
  handleSettingsChange,
  handleSaveSettings,
  pathRefreshTrigger,
  onPathChanged,
}: CacheSidebarProps) {
  return (
    <div className="space-y-4">
      <CacheSettingsCard
        localSettings={localSettings}
        settingsDirty={settingsDirty}
        loading={settingsLoading}
        isSavingSettings={isSavingSettings}
        handleSettingsChange={handleSettingsChange}
        handleSaveSettings={handleSaveSettings}
      />
      <CacheScanSettings />
      <CachePathCard
        refreshTrigger={pathRefreshTrigger}
        onPathChanged={onPathChanged}
      />
    </div>
  );
}
