"use client";

import { useState } from "react";
import { useLocale } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Copy,
  HelpCircle,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useHealthCheck } from "@/hooks/use-health-check";
import type { HealthIssue, HealthStatus, Severity } from "@/lib/tauri";
import { cn } from "@/lib/utils";

interface HealthCheckPanelProps {
  className?: string;
}

export function HealthCheckPanel({ className }: HealthCheckPanelProps) {
  const { t: _t } = useLocale();
  const t = (key: string, params?: Record<string, string | number>) => _t(`environments.healthCheck.${key}`, params);
  const { systemHealth, loading, error, checkAll, getStatusColor } =
    useHealthCheck();
  const [expandedEnvs, setExpandedEnvs] = useState<Set<string>>(new Set());

  const toggleExpanded = (envType: string) => {
    setExpandedEnvs((prev) => {
      const next = new Set(prev);
      if (next.has(envType)) {
        next.delete(envType);
      } else {
        next.add(envType);
      }
      return next;
    });
  };

  const getStatusIcon = (status: HealthStatus) => {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <HelpCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            <CardTitle className="text-lg">{t("title")}</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={checkAll}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {t("runCheck")}
          </Button>
        </div>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!systemHealth && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t("noResults")}</p>
            <p className="text-sm mt-1">{t("clickToCheck")}</p>
          </div>
        )}

        {systemHealth && (
          <div className="space-y-4">
            {/* Overall Status */}
            <div
              className={cn(
                "p-4 rounded-lg border",
                getStatusColor(systemHealth.overall_status),
              )}
            >
              <div className="flex items-center gap-2">
                {getStatusIcon(systemHealth.overall_status)}
                <span className="font-medium">
                  {t(`status.${systemHealth.overall_status}`)}
                </span>
              </div>
              <p className="text-sm mt-1 opacity-80">
                {t("checkedAt", {
                  time: new Date(systemHealth.checked_at).toLocaleTimeString(),
                })}
              </p>
            </div>

            {/* System Issues */}
            {systemHealth.system_issues.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">{t("systemIssues")}</h4>
                {systemHealth.system_issues.map((issue, idx) => (
                  <IssueCard
                    key={idx}
                    issue={issue}
                    onCopy={copyToClipboard}
                    t={t}
                  />
                ))}
              </div>
            )}

            {/* Environment Health */}
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-4">
                {systemHealth.environments.map((env) => (
                  <Collapsible
                    key={env.env_type}
                    open={expandedEnvs.has(env.env_type)}
                    onOpenChange={() => toggleExpanded(env.env_type)}
                  >
                    <CollapsibleTrigger asChild>
                      <div
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors",
                          env.status === "healthy" && "border-green-200",
                          env.status === "warning" && "border-yellow-200",
                          env.status === "error" && "border-red-200",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {getStatusIcon(env.status)}
                          <div>
                            <span className="font-medium capitalize">
                              {env.env_type}
                            </span>
                            {env.provider_id && (
                              <span className="text-xs text-muted-foreground ml-2">
                                ({env.provider_id})
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              env.status === "healthy"
                                ? "default"
                                : env.status === "warning"
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {env.issues.length} {t("issues")}
                          </Badge>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform",
                              expandedEnvs.has(env.env_type) && "rotate-180",
                            )}
                          />
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="pl-4 pt-2 space-y-2">
                        {/* Suggestions */}
                        {env.suggestions.length > 0 && (
                          <div className="space-y-1">
                            {env.suggestions.map((suggestion, idx) => (
                              <p
                                key={idx}
                                className="text-sm text-muted-foreground flex items-start gap-2"
                              >
                                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                                {suggestion}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Issues */}
                        {env.issues.length > 0 && (
                          <div className="space-y-2 mt-2">
                            {env.issues.map((issue, idx) => (
                              <IssueCard
                                key={idx}
                                issue={issue}
                                onCopy={copyToClipboard}
                                t={t}
                              />
                            ))}
                          </div>
                        )}

                        {env.issues.length === 0 &&
                          env.suggestions.length === 0 && (
                            <p className="text-sm text-muted-foreground py-2">
                              {t("noIssues")}
                            </p>
                          )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface IssueCardProps {
  issue: HealthIssue;
  onCopy: (text: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function IssueCard({ issue, onCopy, t }: IssueCardProps) {
  const getAlertVariant = (severity: Severity): "default" | "destructive" => {
    switch (severity) {
      case "critical":
      case "error":
        return "destructive";
      default:
        return "default";
    }
  };

  const getSeverityIcon = (severity: Severity) => {
    switch (severity) {
      case "critical":
      case "error":
        return <AlertCircle className="h-4 w-4" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4" />;
      case "info":
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  return (
    <Alert variant={getAlertVariant(issue.severity)} className="text-sm">
      {getSeverityIcon(issue.severity)}
      <AlertTitle className="text-sm font-medium">{issue.message}</AlertTitle>
      <AlertDescription>
        {issue.details && (
          <p className="text-xs mt-1 opacity-80">{issue.details}</p>
        )}
        {issue.fix_command && (
          <div className="mt-2 flex items-center gap-2">
            <code className="text-xs bg-black/10 px-2 py-1 rounded">
              {issue.fix_command}
            </code>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => onCopy(issue.fix_command!)}
              title={t("copyCommand")}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        )}
        {issue.fix_description && (
          <p className="text-xs mt-1 text-muted-foreground">
            {issue.fix_description}
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
