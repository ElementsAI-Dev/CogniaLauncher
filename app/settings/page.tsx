'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useSettings } from '@/lib/hooks/use-settings';
import { useLocale } from '@/components/providers/locale-provider';
import { AlertCircle, Save, RotateCcw, Shield, Globe, Server } from 'lucide-react';
import { toast } from 'sonner';

interface SettingItemProps {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number';
}

function SettingItem({ label, description, value, onChange, type = 'text' }: SettingItemProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="space-y-0.5">
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-48"
      />
    </div>
  );
}

export default function SettingsPage() {
  const { config, loading, error, fetchConfig, updateConfigValue, resetConfig, platformInfo, fetchPlatformInfo } = useSettings();
  const { t } = useLocale();
  const [localConfig, setLocalConfig] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchConfig();
    fetchPlatformInfo();
  }, [fetchConfig, fetchPlatformInfo]);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleChange = (key: string, value: string) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      for (const [key, value] of Object.entries(localConfig)) {
        if (config[key] !== value) {
          await updateConfigValue(key, value);
        }
      }
      toast.success('Settings saved successfully');
      setHasChanges(false);
    } catch (err) {
      toast.error(`Failed to save settings: ${err}`);
    }
  };

  const handleReset = async () => {
    try {
      await resetConfig();
      toast.success('Settings reset to defaults');
      setHasChanges(false);
    } catch (err) {
      toast.error(`Failed to reset settings: ${err}`);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t('settings.title')}</h1>
          <p className="text-muted-foreground">{t('settings.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={loading}>
            <RotateCcw className="h-4 w-4 mr-2" />
            {t('common.reset')}
          </Button>
          <Button onClick={handleSave} disabled={loading || !hasChanges}>
            <Save className="h-4 w-4 mr-2" />
            {t('settings.saveChanges')}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.general')}</CardTitle>
          <CardDescription>{t('settings.generalDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <SettingItem
            label={t('settings.parallelDownloads')}
            description={t('settings.parallelDownloadsDesc')}
            value={localConfig['general.parallel_downloads'] || '4'}
            onChange={(v) => handleChange('general.parallel_downloads', v)}
            type="number"
          />
          <Separator />
          <SettingItem
            label={t('settings.metadataCacheTtl')}
            description={t('settings.metadataCacheTtlDesc')}
            value={localConfig['general.metadata_cache_ttl'] || '3600'}
            onChange={(v) => handleChange('general.metadata_cache_ttl', v)}
            type="number"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.network')}</CardTitle>
          <CardDescription>{t('settings.networkDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <SettingItem
            label={t('settings.timeout')}
            description={t('settings.timeoutDesc')}
            value={localConfig['network.timeout'] || '30'}
            onChange={(v) => handleChange('network.timeout', v)}
            type="number"
          />
          <Separator />
          <SettingItem
            label={t('settings.retries')}
            description={t('settings.retriesDesc')}
            value={localConfig['network.retries'] || '3'}
            onChange={(v) => handleChange('network.retries', v)}
            type="number"
          />
          <Separator />
          <SettingItem
            label={t('settings.proxy')}
            description={t('settings.proxyDesc')}
            value={localConfig['network.proxy'] || ''}
            onChange={(v) => handleChange('network.proxy', v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('settings.security')}
          </CardTitle>
          <CardDescription>{t('settings.securityDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label htmlFor="allow-http">{t('settings.allowHttp')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.allowHttpDesc')}
              </p>
            </div>
            <Switch
              id="allow-http"
              checked={localConfig['security.allow_http'] === 'true'}
              onCheckedChange={(checked) => {
                handleChange('security.allow_http', checked.toString());
              }}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label htmlFor="verify-certs">{t('settings.verifyCerts')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.verifyCertsDesc')}
              </p>
            </div>
            <Switch
              id="verify-certs"
              checked={localConfig['security.verify_certificates'] !== 'false'}
              onCheckedChange={(checked) => {
                handleChange('security.verify_certificates', checked.toString());
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('settings.mirrors')}
          </CardTitle>
          <CardDescription>{t('settings.mirrorsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <SettingItem
            label={t('settings.npmRegistry')}
            description={t('settings.npmRegistryDesc')}
            value={localConfig['mirrors.npm'] || 'https://registry.npmjs.org'}
            onChange={(v) => handleChange('mirrors.npm', v)}
          />
          <Separator />
          <SettingItem
            label={t('settings.pypiIndex')}
            description={t('settings.pypiIndexDesc')}
            value={localConfig['mirrors.pypi'] || 'https://pypi.org/simple'}
            onChange={(v) => handleChange('mirrors.pypi', v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            {t('settings.systemInfo')}
          </CardTitle>
          <CardDescription>{t('settings.systemInfoDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">{t('settings.operatingSystem')}</p>
                <p className="font-medium">{platformInfo?.os || t('common.unknown')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('settings.architecture')}</p>
                <p className="font-medium">{platformInfo?.arch || t('common.unknown')}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
