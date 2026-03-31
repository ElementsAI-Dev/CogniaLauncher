"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ExternalLink } from "lucide-react";
import type { ProviderInfo, ProviderStatusInfo } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import {
  getCapabilityColor,
  getCapabilityLabel,
} from "@/lib/constants/provider-capability";
import { useLocale } from "@/components/providers/locale-provider";
import { useProviderStatus } from "@/hooks/providers/use-provider-status";
import { ProviderIcon, PlatformIcon } from "./provider-icon";
import { ProviderStatusBadge } from "./provider-status-badge";
import { ProviderActionsMenu } from "./provider-actions-menu";
import { ProviderToggle } from "./provider-toggle";

export interface ProviderCardProps {
  provider: ProviderInfo;
  statusInfo?: ProviderStatusInfo;
  isAvailable?: boolean;
  version?: string | null;
  isToggling: boolean;
  detailHref?: string;
  onToggle: (providerId: string, enabled: boolean) => void;
  onCheckStatus: (providerId: string) => Promise<ProviderStatusInfo | boolean>;
}

export function ProviderCard({
  provider,
  statusInfo,
  isAvailable,
  version,
  isToggling,
  detailHref = `/providers/${provider.id}`,
  onToggle,
  onCheckStatus,
}: ProviderCardProps) {
  const { t } = useLocale();
  const { isChecking, statusInfo: resolvedStatus, handleCheckStatus } =
    useProviderStatus(provider.id, statusInfo ?? isAvailable, onCheckStatus);

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
            <ProviderStatusBadge status={resolvedStatus} />
            <ProviderActionsMenu
              providerId={provider.id}
              detailHref={detailHref}
              isChecking={isChecking}
              onCheckStatus={handleCheckStatus}
              triggerSize="sm"
            />
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
              <Tooltip key={platform}>
                <TooltipTrigger asChild>
                  <span className="text-sm inline-flex items-center gap-1 cursor-default">
                    <PlatformIcon platform={platform} size={16} />
                    <span>{platform}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{platform}</p>
                </TooltipContent>
              </Tooltip>
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
          <ProviderToggle
            providerId={provider.id}
            enabled={provider.enabled}
            isToggling={isToggling}
            onToggle={onToggle}
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
            href={detailHref}
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
