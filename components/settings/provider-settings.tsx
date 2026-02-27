"use client";

import { useMemo } from "react";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { SettingItem } from "./setting-item";
import { normalizeProviderList } from "@/lib/utils/provider";

interface ProviderSettingsProps {
  localConfig: Record<string, string>;
  errors: Record<string, string | null>;
  onValueChange: (key: string, value: string) => void;
  t: (key: string) => string;
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
    <div className="space-y-3">
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
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {t("settings.disabledProvidersHint")}
          </AlertDescription>
        </Alert>
    </div>
  );
}
