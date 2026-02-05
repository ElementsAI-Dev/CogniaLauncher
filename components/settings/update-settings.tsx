'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { AppSettings } from '@/lib/stores/settings';

interface UpdateSettingsProps {
  appSettings: AppSettings;
  onValueChange: (key: keyof AppSettings, value: boolean) => void;
  t: (key: string) => string;
}

export function UpdateSettings({ appSettings, onValueChange, t }: UpdateSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.updates')}</CardTitle>
        <CardDescription>{t('settings.updatesDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="check-updates-on-start">{t('settings.checkUpdatesOnStart')}</Label>
            <p id="check-updates-on-start-desc" className="text-sm text-muted-foreground">
              {t('settings.checkUpdatesOnStartDesc')}
            </p>
          </div>
          <Switch
            id="check-updates-on-start"
            aria-describedby="check-updates-on-start-desc"
            checked={appSettings.checkUpdatesOnStart}
            onCheckedChange={(checked) => onValueChange('checkUpdatesOnStart', checked)}
          />
        </div>
        <Separator />
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="auto-install-updates">{t('settings.autoInstallUpdates')}</Label>
            <p id="auto-install-updates-desc" className="text-sm text-muted-foreground">
              {t('settings.autoInstallUpdatesDesc')}
            </p>
          </div>
          <Switch
            id="auto-install-updates"
            aria-describedby="auto-install-updates-desc"
            checked={appSettings.autoInstallUpdates}
            onCheckedChange={(checked) => onValueChange('autoInstallUpdates', checked)}
          />
        </div>
        <Separator />
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="notify-on-updates">{t('settings.notifyOnUpdates')}</Label>
            <p id="notify-on-updates-desc" className="text-sm text-muted-foreground">
              {t('settings.notifyOnUpdatesDesc')}
            </p>
          </div>
          <Switch
            id="notify-on-updates"
            aria-describedby="notify-on-updates-desc"
            checked={appSettings.notifyOnUpdates}
            onCheckedChange={(checked) => onValueChange('notifyOnUpdates', checked)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
