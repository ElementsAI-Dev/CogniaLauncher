"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight,
  RefreshCw,
  Download,
  ArrowLeft,
} from "lucide-react";
import { LANGUAGES } from "@/lib/constants/environments";
import type { EnvironmentInfo, DetectedEnvironment } from "@/lib/tauri";

interface EnvDetailHeaderProps {
  envType: string;
  env: EnvironmentInfo | null;
  detectedVersion: DetectedEnvironment | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  onOpenVersionBrowser: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function EnvDetailHeader({
  envType,
  env,
  detectedVersion,
  isRefreshing,
  onRefresh,
  onOpenVersionBrowser,
  t,
}: EnvDetailHeaderProps) {
  const langInfo = LANGUAGES.find((l) => l.id === envType);
  const displayName = langInfo?.name || envType;
  const icon = langInfo?.icon || "📦";

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href="/environments"
          className="hover:text-foreground transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("environments.title")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{displayName}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-2xl">
            {icon}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold md:text-3xl">{displayName}</h1>
              {env?.available ? (
                <Badge variant="default" className="text-xs">
                  {t("environments.available")}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  {t("environments.notInstalled")}
                </Badge>
              )}
              {detectedVersion && (
                <Badge
                  variant="outline"
                  className="gap-1.5 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
                >
                  {t("environments.detected")}: {detectedVersion.version}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {env
                ? t("environments.details.subtitle", { provider: env.provider })
                : t("environments.detail.notConfigured")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            {t("environments.refresh")}
          </Button>
          {env?.available && (
            <Button size="sm" onClick={onOpenVersionBrowser} className="gap-2">
              <Download className="h-4 w-4" />
              {t("environments.installNewVersion")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
