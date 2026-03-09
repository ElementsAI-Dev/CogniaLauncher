'use client';

import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings, Plus, Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QUICK_SETTINGS } from '@/lib/constants/wsl';
import { toast } from 'sonner';
import {
  normalizeWslCustomConfigInput,
  validateWslCustomConfigInput,
} from '@/lib/wsl/config-validation';
import type { WslDistroConfigCardProps } from '@/types/wsl';
import type { WslDistroConfig } from '@/types/tauri';

export function WslDistroConfigCard({
  distroName,
  getDistroConfig,
  setDistroConfigValue,
  t,
}: WslDistroConfigCardProps) {
  const [config, setConfig] = useState<WslDistroConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [customKey, setCustomKey] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [customSection, setCustomSection] = useState('wsl2');
  const mutationInFlightRef = useRef(false);
  const customKeyInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getDistroConfig(distroName);
      setConfig(result);
    } finally {
      setLoading(false);
    }
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

  const runWithSaving = useCallback(async (action: () => Promise<void>): Promise<boolean> => {
    if (mutationInFlightRef.current) return false;
    mutationInFlightRef.current = true;
    setSaving(true);
    try {
      await action();
      return true;
    } catch (err) {
      toast.error(String(err));
      return false;
    } finally {
      mutationInFlightRef.current = false;
      setSaving(false);
    }
  }, []);

  const handleToggle = useCallback(async (section: string, key: string, currentValue: string) => {
    const newValue = currentValue === 'true' ? 'false' : 'true';
    await runWithSaving(async () => {
      await setDistroConfigValue(distroName, section, key, newValue);
      await refresh();
    });
  }, [distroName, refresh, runWithSaving, setDistroConfigValue]);

  const handleSetText = useCallback(async (section: string, key: string, value: string) => {
    const normalized = normalizeWslCustomConfigInput({ section, key, value });
    if (!normalized.section || !normalized.key) return;
    await runWithSaving(async () => {
      if (normalized.value) {
        await setDistroConfigValue(distroName, normalized.section, normalized.key, normalized.value);
      } else {
        await setDistroConfigValue(distroName, normalized.section, normalized.key);
      }
      await refresh();
    });
  }, [distroName, refresh, runWithSaving, setDistroConfigValue]);

  const handleAddCustom = useCallback(async () => {
    const normalized = normalizeWslCustomConfigInput({
      section: customSection,
      key: customKey,
      value: customValue,
    });
    const existingEntries = config?.[normalized.section] ?? null;
    const validationMessageKey = validateWslCustomConfigInput(normalized, {
      requireValue: true,
      existingEntries,
    });
    if (validationMessageKey) {
      setAddError(t(validationMessageKey, {
        section: normalized.section,
        key: normalized.key,
      }));
      return;
    }

    setAddError(null);
    const saved = await runWithSaving(async () => {
      await setDistroConfigValue(distroName, normalized.section, normalized.key, normalized.value);
      await refresh();
    });
    if (saved) {
      setCustomKey('');
      setCustomValue('');
      requestAnimationFrame(() => {
        customKeyInputRef.current?.focus();
      });
    }
  }, [config, customKey, customSection, customValue, distroName, refresh, runWithSaving, setDistroConfigValue, t]);

  const handleRemove = useCallback(async (section: string, key: string) => {
    const normalized = normalizeWslCustomConfigInput({ section, key });
    if (!normalized.key) return;
    await runWithSaving(async () => {
      await setDistroConfigValue(distroName, normalized.section, normalized.key);
      await refresh();
    });
  }, [distroName, refresh, runWithSaving, setDistroConfigValue]);

  const handleCustomInputEnter = useCallback(async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    await handleAddCustom();
  }, [handleAddCustom]);

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
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          {t('wsl.distroConfig.title')} — {distroName}
        </CardTitle>
        <CardAction>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={refresh}
                disabled={loading || saving}
                className="h-8 w-8"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('common.refresh')}</TooltipContent>
          </Tooltip>
        </CardAction>
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
              <div key={`${setting.section}.${setting.key}`} className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <Label className="text-sm">{t(setting.labelKey)}</Label>
                  <p className="text-xs text-muted-foreground">{t(setting.descKey)}</p>
                </div>
                {setting.type === 'boolean' ? (
                  <Switch
                    checked={value === 'true'}
                    onCheckedChange={() => handleToggle(setting.section, setting.key, value)}
                    disabled={saving}
                  />
                ) : setting.type === 'select' && setting.options ? (
                  <Select
                    value={value || ''}
                    onValueChange={(val) => handleSetText(setting.section, setting.key, val)}
                    disabled={saving}
                  >
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <SelectValue placeholder={setting.defaultValue} />
                    </SelectTrigger>
                    <SelectContent>
                      {setting.options.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    className="h-7 w-40 text-xs"
                    placeholder={setting.defaultValue || '...'}
                    defaultValue={config?.[setting.section]?.[setting.key] ?? ''}
                    disabled={saving}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSetText(setting.section, setting.key, (e.target as HTMLInputElement).value);
                      }
                    }}
                    onBlur={(e) => {
                      const current = config?.[setting.section]?.[setting.key] ?? '';
                      if (e.target.value !== current) {
                        handleSetText(setting.section, setting.key, e.target.value);
                      }
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Custom entries */}
        {customEntries.length > 0 && (
          <div className="space-y-2">
            {customEntries.map(({ section, key, value }) => (
              <div key={`${section}.${key}`} className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
                <span className="text-muted-foreground font-mono shrink-0">[{section}]</span>
                <span className="font-mono shrink-0">{key}</span>
                <span className="text-muted-foreground">=</span>
                <span className="font-mono min-w-0 flex-1 break-all text-xs">{value}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => handleRemove(section, key)}
                      disabled={saving}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('common.delete')}</TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>
        )}

        {/* Add custom setting */}
        <div
          data-testid="wsl-distro-config-custom-form"
          className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(110px,140px)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
        >
          <div className="min-w-0 space-y-1">
            <Label className="text-xs">{t('wsl.config.sectionLabel')}</Label>
            <Input
              value={customSection}
              onChange={(e) => {
                setCustomSection(e.target.value);
                setAddError(null);
              }}
              onKeyDown={handleCustomInputEnter}
              placeholder="wsl2"
              className="h-8 text-xs"
              disabled={saving}
            />
          </div>
          <div className="min-w-0 space-y-1">
            <Label className="text-xs">{t('wsl.config.keyLabel')}</Label>
            <Input
              ref={customKeyInputRef}
              value={customKey}
              onChange={(e) => {
                setCustomKey(e.target.value);
                setAddError(null);
              }}
              onKeyDown={handleCustomInputEnter}
              placeholder={t('wsl.config.keyPlaceholder')}
              className="h-8 text-xs"
              disabled={saving}
            />
          </div>
          <div className="min-w-0 space-y-1">
            <Label className="text-xs">{t('wsl.config.valueLabel')}</Label>
            <Input
              value={customValue}
              onChange={(e) => {
                setCustomValue(e.target.value);
                setAddError(null);
              }}
              onKeyDown={handleCustomInputEnter}
              placeholder={t('wsl.config.valuePlaceholder')}
              className="h-8 text-xs"
              disabled={saving}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-full gap-1 sm:w-auto"
            onClick={() => void handleAddCustom()}
            disabled={!customKey.trim() || !customValue.trim() || saving}
          >
            <Plus className="h-3 w-3" />
            {t('common.add')}
          </Button>
        </div>
        {addError ? <p className="text-xs text-destructive">{addError}</p> : null}
      </CardContent>
    </Card>
  );
}
