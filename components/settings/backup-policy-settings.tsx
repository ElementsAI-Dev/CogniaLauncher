"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Info } from "lucide-react";
import { SettingItem, SwitchSettingItem } from "./setting-item";

interface BackupPolicySettingsProps {
  localConfig: Record<string, string>;
  errors: Record<string, string | null>;
  onValueChange: (key: string, value: string) => void;
  t: (key: string) => string;
}

export function getBackupPolicyBoundaryNotes(localConfig: Record<string, string>): string[] {
  const notes: string[] = [];
  const maxBackupsRaw = Number(localConfig["backup.max_backups"] || "10");
  const retentionDaysRaw = Number(localConfig["backup.retention_days"] || "30");
  const intervalHoursRaw = Number(localConfig["backup.auto_backup_interval_hours"] || "24");

  if (maxBackupsRaw === 0) {
    notes.push("Max backups is 0 (backend interprets this as unlimited manual backup count).");
  } else if (maxBackupsRaw > 1000) {
    notes.push("Max backups above 1000 will be clamped to 1000 during cleanup execution.");
  }

  if (retentionDaysRaw === 0) {
    notes.push("Retention days is 0 (backend interprets this as no age limit).");
  } else if (retentionDaysRaw > 3650) {
    notes.push("Retention days above 3650 will be clamped to 3650 during cleanup execution.");
  }

  if (intervalHoursRaw === 0) {
    notes.push("Auto backup interval is 0 (scheduled automatic backup loop is disabled).");
  } else if (intervalHoursRaw > 720) {
    notes.push("Auto backup interval above 720 hours will be clamped to 720 by backend policy.");
  }

  return notes;
}

export function BackupPolicySettings({
  localConfig,
  errors,
  onValueChange,
  t,
}: BackupPolicySettingsProps) {
  const policyErrors = [
    errors["backup.auto_backup_interval_hours"],
    errors["backup.max_backups"],
    errors["backup.retention_days"],
  ].filter((value): value is string => Boolean(value));

  const boundaryNotes = getBackupPolicyBoundaryNotes(localConfig);

  return (
    <div className="flex flex-col gap-1">
      {policyErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {policyErrors.join(" ")}
          </AlertDescription>
        </Alert>
      )}
      {boundaryNotes.length > 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {boundaryNotes.join(" ")}
          </AlertDescription>
        </Alert>
      )}
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
