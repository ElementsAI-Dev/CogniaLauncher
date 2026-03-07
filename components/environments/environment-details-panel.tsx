"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useLocale } from "@/components/providers/locale-provider";
import type { EnvironmentInfo, DetectedEnvironment } from "@/lib/tauri";
import {
  useEnvironmentStore,
  type EnvironmentSettings,
  type EnvVariable,
} from "@/lib/stores/environment";
import { useEnvironments } from "@/hooks/use-environments";
import { useProjectPath } from "@/hooks/use-auto-version";
import { EnvironmentWorkflowBanner } from "@/components/environments/environment-workflow-banner";
import {
  Globe,
  Settings2,
  Cpu,
  HardDrive,
  Trash2,
  Download,
  RefreshCw,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatSize } from "@/lib/utils";
import { DetectedVersionBadge } from "@/components/environments/detected-version-badge";
import { VersionPinningSection } from "@/components/environments/version-pinning-section";
import {
  AutoSwitchToggle,
  DetectionFilesList,
  EnvVarsEditor,
} from "@/components/environments/shared";

interface EnvironmentDetailsPanelProps {
  env: EnvironmentInfo | null;
  detectedVersion: DetectedEnvironment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetGlobal: (version: string) => Promise<void>;
  onSetLocal: (version: string, projectPath: string) => Promise<void>;
  onUninstall?: (version: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
}

export function EnvironmentDetailsPanel({
  env,
  detectedVersion,
  open,
  onOpenChange,
  onSetGlobal,
  onSetLocal,
  onUninstall,
  onRefresh,
}: EnvironmentDetailsPanelProps) {
  const { t } = useLocale();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [uninstallingVersion, setUninstallingVersion] = useState<string | null>(
    null,
  );
  // Get persisted environment settings from store
  const { getEnvSettings, setWorkflowContext, setWorkflowAction } = useEnvironmentStore();
  const { loadEnvSettings, saveEnvSettings, detectVersions } = useEnvironments();
  const { projectPath } = useProjectPath();
  const envSettings = env ? getEnvSettings(env.env_type) : null;
  const envVariables = envSettings?.envVariables || [];
  const detectionFiles = envSettings?.detectionFiles || [];


  useEffect(() => {
    if (open && env) {
      setWorkflowContext({
        envType: env.env_type,
        origin: 'overview',
        returnHref: '/environments',
        projectPath: projectPath || null,
        providerId: env.provider_id || env.env_type,
        updatedAt: Date.now(),
      });
      void loadEnvSettings(env.env_type);
    }
  }, [env, loadEnvSettings, open, projectPath, setWorkflowContext]);

  if (!env) return null;

  const updateSettings = async (nextSettings: EnvironmentSettings) => {
    if (!env) return;
    try {
      await saveEnvSettings(env.env_type, nextSettings);
      await detectVersions(projectPath || ".");
    } catch (err) {
      toast.error(String(err));
    }
  };


  const handleAddEnvVariable = async (variable: EnvVariable) => {
    if (!envSettings || !env) return;
    await updateSettings({
      ...envSettings,
      envVariables: [
        ...envSettings.envVariables,
        variable,
      ],
    });
    toast.success(t("environments.details.envVarAdded"));
  };

  const handleRemoveEnvVariable = async (key: string) => {
    if (!envSettings || !env) return;
    await updateSettings({
      ...envSettings,
      envVariables: envSettings.envVariables.filter(
        (variable) => variable.key !== key,
      ),
    });
  };

  const handleToggleEnvVariable = async (key: string, enabled: boolean) => {
    if (!envSettings || !env) return;
    await updateSettings({
      ...envSettings,
      envVariables: envSettings.envVariables.map((variable) =>
        variable.key === key ? { ...variable, enabled } : variable,
      ),
    });
  };

  const handleToggleDetectionFile = async (
    fileName: string,
    enabled: boolean,
  ) => {
    if (!envSettings || !env) return;
    await updateSettings({
      ...envSettings,
      detectionFiles: envSettings.detectionFiles.map((file) =>
        file.fileName === fileName ? { ...file, enabled } : file,
      ),
    });
  };

  const handleToggleAutoSwitch = async (enabled: boolean) => {
    if (!envSettings || !env) return;
    await updateSettings({
      ...envSettings,
      autoSwitch: enabled,
    });
  };

  const totalSize = env.installed_versions.reduce(
    (acc, v) => acc + (v.size || 0),
    0,
  );

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    setWorkflowAction({
      envType: env.env_type,
      action: 'refresh',
      status: 'running',
      providerId: env.provider_id || env.env_type,
      projectPath: projectPath || null,
      updatedAt: Date.now(),
    });
    try {
      await onRefresh();
      await detectVersions(projectPath || ".", { force: true });
      setWorkflowAction({
        envType: env.env_type,
        action: 'refresh',
        status: 'success',
        providerId: env.provider_id || env.env_type,
        projectPath: projectPath || null,
        updatedAt: Date.now(),
      });
    } catch (error) {
      setWorkflowAction({
        envType: env.env_type,
        action: 'refresh',
        status: 'error',
        providerId: env.provider_id || env.env_type,
        projectPath: projectPath || null,
        error: error instanceof Error ? error.message : String(error),
        retryable: true,
        updatedAt: Date.now(),
      });
      throw error;
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleUninstall = async (version: string) => {
    if (!onUninstall) return;
    setUninstallingVersion(version);
    try {
      await onUninstall(version);
      toast.success(
        t("environments.details.versionUninstalled", {
                  version,
                })
      );
    } catch (err) {
      toast.error(String(err));
    } finally {
      setUninstallingVersion(null);
    }
  };


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:w-[540px] p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Settings2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-xl">{env.env_type}</SheetTitle>
                <SheetDescription>
                  {t("environments.details.subtitle", {
                    provider: env.provider,
                  })}
                </SheetDescription>
              </div>
            </div>
            {onRefresh && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-8 w-8"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
              </Button>
            )}
          </div>
          <EnvironmentWorkflowBanner
            envType={env.env_type}
            projectPath={projectPath}
            providerLabel={env.provider}
            onRefresh={onRefresh ? handleRefresh : undefined}
            t={t}
          />
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Status Section */}
            <section className="space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Cpu className="h-4 w-4" />
                {t("environments.details.status")}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {t("environments.details.currentVersion")}
                  </p>
                  <p className="font-mono font-medium">
                    {env.current_version || t("common.none")}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {t("environments.details.installedCount")}
                  </p>
                  <p className="font-medium">
                    {env.installed_versions.length}{" "}
                    {t("environments.details.versions")}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {t("environments.details.totalSize")}
                  </p>
                  <div className="flex items-center gap-1">
                    <HardDrive className="h-3 w-3" />
                    <p className="font-medium">{formatSize(totalSize)}</p>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {t("environments.details.provider")}
                  </p>
                  <p className="font-medium">{env.provider}</p>
                </div>
              </div>

              {detectedVersion && (
                <DetectedVersionBadge
                  version={detectedVersion.version}
                  source={detectedVersion.source}
                  sourceType={detectedVersion.source_type}
                  currentVersion={env.current_version}
                  t={t}
                />
              )}
            </section>

            <Separator />

            {/* Installed Versions Section */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  {t("environments.installedVersions")}
                </h3>
                <Badge variant="secondary">
                  {env.installed_versions.length}
                </Badge>
              </div>

              {env.installed_versions.length === 0 ? (
                <div className="p-4 rounded-lg bg-muted/30 text-center text-muted-foreground text-sm">
                  {t("environments.details.noVersionsInstalled")}
                </div>
              ) : (
                <div className="space-y-2">
                  {env.installed_versions.map((v) => (
                    <div
                      key={v.version}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        v.is_current
                          ? "bg-primary/5 border-primary/20"
                          : "bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">
                          {v.version}
                        </span>
                        {v.is_current && (
                          <Badge variant="default" className="text-xs">
                            {t("environments.currentVersion")}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatSize(v.size)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {!v.is_current && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSetGlobal(v.version)}
                            className="h-7 text-xs"
                          >
                            {t("environments.setGlobal")}
                          </Button>
                        )}
                        {onUninstall && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                disabled={uninstallingVersion === v.version}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {t("common.confirm")}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("environments.details.confirmUninstall", {
                                    type: env.env_type,
                                    version: v.version,
                                  })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>
                                  {t("common.cancel")}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleUninstall(v.version)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {t("common.uninstall")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <Separator />

            {/* Version Pinning Section */}
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  {t("environments.details.versionPinning")}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("environments.details.versionPinningDesc")}
                </p>
              </div>

              <VersionPinningSection
                installedVersions={env.installed_versions}
                currentVersion={env.current_version}
                onSetGlobal={onSetGlobal}
                onSetLocal={onSetLocal}
                t={t}
              />
            </section>

            <Separator />

            {/* Environment Variables Section */}
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">
                  {t("environments.details.envVariables")}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("environments.details.envVariablesDesc")}
                </p>
              </div>

              <EnvVarsEditor
                variables={envVariables}
                onAdd={handleAddEnvVariable}
                onRemove={handleRemoveEnvVariable}
                onToggle={handleToggleEnvVariable}
                t={t}
              />
            </section>

            <Separator />

            {/* Project Detection Section */}
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">
                  {t("environments.details.projectDetection")}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("environments.details.projectDetectionDesc")}
                </p>
              </div>

              <AutoSwitchToggle
                enabled={envSettings?.autoSwitch || false}
                onToggle={handleToggleAutoSwitch}
                t={t}
              />

              <DetectionFilesList
                files={detectionFiles}
                onToggle={handleToggleDetectionFile}
                t={t}
              />
            </section>
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            {t("common.close")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
