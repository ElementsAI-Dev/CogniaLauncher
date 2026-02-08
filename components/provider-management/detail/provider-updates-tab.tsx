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
  ArrowUpCircle,
  Loader2,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import type { UpdateInfo } from "@/types/tauri";
import * as tauri from "@/lib/tauri";
import { toast } from "sonner";

interface ProviderUpdatesTabProps {
  providerId: string;
  availableUpdates: UpdateInfo[];
  loadingUpdates: boolean;
  onCheckUpdates: () => Promise<UpdateInfo[]>;
  onRefreshPackages: () => Promise<unknown>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function ProviderUpdatesTab({
  providerId,
  availableUpdates,
  loadingUpdates,
  onCheckUpdates,
  onRefreshPackages,
  t,
}: ProviderUpdatesTabProps) {
  const [updatingPackages, setUpdatingPackages] = useState<Set<string>>(new Set());
  const [isUpdatingAll, setIsUpdatingAll] = useState(false);

  const handleUpdatePackage = useCallback(
    async (name: string) => {
      setUpdatingPackages((prev) => new Set(prev).add(name));
      try {
        const spec = `${providerId}:${name}`;
        await tauri.batchUpdate([spec]);
        toast.success(t("providerDetail.packageUpdated", { name }));
        await onRefreshPackages();
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
    [providerId, onRefreshPackages, onCheckUpdates, t],
  );

  const handleUpdateAll = useCallback(async () => {
    setIsUpdatingAll(true);
    try {
      const specs = availableUpdates.map((u) => `${providerId}:${u.name}`);
      await tauri.batchUpdate(specs);
      toast.success(
        t("providerDetail.allPackagesUpdated", { count: availableUpdates.length }),
      );
      await onRefreshPackages();
      await onCheckUpdates();
    } catch {
      toast.error(t("providerDetail.updateAllError"));
    } finally {
      setIsUpdatingAll(false);
    }
  }, [providerId, availableUpdates, onRefreshPackages, onCheckUpdates, t]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4" />
              {t("providerDetail.updates")}
              {availableUpdates.length > 0 && (
                <Badge variant="secondary">{availableUpdates.length}</Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              {t("providerDetail.updatesDesc")}
            </CardDescription>
          </div>
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
        </div>
      </CardHeader>
      <CardContent>
        {loadingUpdates ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : availableUpdates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-50 text-green-600" />
            <p>{t("providerDetail.noUpdates")}</p>
            <p className="text-xs mt-1">{t("providerDetail.noUpdatesDesc")}</p>
          </div>
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
