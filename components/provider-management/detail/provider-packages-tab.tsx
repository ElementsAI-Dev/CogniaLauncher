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
  Search,
  Package,
  Trash2,
  Download,
  Loader2,
  FolderOpen,
  Clock,
  RefreshCw,
} from "lucide-react";
import type { InstalledPackage, PackageSummary } from "@/types/tauri";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProviderPackagesTabProps {
  providerId: string;
  installedPackages: InstalledPackage[];
  searchResults: PackageSummary[];
  searchQuery: string;
  loadingPackages: boolean;
  loadingSearch: boolean;
  onSearchPackages: (query: string) => Promise<PackageSummary[]>;
  onInstallPackage: (name: string) => Promise<void>;
  onUninstallPackage: (name: string) => Promise<void>;
  onRefreshPackages: () => Promise<InstalledPackage[]>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function ProviderPackagesTab({
  providerId,
  installedPackages,
  searchResults,
  searchQuery,
  loadingPackages,
  loadingSearch,
  onSearchPackages,
  onInstallPackage,
  onUninstallPackage,
  onRefreshPackages,
  t,
}: ProviderPackagesTabProps) {
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [installingPackages, setInstallingPackages] = useState<Set<string>>(new Set());
  const [uninstallingPackages, setUninstallingPackages] = useState<Set<string>>(new Set());
  const [installedFilter, setInstalledFilter] = useState("");

  const handleSearch = useCallback(async () => {
    if (localSearchQuery.trim()) {
      await onSearchPackages(localSearchQuery.trim());
    }
  }, [localSearchQuery, onSearchPackages]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSearch();
      }
    },
    [handleSearch],
  );

  const handleInstall = useCallback(
    async (name: string) => {
      setInstallingPackages((prev) => new Set(prev).add(name));
      try {
        await onInstallPackage(name);
        toast.success(t("providerDetail.packageInstalled", { name }));
      } catch {
        toast.error(t("providerDetail.packageInstallError", { name }));
      } finally {
        setInstallingPackages((prev) => {
          const next = new Set(prev);
          next.delete(name);
          return next;
        });
      }
    },
    [onInstallPackage, t],
  );

  const handleUninstall = useCallback(
    async (name: string) => {
      setUninstallingPackages((prev) => new Set(prev).add(name));
      try {
        await onUninstallPackage(name);
        toast.success(t("providerDetail.packageUninstalled", { name }));
      } catch {
        toast.error(t("providerDetail.packageUninstallError", { name }));
      } finally {
        setUninstallingPackages((prev) => {
          const next = new Set(prev);
          next.delete(name);
          return next;
        });
      }
    },
    [onUninstallPackage, t],
  );

  const filteredInstalled = installedFilter
    ? installedPackages.filter((pkg) =>
        pkg.name.toLowerCase().includes(installedFilter.toLowerCase()),
      )
    : installedPackages;

  const installedNames = new Set(installedPackages.map((p) => p.name));

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" />
            {t("providerDetail.searchPackages")}
          </CardTitle>
          <CardDescription>
            {t("providerDetail.searchPackagesDesc", { provider: providerId })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder={t("providerDetail.searchPlaceholder")}
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loadingSearch || !localSearchQuery.trim()}>
              {loadingSearch ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              {t("providerDetail.search")}
            </Button>
          </div>

          {loadingSearch && (
            <div className="mt-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {!loadingSearch && searchResults.length > 0 && (
            <ScrollArea className="mt-4 max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("providerDetail.packageName")}</TableHead>
                    <TableHead>{t("providerDetail.latestVersion")}</TableHead>
                    <TableHead className="hidden md:table-cell">
                      {t("providerDetail.packageDescription")}
                    </TableHead>
                    <TableHead className="w-[100px]">{t("providerDetail.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.map((pkg) => (
                    <TableRow key={pkg.name}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          {pkg.name}
                          {installedNames.has(pkg.name) && (
                            <Badge variant="secondary" className="text-xs">
                              {t("providerDetail.installed")}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {pkg.latest_version || "-"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[300px] truncate">
                        {pkg.description || "-"}
                      </TableCell>
                      <TableCell>
                        {!installedNames.has(pkg.name) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleInstall(pkg.name)}
                                disabled={installingPackages.has(pkg.name)}
                              >
                                {installingPackages.has(pkg.name) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {t("providerDetail.installPackage")}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {!loadingSearch && searchQuery && searchResults.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("providerDetail.noSearchResults")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Installed Packages Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                {t("providerDetail.installedPackages")}
                <Badge variant="secondary" className="ml-1">
                  {installedPackages.length}
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                {t("providerDetail.installedPackagesDesc")}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRefreshPackages()}
              disabled={loadingPackages}
            >
              {loadingPackages ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {t("providers.refresh")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {installedPackages.length > 5 && (
            <Input
              placeholder={t("providerDetail.filterInstalled")}
              value={installedFilter}
              onChange={(e) => setInstalledFilter(e.target.value)}
              className="mb-4"
            />
          )}

          {loadingPackages && installedPackages.length === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredInstalled.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>{t("providerDetail.noInstalledPackages")}</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("providerDetail.packageName")}</TableHead>
                    <TableHead>{t("providerDetail.version")}</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      <div className="flex items-center gap-1">
                        <FolderOpen className="h-3 w-3" />
                        {t("providerDetail.installPath")}
                      </div>
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {t("providerDetail.installedAt")}
                      </div>
                    </TableHead>
                    <TableHead className="w-[80px]">{t("providerDetail.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInstalled.map((pkg) => (
                    <TableRow key={`${pkg.name}-${pkg.version}`}>
                      <TableCell className="font-mono text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {pkg.name}
                          {pkg.is_global && (
                            <Badge variant="outline" className="text-xs">
                              {t("providerDetail.global")}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {pkg.version}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[200px] truncate font-mono" title={pkg.install_path}>
                        {pkg.install_path || "-"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {pkg.installed_at
                          ? new Date(pkg.installed_at).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUninstall(pkg.name)}
                              disabled={uninstallingPackages.has(pkg.name)}
                              className={cn(
                                "text-destructive hover:text-destructive",
                              )}
                            >
                              {uninstallingPackages.has(pkg.name) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {t("providerDetail.uninstallPackage")}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
