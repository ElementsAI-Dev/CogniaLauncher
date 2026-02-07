'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings, Plus, Trash2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { WslDistroConfig } from '@/types/tauri';

interface WslDistroConfigCardProps {
  distroName: string;
  getDistroConfig: (distro: string) => Promise<WslDistroConfig | null>;
  setDistroConfigValue: (distro: string, section: string, key: string, value?: string) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

interface QuickSetting {
  section: string;
  key: string;
  labelKey: string;
  descKey: string;
  type: 'boolean';
  defaultValue: string;
}

const QUICK_SETTINGS: QuickSetting[] = [
  { section: 'boot', key: 'systemd', labelKey: 'wsl.distroConfig.systemd', descKey: 'wsl.distroConfig.systemdDesc', type: 'boolean', defaultValue: 'false' },
  { section: 'automount', key: 'enabled', labelKey: 'wsl.distroConfig.automount', descKey: 'wsl.distroConfig.automountDesc', type: 'boolean', defaultValue: 'true' },
  { section: 'interop', key: 'enabled', labelKey: 'wsl.distroConfig.interop', descKey: 'wsl.distroConfig.interopDesc', type: 'boolean', defaultValue: 'true' },
];

export function WslDistroConfigCard({
  distroName,
  getDistroConfig,
  setDistroConfigValue,
  t,
}: WslDistroConfigCardProps) {
  const [config, setConfig] = useState<WslDistroConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [customKey, setCustomKey] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [customSection, setCustomSection] = useState('wsl2');

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await getDistroConfig(distroName);
    setConfig(result);
    setLoading(false);
  }, [distroName, getDistroConfig]);

  useEffect(() => {
    let cancelled = false;
    getDistroConfig(distroName).then((result) => {
      if (!cancelled) {
        setConfig(result);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [distroName, getDistroConfig]);

  const handleToggle = async (section: string, key: string, currentValue: string) => {
    const newValue = currentValue === 'true' ? 'false' : 'true';
    await setDistroConfigValue(distroName, section, key, newValue);
    await refresh();
  };

  const handleAddCustom = async () => {
    if (!customKey.trim()) return;
    await setDistroConfigValue(distroName, customSection, customKey.trim(), customValue.trim());
    setCustomKey('');
    setCustomValue('');
    await refresh();
  };

  const handleRemove = async (section: string, key: string) => {
    await setDistroConfigValue(distroName, section, key);
    await refresh();
  };

  const getValue = (section: string, key: string, defaultValue: string): string => {
    return config?.[section]?.[key] ?? defaultValue;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Collect all non-quick-setting entries for display
  const quickSettingKeys = new Set(QUICK_SETTINGS.map(s => `${s.section}.${s.key}`));
  const customEntries: { section: string; key: string; value: string }[] = [];
  if (config) {
    for (const [section, entries] of Object.entries(config)) {
      for (const [key, value] of Object.entries(entries)) {
        if (!quickSettingKeys.has(`${section}.${key}`)) {
          customEntries.push({ section, key, value });
        }
      }
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          {t('wsl.distroConfig.title')} — {distroName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="default" className="bg-muted/50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {t('wsl.distroConfig.restartNote')}
          </AlertDescription>
        </Alert>

        {/* Quick Settings */}
        <div className="space-y-3">
          {QUICK_SETTINGS.map((setting) => {
            const value = getValue(setting.section, setting.key, setting.defaultValue);
            return (
              <div key={`${setting.section}.${setting.key}`} className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">{t(setting.labelKey)}</Label>
                  <p className="text-xs text-muted-foreground">{t(setting.descKey)}</p>
                </div>
                <Switch
                  checked={value === 'true'}
                  onCheckedChange={() => handleToggle(setting.section, setting.key, value)}
                />
              </div>
            );
          })}
        </div>

        {/* Custom entries */}
        {customEntries.length > 0 && (
          <div className="space-y-2">
            {customEntries.map(({ section, key, value }) => (
              <div key={`${section}.${key}`} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground font-mono">[{section}]</span>
                <span className="font-mono">{key}</span>
                <span className="text-muted-foreground">=</span>
                <span className="font-mono flex-1">{value}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => handleRemove(section, key)}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add custom setting */}
        <div className="flex items-end gap-2">
          <div className="w-24">
            <Label className="text-xs">Section</Label>
            <Input
              value={customSection}
              onChange={(e) => setCustomSection(e.target.value)}
              placeholder="wsl2"
              className="h-8 text-xs"
            />
          </div>
          <div className="flex-1">
            <Label className="text-xs">Key</Label>
            <Input
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              placeholder={t('wsl.config.keyPlaceholder')}
              className="h-8 text-xs"
            />
          </div>
          <div className="flex-1">
            <Label className="text-xs">Value</Label>
            <Input
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder={t('wsl.config.valuePlaceholder')}
              className="h-8 text-xs"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            onClick={handleAddCustom}
            disabled={!customKey.trim()}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
