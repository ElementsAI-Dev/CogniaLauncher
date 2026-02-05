'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Globe, ChevronDown } from 'lucide-react';
import { SettingItem } from './setting-item';

interface MirrorsSettingsProps {
  localConfig: Record<string, string>;
  errors: Record<string, string | null>;
  onValueChange: (key: string, value: string) => void;
  t: (key: string) => string;
}

// Mirror presets for different regions
const MIRROR_PRESETS = {
  default: {
    labelKey: 'settings.mirrorPresetDefault',
    npm: 'https://registry.npmjs.org',
    pypi: 'https://pypi.org/simple',
    crates: 'https://crates.io',
    go: 'https://proxy.golang.org',
  },
  china: {
    labelKey: 'settings.mirrorPresetChina',
    npm: 'https://registry.npmmirror.com',
    pypi: 'https://pypi.tuna.tsinghua.edu.cn/simple',
    crates: 'https://rsproxy.cn',
    go: 'https://goproxy.cn',
  },
  aliyun: {
    labelKey: 'settings.mirrorPresetAliyun',
    npm: 'https://registry.npmmirror.com',
    pypi: 'https://mirrors.aliyun.com/pypi/simple',
    crates: 'https://rsproxy.cn',
    go: 'https://mirrors.aliyun.com/goproxy/',
  },
  ustc: {
    labelKey: 'settings.mirrorPresetUstc',
    npm: 'https://registry.npmmirror.com',
    pypi: 'https://pypi.mirrors.ustc.edu.cn/simple',
    crates: 'https://rsproxy.cn',
    go: 'https://goproxy.cn',
  },
} as const;

type PresetKey = keyof typeof MIRROR_PRESETS;

export function MirrorsSettings({ localConfig, errors, onValueChange, t }: MirrorsSettingsProps) {
  const applyPreset = (presetKey: PresetKey) => {
    const preset = MIRROR_PRESETS[presetKey];
    onValueChange('mirrors.npm', preset.npm);
    onValueChange('mirrors.pypi', preset.pypi);
    onValueChange('mirrors.crates', preset.crates);
    onValueChange('mirrors.go', preset.go);
  };

  const renderAdvancedOptions = (key: string) => {
    const enabledKey = `${key}.enabled`;
    const priorityKey = `${key}.priority`;
    const verifyKey = `${key}.verify_ssl`;

    return (
      <div className="grid gap-4 md:grid-cols-3 py-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label htmlFor={`${key}-enabled`}>{t('settings.mirrorEnabled')}</Label>
            <Switch
              id={`${key}-enabled`}
              checked={localConfig[enabledKey] !== 'false'}
              onCheckedChange={(checked) => onValueChange(enabledKey, checked.toString())}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t('settings.mirrorEnabledDesc')}</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${key}-priority`}>{t('settings.mirrorPriority')}</Label>
          <Input
            id={`${key}-priority`}
            type="number"
            value={localConfig[priorityKey] || '0'}
            onChange={(event) => onValueChange(priorityKey, event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t('settings.mirrorPriorityDesc')}</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label htmlFor={`${key}-verify`}>{t('settings.mirrorVerifySsl')}</Label>
            <Switch
              id={`${key}-verify`}
              checked={localConfig[verifyKey] !== 'false'}
              onCheckedChange={(checked) => onValueChange(verifyKey, checked.toString())}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t('settings.mirrorVerifySslDesc')}</p>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" aria-hidden="true" />
              {t('settings.mirrors')}
            </CardTitle>
            <CardDescription className="mt-1.5">{t('settings.mirrorsDesc')}</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {t('settings.mirrorPresets')}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('settings.selectPreset')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {Object.entries(MIRROR_PRESETS).map(([key, preset]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => applyPreset(key as PresetKey)}
                >
                  {t(preset.labelKey)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <SettingItem
          id="mirrors-npm"
          label={t('settings.npmRegistry')}
          description={t('settings.npmRegistryDesc')}
          value={localConfig['mirrors.npm'] || 'https://registry.npmjs.org'}
          onChange={(v) => onValueChange('mirrors.npm', v)}
          placeholder="https://registry.npmjs.org"
          error={errors['mirrors.npm']}
        />
        {renderAdvancedOptions('mirrors.npm')}
        <Separator />
        <SettingItem
          id="mirrors-pypi"
          label={t('settings.pypiIndex')}
          description={t('settings.pypiIndexDesc')}
          value={localConfig['mirrors.pypi'] || 'https://pypi.org/simple'}
          onChange={(v) => onValueChange('mirrors.pypi', v)}
          placeholder="https://pypi.org/simple"
          error={errors['mirrors.pypi']}
        />
        {renderAdvancedOptions('mirrors.pypi')}
        <Separator />
        <SettingItem
          id="mirrors-crates"
          label={t('settings.cratesRegistry')}
          description={t('settings.cratesRegistryDesc')}
          value={localConfig['mirrors.crates'] || 'https://crates.io'}
          onChange={(v) => onValueChange('mirrors.crates', v)}
          placeholder="https://crates.io"
          error={errors['mirrors.crates']}
        />
        {renderAdvancedOptions('mirrors.crates')}
        <Separator />
        <SettingItem
          id="mirrors-go"
          label={t('settings.goProxy')}
          description={t('settings.goProxyDesc')}
          value={localConfig['mirrors.go'] || 'https://proxy.golang.org'}
          onChange={(v) => onValueChange('mirrors.go', v)}
          placeholder="https://proxy.golang.org"
          error={errors['mirrors.go']}
        />
        {renderAdvancedOptions('mirrors.go')}
      </CardContent>
    </Card>
  );
}
