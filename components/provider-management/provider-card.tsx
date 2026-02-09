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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, CheckCircle2, XCircle, Activity, ExternalLink, MoreHorizontal, Copy } from "lucide-react";
import type { ProviderInfo } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getCapabilityColor,
  getCapabilityLabel,
} from "./provider-icons";
import { ProviderIcon, PlatformIcon } from "./provider-icon";

export interface ProviderCardProps {
  provider: ProviderInfo;
  isAvailable?: boolean;
  version?: string | null;
  isToggling: boolean;
  onToggle: (providerId: string, enabled: boolean) => void;
  onCheckStatus: (providerId: string) => Promise<boolean>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function ProviderCard({
  provider,
  isAvailable,
  version,
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
            <ProviderIcon providerId={provider.id} size={32} />
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">{t("providers.moreActions")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleCheckStatus} disabled={isChecking}>
                  <Activity className="h-4 w-4 mr-2" />
                  {t("providers.checkStatus")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    navigator.clipboard.writeText(provider.id);
                    toast.success(t("providers.idCopied"));
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {t("providers.copyId")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/providers/${provider.id}`}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {t("providerDetail.viewDetails")}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                <PlatformIcon platform={platform} size={16} />
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
                {getCapabilityLabel(cap, t)}
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
          <Switch
            id={`enabled-${provider.id}`}
            checked={provider.enabled}
            onCheckedChange={(checked) => onToggle(provider.id, checked)}
            disabled={isToggling}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>
              {t("providers.priority")}: {provider.priority}
            </span>
            {version && (
              <>
                <span>·</span>
                <span className="font-mono">{version}</span>
              </>
            )}
          </div>
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
