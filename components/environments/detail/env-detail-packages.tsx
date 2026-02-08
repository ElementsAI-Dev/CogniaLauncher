"use client";

import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Search,
  Download,
  Trash2,
  Loader2,
  RefreshCw,
  ArrowUpCircle,
} from "lucide-react";
import { usePackages } from "@/hooks/use-packages";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Map environment types to their associated package manager provider IDs
const ENV_TYPE_TO_PROVIDERS: Record<string, string[]> = {
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
};

interface EnvDetailPackagesProps {
  envType: string;
  t: (key: string, params?: Record<string, string | number>) => string;
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
    availableUpdates,
    isCheckingUpdates,
  } = usePackages();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<"installed" | "search">(
    "installed",
  );

  const relevantProviders = ENV_TYPE_TO_PROVIDERS[envType] || [];
  const [selectedProvider, setSelectedProvider] = useState(
    relevantProviders[0] || "",
  );
  const activeProvider = selectedProvider || relevantProviders[0];

  // Fetch installed packages for the active provider on mount or provider change
  useEffect(() => {
    if (activeProvider) {
      fetchInstalledPackages(activeProvider);
    }
  }, [activeProvider, fetchInstalledPackages]);

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    setActiveView("search");
    await searchPackages(query, activeProvider);
  };

  const handleInstall = async (packageName: string) => {
    try {
      const pkgSpec = activeProvider
        ? `${activeProvider}:${packageName}`
        : packageName;
      await installPackages([pkgSpec]);
      toast.success(
        t("environments.detail.packageInstalled", { name: packageName }),
      );
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleUninstall = async (packageName: string) => {
    try {
      const pkgSpec = activeProvider
        ? `${activeProvider}:${packageName}`
        : packageName;
      await uninstallPackages([pkgSpec]);
      toast.success(
        t("environments.detail.packageUninstalled", { name: packageName }),
      );
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleCheckUpdates = async () => {
    await checkForUpdates();
  };

  if (relevantProviders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-medium">
          {t("environments.detail.noPackageManager")}
        </h3>
        <p className="text-sm mt-1">
          {t("environments.detail.noPackageManagerDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search & Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                {t("environments.detail.packages")}
              </CardTitle>
              <CardDescription>
                {t("environments.detail.packagesDesc", {
                  provider: activeProvider || envType,
                })}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {relevantProviders.length > 1 && (
                <Select
                  value={activeProvider}
                  onValueChange={setSelectedProvider}
                >
                  <SelectTrigger className="h-9 w-[130px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {relevantProviders.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchInstalledPackages(activeProvider)}
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
                onClick={handleCheckUpdates}
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
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("environments.detail.searchPackages")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch(searchQuery);
                }}
                className="pl-9"
              />
            </div>
            <Button
              onClick={() => handleSearch(searchQuery)}
              disabled={!searchQuery.trim() || loading}
            >
              {t("environments.detail.searchBtn")}
            </Button>
          </div>

          {/* View Toggle */}
          <div className="flex gap-2 mt-3">
            <Button
              variant={activeView === "installed" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveView("installed")}
            >
              {t("environments.detail.installedTab")}
              {installedPackages.length > 0 && (
                <Badge variant="secondary" className="ml-1.5">
                  {installedPackages.length}
                </Badge>
              )}
            </Button>
            <Button
              variant={activeView === "search" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveView("search")}
              disabled={searchResults.length === 0}
            >
              {t("environments.detail.searchResults")}
              {searchResults.length > 0 && (
                <Badge variant="secondary" className="ml-1.5">
                  {searchResults.length}
                </Badge>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-3 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      {/* Available Updates */}
      {availableUpdates.length > 0 && activeView === "installed" && (
        <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4 text-yellow-600" />
              {t("environments.detail.updatesAvailable")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {availableUpdates.slice(0, 10).map((update) => (
                <div
                  key={update.name}
                  className="flex items-center justify-between p-2 rounded bg-background/60"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="font-mono text-sm">{update.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {update.current_version} → {update.latest_version}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 shrink-0 text-xs h-7"
                    onClick={() => handleInstall(`${update.name}@${update.latest_version}`)}
                    disabled={installing.includes(update.name)}
                  >
                    {installing.includes(update.name) ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ArrowUpCircle className="h-3 w-3" />
                    )}
                    {t("environments.detail.updateBtn")}
                  </Button>
                </div>
              ))}
              {availableUpdates.length > 10 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{availableUpdates.length - 10} more
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Package List */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!loading && activeView === "installed" && (
              <>
                {installedPackages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {t("environments.detail.noPackagesInstalled")}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {installedPackages.map((pkg) => (
                      <div
                        key={pkg.name}
                        className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium truncate">
                              {pkg.name}
                            </span>
                            <Badge variant="outline" className="text-xs font-mono shrink-0">
                              {pkg.version}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                          onClick={() => handleUninstall(pkg.name)}
                          disabled={installing.includes(pkg.name)}
                        >
                          {installing.includes(pkg.name) ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {!loading && activeView === "search" && (
              <>
                {searchResults.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {t("environments.detail.noSearchResults")}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {searchResults.map((pkg) => (
                      <div
                        key={pkg.name}
                        className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium truncate">
                              {pkg.name}
                            </span>
                            {pkg.latest_version && (
                              <Badge
                                variant="outline"
                                className="text-xs font-mono shrink-0"
                              >
                                {pkg.latest_version}
                              </Badge>
                            )}
                          </div>
                          {pkg.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {pkg.description}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 shrink-0"
                          onClick={() => handleInstall(pkg.name)}
                          disabled={installing.includes(pkg.name)}
                        >
                          {installing.includes(pkg.name) ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          {t("common.install")}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
