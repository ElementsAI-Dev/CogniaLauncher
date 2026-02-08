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
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Search,
  Package,
  Trash2,
  Download,
  Loader2,
  FolderOpen,
  Clock,
  RefreshCw,
  MoreHorizontal,
  Pin,
  PinOff,
  Undo2,
  Info,
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
  pinnedPackages?: string[];
  onSearchPackages: (query: string) => Promise<PackageSummary[]>;
  onInstallPackage: (name: string, version?: string) => Promise<void>;
  onUninstallPackage: (name: string) => Promise<void>;
  onRefreshPackages: () => Promise<InstalledPackage[]>;
  onPinPackage?: (name: string) => Promise<void>;
  onUnpinPackage?: (name: string) => Promise<void>;
  onRollbackPackage?: (name: string) => Promise<void>;
  onBatchUninstall?: (names: string[]) => Promise<void>;
  onViewPackageDetails?: (name: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function ProviderPackagesTab({
  providerId,
  installedPackages,
  searchResults,
  searchQuery,
  loadingPackages,
  loadingSearch,
  pinnedPackages = [],
  onSearchPackages,
  onInstallPackage,
  onUninstallPackage,
  onRefreshPackages,
  onPinPackage,
  onUnpinPackage,
  onRollbackPackage,
  onBatchUninstall,
  onViewPackageDetails,
  t,
}: ProviderPackagesTabProps) {
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [installingPackages, setInstallingPackages] = useState<Set<string>>(new Set());
  const [uninstallingPackages, setUninstallingPackages] = useState<Set<string>>(new Set());
  const [installedFilter, setInstalledFilter] = useState("");
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());
  const [confirmUninstall, setConfirmUninstall] = useState<string | null>(null);
  const [confirmBatchUninstall, setConfirmBatchUninstall] = useState(false);
  const [batchUninstalling, setBatchUninstalling] = useState(false);
  const pinnedSet = new Set(pinnedPackages);

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

  const handleConfirmedUninstall = useCallback(async () => {
    if (confirmUninstall) {
      await handleUninstall(confirmUninstall);
      setConfirmUninstall(null);
    }
  }, [confirmUninstall, handleUninstall]);

  const handleBatchUninstall = useCallback(async () => {
    if (!onBatchUninstall || selectedPackages.size === 0) return;
    setBatchUninstalling(true);
    try {
      await onBatchUninstall(Array.from(selectedPackages));
      toast.success(t("providerDetail.batchUninstallSuccess", { count: selectedPackages.size }));
      setSelectedPackages(new Set());
    } catch {
      toast.error(t("providerDetail.batchUninstallError"));
    } finally {
      setBatchUninstalling(false);
      setConfirmBatchUninstall(false);
    }
  }, [onBatchUninstall, selectedPackages, t]);

  const filteredInstalled = installedFilter
    ? installedPackages.filter((pkg) =>
        pkg.name.toLowerCase().includes(installedFilter.toLowerCase()),
      )
    : installedPackages;

  const installedNames = new Set(installedPackages.map((p) => p.name));

  const togglePackageSelection = useCallback((name: string) => {
    setSelectedPackages((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedPackages.size === filteredInstalled.length) {
      setSelectedPackages(new Set());
    } else {
      setSelectedPackages(new Set(filteredInstalled.map((p) => p.name)));
    }
  }, [selectedPackages.size, filteredInstalled]);

  const handlePin = useCallback(
    async (name: string) => {
      if (!onPinPackage) return;
      try {
        await onPinPackage(name);
        toast.success(t("providerDetail.packagePinned", { name }));
      } catch {
        toast.error(t("providerDetail.packagePinError", { name }));
      }
    },
    [onPinPackage, t],
  );

  const handleUnpin = useCallback(
    async (name: string) => {
      if (!onUnpinPackage) return;
      try {
        await onUnpinPackage(name);
        toast.success(t("providerDetail.packageUnpinned", { name }));
      } catch {
        toast.error(t("providerDetail.packageUnpinError", { name }));
      }
    },
    [onUnpinPackage, t],
  );

  const handleRollback = useCallback(
    async (name: string) => {
      if (!onRollbackPackage) return;
      try {
        await onRollbackPackage(name);
        toast.success(t("providerDetail.rollbackSuccess", { name, version: "" }));
      } catch {
        toast.error(t("providerDetail.rollbackError", { name }));
      }
    },
    [onRollbackPackage, t],
  );

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
            <div className="flex items-center gap-2">
              {onBatchUninstall && selectedPackages.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmBatchUninstall(true)}
                  disabled={batchUninstalling}
                >
                  {batchUninstalling ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  {t("providerDetail.batchUninstall")} ({selectedPackages.size})
                </Button>
              )}
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
          </div>
        </CardHeader>
        <CardContent>
          {installedPackages.length > 5 && (
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("providerDetail.filterInstalled")}
                value={installedFilter}
                onChange={(e) => setInstalledFilter(e.target.value)}
                className="pl-9"
              />
            </div>
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
                    {onBatchUninstall && (
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={selectedPackages.size === filteredInstalled.length && filteredInstalled.length > 0}
                          onCheckedChange={toggleSelectAll}
                          aria-label={t("providerDetail.selectAll")}
                        />
                      </TableHead>
                    )}
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
                    <TableHead className="w-[100px]">{t("providerDetail.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInstalled.map((pkg) => (
                    <TableRow key={`${pkg.name}-${pkg.version}`}>
                      {onBatchUninstall && (
                        <TableCell>
                          <Checkbox
                            checked={selectedPackages.has(pkg.name)}
                            onCheckedChange={() => togglePackageSelection(pkg.name)}
                            aria-label={pkg.name}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {pkg.name}
                          {pkg.is_global && (
                            <Badge variant="outline" className="text-xs">
                              {t("providerDetail.global")}
                            </Badge>
                          )}
                          {pinnedSet.has(pkg.name) && (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <Pin className="h-3 w-3" />
                              {t("providerDetail.pinned")}
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
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmUninstall(pkg.name)}
                                disabled={uninstallingPackages.has(pkg.name)}
                                className={cn(
                                  "text-destructive hover:text-destructive h-8 w-8 p-0",
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {onViewPackageDetails && (
                                <DropdownMenuItem onClick={() => onViewPackageDetails(pkg.name)}>
                                  <Info className="h-4 w-4 mr-2" />
                                  {t("providerDetail.packageDetails")}
                                </DropdownMenuItem>
                              )}
                              {onPinPackage && onUnpinPackage && (
                                <>
                                  {pinnedSet.has(pkg.name) ? (
                                    <DropdownMenuItem onClick={() => handleUnpin(pkg.name)}>
                                      <PinOff className="h-4 w-4 mr-2" />
                                      {t("providerDetail.unpinPackage")}
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onClick={() => handlePin(pkg.name)}>
                                      <Pin className="h-4 w-4 mr-2" />
                                      {t("providerDetail.pinPackage")}
                                    </DropdownMenuItem>
                                  )}
                                </>
                              )}
                              {onRollbackPackage && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleRollback(pkg.name)}>
                                    <Undo2 className="h-4 w-4 mr-2" />
                                    {t("providerDetail.rollbackPackage")}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Single Uninstall Confirmation Dialog */}
      <AlertDialog open={!!confirmUninstall} onOpenChange={(open) => !open && setConfirmUninstall(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("providerDetail.confirmUninstall")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("providerDetail.confirmUninstallDesc", { name: confirmUninstall ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("providerDetail.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedUninstall}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("providerDetail.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Uninstall Confirmation Dialog */}
      <AlertDialog open={confirmBatchUninstall} onOpenChange={setConfirmBatchUninstall}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("providerDetail.batchUninstallConfirm", { count: selectedPackages.size })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("providerDetail.batchUninstallConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("providerDetail.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchUninstall}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={batchUninstalling}
            >
              {batchUninstalling ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {t("providerDetail.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
