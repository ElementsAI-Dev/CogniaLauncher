"use client";

import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchBar } from "@/components/packages/search-bar";
import { PackageList } from "@/components/packages/package-list";
import { UpdateManager } from "@/components/packages/update-manager";
import {
  InstalledFilterBar,
  useInstalledFilter,
} from "@/components/packages/installed-filter-bar";
import { useLocale } from "@/components/providers/locale-provider";
import {
  resolvePackageOperationFeatures,
  usePackageOperationContext,
  type PackageOperationFeatures,
  type PackageOperationMode,
} from "./package-operation-context";
import { PreFlightDialog } from "./pre-flight-dialog";

export interface PackageOperationPanelProps {
  mode: PackageOperationMode;
  features?: PackageOperationFeatures;
  activeTab?: string;
  showTabList?: boolean;
  onTabChange?: (tab: string) => void;
}

export function PackageOperationPanel({
  mode,
  features,
  activeTab,
  showTabList = true,
  onTabChange,
}: PackageOperationPanelProps) {
  const context = usePackageOperationContext();
  const { t } = useLocale();
  const resolvedFeatures = resolvePackageOperationFeatures(mode, {
    ...context.features,
    ...features,
  });
  const [internalActiveTab, setInternalActiveTab] = useState(activeTab ?? "installed");
  const currentActiveTab = activeTab ?? internalActiveTab;
  const {
    filter: installedFilter,
    setFilter: setInstalledFilter,
    filteredPackages: filteredInstalledPackages,
  } = useInstalledFilter(context.installedPackages);

  const updateManagerItems = useMemo(
    () =>
      (context.availableUpdates ?? []).map((update) => ({
        ...update,
        package_id: `${update.provider}:${update.name}`,
        is_pinned: (context.pinnedPackages ?? []).includes(
          `${update.provider}:${update.name}`,
        ),
        is_breaking: false,
        change_type: "unknown" as const,
      })),
    [context.availableUpdates, context.pinnedPackages],
  );

  const tabs = [
    resolvedFeatures.installed
      ? { id: "installed", label: t("packages.installed") }
      : null,
    resolvedFeatures.search
      ? { id: "search", label: t("packages.searchResults") }
      : null,
    resolvedFeatures.updates
      ? { id: "updates", label: t("packages.updates") }
      : null,
    resolvedFeatures.dependencies
      ? { id: "dependencies", label: t("packages.dependencies") }
      : null,
    resolvedFeatures.history
      ? { id: "history", label: t("packages.history") }
      : null,
    ...(context.extraTabs ?? []).map((tab) => ({
      id: tab.id,
      label: tab.label,
    })),
  ].filter((tab): tab is { id: string; label: string } => Boolean(tab));

  const activeSearchFilterCount = context.activeSearchRequest?.filterCount ?? 0;

  const handleSearch = async (
    query: string,
    options: Parameters<typeof context.onSearch>[1],
  ) => {
    await context.onSearch(query, options);
    if (activeTab === undefined) {
      setInternalActiveTab("search");
    }
    onTabChange?.("search");
  };

  return (
    <div className="flex min-h-0 flex-col gap-4">
      {context.error ? (
        <Alert variant="destructive">
          <AlertDescription>{context.error}</AlertDescription>
        </Alert>
      ) : null}

      {context.topContent}

      <Tabs
        value={currentActiveTab}
        onValueChange={(nextTab) => {
          if (activeTab === undefined) {
            setInternalActiveTab(nextTab);
          }
          onTabChange?.(nextTab);
        }}
        className="flex min-h-0 flex-col gap-4"
      >
        {showTabList ? (
          <TabsList className="h-auto flex-wrap justify-start">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        ) : null}

        {resolvedFeatures.installed ? (
          <TabsContent value="installed" forceMount className="mt-0 flex min-h-0 flex-col gap-4">
            {context.tabContentOverrides?.installed ?? (
              <>
                {resolvedFeatures.installedFilter ? (
                  <InstalledFilterBar
                    packages={context.installedPackages}
                    providers={context.providers}
                    filter={installedFilter}
                    onFilterChange={setInstalledFilter}
                  />
                ) : null}
                <PackageList
                  packages={
                    resolvedFeatures.installedFilter
                      ? filteredInstalledPackages
                      : context.installedPackages
                  }
                  type="installed"
                  installing={context.installing}
                  pinnedPackages={context.pinnedPackages}
                  bookmarkedPackages={context.bookmarkedPackages}
                  onUninstall={context.onUninstall}
                  onSelect={context.onSelect}
                  onResolveDependencies={context.onResolveDependencies}
                  onPin={context.onPin}
                  onUnpin={context.onUnpin}
                  onRollback={context.onRollback}
                  onBookmark={context.onBookmark}
                  selectable={resolvedFeatures.batch}
                />
              </>
            )}
          </TabsContent>
        ) : null}

        {resolvedFeatures.search ? (
          <TabsContent value="search" forceMount className="mt-0 flex min-h-0 flex-col gap-4">
            {context.tabContentOverrides?.search ?? (
              <>
                <Card>
                  <CardContent className="py-4">
                    <SearchBar
                      providers={context.providers}
                      inputRef={context.searchInputRef}
                      onSearch={handleSearch}
                      onGetSuggestions={context.onGetSuggestions}
                      loading={context.loading}
                    />
                  </CardContent>
                </Card>
                {context.activeSearchRequest ? (
                  <Card data-testid="active-search-summary">
                    <CardContent className="flex flex-col gap-2 py-4">
                      <div className="text-sm font-medium">
                        {t("packages.activeSearchTitle")}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {t("packages.activeSearchDescription")}
                      </div>
                      <div className="text-sm">
                        {t("packages.searchContextQuery", {
                          value: context.activeSearchRequest.query,
                        })}
                      </div>
                      {context.activeSearchRequest.providers?.length ? (
                        <div className="text-sm">
                          {t("packages.searchContextProviders", {
                            value: context.activeSearchRequest.providers.join(", "),
                          })}
                        </div>
                      ) : null}
                      {activeSearchFilterCount > 0 ? (
                        <div className="text-sm">
                          {t("packages.searchContextFilterCount", {
                            count: activeSearchFilterCount,
                          })}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ) : null}
                {context.searchMeta ? (
                  <Card>
                    <CardContent className="flex flex-col gap-4 py-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm text-muted-foreground">
                          {t("packages.searchSummary", {
                            from: context.searchMeta.page * context.searchMeta.pageSize + 1,
                            to: Math.min(
                              context.searchMeta.total,
                              context.searchMeta.page * context.searchMeta.pageSize +
                                context.searchResults.length,
                            ),
                            total: context.searchMeta.total,
                          })}
                        </div>
                        {context.onSearchPageChange ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm"
                              onClick={() =>
                                void context.onSearchPageChange?.(
                                  Math.max(0, context.searchMeta!.page - 1),
                                )
                              }
                              disabled={Boolean(context.loading) || context.searchMeta.page <= 0}
                            >
                              {t("packages.searchPrevPage")}
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm"
                              onClick={() =>
                                void context.onSearchPageChange?.(
                                  context.searchMeta!.page + 1,
                                )
                              }
                              disabled={
                                Boolean(context.loading) ||
                                (context.searchMeta.page + 1) * context.searchMeta.pageSize >=
                                  context.searchMeta.total
                              }
                            >
                              {t("packages.searchNextPage")}
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">
                            {t("packages.searchFacetProviders")}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(context.searchMeta.facets.providers).map(
                              ([provider, count]) => (
                                <span
                                  key={provider}
                                  className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs"
                                >
                                  {provider} ({count})
                                </span>
                              ),
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">
                            {t("packages.searchFacetLicenses")}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(context.searchMeta.facets.licenses).map(
                              ([license, count]) => (
                                <span
                                  key={license}
                                  className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs"
                                >
                                  {license} ({count})
                                </span>
                              ),
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
                <PackageList
                  packages={context.searchResults}
                  type="search"
                  installing={context.installing}
                  pinnedPackages={context.pinnedPackages}
                  bookmarkedPackages={context.bookmarkedPackages}
                  onInstall={context.onInstall}
                  onSelect={context.onSelect}
                  onResolveDependencies={context.onResolveDependencies}
                  onBookmark={context.onBookmark}
                  selectable={Boolean(resolvedFeatures.batch && context.onBatchInstall)}
                  showSelectAll={Boolean(context.onBatchInstall)}
                />
              </>
            )}
          </TabsContent>
        ) : null}

        {resolvedFeatures.updates ? (
          <TabsContent value="updates" className="mt-0">
            {context.tabContentOverrides?.updates ?? (
              <UpdateManager
                updates={updateManagerItems}
                loading={Boolean(context.loading)}
                onCheckUpdates={context.onCheckUpdates ?? (async () => {})}
                onUpdateSelected={context.onUpdateSelected ?? (async () => ({
                  successful: [],
                  failed: [],
                  skipped: [],
                  total_time_ms: 0,
                }))}
                onUpdateAll={context.onUpdateAll ?? (async () => ({
                  successful: [],
                  failed: [],
                  skipped: [],
                  total_time_ms: 0,
                }))}
                onPinPackage={async (packageId, options) =>
                  context.onPin?.(
                    packageId.split(":").slice(1).join(":") || packageId,
                    options?.version,
                    options?.provider ?? packageId.split(":")[0],
                  )
                }
                onUnpinPackage={async (packageId) =>
                  context.onUnpin?.(
                    packageId.split(":").slice(1).join(":") || packageId,
                    packageId.split(":")[0],
                  )
                }
              />
            )}
          </TabsContent>
        ) : null}

        {resolvedFeatures.dependencies ? (
          <TabsContent value="dependencies" className="mt-0">
            {context.tabContentOverrides?.dependencies
              ?? context.extraTabs?.find((tab) => tab.id === "dependencies")?.content
              ?? null}
          </TabsContent>
        ) : null}

        {resolvedFeatures.history ? (
          <TabsContent value="history" className="mt-0">
            {context.tabContentOverrides?.history
              ?? context.extraTabs?.find((tab) => tab.id === "history")?.content
              ?? null}
          </TabsContent>
        ) : null}

        {context.extraTabs
          ?.filter(
            (tab) => tab.id !== "dependencies" && tab.id !== "history",
          )
          .map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-0">
              {tab.content}
            </TabsContent>
          ))}
      </Tabs>

      {context.bottomContent}

      <PreFlightDialog
        open={Boolean(context.isPreflightOpen)}
        packages={context.preflightPackages ?? []}
        summary={context.preflightSummary ?? null}
        onConfirm={() => context.onConfirmPreflight?.()}
        onOpenChange={(open) => {
          if (!open) {
            context.onDismissPreflight?.();
          }
        }}
      />
    </div>
  );
}
