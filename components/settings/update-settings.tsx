"use client";

import { useMemo, useState } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { SelectSettingItem, SwitchSettingItem } from "./setting-item";
import type { AppSettings } from "@/lib/stores/settings";

interface UpdateSettingsProps {
  appSettings: AppSettings;
  onValueChange: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => void;
  t: (key: string) => string;
}

type EndpointErrorKind = "required" | "invalid";

function normalizeEndpointsDraft(raw: string): string[] {
  return raw
    .replace(/\r/g, "")
    .replace(/\n/g, ",")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function isValidUpdaterEndpointTemplate(endpoint: string): boolean {
  const normalized = endpoint
    .replace("{{current_version}}", "0.0.0")
    .replace("{{target}}", "windows-x86_64")
    .replace("{{arch}}", "x86_64")
    .replace("{{bundle_type}}", "nsis");

  try {
    const url = new URL(normalized);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseCustomEndpoints(raw: string): {
  endpoints: string[];
  error: EndpointErrorKind | null;
} {
  const parsed = normalizeEndpointsDraft(raw);
  if (parsed.length === 0) {
    return { endpoints: [], error: "required" };
  }

  const deduped: string[] = [];
  for (const endpoint of parsed) {
    if (!isValidUpdaterEndpointTemplate(endpoint)) {
      return { endpoints: [], error: "invalid" };
    }
    if (!deduped.includes(endpoint)) {
      deduped.push(endpoint);
    }
  }

  return { endpoints: deduped, error: null };
}

export function UpdateSettings({
  appSettings,
  onValueChange,
  t,
}: UpdateSettingsProps) {
  return (
    <UpdateSettingsDraftFields
      key={`${appSettings.updateSourceMode}:${appSettings.updateCustomEndpoints.join("\u0000")}`}
      appSettings={appSettings}
      onValueChange={onValueChange}
      t={t}
    />
  );
}

function UpdateSettingsDraftFields({
  appSettings,
  onValueChange,
  t,
}: UpdateSettingsProps) {
  const [draftSourceMode, setDraftSourceMode] =
    useState<AppSettings["updateSourceMode"]>(appSettings.updateSourceMode);
  const [draftCustomEndpoints, setDraftCustomEndpoints] = useState(
    appSettings.updateCustomEndpoints.join("\n"),
  );
  const [customEndpointsError, setCustomEndpointsError] =
    useState<EndpointErrorKind | null>(null);

  const customEndpointsErrorText = useMemo(() => {
    if (customEndpointsError === "required") {
      return t("settings.updateCustomEndpointsErrorRequired");
    }
    if (customEndpointsError === "invalid") {
      return t("settings.updateCustomEndpointsErrorInvalid");
    }
    return null;
  }, [customEndpointsError, t]);

  const commitCustomEndpoints = () => {
    const parsed = parseCustomEndpoints(draftCustomEndpoints);
    if (parsed.error) {
      setCustomEndpointsError(parsed.error);
      return false;
    }

    setCustomEndpointsError(null);
    onValueChange("updateCustomEndpoints", parsed.endpoints);
    return true;
  };

  const handleSourceModeChange = (value: string) => {
    if (value !== "official" && value !== "mirror" && value !== "custom") {
      return;
    }

    const nextMode = value as AppSettings["updateSourceMode"];
    setDraftSourceMode(nextMode);

    if (nextMode === "custom") {
      const committed = commitCustomEndpoints();
      if (!committed) {
        return;
      }
    } else {
      setCustomEndpointsError(null);
    }

    onValueChange("updateSourceMode", nextMode);
  };

  const handleCustomEndpointsBlur = () => {
    if (draftSourceMode !== "custom") {
      return;
    }

    const committed = commitCustomEndpoints();
    if (committed && appSettings.updateSourceMode !== "custom") {
      onValueChange("updateSourceMode", "custom");
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <SwitchSettingItem
        id="check-updates-on-start"
        label={t("settings.checkUpdatesOnStart")}
        description={t("settings.checkUpdatesOnStartDesc")}
        checked={appSettings.checkUpdatesOnStart}
        onCheckedChange={(checked) =>
          onValueChange("checkUpdatesOnStart", checked)
        }
      />
      <Separator />
      <SwitchSettingItem
        id="auto-install-updates"
        label={t("settings.autoInstallUpdates")}
        description={t("settings.autoInstallUpdatesDesc")}
        checked={appSettings.autoInstallUpdates}
        onCheckedChange={(checked) =>
          onValueChange("autoInstallUpdates", checked)
        }
      />
      <Separator />
      <SwitchSettingItem
        id="notify-on-updates"
        label={t("settings.notifyOnUpdates")}
        description={t("settings.notifyOnUpdatesDesc")}
        checked={appSettings.notifyOnUpdates}
        onCheckedChange={(checked) => onValueChange("notifyOnUpdates", checked)}
      />
      <Separator />
      <SelectSettingItem
        id="update-source-mode"
        label={t("settings.updateSourceMode")}
        description={t("settings.updateSourceModeDesc")}
        value={draftSourceMode}
        onValueChange={handleSourceModeChange}
        options={[
          { value: "official", label: t("settings.updateSourceModeOfficial") },
          { value: "mirror", label: t("settings.updateSourceModeMirror") },
          { value: "custom", label: t("settings.updateSourceModeCustom") },
        ]}
      />
      {draftSourceMode === "custom" && (
        <>
          <Separator />
          <Field
            data-invalid={customEndpointsErrorText ? true : undefined}
            className="gap-2 py-2"
          >
            <FieldLabel htmlFor="update-custom-endpoints">
              {t("settings.updateCustomEndpoints")}
            </FieldLabel>
            <FieldDescription id="update-custom-endpoints-desc">
              {t("settings.updateCustomEndpointsDesc")}
            </FieldDescription>
            <Textarea
              id="update-custom-endpoints"
              aria-describedby={
                customEndpointsErrorText
                  ? "update-custom-endpoints-desc update-custom-endpoints-error"
                  : "update-custom-endpoints-desc"
              }
              aria-invalid={customEndpointsErrorText ? true : undefined}
              placeholder={t("settings.updateCustomEndpointsPlaceholder")}
              value={draftCustomEndpoints}
              onChange={(event) => {
                setDraftCustomEndpoints(event.target.value);
              }}
              onBlur={handleCustomEndpointsBlur}
              rows={4}
            />
            <FieldDescription className="text-xs">
              {t("settings.updateCustomEndpointsHint")}
            </FieldDescription>
            {customEndpointsErrorText && (
              <FieldError id="update-custom-endpoints-error">
                {customEndpointsErrorText}
              </FieldError>
            )}
          </Field>
        </>
      )}
      <Separator />
      <SwitchSettingItem
        id="update-fallback-to-official"
        label={t("settings.updateFallbackToOfficial")}
        description={t("settings.updateFallbackToOfficialDesc")}
        checked={appSettings.updateFallbackToOfficial}
        onCheckedChange={(checked) =>
          onValueChange("updateFallbackToOfficial", checked)
        }
      />
    </div>
  );
}
