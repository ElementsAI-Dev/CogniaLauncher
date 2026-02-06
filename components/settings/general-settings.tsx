"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingItem } from "./setting-item";

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
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.general")}</CardTitle>
        <CardDescription>{t("settings.generalDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
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
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="resolve-strategy">
              {t("settings.resolveStrategy")}
            </Label>
            <p
              id="resolve-strategy-desc"
              className="text-sm text-muted-foreground"
            >
              {t("settings.resolveStrategyDesc")}
            </p>
          </div>
          <Select
            value={localConfig["general.resolve_strategy"] || "latest"}
            onValueChange={(value) =>
              onValueChange("general.resolve_strategy", value)
            }
          >
            <SelectTrigger
              id="resolve-strategy"
              className="w-48"
              aria-describedby="resolve-strategy-desc"
            >
              <SelectValue placeholder={t("settings.resolveStrategy")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">
                {t("settings.resolveLatest")}
              </SelectItem>
              <SelectItem value="minimal">
                {t("settings.resolveMinimal")}
              </SelectItem>
              <SelectItem value="locked">
                {t("settings.resolveLocked")}
              </SelectItem>
              <SelectItem value="prefer-locked">
                {t("settings.resolvePreferLocked")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Separator />
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="auto-update-metadata">
              {t("settings.autoUpdateMetadata")}
            </Label>
            <p
              id="auto-update-metadata-desc"
              className="text-sm text-muted-foreground"
            >
              {t("settings.autoUpdateMetadataDesc")}
            </p>
          </div>
          <Switch
            id="auto-update-metadata"
            aria-describedby="auto-update-metadata-desc"
            checked={localConfig["general.auto_update_metadata"] !== "false"}
            onCheckedChange={(checked) =>
              onValueChange("general.auto_update_metadata", checked.toString())
            }
          />
        </div>
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
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="auto-clean-cache">
              {t("settings.autoCleanCache")}
            </Label>
            <p
              id="auto-clean-cache-desc"
              className="text-sm text-muted-foreground"
            >
              {t("settings.autoCleanCacheDesc")}
            </p>
          </div>
          <Switch
            id="auto-clean-cache"
            aria-describedby="auto-clean-cache-desc"
            checked={localConfig["general.auto_clean_cache"] !== "false"}
            onCheckedChange={(checked) =>
              onValueChange("general.auto_clean_cache", checked.toString())
            }
          />
        </div>
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
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="cache-monitor-external">
              {t("settings.cacheMonitorExternal")}
            </Label>
            <p
              id="cache-monitor-external-desc"
              className="text-sm text-muted-foreground"
            >
              {t("settings.cacheMonitorExternalDesc")}
            </p>
          </div>
          <Switch
            id="cache-monitor-external"
            aria-describedby="cache-monitor-external-desc"
            checked={localConfig["general.cache_monitor_external"] === "true"}
            onCheckedChange={(checked) =>
              onValueChange("general.cache_monitor_external", checked.toString())
            }
          />
        </div>
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
      </CardContent>
    </Card>
  );
}
