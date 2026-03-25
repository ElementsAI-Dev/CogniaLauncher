"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Server,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import * as tauri from "@/lib/tauri";
import { isPackageSurfaceProvider } from "@/lib/constants/providers";
import {
  getProviderStatusState,
  normalizeProviderStatus,
  isProviderStatusAvailable,
} from "@/lib/utils/provider";
import { toast } from "sonner";
import Link from "next/link";
import type { ProviderStatusBadgeProps } from "@/types/packages";
import type { ProviderStatusInfo } from "@/types/tauri";
import { ProviderStatusBadge as ManagementProviderStatusBadge } from "@/components/provider-management/provider-status-badge";

export function ProviderStatusBadge({
  providers,
  onProviderToggle,
  onRefresh,
}: ProviderStatusBadgeProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [togglingProvider, setTogglingProvider] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState<Record<string, boolean>>(
    {},
  );
  const [providerStatusMap, setProviderStatusMap] = useState<
    Record<string, ProviderStatusInfo>
  >({});
  const [loadingAggregateStatus, setLoadingAggregateStatus] = useState(false);

  const enabledCount = useMemo(
    () => providers.filter((p) => p.enabled).length,
    [providers],
  );

  const availableCount = useMemo(
    () =>
      providers.filter((provider) => {
        if (!provider.enabled) {
          return false;
        }

        const status = providerStatusMap[provider.id];
        if (!status) {
          return true;
        }

        return isProviderStatusAvailable(status) === true;
      })
        .length,
    [providers, providerStatusMap],
  );

  const applyProviderStatus = useCallback((status: ProviderStatusInfo) => {
    setProviderStatusMap((prev) => ({
      ...prev,
      [status.id]: normalizeProviderStatus(status.id, status) ?? status,
    }));
  }, []);

  const loadAggregateStatuses = useCallback(async () => {
    setLoadingAggregateStatus(true);
    try {
      const statuses = await tauri.providerStatusAll(true);
      const nextMap: Record<string, ProviderStatusInfo> = {};
      for (const status of statuses) {
        const normalized = normalizeProviderStatus(status.id, status);
        if (normalized) {
          nextMap[status.id] = normalized;
        }
      }
      setProviderStatusMap(nextMap);
    } finally {
      setLoadingAggregateStatus(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadAggregateStatuses();
  }, [loadAggregateStatuses, open]);

  useEffect(() => {
    setProviderStatusMap((prev) => {
      const allowed = new Set(providers.map((provider) => provider.id));
      const next = Object.fromEntries(
        Object.entries(prev).filter(([providerId]) => allowed.has(providerId)),
      );

      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [providers]);

  const handleToggle = useCallback(
    async (providerId: string, enabled: boolean) => {
      setTogglingProvider(providerId);
      try {
        if (enabled) {
          await tauri.providerEnable(providerId);
        } else {
          await tauri.providerDisable(providerId);
        }
        onProviderToggle?.(providerId, enabled);
        const provider = providers.find((p) => p.id === providerId);
        toast.success(
          enabled
            ? t("providers.enableSuccess", {
                name: provider?.display_name || providerId,
              })
            : t("providers.disableSuccess", {
                name: provider?.display_name || providerId,
              }),
        );
        await Promise.resolve(onRefresh?.());
        applyProviderStatus(await tauri.providerStatus(providerId));
      } catch {
        toast.error(
          enabled
            ? t("providers.enableError", { name: providerId })
            : t("providers.disableError", { name: providerId }),
        );
      } finally {
        setTogglingProvider(null);
      }
    },
    [applyProviderStatus, onProviderToggle, onRefresh, providers, t],
  );

  const handleCheckStatus = useCallback(async (providerId: string) => {
    setCheckingStatus((prev) => ({ ...prev, [providerId]: true }));
    try {
      applyProviderStatus(await tauri.providerStatus(providerId));
    } finally {
      setCheckingStatus((prev) => ({ ...prev, [providerId]: false }));
    }
  }, [applyProviderStatus]);

  const packageProviders = useMemo(
    () => providers.filter((p) => isPackageSurfaceProvider(p)),
    [providers],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2">
          <Server className="h-4 w-4" />
          <span className="hidden sm:inline">{t("packages.providers")}</span>
          <Badge
            variant={availableCount > 0 ? "default" : "secondary"}
            className="ml-1 text-xs"
          >
            {enabledCount}/{providers.length}
          </Badge>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 max-h-[60vh] flex flex-col" align="end" collisionPadding={16} avoidCollisions={true}>
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">
              {t("packages.providerManagement")}
            </h4>
            <Link
              href="/providers"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              {t("packages.viewAll")}
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t("packages.providerManagementDesc")}
          </p>
        </div>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-2 space-y-1">
            {packageProviders.map((provider) => {
              const isToggling = togglingProvider === provider.id;
              const isChecking = checkingStatus[provider.id];
              const status = providerStatusMap[provider.id];
              const statusState = getProviderStatusState(status);

              return (
                <div
                  key={provider.id}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-accent"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="relative">
                      {isChecking || (loadingAggregateStatus && open && !status) ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : statusState === "available" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : statusState !== "unknown" ? (
                        <XCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <Server className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <Label
                        htmlFor={`provider-${provider.id}`}
                        className="text-sm font-medium truncate block cursor-pointer"
                      >
                        {provider.display_name}
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono">
                          {provider.id}
                        </span>
                        {status && (
                          <ManagementProviderStatusBadge status={status} />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => handleCheckStatus(provider.id)}
                      disabled={isChecking || !provider.enabled}
                    >
                      {isChecking ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        t("providers.checkStatus")
                      )}
                    </Button>
                    <Switch
                      id={`provider-${provider.id}`}
                      checked={provider.enabled}
                      onCheckedChange={(checked) =>
                        handleToggle(provider.id, checked)
                      }
                      disabled={isToggling}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="p-2 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              void loadAggregateStatuses();
            }}
            disabled={loadingAggregateStatus}
          >
            {loadingAggregateStatus ? (
              <Loader2 className="h-3 w-3 animate-spin mr-2" />
            ) : null}
            {t("providers.checkAllStatus")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
