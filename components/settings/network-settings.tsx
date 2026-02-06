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

interface NetworkSettingsProps {
  localConfig: Record<string, string>;
  errors: Record<string, string | null>;
  onValueChange: (key: string, value: string) => void;
  t: (key: string) => string;
}

export function NetworkSettings({
  localConfig,
  errors,
  onValueChange,
  t,
}: NetworkSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.network")}</CardTitle>
        <CardDescription>{t("settings.networkDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <SettingItem
          id="network-timeout"
          label={t("settings.timeout")}
          description={t("settings.timeoutDesc")}
          value={localConfig["network.timeout"] || "30"}
          onChange={(v) => onValueChange("network.timeout", v)}
          type="number"
          min={5}
          max={300}
          error={errors["network.timeout"]}
        />
        <Separator />
        <SettingItem
          id="network-retries"
          label={t("settings.retries")}
          description={t("settings.retriesDesc")}
          value={localConfig["network.retries"] || "3"}
          onChange={(v) => onValueChange("network.retries", v)}
          type="number"
          min={0}
          max={10}
          error={errors["network.retries"]}
        />
        <Separator />
        <SettingItem
          id="network-proxy"
          label={t("settings.proxy")}
          description={t("settings.proxyDesc")}
          value={localConfig["network.proxy"] || ""}
          onChange={(v) => onValueChange("network.proxy", v)}
          placeholder="http://proxy.example.com:8080"
          error={errors["network.proxy"]}
        />
      </CardContent>
    </Card>
  );
}
