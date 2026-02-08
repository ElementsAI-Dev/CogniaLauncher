'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  HardDrive,
  Network,
  Settings,
  Info,
  FolderOpen,
  Plus,
  Trash2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { WslDistroStatus, WslDiskUsage, WslDistroConfig } from '@/types/tauri';

interface WslDistroOverviewProps {
  distroName: string;
  distro: WslDistroStatus | null;
  getDiskUsage: (name: string) => Promise<WslDiskUsage | null>;
  getIpAddress: (distro?: string) => Promise<string>;
  getDistroConfig: (distro: string) => Promise<WslDistroConfig | null>;
  setDistroConfigValue: (distro: string, section: string, key: string, value?: string) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

interface QuickSetting {
  section: string;
  key: string;
  labelKey: string;
  descKey: string;
  defaultValue: string;
}

const QUICK_SETTINGS: QuickSetting[] = [
  { section: 'boot', key: 'systemd', labelKey: 'wsl.distroConfig.systemd', descKey: 'wsl.distroConfig.systemdDesc', defaultValue: 'false' },
  { section: 'automount', key: 'enabled', labelKey: 'wsl.distroConfig.automount', descKey: 'wsl.distroConfig.automountDesc', defaultValue: 'true' },
  { section: 'interop', key: 'enabled', labelKey: 'wsl.distroConfig.interop', descKey: 'wsl.distroConfig.interopDesc', defaultValue: 'true' },
];

export function WslDistroOverview({
  distroName,
  distro,
  getDiskUsage,
  getIpAddress,
  getDistroConfig,
  setDistroConfigValue,
  t,
}: WslDistroOverviewProps) {
  const [diskUsage, setDiskUsage] = useState<WslDiskUsage | null>(null);
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const [config, setConfig] = useState<WslDistroConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [loadingDisk, setLoadingDisk] = useState(true);
  const [customSection, setCustomSection] = useState('wsl2');
  const [customKey, setCustomKey] = useState('');
  const [customValue, setCustomValue] = useState('');

  const isRunning = distro?.state.toLowerCase() === 'running';

  // Load disk usage
  useEffect(() => {
    let cancelled = false;
    setLoadingDisk(true);
    getDiskUsage(distroName)
      .then((usage) => {
        if (!cancelled) setDiskUsage(usage);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingDisk(false);
      });
    return () => { cancelled = true; };
  }, [distroName, getDiskUsage]);

  // Load IP address
  useEffect(() => {
    if (!isRunning) {
      setIpAddress(null);
      return;
    }
    let cancelled = false;
    getIpAddress(distroName)
      .then((ip) => {
        if (!cancelled) setIpAddress(ip);
      })
      .catch(() => {
        if (!cancelled) setIpAddress(null);
      });
    return () => { cancelled = true; };
  }, [distroName, isRunning, getIpAddress]);

  // Load distro config
  const refreshConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const result = await getDistroConfig(distroName);
      setConfig(result);
    } catch {
      setConfig(null);
    } finally {
      setConfigLoading(false);
    }
  }, [distroName, getDistroConfig]);

  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  const handleToggle = async (section: string, key: string, currentValue: string) => {
    const newValue = currentValue === 'true' ? 'false' : 'true';
    await setDistroConfigValue(distroName, section, key, newValue);
    await refreshConfig();
  };

  const handleAddCustom = async () => {
    if (!customKey.trim()) return;
    await setDistroConfigValue(distroName, customSection, customKey.trim(), customValue.trim());
    setCustomKey('');
    setCustomValue('');
    await refreshConfig();
  };

  const handleRemoveConfig = async (section: string, key: string) => {
    await setDistroConfigValue(distroName, section, key);
    await refreshConfig();
  };

  const getConfigValue = (section: string, key: string, defaultValue: string): string => {
    return config?.[section]?.[key] ?? defaultValue;
  };

  // Collect non-quick-setting entries
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

  const diskPercent = diskUsage && diskUsage.totalBytes > 0
    ? (diskUsage.usedBytes / diskUsage.totalBytes) * 100
    : 0;

  return (
    <div className="space-y-4">
      {/* Status Cards Row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              {t('wsl.detail.status')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={isRunning ? 'default' : 'secondary'} className="text-sm">
              {isRunning ? t('wsl.running') : t('wsl.stopped')}
            </Badge>
          </CardContent>
        </Card>

        {/* WSL Version */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('wsl.wslVersion')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">WSL {distro?.wslVersion ?? '?'}</p>
          </CardContent>
        </Card>

        {/* Disk Usage */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5" />
              {t('wsl.detail.diskUsage')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDisk ? (
              <Skeleton className="h-6 w-32" />
            ) : diskUsage && diskUsage.totalBytes > 0 ? (
              <div className="space-y-1.5">
                <p className="text-sm font-semibold">
                  {formatBytes(diskUsage.usedBytes)} / {formatBytes(diskUsage.totalBytes)}
                </p>
                <Progress value={diskPercent} className="h-2" />
                <p className="text-xs text-muted-foreground">{diskPercent.toFixed(1)}%</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>

        {/* IP Address */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Network className="h-3.5 w-3.5" />
              {t('wsl.ipAddress')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isRunning && ipAddress ? (
              <p className="text-sm font-mono font-semibold">{ipAddress}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isRunning ? '—' : t('wsl.stopped')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filesystem Path */}
      {diskUsage?.filesystemPath && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm">
              <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">{t('wsl.detail.filesystemPath')}:</span>
              <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded flex-1 truncate">
                {diskUsage.filesystemPath}
              </code>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Distribution Config (/etc/wsl.conf) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            {t('wsl.distroConfig.title')} — /etc/wsl.conf
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={refreshConfig}
            disabled={configLoading}
            className="h-8 w-8"
          >
            <RefreshCw className={`h-4 w-4 ${configLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="default" className="bg-muted/50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {t('wsl.distroConfig.restartNote')}
            </AlertDescription>
          </Alert>

          {configLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <>
              {/* Quick Settings */}
              <div className="space-y-3">
                {QUICK_SETTINGS.map((setting) => {
                  const value = getConfigValue(setting.section, setting.key, setting.defaultValue);
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
                <div className="space-y-2 border-t pt-3">
                  {customEntries.map(({ section, key, value }) => (
                    <div key={`${section}.${key}`} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="text-[10px] shrink-0">{section}</Badge>
                      <span className="font-mono">{key}</span>
                      <span className="text-muted-foreground">=</span>
                      <span className="font-mono flex-1 truncate">{value}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => handleRemoveConfig(section, key)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add custom setting */}
              <div className="flex items-end gap-2 border-t pt-3">
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
