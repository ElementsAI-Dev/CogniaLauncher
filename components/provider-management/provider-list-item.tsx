"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, CheckCircle2, XCircle, Activity, ExternalLink } from "lucide-react";
import type { ProviderInfo } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { getProviderIcon } from "./provider-icons";

export interface ProviderListItemProps {
  provider: ProviderInfo;
  isAvailable?: boolean;
  isToggling: boolean;
  onToggle: (providerId: string, enabled: boolean) => void;
  onCheckStatus: (providerId: string) => Promise<boolean>;
  t: (key: string) => string;
}

export function ProviderListItem({
  provider,
  isAvailable,
  isToggling,
  onToggle,
  onCheckStatus,
  t,
}: ProviderListItemProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [localAvailable, setLocalAvailable] = useState<boolean | undefined>(
    isAvailable,
  );

  const handleCheckStatus = useCallback(async () => {
    setIsChecking(true);
    try {
      const available = await onCheckStatus(provider.id);
      setLocalAvailable(available);
    } finally {
      setIsChecking(false);
    }
  }, [onCheckStatus, provider.id]);

  const availabilityStatus = localAvailable ?? isAvailable;

  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 border rounded-lg transition-all duration-200 hover:bg-muted/50",
        !provider.enabled && "opacity-60",
      )}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <span className="text-xl flex-shrink-0" aria-hidden="true">
          {getProviderIcon(provider.id)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              {provider.display_name}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              ({provider.id})
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {provider.is_environment_provider && (
              <Badge variant="outline" className="text-xs">
                {t("providers.filterEnvironment")}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {t("providers.priority")}: {provider.priority}
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">
              {provider.capabilities.length}{" "}
              {t("providers.capabilities").toLowerCase()}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-shrink-0">
        {availabilityStatus !== undefined && (
          <Badge
            variant={availabilityStatus ? "default" : "destructive"}
            className={cn(
              "text-xs whitespace-nowrap gap-1",
              availabilityStatus && "bg-green-600 hover:bg-green-700",
            )}
          >
            {availabilityStatus ? (
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

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCheckStatus}
              disabled={isChecking}
              className="h-8 px-2"
            >
              {isChecking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Activity className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t("providers.checkStatus")}</p>
          </TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-2">
          {isToggling && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
          <Switch
            id={`enabled-list-${provider.id}`}
            checked={provider.enabled}
            onCheckedChange={(checked) => onToggle(provider.id, checked)}
            disabled={isToggling}
          />
        </div>

        <Link
          href={`/providers/${provider.id}`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline ml-2"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
