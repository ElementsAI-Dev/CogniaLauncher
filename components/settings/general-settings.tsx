"use client";

import { Separator } from "@/components/ui/separator";
import { SettingItem, SwitchSettingItem, SelectSettingItem } from "./setting-item";

interface GeneralSettingsProps {
  localConfig: Record<string, string>;
  errors: Record<string, string | null>;
  onValueChange: (key: string, value: string) => void;
  t: (key: string) => string;
}

export function GeneralSettings({
  localConfig,
  errors,
  onValueChange,
  t,
}: GeneralSettingsProps) {
  return (
    <div className="space-y-1">
        <SettingItem
          id="parallel-downloads"
          label={t("settings.parallelDownloads")}
          description={t("settings.parallelDownloadsDesc")}
          value={localConfig["general.parallel_downloads"] || "4"}
          onChange={(v) => onValueChange("general.parallel_downloads", v)}
          type="number"
          min={1}
          max={16}
          error={errors["general.parallel_downloads"]}
        />
        <Separator />
        <SettingItem
          id="min-install-space"
          label={t("settings.minInstallSpace")}
          description={t("settings.minInstallSpaceDesc")}
          value={localConfig["general.min_install_space_mb"] || "100"}
          onChange={(v) => onValueChange("general.min_install_space_mb", v)}
          type="number"
          min={10}
          max={10240}
          error={errors["general.min_install_space_mb"]}
        />
        <Separator />
        <SettingItem
          id="metadata-cache-ttl"
          label={t("settings.metadataCacheTtl")}
          description={t("settings.metadataCacheTtlDesc")}
          value={localConfig["general.metadata_cache_ttl"] || "3600"}
          onChange={(v) => onValueChange("general.metadata_cache_ttl", v)}
          type="number"
          min={60}
          max={86400}
          error={errors["general.metadata_cache_ttl"]}
        />
        <Separator />
        <SelectSettingItem
          id="resolve-strategy"
          label={t("settings.resolveStrategy")}
          description={t("settings.resolveStrategyDesc")}
          value={localConfig["general.resolve_strategy"] || "latest"}
          onValueChange={(value) =>
            onValueChange("general.resolve_strategy", value)
          }
          options={[
            { value: "latest", label: t("settings.resolveLatest") },
            { value: "minimal", label: t("settings.resolveMinimal") },
            { value: "locked", label: t("settings.resolveLocked") },
            { value: "prefer-locked", label: t("settings.resolvePreferLocked") },
          ]}
          placeholder={t("settings.resolveStrategy")}
        />
        <Separator />
        <SwitchSettingItem
          id="auto-update-metadata"
          label={t("settings.autoUpdateMetadata")}
          description={t("settings.autoUpdateMetadataDesc")}
          checked={localConfig["general.auto_update_metadata"] !== "false"}
          onCheckedChange={(checked) =>
            onValueChange("general.auto_update_metadata", checked.toString())
          }
        />
        <Separator />
        <SettingItem
          id="cache-max-size"
          label={t("settings.cacheMaxSize")}
          description={t("settings.cacheMaxSizeDesc")}
          value={localConfig["general.cache_max_size"] || String(5 * 1024 * 1024 * 1024)}
          onChange={(v) => onValueChange("general.cache_max_size", v)}
          type="number"
          min={104857600}
          max={107374182400}
          error={errors["general.cache_max_size"]}
        />
        <Separator />
        <SettingItem
          id="cache-max-age-days"
          label={t("settings.cacheMaxAgeDays")}
          description={t("settings.cacheMaxAgeDaysDesc")}
          value={localConfig["general.cache_max_age_days"] || "30"}
          onChange={(v) => onValueChange("general.cache_max_age_days", v)}
          type="number"
          min={1}
          max={365}
          error={errors["general.cache_max_age_days"]}
        />
        <Separator />
        <SwitchSettingItem
          id="auto-clean-cache"
          label={t("settings.autoCleanCache")}
          description={t("settings.autoCleanCacheDesc")}
          checked={localConfig["general.auto_clean_cache"] !== "false"}
          onCheckedChange={(checked) =>
            onValueChange("general.auto_clean_cache", checked.toString())
          }
        />
        <Separator />
        <SettingItem
          id="cache-auto-clean-threshold"
          label={t("settings.cacheAutoCleanThreshold")}
          description={t("settings.cacheAutoCleanThresholdDesc")}
          value={localConfig["general.cache_auto_clean_threshold"] || "80"}
          onChange={(v) => onValueChange("general.cache_auto_clean_threshold", v)}
          type="number"
          min={0}
          max={100}
          error={errors["general.cache_auto_clean_threshold"]}
        />
        <Separator />
        <SettingItem
          id="cache-monitor-interval"
          label={t("settings.cacheMonitorInterval")}
          description={t("settings.cacheMonitorIntervalDesc")}
          value={localConfig["general.cache_monitor_interval"] || "300"}
          onChange={(v) => onValueChange("general.cache_monitor_interval", v)}
          type="number"
          min={0}
          max={3600}
          error={errors["general.cache_monitor_interval"]}
        />
        <Separator />
        <SwitchSettingItem
          id="cache-monitor-external"
          label={t("settings.cacheMonitorExternal")}
          description={t("settings.cacheMonitorExternalDesc")}
          checked={localConfig["general.cache_monitor_external"] === "true"}
          onCheckedChange={(checked) =>
            onValueChange("general.cache_monitor_external", checked.toString())
          }
        />
        <Separator />
        <SettingItem
          id="download-speed-limit"
          label={t("settings.downloadSpeedLimit")}
          description={t("settings.downloadSpeedLimitDesc")}
          value={localConfig["general.download_speed_limit"] || "0"}
          onChange={(v) => onValueChange("general.download_speed_limit", v)}
          type="number"
          min={0}
          error={errors["general.download_speed_limit"]}
        />
    </div>
  );
}
