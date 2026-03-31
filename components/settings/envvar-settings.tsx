"use client";

import { SelectSettingItem, SwitchSettingItem } from "./setting-item";
import type { AppSettings } from "@/lib/stores/settings";

interface EnvVarSettingsProps {
  appSettings: AppSettings;
  onValueChange: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => void;
  t: (key: string) => string;
}

export function EnvVarSettings({
  appSettings,
  onValueChange,
  t,
}: EnvVarSettingsProps) {
  return (
    <div className="flex flex-col gap-1">
      <SelectSettingItem
        id="envvar-default-scope"
        label={t("settings.envvarDefaultScope")}
        description={t("settings.envvarDefaultScopeDesc")}
        value={appSettings.envvarDefaultScope}
        onValueChange={(value) =>
          onValueChange(
            "envvarDefaultScope",
            value as AppSettings["envvarDefaultScope"],
          )
        }
        options={[
          { value: "all", label: t("settings.envvarDefaultScopeAll") },
          { value: "process", label: t("settings.envvarDefaultScopeProcess") },
          { value: "user", label: t("settings.envvarDefaultScopeUser") },
          { value: "system", label: t("settings.envvarDefaultScopeSystem") },
        ]}
      />
      <SwitchSettingItem
        id="envvar-auto-snapshot"
        label={t("settings.envvarAutoSnapshot")}
        description={t("settings.envvarAutoSnapshotDesc")}
        checked={appSettings.envvarAutoSnapshot}
        onCheckedChange={(checked) =>
          onValueChange("envvarAutoSnapshot", checked)
        }
      />
      <SwitchSettingItem
        id="envvar-mask-sensitive"
        label={t("settings.envvarMaskSensitive")}
        description={t("settings.envvarMaskSensitiveDesc")}
        checked={appSettings.envvarMaskSensitive}
        onCheckedChange={(checked) =>
          onValueChange("envvarMaskSensitive", checked)
        }
      />
    </div>
  );
}
