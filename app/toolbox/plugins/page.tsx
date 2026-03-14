"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DestinationPicker } from "@/components/downloads/destination-picker";
import { usePlugins } from "@/hooks/use-plugins";
import {
  getPluginMarketplaceHref,
  getPluginSourceLabelKey,
} from "@/lib/plugin-source";
import rawMarketplaceCatalog from "@/plugins/marketplace.json";
import { useLocale } from "@/components/providers/locale-provider";
import { isTauri } from "@/lib/tauri";
import {
  evaluatePluginHealthStatus,
  mapGrantedPermissionsToCapabilities,
  type PluginHealthStatus,
} from "@/lib/plugin-governance";
import { normalizeMarketplaceCatalog } from "@/lib/toolbox-marketplace";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Trash2,
  RefreshCw,
  ArrowLeft,
  Plug,
  Shield,
  Package,
  Hammer,
  Info,
  ArrowUpCircle,
  Heart,
  Settings2,
  Download,
  AlertTriangle,
  FolderOpen,
  Code2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Store,
} from "lucide-react";
import Link from "next/link";
import type {
  PluginInfo,
  PluginPermissionState,
  PluginToolInfo,
  PluginToolPreview,
  PluginLanguage,
  ScaffoldLifecycleProfile,
  ScaffoldContractTemplate,
  ScaffoldConfig,
  ScaffoldSchemaPreset,
  PluginUpdateInfo,
  PluginHealth,
  PluginSettingDeclaration,
  ScaffoldResult,
  ValidationResult,
} from "@/types/plugin";
import type { ToolboxMarketplaceListing } from "@/types/toolbox-marketplace";

const MARKETPLACE_CATALOG = normalizeMarketplaceCatalog(rawMarketplaceCatalog);

export default function PluginsPage() {
  const { t, locale } = useLocale();
  const searchParams = useSearchParams();
  const isDesktop = isTauri();
  const {
    plugins,
    pluginTools,
    loading,
    error,
    fetchPlugins,
    installPlugin,
    importLocalPlugin,
    uninstallPlugin,
    enablePlugin,
    disablePlugin,
    reloadPlugin,
    getPermissions,
    grantPermission,
    revokePermission,
    scaffoldPlugin,
    validatePlugin,
    openScaffoldFolder,
    openScaffoldInVscode,
    checkUpdate,
    updatePlugin,
    getHealth,
    getAllHealth,
    resetHealth,
    getSettingsSchema,
    getSettingsValues,
    setSetting,
    exportData,
    checkAllUpdates,
    updateAll,
    pendingUpdates,
    healthMap,
    permissionMode,
    permissionStates,
  } = usePlugins();

  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [installSource, setInstallSource] = useState("");
  const [installTab, setInstallTab] = useState<"url" | "local">("url");
  const [installing, setInstalling] = useState(false);
  const [permDialogPlugin, setPermDialogPlugin] = useState<string | null>(null);
  const [permState, setPermState] = useState<PluginPermissionState | null>(
    null,
  );
  const [detailPlugin, setDetailPlugin] = useState<PluginInfo | null>(null);
  const [uninstallTarget, setUninstallTarget] = useState<PluginInfo | null>(
    null,
  );
  const [scaffoldOpen, setScaffoldOpen] = useState(false);
  const [scaffolding, setScaffolding] = useState(false);
  const [importPath, setImportPath] = useState("");
  const [importingLocal, setImportingLocal] = useState(false);
  const [validatingImport, setValidatingImport] = useState(false);
  const [importValidation, setImportValidation] =
    useState<ValidationResult | null>(null);
  const [updateInfo, setUpdateInfo] = useState<
    Record<string, PluginUpdateInfo | null>
  >({});
  const [updatingPlugin, setUpdatingPlugin] = useState<string | null>(null);
  const [updateConfirmPlugin, setUpdateConfirmPlugin] = useState<string | null>(
    null,
  );
  const [healthDialogPlugin, setHealthDialogPlugin] = useState<string | null>(
    null,
  );
  const [healthData, setHealthData] = useState<PluginHealth | null>(null);
  const [settingsDialogPlugin, setSettingsDialogPlugin] = useState<
    string | null
  >(null);
  const [settingsSchema, setSettingsSchema] = useState<
    PluginSettingDeclaration[]
  >([]);
  const [settingsValues, setSettingsValues] = useState<Record<string, unknown>>(
    {},
  );
  const [scaffoldFormError, setScaffoldFormError] = useState<string | null>(
    null,
  );
  const [showScaffoldAdvanced, setShowScaffoldAdvanced] = useState(false);
  const [lastScaffoldResult, setLastScaffoldResult] =
    useState<ScaffoldResult | null>(null);
  const [openingScaffoldFolder, setOpeningScaffoldFolder] = useState(false);
  const [openingScaffoldVscode, setOpeningScaffoldVscode] = useState(false);
  const marketplaceListingsByStoreId = useMemo(
    () =>
      new Map(
        MARKETPLACE_CATALOG.listings.map(
          (listing) => [listing.source.storeId, listing] as const,
        ),
      ),
    [],
  );
  const hasFetchedPluginsRef = useRef(false);
  const handledActionIntentRef = useRef<string | null>(null);
  const [scaffoldForm, setScaffoldForm] = useState({
    name: "",
    id: "",
    description: "",
    author: "",
    outputDir: "",
    license: "",
    repository: "",
    homepage: "",
    additionalKeywords: "",
    lifecycleProfile: "external" as ScaffoldLifecycleProfile,
    includeCi: false,
    includeVscode: true,
    includeUnifiedContractSamples: true,
    contractTemplate: "minimal" as ScaffoldContractTemplate,
    schemaPreset: "basic-form" as ScaffoldSchemaPreset,
    includeValidationGuidance: true,
    includeStarterTests: false,
    language: "typescript" as PluginLanguage,
    permConfigRead: true,
    permEnvRead: true,
    permPkgSearch: false,
    permClipboard: false,
    permNotification: false,
    permProcessExec: false,
    permFsRead: false,
    permFsWrite: false,
  });

  useEffect(() => {
    if (!isDesktop || hasFetchedPluginsRef.current) return;
    hasFetchedPluginsRef.current = true;
    void (async () => {
      await fetchPlugins();
      await getAllHealth();
    })();
  }, [isDesktop, fetchPlugins, getAllHealth]);

  useEffect(() => {
    const action = searchParams.get("action");
    if (!action || handledActionIntentRef.current === action) return;
    handledActionIntentRef.current = action;

    if (action === "install") {
      setInstallTab("url");
      setInstallDialogOpen(true);
      return;
    }

    if (action === "scaffold") {
      setScaffoldFormError(null);
      setLastScaffoldResult(null);
      setScaffoldOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    setImportValidation(null);
  }, [importPath]);

  const declaredCapabilitiesByPlugin = useMemo(() => {
    const next = new Map<string, string[]>();
    for (const tool of pluginTools) {
      if (
        !tool.capabilityDeclarations ||
        tool.capabilityDeclarations.length === 0
      ) {
        continue;
      }
      const existing = new Set(next.get(tool.pluginId) ?? []);
      for (const capability of tool.capabilityDeclarations) {
        existing.add(capability);
      }
      next.set(tool.pluginId, [...existing].sort());
    }
    return next;
  }, [pluginTools]);

  const handleInstall = useCallback(async () => {
    if (!installSource.trim()) return;
    setInstalling(true);
    try {
      await installPlugin(installSource.trim());
      setInstallDialogOpen(false);
      setInstallSource("");
    } finally {
      setInstalling(false);
    }
  }, [installSource, installPlugin]);

  const handleImportLocal = useCallback(async () => {
    if (!importPath.trim()) return;
    setValidatingImport(true);
    const validation = await validatePlugin(importPath.trim());
    setImportValidation(validation);
    setValidatingImport(false);
    if (
      !validation ||
      !validation.valid ||
      validation.buildRequired ||
      validation.canImport === false
    )
      return;

    setImportingLocal(true);
    try {
      await importLocalPlugin(importPath.trim());
      setInstallDialogOpen(false);
      setImportPath("");
    } finally {
      setImportingLocal(false);
    }
  }, [importPath, importLocalPlugin, validatePlugin]);

  const handleValidateImport = useCallback(async () => {
    if (!importPath.trim()) {
      setImportValidation(null);
      return;
    }
    setValidatingImport(true);
    try {
      const validation = await validatePlugin(importPath.trim());
      setImportValidation(validation);
    } finally {
      setValidatingImport(false);
    }
  }, [importPath, validatePlugin]);

  const handleCheckUpdate = useCallback(
    async (plugin: PluginInfo) => {
      const info = await checkUpdate(plugin.id);
      setUpdateInfo((prev) => ({ ...prev, [plugin.id]: info }));
      if (!info) {
        const { toast } = await import("sonner");
        toast.info(t("toolbox.plugin.noUpdate"));
      }
    },
    [checkUpdate, t],
  );

  const handleConfirmUpdate = useCallback((pluginId: string) => {
    setUpdateConfirmPlugin(pluginId);
  }, []);

  const handleUpdate = useCallback(
    async (pluginId: string) => {
      setUpdateConfirmPlugin(null);
      setUpdatingPlugin(pluginId);
      try {
        await updatePlugin(pluginId);
        setUpdateInfo((prev) => ({ ...prev, [pluginId]: null }));
      } finally {
        setUpdatingPlugin(null);
      }
    },
    [updatePlugin],
  );

  const getScaffoldValidationError = useCallback(() => {
    if (!scaffoldForm.name.trim())
      return t("toolbox.plugin.scaffoldValidationNameRequired");
    if (!scaffoldForm.id.trim())
      return t("toolbox.plugin.scaffoldValidationIdRequired");
    if (!scaffoldForm.outputDir.trim())
      return t("toolbox.plugin.scaffoldValidationOutputRequired");
    if (!scaffoldForm.description.trim())
      return t("toolbox.plugin.scaffoldValidationDescriptionRequired");
    if (!scaffoldForm.author.trim())
      return t("toolbox.plugin.scaffoldValidationAuthorRequired");
    if (
      scaffoldForm.lifecycleProfile === "builtin" &&
      scaffoldForm.language === "javascript"
    ) {
      return t("toolbox.plugin.scaffoldValidationBuiltinLanguage");
    }
    if (scaffoldForm.lifecycleProfile === "builtin") {
      const normalizedOutputDir = scaffoldForm.outputDir
        .trim()
        .replace(/\\/g, "/")
        .toLowerCase();
      if (
        normalizedOutputDir.endsWith("/rust")
        || normalizedOutputDir.endsWith("/typescript")
      ) {
        return t("toolbox.plugin.scaffoldValidationBuiltinOutputRoot");
      }
    }
    if (!/^[A-Za-z0-9._-]+$/.test(scaffoldForm.id.trim())) {
      return t("toolbox.plugin.scaffoldValidationIdInvalid");
    }
    const repository = scaffoldForm.repository.trim();
    if (repository && !/^https?:\/\//.test(repository)) {
      return t("toolbox.plugin.scaffoldValidationRepoUrl");
    }
    const homepage = scaffoldForm.homepage.trim();
    if (homepage && !/^https?:\/\//.test(homepage)) {
      return t("toolbox.plugin.scaffoldValidationHomepageUrl");
    }
    return null;
  }, [scaffoldForm, t]);

  const handleScaffold = useCallback(async () => {
    const validationError = getScaffoldValidationError();
    if (validationError) {
      setScaffoldFormError(validationError);
      return;
    }
    setScaffoldFormError(null);
    setLastScaffoldResult(null);
    setScaffolding(true);
    try {
      const additionalKeywords = scaffoldForm.additionalKeywords
        .split(",")
        .map((kw) => kw.trim())
        .filter(Boolean);
      const config: ScaffoldConfig = {
        name: scaffoldForm.name.trim(),
        id: scaffoldForm.id.trim(),
        description: scaffoldForm.description.trim(),
        author: scaffoldForm.author.trim(),
        outputDir: scaffoldForm.outputDir.trim(),
        license: scaffoldForm.license.trim() || undefined,
        repository: scaffoldForm.repository.trim() || undefined,
        homepage: scaffoldForm.homepage.trim() || undefined,
        lifecycleProfile: scaffoldForm.lifecycleProfile,
        includeCi: scaffoldForm.includeCi,
        includeVscode: scaffoldForm.includeVscode,
        additionalKeywords:
          additionalKeywords.length > 0 ? additionalKeywords : undefined,
        templateOptions: {
          includeUnifiedContractSamples:
            scaffoldForm.includeUnifiedContractSamples,
          contractTemplate: scaffoldForm.contractTemplate,
          schemaPreset: scaffoldForm.schemaPreset,
          includeValidationGuidance: scaffoldForm.includeValidationGuidance,
          includeStarterTests: scaffoldForm.includeStarterTests,
        },
        language: scaffoldForm.language,
        permissions: {
          uiFeedback: false,
          uiDialog: false,
          uiFilePicker: false,
          uiNavigation: false,
          configRead: scaffoldForm.permConfigRead,
          envRead: scaffoldForm.permEnvRead,
          pkgSearch: scaffoldForm.permPkgSearch,
          clipboard: scaffoldForm.permClipboard,
          notification: scaffoldForm.permNotification,
          processExec: scaffoldForm.permProcessExec,
          fsRead: scaffoldForm.permFsRead,
          fsWrite: scaffoldForm.permFsWrite,
          http: [],
        },
      };
      const result = await scaffoldPlugin(config);
      if (result) {
        setLastScaffoldResult(result);
      }
    } finally {
      setScaffolding(false);
    }
  }, [getScaffoldValidationError, scaffoldForm, scaffoldPlugin]);

  const handleContinueScaffoldToImport = useCallback(() => {
    const importPathFromScaffold =
      lastScaffoldResult?.handoff?.importPath ?? lastScaffoldResult?.pluginDir;
    if (!importPathFromScaffold) return;
    setInstallTab("local");
    setInstallDialogOpen(true);
    setImportValidation(null);
    setImportPath(importPathFromScaffold);
  }, [lastScaffoldResult]);

  const handleOpenScaffoldFolder = useCallback(async () => {
    if (!isDesktop || !lastScaffoldResult?.pluginDir) return;
    setOpeningScaffoldFolder(true);
    try {
      await openScaffoldFolder(lastScaffoldResult.pluginDir);
    } finally {
      setOpeningScaffoldFolder(false);
    }
  }, [isDesktop, lastScaffoldResult, openScaffoldFolder]);

  const handleOpenScaffoldInVscode = useCallback(async () => {
    if (!isDesktop || !lastScaffoldResult?.pluginDir) return;
    setOpeningScaffoldVscode(true);
    try {
      await openScaffoldInVscode(lastScaffoldResult.pluginDir);
    } finally {
      setOpeningScaffoldVscode(false);
    }
  }, [isDesktop, lastScaffoldResult, openScaffoldInVscode]);

  const handleOpenPermissions = useCallback(
    async (pluginId: string) => {
      setPermDialogPlugin(pluginId);
      const perms = await getPermissions(pluginId);
      setPermState(perms);
    },
    [getPermissions],
  );

  const handleTogglePermission = useCallback(
    async (permission: string, granted: boolean) => {
      if (!permDialogPlugin) return;
      if (granted) {
        await revokePermission(permDialogPlugin, permission);
      } else {
        await grantPermission(permDialogPlugin, permission);
      }
      const perms = await getPermissions(permDialogPlugin);
      setPermState(perms);
    },
    [permDialogPlugin, grantPermission, revokePermission, getPermissions],
  );

  const handleOpenHealth = useCallback(
    async (pluginId: string) => {
      setHealthDialogPlugin(pluginId);
      const data = await getHealth(pluginId);
      setHealthData(data);
    },
    [getHealth],
  );

  const handleResetHealth = useCallback(async () => {
    if (!healthDialogPlugin) return;
    await resetHealth(healthDialogPlugin);
    const data = await getHealth(healthDialogPlugin);
    setHealthData(data);
  }, [healthDialogPlugin, resetHealth, getHealth]);

  const handleOpenSettings = useCallback(
    async (pluginId: string) => {
      setSettingsDialogPlugin(pluginId);
      const [schema, values] = await Promise.all([
        getSettingsSchema(pluginId),
        getSettingsValues(pluginId),
      ]);
      setSettingsSchema(schema ?? []);
      setSettingsValues(values ?? {});
    },
    [getSettingsSchema, getSettingsValues],
  );

  const handleSetSetting = useCallback(
    async (key: string, value: unknown) => {
      if (!settingsDialogPlugin) return;
      await setSetting(settingsDialogPlugin, key, value);
      setSettingsValues((prev) => ({ ...prev, [key]: value }));
      const { toast: toastFn } = await import("sonner");
      toastFn.success(t("toolbox.plugin.pluginSettingsSaved"));
    },
    [settingsDialogPlugin, setSetting, t],
  );

  const handleExport = useCallback(
    async (pluginId: string) => {
      await exportData(pluginId);
    },
    [exportData],
  );

  const handleCheckAllUpdates = useCallback(async () => {
    const updates = await checkAllUpdates();
    if (updates.length === 0) {
      const { toast: toastFn } = await import("sonner");
      toastFn.info(t("toolbox.plugin.noUpdatesAvailable"));
    }
  }, [checkAllUpdates, t]);

  const handleUpdateAll = useCallback(async () => {
    await updateAll();
    setUpdateInfo({});
  }, [updateAll]);

  const getHealthStatus = useCallback(
    (plugin: PluginInfo): PluginHealthStatus =>
      evaluatePluginHealthStatus(healthMap[plugin.id], plugin.enabled),
    [healthMap],
  );

  const currentPermissionDialogDeclaredCaps = useMemo(() => {
    if (!permDialogPlugin) return [];
    return declaredCapabilitiesByPlugin.get(permDialogPlugin) ?? [];
  }, [declaredCapabilitiesByPlugin, permDialogPlugin]);

  const currentPermissionDialogGrantedCaps = useMemo(() => {
    if (!permState) return [];
    return mapGrantedPermissionsToCapabilities([...permState.granted]);
  }, [permState]);

  const detailDialogDeclaredCaps = useMemo(() => {
    if (!detailPlugin) return [];
    return declaredCapabilitiesByPlugin.get(detailPlugin.id) ?? [];
  }, [declaredCapabilitiesByPlugin, detailPlugin]);

  const detailDialogGrantedCaps = useMemo(() => {
    if (!detailPlugin) return [];
    const state = permissionStates[detailPlugin.id];
    if (!state) return [];
    return mapGrantedPermissionsToCapabilities([...state.granted]);
  }, [detailPlugin, permissionStates]);

  const detailDialogMissingCaps = useMemo(
    () =>
      detailDialogGrantedCaps.filter(
        (cap) => !detailDialogDeclaredCaps.includes(cap),
      ),
    [detailDialogDeclaredCaps, detailDialogGrantedCaps],
  );

  const detailPluginTools = useMemo(() => {
    if (!detailPlugin) return [];
    return pluginTools
      .filter((tool) => tool.pluginId === detailPlugin.id)
      .slice()
      .sort(comparePluginToolsForPreview);
  }, [detailPlugin, pluginTools]);

  const detailToolPreviewLoading = useMemo(() => {
    if (!detailPlugin) return false;
    if (detailPluginTools.length > 0) return false;
    return Boolean(
      detailPlugin.toolPreviewLoading ||
      (loading && detailPlugin.toolCount > 0),
    );
  }, [detailPlugin, detailPluginTools.length, loading]);

  if (!isDesktop) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <PageHeader title={t("toolbox.plugin.title")} />
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Plug className="h-12 w-12 mb-4 opacity-40" />
          <p>{t("toolbox.plugin.noPlugins")}</p>
          <p className="text-sm mt-1">{t("toolbox.plugin.noPluginsDesc")}</p>
        </div>
      </div>
    );
  }

  const PERM_LABELS: Record<string, string> = {
    config_read: t("toolbox.plugin.permConfigRead"),
    config_write: t("toolbox.plugin.permConfigWrite"),
    env_read: t("toolbox.plugin.permEnvRead"),
    pkg_search: t("toolbox.plugin.permPkgSearch"),
    pkg_install: t("toolbox.plugin.permPkgInstall"),
    clipboard: t("toolbox.plugin.permClipboard"),
    notification: t("toolbox.plugin.permNotification"),
    fs_read: t("toolbox.plugin.permFsRead"),
    fs_write: t("toolbox.plugin.permFsWrite"),
    http: t("toolbox.plugin.permHttp"),
    process_exec: t("toolbox.plugin.permProcessExec"),
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title={t("toolbox.plugin.title")}
        description={t("toolbox.plugin.description")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <Link href="/toolbox">
                <ArrowLeft className="h-3.5 w-3.5" />
                {t("toolbox.actions.backToToolbox")}
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                void (async () => {
                  await fetchPlugins();
                  await getAllHealth();
                })();
              }}
              disabled={loading}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              {t("common.refresh")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setScaffoldFormError(null);
                setLastScaffoldResult(null);
                setScaffoldOpen(true);
              }}
            >
              <Hammer className="h-3.5 w-3.5" />
              {t("toolbox.plugin.createPlugin")}
            </Button>
            {plugins.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleCheckAllUpdates}
                disabled={loading}
              >
                <ArrowUpCircle className="h-3.5 w-3.5" />
                {t("toolbox.plugin.checkAllUpdates")}
              </Button>
            )}
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setInstallTab("url");
                setInstallDialogOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("toolbox.plugin.install")}
            </Button>
          </div>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t("common.error")}</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span className="min-w-0 break-all text-xs">{error}</span>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => {
                void (async () => {
                  await fetchPlugins();
                  await getAllHealth();
                })();
              }}
            >
              {t("common.retry")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {pendingUpdates.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/50 p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {t("toolbox.plugin.updatesAvailable", {
                count: pendingUpdates.length,
              })}
            </span>
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleUpdateAll}
            disabled={loading}
          >
            <ArrowUpCircle className="h-3.5 w-3.5" />
            {t("toolbox.plugin.updateAll")}
          </Button>
        </div>
      )}

      <Alert className="border-amber-300/60 bg-amber-50/60 text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
        <Shield className="h-4 w-4" />
        <AlertTitle>{t("toolbox.plugin.permissionPolicyModeTitle")}</AlertTitle>
        <AlertDescription className="text-xs">
          {permissionMode === "strict"
            ? t("toolbox.plugin.permissionPolicyModeStrict")
            : t("toolbox.plugin.permissionPolicyModeCompat")}
        </AlertDescription>
      </Alert>

      {plugins.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Package className="h-12 w-12 mb-4 opacity-40" />
          <h3 className="text-lg font-medium">
            {t("toolbox.plugin.noPlugins")}
          </h3>
          <p className="text-sm mt-1">{t("toolbox.plugin.noPluginsDesc")}</p>
          <Button
            variant="outline"
            className="mt-4 gap-1.5"
            onClick={() => setInstallDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            {t("toolbox.plugin.install")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {plugins.map((plugin) => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              t={t}
              onToggleEnabled={(enabled) =>
                enabled ? disablePlugin(plugin.id) : enablePlugin(plugin.id)
              }
              onUninstall={() => setUninstallTarget(plugin)}
              onReload={() => reloadPlugin(plugin.id)}
              onPermissions={() => handleOpenPermissions(plugin.id)}
              onDetails={() => setDetailPlugin(plugin)}
              onCheckUpdate={() => handleCheckUpdate(plugin)}
              onUpdate={() => handleConfirmUpdate(plugin.id)}
              onHealth={() => handleOpenHealth(plugin.id)}
              onSettings={() => handleOpenSettings(plugin.id)}
              onExport={() => handleExport(plugin.id)}
              pluginUpdateInfo={updateInfo[plugin.id] ?? null}
              isUpdating={updatingPlugin === plugin.id}
              healthStatus={getHealthStatus(plugin)}
              permissionMode={permissionMode}
              declaredCapabilities={
                declaredCapabilitiesByPlugin.get(plugin.id) ?? []
              }
              grantedCapabilities={mapGrantedPermissionsToCapabilities([
                ...(permissionStates[plugin.id]?.granted ?? []),
              ])}
              deprecationWarnings={plugin.deprecationWarnings ?? []}
              marketplaceListing={
                plugin.source.type === "store"
                  ? (marketplaceListingsByStoreId.get(plugin.source.storeId) ??
                    null)
                  : null
              }
            />
          ))}
        </div>
      )}

      {/* Uninstall Confirmation */}
      <AlertDialog
        open={uninstallTarget !== null}
        onOpenChange={(open) => {
          if (!open) setUninstallTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("toolbox.plugin.uninstallConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("toolbox.plugin.uninstallConfirmDesc", {
                name: uninstallTarget?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (uninstallTarget) {
                  uninstallPlugin(uninstallTarget.id);
                  setUninstallTarget(null);
                }
              }}
            >
              {t("toolbox.plugin.uninstall")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Install / Import Dialog */}
      <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t("toolbox.plugin.installDialog")}</DialogTitle>
            <DialogDescription>
              {t("toolbox.plugin.installDialogDesc")}
            </DialogDescription>
          </DialogHeader>
          <Tabs
            value={installTab}
            onValueChange={(value) => setInstallTab(value as "url" | "local")}
            className="mt-2"
          >
            <TabsList className="w-full">
              <TabsTrigger
                value="url"
                className="flex-1"
                onClick={() => setInstallTab("url")}
              >
                {t("toolbox.plugin.installTab")}
              </TabsTrigger>
              <TabsTrigger
                value="local"
                className="flex-1"
                onClick={() => setInstallTab("local")}
              >
                {t("toolbox.plugin.importTab")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="url" className="space-y-4 pt-2">
              <div className="grid gap-2">
                <Label htmlFor="plugin-source">
                  {t("toolbox.plugin.sourceLabel")}
                </Label>
                <Input
                  id="plugin-source"
                  value={installSource}
                  onChange={(e) => setInstallSource(e.target.value)}
                  placeholder={t("toolbox.plugin.sourcePlaceholder")}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setInstallDialogOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={handleInstall}
                  disabled={installing || !installSource.trim()}
                >
                  {installing
                    ? t("toolbox.plugin.running")
                    : t("toolbox.plugin.install")}
                </Button>
              </DialogFooter>
            </TabsContent>
            <TabsContent value="local" className="space-y-4 pt-2">
              <DestinationPicker
                value={importPath}
                onChange={setImportPath}
                placeholder={t("toolbox.plugin.importPlaceholder")}
                label={t("toolbox.plugin.importLabel")}
                isDesktop={isDesktop}
                browseTooltip={t("toolbox.plugin.importBrowse")}
              />
              <div className="flex items-center justify-end">
                <Button
                  variant="outline"
                  onClick={handleValidateImport}
                  disabled={validatingImport || !importPath.trim()}
                >
                  {validatingImport
                    ? t("toolbox.plugin.running")
                    : t("toolbox.plugin.validatePlugin")}
                </Button>
              </div>

              {importValidation && (
                <Alert
                  variant={importValidation.valid ? "default" : "destructive"}
                >
                  <AlertDescription className="space-y-2 text-xs">
                    <p>
                      {importValidation.valid
                        ? t("toolbox.plugin.validationValid")
                        : t("toolbox.plugin.validationInvalid")}
                    </p>
                    {importValidation.errors.length > 0 && (
                      <div>
                        <p className="font-medium">
                          {t("toolbox.plugin.validationErrors")}
                        </p>
                        <ul className="list-disc space-y-1 pl-5">
                          {importValidation.errors.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {importValidation.warnings.length > 0 && (
                      <div>
                        <p className="font-medium">
                          {t("toolbox.plugin.validationWarnings")}
                        </p>
                        <ul className="list-disc space-y-1 pl-5">
                          {importValidation.warnings.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {importValidation.buildRequired && (
                      <div className="space-y-1">
                        <p className="font-medium">
                          {t("toolbox.plugin.validationBuildRequired")}
                        </p>
                        {importValidation.missingArtifactPath && (
                          <p className="font-mono break-all">
                            {importValidation.missingArtifactPath}
                          </p>
                        )}
                        {lastScaffoldResult?.handoff?.buildCommands?.length ? (
                          <div>
                            {lastScaffoldResult.handoff.buildCommands.map(
                              (command) => (
                                <p key={command} className="font-mono">
                                  {command}
                                </p>
                              ),
                            )}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setInstallDialogOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={handleImportLocal}
                  disabled={
                    importingLocal || validatingImport || !importPath.trim()
                  }
                >
                  {importingLocal
                    ? t("toolbox.plugin.importing")
                    : t("toolbox.plugin.import")}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Scaffold Dialog */}
      <Dialog
        open={scaffoldOpen}
        onOpenChange={(open) => {
          setScaffoldOpen(open);
          if (!open) {
            setScaffoldFormError(null);
            setLastScaffoldResult(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hammer className="h-4 w-4" />
              {t("toolbox.plugin.createPlugin")}
            </DialogTitle>
            <DialogDescription>
              {t("toolbox.plugin.createPluginDesc")}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="grid gap-4 py-2 pr-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">
                    {t("toolbox.plugin.scaffoldName")}
                  </Label>
                  <Input
                    value={scaffoldForm.name}
                    onChange={(e) => {
                      setScaffoldFormError(null);
                      setScaffoldForm((p) => ({ ...p, name: e.target.value }));
                    }}
                    placeholder={t("toolbox.plugin.scaffoldNamePlaceholder")}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">
                    {t("toolbox.plugin.scaffoldId")}
                  </Label>
                  <Input
                    value={scaffoldForm.id}
                    onChange={(e) => {
                      setScaffoldFormError(null);
                      setScaffoldForm((p) => ({ ...p, id: e.target.value }));
                    }}
                    placeholder={t("toolbox.plugin.scaffoldIdPlaceholder")}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">
                  {t("toolbox.plugin.scaffoldDescription")}
                </Label>
                <Input
                  value={scaffoldForm.description}
                  onChange={(e) => {
                    setScaffoldFormError(null);
                    setScaffoldForm((p) => ({
                      ...p,
                      description: e.target.value,
                    }));
                  }}
                  placeholder={t("toolbox.plugin.scaffoldDescPlaceholder")}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">
                    {t("toolbox.plugin.scaffoldAuthor")}
                  </Label>
                  <Input
                    value={scaffoldForm.author}
                    onChange={(e) => {
                      setScaffoldFormError(null);
                      setScaffoldForm((p) => ({
                        ...p,
                        author: e.target.value,
                      }));
                    }}
                    placeholder={t("toolbox.plugin.scaffoldAuthorPlaceholder")}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">
                    {t("toolbox.plugin.scaffoldLifecycleProfile")}
                  </Label>
                  <Select
                    value={scaffoldForm.lifecycleProfile}
                    onValueChange={(v) =>
                      setScaffoldForm((p) => ({
                        ...p,
                        lifecycleProfile: v as ScaffoldLifecycleProfile,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="external">
                        {t("toolbox.plugin.scaffoldLifecycleExternal")}
                      </SelectItem>
                      <SelectItem value="builtin">
                        {t("toolbox.plugin.scaffoldLifecycleBuiltin")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">
                  {t("toolbox.plugin.scaffoldLanguage")}
                </Label>
                <Select
                  value={scaffoldForm.language}
                  onValueChange={(v) =>
                    setScaffoldForm((p) => ({
                      ...p,
                      language: v as PluginLanguage,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="typescript">
                      {t("toolbox.plugin.scaffoldLanguageTs")}
                    </SelectItem>
                    <SelectItem value="rust">
                      {t("toolbox.plugin.scaffoldLanguageRust")}
                    </SelectItem>
                    <SelectItem value="javascript">
                      {t("toolbox.plugin.scaffoldLanguageJs")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DestinationPicker
                value={scaffoldForm.outputDir}
                onChange={(v) => {
                  setScaffoldFormError(null);
                  setScaffoldForm((p) => ({ ...p, outputDir: v }));
                }}
                placeholder="C:\\Users\\you\\plugins"
                label={t("toolbox.plugin.scaffoldOutputDir")}
                isDesktop={isDesktop}
                browseTooltip={t("common.browse")}
              />
              <div className="rounded-md border p-3 space-y-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left text-xs font-medium"
                  onClick={() => setShowScaffoldAdvanced((prev) => !prev)}
                >
                  <span>{t("toolbox.plugin.scaffoldAdvanced")}</span>
                  {showScaffoldAdvanced ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
                {showScaffoldAdvanced && (
                  <div className="grid gap-3 pt-1">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">
                        {t("toolbox.plugin.scaffoldLicense")}
                      </Label>
                      <Input
                        value={scaffoldForm.license}
                        onChange={(e) => {
                          setScaffoldFormError(null);
                          setScaffoldForm((p) => ({
                            ...p,
                            license: e.target.value,
                          }));
                        }}
                        placeholder={t(
                          "toolbox.plugin.scaffoldLicensePlaceholder",
                        )}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">
                        {t("toolbox.plugin.scaffoldRepository")}
                      </Label>
                      <Input
                        value={scaffoldForm.repository}
                        onChange={(e) => {
                          setScaffoldFormError(null);
                          setScaffoldForm((p) => ({
                            ...p,
                            repository: e.target.value,
                          }));
                        }}
                        placeholder={t(
                          "toolbox.plugin.scaffoldRepositoryPlaceholder",
                        )}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">
                        {t("toolbox.plugin.scaffoldHomepage")}
                      </Label>
                      <Input
                        value={scaffoldForm.homepage}
                        onChange={(e) => {
                          setScaffoldFormError(null);
                          setScaffoldForm((p) => ({
                            ...p,
                            homepage: e.target.value,
                          }));
                        }}
                        placeholder={t(
                          "toolbox.plugin.scaffoldHomepagePlaceholder",
                        )}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">
                        {t("toolbox.plugin.scaffoldAdditionalKeywords")}
                      </Label>
                      <Input
                        value={scaffoldForm.additionalKeywords}
                        onChange={(e) => {
                          setScaffoldFormError(null);
                          setScaffoldForm((p) => ({
                            ...p,
                            additionalKeywords: e.target.value,
                          }));
                        }}
                        placeholder={t(
                          "toolbox.plugin.scaffoldAdditionalKeywordsPlaceholder",
                        )}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-2">
                      <Label className="text-xs cursor-pointer">
                        {t("toolbox.plugin.scaffoldIncludeVscode")}
                      </Label>
                      <Switch
                        checked={scaffoldForm.includeVscode}
                        onCheckedChange={(checked) =>
                          setScaffoldForm((p) => ({
                            ...p,
                            includeVscode: checked,
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-2">
                      <Label className="text-xs cursor-pointer">
                        {t("toolbox.plugin.scaffoldIncludeCi")}
                      </Label>
                      <Switch
                        checked={scaffoldForm.includeCi}
                        onCheckedChange={(checked) =>
                          setScaffoldForm((p) => ({ ...p, includeCi: checked }))
                        }
                      />
                    </div>
                    <Separator />
                    <p className="text-xs font-medium">
                      {t("toolbox.plugin.scaffoldTemplateOptions")}
                    </p>
                    <div className="flex items-center justify-between rounded-md border p-2">
                      <Label className="text-xs cursor-pointer">
                        {t(
                          "toolbox.plugin.scaffoldIncludeUnifiedContractSamples",
                        )}
                      </Label>
                      <Switch
                        checked={scaffoldForm.includeUnifiedContractSamples}
                        onCheckedChange={(checked) =>
                          setScaffoldForm((p) => ({
                            ...p,
                            includeUnifiedContractSamples: checked,
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">
                        {t("toolbox.plugin.scaffoldContractTemplate")}
                      </Label>
                      <Select
                        value={scaffoldForm.contractTemplate}
                        onValueChange={(v) =>
                          setScaffoldForm((p) => ({
                            ...p,
                            contractTemplate: v as ScaffoldContractTemplate,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minimal">
                            {t(
                              "toolbox.plugin.scaffoldContractTemplateMinimal",
                            )}
                          </SelectItem>
                          <SelectItem value="advanced">
                            {t(
                              "toolbox.plugin.scaffoldContractTemplateAdvanced",
                            )}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">
                        {t("toolbox.plugin.scaffoldSchemaPreset")}
                      </Label>
                      <Select
                        value={scaffoldForm.schemaPreset}
                        onValueChange={(v) =>
                          setScaffoldForm((p) => ({
                            ...p,
                            schemaPreset: v as ScaffoldSchemaPreset,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic-form">
                            {t("toolbox.plugin.scaffoldSchemaPresetBasicForm")}
                          </SelectItem>
                          <SelectItem value="multi-step-flow">
                            {t(
                              "toolbox.plugin.scaffoldSchemaPresetMultiStepFlow",
                            )}
                          </SelectItem>
                          <SelectItem value="repeatable-collection">
                            {t(
                              "toolbox.plugin.scaffoldSchemaPresetRepeatableCollection",
                            )}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-2">
                      <Label className="text-xs cursor-pointer">
                        {t("toolbox.plugin.scaffoldIncludeValidationGuidance")}
                      </Label>
                      <Switch
                        checked={scaffoldForm.includeValidationGuidance}
                        onCheckedChange={(checked) =>
                          setScaffoldForm((p) => ({
                            ...p,
                            includeValidationGuidance: checked,
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-2">
                      <Label className="text-xs cursor-pointer">
                        {t("toolbox.plugin.scaffoldIncludeStarterTests")}
                      </Label>
                      <Switch
                        checked={scaffoldForm.includeStarterTests}
                        onCheckedChange={(checked) =>
                          setScaffoldForm((p) => ({
                            ...p,
                            includeStarterTests: checked,
                          }))
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  {t("toolbox.plugin.scaffoldPermissions")}
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      key: "permConfigRead",
                      label: t("toolbox.plugin.permConfigRead"),
                    },
                    {
                      key: "permEnvRead",
                      label: t("toolbox.plugin.permEnvRead"),
                    },
                    {
                      key: "permPkgSearch",
                      label: t("toolbox.plugin.permPkgSearch"),
                    },
                    {
                      key: "permClipboard",
                      label: t("toolbox.plugin.permClipboard"),
                    },
                    {
                      key: "permNotification",
                      label: t("toolbox.plugin.permNotification"),
                    },
                    {
                      key: "permFsRead",
                      label: t("toolbox.plugin.permFsRead"),
                    },
                    {
                      key: "permFsWrite",
                      label: t("toolbox.plugin.permFsWrite"),
                    },
                    {
                      key: "permProcessExec",
                      label: t("toolbox.plugin.permProcessExec"),
                    },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      <Checkbox
                        id={`scaffold-${key}`}
                        checked={
                          scaffoldForm[
                            key as keyof typeof scaffoldForm
                          ] as boolean
                        }
                        onCheckedChange={(checked) =>
                          setScaffoldForm((p) => ({ ...p, [key]: !!checked }))
                        }
                      />
                      <Label
                        htmlFor={`scaffold-${key}`}
                        className="text-xs font-normal cursor-pointer"
                      >
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              {scaffoldFormError && (
                <p className="text-xs text-destructive">{scaffoldFormError}</p>
              )}
              {isDesktop && lastScaffoldResult && (
                <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-800 dark:bg-emerald-950/40">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {t("toolbox.plugin.scaffoldCreatedTitle")}
                      </p>
                      <p className="text-xs text-muted-foreground break-all">
                        {lastScaffoldResult.pluginDir}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="font-medium">
                      {t(
                        lastScaffoldResult.lifecycleProfile === "builtin"
                          ? "toolbox.plugin.scaffoldBuiltinNextStepsTitle"
                          : "toolbox.plugin.scaffoldNextStepsTitle",
                      )}
                    </p>
                    {lastScaffoldResult.handoff.buildCommands.map((command) => (
                      <p key={command} className="font-mono break-all">
                        {command}
                      </p>
                    ))}
                    {lastScaffoldResult.handoff.nextSteps.map((step) => (
                      <p key={step}>{step}</p>
                    ))}
                    {lastScaffoldResult.handoff.builtinCatalogPath && (
                      <p className="font-mono break-all">
                        {lastScaffoldResult.handoff.builtinCatalogPath}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {lastScaffoldResult.lifecycleProfile === "external" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={handleContinueScaffoldToImport}
                      >
                        {t("toolbox.plugin.scaffoldContinueToImport")}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleOpenScaffoldFolder}
                      disabled={openingScaffoldFolder}
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      {openingScaffoldFolder
                        ? t("toolbox.plugin.scaffoldOpening")
                        : t("toolbox.plugin.scaffoldOpenFolder")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleOpenScaffoldInVscode}
                      disabled={openingScaffoldVscode}
                    >
                      <Code2 className="h-3.5 w-3.5" />
                      {openingScaffoldVscode
                        ? t("toolbox.plugin.scaffoldOpening")
                        : t("toolbox.plugin.scaffoldOpenInVscode")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScaffoldOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleScaffold}
              disabled={scaffolding || !!getScaffoldValidationError()}
            >
              {scaffolding
                ? t("toolbox.plugin.scaffoldCreating")
                : t("toolbox.plugin.scaffoldCreate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog
        open={detailPlugin !== null}
        onOpenChange={(open) => {
          if (!open) setDetailPlugin(null);
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              {detailPlugin?.name}
            </DialogTitle>
            <DialogDescription>
              {detailPlugin?.descriptionFallbackNeeded
                ? t("toolbox.plugin.descriptionFallback")
                : detailPlugin?.description}
            </DialogDescription>
          </DialogHeader>
          {detailPlugin && (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">
                      {t("toolbox.plugin.pluginId")}:
                    </span>{" "}
                    <span className="font-mono">{detailPlugin.id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      {t("toolbox.plugin.version")}:
                    </span>{" "}
                    {detailPlugin.version}
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      {t("toolbox.plugin.source")}:
                    </span>{" "}
                    {t(getPluginSourceLabelKey(detailPlugin.source))}
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      {t("toolbox.plugin.healthStatusLabel")}:
                    </span>{" "}
                    {t(getHealthStatusLabelKey(getHealthStatus(detailPlugin)))}
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      {t("toolbox.plugin.permissionPolicyModeLabel")}:
                    </span>{" "}
                    {permissionMode === "strict"
                      ? t("toolbox.plugin.permissionPolicyModeStrictTag")
                      : t("toolbox.plugin.permissionPolicyModeCompatTag")}
                  </div>
                  {detailPlugin.builtinCandidate && (
                    <div>
                      <span className="text-muted-foreground">
                        {t("toolbox.plugin.builtinSyncStatus")}:
                      </span>{" "}
                      {t(
                        getBuiltinSyncStatusTranslationKey(
                          detailPlugin.builtinSyncStatus ?? "unknown",
                        ),
                      )}
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">
                      {t("toolbox.plugin.installedAt")}:
                    </span>{" "}
                    {new Date(detailPlugin.installedAt).toLocaleDateString()}
                  </div>
                  {detailPlugin.compatibility &&
                    !detailPlugin.compatibility.compatible && (
                      <div className="col-span-2 rounded-md border border-red-300/50 bg-red-50/60 px-2 py-1.5 text-[11px] text-red-800 dark:border-red-700/40 dark:bg-red-950/30 dark:text-red-300">
                        {detailPlugin.compatibility.reason ??
                          t("toolbox.plugin.compatibilityIncompatible")}
                      </div>
                    )}
                  {detailPlugin.authors.length > 0 && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">
                        {t("toolbox.plugin.author")}:
                      </span>{" "}
                      {detailPlugin.authors.join(", ")}
                    </div>
                  )}
                  {detailPlugin.builtinCandidate &&
                    detailPlugin.builtinSyncMessage && (
                      <div className="col-span-2 rounded-md border border-amber-300/50 bg-amber-100/50 px-2 py-1.5 text-[11px] text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
                        {detailPlugin.builtinSyncMessage}
                      </div>
                    )}
                </div>
                {(detailPlugin.deprecationWarnings?.length ?? 0) > 0 && (
                  <div className="rounded-md border border-amber-300/60 bg-amber-50/70 p-2 text-[11px] text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
                    <p className="font-medium">
                      {t("toolbox.plugin.deprecationWarningsTitle")}
                    </p>
                    <div className="mt-1 space-y-1">
                      {detailPlugin.deprecationWarnings?.map((warning) => (
                        <p key={`${warning.code}:${warning.message}`}>
                          {warning.message} {warning.guidance}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <p className="mb-1 font-medium">
                      {t("toolbox.plugin.declaredCapabilities")}
                    </p>
                    {detailDialogDeclaredCaps.length === 0 ? (
                      <p className="text-muted-foreground">
                        {t("toolbox.plugin.capabilitiesEmpty")}
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {detailDialogDeclaredCaps.map((cap) => (
                          <p key={`declared-${cap}`} className="font-mono">
                            {cap}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 font-medium">
                      {t("toolbox.plugin.grantedCapabilities")}
                    </p>
                    {detailDialogGrantedCaps.length === 0 ? (
                      <p className="text-muted-foreground">
                        {t("toolbox.plugin.capabilitiesEmpty")}
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {detailDialogGrantedCaps.map((cap) => (
                          <p key={`granted-${cap}`} className="font-mono">
                            {cap}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {permissionMode === "strict" &&
                  detailDialogMissingCaps.length > 0 && (
                    <div className="rounded-md border border-red-300/50 bg-red-50/60 px-2 py-1.5 text-[11px] text-red-800 dark:border-red-700/40 dark:bg-red-950/30 dark:text-red-300">
                      {t("toolbox.plugin.capabilityPolicyMismatch")}:{" "}
                      {detailDialogMissingCaps.join(", ")}
                    </div>
                  )}
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-2">
                    {t("toolbox.plugin.toolsList", {
                      count: detailToolPreviewLoading
                        ? (detailPlugin.toolPreviewCount ??
                          detailPlugin.toolCount)
                        : detailPluginTools.length,
                    })}
                  </h4>
                  {detailToolPreviewLoading ? (
                    <p className="text-xs text-muted-foreground">
                      {t("toolbox.plugin.toolPreviewLoading")}
                    </p>
                  ) : detailPluginTools.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t("toolbox.plugin.toolPreviewEmpty")}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {detailPluginTools.map((tool) => {
                        const toolDescription = (
                          locale === "zh" && tool.descriptionZh
                            ? tool.descriptionZh
                            : tool.descriptionEn
                        )?.trim();
                        return (
                          <div
                            key={tool.toolId}
                            className="flex items-start justify-between gap-3 text-xs p-1.5 rounded bg-muted/50"
                          >
                            <div className="min-w-0">
                              <p className="font-medium break-words">
                                {locale === "zh" && tool.nameZh
                                  ? tool.nameZh
                                  : tool.nameEn}
                              </p>
                              <p className="text-muted-foreground break-words">
                                {toolDescription ||
                                  t("toolbox.plugin.toolDescriptionFallback")}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono shrink-0"
                            >
                              {tool.entry}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog
        open={permDialogPlugin !== null}
        onOpenChange={(open) => {
          if (!open) setPermDialogPlugin(null);
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {t("toolbox.plugin.permissions")}
            </DialogTitle>
            <DialogDescription>{permDialogPlugin}</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-amber-300/60 bg-amber-50/60 p-2 text-xs text-amber-950 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
            <span className="font-medium">
              {t("toolbox.plugin.permissionPolicyModeLabel")}:
            </span>{" "}
            {permissionMode === "strict"
              ? t("toolbox.plugin.permissionPolicyModeStrictTag")
              : t("toolbox.plugin.permissionPolicyModeCompatTag")}
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-md border p-2 text-[11px]">
            <div>
              <p className="mb-1 font-medium">
                {t("toolbox.plugin.declaredCapabilities")}
              </p>
              {currentPermissionDialogDeclaredCaps.length === 0 ? (
                <p className="text-muted-foreground">
                  {t("toolbox.plugin.capabilitiesEmpty")}
                </p>
              ) : (
                <div className="space-y-1">
                  {currentPermissionDialogDeclaredCaps.map((cap) => (
                    <p key={`perm-declared-${cap}`} className="font-mono">
                      {cap}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="mb-1 font-medium">
                {t("toolbox.plugin.grantedCapabilities")}
              </p>
              {currentPermissionDialogGrantedCaps.length === 0 ? (
                <p className="text-muted-foreground">
                  {t("toolbox.plugin.capabilitiesEmpty")}
                </p>
              ) : (
                <div className="space-y-1">
                  {currentPermissionDialogGrantedCaps.map((cap) => (
                    <p key={`perm-granted-${cap}`} className="font-mono">
                      {cap}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
          {permissionMode === "strict" &&
            currentPermissionDialogGrantedCaps.some(
              (capability) =>
                !currentPermissionDialogDeclaredCaps.includes(capability),
            ) && (
              <div className="rounded-md border border-red-300/50 bg-red-50/60 px-2 py-1.5 text-[11px] text-red-800 dark:border-red-700/40 dark:bg-red-950/30 dark:text-red-300">
                {t("toolbox.plugin.capabilityPolicyMismatch")}
              </div>
            )}
          {permState && (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3 py-2">
                {Object.entries(PERM_LABELS).map(([key, label]) => {
                  const isGranted = permState.granted.includes(key);
                  const isDenied = permState.denied.includes(key);
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between px-1"
                    >
                      <div>
                        <span className="text-sm font-medium">{label}</span>
                        <Badge
                          variant="secondary"
                          className={`ml-2 text-[10px] ${isGranted && !isDenied ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}
                        >
                          {isGranted && !isDenied
                            ? t("toolbox.plugin.permissionGranted")
                            : t("toolbox.plugin.permissionDenied")}
                        </Badge>
                      </div>
                      <Switch
                        checked={isGranted && !isDenied}
                        onCheckedChange={() =>
                          handleTogglePermission(key, isGranted && !isDenied)
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Confirmation with Changelog */}
      <AlertDialog
        open={updateConfirmPlugin !== null}
        onOpenChange={(open) => {
          if (!open) setUpdateConfirmPlugin(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-[520px]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("toolbox.plugin.updateConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {updateConfirmPlugin && updateInfo[updateConfirmPlugin] && (
                <>
                  {t("toolbox.plugin.updateConfirmDesc", {
                    name:
                      plugins.find((p) => p.id === updateConfirmPlugin)?.name ??
                      updateConfirmPlugin,
                    current: updateInfo[updateConfirmPlugin]!.currentVersion,
                    latest: updateInfo[updateConfirmPlugin]!.latestVersion,
                  })}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {updateConfirmPlugin &&
            updateInfo[updateConfirmPlugin]?.changelog && (
              <ScrollArea className="max-h-[200px] rounded-md border p-3">
                <pre className="text-xs whitespace-pre-wrap">
                  {updateInfo[updateConfirmPlugin]!.changelog}
                </pre>
              </ScrollArea>
            )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (updateConfirmPlugin) handleUpdate(updateConfirmPlugin);
              }}
            >
              {t("toolbox.plugin.update")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Health Dialog */}
      <Dialog
        open={healthDialogPlugin !== null}
        onOpenChange={(open) => {
          if (!open) setHealthDialogPlugin(null);
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              {t("toolbox.plugin.healthTitle")}
            </DialogTitle>
            <DialogDescription>{healthDialogPlugin}</DialogDescription>
          </DialogHeader>
          {healthData && (
            <div className="space-y-3 py-2">
              {healthData.autoDisabled && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {t("toolbox.plugin.healthAutoDisabledDesc")}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border p-3 text-center">
                  <div className="text-2xl font-bold">
                    {healthData.totalCalls}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("toolbox.plugin.healthTotalCalls")}
                  </div>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <div className="text-2xl font-bold text-destructive">
                    {healthData.failedCalls}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("toolbox.plugin.healthFailedCalls")}
                  </div>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <div className="text-2xl font-bold">
                    {healthData.totalCalls > 0
                      ? `${((healthData.failedCalls / healthData.totalCalls) * 100).toFixed(1)}%`
                      : "0%"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("toolbox.plugin.healthFailureRate")}
                  </div>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <div className="text-2xl font-bold">
                    {healthData.consecutiveFailures}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("toolbox.plugin.healthConsecutiveFailures")}
                  </div>
                </div>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">
                  {t("toolbox.plugin.healthAvgDuration")}:
                </span>{" "}
                <span className="font-mono">
                  {healthData.totalCalls > 0
                    ? `${(healthData.totalDurationMs / healthData.totalCalls).toFixed(0)}ms`
                    : "-"}
                </span>
              </div>
              {healthData.lastError && (
                <div className="text-sm">
                  <span className="text-muted-foreground">
                    {t("toolbox.plugin.healthLastError")}:
                  </span>
                  <code className="block mt-1 rounded bg-muted p-2 text-xs break-all">
                    {healthData.lastError}
                  </code>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleResetHealth}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t("toolbox.plugin.healthReset")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog
        open={settingsDialogPlugin !== null}
        onOpenChange={(open) => {
          if (!open) setSettingsDialogPlugin(null);
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              {t("toolbox.plugin.pluginSettings")}
            </DialogTitle>
            <DialogDescription>
              {t("toolbox.plugin.pluginSettingsDesc")}
            </DialogDescription>
          </DialogHeader>
          {settingsSchema.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t("toolbox.plugin.pluginSettingsEmpty")}
            </p>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-4 py-2 pr-2">
                {settingsSchema.map((setting) => (
                  <div key={setting.id} className="space-y-1.5">
                    <Label className="text-sm">
                      {locale === "zh" && setting.labelZh
                        ? setting.labelZh
                        : setting.labelEn}
                    </Label>
                    {(locale === "zh" && setting.descriptionZh
                      ? setting.descriptionZh
                      : setting.descriptionEn) && (
                      <p className="text-xs text-muted-foreground">
                        {locale === "zh" && setting.descriptionZh
                          ? setting.descriptionZh
                          : setting.descriptionEn}
                      </p>
                    )}
                    {setting.type === "boolean" ? (
                      <Switch
                        checked={!!settingsValues[setting.id]}
                        onCheckedChange={(checked) =>
                          handleSetSetting(setting.id, checked)
                        }
                      />
                    ) : setting.type === "select" ? (
                      <Select
                        value={String(
                          settingsValues[setting.id] ?? setting.default ?? "",
                        )}
                        onValueChange={(v) => handleSetSetting(setting.id, v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {setting.options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {locale === "zh" && opt.labelZh
                                ? opt.labelZh
                                : opt.labelEn}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : setting.type === "number" ? (
                      <Input
                        type="number"
                        min={setting.min ?? undefined}
                        max={setting.max ?? undefined}
                        value={String(
                          settingsValues[setting.id] ?? setting.default ?? "",
                        )}
                        onChange={(e) =>
                          handleSetSetting(setting.id, Number(e.target.value))
                        }
                      />
                    ) : (
                      <Input
                        value={String(
                          settingsValues[setting.id] ?? setting.default ?? "",
                        )}
                        onChange={(e) =>
                          handleSetSetting(setting.id, e.target.value)
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getNormalizedToolName(
  tool: Pick<PluginToolInfo, "nameEn" | "toolId">,
): string {
  return normalizeOptionalText(tool.nameEn) ?? tool.toolId;
}

function comparePluginToolsForPreview(
  a: PluginToolInfo,
  b: PluginToolInfo,
): number {
  const aName = getNormalizedToolName(a).toLocaleLowerCase();
  const bName = getNormalizedToolName(b).toLocaleLowerCase();
  if (aName !== bName) return aName.localeCompare(bName);
  return a.toolId.localeCompare(b.toolId);
}

function getBuiltinSyncStatusTranslationKey(status: string): string {
  switch (status) {
    case "upToDate":
      return "toolbox.plugin.builtinSyncUpToDate";
    case "installed":
      return "toolbox.plugin.builtinSyncInstalled";
    case "upgraded":
      return "toolbox.plugin.builtinSyncUpgraded";
    case "conflict":
      return "toolbox.plugin.builtinSyncConflict";
    case "failed":
      return "toolbox.plugin.builtinSyncFailed";
    default:
      return "toolbox.plugin.builtinSyncUnknown";
  }
}

function getBuiltinSyncBadgeClass(status: string): string {
  switch (status) {
    case "upToDate":
      return "bg-green-500/10 text-green-600 dark:text-green-400";
    case "installed":
    case "upgraded":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
    case "conflict":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "failed":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getHealthStatusLabelKey(status: PluginHealthStatus): string {
  if (status === "critical") return "toolbox.plugin.healthCritical";
  if (status === "warning") return "toolbox.plugin.healthWarning";
  return "toolbox.plugin.healthGood";
}

function PluginCard({
  plugin,
  t,
  onToggleEnabled,
  onUninstall,
  onReload,
  onPermissions,
  onDetails,
  onCheckUpdate,
  onUpdate,
  onHealth,
  onSettings,
  onExport,
  pluginUpdateInfo,
  isUpdating,
  healthStatus,
  permissionMode,
  declaredCapabilities,
  grantedCapabilities,
  deprecationWarnings,
  marketplaceListing,
}: {
  plugin: PluginInfo;
  t: (key: string, params?: Record<string, string | number>) => string;
  onToggleEnabled: (enabled: boolean) => void;
  onUninstall: () => void;
  onReload: () => void;
  onPermissions: () => void;
  onDetails: () => void;
  onCheckUpdate: () => void;
  onUpdate: () => void;
  onHealth: () => void;
  onSettings: () => void;
  onExport: () => void;
  pluginUpdateInfo: PluginUpdateInfo | null;
  isUpdating: boolean;
  healthStatus: PluginHealthStatus;
  permissionMode: "compat" | "strict";
  declaredCapabilities: string[];
  grantedCapabilities: string[];
  deprecationWarnings: PluginInfo["deprecationWarnings"];
  marketplaceListing: ToolboxMarketplaceListing | null;
}) {
  const healthColor =
    healthStatus === "good"
      ? "bg-green-500"
      : healthStatus === "warning"
        ? "bg-yellow-500"
        : "bg-red-500";
  const healthLabelKey = getHealthStatusLabelKey(healthStatus);
  const sourceLabel = t(getPluginSourceLabelKey(plugin.source));
  const marketplaceHref = getPluginMarketplaceHref(plugin.source);
  const builtinSyncKey = plugin.builtinSyncStatus
    ? getBuiltinSyncStatusTranslationKey(plugin.builtinSyncStatus)
    : null;
  const builtinSyncBadgeClass = plugin.builtinSyncStatus
    ? getBuiltinSyncBadgeClass(plugin.builtinSyncStatus)
    : "";
  const missingCapabilities = grantedCapabilities.filter(
    (capability) => !declaredCapabilities.includes(capability),
  );
  const pluginDescription = plugin.descriptionFallbackNeeded
    ? t("toolbox.plugin.descriptionFallback")
    : plugin.description;
  const previewTools: PluginToolPreview[] = plugin.toolPreviews ?? [];
  const previewCount =
    typeof plugin.toolPreviewCount === "number"
      ? plugin.toolPreviewCount
      : previewTools.length;
  const previewOverflowCount = Math.max(0, previewCount - previewTools.length);
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Plug className="h-4 w-4" />
              <span
                className={`h-2 w-2 rounded-full shrink-0 ${healthColor}`}
              />
              {plugin.name}
              <Badge variant="outline" className="text-[10px]">
                v{plugin.version}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {t(healthLabelKey)}
              </Badge>
              <Badge
                variant="secondary"
                className="text-[10px] bg-slate-500/10 text-slate-600 dark:text-slate-300"
              >
                {sourceLabel}
              </Badge>
              <Badge variant="secondary" className="text-[10px] font-mono">
                {permissionMode === "strict"
                  ? t("toolbox.plugin.permissionPolicyModeStrictTag")
                  : t("toolbox.plugin.permissionPolicyModeCompatTag")}
              </Badge>
              {builtinSyncKey && (
                <Badge
                  variant="secondary"
                  className={`text-[10px] ${builtinSyncBadgeClass}`}
                >
                  {t(builtinSyncKey)}
                </Badge>
              )}
              {plugin.enabled ? (
                <Badge
                  variant="secondary"
                  className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400"
                >
                  {t("toolbox.plugin.enable")}
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="text-[10px] bg-muted text-muted-foreground"
                >
                  {t("toolbox.plugin.disable")}
                </Badge>
              )}
              {pluginUpdateInfo && (
                <Badge
                  variant="secondary"
                  className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400"
                >
                  {t("toolbox.plugin.updateAvailable", {
                    version: pluginUpdateInfo.latestVersion,
                  })}
                </Badge>
              )}
              {(deprecationWarnings?.length ?? 0) > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300"
                >
                  {t("toolbox.plugin.deprecationWarningsCount", {
                    count: deprecationWarnings!.length,
                  })}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{pluginDescription}</CardDescription>
          </div>
          <Switch
            checked={plugin.enabled}
            onCheckedChange={() => onToggleEnabled(plugin.enabled)}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
          {plugin.authors.length > 0 && (
            <span>
              {t("toolbox.plugin.author")}: {plugin.authors.join(", ")}
            </span>
          )}
          <span>
            {t("toolbox.plugin.toolCount", { count: plugin.toolCount })}
          </span>
          <span>{sourceLabel}</span>
        </div>
        <div className="mb-3 rounded-md border border-border/80 bg-muted/20 px-2 py-1.5">
          <p className="text-[11px] font-medium">
            {t("toolbox.plugin.toolPreviewTitle", { count: previewCount })}
          </p>
          {plugin.toolPreviewLoading ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("toolbox.plugin.toolPreviewLoading")}
            </p>
          ) : previewTools.length === 0 ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("toolbox.plugin.toolPreviewEmpty")}
            </p>
          ) : (
            <div className="mt-1 space-y-1">
              {previewTools.map((tool) => (
                <div
                  key={tool.toolId}
                  className="flex items-center justify-between gap-2 text-[11px]"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{tool.name}</p>
                    <p className="text-muted-foreground truncate">
                      {tool.descriptionFallbackNeeded
                        ? t("toolbox.plugin.toolDescriptionFallback")
                        : (tool.description ??
                          t("toolbox.plugin.toolDescriptionFallback"))}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono shrink-0"
                  >
                    {tool.entry}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          {(plugin.hasMoreToolPreviews || previewOverflowCount > 0) &&
            previewOverflowCount > 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t("toolbox.plugin.toolPreviewMore", {
                  count: previewOverflowCount,
                })}
              </p>
            )}
        </div>
        {plugin.builtinCandidate && plugin.builtinSyncMessage && (
          <div className="mb-3 rounded-md border border-amber-300/50 bg-amber-100/50 px-2 py-1.5 text-xs text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
            {plugin.builtinSyncMessage}
          </div>
        )}
        {(deprecationWarnings?.length ?? 0) > 0 && (
          <div className="mb-3 rounded-md border border-amber-300/60 bg-amber-50/70 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
            {deprecationWarnings?.slice(0, 2).map((warning) => (
              <p key={`${warning.code}:${warning.message}`}>
                {warning.message}
              </p>
            ))}
          </div>
        )}
        {permissionMode === "strict" && missingCapabilities.length > 0 && (
          <div className="mb-3 rounded-md border border-red-300/50 bg-red-50/60 px-2 py-1.5 text-xs text-red-800 dark:border-red-700/40 dark:bg-red-950/30 dark:text-red-300">
            {t("toolbox.plugin.capabilityPolicyMismatch")}:{" "}
            {missingCapabilities.join(", ")}
          </div>
        )}
        {marketplaceHref && marketplaceListing && (
          <div className="mb-3 rounded-md border border-blue-300/50 bg-blue-50/60 px-2 py-1.5 text-xs text-blue-900 dark:border-blue-700/40 dark:bg-blue-950/20 dark:text-blue-200">
            <p className="font-medium">
              {marketplaceListing.publisher?.name ??
                t("toolbox.marketplace.title")}
            </p>
            {marketplaceListing.releaseNotes && (
              <p className="mt-1 text-blue-800/90 dark:text-blue-200/90">
                {marketplaceListing.releaseNotes}
              </p>
            )}
          </div>
        )}
        <Separator className="mb-3" />
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={onDetails}
          >
            <Info className="h-3 w-3" />
            {t("toolbox.plugin.details")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={onPermissions}
          >
            <Shield className="h-3 w-3" />
            {t("toolbox.plugin.permissions")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={onHealth}
          >
            <Heart className="h-3 w-3" />
            {t("toolbox.plugin.health")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={onSettings}
          >
            <Settings2 className="h-3 w-3" />
            {t("toolbox.plugin.pluginSettings")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={onExport}
          >
            <Download className="h-3 w-3" />
            {t("toolbox.plugin.export")}
          </Button>
          {marketplaceHref && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              asChild
            >
              <Link href={marketplaceHref}>
                <Store className="h-3 w-3" />
                {t("toolbox.marketplace.title")}
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={onReload}
          >
            <RefreshCw className="h-3 w-3" />
            {t("toolbox.plugin.reload")}
          </Button>
          {pluginUpdateInfo ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-blue-600 hover:text-blue-700"
              onClick={onUpdate}
              disabled={isUpdating}
            >
              <ArrowUpCircle className="h-3 w-3" />
              {isUpdating
                ? t("toolbox.plugin.updating")
                : t("toolbox.plugin.update")}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={onCheckUpdate}
            >
              <ArrowUpCircle className="h-3 w-3" />
              {t("toolbox.plugin.checkUpdate")}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
            onClick={onUninstall}
          >
            <Trash2 className="h-3 w-3" />
            {t("toolbox.plugin.uninstall")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
