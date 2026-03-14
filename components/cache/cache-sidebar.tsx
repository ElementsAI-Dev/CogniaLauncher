'use client';

import { CacheSettingsCard } from './cache-settings-card';
import { CachePathCard } from './cache-path-card';
import type { CacheSettings } from '@/lib/tauri';

export interface CacheSidebarProps {
  // Settings props
  localSettings: CacheSettings | null;
  settingsDirty: boolean;
  settingsLoading: boolean;
  isSavingSettings: boolean;
  handleSettingsChange: (key: keyof CacheSettings, value: number | boolean) => void;
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
      <CachePathCard
        refreshTrigger={pathRefreshTrigger}
        onPathChanged={onPathChanged}
      />
    </div>
  );
}
