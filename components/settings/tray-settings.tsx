'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AppSettings } from '@/lib/stores/settings';
import type { TrayClickBehavior } from '@/lib/tauri';
import {
  isTauri,
  trayIsAutostartEnabled,
  trayEnableAutostart,
  trayDisableAutostart,
  traySetClickBehavior,
} from '@/lib/tauri';

interface TraySettingsProps {
  appSettings: AppSettings;
  onValueChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  t: (key: string) => string;
}

export function TraySettings({ appSettings, onValueChange, t }: TraySettingsProps) {
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [autostartLoading, setAutostartLoading] = useState(false);

  // Sync autostart state from backend on mount
  useEffect(() => {
    if (!isTauri()) return;
    
    trayIsAutostartEnabled()
      .then(setAutostartEnabled)
      .catch(console.error);
  }, []);

  const handleAutostartChange = useCallback(async (checked: boolean) => {
    if (!isTauri()) return;
    
    setAutostartLoading(true);
    try {
      if (checked) {
        await trayEnableAutostart();
      } else {
        await trayDisableAutostart();
      }
      setAutostartEnabled(checked);
      onValueChange('autostart', checked);
    } catch (error) {
      console.error('Failed to toggle autostart:', error);
    } finally {
      setAutostartLoading(false);
    }
  }, [onValueChange]);

  const handleClickBehaviorChange = useCallback(async (value: TrayClickBehavior) => {
    if (!isTauri()) return;
    
    try {
      await traySetClickBehavior(value);
      onValueChange('trayClickBehavior', value);
    } catch (error) {
      console.error('Failed to set click behavior:', error);
    }
  }, [onValueChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.tray')}</CardTitle>
        <CardDescription>{t('settings.trayDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
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
        <Separator />
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
        <Separator />
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="autostart">{t('settings.autostart')}</Label>
            <p id="autostart-desc" className="text-sm text-muted-foreground">
              {t('settings.autostartDesc')}
            </p>
          </div>
          <Switch
            id="autostart"
            aria-describedby="autostart-desc"
            checked={autostartEnabled}
            disabled={autostartLoading || !isTauri()}
            onCheckedChange={handleAutostartChange}
          />
        </div>
        <Separator />
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="show-notifications">{t('settings.showNotifications')}</Label>
            <p id="show-notifications-desc" className="text-sm text-muted-foreground">
              {t('settings.showNotificationsDesc')}
            </p>
          </div>
          <Switch
            id="show-notifications"
            aria-describedby="show-notifications-desc"
            checked={appSettings.showNotifications}
            onCheckedChange={(checked) => onValueChange('showNotifications', checked)}
          />
        </div>
        <Separator />
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="tray-click-behavior">{t('settings.trayClickBehavior')}</Label>
            <p id="tray-click-behavior-desc" className="text-sm text-muted-foreground">
              {t('settings.trayClickBehaviorDesc')}
            </p>
          </div>
          <Select
            value={appSettings.trayClickBehavior}
            onValueChange={(value) => handleClickBehaviorChange(value as TrayClickBehavior)}
            disabled={!isTauri()}
          >
            <SelectTrigger id="tray-click-behavior" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toggle_window">{t('settings.trayClickToggle')}</SelectItem>
              <SelectItem value="show_menu">{t('settings.trayClickMenu')}</SelectItem>
              <SelectItem value="do_nothing">{t('settings.trayClickNothing')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
