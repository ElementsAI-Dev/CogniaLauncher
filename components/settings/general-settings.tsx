'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { SettingItem } from './setting-item';

interface GeneralSettingsProps {
  localConfig: Record<string, string>;
  errors: Record<string, string | null>;
  onValueChange: (key: string, value: string) => void;
  t: (key: string) => string;
}

export function GeneralSettings({ localConfig, errors, onValueChange, t }: GeneralSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.general')}</CardTitle>
        <CardDescription>{t('settings.generalDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <SettingItem
          id="parallel-downloads"
          label={t('settings.parallelDownloads')}
          description={t('settings.parallelDownloadsDesc')}
          value={localConfig['general.parallel_downloads'] || '4'}
          onChange={(v) => onValueChange('general.parallel_downloads', v)}
          type="number"
          min={1}
          max={16}
          error={errors['general.parallel_downloads']}
        />
        <Separator />
        <SettingItem
          id="metadata-cache-ttl"
          label={t('settings.metadataCacheTtl')}
          description={t('settings.metadataCacheTtlDesc')}
          value={localConfig['general.metadata_cache_ttl'] || '3600'}
          onChange={(v) => onValueChange('general.metadata_cache_ttl', v)}
          type="number"
          min={60}
          max={86400}
          error={errors['general.metadata_cache_ttl']}
        />
      </CardContent>
    </Card>
  );
}
