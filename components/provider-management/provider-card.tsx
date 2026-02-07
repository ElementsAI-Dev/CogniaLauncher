"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, CheckCircle2, XCircle, Activity, ExternalLink } from "lucide-react";
import type { ProviderInfo } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import {
  getProviderIcon,
  getPlatformIcon,
  getCapabilityColor,
} from "./provider-icons";

export interface ProviderCardProps {
  provider: ProviderInfo;
  isAvailable?: boolean;
  isToggling: boolean;
  onToggle: (providerId: string, enabled: boolean) => void;
  onCheckStatus: (providerId: string) => Promise<boolean>;
  t: (key: string) => string;
}

export function ProviderCard({
  provider,
  isAvailable,
  isToggling,
  onToggle,
  onCheckStatus,
  t,
}: ProviderCardProps) {
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
    <Card
      className={cn(
        "transition-all duration-200 overflow-hidden min-w-0",
        !provider.enabled && "opacity-60",
      )}
    >
      <CardHeader className="pb-3 overflow-hidden max-w-full">
        <div className="flex items-start justify-between gap-2 w-full max-w-full overflow-hidden">
          <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
            <span className="text-2xl flex-shrink-0" aria-hidden="true">
              {getProviderIcon(provider.id)}
            </span>
            <div className="min-w-0 overflow-hidden">
              <CardTitle
                className="text-lg truncate max-w-full"
                title={provider.display_name}
              >
                {provider.display_name}
              </CardTitle>
              <CardDescription className="font-mono text-xs">
                {provider.id}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {provider.is_environment_provider && (
              <Badge variant="outline" className="text-xs whitespace-nowrap">
                {t("providers.filterEnvironment")}
              </Badge>
            )}
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
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">
            {t("providers.platforms")}
          </Label>
          <div className="flex flex-wrap gap-2">
            {provider.platforms.map((platform) => (
              <span
                key={platform}
                className="text-sm inline-flex items-center gap-1"
                title={platform}
              >
                <span aria-hidden="true">{getPlatformIcon(platform)}</span>
                <span>{platform}</span>
              </span>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">
            {t("providers.capabilities")}
          </Label>
          <div className="flex flex-wrap gap-1">
            {provider.capabilities.map((cap) => (
              <Badge
                key={cap}
                variant="secondary"
                className={cn("text-xs", getCapabilityColor(cap))}
              >
                {cap.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>
        </div>

        <Separator className="my-3" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label
              htmlFor={`enabled-${provider.id}`}
              className="text-sm font-medium"
            >
              {t("providers.enabled")}
            </Label>
            {isToggling && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="flex items-center gap-2">
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
            <Switch
              id={`enabled-${provider.id}`}
              checked={provider.enabled}
              onCheckedChange={(checked) => onToggle(provider.id, checked)}
              disabled={isToggling}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {t("providers.priority")}: {provider.priority}
          </span>
          <Link
            href={`/providers/${provider.id}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {t("providerDetail.viewDetails")}
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
