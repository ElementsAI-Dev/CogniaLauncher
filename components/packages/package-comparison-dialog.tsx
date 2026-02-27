"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  GitCompare,
  Check,
  X,
  ExternalLink,
  Package,
  AlertCircle,
  Scale,
} from "lucide-react";
import type { PackageComparison } from "@/lib/tauri";
import { formatSize } from "@/lib/utils";
import { useLocale } from "@/components/providers/locale-provider";
import { COMPARISON_FEATURE_KEYS } from "@/lib/constants/packages";
import { getHighlightClass } from "@/lib/packages";
import type { PackageComparisonDialogProps } from "@/types/packages";

export function PackageComparisonDialog({
  open,
  onOpenChange,
  packageIds,
  onCompare,
}: PackageComparisonDialogProps) {
  const { t } = useLocale();
  const [comparison, setComparison] = useState<PackageComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComparison = useCallback(async () => {
    if (packageIds.length < 2) return;

    setLoading(true);
    setError(null);

    try {
      const result = await onCompare(packageIds);
      setComparison(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("packages.failedToCompare"),
      );
    } finally {
      setLoading(false);
    }
  }, [packageIds, onCompare, t]);

  useEffect(() => {
    if (open && packageIds.length >= 2) {
      loadComparison();
    }
  }, [open, loadComparison, packageIds.length]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return t("packages.unknownDate");
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const renderFeatureValue = (
    pkg: Record<string, unknown>,
    featureKey: string,
    featureType: "boolean" | "string" | "array" | "size",
  ) => {
    const value = pkg[featureKey];

    if (value === undefined || value === null) {
      return <span className="text-muted-foreground">—</span>;
    }

    switch (featureType) {
      case "boolean":
        return value ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <X className="h-4 w-4 text-red-500" />
        );

      case "size":
        return formatSize(value as number);

      case "array":
        const arr = value as string[];
        if (arr.length === 0)
          return (
            <span className="text-muted-foreground">
              {t("packages.noneValue")}
            </span>
          );
        return (
          <div className="flex flex-wrap gap-1">
            {arr.slice(0, 3).map((item, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {item}
              </Badge>
            ))}
            {arr.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{arr.length - 3}
              </Badge>
            )}
          </div>
        );

      case "string":
      default:
        if (featureKey === "homepage" && typeof value === "string") {
          return (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              {t("packages.link")} <ExternalLink className="h-3 w-3" />
            </a>
          );
        }
        if (featureKey === "updated_at") {
          return formatDate(value as string);
        }
        return <span className="truncate max-w-[150px]">{String(value)}</span>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            {t("packages.comparePackages")}
          </DialogTitle>
          <DialogDescription>
            {t("packages.sideByComparison", { count: packageIds.length })}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {packageIds.map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="my-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {comparison && !loading && (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 pr-4">
              {/* Package Headers */}
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: `repeat(${comparison.packages.length}, 1fr)`,
                }}
              >
                {comparison.packages.map((pkg, i) => (
                  <div key={i} className="p-4 border rounded-lg bg-card">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{pkg.name}</h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {pkg.description || t("packages.noDescription")}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline">{pkg.provider}</Badge>
                          <Badge>{pkg.version || pkg.latest_version}</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Differences Summary */}
              {comparison.differences && comparison.differences.length > 0 && (
                <Alert className="bg-yellow-500/10 border-yellow-500/20 [&>svg]:text-yellow-600">
                  <Scale className="h-4 w-4" />
                  <AlertTitle>{t("packages.keyDifferences")}</AlertTitle>
                  <AlertDescription>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {comparison.differences.map((diff, i) => (
                        <Badge key={i} variant="secondary">
                          {diff}
                        </Badge>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Comparison Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">
                      {t("packages.feature")}
                    </TableHead>
                    {comparison.packages.map((pkg, i) => (
                      <TableHead key={i}>{pkg.name}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {COMPARISON_FEATURE_KEYS.map((feature) => {
                    const allValues = comparison.packages.map(
                      (pkg) => pkg[feature.key],
                    );

                    return (
                      <TableRow key={feature.key}>
                        <TableCell className="font-medium">
                          {t(`packages.${feature.nameKey}`)}
                        </TableCell>
                        {comparison.packages.map((pkg, i) => (
                          <TableCell
                            key={i}
                            className={getHighlightClass(
                              feature.key,
                              pkg[feature.key],
                              allValues,
                            )}
                          >
                            {renderFeatureValue(
                              pkg as Record<string, unknown>,
                              feature.key,
                              feature.type,
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Common Features */}
              {comparison.common_features &&
                comparison.common_features.length > 0 && (
                  <Alert className="bg-green-500/10 border-green-500/20 [&>svg]:text-green-600">
                    <Check className="h-4 w-4" />
                    <AlertTitle>{t("packages.commonFeatures")}</AlertTitle>
                    <AlertDescription>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {comparison.common_features.map((feature, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="border-green-500/30"
                          >
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

              {/* Recommendation */}
              {comparison.recommendation && (
                <Alert className="bg-primary/10 border-primary/20">
                  <AlertTitle>{t("packages.recommendation")}</AlertTitle>
                  <AlertDescription>
                    {comparison.recommendation}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
