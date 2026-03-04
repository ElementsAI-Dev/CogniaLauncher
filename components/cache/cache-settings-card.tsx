'use client';

import { useLocale } from '@/components/providers/locale-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Settings, ChevronDown } from 'lucide-react';
import type { CacheSettings } from '@/lib/tauri';

export interface CacheSettingsCardProps {
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  localSettings: CacheSettings | null;
  settingsDirty: boolean;
  loading: boolean;
  isSavingSettings: boolean;
  handleSettingsChange: (key: keyof CacheSettings, value: number | boolean) => void;
  handleSaveSettings: () => void;
}

export function CacheSettingsCard({
  settingsOpen,
  setSettingsOpen,
  localSettings,
  settingsDirty,
  loading,
  isSavingSettings,
  handleSettingsChange,
  handleSaveSettings,
}: CacheSettingsCardProps) {
  const { t } = useLocale();

  return (
    <Card>
      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <CardTitle className="text-base">{t('cache.settings')}</CardTitle>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CardDescription>{t('cache.settingsDesc')}</CardDescription>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            <Separator />

            {loading && !localSettings ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-6 w-32" />
              </div>
            ) : localSettings ? (
              <>
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="maxSize">{t('cache.maxSize')}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="maxSize"
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
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">MB</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('cache.maxSizeDesc')}</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxAge">{t('cache.maxAge')}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="maxAge"
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
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">{t('common.days')}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('cache.maxAgeDesc')}</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="metadataCacheTtl">{t('cache.metadataCacheTtl')}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="metadataCacheTtl"
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
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">{t('cache.ttlSeconds')}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('cache.metadataCacheTtlDesc')}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="autoClean">{t('cache.autoClean')}</Label>
                    <p className="text-xs text-muted-foreground">{t('cache.autoCleanDesc')}</p>
                  </div>
                  <Switch
                    id="autoClean"
                    checked={localSettings.auto_clean}
                    onCheckedChange={(checked) => handleSettingsChange('auto_clean', checked)}
                  />
                </div>

                {localSettings.auto_clean && (
                  <div className="grid gap-6 md:grid-cols-3 pl-4 border-l-2 border-muted">
                    <div className="space-y-2">
                      <Label htmlFor="autoCleanThreshold">{t('cache.autoCleanThreshold')}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="autoCleanThreshold"
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
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{t('cache.autoCleanThresholdDesc')}</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="monitorInterval">{t('cache.monitorInterval')}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="monitorInterval"
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
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">{t('cache.ttlSeconds')}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{t('cache.monitorIntervalDesc')}</p>
                    </div>

                    <div className="flex items-center justify-between md:col-span-1">
                      <div className="space-y-0.5">
                        <Label htmlFor="monitorExternal">{t('cache.monitorExternal')}</Label>
                        <p className="text-xs text-muted-foreground">{t('cache.monitorExternalDesc')}</p>
                      </div>
                      <Switch
                        id="monitorExternal"
                        checked={localSettings.monitor_external ?? false}
                        onCheckedChange={(checked) => handleSettingsChange('monitor_external', checked)}
                      />
                    </div>
                  </div>
                )}

                {settingsDirty && (
                  <div className="flex justify-end">
                    <Button
                      onClick={handleSaveSettings}
                      disabled={isSavingSettings}
                    >
                      {isSavingSettings ? t('common.loading') : t('common.save')}
                    </Button>
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
