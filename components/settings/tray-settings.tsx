'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { AppSettings } from '@/lib/stores/settings';

interface TraySettingsProps {
  appSettings: AppSettings;
  onValueChange: (key: keyof AppSettings, value: boolean) => void;
  t: (key: string) => string;
}

export function TraySettings({ appSettings, onValueChange, t }: TraySettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.tray')}</CardTitle>
        <CardDescription>{t('settings.trayDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="minimize-to-tray">{t('settings.minimizeToTray')}</Label>
            <p id="minimize-to-tray-desc" className="text-sm text-muted-foreground">
              {t('settings.minimizeToTrayDesc')}
            </p>
          </div>
          <Switch
            id="minimize-to-tray"
            aria-describedby="minimize-to-tray-desc"
            checked={appSettings.minimizeToTray}
            onCheckedChange={(checked) => onValueChange('minimizeToTray', checked)}
          />
        </div>
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="start-minimized">{t('settings.startMinimized')}</Label>
            <p id="start-minimized-desc" className="text-sm text-muted-foreground">
              {t('settings.startMinimizedDesc')}
            </p>
          </div>
          <Switch
            id="start-minimized"
            aria-describedby="start-minimized-desc"
            checked={appSettings.startMinimized}
            onCheckedChange={(checked) => onValueChange('startMinimized', checked)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
