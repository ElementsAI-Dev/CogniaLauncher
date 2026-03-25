"use client";

import { writeClipboard } from "@/lib/clipboard";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Activity, ExternalLink, MoreHorizontal, Copy } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { toast } from "sonner";

interface ProviderActionsMenuProps {
  providerId: string;
  detailHref: string;
  isChecking: boolean;
  onCheckStatus: () => void;
  triggerSize?: "sm" | "default";
}

export function ProviderActionsMenu({
  providerId,
  detailHref,
  isChecking,
  onCheckStatus,
  triggerSize = "sm",
}: ProviderActionsMenuProps) {
  const { t } = useLocale();
  const buttonClass =
    triggerSize === "sm" ? "h-7 w-7 p-0" : "h-8 w-8 p-0";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={buttonClass}>
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">{t("providers.moreActions")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onCheckStatus} disabled={isChecking}>
          <Activity className="h-4 w-4 mr-2" />
          {t("providers.checkStatus")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            writeClipboard(providerId);
            toast.success(t("providers.idCopied"));
          }}
        >
          <Copy className="h-4 w-4 mr-2" />
          {t("providers.copyId")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={detailHref}>
            <ExternalLink className="h-4 w-4 mr-2" />
            {t("providerDetail.viewDetails")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
