"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  RefreshCw,
  Loader2,
  ArrowUpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { usePackages } from "@/hooks/packages/use-packages";
import type { BatchResult, ProviderInfo } from "@/lib/tauri";
import {
  PackageOperationPanel,
} from "@/components/packages/shared/package-operation-panel";
import {
  PackageOperationProvider,
  type PackageOperationContextValue,
} from "@/components/packages/shared/package-operation-context";
import { cn } from "@/lib/utils";

// Map environment types to their associated package manager provider IDs
export const ENV_TYPE_TO_PROVIDERS: Record<string, string[]> = {
  node: ["npm", "pnpm", "yarn", "bun"],
  python: ["pip", "uv", "poetry", "conda", "pipx"],
  rust: ["cargo"],
  go: ["go"],
  ruby: ["gem", "bundler"],
  java: [],
  kotlin: [],
  php: ["composer"],
  dotnet: ["dotnet"],
  deno: ["deno"],
  bun: ["bun", "npm"],
  c: ["vcpkg", "conan", "xmake"],
  clojure: [],
  cpp: ["vcpkg", "conan", "xmake"],
  crystal: [],
  dart: ["pub"],
  elixir: [],
  erlang: [],
  fortran: [],
  groovy: [],
  haskell: [],
  julia: [],
  lua: ["luarocks"],
  nim: [],
  ocaml: [],
  perl: [],
  r: [],
  scala: [],
  swift: [],
  zig: [],
};

interface EnvDetailPackagesProps {
  envType: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function toProviderInfos(providerIds: string[]): ProviderInfo[] {
  return providerIds.map((providerId, index) => ({
    id: providerId,
    display_name: providerId,
    capabilities: ["Search", "Install"],
    platforms: ["Windows", "Linux", "macOS"],
    priority: index + 1,
    is_environment_provider: true,
    enabled: true,
  }));
}

function createEmptyBatchResult(): BatchResult {
  return {
    successful: [],
    failed: [],
    skipped: [],
    total_time_ms: 0,
  };
}

export function EnvDetailPackages({ envType, t }: EnvDetailPackagesProps) {
  const {
    installedPackages,
    searchResults,
    loading,
    error,
    installing,
    searchPackages,
    fetchInstalledPackages,
    installPackages,
    uninstallPackages,
    checkForUpdates,
    preflightSummary,
    preflightPackages,
    isPreflightOpen,
    confirmPreflight,
    dismissPreflight,
  } = usePackages();

  const relevantProviders = useMemo(
    () => ENV_TYPE_TO_PROVIDERS[envType] ?? [],
    [envType],
  );
  const [selectedProvider, setSelectedProvider] = useState(
    relevantProviders[0] || "",
  );
  const [providerUpdates, setProviderUpdates] = useState<
    Array<{
      name: string;
      provider: string;
      current_version: string;
      latest_version: string;
    }>
  >([]);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);

  const activeProvider = selectedProvider || relevantProviders[0];
  const providers = useMemo(
    () => toProviderInfos(relevantProviders),
    [relevantProviders],
  );

  useEffect(() => {
    if (activeProvider) {
      void fetchInstalledPackages(activeProvider);
      setProviderUpdates([]);
    }
  }, [activeProvider, fetchInstalledPackages]);

  const visibleUpdates = useMemo(
    () => providerUpdates.filter((update) => update.provider === activeProvider),
    [providerUpdates, activeProvider],
  );

  const isPackageInstalling = (provider: string, name: string) =>
    installing.includes(`${provider}:${name}`) || installing.includes(name);

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    await searchPackages(query, activeProvider);
  };

  const handleInstallWithProvider = async (
    provider: string,
    packageName: string,
    version?: string,
  ) => {
    try {
      const pkgSpec = version
        ? `${provider}:${packageName}@${version}`
        : `${provider}:${packageName}`;
      await installPackages([pkgSpec]);
      toast.success(
        t("environments.detail.packageInstalled", { name: packageName }),
      );
    } catch (err) {
      toast.error(String(err));
      throw err;
    }
  };

  const handleUninstall = async (packageSpec: string) => {
    try {
      await uninstallPackages([packageSpec]);
      toast.success(
        t("environments.detail.packageUninstalled", { name: packageSpec }),
      );
    } catch (err) {
      toast.error(String(err));
      throw err;
    }
  };

  const handleCheckUpdates = async () => {
    if (!activeProvider) return;
    setIsCheckingUpdates(true);
    try {
      const packageNames = installedPackages.map((pkg) => pkg.name);
      const updates = await checkForUpdates(packageNames, {
        providerId: activeProvider,
        syncStore: false,
      });
      setProviderUpdates(updates);
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const headerContent: ReactNode = (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" />
                {t("environments.detail.packages")}
              </CardTitle>
              <CardDescription>
                {t("environments.detail.packagesDesc", {
                  provider: activeProvider || envType,
                })}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {relevantProviders.length > 1 ? (
                <Select value={activeProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger className="h-9 w-[130px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {relevantProviders.map((providerId) => (
                      <SelectItem key={providerId} value={providerId}>
                        {providerId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchInstalledPackages(activeProvider, true)}
                disabled={loading}
                className="gap-1.5"
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", loading && "animate-spin")}
                />
                {t("environments.refresh")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleCheckUpdates()}
                disabled={isCheckingUpdates}
                className="gap-1.5"
              >
                {isCheckingUpdates ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowUpCircle className="h-3.5 w-3.5" />
                )}
                {t("environments.detail.checkUpdates")}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {visibleUpdates.length > 0 ? (
        <Card className="border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowUpCircle className="h-4 w-4 text-yellow-600" />
              {t("environments.detail.updatesAvailable")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {visibleUpdates.slice(0, 10).map((update) => (
                <div
                  key={`${update.provider}:${update.name}`}
                  className="flex items-center justify-between gap-3 rounded bg-background/60 p-2"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="font-mono text-sm">{update.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {update.current_version} → {update.latest_version}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 gap-1 text-xs"
                    onClick={() =>
                      void handleInstallWithProvider(
                        update.provider,
                        update.name,
                        update.latest_version,
                      )
                    }
                    disabled={isPackageInstalling(update.provider, update.name)}
                  >
                    {isPackageInstalling(update.provider, update.name) ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ArrowUpCircle className="h-3 w-3" />
                    )}
                    {t("environments.detail.updateBtn")}
                  </Button>
                </div>
              ))}
              {visibleUpdates.length > 10 ? (
                <p className="text-center text-xs text-muted-foreground">
                  +{visibleUpdates.length - 10} more
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </>
  );

  if (relevantProviders.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Package className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <h3 className="text-lg font-medium">
          {t("environments.detail.noPackageManager")}
        </h3>
        <p className="mt-1 text-sm">
          {t("environments.detail.noPackageManagerDesc")}
        </p>
      </div>
    );
  }

  const contextValue: PackageOperationContextValue = {
    mode: "environment",
    features: {
      updates: false,
      batch: false,
      installedFilter: false,
    },
    providers,
    installedPackages,
    searchResults,
    availableUpdates: visibleUpdates,
    installing,
    loading,
    error,
    preflightSummary,
    preflightPackages,
    isPreflightOpen,
    topContent: headerContent,
    onSearch: (query) => handleSearch(query),
    onGetSuggestions: async () => [],
    onInstall: async (packageSpec) => {
      await installPackages([packageSpec]);
      toast.success(
        t("environments.detail.packageInstalled", { name: packageSpec }),
      );
    },
    onUninstall: (packageSpec) => handleUninstall(packageSpec),
    onUpdateSelected: async () => createEmptyBatchResult(),
    onUpdateAll: async () => createEmptyBatchResult(),
    onCheckUpdates: handleCheckUpdates,
    onConfirmPreflight: confirmPreflight,
    onDismissPreflight: dismissPreflight,
  };

  return (
    <PackageOperationProvider value={contextValue}>
      <PackageOperationPanel
        mode="environment"
        features={{ updates: false, batch: false, installedFilter: false }}
      />
    </PackageOperationProvider>
  );
}
