'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
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
    name: 'Default (Official)',
    npm: 'https://registry.npmjs.org',
    pypi: 'https://pypi.org/simple',
    crates: 'https://crates.io',
  },
  china: {
    name: 'China (淘宝/清华)',
    npm: 'https://registry.npmmirror.com',
    pypi: 'https://pypi.tuna.tsinghua.edu.cn/simple',
    crates: 'https://rsproxy.cn',
  },
  aliyun: {
    name: 'Aliyun (阿里云)',
    npm: 'https://registry.npmmirror.com',
    pypi: 'https://mirrors.aliyun.com/pypi/simple',
    crates: 'https://rsproxy.cn',
  },
  ustc: {
    name: 'USTC (中科大)',
    npm: 'https://registry.npmmirror.com',
    pypi: 'https://pypi.mirrors.ustc.edu.cn/simple',
    crates: 'https://rsproxy.cn',
  },
} as const;

type PresetKey = keyof typeof MIRROR_PRESETS;

export function MirrorsSettings({ localConfig, errors, onValueChange, t }: MirrorsSettingsProps) {
  const applyPreset = (presetKey: PresetKey) => {
    const preset = MIRROR_PRESETS[presetKey];
    onValueChange('mirrors.npm', preset.npm);
    onValueChange('mirrors.pypi', preset.pypi);
    onValueChange('mirrors.crates', preset.crates);
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
                  {preset.name}
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
      </CardContent>
    </Card>
  );
}
