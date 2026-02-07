"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { ProviderInfo } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { PROVIDER_ICONS } from "../provider-icons";

interface ProviderDetailHeaderProps {
  provider: ProviderInfo;
  isAvailable: boolean | null;
  isToggling: boolean;
  isCheckingStatus: boolean;
  onToggle: (enabled: boolean) => void;
  onCheckStatus: () => void;
  onRefresh: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function ProviderDetailHeader({
  provider,
  isAvailable,
  isToggling,
  isCheckingStatus,
  onToggle,
  onCheckStatus,
  onRefresh,
  t,
}: ProviderDetailHeaderProps) {
  const router = useRouter();
  const icon = PROVIDER_ICONS[provider.id] || "📦";

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/providers")}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="text-4xl" aria-hidden="true">
          {icon}
        </span>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{provider.display_name}</h1>
            {isAvailable !== null && (
              <Badge
                variant={isAvailable ? "default" : "destructive"}
                className={cn(
                  "gap-1",
                  isAvailable && "bg-green-600 hover:bg-green-700",
                )}
              >
                {isAvailable ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    {t("providers.statusAvailable")}
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3" />
                    {t("providers.statusUnavailable")}
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

      <div className="flex items-center gap-3 ml-14 sm:ml-0">
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

        <div className="flex items-center gap-2 border-l pl-3">
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
  );
}
