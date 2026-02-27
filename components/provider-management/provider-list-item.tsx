"use client";

import { writeClipboard } from '@/lib/clipboard';
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Activity,
  ExternalLink,
  MoreHorizontal,
  Copy,
} from "lucide-react";
import type { ProviderInfo } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getCapabilityLabel } from "@/lib/constants/provider-capability";
import { useProviderStatus } from "@/hooks/use-provider-status";
import { ProviderIcon, PlatformIcon } from "./provider-icon";

export interface ProviderListItemProps {
  provider: ProviderInfo;
  isAvailable?: boolean;
  version?: string | null;
  isToggling: boolean;
  onToggle: (providerId: string, enabled: boolean) => void;
  onCheckStatus: (providerId: string) => Promise<boolean>;
  t: (key: string) => string;
}

export function ProviderListItem({
  provider,
  isAvailable,
  version,
  isToggling,
  onToggle,
  onCheckStatus,
  t,
}: ProviderListItemProps) {
  const { isChecking, availabilityStatus, handleCheckStatus } =
    useProviderStatus(provider.id, isAvailable, onCheckStatus);

  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 border rounded-lg transition-all duration-200 hover:bg-muted/50",
        !provider.enabled && "opacity-60",
      )}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <ProviderIcon providerId={provider.id} size={24} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              {provider.display_name}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              ({provider.id})
            </span>
            {version && (
              <Badge variant="secondary" className="text-xs font-mono">
                {version}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {provider.is_environment_provider && (
              <Badge variant="outline" className="text-xs">
                {t("providers.filterEnvironment")}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {t("providers.priority")}: {provider.priority}
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              {provider.platforms.map((p) => (
                <Tooltip key={p}>
                  <TooltipTrigger asChild>
                    <span className="cursor-default"><PlatformIcon platform={p} size={16} /></span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{p}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">
              {provider.capabilities.map((cap) => getCapabilityLabel(cap, t)).join(", ")}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
                writeClipboard(provider.id);
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
  );
}
