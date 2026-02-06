"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SettingItem } from "./setting-item";

interface ProviderSettingsProps {
  localConfig: Record<string, string>;
  errors: Record<string, string | null>;
  onValueChange: (key: string, value: string) => void;
  t: (key: string) => string;
}

function normalizeProviderList(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as string[];
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean).join(", ");
      }
    } catch {
      return rawValue;
    }
  }

  return rawValue;
}

export function ProviderSettings({
  localConfig,
  errors,
  onValueChange,
  t,
}: ProviderSettingsProps) {
  const disabledProvidersValue = useMemo(
    () =>
      normalizeProviderList(
        localConfig["provider_settings.disabled_providers"] || "",
      ),
    [localConfig],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.providerSettings")}</CardTitle>
        <CardDescription>{t("settings.providerSettingsDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <SettingItem
          id="disabled-providers"
          label={t("settings.disabledProviders")}
          description={t("settings.disabledProvidersDesc")}
          value={disabledProvidersValue}
          onChange={(value) =>
            onValueChange("provider_settings.disabled_providers", value)
          }
          placeholder={t("settings.disabledProvidersPlaceholder")}
          error={errors["provider_settings.disabled_providers"]}
        />
        <Separator />
        <p className="text-sm text-muted-foreground">
          {t("settings.disabledProvidersHint")}
        </p>
      </CardContent>
    </Card>
  );
}
