"use client";

import { Separator } from "@/components/ui/separator";
import { SettingItem, SwitchSettingItem } from "./setting-item";

interface StartupSettingsProps {
  localConfig: Record<string, string>;
  errors: Record<string, string | null>;
  onValueChange: (key: string, value: string) => void;
  t: (key: string) => string;
}

export function StartupSettings({
  localConfig,
  errors,
  onValueChange,
  t,
}: StartupSettingsProps) {
  return (
    <div className="flex flex-col gap-1">
      <SwitchSettingItem
        id="startup-scan-environments"
        label={t("settings.startupScanEnvironments")}
        description={t("settings.startupScanEnvironmentsDesc")}
        checked={localConfig["startup.scan_environments"] !== "false"}
        onCheckedChange={(checked) =>
          onValueChange("startup.scan_environments", checked.toString())
        }
      />
      <Separator />
      <SwitchSettingItem
        id="startup-scan-packages"
        label={t("settings.startupScanPackages")}
        description={t("settings.startupScanPackagesDesc")}
        checked={localConfig["startup.scan_packages"] !== "false"}
        onCheckedChange={(checked) =>
          onValueChange("startup.scan_packages", checked.toString())
        }
      />
      <Separator />
      <SettingItem
        id="startup-max-concurrent-scans"
        label={t("settings.startupMaxConcurrentScans")}
        description={t("settings.startupMaxConcurrentScansDesc")}
        value={localConfig["startup.max_concurrent_scans"] || "6"}
        onChange={(v) => onValueChange("startup.max_concurrent_scans", v)}
        type="number"
        min={1}
        max={16}
        error={errors["startup.max_concurrent_scans"]}
      />
      <Separator />
      <SettingItem
        id="startup-timeout-secs"
        label={t("settings.startupTimeoutSecs")}
        description={t("settings.startupTimeoutSecsDesc")}
        value={localConfig["startup.startup_timeout_secs"] || "30"}
        onChange={(v) => onValueChange("startup.startup_timeout_secs", v)}
        type="number"
        min={5}
        max={120}
        error={errors["startup.startup_timeout_secs"]}
      />
      <Separator />
      <SwitchSettingItem
        id="startup-integrity-check"
        label={t("settings.startupIntegrityCheck")}
        description={t("settings.startupIntegrityCheckDesc")}
        checked={localConfig["startup.integrity_check"] !== "false"}
        onCheckedChange={(checked) =>
          onValueChange("startup.integrity_check", checked.toString())
        }
      />
    </div>
  );
}
