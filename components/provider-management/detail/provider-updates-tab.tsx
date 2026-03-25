"use client";

import { useState, useCallback } from "react";
import { useLocale } from "@/components/providers/locale-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
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
  ArrowUpCircle,
  Loader2,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import type { UpdateInfo } from "@/types/tauri";
import { toast } from "sonner";

interface ProviderUpdatesTabProps {
  availableUpdates: UpdateInfo[];
  loadingUpdates: boolean;
  onCheckUpdates: () => Promise<UpdateInfo[]>;
  onUpdatePackage: (name: string) => Promise<unknown>;
  onUpdateAllPackages: (packageNames: string[]) => Promise<unknown>;
}

export function ProviderUpdatesTab({
  availableUpdates,
  loadingUpdates,
  onCheckUpdates,
  onUpdatePackage,
  onUpdateAllPackages,
}: ProviderUpdatesTabProps) {
  const { t } = useLocale();
  const [updatingPackages, setUpdatingPackages] = useState<Set<string>>(new Set());
  const [isUpdatingAll, setIsUpdatingAll] = useState(false);

  const handleUpdatePackage = useCallback(
    async (name: string) => {
      setUpdatingPackages((prev) => new Set(prev).add(name));
      try {
        await onUpdatePackage(name);
        toast.success(t("providerDetail.packageUpdated", { name }));
        await onCheckUpdates();
      } catch {
        toast.error(t("providerDetail.packageUpdateError", { name }));
      } finally {
        setUpdatingPackages((prev) => {
          const next = new Set(prev);
          next.delete(name);
          return next;
        });
      }
    },
    [onCheckUpdates, onUpdatePackage, t],
  );

  const handleUpdateAll = useCallback(async () => {
    setIsUpdatingAll(true);
    try {
      const packageNames = availableUpdates.map((u) => u.name);
      await onUpdateAllPackages(packageNames);
      toast.success(
        t("providerDetail.allPackagesUpdated", { count: availableUpdates.length }),
      );
      await onCheckUpdates();
    } catch {
      toast.error(t("providerDetail.updateAllError"));
    } finally {
      setIsUpdatingAll(false);
    }
  }, [availableUpdates, onCheckUpdates, onUpdateAllPackages, t]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ArrowUpCircle className="h-4 w-4" />
          {t("providerDetail.updates")}
          {availableUpdates.length > 0 && (
            <Badge variant="secondary">{availableUpdates.length}</Badge>
          )}
        </CardTitle>
        <CardDescription>
          {t("providerDetail.updatesDesc")}
        </CardDescription>
        <CardAction>
          <div className="flex gap-2">
            {availableUpdates.length > 0 && (
              <Button
                size="sm"
                onClick={handleUpdateAll}
                disabled={isUpdatingAll}
              >
                {isUpdatingAll ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ArrowUpCircle className="h-4 w-4 mr-2" />
                )}
                {t("providerDetail.updateAll")}
              </Button>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCheckUpdates()}
                  disabled={loadingUpdates}
                >
                  {loadingUpdates ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {t("providerDetail.checkUpdates")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("providerDetail.checkUpdatesDesc")}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        {loadingUpdates ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : availableUpdates.length === 0 ? (
          <Empty className="border-none py-4">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CheckCircle2 className="text-green-600" />
              </EmptyMedia>
              <EmptyTitle>{t("providerDetail.noUpdates")}</EmptyTitle>
              <EmptyDescription>{t("providerDetail.noUpdatesDesc")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("providerDetail.packageName")}</TableHead>
                  <TableHead>{t("providerDetail.currentVersion")}</TableHead>
                  <TableHead />
                  <TableHead>{t("providerDetail.latestVersion")}</TableHead>
                  <TableHead className="w-[100px]">
                    {t("providerDetail.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availableUpdates.map((update) => (
                  <TableRow key={update.name}>
                    <TableCell className="font-mono text-sm font-medium">
                      {update.name}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {update.current_version}
                    </TableCell>
                    <TableCell className="text-center">
                      <ArrowRight className="h-4 w-4 text-muted-foreground inline-block" />
                    </TableCell>
                    <TableCell className="font-mono text-sm text-green-600 dark:text-green-400 font-medium">
                      {update.latest_version}
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdatePackage(update.name)}
                            disabled={updatingPackages.has(update.name) || isUpdatingAll}
                          >
                            {updatingPackages.has(update.name) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ArrowUpCircle className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("providerDetail.updatePackage")}</p>
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
  );
}
