'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Scan, Zap, Gauge, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { isTauri } from '@/lib/tauri';
import type { CacheScanSettings, ScanPreset, ScanPresetInfo } from '@/lib/tauri';

const PRESET_ICONS: Record<string, typeof Zap> = {
  quick: Zap,
  standard: Gauge,
  deep: Search,
};

const PRESET_BADGES: Record<string, string> = {
  quick: 'bg-green-500/10 text-green-600 border-green-500/20',
  standard: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  deep: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
};

const CATEGORY_OPTIONS = [
  { id: 'package_manager', label: 'cache.categoryPackageManager' },
  { id: 'devtools', label: 'cache.categoryDevtools' },
  { id: 'system', label: 'cache.categorySystem' },
  { id: 'terminal', label: 'cache.categoryTerminal' },
];

export function CacheScanSettings() {
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [presets, setPresets] = useState<ScanPresetInfo[]>([]);
  const [settings, setSettings] = useState<CacheScanSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customExpanded, setCustomExpanded] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    (async () => {
      const tauri = await import('@/lib/tauri');
      const [presetsResult, settingsResult] = await Promise.all([
        tauri.getScanPresets(),
        tauri.getScanSettings(),
      ]);
      if (cancelled) return;
      setPresets(presetsResult);
      setSettings(settingsResult);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handlePresetSelect = useCallback(async (presetId: string) => {
    if (!isTauri() || !settings) return;
    const tauri = await import('@/lib/tauri');
    const updated = await tauri.setScanPreset(presetId);
    setSettings(updated);
    setDirty(false);
  }, [settings]);

  const handleCustomChange = useCallback(<K extends keyof CacheScanSettings>(
    key: K,
    value: CacheScanSettings[K],
  ) => {
    setSettings((prev) => {
      if (!prev) return prev;
      return { ...prev, preset: 'custom' as ScanPreset, [key]: value };
    });
    setDirty(true);
  }, []);

  const handleCategoryToggle = useCallback((categoryId: string) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const current = prev.category_filter ?? [];
      const next = current.includes(categoryId)
        ? current.filter((c) => c !== categoryId)
        : [...current, categoryId];
      return { ...prev, preset: 'custom' as ScanPreset, category_filter: next };
    });
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!isTauri() || !settings) return;
    setSaving(true);
    try {
      const tauri = await import('@/lib/tauri');
      await tauri.setScanSettings(settings);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [settings]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!settings) return null;

  const activePreset = settings.preset;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Scan className="h-4 w-4" />
          {t('cache.scanSettings')}
        </CardTitle>
        <CardDescription className="text-xs">{t('cache.scanSettingsDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preset selector */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t('cache.scanPreset')}
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {presets.map((preset) => {
              const Icon = PRESET_ICONS[preset.id] ?? Gauge;
              const isActive = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetSelect(preset.id)}
                  className={`
                    flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors
                    ${isActive
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:border-primary/40 hover:bg-muted/50'}
                  `}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-xs font-medium">{preset.displayName}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${PRESET_BADGES[preset.id] ?? ''}`}
                  >
                    {preset.id === 'quick' ? `${preset.config.probe_timeout_ms}ms` : ''}
                    {preset.id === 'standard' ? t('cache.scanPresetDefault') : ''}
                    {preset.id === 'deep' ? `${preset.config.probe_timeout_ms}ms` : ''}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Custom parameters toggle */}
        <button
          type="button"
          onClick={() => setCustomExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground uppercase tracking-wider"
        >
          {t('cache.scanCustomParams')}
          {customExpanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>

        {customExpanded && (
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="scan-timeout" className="text-xs">
                {t('cache.scanProbeTimeout')}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="scan-timeout"
                  type="number"
                  min={50}
                  max={10000}
                  value={settings.probe_timeout_ms}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 50) {
                      handleCustomChange('probe_timeout_ms', val);
                    }
                  }}
                  className="h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground shrink-0">ms</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="scan-concurrency" className="text-xs">
                {t('cache.scanConcurrency')}
              </Label>
              <Input
                id="scan-concurrency"
                type="number"
                min={1}
                max={16}
                value={settings.probe_concurrency}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val >= 1 && val <= 16) {
                    handleCustomChange('probe_concurrency', val);
                  }
                }}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="scan-depth" className="text-xs">
                {t('cache.scanMaxDepth')}
              </Label>
              <Input
                id="scan-depth"
                type="number"
                min={1}
                max={50}
                value={settings.size_calc_max_depth}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val >= 1 && val <= 50) {
                    handleCustomChange('size_calc_max_depth', val);
                  }
                }}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="scan-size-timeout" className="text-xs">
                {t('cache.scanSizeTimeout')}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="scan-size-timeout"
                  type="number"
                  min={1}
                  max={120}
                  value={settings.size_calc_timeout_secs}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 1) {
                      handleCustomChange('size_calc_timeout_secs', val);
                    }
                  }}
                  className="h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground shrink-0">
                  {t('cache.ttlSeconds')}
                </span>
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* Category filter */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t('cache.scanCategoryFilter')}
          </Label>
          <p className="text-xs text-muted-foreground">{t('cache.scanCategoryFilterDesc')}</p>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_OPTIONS.map((cat) => {
              const isActive =
                settings.category_filter.length === 0
                || settings.category_filter.includes(cat.id);
              return (
                <Badge
                  key={cat.id}
                  variant={isActive ? 'default' : 'outline'}
                  className="cursor-pointer text-xs select-none"
                  onClick={() => handleCategoryToggle(cat.id)}
                >
                  {t(cat.label)}
                </Badge>
              );
            })}
          </div>
          {settings.category_filter.length > 0 && (
            <button
              type="button"
              onClick={() => handleCustomChange('category_filter', [])}
              className="text-xs text-primary hover:underline"
            >
              {t('cache.scanCategoryFilterReset')}
            </button>
          )}
        </div>

        {/* Save custom settings */}
        {dirty && (
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full"
            size="sm"
          >
            {saving ? t('common.loading') : t('common.save')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
