"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Package,
  Server,
  ArrowUp,
  Pin,
  Star,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import type { InstalledPackage, ProviderInfo, UpdateInfo } from "@/lib/tauri";

interface StatsOverviewProps {
  installedPackages: InstalledPackage[];
  providers: ProviderInfo[];
  updates: UpdateInfo[];
  pinnedCount: number;
  bookmarkedCount: number;
  defaultExpanded?: boolean;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subLabel?: string;
  variant?: "default" | "success" | "warning" | "info";
}

function StatCard({
  icon,
  label,
  value,
  subLabel,
  variant = "default",
}: StatCardProps) {
  const variantClasses = {
    default: "bg-card",
    success: "bg-green-500/10 border-green-500/20",
    warning: "bg-orange-500/10 border-orange-500/20",
    info: "bg-blue-500/10 border-blue-500/20",
  };

  return (
    <Card className={`${variantClasses[variant]} border`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-muted">{icon}</div>
          <div>
            <p className="text-2xl font-semibold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
            {subLabel && (
              <p className="text-xs text-muted-foreground mt-0.5">{subLabel}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatsOverview({
  installedPackages,
  providers,
  updates,
  pinnedCount,
  bookmarkedCount,
  defaultExpanded = false,
}: StatsOverviewProps) {
  const { t } = useLocale();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const providerStats = useMemo(() => {
    const stats: Record<string, number> = {};
    installedPackages.forEach((pkg) => {
      stats[pkg.provider] = (stats[pkg.provider] || 0) + 1;
    });
    return stats;
  }, [installedPackages]);

  const enabledProviders = useMemo(
    () => providers.filter((p) => p.enabled && !p.is_environment_provider),
    [providers],
  );

  const topProviders = useMemo(() => {
    return Object.entries(providerStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => {
        const provider = providers.find((p) => p.id === id);
        return {
          id,
          name: provider?.display_name || id,
          count,
        };
      });
  }, [providerStats, providers]);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="flex items-center justify-between mb-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 -ml-2">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {t("packages.statsOverview")}
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          <StatCard
            icon={<Package className="h-5 w-5 text-primary" />}
            label={t("packages.totalInstalled")}
            value={installedPackages.length}
          />
          <StatCard
            icon={<Server className="h-5 w-5 text-blue-500" />}
            label={t("packages.activeProviders")}
            value={enabledProviders.length}
            subLabel={t("packages.ofTotal", { count: providers.length })}
          />
          <StatCard
            icon={<ArrowUp className="h-5 w-5 text-green-500" />}
            label={t("packages.updatesAvailableShort")}
            value={updates.length}
            variant={updates.length > 0 ? "success" : "default"}
          />
          <StatCard
            icon={<Pin className="h-5 w-5 text-orange-500" />}
            label={t("packages.pinnedPackages")}
            value={pinnedCount}
          />
          <StatCard
            icon={<Star className="h-5 w-5 text-yellow-500" />}
            label={t("packages.bookmarked")}
            value={bookmarkedCount}
          />
        </div>

        {topProviders.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center mb-4">
            <span className="text-xs text-muted-foreground">
              {t("packages.packagesByProvider")}:
            </span>
            {topProviders.map((provider) => (
              <Badge key={provider.id} variant="secondary" className="gap-1">
                {provider.name}
                <span className="font-mono text-xs opacity-70">
                  ({provider.count})
                </span>
              </Badge>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
