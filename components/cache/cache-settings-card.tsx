'use client';

import { useLocale } from '@/components/providers/locale-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Settings } from 'lucide-react';
import type { CacheSettings } from '@/lib/tauri';
import { CustomCacheDialog } from './custom-cache-dialog';

export interface CacheSettingsCardProps {
  localSettings: CacheSettings | null;
  settingsDirty: boolean;
  loading: boolean;
  isSavingSettings: boolean;
  handleSettingsChange: <K extends keyof CacheSettings>(
    key: K,
    value: CacheSettings[K],
  ) => void;
  handleSaveSettings: () => void;
}

export function CacheSettingsCard({
  localSettings,
  settingsDirty,
  loading,
  isSavingSettings,
  handleSettingsChange,
  handleSaveSettings,
}: CacheSettingsCardProps) {
  const { t } = useLocale();
  const excludedProvidersValue = (
    localSettings?.external_cache_excluded_providers ?? []
  ).join(', ');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Settings className="h-4 w-4" />
          {t('cache.settings')}
        </CardTitle>
        <CardDescription className="text-xs">{t('cache.settingsDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading && !localSettings ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-6 w-24" />
          </div>
        ) : localSettings ? (
          <>
            {/* General Section */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('cache.settingsGeneralTitle')}
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="sidebar-maxSize" className="text-xs">{t('cache.maxSize')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="sidebar-maxSize"
                    type="number"
                    min={100}
                    max={100000}
                    value={Math.round(localSettings.max_size / (1024 * 1024))}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 100) {
                        handleSettingsChange('max_size', val * 1024 * 1024);
                      }
                    }}
                    className="h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">MB</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sidebar-maxAge" className="text-xs">{t('cache.maxAge')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="sidebar-maxAge"
                    type="number"
                    min={1}
                    max={365}
                    value={localSettings.max_age_days}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 1) {
                        handleSettingsChange('max_age_days', val);
                      }
                    }}
                    className="h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">{t('common.days')}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sidebar-ttl" className="text-xs">{t('cache.metadataCacheTtl')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="sidebar-ttl"
                    type="number"
                    min={60}
                    max={604800}
                    value={localSettings.metadata_cache_ttl}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 60) {
                        handleSettingsChange('metadata_cache_ttl', val);
                      }
                    }}
                    className="h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">{t('cache.ttlSeconds')}</span>
                </div>
              </div>
            </div>

            {/* Auto Clean Section */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('cache.settingsAutoCleanTitle')}
              </p>

              <div className="flex items-center justify-between">
                <Label htmlFor="sidebar-autoClean" className="text-xs">{t('cache.autoClean')}</Label>
                <Switch
                  id="sidebar-autoClean"
                  checked={localSettings.auto_clean}
                  onCheckedChange={(checked) => handleSettingsChange('auto_clean', checked)}
                />
              </div>

              {localSettings.auto_clean && (
                <div className="space-y-3 pl-3 border-l-2 border-muted">
                  <div className="space-y-1.5">
                    <Label htmlFor="sidebar-threshold" className="text-xs">{t('cache.autoCleanThreshold')}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="sidebar-threshold"
                        type="number"
                        min={0}
                        max={100}
                        value={localSettings.auto_clean_threshold ?? 80}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 0 && val <= 100) {
                            handleSettingsChange('auto_clean_threshold', val);
                          }
                        }}
                        className="h-8 text-sm"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="sidebar-interval" className="text-xs">{t('cache.monitorInterval')}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="sidebar-interval"
                        type="number"
                        min={0}
                        max={86400}
                        value={localSettings.monitor_interval ?? 300}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 0) {
                            handleSettingsChange('monitor_interval', val);
                          }
                        }}
                        className="h-8 text-sm"
                      />
                      <span className="text-xs text-muted-foreground">{t('cache.ttlSeconds')}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="sidebar-monExt" className="text-xs">{t('cache.monitorExternal')}</Label>
                    <Switch
                      id="sidebar-monExt"
                      checked={localSettings.monitor_external ?? false}
                      onCheckedChange={(checked) => handleSettingsChange('monitor_external', checked)}
                    />
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('cache.settingsSupportTitle')}
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="sidebar-excludedProviders" className="text-xs">
                  {t('settings.externalCacheExcludedProviders')}
                </Label>
                <Input
                  id="sidebar-excludedProviders"
                  type="text"
                  value={excludedProvidersValue}
                  onChange={(e) => {
                    const providers = e.target.value
                      .split(',')
                      .map((item) => item.trim())
                      .filter((item) => item.length > 0);
                    handleSettingsChange('external_cache_excluded_providers', providers);
                  }}
                  placeholder={t('settings.disabledProvidersPlaceholder')}
                  className="h-8 text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {t('settings.externalCacheExcludedProvidersDesc')}
                </p>
              </div>

              <CustomCacheDialog
                entries={localSettings?.custom_cache_entries ?? []}
                onEntriesChange={(entries) => {
                  handleSettingsChange('custom_cache_entries', entries);
                }}
                t={t}
              />
            </div>

            {/* Save button */}
            {settingsDirty && (
              <Button
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
                className="w-full"
                size="sm"
              >
                {isSavingSettings ? t('common.loading') : t('common.save')}
              </Button>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
