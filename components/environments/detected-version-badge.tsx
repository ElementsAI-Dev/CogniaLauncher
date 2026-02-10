"use client";

import { Badge } from "@/components/ui/badge";
import { Scan } from "lucide-react";

interface DetectedVersionBadgeProps {
  version: string;
  source: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  compact?: boolean;
}

export function DetectedVersionBadge({
  version,
  source,
  t,
  compact = false,
}: DetectedVersionBadgeProps) {
  const formattedSource = source.replace("_", " ");

  if (compact) {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
      >
        {t("environments.detected")}: {version}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
    >
      <Scan className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
      {t("environments.detected")}: {version} ({formattedSource})
    </Badge>
  );
}
