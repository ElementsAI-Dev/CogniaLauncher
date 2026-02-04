'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
        <Separator />
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="resolve-strategy">{t('settings.resolveStrategy')}</Label>
            <p id="resolve-strategy-desc" className="text-sm text-muted-foreground">
              {t('settings.resolveStrategyDesc')}
            </p>
          </div>
          <Select
            value={localConfig['general.resolve_strategy'] || 'latest'}
            onValueChange={(value) => onValueChange('general.resolve_strategy', value)}
          >
            <SelectTrigger id="resolve-strategy" className="w-48" aria-describedby="resolve-strategy-desc">
              <SelectValue placeholder={t('settings.resolveStrategy')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">{t('settings.resolveLatest')}</SelectItem>
              <SelectItem value="minimal">{t('settings.resolveMinimal')}</SelectItem>
              <SelectItem value="locked">{t('settings.resolveLocked')}</SelectItem>
              <SelectItem value="prefer-locked">{t('settings.resolvePreferLocked')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Separator />
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="auto-update-metadata">{t('settings.autoUpdateMetadata')}</Label>
            <p id="auto-update-metadata-desc" className="text-sm text-muted-foreground">
              {t('settings.autoUpdateMetadataDesc')}
            </p>
          </div>
          <Switch
            id="auto-update-metadata"
            aria-describedby="auto-update-metadata-desc"
            checked={localConfig['general.auto_update_metadata'] !== 'false'}
            onCheckedChange={(checked) => onValueChange('general.auto_update_metadata', checked.toString())}
          />
        </div>
      </CardContent>
    </Card>
  );
}
