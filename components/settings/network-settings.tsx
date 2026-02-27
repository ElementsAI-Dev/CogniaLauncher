"use client";

import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { SettingItem } from "./setting-item";
import { isTauri } from "@/lib/platform";
import { Loader2, Search, Wifi } from "lucide-react";
import { useProxyTools } from "@/hooks/use-proxy-tools";

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
  const {
    detectLoading,
    detectResult,
    testLoading,
    testResult,
    handleDetectProxy,
    handleTestProxy,
  } = useProxyTools({ localConfig, onValueChange, t });

  return (
    <div className="space-y-1">
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
        <Separator />
        <SettingItem
          id="network-no-proxy"
          label={t("settings.noProxyGlobal")}
          description={t("settings.noProxyGlobalDesc")}
          value={localConfig["network.no_proxy"] || ""}
          onChange={(v) => onValueChange("network.no_proxy", v)}
          placeholder="localhost,127.0.0.1,.internal.com"
          error={errors["network.no_proxy"]}
        />
        {isTauri() && (
          <>
            <Separator />
            <div className="flex items-center gap-2 px-1 py-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDetectProxy}
                disabled={detectLoading}
              >
                {detectLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1 h-3.5 w-3.5" />}
                {t("settings.detectSystemProxy")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestProxy}
                disabled={testLoading || !localConfig["network.proxy"]}
              >
                {testLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Wifi className="mr-1 h-3.5 w-3.5" />}
                {t("settings.testProxyConnection")}
              </Button>
            </div>
            {(detectResult || testResult) && (
              <div className="px-1 text-xs text-muted-foreground">
                {detectResult && <p>{detectResult}</p>}
                {testResult && <p>{testResult}</p>}
              </div>
            )}
          </>
        )}
    </div>
  );
}
