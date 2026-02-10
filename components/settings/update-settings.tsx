"use client";

import { Separator } from "@/components/ui/separator";
import { SwitchSettingItem } from "./setting-item";
import type { AppSettings } from "@/lib/stores/settings";

interface UpdateSettingsProps {
  appSettings: AppSettings;
  onValueChange: (key: keyof AppSettings, value: boolean) => void;
  t: (key: string) => string;
}

export function UpdateSettings({
  appSettings,
  onValueChange,
  t,
}: UpdateSettingsProps) {
  return (
    <div className="space-y-1">
        <SwitchSettingItem
          id="check-updates-on-start"
          label={t("settings.checkUpdatesOnStart")}
          description={t("settings.checkUpdatesOnStartDesc")}
          checked={appSettings.checkUpdatesOnStart}
          onCheckedChange={(checked) =>
            onValueChange("checkUpdatesOnStart", checked)
          }
        />
        <Separator />
        <SwitchSettingItem
          id="auto-install-updates"
          label={t("settings.autoInstallUpdates")}
          description={t("settings.autoInstallUpdatesDesc")}
          checked={appSettings.autoInstallUpdates}
          onCheckedChange={(checked) =>
            onValueChange("autoInstallUpdates", checked)
          }
        />
        <Separator />
        <SwitchSettingItem
          id="notify-on-updates"
          label={t("settings.notifyOnUpdates")}
          description={t("settings.notifyOnUpdatesDesc")}
          checked={appSettings.notifyOnUpdates}
          onCheckedChange={(checked) =>
            onValueChange("notifyOnUpdates", checked)
          }
        />
    </div>
  );
}
