"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { useSettings } from "@/hooks/use-settings";
import { useLocale } from "@/components/providers/locale-provider";
import { useTheme } from "next-themes";
import { useAppearanceStore, type AccentColor } from "@/lib/stores/appearance";
import { useSettingsStore, type AppSettings } from "@/lib/stores/settings";
import { isTauri } from "@/lib/tauri";
import {
  APPEARANCE_DEFAULTS,
  isThemeMode,
  normalizeAccentColor,
  normalizeChartColorTheme,
  normalizeInterfaceDensity,
  normalizeInterfaceRadius,
  normalizeLocale,
  normalizeReducedMotion,
  normalizeThemeMode,
  normalizeWindowEffect,
  parseAppearanceConfig,
  type AppearanceConfigPath,
} from "@/lib/theme";
import {
  useSettingsShortcuts,
  useSectionNavigation,
} from "@/hooks/use-settings-shortcuts";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import {
  useSettingsSearch,
  useActiveSection,
} from "@/hooks/use-settings-search";
import {
  validateField,
  GeneralSettings,
  NetworkSettings,
  SecuritySettings,
  MirrorsSettings,
  AppearanceSettings,
  UpdateSettings,
  TraySettings,
  SidebarOrderCustomizer,
  PathsSettings,
  ProviderSettings,
  BackupPolicySettings,
  BackupSettings,
  StartupSettings,
  ShortcutSettings,
  SystemInfo,
  SettingsSkeleton,
} from "@/components/settings";
import { SettingsSearch } from "@/components/settings/settings-search";
import { SettingsNav } from "@/components/settings/settings-nav";
import { CollapsibleSection } from "@/components/settings/collapsible-section";
import { PageHeader } from "@/components/layout/page-header";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  AlertCircle,
  Save,
  RotateCcw,
  Download,
  Upload,
  ClipboardPaste,
  Copy,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOnboardingStore } from "@/lib/stores/onboarding";
import { BUBBLE_HINTS } from "@/lib/constants/onboarding";
import { toast } from "sonner";
import { readClipboard, writeClipboard } from "@/lib/clipboard";
import { type SettingsSection } from "@/lib/constants/settings-registry";
import {
  APP_SETTINGS_CONFIG_KEY_MAP,
  appSettingKeyToConfigKey,
  appSettingValueToConfigValue,
  configToAppSettings,
} from "@/lib/settings/app-settings-mapping";
import {
  DEFAULT_SIDEBAR_ITEM_ORDER,
  moveSidebarItem,
  normalizeSidebarItemOrder,
  splitSidebarItemOrder,
  type PrimarySidebarItemId,
  type SecondarySidebarItemId,
} from "@/lib/sidebar/order";
import { syncAppearanceConfigValue } from "@/lib/theme/appearance-sync";

interface SaveProgress {
  current: number;
  total: number;
}

// Section IDs in order
const SECTION_IDS: SettingsSection[] = [
  "general",
  "network",
  "security",
  "mirrors",
  "appearance",
  "updates",
  "tray",
  "shortcuts",
  "paths",
  "provider",
  "backup",
  "startup",
  "system",
];

const SECTION_CONFIG_PREFIXES: Record<SettingsSection, string[]> = {
  general: ["general."],
  network: ["network."],
  security: ["security."],
  mirrors: ["mirrors."],
  appearance: ["appearance."],
  updates: ["updates."],
  tray: ["tray."],
  shortcuts: ["shortcuts."],
  paths: ["paths."],
  provider: ["provider_settings."],
  backup: ["backup."],
  startup: ["startup."],
  system: [],
};

const RUNTIME_TRAY_MANAGED_APP_SETTING_KEYS = new Set<keyof AppSettings>([
  "minimizeToTray",
  "startMinimized",
  "trayClickBehavior",
]);

type AppSettingsDraftDiff = {
  appKey: keyof AppSettings;
  configKey: string;
  value: string;
  section: SettingsSection;
};

function getConfigDiffEntries(
  draft: Record<string, string>,
  baseline: Record<string, string>,
): Array<[string, string]> {
  const keys = new Set([...Object.keys(draft), ...Object.keys(baseline)]);
  const diffs: Array<[string, string]> = [];

  for (const key of keys) {
    const draftValue = draft[key] ?? "";
    const baselineValue = baseline[key] ?? "";
    if (draftValue !== baselineValue) {
      diffs.push([key, draftValue]);
    }
  }

  return diffs;
}

function hasConfigDiff(
  draft: Record<string, string>,
  baseline: Record<string, string>,
): boolean {
  return getConfigDiffEntries(draft, baseline).length > 0;
}

export default function SettingsPage() {
  const {
    config,
    loading,
    error,
    fetchConfig,
    updateConfigValue,
    resetConfig,
    platformInfo,
    fetchPlatformInfo,
  } = useSettings();
  const { appSettings, setAppSettings, cogniaDir } = useSettingsStore();
  const { t, locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const {
    accentColor,
    setAccentColor,
    chartColorTheme,
    setChartColorTheme,
    interfaceRadius,
    setInterfaceRadius,
    interfaceDensity,
    setInterfaceDensity,
    reducedMotion,
    setReducedMotion,
    windowEffect,
    setWindowEffect,
    reset: resetAppearance,
  } = useAppearanceStore();
  const [localConfig, setLocalConfig] = useState<Record<string, string>>({});
  const [originalConfig, setOriginalConfig] = useState<Record<string, string>>(
    {},
  );
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string | null>
  >({});
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<SaveProgress | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<
    Set<SettingsSection>
  >(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const localConfigRef = useRef<Record<string, string>>(localConfig);
  const originalConfigRef = useRef<Record<string, string>>(originalConfig);

  // Search functionality
  const search = useSettingsSearch({
    t,
    showAdvanced: true,
    showTauriOnly: isTauri(),
  });

  // Section navigation
  const { activeSection, setActiveSection, scrollToSection } =
    useActiveSection(SECTION_IDS);
  const { navigateSection, jumpToSection } = useSectionNavigation({
    sectionIds: SECTION_IDS,
    activeSection,
    setActiveSection,
  });
  const configDiffEntries = useMemo(
    () => getConfigDiffEntries(localConfig, originalConfig),
    [localConfig, originalConfig],
  );
  const hasConfigDraftChanges = configDiffEntries.length > 0;
  const configDiffKeys = useMemo(
    () => configDiffEntries.map(([key]) => key),
    [configDiffEntries],
  );

  const appSettingsDiffEntries = useMemo<AppSettingsDraftDiff[]>(() => {
    const diffs: AppSettingsDraftDiff[] = [];

    for (const appKey of Object.keys(APP_SETTINGS_CONFIG_KEY_MAP) as Array<
      keyof typeof APP_SETTINGS_CONFIG_KEY_MAP
    >) {
      if (RUNTIME_TRAY_MANAGED_APP_SETTING_KEYS.has(appKey)) {
        continue;
      }
      const configKey = APP_SETTINGS_CONFIG_KEY_MAP[appKey];
      if (!(configKey in localConfig) && !(configKey in originalConfig)) {
        continue;
      }
      const configValue = appSettingValueToConfigValue(
        appKey,
        appSettings[appKey],
      );
      if (configValue === null) {
        continue;
      }
      if ((originalConfig[configKey] ?? "") === configValue) {
        continue;
      }

      diffs.push({
        appKey,
        configKey,
        value: configValue,
        section: configKey.startsWith("updates.") ? "updates" : "tray",
      });
    }

    return diffs;
  }, [appSettings, localConfig, originalConfig]);

  const hasChanges = hasConfigDraftChanges || appSettingsDiffEntries.length > 0;

  // Track which sections have changes
  const sectionHasChanges = useCallback(
    (sectionId: SettingsSection): boolean => {
      const prefixes = SECTION_CONFIG_PREFIXES[sectionId] || [];
      const hasConfigSectionDiff = configDiffKeys.some((key) =>
        prefixes.some((prefix) => key.startsWith(prefix)),
      );
      const hasAppSettingsSectionDiff = appSettingsDiffEntries.some(
        (entry) => entry.section === sectionId,
      );
      return hasConfigSectionDiff || hasAppSettingsSectionDiff;
    },
    [configDiffKeys, appSettingsDiffEntries],
  );

  useUnsavedChanges("settings-page", hasChanges);

  useEffect(() => {
    const loadData = async () => {
      const shouldFetchConfig = Object.keys(config).length === 0;
      await Promise.all([
        shouldFetchConfig ? fetchConfig() : Promise.resolve(config),
        fetchPlatformInfo(),
      ]);
      setInitialLoadComplete(true);
    };
    loadData();
  }, [config, fetchConfig, fetchPlatformInfo]);

  useEffect(() => {
    localConfigRef.current = localConfig;
  }, [localConfig]);

  useEffect(() => {
    originalConfigRef.current = originalConfig;
  }, [originalConfig]);

  useEffect(() => {
    const hadDrafts = hasConfigDiff(
      localConfigRef.current,
      originalConfigRef.current,
    );
    setOriginalConfig(config);
    if (!saving && !hadDrafts) {
      setLocalConfig(config);
    }
  }, [config, saving]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  const handleChange = useCallback(
    (key: string, value: string) => {
      setLocalConfig((prev) => ({ ...prev, [key]: value }));

      const validationError = validateField(key, value, t);
      setValidationErrors((prev) => ({ ...prev, [key]: validationError }));
    },
    [t],
  );

  const hasValidationErrors = useCallback(() => {
    return Object.values(validationErrors).some((error) => error !== null);
  }, [validationErrors]);

  const validateAllFields = useCallback(() => {
    const errors: Record<string, string | null> = {};
    let hasErrors = false;

    for (const [key, value] of Object.entries(localConfig)) {
      const error = validateField(key, value, t);
      errors[key] = error;
      if (error) hasErrors = true;
    }

    setValidationErrors(errors);
    return !hasErrors;
  }, [localConfig, t]);

  const handleSave = useCallback(async () => {
    if (!validateAllFields()) {
      toast.error(t("settings.validationError"));
      return;
    }

    const pendingChanges = new Map<string, string>();
    for (const [key, value] of configDiffEntries) {
      pendingChanges.set(key, value);
    }
    for (const entry of appSettingsDiffEntries) {
      pendingChanges.set(entry.configKey, entry.value);
    }

    const changedKeys = Array.from(pendingChanges.entries());

    if (changedKeys.length === 0) {
      toast.info(t("settings.noChanges"));
      return;
    }

    setSaving(true);
    setSaveProgress({ current: 0, total: changedKeys.length });

    const errors: string[] = [];

    for (let i = 0; i < changedKeys.length; i++) {
      const [key, value] = changedKeys[i];
      try {
        await updateConfigValue(key, value);
        setSaveProgress({ current: i + 1, total: changedKeys.length });
      } catch (err) {
        errors.push(`${key}: ${err}`);
      }
    }

    setSaving(false);
    setSaveProgress(null);

    if (errors.length === 0) {
      toast.success(t("settings.settingsSaved"));
    } else if (errors.length < changedKeys.length) {
      toast.warning(t("settings.partialSaveError", { count: errors.length }));
    } else {
      toast.error(t("settings.saveFailed"));
    }
  }, [
    configDiffEntries,
    appSettingsDiffEntries,
    updateConfigValue,
    validateAllFields,
    t,
  ]);

  const handleReset = useCallback(async () => {
    try {
      await resetConfig();
      const resetSnapshot = await fetchConfig();
      const parsedAppearance = parseAppearanceConfig(resetSnapshot);

      resetAppearance();
      setTheme(parsedAppearance.theme);
      setLocale(parsedAppearance.locale);
      setAccentColor(parsedAppearance.accentColor);
      setChartColorTheme(parsedAppearance.chartColorTheme);
      setInterfaceRadius(parsedAppearance.interfaceRadius);
      setInterfaceDensity(parsedAppearance.interfaceDensity);
      setReducedMotion(parsedAppearance.reducedMotion);
      setWindowEffect(parsedAppearance.windowEffect);

      if (isTauri()) {
        try {
          const { windowEffectApply } = await import("@/lib/tauri");
          await windowEffectApply(parsedAppearance.windowEffect);
        } catch (err) {
          console.error("Failed to apply reset window effect:", err);
        }
      }

      setOriginalConfig(resetSnapshot);
      setLocalConfig(resetSnapshot);
      setAppSettings(configToAppSettings(resetSnapshot, appSettings));
      setValidationErrors({});
      toast.success(t("settings.settingsReset"));
    } catch (err) {
      toast.error(`${t("settings.resetFailed")}: ${err}`);
    }
  }, [
    resetConfig,
    fetchConfig,
    resetAppearance,
    setTheme,
    setLocale,
    setAccentColor,
    setChartColorTheme,
    setInterfaceRadius,
    setInterfaceDensity,
    setReducedMotion,
    setWindowEffect,
    setAppSettings,
    appSettings,
    t,
  ]);

  const buildExportData = useCallback(async (): Promise<
    Record<string, unknown>
  > => {
    if (isTauri()) {
      const { configExport } = await import("@/lib/tauri");
      const tomlContent = await configExport();
      return {
        version: "2.0",
        exportedAt: new Date().toISOString(),
        backendConfig: tomlContent,
        appSettings,
      };
    }
    return {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      settings: localConfig,
      appSettings,
    };
  }, [localConfig, appSettings]);

  const normalizeImportedAppSettings = useCallback(
    (value: unknown): Partial<AppSettings> | null => {
      if (!value || typeof value !== "object") return null;

      const raw = value as Record<string, unknown>;
      const normalized: Partial<AppSettings> = {};

      if (typeof raw.checkUpdatesOnStart === "boolean")
        normalized.checkUpdatesOnStart = raw.checkUpdatesOnStart;
      if (typeof raw.autoInstallUpdates === "boolean")
        normalized.autoInstallUpdates = raw.autoInstallUpdates;
      if (typeof raw.notifyOnUpdates === "boolean")
        normalized.notifyOnUpdates = raw.notifyOnUpdates;
      if (typeof raw.minimizeToTray === "boolean")
        normalized.minimizeToTray = raw.minimizeToTray;
      if (typeof raw.startMinimized === "boolean")
        normalized.startMinimized = raw.startMinimized;
      if (typeof raw.autostart === "boolean")
        normalized.autostart = raw.autostart;
      if (
        raw.trayClickBehavior === "toggle_window" ||
        raw.trayClickBehavior === "show_menu" ||
        raw.trayClickBehavior === "check_updates" ||
        raw.trayClickBehavior === "do_nothing"
      ) {
        normalized.trayClickBehavior = raw.trayClickBehavior;
      }
      if (typeof raw.showNotifications === "boolean")
        normalized.showNotifications = raw.showNotifications;
      if (
        raw.trayNotificationLevel === "all" ||
        raw.trayNotificationLevel === "important_only" ||
        raw.trayNotificationLevel === "none"
      ) {
        normalized.trayNotificationLevel = raw.trayNotificationLevel;
      }

      if (Array.isArray(raw.sidebarItemOrder)) {
        const rawOrder = raw.sidebarItemOrder.filter(
          (item): item is string => typeof item === "string",
        );
        normalized.sidebarItemOrder = normalizeSidebarItemOrder(
          rawOrder.length > 0 ? rawOrder : DEFAULT_SIDEBAR_ITEM_ORDER,
        );
      }

      return normalized;
    },
    [],
  );

  const applyImportedSettings = useCallback(
    async (content: string) => {
      const data = JSON.parse(content);

      // v2.0 format: full backend TOML config
      if (data.version === "2.0" && data.backendConfig && isTauri()) {
        const { configImport } = await import("@/lib/tauri");
        await configImport(data.backendConfig);
        const importedAppSettings = normalizeImportedAppSettings(
          data.appSettings,
        );
        if (
          importedAppSettings &&
          Object.keys(importedAppSettings).length > 0
        ) {
          setAppSettings(importedAppSettings);
        }
        // Refresh config from backend
        const refreshedConfig = await fetchConfig();
        setLocalConfig(refreshedConfig);
        setOriginalConfig(refreshedConfig);
        setValidationErrors({});
        toast.success(t("settings.importSuccess"));
        return;
      }

      // v1.0 format: frontend JSON settings map (legacy / web fallback)
      if (!data.settings || typeof data.settings !== "object") {
        toast.error(t("settings.importInvalidFormat"));
        return;
      }

      setLocalConfig((prev) => ({ ...prev, ...data.settings }));

      const importedAppSettings = normalizeImportedAppSettings(
        data.appSettings,
      );
      if (importedAppSettings && Object.keys(importedAppSettings).length > 0) {
        setAppSettings(importedAppSettings);
      }

      const errors: Record<string, string | null> = {};
      for (const [key, value] of Object.entries(data.settings)) {
        if (typeof value === "string") {
          errors[key] = validateField(key, value, t);
        }
      }
      setValidationErrors((prev) => ({ ...prev, ...errors }));

      toast.success(t("settings.importSuccess"));
    },
    [normalizeImportedAppSettings, setAppSettings, fetchConfig, t],
  );

  const handleExport = useCallback(async () => {
    try {
      const exportData = await buildExportData();
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cognia-settings-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t("settings.exportSuccess"));
    } catch {
      toast.error(t("settings.saveFailed"));
    }
  }, [buildExportData, t]);

  const handleExportToClipboard = useCallback(async () => {
    try {
      const exportData = await buildExportData();
      await writeClipboard(JSON.stringify(exportData, null, 2));
      toast.success(t("settings.exportToClipboard"));
    } catch {
      toast.error(t("settings.saveFailed"));
    }
  }, [buildExportData, t]);

  const handleImport = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          await applyImportedSettings(content);
        } catch {
          toast.error(t("settings.importFailed"));
        }
      };
      reader.readAsText(file);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [applyImportedSettings, t],
  );

  const handleImportFromClipboard = useCallback(async () => {
    try {
      const text = await readClipboard();
      if (!text?.trim()) {
        toast.error(t("settings.clipboardEmpty"));
        return;
      }
      await applyImportedSettings(text);
    } catch {
      toast.error(t("settings.importFailed"));
    }
  }, [applyImportedSettings, t]);

  const handleDiscardChanges = useCallback(() => {
    setLocalConfig(originalConfig);
    setAppSettings(configToAppSettings(originalConfig, appSettings));
    setValidationErrors({});
  }, [originalConfig, setAppSettings, appSettings]);

  // Appearance settings handlers with shared write + readback reconciliation
  const syncAppearanceSetting = useCallback(
    async (key: AppearanceConfigPath, value: string): Promise<string> => {
      if (!isTauri()) return value;
      try {
        return await syncAppearanceConfigValue({
          key,
          value,
          updateConfigValue,
          fetchConfig,
        });
      } catch (err) {
        console.error(`Failed to sync ${key} to backend:`, err);
        return value;
      }
    },
    [updateConfigValue, fetchConfig],
  );

  const resetAppearanceControl = useCallback(
    async (key: keyof typeof APPEARANCE_DEFAULTS) => {
      switch (key) {
        case "theme": {
          setTheme(APPEARANCE_DEFAULTS.theme);
          const canonical = await syncAppearanceSetting(
            "appearance.theme",
            APPEARANCE_DEFAULTS.theme,
          );
          setTheme(normalizeThemeMode(canonical));
          break;
        }
        case "accentColor": {
          setAccentColor(APPEARANCE_DEFAULTS.accentColor);
          const canonical = await syncAppearanceSetting(
            "appearance.accent_color",
            APPEARANCE_DEFAULTS.accentColor,
          );
          setAccentColor(normalizeAccentColor(canonical));
          break;
        }
        case "chartColorTheme": {
          setChartColorTheme(APPEARANCE_DEFAULTS.chartColorTheme);
          const canonical = await syncAppearanceSetting(
            "appearance.chart_color_theme",
            APPEARANCE_DEFAULTS.chartColorTheme,
          );
          setChartColorTheme(normalizeChartColorTheme(canonical));
          break;
        }
        case "interfaceRadius": {
          setInterfaceRadius(APPEARANCE_DEFAULTS.interfaceRadius);
          const canonical = await syncAppearanceSetting(
            "appearance.interface_radius",
            String(APPEARANCE_DEFAULTS.interfaceRadius),
          );
          setInterfaceRadius(normalizeInterfaceRadius(canonical));
          break;
        }
        case "interfaceDensity": {
          setInterfaceDensity(APPEARANCE_DEFAULTS.interfaceDensity);
          const canonical = await syncAppearanceSetting(
            "appearance.interface_density",
            APPEARANCE_DEFAULTS.interfaceDensity,
          );
          setInterfaceDensity(normalizeInterfaceDensity(canonical));
          break;
        }
        case "reducedMotion": {
          setReducedMotion(APPEARANCE_DEFAULTS.reducedMotion);
          const canonical = await syncAppearanceSetting(
            "appearance.reduced_motion",
            String(APPEARANCE_DEFAULTS.reducedMotion),
          );
          setReducedMotion(normalizeReducedMotion(canonical));
          break;
        }
        case "windowEffect": {
          setWindowEffect(APPEARANCE_DEFAULTS.windowEffect);
          const canonical = await syncAppearanceSetting(
            "appearance.window_effect",
            APPEARANCE_DEFAULTS.windowEffect,
          );
          const canonicalEffect = normalizeWindowEffect(canonical);
          setWindowEffect(canonicalEffect);
          if (isTauri()) {
            const { windowEffectApply } = await import("@/lib/tauri");
            await windowEffectApply(canonicalEffect);
          }
          break;
        }
        case "locale": {
          setLocale(APPEARANCE_DEFAULTS.locale);
          const canonical = await syncAppearanceSetting(
            "appearance.language",
            APPEARANCE_DEFAULTS.locale,
          );
          setLocale(normalizeLocale(canonical));
          break;
        }
      }
    },
    [
      setTheme,
      setAccentColor,
      setChartColorTheme,
      setInterfaceRadius,
      setInterfaceDensity,
      setReducedMotion,
      setWindowEffect,
      setLocale,
      syncAppearanceSetting,
    ],
  );

  const handleThemeChange = useCallback(
    async (newTheme: string) => {
      if (!isThemeMode(newTheme)) {
        toast.error(t("settings.invalidTheme"));
        return;
      }

      const normalized = normalizeThemeMode(newTheme);
      setTheme(normalized);
      const canonical = await syncAppearanceSetting(
        "appearance.theme",
        normalized,
      );
      setTheme(normalizeThemeMode(canonical));
    },
    [setTheme, syncAppearanceSetting, t],
  );

  const handleLocaleChange = useCallback(
    async (newLocale: "en" | "zh") => {
      const normalized = normalizeLocale(newLocale);
      setLocale(normalized);
      const canonical = await syncAppearanceSetting(
        "appearance.language",
        normalized,
      );
      setLocale(normalizeLocale(canonical));
    },
    [setLocale, syncAppearanceSetting],
  );

  const handleAccentColorChange = useCallback(
    async (color: AccentColor) => {
      const normalized = normalizeAccentColor(color);
      setAccentColor(normalized);
      const canonical = await syncAppearanceSetting(
        "appearance.accent_color",
        normalized,
      );
      setAccentColor(normalizeAccentColor(canonical));
    },
    [setAccentColor, syncAppearanceSetting],
  );

  const handleChartColorThemeChange = useCallback(
    async (theme: string) => {
      const normalized = normalizeChartColorTheme(theme);
      setChartColorTheme(normalized);
      const canonical = await syncAppearanceSetting(
        "appearance.chart_color_theme",
        normalized,
      );
      setChartColorTheme(normalizeChartColorTheme(canonical));
    },
    [setChartColorTheme, syncAppearanceSetting],
  );

  const handleInterfaceRadiusChange = useCallback(
    async (radius: import("@/lib/theme/types").InterfaceRadius) => {
      const normalized = normalizeInterfaceRadius(radius);
      setInterfaceRadius(normalized);
      const canonical = await syncAppearanceSetting(
        "appearance.interface_radius",
        String(normalized),
      );
      setInterfaceRadius(normalizeInterfaceRadius(canonical));
    },
    [setInterfaceRadius, syncAppearanceSetting],
  );

  const handleInterfaceDensityChange = useCallback(
    async (density: string) => {
      const normalized = normalizeInterfaceDensity(density);
      setInterfaceDensity(normalized);
      const canonical = await syncAppearanceSetting(
        "appearance.interface_density",
        normalized,
      );
      setInterfaceDensity(normalizeInterfaceDensity(canonical));
    },
    [setInterfaceDensity, syncAppearanceSetting],
  );

  const handleReducedMotionChange = useCallback(
    async (reduced: boolean) => {
      const normalized = normalizeReducedMotion(reduced);
      setReducedMotion(normalized);
      const canonical = await syncAppearanceSetting(
        "appearance.reduced_motion",
        String(normalized),
      );
      setReducedMotion(normalizeReducedMotion(canonical));
    },
    [setReducedMotion, syncAppearanceSetting],
  );

  const handleWindowEffectChange = useCallback(
    async (effect: string) => {
      const normalized = normalizeWindowEffect(effect);
      setWindowEffect(normalized);

      if (isTauri()) {
        try {
          const { windowEffectApply } = await import("@/lib/tauri");
          await windowEffectApply(normalized);
        } catch (err) {
          console.error("Failed to apply window effect:", err);
        }
      }

      const canonical = await syncAppearanceSetting(
        "appearance.window_effect",
        normalized,
      );
      const canonicalEffect = normalizeWindowEffect(canonical);
      setWindowEffect(canonicalEffect);

      if (isTauri() && canonicalEffect !== normalized) {
        try {
          const { windowEffectApply } = await import("@/lib/tauri");
          await windowEffectApply(canonicalEffect);
        } catch (err) {
          console.error("Failed to reconcile window effect:", err);
        }
      }
    },
    [setWindowEffect, syncAppearanceSetting],
  );

  // Focus search handler
  const handleFocusSearch = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  // Section collapse handler
  const handleSectionOpenChange = useCallback(
    (sectionId: SettingsSection, open: boolean) => {
      setCollapsedSections((prev) => {
        const next = new Set(prev);
        if (open) {
          next.delete(sectionId);
        } else {
          next.add(sectionId);
        }
        return next;
      });
    },
    [],
  );

  // Reset a single section to defaults
  const handleResetSection = useCallback(
    (sectionId: SettingsSection) => {
      if (sectionId === "appearance") {
        const appearanceDefaults: Record<AppearanceConfigPath, string> = {
          "appearance.theme": APPEARANCE_DEFAULTS.theme,
          "appearance.accent_color": APPEARANCE_DEFAULTS.accentColor,
          "appearance.chart_color_theme": APPEARANCE_DEFAULTS.chartColorTheme,
          "appearance.interface_radius": String(
            APPEARANCE_DEFAULTS.interfaceRadius,
          ),
          "appearance.interface_density": APPEARANCE_DEFAULTS.interfaceDensity,
          "appearance.reduced_motion": String(
            APPEARANCE_DEFAULTS.reducedMotion,
          ),
          "appearance.language": APPEARANCE_DEFAULTS.locale,
          "appearance.window_effect": APPEARANCE_DEFAULTS.windowEffect,
        };

        resetAppearance();

        setLocalConfig((prev) => ({
          ...prev,
          ...appearanceDefaults,
        }));

        setValidationErrors((prev) => {
          const next = { ...prev };
          for (const key of Object.keys(appearanceDefaults)) {
            next[key] = null;
          }
          return next;
        });

        void (async () => {
          try {
            await Promise.all([
              resetAppearanceControl("theme"),
              resetAppearanceControl("accentColor"),
              resetAppearanceControl("chartColorTheme"),
              resetAppearanceControl("interfaceRadius"),
              resetAppearanceControl("interfaceDensity"),
              resetAppearanceControl("reducedMotion"),
              resetAppearanceControl("locale"),
              resetAppearanceControl("windowEffect"),
            ]);
          } catch (err) {
            console.error("Failed to reset appearance section:", err);
          }
        })();

        toast.success(
          t("settings.sectionReset", {
            section: t(`settings.sections.${sectionId}`),
          }),
        );
        return;
      }

      const prefixes = SECTION_CONFIG_PREFIXES[sectionId] || [];

      // Reset local config for this section to original values
      setLocalConfig((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (prefixes.some((prefix) => key.startsWith(prefix))) {
            next[key] = originalConfig[key] ?? "";
          }
        }
        return next;
      });

      // Clear validation errors for this section
      setValidationErrors((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (prefixes.some((prefix) => key.startsWith(prefix))) {
            next[key] = null;
          }
        }
        return next;
      });

      toast.success(
        t("settings.sectionReset", {
          section: t(`settings.sections.${sectionId}`),
        }),
      );
    },
    [originalConfig, resetAppearance, resetAppearanceControl, t],
  );

  const focusSearchTarget = useCallback(
    (settingKey: string, focusId?: string, attempt = 0) => {
      const candidateIds =
        focusId && focusId !== settingKey
          ? [focusId, settingKey]
          : [focusId ?? settingKey];

      for (const id of candidateIds) {
        const element = document.getElementById(id);
        if (!element) continue;
        element.focus();
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      if (attempt >= 8) {
        return;
      }

      window.setTimeout(() => {
        focusSearchTarget(settingKey, focusId, attempt + 1);
      }, 40);
    },
    [],
  );

  // Navigate to setting from search
  const handleNavigateToSetting = useCallback(
    (section: SettingsSection, key: string, focusId?: string) => {
      // Expand the section if collapsed
      setCollapsedSections((prev) => {
        const next = new Set(prev);
        next.delete(section);
        return next;
      });

      // Scroll to section
      scrollToSection(section);

      // Clear search
      search.clearSearch();

      // Expand first, then focus with retries until the target control is mounted.
      window.setTimeout(() => {
        focusSearchTarget(key, focusId);
      }, 0);
    },
    [focusSearchTarget, scrollToSection, search],
  );

  useSettingsShortcuts({
    onSave: handleSave,
    onReset: handleReset,
    onEscape: hasChanges
      ? handleDiscardChanges
      : search.isSearching
        ? search.clearSearch
        : undefined,
    onFocusSearch: handleFocusSearch,
    onNavigateSection: navigateSection,
    onJumpToSection: jumpToSection,
    enabled: true,
    hasChanges,
    isLoading: loading || saving,
  });

  const handleAppSettingsChange = useCallback(
    async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setAppSettings({ [key]: value });

      const configKey = appSettingKeyToConfigKey(key);
      const configValue = appSettingValueToConfigValue(key, value);
      if (!configKey || configValue === null) {
        return;
      }

      if (RUNTIME_TRAY_MANAGED_APP_SETTING_KEYS.has(key)) {
        return;
      }

      try {
        await updateConfigValue(configKey, configValue);
      } catch (err) {
        toast.error(`${t("settings.saveFailed")}: ${err}`);
      }
    },
    [setAppSettings, updateConfigValue, t],
  );

  const sidebarOrder = useMemo(
    () => splitSidebarItemOrder(appSettings.sidebarItemOrder),
    [appSettings.sidebarItemOrder],
  );

  const handleMovePrimarySidebarItem = useCallback(
    (itemId: PrimarySidebarItemId, direction: "up" | "down") => {
      setAppSettings({
        sidebarItemOrder: moveSidebarItem(
          appSettings.sidebarItemOrder,
          itemId,
          direction,
        ),
      });
    },
    [appSettings.sidebarItemOrder, setAppSettings],
  );

  const handleMoveSecondarySidebarItem = useCallback(
    (itemId: SecondarySidebarItemId, direction: "up" | "down") => {
      setAppSettings({
        sidebarItemOrder: moveSidebarItem(
          appSettings.sidebarItemOrder,
          itemId,
          direction,
        ),
      });
    },
    [appSettings.sidebarItemOrder, setAppSettings],
  );

  const handleResetSidebarOrder = useCallback(() => {
    setAppSettings({ sidebarItemOrder: [...DEFAULT_SIDEBAR_ITEM_ORDER] });
    toast.success(t("settings.sidebarOrderResetSuccess"));
  }, [setAppSettings, t]);

  const canSave = hasChanges && !loading && !saving && !hasValidationErrors();
  const canReset = !loading && !saving;

  return (
    <main className="p-4 md:p-6 space-y-6" aria-labelledby="settings-title">
      <PageHeader
        title={<span id="settings-title">{t("settings.title")}</span>}
        description={t("settings.description")}
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
              aria-label={t("settings.importSettings")}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
                  {t("settings.import")}
                  <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  {t("settings.importFromFile")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleImportFromClipboard}>
                  <ClipboardPaste className="h-4 w-4 mr-2" />
                  {t("settings.importFromClipboard")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                  {t("settings.export")}
                  <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  {t("settings.exportAsFile")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportToClipboard}>
                  <Copy className="h-4 w-4 mr-2" />
                  {t("settings.exportToClipboard")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={!canReset}>
                  <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" />
                  {t("common.reset")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("settings.resetConfirmTitle")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("settings.resetConfirmDesc")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleReset}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t("common.reset")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={handleSave} disabled={!canSave}>
              <Save className="h-4 w-4 mr-2" aria-hidden="true" />
              {saving ? t("settings.saving") : t("settings.saveChanges")}
            </Button>
          </>
        }
      />

      {saveProgress && (
        <div className="space-y-2" role="status" aria-live="polite">
          <div className="flex items-center justify-between text-sm">
            <span>
              {t("settings.savingProgress", {
                current: saveProgress.current,
                total: saveProgress.total,
              })}
            </span>
            <span>
              {Math.round((saveProgress.current / saveProgress.total) * 100)}%
            </span>
          </div>
          <Progress value={(saveProgress.current / saveProgress.total) * 100} />
        </div>
      )}

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {hasChanges && (
        <Alert role="status">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            {t("settings.unsavedChanges")}
            <span className="text-muted-foreground ml-2">
              ({t("settings.shortcutHint")})
            </span>
          </AlertDescription>
        </Alert>
      )}

      {!initialLoadComplete ? (
        <SettingsSkeleton loadingLabel={t("settings.loading")} />
      ) : (
        <div className="flex gap-6">
          {/* Sidebar Navigation - Hidden on mobile */}
          <aside className="hidden lg:block w-56 shrink-0">
            <SettingsNav
              activeSection={activeSection}
              onSectionClick={scrollToSection}
              matchingSections={search.matchingSections}
              isSearching={search.isSearching}
              collapsedSections={collapsedSections}
              sectionHasChanges={sectionHasChanges}
              t={t}
            />
          </aside>

          {/* Main Content */}
          <div className="flex-1 space-y-6 min-w-0">
            {/* Search Bar */}
            <SettingsSearch
              search={search}
              onNavigateToSetting={handleNavigateToSetting}
              inputRef={searchInputRef}
              t={t}
            />

            {/* Settings Sections */}
            <CollapsibleSection
              id="general"
              title={t("settings.general")}
              description={t("settings.generalDesc")}
              icon="Settings2"
              open={!collapsedSections.has("general")}
              hasChanges={sectionHasChanges("general")}
              onResetSection={handleResetSection}
              onOpenChange={handleSectionOpenChange}
              t={t}
            >
              <GeneralSettings
                localConfig={localConfig}
                errors={validationErrors}
                onValueChange={handleChange}
                t={t}
              />
            </CollapsibleSection>

            <CollapsibleSection
              id="network"
              title={t("settings.network")}
              description={t("settings.networkDesc")}
              icon="Network"
              open={!collapsedSections.has("network")}
              hasChanges={sectionHasChanges("network")}
              onResetSection={handleResetSection}
              onOpenChange={handleSectionOpenChange}
              t={t}
            >
              <NetworkSettings
                localConfig={localConfig}
                errors={validationErrors}
                onValueChange={handleChange}
                t={t}
              />
            </CollapsibleSection>

            <CollapsibleSection
              id="security"
              title={t("settings.security")}
              description={t("settings.securityDesc")}
              icon="Shield"
              open={!collapsedSections.has("security")}
              hasChanges={sectionHasChanges("security")}
              onResetSection={handleResetSection}
              onOpenChange={handleSectionOpenChange}
              t={t}
            >
              <SecuritySettings
                localConfig={localConfig}
                onValueChange={handleChange}
                t={t}
              />
            </CollapsibleSection>

            <CollapsibleSection
              id="mirrors"
              title={t("settings.mirrors")}
              description={t("settings.mirrorsDesc")}
              icon="Server"
              open={!collapsedSections.has("mirrors")}
              hasChanges={sectionHasChanges("mirrors")}
              onResetSection={handleResetSection}
              onOpenChange={handleSectionOpenChange}
              t={t}
              data-hint="settings-mirrors"
            >
              <MirrorsSettings
                localConfig={localConfig}
                errors={validationErrors}
                onValueChange={handleChange}
                t={t}
              />
            </CollapsibleSection>

            <CollapsibleSection
              id="appearance"
              title={t("settings.appearance")}
              description={t("settings.appearanceDesc")}
              icon="Palette"
              open={!collapsedSections.has("appearance")}
              hasChanges={sectionHasChanges("appearance")}
              onResetSection={handleResetSection}
              onOpenChange={handleSectionOpenChange}
              t={t}
            >
              <AppearanceSettings
                theme={theme}
                setTheme={handleThemeChange}
                locale={locale}
                setLocale={handleLocaleChange}
                accentColor={accentColor}
                setAccentColor={handleAccentColorChange}
                chartColorTheme={chartColorTheme}
                setChartColorTheme={handleChartColorThemeChange}
                interfaceRadius={interfaceRadius}
                setInterfaceRadius={handleInterfaceRadiusChange}
                interfaceDensity={interfaceDensity}
                setInterfaceDensity={handleInterfaceDensityChange}
                reducedMotion={reducedMotion}
                setReducedMotion={handleReducedMotionChange}
                windowEffect={windowEffect}
                setWindowEffect={handleWindowEffectChange}
                t={t}
              />
            </CollapsibleSection>

            <CollapsibleSection
              id="updates"
              title={t("settings.updates")}
              description={t("settings.updatesDesc")}
              icon="RefreshCw"
              open={!collapsedSections.has("updates")}
              hasChanges={sectionHasChanges("updates")}
              onOpenChange={handleSectionOpenChange}
              t={t}
            >
              <UpdateSettings
                appSettings={appSettings}
                onValueChange={handleAppSettingsChange}
                t={t}
              />
            </CollapsibleSection>

            <CollapsibleSection
              id="tray"
              title={t("settings.tray")}
              description={t("settings.trayDesc")}
              icon="Monitor"
              open={!collapsedSections.has("tray")}
              hasChanges={sectionHasChanges("tray")}
              onOpenChange={handleSectionOpenChange}
              t={t}
            >
              <TraySettings
                appSettings={appSettings}
                onValueChange={handleAppSettingsChange}
                t={t}
              />
            </CollapsibleSection>

            <SidebarOrderCustomizer
              t={t}
              primaryOrder={sidebarOrder.primary}
              secondaryOrder={sidebarOrder.secondary}
              onMovePrimary={handleMovePrimarySidebarItem}
              onMoveSecondary={handleMoveSecondarySidebarItem}
              onReset={handleResetSidebarOrder}
            />

            <CollapsibleSection
              id="shortcuts"
              title={t("settings.shortcuts")}
              description={t("settings.shortcutsDesc")}
              icon="Keyboard"
              open={!collapsedSections.has("shortcuts")}
              hasChanges={sectionHasChanges("shortcuts")}
              onResetSection={handleResetSection}
              onOpenChange={handleSectionOpenChange}
              t={t}
            >
              <ShortcutSettings
                localConfig={localConfig}
                errors={validationErrors}
                onValueChange={handleChange}
                t={t}
              />
            </CollapsibleSection>

            <CollapsibleSection
              id="paths"
              title={t("settings.paths")}
              description={t("settings.pathsDesc")}
              icon="FolderOpen"
              open={!collapsedSections.has("paths")}
              hasChanges={sectionHasChanges("paths")}
              onResetSection={handleResetSection}
              onOpenChange={handleSectionOpenChange}
              t={t}
            >
              <PathsSettings
                localConfig={localConfig}
                errors={validationErrors}
                onValueChange={handleChange}
                t={t}
              />
            </CollapsibleSection>

            <CollapsibleSection
              id="provider"
              title={t("settings.providerSettings")}
              description={t("settings.providerSettingsDesc")}
              icon="Package"
              open={!collapsedSections.has("provider")}
              hasChanges={sectionHasChanges("provider")}
              onResetSection={handleResetSection}
              onOpenChange={handleSectionOpenChange}
              t={t}
            >
              <ProviderSettings
                localConfig={localConfig}
                errors={validationErrors}
                onValueChange={handleChange}
                t={t}
              />
            </CollapsibleSection>

            <CollapsibleSection
              id="backup"
              title={t("backup.title")}
              description={t("backup.description")}
              icon="Archive"
              open={!collapsedSections.has("backup")}
              hasChanges={sectionHasChanges("backup")}
              onResetSection={handleResetSection}
              onOpenChange={handleSectionOpenChange}
              t={t}
            >
              <BackupPolicySettings
                localConfig={localConfig}
                errors={validationErrors}
                onValueChange={handleChange}
                t={t}
              />
              <Separator />
              <BackupSettings t={t} />
            </CollapsibleSection>

            <CollapsibleSection
              id="startup"
              title={t("settings.startup")}
              description={t("settings.startupDesc")}
              icon="Zap"
              open={!collapsedSections.has("startup")}
              hasChanges={sectionHasChanges("startup")}
              onResetSection={handleResetSection}
              onOpenChange={handleSectionOpenChange}
              t={t}
            >
              <StartupSettings
                localConfig={localConfig}
                errors={validationErrors}
                onValueChange={handleChange}
                t={t}
              />
            </CollapsibleSection>

            <CollapsibleSection
              id="system"
              title={t("settings.systemInfo")}
              description={t("settings.systemInfoDesc")}
              icon="Info"
              open={!collapsedSections.has("system")}
              hasChanges={false}
              onOpenChange={handleSectionOpenChange}
              t={t}
            >
              <SystemInfo
                loading={loading}
                platformInfo={platformInfo}
                cogniaDir={cogniaDir}
                t={t}
              />
            </CollapsibleSection>

            {/* Onboarding Controls */}
            <OnboardingSettingsCard t={t} />
          </div>
        </div>
      )}
    </main>
  );
}

function OnboardingSettingsCard({ t }: { t: (key: string) => string }) {
  const {
    mode,
    completed,
    skipped,
    tourCompleted,
    dismissedHints,
    hintsEnabled,
    resetOnboarding,
    startTour,
    resetHints,
    setHintsEnabled,
    dismissAllHints,
  } = useOnboardingStore();
  const hasBeenThrough = completed || skipped;
  const modeLabel = mode
    ? t(
        mode === "quick"
          ? "settings.onboardingModeQuick"
          : "settings.onboardingModeDetailed",
      )
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {t("settings.onboardingTitle")}
        </CardTitle>
        <CardDescription>{t("settings.onboardingDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={() => {
              resetOnboarding();
              toast.success(t("settings.onboardingResetSuccess"));
            }}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {t("settings.onboardingRerun")}
          </Button>
          {!tourCompleted && hasBeenThrough && (
            <Button
              variant="outline"
              onClick={() => {
                startTour();
                toast.info(t("settings.onboardingTourStarted"));
              }}
            >
              {t("settings.onboardingStartTour")}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("settings.onboardingRerunModeHint")}
        </p>
        {hasBeenThrough && (
          <p className="text-xs text-muted-foreground">
            {completed
              ? t("settings.onboardingStatusCompleted")
              : t("settings.onboardingStatusSkipped")}
            {modeLabel ? ` · ${modeLabel}` : ""}
            {tourCompleted ? ` · ${t("settings.onboardingTourDone")}` : ""}
          </p>
        )}

        <Separator />

        {/* Bubble Hints Controls */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{t("settings.hintsTitle")}</p>
              <p className="text-xs text-muted-foreground">
                {t("settings.hintsDesc")}
              </p>
            </div>
            <Switch checked={hintsEnabled} onCheckedChange={setHintsEnabled} />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetHints();
                toast.success(t("settings.hintsResetSuccess"));
              }}
              disabled={dismissedHints.length === 0}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              {t("settings.hintsReset")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                dismissAllHints(BUBBLE_HINTS.map((h) => h.id));
                toast.success(t("settings.hintsDismissAllSuccess"));
              }}
              disabled={dismissedHints.length >= BUBBLE_HINTS.length}
            >
              {t("settings.hintsDismissAll")}
            </Button>
          </div>
          {dismissedHints.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("settings.hintsDismissedCount").replace(
                "{count}",
                String(dismissedHints.length),
              )}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
