'use client';

import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings2, Save, RefreshCw, Plus, Trash2, ChevronDown, FileSliders } from 'lucide-react';
import { toast } from 'sonner';
import { COMMON_WSL2_SETTINGS, NETWORK_PRESETS, CONFIG_PROFILES } from '@/lib/constants/wsl';
import { useWslStore } from '@/lib/stores/wsl';
import {
  normalizeWslCustomConfigInput,
  validateWslCustomConfigInput,
} from '@/lib/wsl/config-validation';
import type { WslConfigCardProps } from '@/types/wsl';

export function WslConfigCard({
  config,
  loading,
  onRefresh,
  onSetConfig,
  t,
}: WslConfigCardProps) {
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editSection, setEditSection] = useState('wsl2');
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const customKeyInputRef = useRef<HTMLInputElement | null>(null);
  const mutationInFlightRef = useRef(false);
  const { customProfiles, addCustomProfile, removeCustomProfile } = useWslStore();

  const wsl2Config = config?.['wsl2'] ?? {};
  const experimentalConfig = config?.['experimental'] ?? {};

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

  const handleSave = useCallback(
    async (
      section: string,
      key: string,
      value: string,
      options?: { clearCustomInputs?: boolean },
    ): Promise<boolean> => {
      const normalized = normalizeWslCustomConfigInput({ section, key, value });
      if (!normalized.key || !normalized.value) return false;

      const saved = await runWithSaving(async () => {
        await onSetConfig(normalized.section, normalized.key, normalized.value);
        toast.success(t('wsl.config.saved'));
      });

      if (saved && options?.clearCustomInputs) {
        setEditKey('');
        setEditValue('');
        setAddError(null);
        requestAnimationFrame(() => {
          customKeyInputRef.current?.focus();
        });
      }

      return saved;
    },
    [onSetConfig, runWithSaving, t],
  );

  const handleRemove = useCallback(async (section: string, key: string) => {
    const normalized = normalizeWslCustomConfigInput({ section, key });
    if (!normalized.key) return;
    await runWithSaving(async () => {
      await onSetConfig(normalized.section, normalized.key);
      toast.success(t('wsl.config.removed'));
    });
  }, [onSetConfig, runWithSaving, t]);

  const handleQuickSet = useCallback(async (section: string, key: string, value: string) => {
    const setting = COMMON_WSL2_SETTINGS.find((s) => s.key === key && (s.section ?? 'wsl2') === section);
    if (setting?.validate) {
      const error = setting.validate(value);
      if (error) {
        toast.error(error);
        return;
      }
    }
    await handleSave(section, key, value);
  }, [handleSave]);

  const handleApplyPreset = useCallback(async (presetId: string) => {
    const preset =
      NETWORK_PRESETS.find((p) => p.id === presetId)
      ?? CONFIG_PROFILES.find((p) => p.id === presetId)
      ?? customProfiles.find((p) => p.id === presetId);
    if (!preset) return;
    await runWithSaving(async () => {
      for (const s of preset.settings) {
        await onSetConfig(s.section, s.key, s.value);
      }
      toast.success(t('wsl.config.presetApplied'));
      await onRefresh();
    });
  }, [customProfiles, onRefresh, onSetConfig, runWithSaving, t]);

  const handleAddCustom = useCallback(async () => {
    const normalized = normalizeWslCustomConfigInput({
      section: editSection,
      key: editKey,
      value: editValue,
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
    await handleSave(normalized.section, normalized.key, normalized.value, {
      clearCustomInputs: true,
    });
  }, [config, editKey, editSection, editValue, handleSave, t]);

  const handleCustomInputEnter = useCallback(
    async (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      await handleAddCustom();
    },
    [handleAddCustom],
  );

  if (loading && !config) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-36" />
        </CardContent>
      </Card>
    );
  }

  const allEntries = [
    ...Object.entries(wsl2Config).map(([k, v]) => ({ section: 'wsl2', key: k, value: v })),
    ...Object.entries(experimentalConfig).map(([k, v]) => ({ section: 'experimental', key: k, value: v })),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          {t('wsl.config.title')}
        </CardTitle>
        <CardAction>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
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
        {allEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileSliders className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">{t('wsl.config.empty')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {allEntries.map(({ section, key, value }) => (
              <div
                key={`${section}-${key}`}
                className="flex items-start justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {section}
                    </Badge>
                    <span className="text-sm font-medium truncate">{key}</span>
                  </div>
                  <p className="mt-0.5 break-all text-xs text-muted-foreground font-mono">
                    {value}
                  </p>
                </div>
                <AlertDialog>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          disabled={saving}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>{t('common.delete')}</TooltipContent>
                  </Tooltip>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('wsl.config.confirmRemoveEntry', { section, key })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleRemove(section, key)}>
                        {t('common.delete')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}

        <Separator />
        <Collapsible>
          <CollapsibleTrigger className="flex items-center justify-between w-full group">
            <p className="text-xs font-medium text-muted-foreground">{t('wsl.config.resourceProfiles')}</p>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid gap-2 mt-3">
              {CONFIG_PROFILES.map((profile) => (
                <Tooltip key={profile.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-xs"
                      onClick={() => handleApplyPreset(profile.id)}
                      disabled={saving}
                    >
                      {t(profile.labelKey)}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[320px]">
                    <p className="text-xs font-medium mb-1">{t(profile.descKey)}</p>
                    {profile.settings.length > 0 && (
                      <div className="text-[10px] text-muted-foreground space-y-0.5">
                        {profile.settings.slice(0, 5).map((s) => (
                          <div key={`${s.section}-${s.key}`} className="font-mono">
                            [{s.section}] {s.key} = {s.value}
                          </div>
                        ))}
                        {profile.settings.length > 5 && (
                          <div>+{profile.settings.length - 5} more</div>
                        )}
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              ))}
              {customProfiles.map((profile) => (
                <div key={profile.id} className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 justify-start text-xs"
                        onClick={() => handleApplyPreset(profile.id)}
                        disabled={saving}
                      >
                        {profile.labelKey}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[320px]">
                      <p className="text-xs font-medium mb-1">{profile.descKey}</p>
                      {profile.settings.length > 0 && (
                        <div className="text-[10px] text-muted-foreground space-y-0.5">
                          {profile.settings.slice(0, 5).map((s) => (
                            <div key={`${s.section}-${s.key}`} className="font-mono">
                              [{s.section}] {s.key} = {s.value}
                            </div>
                          ))}
                          {profile.settings.length > 5 && (
                            <div>+{profile.settings.length - 5} more</div>
                          )}
                        </div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        disabled={saving}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('wsl.config.confirmRemoveProfile', { name: profile.labelKey })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => removeCustomProfile(profile.id)}>
                          {t('common.delete')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <Input
                className="h-7 text-xs flex-1"
                placeholder={t('wsl.config.profileNamePlaceholder')}
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={!profileName.trim() || !config || saving}
                onClick={() => {
                  if (!profileName.trim() || !config) return;
                  const settings: { section: 'wsl2' | 'experimental'; key: string; value: string }[] = [];
                  for (const [section, entries] of Object.entries(config)) {
                    if (section === 'wsl2' || section === 'experimental') {
                      for (const [key, value] of Object.entries(entries)) {
                        settings.push({ section: section as 'wsl2' | 'experimental', key, value });
                      }
                    }
                  }
                  addCustomProfile({
                    id: `custom-${Date.now()}`,
                    labelKey: profileName.trim(),
                    descKey: `${settings.length} settings`,
                    settings,
                  });
                  setProfileName('');
                  toast.success(t('wsl.config.profileSaved'));
                }}
              >
                <Save className="h-3 w-3" />
                {t('wsl.config.saveProfile')}
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />
        <Collapsible>
          <CollapsibleTrigger className="flex items-center justify-between w-full group">
            <p className="text-xs font-medium text-muted-foreground">{t('wsl.config.networkPresets')}</p>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid gap-2 mt-3">
              {NETWORK_PRESETS.map((preset) => (
                <Tooltip key={preset.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-xs"
                      onClick={() => handleApplyPreset(preset.id)}
                      disabled={saving}
                    >
                      {t(preset.labelKey)}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[280px]">
                    <p className="text-xs">{t(preset.descKey)}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="flex items-center justify-between w-full group">
            <p className="text-xs font-medium text-muted-foreground">{t('wsl.config.quickSettings')}</p>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
          <div
            data-testid="wsl-config-quick-settings-grid"
            className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {COMMON_WSL2_SETTINGS.map((setting) => {
              const sec = setting.section ?? 'wsl2';
              const sectionConfig = sec === 'experimental' ? experimentalConfig : wsl2Config;
              const currentValue = sectionConfig[setting.key];
              return (
                <Tooltip key={`${sec}-${setting.key}`}>
                  <TooltipTrigger asChild>
                    <div className="space-y-1">
                      <Label className="text-xs">{setting.label}</Label>
                      {setting.type === 'bool' ? (
                        <div className="flex items-center gap-2 h-7">
                          <Switch
                            checked={currentValue === 'true'}
                            onCheckedChange={(checked) =>
                              handleQuickSet(sec, setting.key, checked ? 'true' : 'false')
                            }
                            disabled={saving}
                          />
                          <span className="text-xs text-muted-foreground">
                            {currentValue ?? setting.placeholder}
                          </span>
                        </div>
                      ) : setting.type === 'select' && setting.options ? (
                        <Select
                          value={currentValue || ''}
                          onValueChange={(val) => handleQuickSet(sec, setting.key, val)}
                          disabled={saving}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder={setting.placeholder} />
                          </SelectTrigger>
                          <SelectContent>
                            {setting.options.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : setting.type === 'path' ? (
                        <div className="flex gap-1">
                          <Input
                            className="h-7 text-xs flex-1"
                            placeholder={currentValue || setting.placeholder}
                            defaultValue={currentValue ?? ''}
                            disabled={saving}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const input = e.target as HTMLInputElement;
                                if (input.value) handleQuickSet(sec, setting.key, input.value);
                              }
                            }}
                            onBlur={(e) => {
                              if (e.target.value && e.target.value !== currentValue) {
                                handleQuickSet(sec, setting.key, e.target.value);
                              }
                            }}
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            disabled={saving}
                            onClick={async () => {
                              try {
                                const { open } = await import('@tauri-apps/plugin-dialog');
                                const selected = await open({ multiple: false });
                                if (selected) handleQuickSet(sec, setting.key, String(selected));
                              } catch { /* not in Tauri */ }
                            }}
                          >
                            <span className="text-xs">…</span>
                          </Button>
                        </div>
                      ) : (
                        <Input
                          className="h-7 text-xs"
                          type={setting.type === 'number' ? 'number' : 'text'}
                          placeholder={currentValue || setting.placeholder}
                          defaultValue={currentValue ?? ''}
                          disabled={saving}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const input = e.target as HTMLInputElement;
                              if (input.value) handleQuickSet(sec, setting.key, input.value);
                            }
                          }}
                          onBlur={(e) => {
                            if (e.target.value && e.target.value !== currentValue) {
                              handleQuickSet(sec, setting.key, e.target.value);
                            }
                          }}
                        />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[240px]">
                    <p className="text-xs">{t(setting.description)}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="flex items-center justify-between w-full group">
            <p className="text-xs font-medium text-muted-foreground">{t('wsl.config.addCustom')}</p>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div
              data-testid="wsl-config-custom-form"
              className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(110px,140px)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
            >
              <div className="min-w-0 space-y-1">
                <Label className="text-xs">{t('wsl.config.sectionLabel')}</Label>
                <Select
                  value={editSection}
                  onValueChange={(value) => {
                    setEditSection(value);
                    setAddError(null);
                  }}
                  disabled={saving}
                >
                  <SelectTrigger className="h-9 w-full text-xs" aria-label={t('wsl.config.sectionLabel')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wsl2">wsl2</SelectItem>
                    <SelectItem value="experimental">experimental</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 space-y-1">
                <Label className="text-xs">{t('wsl.config.keyLabel')}</Label>
                <Input
                  ref={customKeyInputRef}
                  className={`h-9 text-xs ${addError ? 'border-destructive' : ''}`}
                  placeholder={t('wsl.config.keyPlaceholder')}
                  value={editKey}
                  disabled={saving}
                  onChange={(e) => {
                    setEditKey(e.target.value);
                    setAddError(null);
                  }}
                  onKeyDown={handleCustomInputEnter}
                />
              </div>
              <div className="min-w-0 space-y-1">
                <Label className="text-xs">{t('wsl.config.valueLabel')}</Label>
                <Input
                  className={`h-9 text-xs ${addError ? 'border-destructive' : ''}`}
                  placeholder={t('wsl.config.valuePlaceholder')}
                  value={editValue}
                  disabled={saving}
                  onChange={(e) => {
                    setEditValue(e.target.value);
                    setAddError(null);
                  }}
                  onKeyDown={handleCustomInputEnter}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-full gap-1 sm:w-auto"
                disabled={!editKey.trim() || !editValue.trim() || saving}
                onClick={() => void handleAddCustom()}
              >
                {saving ? <Save className="h-3.5 w-3.5 animate-pulse" /> : <Plus className="h-3.5 w-3.5" />}
                {t('common.add')}
              </Button>
            </div>
            {addError ? (
              <p className="mt-1 text-xs text-destructive">
                {addError}
              </p>
            ) : null}
          </CollapsibleContent>
        </Collapsible>

        <p className="text-[10px] text-muted-foreground">
          {t('wsl.config.restartNote')}
        </p>
      </CardContent>
    </Card>
  );
}
