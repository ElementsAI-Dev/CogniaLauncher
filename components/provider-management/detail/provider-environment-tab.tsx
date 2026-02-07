"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Layers,
  Download,
  Trash2,
  Star,
  Loader2,
  RefreshCw,
  FolderOpen,
  Clock,
  HardDrive,
  Search,
} from "lucide-react";
import type {
  EnvironmentInfo,
  EnvironmentProviderInfo,
  VersionInfo,
} from "@/types/tauri";
import * as tauri from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProviderEnvironmentTabProps {
  providerId: string;
  environmentInfo: EnvironmentInfo | null;
  environmentProviderInfo: EnvironmentProviderInfo | null;
  availableVersions: VersionInfo[];
  loadingEnvironment: boolean;
  onRefreshEnvironment: () => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}

export function ProviderEnvironmentTab({
  providerId,
  environmentInfo,
  environmentProviderInfo,
  availableVersions,
  loadingEnvironment,
  onRefreshEnvironment,
  t,
}: ProviderEnvironmentTabProps) {
  const [installingVersion, setInstallingVersion] = useState<string | null>(null);
  const [uninstallingVersion, setUninstallingVersion] = useState<string | null>(null);
  const [settingGlobal, setSettingGlobal] = useState<string | null>(null);
  const [versionFilter, setVersionFilter] = useState("");

  const envType = environmentProviderInfo?.env_type || providerId;

  const handleInstallVersion = useCallback(
    async (version: string) => {
      setInstallingVersion(version);
      try {
        await tauri.envInstall(envType, version, providerId);
        toast.success(
          t("providerDetail.versionInstalled", { version }),
        );
        await onRefreshEnvironment();
      } catch {
        toast.error(
          t("providerDetail.versionInstallError", { version }),
        );
      } finally {
        setInstallingVersion(null);
      }
    },
    [envType, providerId, onRefreshEnvironment, t],
  );

  const handleUninstallVersion = useCallback(
    async (version: string) => {
      setUninstallingVersion(version);
      try {
        await tauri.envUninstall(envType, version);
        toast.success(
          t("providerDetail.versionUninstalled", { version }),
        );
        await onRefreshEnvironment();
      } catch {
        toast.error(
          t("providerDetail.versionUninstallError", { version }),
        );
      } finally {
        setUninstallingVersion(null);
      }
    },
    [envType, onRefreshEnvironment, t],
  );

  const handleSetGlobal = useCallback(
    async (version: string) => {
      setSettingGlobal(version);
      try {
        await tauri.envUseGlobal(envType, version);
        toast.success(
          t("providerDetail.versionSetGlobal", { version }),
        );
        await onRefreshEnvironment();
      } catch {
        toast.error(
          t("providerDetail.versionSetGlobalError", { version }),
        );
      } finally {
        setSettingGlobal(null);
      }
    },
    [envType, onRefreshEnvironment, t],
  );

  const installedVersionSet = new Set(
    environmentInfo?.installed_versions.map((v) => v.version) || [],
  );

  const filteredAvailable = versionFilter
    ? availableVersions.filter((v) =>
        v.version.toLowerCase().includes(versionFilter.toLowerCase()),
      )
    : availableVersions;

  return (
    <div className="space-y-6">
      {/* Current State Overview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4" />
                {t("providerDetail.environmentOverview")}
              </CardTitle>
              {environmentProviderInfo && (
                <CardDescription className="mt-1">
                  {environmentProviderInfo.description}
                </CardDescription>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRefreshEnvironment()}
              disabled={loadingEnvironment}
            >
              {loadingEnvironment ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {t("providers.refresh")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingEnvironment && !environmentInfo ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !environmentInfo ? (
            <p className="text-sm text-muted-foreground">
              {t("providerDetail.noEnvironmentData")}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("providerDetail.envType")}
                  </p>
                  <p className="text-sm font-medium capitalize">
                    {environmentInfo.env_type}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("providerDetail.envCurrentVersion")}
                  </p>
                  <p className="text-sm font-mono font-medium">
                    {environmentInfo.current_version || t("providerDetail.none")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("providerDetail.installedVersionsCount")}
                  </p>
                  <p className="text-sm font-medium">
                    {environmentInfo.installed_versions.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("providerDetail.providerName")}
                  </p>
                  <p className="text-sm font-medium">
                    {environmentInfo.provider}
                  </p>
                </div>
              </div>

              {/* Installed Versions */}
              {environmentInfo.installed_versions.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-3">
                      {t("providerDetail.installedVersions")}
                    </h4>
                    <ScrollArea className="max-h-[300px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("providerDetail.version")}</TableHead>
                            <TableHead className="hidden md:table-cell">
                              <div className="flex items-center gap-1">
                                <FolderOpen className="h-3 w-3" />
                                {t("providerDetail.installPath")}
                              </div>
                            </TableHead>
                            <TableHead className="hidden sm:table-cell">
                              <div className="flex items-center gap-1">
                                <HardDrive className="h-3 w-3" />
                                {t("providerDetail.size")}
                              </div>
                            </TableHead>
                            <TableHead className="hidden sm:table-cell">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {t("providerDetail.installedAt")}
                              </div>
                            </TableHead>
                            <TableHead className="w-[120px]">
                              {t("providerDetail.actions")}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {environmentInfo.installed_versions.map((ver) => (
                            <TableRow key={ver.version}>
                              <TableCell className="font-mono text-sm font-medium">
                                <div className="flex items-center gap-2">
                                  {ver.version}
                                  {ver.is_current && (
                                    <Badge
                                      variant="default"
                                      className="text-xs bg-green-600 hover:bg-green-700"
                                    >
                                      {t("providerDetail.current")}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-xs font-mono text-muted-foreground max-w-[200px] truncate" title={ver.install_path}>
                                {ver.install_path || "-"}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                                {formatBytes(ver.size)}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                                {ver.installed_at
                                  ? new Date(ver.installed_at).toLocaleDateString()
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  {!ver.is_current && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleSetGlobal(ver.version)}
                                          disabled={settingGlobal === ver.version}
                                          className="h-7 w-7 p-0"
                                        >
                                          {settingGlobal === ver.version ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          ) : (
                                            <Star className="h-3.5 w-3.5" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {t("providerDetail.setAsGlobal")}
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleUninstallVersion(ver.version)}
                                        disabled={uninstallingVersion === ver.version}
                                        className={cn(
                                          "h-7 w-7 p-0 text-destructive hover:text-destructive",
                                        )}
                                      >
                                        {uninstallingVersion === ver.version ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-3.5 w-3.5" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {t("providerDetail.uninstallVersion")}
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Versions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" />
            {t("providerDetail.availableVersions")}
            {availableVersions.length > 0 && (
              <Badge variant="secondary">{availableVersions.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            {t("providerDetail.availableVersionsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {availableVersions.length > 10 && (
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("providerDetail.filterVersions")}
                  value={versionFilter}
                  onChange={(e) => setVersionFilter(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          )}

          {loadingEnvironment && availableVersions.length === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filteredAvailable.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {versionFilter
                ? t("providerDetail.noMatchingVersions")
                : t("providerDetail.noAvailableVersions")}
            </p>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("providerDetail.version")}</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      {t("providerDetail.releaseDate")}
                    </TableHead>
                    <TableHead>{t("providerDetail.status")}</TableHead>
                    <TableHead className="w-[80px]">
                      {t("providerDetail.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAvailable.map((ver) => {
                    const isInstalled = installedVersionSet.has(ver.version);
                    return (
                      <TableRow key={ver.version}>
                        <TableCell className="font-mono text-sm font-medium">
                          {ver.version}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                          {ver.release_date
                            ? new Date(ver.release_date).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {isInstalled && (
                              <Badge variant="secondary" className="text-xs">
                                {t("providerDetail.installed")}
                              </Badge>
                            )}
                            {ver.deprecated && (
                              <Badge variant="destructive" className="text-xs">
                                {t("providerDetail.deprecated")}
                              </Badge>
                            )}
                            {ver.yanked && (
                              <Badge variant="destructive" className="text-xs">
                                {t("providerDetail.yanked")}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {!isInstalled && !ver.deprecated && !ver.yanked && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleInstallVersion(ver.version)}
                                  disabled={installingVersion === ver.version}
                                >
                                  {installingVersion === ver.version ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Download className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t("providerDetail.installVersion")}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
