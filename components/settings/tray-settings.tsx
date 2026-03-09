"use client";

import {
  FieldDescription,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { SwitchSettingItem, SelectSettingItem } from "./setting-item";
import { TrayMenuCustomizer } from "./tray-menu-customizer";
import type { AppSettings } from "@/lib/stores/settings";
import { isTauri } from "@/lib/tauri";
import { useTrayAutostart } from "@/hooks/use-tray-autostart";

interface TraySettingsProps {
  appSettings: AppSettings;
  onValueChange: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => void;
  t: (key: string) => string;
}

export function TraySettings({
  appSettings,
  onValueChange,
  t,
}: TraySettingsProps) {
  const {
    autostartEnabled,
    autostartLoading,
    handleMinimizeToTrayChange,
    handleStartMinimizedChange,
    handleAutostartChange,
    handleClickBehaviorChange,
    quickAction,
    availableQuickActions,
    handleQuickActionChange,
    handleShowNotificationsChange,
    handleNotificationLevelChange,
    notificationEvents,
    availableNotificationEvents,
    handleNotificationEventToggle,
  } = useTrayAutostart({ appSettings, onValueChange });

  return (
    <div className="flex flex-col gap-1">
        <SwitchSettingItem
          id="minimize-to-tray"
          label={t("settings.minimizeToTray")}
          description={t("settings.minimizeToTrayDesc")}
          checked={appSettings.minimizeToTray}
          onCheckedChange={handleMinimizeToTrayChange}
        />
        <Separator />
        <SwitchSettingItem
          id="start-minimized"
          label={t("settings.startMinimized")}
          description={t("settings.startMinimizedDesc")}
          checked={appSettings.startMinimized}
          onCheckedChange={handleStartMinimizedChange}
        />
        <Separator />
        <SwitchSettingItem
          id="autostart"
          label={t("settings.autostart")}
          description={t("settings.autostartDesc")}
          checked={autostartEnabled}
          disabled={autostartLoading || !isTauri()}
          onCheckedChange={handleAutostartChange}
        />
        <Separator />
        <SwitchSettingItem
          id="show-notifications"
          label={t("settings.showNotifications")}
          description={t("settings.showNotificationsDesc")}
          checked={appSettings.showNotifications}
          onCheckedChange={handleShowNotificationsChange}
        />
        <Separator />
        <SelectSettingItem
          id="tray-notification-level"
          label={t("settings.trayNotificationLevel")}
          description={t("settings.trayNotificationLevelDesc")}
          value={appSettings.trayNotificationLevel}
          onValueChange={handleNotificationLevelChange}
          options={[
            { value: "all", label: t("settings.trayNotificationLevelAll") },
            { value: "important_only", label: t("settings.trayNotificationLevelImportantOnly") },
            { value: "none", label: t("settings.trayNotificationLevelNone") },
          ]}
          disabled={!isTauri() || !appSettings.showNotifications}
          triggerClassName="w-[200px]"
        />
        <Separator />
        <SelectSettingItem
          id="tray-click-behavior"
          label={t("settings.trayClickBehavior")}
          description={t("settings.trayClickBehaviorDesc")}
          value={appSettings.trayClickBehavior}
          onValueChange={handleClickBehaviorChange}
          options={[
            { value: "toggle_window", label: t("settings.trayClickToggle") },
            { value: "show_menu", label: t("settings.trayClickMenu") },
            { value: "check_updates", label: t("settings.trayClickCheckUpdates") },
            { value: "quick_action", label: t("settings.trayClickQuickAction") },
            { value: "do_nothing", label: t("settings.trayClickNothing") },
          ]}
          disabled={!isTauri()}
          triggerClassName="w-[180px]"
        />
        {isTauri() && (
          <>
            <Separator />
            <SelectSettingItem
              id="tray-quick-action"
              label={t("settings.trayQuickAction")}
              description={t("settings.trayQuickActionDesc")}
              value={quickAction}
              onValueChange={handleQuickActionChange}
              options={availableQuickActions.map((value) => ({
                value,
                label: t(`settings.trayQuickActionOption.${value}`),
              }))}
              disabled={appSettings.trayClickBehavior !== "quick_action"}
              triggerClassName="w-[220px]"
            />
            <Separator />
            <FieldSet className="gap-1 px-1 py-2">
              <FieldLegend variant="label" className="mb-0 text-sm font-medium">
                {t("settings.trayNotificationEvents")}
              </FieldLegend>
              <FieldDescription className="text-xs">
                {t("settings.trayNotificationEventsDesc")}
              </FieldDescription>
              <div className="flex flex-col gap-1 pt-1">
                {availableNotificationEvents.map((event) => (
                  <SwitchSettingItem
                    key={event}
                    id={`tray-notification-event-${event}`}
                    label={t(`settings.trayNotificationEventOption.${event}`)}
                    description={t("settings.trayNotificationEventItemDesc")}
                    checked={notificationEvents.includes(event)}
                    disabled={!appSettings.showNotifications}
                    onCheckedChange={(checked) =>
                      handleNotificationEventToggle(event, checked)
                    }
                  />
                ))}
              </div>
            </FieldSet>
          </>
        )}
        {isTauri() && (
          <>
            <Separator />
            <TrayMenuCustomizer t={t} />
          </>
        )}
    </div>
  );
}
