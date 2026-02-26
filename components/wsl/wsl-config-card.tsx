'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings2, Save, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { WslConfig } from '@/types/tauri';

interface WslConfigCardProps {
  config: WslConfig | null;
  loading: boolean;
  onRefresh: () => Promise<void>;
  onSetConfig: (section: string, key: string, value?: string) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

type SettingType = 'text' | 'bool' | 'select';

interface WslSettingDef {
  key: string;
  label: string;
  placeholder: string;
  description: string;
  type: SettingType;
  options?: string[];
}

const COMMON_WSL2_SETTINGS: WslSettingDef[] = [
  { key: 'memory', label: 'Memory', placeholder: '4GB', description: 'wsl.config.memoryDesc', type: 'text' },
  { key: 'processors', label: 'Processors', placeholder: '2', description: 'wsl.config.processorsDesc', type: 'text' },
  { key: 'swap', label: 'Swap', placeholder: '8GB', description: 'wsl.config.swapDesc', type: 'text' },
  { key: 'localhostForwarding', label: 'Localhost Forwarding', placeholder: 'true', description: 'wsl.config.localhostForwardingDesc', type: 'bool' },
  { key: 'nestedVirtualization', label: 'Nested Virtualization', placeholder: 'true', description: 'wsl.config.nestedVirtualizationDesc', type: 'bool' },
  { key: 'guiApplications', label: 'GUI Applications', placeholder: 'true', description: 'wsl.config.guiApplicationsDesc', type: 'bool' },
  { key: 'networkingMode', label: 'Networking Mode', placeholder: 'NAT', description: 'wsl.config.networkingModeDesc', type: 'select', options: ['NAT', 'mirrored', 'virtioproxy'] },
  { key: 'autoMemoryReclaim', label: 'Auto Memory Reclaim', placeholder: 'disabled', description: 'wsl.config.autoMemoryReclaimDesc', type: 'select', options: ['disabled', 'gradual', 'dropcache'] },
  { key: 'sparseVhd', label: 'Sparse VHD', placeholder: 'true', description: 'wsl.config.sparseVhdDesc', type: 'bool' },
  { key: 'dnsTunneling', label: 'DNS Tunneling', placeholder: 'true', description: 'wsl.config.dnsTunnelingDesc', type: 'bool' },
  { key: 'firewall', label: 'Firewall', placeholder: 'true', description: 'wsl.config.firewallDesc', type: 'bool' },
];

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

  const handleQuickSet = async (key: string, value: string) => {
    await handleSave('wsl2', key, value);
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          {t('wsl.config.title')}
        </CardTitle>
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
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">{t('wsl.config.quickSettings')}</p>
          <div className="grid grid-cols-2 gap-3">
            {COMMON_WSL2_SETTINGS.map((setting) => {
              const currentValue = wsl2Config[setting.key];
              return (
                <Tooltip key={setting.key}>
                  <TooltipTrigger asChild>
                    <div className="space-y-1">
                      <Label className="text-xs">{setting.label}</Label>
                      {setting.type === 'bool' ? (
                        <div className="flex items-center gap-2 h-7">
                          <Switch
                            checked={currentValue === 'true'}
                            onCheckedChange={(checked) =>
                              handleQuickSet(setting.key, checked ? 'true' : 'false')
                            }
                          />
                          <span className="text-xs text-muted-foreground">
                            {currentValue ?? setting.placeholder}
                          </span>
                        </div>
                      ) : setting.type === 'select' && setting.options ? (
                        <Select
                          value={currentValue || ''}
                          onValueChange={(val) => handleQuickSet(setting.key, val)}
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
                              if (input.value) handleQuickSet(setting.key, input.value);
                            }
                          }}
                          onBlur={(e) => {
                            if (e.target.value && e.target.value !== currentValue) {
                              handleQuickSet(setting.key, e.target.value);
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
        </div>

        <Separator />
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t('wsl.config.addCustom')}</p>
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
        </div>

        <p className="text-[10px] text-muted-foreground">
          {t('wsl.config.restartNote')}
        </p>
      </CardContent>
    </Card>
  );
}
