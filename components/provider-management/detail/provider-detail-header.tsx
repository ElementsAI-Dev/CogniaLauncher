"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { ProviderInfo, ProviderStatusInfo } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import {
  getProviderStatusState,
  getProviderStatusTextKey,
} from "@/lib/utils/provider";
import { ProviderIcon } from "../provider-icon";

interface ProviderDetailHeaderProps {
  provider: ProviderInfo;
  isAvailable: boolean | null;
  statusInfo?: ProviderStatusInfo | null;
  isToggling: boolean;
  isCheckingStatus: boolean;
  isSavingPriority: boolean;
  onToggle: (enabled: boolean) => void;
  onCheckStatus: () => void;
  onRefresh: () => void;
  onPrioritySave: (priority: number) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

interface ProviderPriorityControlsProps {
  providerId: string;
  initialPriority: number;
  isSavingPriority: boolean;
  onPrioritySave: (priority: number) => void;
  t: ProviderDetailHeaderProps["t"];
}

function ProviderPriorityControls({
  providerId,
  initialPriority,
  isSavingPriority,
  onPrioritySave,
  t,
}: ProviderPriorityControlsProps) {
  const [priorityValue, setPriorityValue] = useState(String(initialPriority));

  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="provider-priority" className="text-sm">
          {t("providers.priority")}
        </Label>
        <Input
          key={`${providerId}-priority-input`}
          id="provider-priority"
          aria-label={t("providers.priority")}
          className="w-24"
          inputMode="numeric"
          value={priorityValue}
          onChange={(event) => setPriorityValue(event.target.value)}
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPrioritySave(Number(priorityValue))}
        disabled={
          isSavingPriority ||
          priorityValue.trim() === "" ||
          Number.isNaN(Number(priorityValue))
        }
      >
        {isSavingPriority ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : null}
        {t("providerDetail.savePriority")}
      </Button>
    </>
  );
}

export function ProviderDetailHeader({
  provider,
  isAvailable,
  statusInfo,
  isToggling,
  isCheckingStatus,
  isSavingPriority,
  onToggle,
  onCheckStatus,
  onRefresh,
  onPrioritySave,
  t,
}: ProviderDetailHeaderProps) {
  const statusState = statusInfo
    ? getProviderStatusState(statusInfo)
    : isAvailable === null
      ? 'unknown'
      : isAvailable
        ? 'available'
        : 'unavailable';

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/providers">
                {t("nav.providers")}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{provider.display_name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <ProviderIcon providerId={provider.id} size={40} />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{provider.display_name}</h1>
              {statusState !== 'unknown' && (
                <Badge
                  variant={statusState === 'available' ? "default" : "destructive"}
                  className={cn(
                    "gap-1",
                    statusState === 'available' && "bg-green-600 hover:bg-green-700",
                  )}
                >
                  {statusState === 'available' ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      {t(getProviderStatusTextKey(statusState))}
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" />
                      {t(getProviderStatusTextKey(statusState))}
                    </>
                  )}
                </Badge>
              )}
              {provider.is_environment_provider && (
                <Badge variant="outline">
                  {t("providers.filterEnvironment")}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground font-mono mt-1">
              {provider.id}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-end gap-2">
            <ProviderPriorityControls
              key={`${provider.id}:${provider.priority}`}
              providerId={provider.id}
              initialPriority={provider.priority}
              isSavingPriority={isSavingPriority}
              onPrioritySave={onPrioritySave}
              t={t}
            />
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onCheckStatus}
                disabled={isCheckingStatus}
              >
                {isCheckingStatus ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Activity className="h-4 w-4 mr-2" />
                )}
                {t("providers.checkStatus")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("providers.checkStatusDesc")}</p>
            </TooltipContent>
          </Tooltip>

          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("providers.refresh")}
          </Button>

          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <Label htmlFor="provider-enabled" className="text-sm">
              {t("providers.enabled")}
            </Label>
            {isToggling && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
            <Switch
              id="provider-enabled"
              checked={provider.enabled}
              onCheckedChange={onToggle}
              disabled={isToggling}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
