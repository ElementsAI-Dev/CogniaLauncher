"use client";

import { useEffect, useState, useCallback } from "react";
import * as tauri from "@/lib/tauri";
import { isTauri } from "@/lib/platform";
import { APP_VERSION } from "@/lib/app-version";
import { toast } from "sonner";
import type {
  AboutInsights,
  AboutSupportFreshness,
  SystemInfo,
  SystemSubsystem,
  UpdateErrorCategory,
  UpdateStatus,
} from "@/types/about";
import {
  ensureCacheInvalidationBridge,
  subscribeInvalidation,
  withThrottle,
} from "@/lib/cache/invalidation";
import {
  categorizeUpdateError,
  deriveStatusFromUpdateInfo,
  mapSelfUpdateErrorCategory,
  mapProgressToUpdateStatus,
  normalizeSelfUpdateInfo,
} from "@/lib/update-lifecycle";
import {
  buildSystemSectionSummary,
  buildWebDiagnosticsReport,
} from "@/lib/about-diagnostics";
import { exportDesktopDiagnosticBundle } from "@/lib/diagnostic-export";
import { formatBytes } from "@/lib/utils";

export type { SystemInfo, UpdateStatus };

export interface UseAboutDataReturn {
  updateInfo: tauri.SelfUpdateInfo | null;
  loading: boolean;
  updating: boolean;
  updateProgress: number;
  updateStatus: UpdateStatus;
  updateErrorCategory: UpdateErrorCategory | null;
  updateErrorMessage: string | null;
  error: string | null;
  systemError: string | null;
  systemInfo: SystemInfo | null;
  systemLoading: boolean;
  aboutInsights: AboutInsights | null;
  insightsLoading: boolean;
  supportFreshness: AboutSupportFreshness;
  supportRefreshing: boolean;
  isDesktop: boolean;
  checkForUpdate: () => Promise<void>;
  reloadSystemInfo: () => Promise<void>;
  reloadAboutInsights: () => Promise<void>;
  refreshAllSupportData: () => Promise<void>;
  handleUpdate: (t: (key: string) => string) => Promise<void>;
  clearError: () => void;
  exportDiagnostics: (t: (key: string) => string) => Promise<void>;
}

function getLatestTimestamp(
  ...timestamps: Array<string | null | undefined>
): string | null {
  const values = timestamps.filter((value): value is string => typeof value === "string");
  if (values.length === 0) {
    return null;
  }

  return values.sort((left, right) => left.localeCompare(right)).at(-1) ?? null;
}

function toAboutErrorKey(category: UpdateErrorCategory | null): string {
  switch (category) {
    case "network_error":
      return "network_error";
    case "timeout_error":
      return "timeout_error";
    case "source_unavailable_error":
      return "source_unavailable_error";
    case "validation_error":
      return "validation_error";
    case "signature_error":
      return "signature_error";
    case "update_install_failed":
      return "update_install_failed";
    case "unknown_error":
      return "unknown_error";
    case "update_check_failed":
    case "permission_error":
    case "unsupported_error":
    default:
      return "update_check_failed";
  }
}

export function useAboutData(locale: string): UseAboutDataReturn {
  const [updateInfo, setUpdateInfo] = useState<tauri.SelfUpdateInfo | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [updateErrorCategory, setUpdateErrorCategory] =
    useState<UpdateErrorCategory | null>(null);
  const [updateErrorMessage, setUpdateErrorMessage] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [systemError, setSystemError] = useState<string | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [systemLoading, setSystemLoading] = useState(true);
  const [aboutInsights, setAboutInsights] = useState<AboutInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [supportFreshness, setSupportFreshness] = useState<AboutSupportFreshness>({
    updateCheckedAt: null,
    systemInfoRefreshedAt: null,
    insightsGeneratedAt: null,
    latestSuccessfulAt: null,
  });
  const [supportRefreshing, setSupportRefreshing] = useState(false);
  const isDesktop = isTauri();

  const updateSupportFreshness = useCallback(
    (partial: Partial<AboutSupportFreshness>) => {
      setSupportFreshness((previous) => {
        const next = {
          ...previous,
          ...partial,
        };

        next.latestSuccessfulAt = getLatestTimestamp(
          next.updateCheckedAt,
          next.systemInfoRefreshedAt,
          next.insightsGeneratedAt,
        );

        return next;
      });
    },
    [],
  );

  const checkForUpdate = useCallback(async () => {
    if (!tauri.isTauri()) {
      const checkedAt = new Date().toISOString();
      const normalized = normalizeSelfUpdateInfo(
        {
          current_version: APP_VERSION,
          latest_version: APP_VERSION,
          update_available: false,
          release_notes: null,
          selected_source: null,
          attempted_sources: [],
          error_category: null,
          error_message: null,
        },
        APP_VERSION,
      );
      setUpdateInfo({
        ...normalized,
      });
      setUpdateStatus(deriveStatusFromUpdateInfo(normalized));
      updateSupportFreshness({
        updateCheckedAt: checkedAt,
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setUpdateErrorCategory(null);
    setUpdateErrorMessage(null);
    setUpdateStatus("checking");
    try {
      const checkedAt = new Date().toISOString();
      const info = normalizeSelfUpdateInfo(
        await tauri.selfCheckUpdate(),
        APP_VERSION,
      );
      setUpdateInfo(info);
      updateSupportFreshness({
        updateCheckedAt: checkedAt,
      });
      const status = deriveStatusFromUpdateInfo(info);
      setUpdateStatus(status);
      if (status === "error") {
        const category =
          mapSelfUpdateErrorCategory(info.error_category) ?? "update_check_failed";
        setUpdateErrorCategory(category);
        setUpdateErrorMessage(info.error_message ?? null);
        setError(toAboutErrorKey(category));
      }
    } catch (err) {
      const category = categorizeUpdateError(err);
      setUpdateErrorCategory(category);
      setUpdateErrorMessage(err instanceof Error ? err.message : String(err));
      setError(toAboutErrorKey(category));
      setUpdateStatus("error");
      const fallback = normalizeSelfUpdateInfo(
        {
          current_version: APP_VERSION,
          latest_version: APP_VERSION,
          update_available: false,
          release_notes: null,
          selected_source: null,
          attempted_sources: [],
          error_category: null,
          error_message: null,
        },
        APP_VERSION,
      );
      setUpdateInfo(fallback);
    } finally {
      setLoading(false);
    }
  }, [updateSupportFreshness]);

  const loadSystemInfo = useCallback(async () => {
    setSystemError(null);
    if (!tauri.isTauri()) {
      setSystemInfo({
        os: "Web",
        arch: "Browser",
        osVersion: "",
        osLongVersion: "",
        kernelVersion: "",
        hostname: "",
        osName: "",
        distributionId: "",
        cpuArch: "",
        cpuModel: "",
        cpuVendorId: "",
        cpuFrequency: 0,
        cpuCores: 0,
        physicalCoreCount: null,
        globalCpuUsage: 0,
        totalMemory: 0,
        availableMemory: 0,
        usedMemory: 0,
        totalSwap: 0,
        usedSwap: 0,
        uptime: 0,
        bootTime: 0,
        loadAverage: [0, 0, 0],
        gpus: [],
        appVersion: APP_VERSION,
        homeDir: "~/.cognia",
        locale: locale === "zh" ? "zh-CN" : "en-US",
        cacheInternalSizeHuman: "0 B",
        cacheExternalSizeHuman: "0 B",
        cacheTotalSizeHuman: "0 B",
        components: [],
        battery: null,
        disks: [],
        networks: [],
        subsystemErrors: [],
        sectionSummary: buildSystemSectionSummary({
          components: [],
          battery: null,
          disks: [],
          networks: [],
          subsystemErrors: [],
        }),
      });
      updateSupportFreshness({
        systemInfoRefreshedAt: new Date().toISOString(),
      });
      setSystemLoading(false);
      return;
    }

    setSystemLoading(true);
    try {
      const [
        platformResult,
        cogniaDirResult,
        componentsResult,
        batteryResult,
        disksResult,
        networksResult,
        cacheStatsResult,
      ] = await Promise.allSettled([
        tauri.getPlatformInfo(),
        tauri.getCogniaDir(),
        tauri.getComponentsInfo(),
        tauri.getBatteryInfo(),
        tauri.getDiskInfo(),
        tauri.getNetworkInterfaces(),
        tauri.getCombinedCacheStats(),
      ]);

      const platformInfo =
        platformResult.status === "fulfilled" ? platformResult.value : null;
      const cogniaDir =
        cogniaDirResult.status === "fulfilled"
          ? cogniaDirResult.value
          : "~/.cognia";
      const components =
        componentsResult.status === "fulfilled" ? componentsResult.value : [];
      const battery =
        batteryResult.status === "fulfilled" ? batteryResult.value : null;
      const disks = disksResult.status === "fulfilled" ? disksResult.value : [];
      const networks =
        networksResult.status === "fulfilled" ? networksResult.value : [];
      const cacheStats =
        cacheStatsResult.status === "fulfilled" ? cacheStatsResult.value : null;
      const subsystemErrors: SystemSubsystem[] = [];
      if (componentsResult.status !== "fulfilled")
        subsystemErrors.push("components");
      if (batteryResult.status !== "fulfilled") subsystemErrors.push("battery");
      if (disksResult.status !== "fulfilled") subsystemErrors.push("disks");
      if (networksResult.status !== "fulfilled")
        subsystemErrors.push("networks");
      if (cacheStatsResult.status !== "fulfilled")
        subsystemErrors.push("cache");
      if (cogniaDirResult.status !== "fulfilled")
        subsystemErrors.push("homeDir");

      if (!platformInfo) {
        throw new Error("Failed to load platform info");
      }

      setSystemInfo({
        os: platformInfo.os,
        arch: platformInfo.arch,
        osVersion: platformInfo.osVersion,
        osLongVersion: platformInfo.osLongVersion,
        kernelVersion: platformInfo.kernelVersion,
        hostname: platformInfo.hostname,
        osName: platformInfo.osName,
        distributionId: platformInfo.distributionId,
        cpuArch: platformInfo.cpuArch,
        cpuModel: platformInfo.cpuModel,
        cpuVendorId: platformInfo.cpuVendorId,
        cpuFrequency: platformInfo.cpuFrequency,
        cpuCores: platformInfo.cpuCores,
        physicalCoreCount: platformInfo.physicalCoreCount,
        globalCpuUsage: platformInfo.globalCpuUsage,
        totalMemory: platformInfo.totalMemory,
        availableMemory: platformInfo.availableMemory,
        usedMemory: platformInfo.usedMemory,
        totalSwap: platformInfo.totalSwap,
        usedSwap: platformInfo.usedSwap,
        uptime: platformInfo.uptime,
        bootTime: platformInfo.bootTime,
        loadAverage: platformInfo.loadAverage,
        gpus: platformInfo.gpus,
        appVersion: platformInfo.appVersion || APP_VERSION,
        homeDir: cogniaDir,
        locale: locale === "zh" ? "zh-CN" : "en-US",
        cacheInternalSizeHuman: cacheStats?.internalSizeHuman || "0 B",
        cacheExternalSizeHuman: cacheStats?.externalSizeHuman || "0 B",
        cacheTotalSizeHuman: cacheStats?.totalSizeHuman || "0 B",
        components,
        battery,
        disks,
        networks,
        subsystemErrors,
        sectionSummary: buildSystemSectionSummary({
          components,
          battery,
          disks,
          networks,
          subsystemErrors,
        }),
      });
      updateSupportFreshness({
        systemInfoRefreshedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Failed to load system info:", err);
      setSystemError("system_info_failed");
      setSystemInfo({
        os: "Unknown",
        arch: "Unknown",
        osVersion: "",
        osLongVersion: "",
        kernelVersion: "",
        hostname: "",
        osName: "",
        distributionId: "",
        cpuArch: "",
        cpuModel: "",
        cpuVendorId: "",
        cpuFrequency: 0,
        cpuCores: 0,
        physicalCoreCount: null,
        globalCpuUsage: 0,
        totalMemory: 0,
        availableMemory: 0,
        usedMemory: 0,
        totalSwap: 0,
        usedSwap: 0,
        uptime: 0,
        bootTime: 0,
        loadAverage: [0, 0, 0],
        gpus: [],
        appVersion: APP_VERSION,
        homeDir: "~/.cognia",
        locale: locale === "zh" ? "zh-CN" : "en-US",
        cacheInternalSizeHuman: "0 B",
        cacheExternalSizeHuman: "0 B",
        cacheTotalSizeHuman: "0 B",
        components: [],
        battery: null,
        disks: [],
        networks: [],
        subsystemErrors: ["platform"],
        sectionSummary: buildSystemSectionSummary({
          components: [],
          battery: null,
          disks: [],
          networks: [],
          subsystemErrors: ["platform"],
        }),
      });
    } finally {
      setSystemLoading(false);
    }
  }, [locale, updateSupportFreshness]);

  const loadAboutInsights = useCallback(async () => {
    if (!tauri.isTauri()) {
      setAboutInsights({
        runtimeMode: "web",
        providerSummary: {
          total: 0,
          installed: 0,
          supported: 0,
          unsupported: 0,
        },
        storageSummary: {
          cacheTotalSizeHuman: "0 B",
          logTotalSizeBytes: null,
          logTotalSizeHuman: null,
        },
        sections: {
          providers: "unavailable",
          logs: "unavailable",
          cache: "unavailable",
        },
        generatedAt: new Date().toISOString(),
      });
      updateSupportFreshness({
        insightsGeneratedAt: new Date().toISOString(),
      });
      setInsightsLoading(false);
      return;
    }

    setInsightsLoading(true);
    try {
      const [providersResult, logSizeResult, cacheStatsResult] =
        await Promise.allSettled([
          tauri.providerStatusAll(),
          tauri.logGetTotalSize(),
          tauri.getCombinedCacheStats(),
        ]);

      const providerList =
        providersResult.status === "fulfilled" ? providersResult.value : [];
      const providerSummary = {
        total: providerList.length,
        installed: providerList.filter((provider) => provider.installed).length,
        supported: providerList.filter(
          (provider) => provider.status !== "unsupported",
        ).length,
        unsupported: providerList.filter(
          (provider) => provider.status === "unsupported",
        ).length,
      };

      const logTotalSizeBytes =
        logSizeResult.status === "fulfilled" ? logSizeResult.value : null;
      const logTotalSizeHuman =
        typeof logTotalSizeBytes === "number"
          ? formatBytes(Math.max(0, logTotalSizeBytes))
          : null;
      const cacheTotalSizeHuman =
        cacheStatsResult.status === "fulfilled"
          ? cacheStatsResult.value.totalSizeHuman
          : "0 B";

      const generatedAt = new Date().toISOString();
      setAboutInsights({
        runtimeMode: "desktop",
        providerSummary,
        storageSummary: {
          cacheTotalSizeHuman,
          logTotalSizeBytes,
          logTotalSizeHuman,
        },
        sections: {
          providers:
            providersResult.status === "fulfilled" ? "ok" : "failed",
          logs: logSizeResult.status === "fulfilled" ? "ok" : "failed",
          cache: cacheStatsResult.status === "fulfilled" ? "ok" : "failed",
        },
        generatedAt,
      });
      updateSupportFreshness({
        insightsGeneratedAt: generatedAt,
      });
    } catch (err) {
      console.error("Failed to load about insights:", err);
      setAboutInsights({
        runtimeMode: "desktop",
        providerSummary: {
          total: 0,
          installed: 0,
          supported: 0,
          unsupported: 0,
        },
        storageSummary: {
          cacheTotalSizeHuman: "0 B",
          logTotalSizeBytes: null,
          logTotalSizeHuman: null,
        },
        sections: {
          providers: "failed",
          logs: "failed",
          cache: "failed",
        },
        generatedAt: new Date().toISOString(),
      });
    } finally {
      setInsightsLoading(false);
    }
  }, [updateSupportFreshness]);

  // Check for updates only once on mount (not affected by locale changes)
  useEffect(() => {
    checkForUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load system info when locale changes
  useEffect(() => {
    void Promise.all([loadSystemInfo(), loadAboutInsights()]);
  }, [loadSystemInfo, loadAboutInsights]);

  useEffect(() => {
    if (!tauri.isTauri()) return;
    void ensureCacheInvalidationBridge();
    const dispose = subscribeInvalidation(
      "about_cache_stats",
      withThrottle(() => {
        void Promise.all([loadSystemInfo(), loadAboutInsights()]);
      }, 500),
    );

    return () => {
      dispose();
    };
  }, [loadAboutInsights, loadSystemInfo]);

  const handleUpdate = useCallback(async (t: (key: string) => string) => {
    if (!tauri.isTauri()) {
      setUpdateErrorCategory("unsupported_error");
      setUpdateErrorMessage("Self-update is only supported in desktop mode.");
      setUpdateStatus("error");
      toast.error(t("about.updateDesktopOnly"));
      return;
    }

    setError(null);
    setUpdateErrorCategory(null);
    setUpdateErrorMessage(null);
    setUpdating(true);
    setUpdateProgress(0);
    setUpdateStatus("downloading");
    try {
      await tauri.selfUpdate();
      setUpdateStatus("installing");
      toast.success(
        t("about.updateStarted") ||
          "Update started! The application will restart shortly.",
      );
    } catch (err) {
      const category = categorizeUpdateError(err);
      setUpdateErrorCategory(
        category === "unknown_error" ? "update_install_failed" : category,
      );
      setUpdateErrorMessage(err instanceof Error ? err.message : String(err));
      setUpdateStatus("error");
      toast.error(`${t("common.error")}: ${err}`);
      setUpdating(false);
    }
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      if (!tauri.isTauri()) return;
      try {
        const handler = await tauri.listenSelfUpdateProgress((event) => {
          setUpdateStatus(mapProgressToUpdateStatus(event.status));
          if (typeof event.progress === "number") {
            setUpdateProgress(event.progress);
          }
          if (event.status === "done") {
            setUpdateProgress(100);
            setUpdating(false);
          }
          if (event.status === "error") {
            setUpdating(false);
            const mapped = mapSelfUpdateErrorCategory(event.errorCategory);
            setUpdateErrorCategory(mapped ?? "update_install_failed");
            setUpdateErrorMessage(
              event.errorMessage ?? "Update progress reported an error",
            );
            setError(toAboutErrorKey(mapped ?? "update_install_failed"));
          }
        });
        unlisten = handler;
      } catch (err) {
        console.error("Failed to listen for update progress:", err);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setUpdateErrorCategory(null);
    setUpdateErrorMessage(null);
  }, []);

  const refreshAllSupportData = useCallback(async () => {
    setSupportRefreshing(true);

    try {
      await Promise.all([checkForUpdate(), loadSystemInfo(), loadAboutInsights()]);
    } finally {
      setSupportRefreshing(false);
    }
  }, [checkForUpdate, loadAboutInsights, loadSystemInfo]);

  const exportDiagnostics = useCallback(
    async (t: (key: string) => string) => {
      // Desktop mode: full ZIP bundle via Tauri backend
      if (isTauri()) {
        await exportDesktopDiagnosticBundle({
          t,
          failureToastKey: "about.diagnosticsFailed",
          includeConfig: true,
        });
        return;
      }

      // Web mode: generate a client-side diagnostic JSON file download
      try {
        const report = buildWebDiagnosticsReport({
          systemInfo,
          aboutInsights,
          updateInfo,
          updateStatus,
          updateErrorCategory,
          updateErrorMessage,
          runtime: {
            navigator: {
              userAgent: navigator.userAgent,
              language: navigator.language,
              languages: [...navigator.languages],
              platform: navigator.platform,
              cookieEnabled: navigator.cookieEnabled,
              onLine: navigator.onLine,
              hardwareConcurrency: navigator.hardwareConcurrency,
              deviceMemory:
                ((navigator as unknown as Record<string, unknown>)
                  .deviceMemory as number | undefined) ?? null,
              maxTouchPoints: navigator.maxTouchPoints,
            },
            screen: {
              width: screen.width,
              height: screen.height,
              colorDepth: screen.colorDepth,
              pixelRatio: window.devicePixelRatio,
            },
            performance: {
              memory:
                (performance as unknown as Record<string, unknown>).memory ??
                null,
              timing: performance.timing
                ? {
                    navigationStart: performance.timing.navigationStart,
                    loadEventEnd: performance.timing.loadEventEnd,
                    domContentLoadedEventEnd:
                      performance.timing.domContentLoadedEventEnd,
                  }
                : null,
            },
          },
        });

        report.localStorage = {
          itemCount: localStorage.length,
          estimatedSizeKB: (() => {
            try {
              let total = 0;
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key) {
                  total +=
                    key.length + (localStorage.getItem(key)?.length || 0);
                }
              }
              return Math.round((total * 2) / 1024); // UTF-16 → bytes → KB
            } catch {
              return null;
            }
          })(),
        };

        const json = JSON.stringify(report, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cognia-diagnostic-${ts}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success(t("diagnostic.exportSuccessWeb"));
      } catch (err) {
        console.error("Failed to export web diagnostics:", err);
        toast.error(t("about.diagnosticsFailed"));
      }
    },
    [
      updateErrorCategory,
      updateErrorMessage,
      updateInfo,
      updateStatus,
      aboutInsights,
      systemInfo,
    ],
  );

  return {
    updateInfo,
    loading,
    updating,
    updateProgress,
    updateStatus,
    updateErrorCategory,
    updateErrorMessage,
    error,
    systemError,
    systemInfo,
    systemLoading,
    aboutInsights,
    insightsLoading,
    supportFreshness,
    supportRefreshing,
    isDesktop,
    checkForUpdate,
    reloadSystemInfo: loadSystemInfo,
    reloadAboutInsights: loadAboutInsights,
    refreshAllSupportData,
    handleUpdate,
    clearError,
    exportDiagnostics,
  };
}
