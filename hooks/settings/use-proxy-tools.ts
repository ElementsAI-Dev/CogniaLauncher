'use client';

import { useState, useCallback } from "react";
import { isTauri } from "@/lib/platform";

export interface UseProxyToolsOptions {
  localConfig: Record<string, string>;
  onValueChange: (key: string, value: string) => void;
  t: (key: string) => string;
}

export interface UseProxyToolsReturn {
  detectLoading: boolean;
  detectResult: string | null;
  testLoading: boolean;
  testResult: string | null;
  handleDetectProxy: () => Promise<void>;
  handleTestProxy: () => Promise<void>;
}

/**
 * Hook for proxy detection and testing functionality
 * Extracted from components/settings/network-settings.tsx
 */
export function useProxyTools({
  localConfig,
  onValueChange,
  t,
}: UseProxyToolsOptions): UseProxyToolsReturn {
  const [detectLoading, setDetectLoading] = useState(false);
  const [detectResult, setDetectResult] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleDetectProxy = useCallback(async () => {
    if (!isTauri()) return;
    setDetectLoading(true);
    setDetectResult(null);
    try {
      const { detectSystemProxy } = await import("@/lib/tauri");
      const info = await detectSystemProxy();
      if (info.source === "none") {
        setDetectResult(t("settings.proxyNotDetected"));
      } else {
        const proxy = info.httpProxy || info.httpsProxy || "";
        if (proxy) {
          onValueChange("network.proxy", proxy);
          if (info.noProxy) {
            onValueChange("network.no_proxy", info.noProxy);
          }
        }
        const sourceLabel = info.source === "environment"
          ? t("settings.proxyDetectedEnv")
          : t("settings.proxyDetectedRegistry");
        setDetectResult(`${sourceLabel}: ${proxy}`);
      }
    } catch (e) {
      setDetectResult(String(e));
    } finally {
      setDetectLoading(false);
    }
  }, [onValueChange, t]);

  const handleTestProxy = useCallback(async () => {
    const proxyUrl = localConfig["network.proxy"];
    if (!proxyUrl || !isTauri()) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const { testProxyConnection } = await import("@/lib/tauri");
      const result = await testProxyConnection(proxyUrl);
      if (result.success) {
        setTestResult(t("settings.proxyTestSuccess").replace("{latency}", String(result.latencyMs)));
      } else {
        setTestResult(t("settings.proxyTestFailed").replace("{error}", result.error || "Unknown"));
      }
    } catch (e) {
      setTestResult(String(e));
    } finally {
      setTestLoading(false);
    }
  }, [localConfig, t]);

  return {
    detectLoading,
    detectResult,
    testLoading,
    testResult,
    handleDetectProxy,
    handleTestProxy,
  };
}
