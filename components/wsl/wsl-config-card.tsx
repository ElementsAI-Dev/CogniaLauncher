'use client';

import { useState } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings2, Save, RefreshCw, Plus, Trash2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { COMMON_WSL2_SETTINGS, NETWORK_PRESETS } from '@/lib/constants/wsl';
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

  const wsl2Config = config?.['wsl2'] ?? {};
  const experimentalConfig = config?.['experimental'] ?? {};

  const handleSave = async (section: string, key: string, value: string) => {
    if (!key.trim() || !value.trim()) return;
    setSaving(true);
    try {
      await onSetConfig(section, key.trim(), value.trim());
      toast.success(t('wsl.config.saved'));
      setEditKey('');
      setEditValue('');
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (section: string, key: string) => {
    setSaving(true);
    try {
      await onSetConfig(section, key);
      toast.success(t('wsl.config.removed'));
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleQuickSet = async (section: string, key: string, value: string) => {
    await handleSave(section, key, value);
  };

  const handleApplyPreset = async (presetId: string) => {
    const preset = NETWORK_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSaving(true);
    try {
      for (const s of preset.settings) {
        await onSetConfig(s.section, s.key, s.value);
      }
      toast.success(t('wsl.config.presetApplied'));
      await onRefresh();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  };

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
                disabled={loading}
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
          <p className="text-sm text-muted-foreground">{t('wsl.config.empty')}</p>
        ) : (
          <div className="space-y-2">
            {allEntries.map(({ section, key, value }) => (
              <div
                key={`${section}-${key}`}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {section}
                    </Badge>
                    <span className="text-sm font-medium truncate">{key}</span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                    {value}
                  </p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemove(section, key)}
                      disabled={saving}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('common.delete')}</TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>
        )}

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
          <div className="grid grid-cols-2 gap-3 mt-3">
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
                          />
                          <span className="text-xs text-muted-foreground">
                            {currentValue ?? setting.placeholder}
                          </span>
                        </div>
                      ) : setting.type === 'select' && setting.options ? (
                        <Select
                          value={currentValue || ''}
                          onValueChange={(val) => handleQuickSet(sec, setting.key, val)}
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
                      ) : (
                        <Input
                          className="h-7 text-xs"
                          placeholder={currentValue || setting.placeholder}
                          defaultValue={currentValue ?? ''}
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
          <div className="flex gap-2">
            <Select value={editSection} onValueChange={setEditSection}>
              <SelectTrigger className="w-[110px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wsl2">wsl2</SelectItem>
                <SelectItem value="experimental">experimental</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="h-8 text-xs flex-1"
              placeholder={t('wsl.config.keyPlaceholder')}
              value={editKey}
              onChange={(e) => setEditKey(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Input
              className="h-8 text-xs flex-1"
              placeholder={t('wsl.config.valuePlaceholder')}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && editKey && editValue) {
                  handleSave(editSection, editKey, editValue);
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              disabled={!editKey || !editValue || saving}
              onClick={() => handleSave(editSection, editKey, editValue)}
            >
              {saving ? <Save className="h-3.5 w-3.5 animate-pulse" /> : <Plus className="h-3.5 w-3.5" />}
              {t('common.add')}
            </Button>
          </div>
          </CollapsibleContent>
        </Collapsible>

        <p className="text-[10px] text-muted-foreground">
          {t('wsl.config.restartNote')}
        </p>
      </CardContent>
    </Card>
  );
}
