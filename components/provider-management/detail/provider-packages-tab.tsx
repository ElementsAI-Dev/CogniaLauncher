"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useLocale } from "@/components/providers/locale-provider";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import type {
  InstalledPackage,
  PackagePreflightSummary,
  PackageSummary,
  ProviderInfo,
} from "@/types/tauri";
import { BatchOperations } from "@/components/packages/batch-operations";
import {
  PackageOperationPanel,
} from "@/components/packages/shared/package-operation-panel";
import {
  PackageOperationProvider,
  type PackageOperationContextValue,
} from "@/components/packages/shared/package-operation-context";
import { parsePackageSpec } from "@/lib/packages";
import { usePackageStore } from "@/lib/stores/packages";

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
  onBatchUninstall?: (names: string[]) => Promise<unknown>;
  onViewPackageDetails?: (name: string) => void;
  preflightSummary?: PackagePreflightSummary | null;
  preflightPackages?: string[];
  isPreflightOpen?: boolean;
  onConfirmPreflight?: () => void;
  onDismissPreflight?: () => void;
}

function toProviderInfo(providerId: string): ProviderInfo {
  return {
    id: providerId,
    display_name: providerId,
    capabilities: ["Search", "Install"],
    platforms: ["Windows", "Linux", "macOS"],
    priority: 1,
    is_environment_provider: true,
    enabled: true,
  };
}

export function ProviderPackagesTab({
  providerId,
  installedPackages,
  searchResults,
  searchQuery: _searchQuery,
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
  preflightSummary,
  preflightPackages,
  isPreflightOpen,
  onConfirmPreflight,
  onDismissPreflight,
}: ProviderPackagesTabProps) {
  const { t } = useLocale();
  const [installingPackages, setInstallingPackages] = useState<Set<string>>(new Set());
  const [uninstallingPackages, setUninstallingPackages] = useState<Set<string>>(new Set());
  const selectedPackages = usePackageStore((state) => state.selectedPackages);
  const clearPackageSelection = usePackageStore((state) => state.clearPackageSelection);

  const providers = useMemo(() => [toProviderInfo(providerId)], [providerId]);
  const installing = useMemo(
    () => [...installingPackages, ...uninstallingPackages].map((name) => `${providerId}:${name}`),
    [installingPackages, providerId, uninstallingPackages],
  );

  const handleSearch = useCallback(
    async (query: string) => {
      if (query.trim()) {
        await onSearchPackages(query.trim());
      }
    },
    [onSearchPackages],
  );

  const handleInstall = useCallback(
    async (packageSpec: string) => {
      const { name } = parsePackageSpec(packageSpec);
      setInstallingPackages((prev) => new Set(prev).add(name));
      try {
        await onInstallPackage(name);
        toast.success(t("providerDetail.packageInstalled", { name }));
      } catch {
        toast.error(t("providerDetail.packageInstallError", { name }));
        throw new Error("install failed");
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
    async (packageSpec: string) => {
      const { name } = parsePackageSpec(packageSpec);
      setUninstallingPackages((prev) => new Set(prev).add(name));
      try {
        await onUninstallPackage(name);
        toast.success(t("providerDetail.packageUninstalled", { name }));
      } catch {
        toast.error(t("providerDetail.packageUninstallError", { name }));
        throw new Error("uninstall failed");
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

  const headerContent: ReactNode = (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-4 w-4" />
          {t("providerDetail.searchPackages")}
        </CardTitle>
        <CardDescription>
          {t("providerDetail.searchPackagesDesc", { provider: providerId })}
        </CardDescription>
        <CardAction>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {installedPackages.length}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void onRefreshPackages()}
              disabled={loadingPackages}
            >
              {loadingPackages ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t("providers.refresh")}
            </Button>
          </div>
        </CardAction>
      </CardHeader>
    </Card>
  );

  const bottomContent =
    onBatchUninstall && selectedPackages.length > 0 ? (
      <BatchOperations
        selectedPackages={selectedPackages}
        allowedOperations={["uninstall"]}
        onBatchInstall={async () => ({
          successful: [],
          failed: [],
          skipped: [],
          total_time_ms: 0,
        })}
        onBatchUpdate={async () => ({
          successful: [],
          failed: [],
          skipped: [],
          total_time_ms: 0,
        })}
        onBatchUninstall={async (packageSpecs) => {
          const names = packageSpecs.map((packageSpec) => parsePackageSpec(packageSpec).name);
          await onBatchUninstall(names);
          return {
            successful: names.map((name) => ({
              name,
              version: "",
              provider: providerId,
              action: "uninstall",
            })),
            failed: [],
            skipped: [],
            total_time_ms: 0,
          };
        }}
        onClearSelection={clearPackageSelection}
      />
    ) : null;

  const contextValue: PackageOperationContextValue = {
    mode: "provider",
    features: {
      updates: false,
      batch: Boolean(onBatchUninstall),
      installedFilter: installedPackages.length > 5,
      pinning: Boolean(onPinPackage || onUnpinPackage),
    },
    providers,
    installedPackages,
    searchResults,
    loading: loadingPackages || loadingSearch,
    installing,
    pinnedPackages,
    preflightSummary,
    preflightPackages,
    isPreflightOpen,
    topContent: headerContent,
    bottomContent,
    onSearch: (query) => handleSearch(query),
    onGetSuggestions: async () => [],
    onInstall: handleInstall,
    onUninstall: handleUninstall,
    onSelect: onViewPackageDetails
      ? (pkg) => onViewPackageDetails(pkg.name)
      : undefined,
    onPin: onPinPackage
      ? (name) => void onPinPackage(name)
      : undefined,
    onUnpin: onUnpinPackage
      ? (name) => void onUnpinPackage(name)
      : undefined,
    onRollback: onRollbackPackage
      ? (name) => void onRollbackPackage(name)
      : undefined,
    onClearSelection: clearPackageSelection,
    onConfirmPreflight: onConfirmPreflight,
    onDismissPreflight: onDismissPreflight,
  };

  return (
    <PackageOperationProvider value={contextValue}>
      <PackageOperationPanel
        mode="provider"
        features={{ updates: false, batch: Boolean(onBatchUninstall) }}
      />
    </PackageOperationProvider>
  );
}
