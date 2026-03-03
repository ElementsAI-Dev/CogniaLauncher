"use client";

import { Separator } from "@/components/ui/separator";
import { SettingItem, SwitchSettingItem } from "./setting-item";

interface BackupPolicySettingsProps {
  localConfig: Record<string, string>;
  errors: Record<string, string | null>;
  onValueChange: (key: string, value: string) => void;
  t: (key: string) => string;
}

export function BackupPolicySettings({
  localConfig,
  errors,
  onValueChange,
  t,
}: BackupPolicySettingsProps) {
  return (
    <div className="space-y-1">
      <SwitchSettingItem
        id="backup-auto-enabled"
        label={t("settings.backupAutoBackupEnabled")}
        description={t("settings.backupAutoBackupEnabledDesc")}
        checked={localConfig["backup.auto_backup_enabled"] === "true"}
        onCheckedChange={(checked) =>
          onValueChange("backup.auto_backup_enabled", String(checked))
        }
      />
      <Separator />
      <SettingItem
        id="backup-auto-interval-hours"
        label={t("settings.backupAutoBackupIntervalHours")}
        description={t("settings.backupAutoBackupIntervalHoursDesc")}
        value={localConfig["backup.auto_backup_interval_hours"] || "24"}
        onChange={(v) => onValueChange("backup.auto_backup_interval_hours", v)}
        type="number"
        min={1}
        max={720}
        error={errors["backup.auto_backup_interval_hours"]}
      />
      <Separator />
      <SettingItem
        id="backup-max-backups"
        label={t("settings.backupMaxBackups")}
        description={t("settings.backupMaxBackupsDesc")}
        value={localConfig["backup.max_backups"] || "10"}
        onChange={(v) => onValueChange("backup.max_backups", v)}
        type="number"
        min={0}
        max={1000}
        error={errors["backup.max_backups"]}
      />
      <Separator />
      <SettingItem
        id="backup-retention-days"
        label={t("settings.backupRetentionDays")}
        description={t("settings.backupRetentionDaysDesc")}
        value={localConfig["backup.retention_days"] || "30"}
        onChange={(v) => onValueChange("backup.retention_days", v)}
        type="number"
        min={0}
        max={3650}
        error={errors["backup.retention_days"]}
      />
    </div>
  );
}
