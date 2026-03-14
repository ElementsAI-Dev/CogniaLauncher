"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Info } from "lucide-react";
import * as tauri from "@/lib/tauri";

interface ProviderSettingsProps {
  localConfig: Record<string, string>;
  savedConfig: Record<string, string>;
  errors: Record<string, string | null>;
  onValueChange: (key: string, value: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function getSavedProviderOverrideKeys(config: Record<string, string>): string[] {
  return Object.keys(config)
    .filter(
      (key) =>
        key.startsWith("providers.") &&
        (key.endsWith(".enabled") || key.endsWith(".priority")),
    )
    .sort();
}

function parseBooleanValue(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  return value === "true";
}

export function ProviderSettings({
  localConfig,
  savedConfig,
  errors,
  onValueChange,
  t,
}: ProviderSettingsProps) {
  const [providers, setProviders] = useState<tauri.ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [providerRefreshVersion, setProviderRefreshVersion] = useState(0);
  const savedProviderOverrideKeys = useMemo(
    () => getSavedProviderOverrideKeys(savedConfig),
    [savedConfig],
  );
  const previousSavedProviderOverrideKeysRef = useRef(savedProviderOverrideKeys);

  useEffect(() => {
    let cancelled = false;

    const loadProviders = async () => {
      if (providerRefreshVersion === 0) {
        setLoading(true);
      }
      setLoadError(null);

      try {
        const result = await tauri.providerList();
        if (!cancelled) {
          setProviders(result);
        }
      } catch {
        if (!cancelled) {
          setLoadError(t("settings.providerLoadError"));
        }
      } finally {
        if (!cancelled && providerRefreshVersion === 0) {
          setLoading(false);
        }
      }
    };

    void loadProviders();

    return () => {
      cancelled = true;
    };
  }, [providerRefreshVersion, t]);

  useEffect(() => {
    const previousKeys = previousSavedProviderOverrideKeysRef.current;
    const removedOverride = previousKeys.some(
      (key) => !savedProviderOverrideKeys.includes(key),
    );

    previousSavedProviderOverrideKeysRef.current = savedProviderOverrideKeys;

    if (removedOverride) {
      setProviderRefreshVersion((value) => value + 1);
    }
  }, [savedProviderOverrideKeys]);

  const sortedProviders = useMemo(
    () =>
      [...providers].sort(
        (left, right) =>
          right.priority - left.priority ||
          left.display_name.localeCompare(right.display_name),
      ),
    [providers],
  );

  return (
    <div className="flex flex-col gap-4" id="managed-providers">
      <div className="space-y-1">
        <Label htmlFor="provider-search" className="text-sm">
          {t("settings.providerSearch")}
        </Label>
        <Input
          id="provider-search"
          value=""
          readOnly
          aria-hidden="true"
          className="hidden"
          tabIndex={-1}
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("settings.providerLoading")}</p>
      ) : loadError ? (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3">
          {sortedProviders.map((provider) => {
            const enabledKey = `providers.${provider.id}.enabled`;
            const priorityKey = `providers.${provider.id}.priority`;
            const enabled = parseBooleanValue(localConfig[enabledKey], provider.enabled);
            const priority = localConfig[priorityKey] ?? String(provider.priority);

            return (
              <div
                key={provider.id}
                className="rounded-lg border p-3 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium">{provider.display_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {t("settings.providerId")}: {provider.id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`provider-enabled-${provider.id}`}
                      className="text-sm"
                    >
                      {t("settings.providerEnabledLabel", {
                        name: provider.display_name,
                      })}
                    </Label>
                    <Switch
                      id={`provider-enabled-${provider.id}`}
                      aria-label={t("settings.providerEnabledLabel", {
                        name: provider.display_name,
                      })}
                      checked={enabled}
                      onCheckedChange={(checked) =>
                        onValueChange(enabledKey, checked ? "true" : "false")
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor={`provider-priority-${provider.id}`}>
                    {t("settings.providerPriorityLabel", {
                      name: provider.display_name,
                    })}
                  </Label>
                  <Input
                    id={`provider-priority-${provider.id}`}
                    aria-label={t("settings.providerPriorityLabel", {
                      name: provider.display_name,
                    })}
                    inputMode="numeric"
                    value={priority}
                    placeholder={t("settings.providerPriorityPlaceholder")}
                    onChange={(event) =>
                      onValueChange(priorityKey, event.target.value)
                    }
                  />
                  {errors[priorityKey] && (
                    <p className="text-sm text-destructive">{errors[priorityKey]}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Separator />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>{t("settings.providerSettingsHint")}</AlertDescription>
      </Alert>
    </div>
  );
}
