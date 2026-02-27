"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Layers,
  ChevronRight,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { LanguageIcon, ProviderIcon } from "@/components/provider-management/provider-icon";
import { useLocale } from "@/components/providers/locale-provider";
import { cn } from "@/lib/utils";
import type { EnvironmentInfo } from "@/lib/tauri";
import type { EnvironmentFilterType } from "@/types/dashboard";

interface EnvironmentListProps {
  environments: EnvironmentInfo[];
  className?: string;
  initialLimit?: number;
}

export function EnvironmentList({
  environments,
  className,
  initialLimit = 4,
}: EnvironmentListProps) {
  const router = useRouter();
  const { t } = useLocale();

  const [filter, setFilter] = useState<EnvironmentFilterType>("available");
  const [expanded, setExpanded] = useState(false);

  const filteredEnvironments = useMemo(() => {
    switch (filter) {
      case "available":
        return environments.filter((env) => env.available);
      case "unavailable":
        return environments.filter((env) => !env.available);
      default:
        return environments;
    }
  }, [environments, filter]);

  const hasMore = filteredEnvironments.length > initialLimit;

  const handleEnvironmentClick = useCallback(
    (envType: string) => {
      router.push(`/environments?selected=${encodeURIComponent(envType)}`);
    },
    [router],
  );

  const handleViewAll = useCallback(() => {
    router.push("/environments");
  }, [router]);

  const initialItems = filteredEnvironments.slice(0, initialLimit);
  const extraItems = filteredEnvironments.slice(initialLimit);

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          {t("dashboard.environmentList.title")}
        </CardTitle>
        <CardDescription>
          {t("dashboard.activeEnvironmentsDesc")}
        </CardDescription>
        <CardAction>
          <div className="flex items-center gap-2">
            <Select
              value={filter}
              onValueChange={(v) => setFilter(v as EnvironmentFilterType)}
            >
              <SelectTrigger className="h-8 w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("dashboard.environmentList.all")}
                </SelectItem>
                <SelectItem value="available">
                  {t("dashboard.environmentList.available")}
                </SelectItem>
                <SelectItem value="unavailable">
                  {t("dashboard.environmentList.unavailable")}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleViewAll}
              className="gap-1"
            >
              {t("dashboard.packageList.viewAll")}
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        {filteredEnvironments.length === 0 ? (
          <div className="py-6 text-center">
            <Layers className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              {filter === "all"
                ? t("dashboard.noEnvironments")
                : t("dashboard.environmentList.noResults")}
            </p>
          </div>
        ) : (
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <div className="space-y-2">
              {initialItems.map((env) => (
                <EnvironmentItem
                  key={env.env_type}
                  environment={env}
                  onClick={() => handleEnvironmentClick(env.env_type)}
                  t={t}
                />
              ))}
            </div>

            {hasMore && (
              <>
                <CollapsibleContent>
                  <div className="space-y-2 mt-2">
                    {extraItems.map((env) => (
                      <EnvironmentItem
                        key={env.env_type}
                        environment={env}
                        onClick={() => handleEnvironmentClick(env.env_type)}
                        t={t}
                      />
                    ))}
                  </div>
                </CollapsibleContent>

                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 w-full gap-1"
                  >
                    {expanded ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        {t("dashboard.environmentList.showLess")}
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        {t("dashboard.environmentList.showMore")}
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
              </>
            )}
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

interface EnvironmentItemProps {
  environment: EnvironmentInfo;
  onClick: () => void;
  t: (key: string) => string;
}

function EnvironmentItem({ environment, onClick, t }: EnvironmentItemProps) {
  const { env_type, provider, current_version, available, installed_versions } =
    environment;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-lg border p-3",
        "transition-colors hover:bg-accent/50",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            available
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          <LanguageIcon languageId={env_type} size={24} />
        </div>
        <div className="text-left min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{env_type}</span>
            {available ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ProviderIcon providerId={provider} size={14} />
            <span>{provider}</span>
            {installed_versions.length > 0 && (
              <>
                <span>•</span>
                <span>
                  {installed_versions.length}{" "}
                  {t("environments.details.versions")}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {current_version ? (
          <Badge
            variant="secondary"
            className="font-mono text-xs max-w-[140px] truncate"
          >
            {current_version}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">
            {t("common.none")}
          </span>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );
}
