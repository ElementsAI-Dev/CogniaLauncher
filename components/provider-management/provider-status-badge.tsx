"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getProviderStatusReason,
  getProviderStatusState,
  getProviderStatusTextKey,
  type ProviderStatusLike,
} from "@/lib/utils/provider";
import { useLocale } from "@/components/providers/locale-provider";

interface ProviderStatusBadgeProps {
  status: ProviderStatusLike;
}

export function ProviderStatusBadge({ status }: ProviderStatusBadgeProps) {
  const { t } = useLocale();
  const state = getProviderStatusState(status);
  const reason = getProviderStatusReason(status);

  if (state === "unknown") {
    return null;
  }

  const badge = (
    <Badge
      variant={state === "available" ? "default" : "destructive"}
      className={cn(
        "text-xs whitespace-nowrap gap-1",
        state === "available" && "bg-green-600 hover:bg-green-700",
      )}
    >
      {state === "available" ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <XCircle className="h-3 w-3" />
      )}
      {t(getProviderStatusTextKey(state))}
    </Badge>
  );

  if (!reason) {
    return badge;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>
        <p>{reason}</p>
      </TooltipContent>
    </Tooltip>
  );
}
