"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SettingItem } from "./setting-item";

interface PathsSettingsProps {
  localConfig: Record<string, string>;
  errors: Record<string, string | null>;
  onValueChange: (key: string, value: string) => void;
  t: (key: string) => string;
}

export function PathsSettings({
  localConfig,
  errors,
  onValueChange,
  t,
}: PathsSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.paths")}</CardTitle>
        <CardDescription>{t("settings.pathsDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <SettingItem
          id="paths-root"
          label={t("settings.pathRoot")}
          description={t("settings.pathRootDesc")}
          value={localConfig["paths.root"] || ""}
          onChange={(value) => onValueChange("paths.root", value)}
          placeholder={t("settings.pathRootPlaceholder")}
          error={errors["paths.root"]}
        />
        <Separator />
        <SettingItem
          id="paths-cache"
          label={t("settings.pathCache")}
          description={t("settings.pathCacheDesc")}
          value={localConfig["paths.cache"] || ""}
          onChange={(value) => onValueChange("paths.cache", value)}
          placeholder={t("settings.pathCachePlaceholder")}
          error={errors["paths.cache"]}
        />
        <Separator />
        <SettingItem
          id="paths-environments"
          label={t("settings.pathEnvironments")}
          description={t("settings.pathEnvironmentsDesc")}
          value={localConfig["paths.environments"] || ""}
          onChange={(value) => onValueChange("paths.environments", value)}
          placeholder={t("settings.pathEnvironmentsPlaceholder")}
          error={errors["paths.environments"]}
        />
      </CardContent>
    </Card>
  );
}
