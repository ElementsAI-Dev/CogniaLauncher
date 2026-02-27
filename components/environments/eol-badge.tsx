"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ShieldCheck, ShieldAlert, ShieldX, Shield } from "lucide-react";
import { useEol } from "@/hooks/use-eol";

interface EolBadgeProps {
  envType: string;
  version: string | null;
  compact?: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function EolBadge({ envType, version, compact = false, t }: EolBadgeProps) {
  const { eolInfo } = useEol(envType, version);

  if (!eolInfo) return null;

  if (eolInfo.isEol) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="destructive"
            className={compact ? "text-[10px] gap-0.5 h-5 px-1.5" : "text-xs gap-1"}
          >
            <ShieldX className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
            {compact ? "EOL" : t("environments.eol.endOfLife")}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <p className="font-medium">{t("environments.eol.eolWarning")}</p>
            {eolInfo.eol && <p>{t("environments.eol.eolDate")}: {eolInfo.eol}</p>}
            {eolInfo.latest && <p>{t("environments.eol.latestInCycle")}: {eolInfo.latest}</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (eolInfo.eolApproaching) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 bg-yellow-50/50 dark:bg-yellow-950/30 ${compact ? "text-[10px] gap-0.5 h-5 px-1.5" : "text-xs gap-1"}`}
          >
            <ShieldAlert className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
            {compact ? "EOL soon" : t("environments.eol.approaching")}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <p className="font-medium">{t("environments.eol.approachingWarning")}</p>
            {eolInfo.eol && <p>{t("environments.eol.eolDate")}: {eolInfo.eol}</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (eolInfo.lts) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 ${compact ? "text-[10px] gap-0.5 h-5 px-1.5" : "text-xs gap-1"}`}
          >
            <ShieldCheck className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
            {t("environments.eol.lts")}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <p className="font-medium">{t("environments.eol.lts")}</p>
            {eolInfo.lts && <p>LTS: {eolInfo.lts}</p>}
            {eolInfo.support && <p>{t("environments.eol.activeSupport")}: {eolInfo.support}</p>}
            {eolInfo.eol && <p>{t("environments.eol.eolDate")}: {eolInfo.eol}</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={`border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 ${compact ? "text-[10px] gap-0.5 h-5 px-1.5" : "text-xs gap-1"}`}
        >
          <Shield className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
          {t("environments.eol.supported")}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs space-y-1">
          <p className="font-medium">{t("environments.eol.supported")}</p>
          {eolInfo.eol && <p>{t("environments.eol.eolDate")}: {eolInfo.eol}</p>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}