"use client";

import { Button } from "@/components/ui/button";
import { List, Settings2 } from "lucide-react";

interface CardActionsProps {
  onBrowseVersions: () => void;
  onViewDetails: () => void;
  t: (key: string, params?: Record<string, string>) => string;
}

export function CardActions({
  onBrowseVersions,
  onViewDetails,
  t,
}: CardActionsProps) {
  return (
    <div className="flex gap-2 pt-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onBrowseVersions}
        className="flex-1 gap-1"
      >
        <List className="h-4 w-4" />
        {t("environments.browseVersions")}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onViewDetails}
        className="flex-1 gap-1"
      >
        <Settings2 className="h-4 w-4" />
        {t("environments.viewDetails")}
      </Button>
    </div>
  );
}
