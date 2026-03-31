"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Package,
  Search,
  X,
  ChevronRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { cn } from "@/lib/utils";
import type { InstalledPackage } from "@/lib/tauri";
import type { DashboardPresentation } from "@/lib/stores/dashboard";
import {
  DashboardClickableRow,
  DashboardEmptyState,
  DashboardStatusBadge,
} from "@/components/dashboard/dashboard-primitives";

interface PackageListProps {
  packages: InstalledPackage[];
  className?: string;
  initialLimit?: number;
  isLoading?: boolean;
  error?: string | null;
  onRecover?: () => void;
  presentation?: DashboardPresentation;
}

export function PackageList({
  packages,
  className,
  initialLimit = 5,
  isLoading = false,
  error = null,
  onRecover,
  presentation = { density: "comfortable", emphasis: "balanced" },
}: PackageListProps) {
  const router = useRouter();
  const { t } = useLocale();

  const [searchQuery, setSearchQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const filteredPackages = useMemo(() => {
    if (!searchQuery.trim()) return packages;

    const query = searchQuery.toLowerCase();
    return packages.filter(
      (pkg) =>
        pkg.name.toLowerCase().includes(query) ||
        pkg.provider.toLowerCase().includes(query) ||
        pkg.version.toLowerCase().includes(query),
    );
  }, [packages, searchQuery]);

  const remainingCount = filteredPackages.length - initialLimit;
  const hasMore = remainingCount > 0;

  const handlePackageClick = useCallback(
    (pkg: InstalledPackage) => {
      const params = new URLSearchParams({ name: pkg.name });
      if (pkg.provider) params.set('provider', pkg.provider);
      router.push(`/packages/detail?${params.toString()}`);
    },
    [router],
  );

  const handleViewAll = useCallback(() => {
    router.push("/packages");
  }, [router]);

  const initialItems = filteredPackages.slice(0, initialLimit);
  const extraItems = filteredPackages.slice(initialLimit);

  return (
    <Card
      className={cn(
        presentation.emphasis === "strong" && "border-primary/20 shadow-sm",
        className,
      )}
      data-density={presentation.density}
      data-emphasis={presentation.emphasis}
    >
      <CardHeader className={cn("pb-3", presentation.density === "compact" && "pb-2")}>
        <CardTitle className="text-base font-medium">
          {t("dashboard.packageList.title")}
        </CardTitle>
        <CardDescription>
          {t("dashboard.recentPackagesDesc")}
        </CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleViewAll}
            className="gap-1"
          >
            {t("dashboard.packageList.viewAll")}
            <ExternalLink className="h-3 w-3" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className={cn(presentation.density === "compact" && "pt-0")}>
        {error && (
          <Alert variant="destructive" className="mb-3">
            <AlertTitle>{t("dashboard.widgets.sectionNeedsAttention")}</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{error}</p>
              {onRecover && (
                <Button variant="outline" size="sm" onClick={onRecover}>
                  {t("dashboard.widgets.retry")}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Search Input */}
        {packages.length > 3 && (
          <div className={cn("relative mb-3", presentation.density === "compact" && "mb-2.5")}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t("dashboard.packageList.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "h-9 pl-9 pr-9",
                presentation.density === "compact" && "h-8 text-sm",
              )}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => setSearchQuery("")}
                aria-label={t("common.clear")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {/* Package List */}
        {isLoading && packages.length === 0 ? (
          <DashboardEmptyState
            icon={<Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />}
            message={t("dashboard.widgets.sectionLoading")}
          />
        ) : filteredPackages.length === 0 ? (
          <DashboardEmptyState
            icon={<Package className="h-8 w-8 text-muted-foreground/70" />}
            message={
              packages.length === 0
                ? t("dashboard.noPackages")
                : t("dashboard.packageList.noResults")
            }
            action={(
              <Button
                variant="link"
                size="sm"
                className="mt-1 gap-1"
                onClick={handleViewAll}
              >
                {t("dashboard.quickActions.installPackage")}
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}
          />
        ) : (
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <div className="space-y-2">
              {initialItems.map((pkg, index) => (
                <PackageItem
                  key={`${pkg.provider}-${pkg.name}-${pkg.version}-${index}`}
                  package={pkg}
                  onClick={() => handlePackageClick(pkg)}
                  presentation={presentation}
                />
              ))}
            </div>

            {hasMore && (
              <>
                <CollapsibleContent>
                  <div className="space-y-2 mt-2">
                    {extraItems.map((pkg, index) => (
                      <PackageItem
                        key={`${pkg.provider}-${pkg.name}-${pkg.version}-extra-${index}`}
                        package={pkg}
                        onClick={() => handlePackageClick(pkg)}
                        presentation={presentation}
                      />
                    ))}
                  </div>
                </CollapsibleContent>

                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 w-full gap-1"
                  >
                    {expanded ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        {t("dashboard.packageList.showLess")}
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        {t("dashboard.packageList.showMore", { count: remainingCount })}
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
              </>
            )}
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

interface PackageItemProps {
  package: InstalledPackage;
  onClick: () => void;
  presentation: DashboardPresentation;
}

function PackageItem({ package: pkg, onClick, presentation }: PackageItemProps) {
  return (
    <DashboardClickableRow
      onClick={onClick}
      aria-label={pkg.name}
      className={cn(presentation.density === "compact" && "px-2.5 py-2.5")}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted",
            presentation.density === "compact" && "h-9 w-9",
          )}
        >
          <Package className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className={cn("text-left min-w-0", presentation.density === "compact" && "text-sm")}>
          <div className="font-medium truncate">{pkg.name}</div>
          <div className="text-xs text-muted-foreground">{pkg.provider}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <DashboardStatusBadge
          className={cn(
            "font-mono text-xs max-w-30 truncate",
            presentation.density === "compact" && "px-1.5 py-0",
          )}
        >
          {pkg.version}
        </DashboardStatusBadge>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </DashboardClickableRow>
  );
}
