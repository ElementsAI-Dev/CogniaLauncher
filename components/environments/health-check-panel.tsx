"use client";

import { useState } from "react";
import { writeClipboard } from '@/lib/clipboard';
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertCircle,
  ChevronDown,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useHealthCheck } from "@/hooks/use-health-check";
import type { HealthStatus } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import {
  getScopeStateLabel,
  getStatusIcon,
  getStatusColor,
  getStatusTextColor,
} from "@/lib/provider-utils";
import { IssueCard } from "@/components/health/issue-card";

export { IssueCard } from "@/components/health/issue-card";

interface HealthCheckPanelProps {
  className?: string;
}

export function HealthCheckPanel({ className }: HealthCheckPanelProps) {
  const { t: _t } = useLocale();
  const t = (key: string, params?: Record<string, string | number>) => _t(`environments.healthCheck.${key}`, params);
  const {
    systemHealth,
    loading,
    error,
    activeRemediationId,
    checkAll,
    previewRemediation,
    applyRemediation,
  } =
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

  const renderStatusIcon = (status: HealthStatus) => {
    const Icon = getStatusIcon(status);
    return <Icon className={cn("h-4 w-4", getStatusTextColor(status))} />;
  };

  const copyToClipboard = (text: string) => {
    writeClipboard(text);
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
            onClick={() => {
              void checkAll();
            }}
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
                {renderStatusIcon(systemHealth.overall_status)}
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
                    onPreviewRemediation={previewRemediation}
                    onApplyRemediation={applyRemediation}
                    activeRemediationId={activeRemediationId}
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
                          {renderStatusIcon(env.status)}
                          <div>
                            <span className="font-medium capitalize">
                              {env.env_type}
                            </span>
                            {env.provider_id && (
                              <span className="text-xs text-muted-foreground ml-2">
                                ({env.provider_id})
                              </span>
                            )}
                            {(env.scope_state ?? "available") !== "available" && (
                              <Badge variant="outline" className="ml-2">
                                {getScopeStateLabel(env.scope_state)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              env.status === "healthy"
                                ? "default"
                                : env.status === "error"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {env.issues.filter(i => i.severity !== 'info').length} {t("issues")}
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
                        {(env.scope_state ?? "available") !== "available" && (
                          <p className="text-xs text-muted-foreground">
                            Scope: {getScopeStateLabel(env.scope_state)}
                            {env.scope_reason ? ` (${env.scope_reason})` : ""}
                          </p>
                        )}
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
                                onPreviewRemediation={previewRemediation}
                                onApplyRemediation={applyRemediation}
                                activeRemediationId={activeRemediationId}
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

            {/* Package Managers */}
            {systemHealth.package_managers && systemHealth.package_managers.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">{t("packageManagers.title")}</h4>
                <div className="space-y-2">
                  {systemHealth.package_managers.map((pm) => (
                    <Collapsible
                      key={pm.provider_id}
                      open={expandedEnvs.has(`pm-${pm.provider_id}`)}
                      onOpenChange={() => toggleExpanded(`pm-${pm.provider_id}`)}
                    >
                      <CollapsibleTrigger asChild>
                        <div
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors",
                            pm.status === "healthy" && "border-green-200",
                            pm.status === "warning" && "border-yellow-200",
                            pm.status === "error" && "border-red-200",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {renderStatusIcon(pm.status)}
                            <div>
                              <span className="font-medium">
                                {pm.display_name}
                              </span>
                              {pm.version && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  v{pm.version}
                                </span>
                              )}
                              {(pm.scope_state ?? "available") !== "available" && (
                                <Badge variant="outline" className="ml-2">
                                  {getScopeStateLabel(pm.scope_state)}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                pm.status === "healthy"
                                  ? "default"
                                  : pm.status === "error"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {pm.issues.filter(i => i.severity !== 'info').length} {t("issues")}
                            </Badge>
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 transition-transform",
                                expandedEnvs.has(`pm-${pm.provider_id}`) && "rotate-180",
                              )}
                            />
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="pl-4 pt-2 space-y-2">
                          {(pm.scope_state ?? "available") !== "available" && (
                            <p className="text-xs text-muted-foreground">
                              Scope: {getScopeStateLabel(pm.scope_state)}
                              {pm.scope_reason ? ` (${pm.scope_reason})` : ""}
                            </p>
                          )}
                          {pm.issues.length > 0 && (
                            <div className="space-y-2">
                              {pm.issues.map((issue, idx) => (
                                <IssueCard
                                  key={idx}
                                  issue={issue}
                                  onCopy={copyToClipboard}
                                  onPreviewRemediation={previewRemediation}
                                  onApplyRemediation={applyRemediation}
                                  activeRemediationId={activeRemediationId}
                                  t={t}
                                />
                              ))}
                            </div>
                          )}

                          {pm.issues.length === 0 && (
                            <p className="text-sm text-muted-foreground py-2">
                              {t("noIssues")}
                            </p>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
