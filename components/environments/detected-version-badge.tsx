"use client";

import { Badge } from "@/components/ui/badge";
import { Scan, AlertTriangle } from "lucide-react";
import {
  formatDetectionSource,
  isDetectedVersionCompatible,
} from "@/lib/environment-detection";

interface DetectedVersionBadgeProps {
  version: string;
  source: string;
  sourceType?: string;
  currentVersion?: string | null;
  t: (key: string, params?: Record<string, string | number>) => string;
  compact?: boolean;
}

export function DetectedVersionBadge({
  version,
  source,
  sourceType,
  currentVersion,
  t,
  compact = false,
}: DetectedVersionBadgeProps) {
  const formattedSource = formatDetectionSource(source, sourceType);
  const isMismatch =
    currentVersion != null &&
    !isDetectedVersionCompatible(currentVersion, version);

  if (compact) {
    return (
      <Badge
        variant="outline"
        className={
          isMismatch
            ? "gap-1.5 bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300"
            : "gap-1.5 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
        }
      >
        {isMismatch && <AlertTriangle className="h-3 w-3" />}
        {t("environments.detected")}: {version}
      </Badge>
    );
  }

  return (
    <div className="space-y-1">
      <Badge
        variant="outline"
        className={
          isMismatch
            ? "gap-1.5 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300"
            : "gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
        }
      >
        {isMismatch ? (
          <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
        ) : (
          <Scan className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
        )}
        {t("environments.detected")}: {version} ({formattedSource})
      </Badge>
      {isMismatch && (
        <p className="text-xs text-yellow-600 dark:text-yellow-400">
          {t("environments.versionMismatch", { detected: version, current: currentVersion })}
        </p>
      )}
    </div>
  );
}
