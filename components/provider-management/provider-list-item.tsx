"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ProviderInfo, ProviderStatusInfo } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { getCapabilityLabel } from "@/lib/constants/provider-capability";
import { useLocale } from "@/components/providers/locale-provider";
import { useProviderStatus } from "@/hooks/providers/use-provider-status";
import { ProviderIcon, PlatformIcon } from "./provider-icon";
import { ProviderStatusBadge } from "./provider-status-badge";
import { ProviderActionsMenu } from "./provider-actions-menu";
import { ProviderToggle } from "./provider-toggle";

export interface ProviderListItemProps {
  provider: ProviderInfo;
  statusInfo?: ProviderStatusInfo;
  isAvailable?: boolean;
  version?: string | null;
  isToggling: boolean;
  detailHref?: string;
  onToggle: (providerId: string, enabled: boolean) => void;
  onCheckStatus: (providerId: string) => Promise<ProviderStatusInfo | boolean>;
}

export function ProviderListItem({
  provider,
  statusInfo,
  isAvailable,
  version,
  isToggling,
  detailHref = `/providers/${provider.id}`,
  onToggle,
  onCheckStatus,
}: ProviderListItemProps) {
  const { t } = useLocale();
  const { isChecking, statusInfo: resolvedStatus, handleCheckStatus } =
    useProviderStatus(provider.id, statusInfo ?? isAvailable, onCheckStatus);

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
        <ProviderStatusBadge status={resolvedStatus} />

        <ProviderToggle
          providerId={provider.id}
          enabled={provider.enabled}
          isToggling={isToggling}
          onToggle={onToggle}
          idSuffix={`list-${provider.id}`}
        />

        <ProviderActionsMenu
          providerId={provider.id}
          detailHref={detailHref}
          isChecking={isChecking}
          onCheckStatus={handleCheckStatus}
          triggerSize="default"
        />
      </div>
    </div>
  );
}
