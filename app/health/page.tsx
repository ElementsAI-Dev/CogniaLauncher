'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { IssueCard } from '@/components/health/issue-card';
import { useHealthCheck } from '@/hooks/health/use-health-check';
import { useLocale } from '@/components/providers/locale-provider';
import { isTauri } from '@/lib/tauri';
import { writeClipboard } from '@/lib/clipboard';
import { cn } from '@/lib/utils';
import {
  getStatusIcon,
  getStatusColor,
  getStatusTextColor,
} from '@/lib/provider-utils';
import { HEALTH_STATUS_CONFIG } from '@/lib/constants/dashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import {
  AlertCircle,
  ChevronDown,
  ClipboardCopy,
  Info,
  LayoutDashboard,
  Layers,
  Loader2,
  Monitor,
  Package,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { HealthStatus } from '@/types/tauri';

export default function HealthPage() {
  const isDesktop = isTauri();
  const { t: _t } = useLocale();
  const t = (key: string, params?: Record<string, string | number>) =>
    _t(`environments.healthCheck.${key}`, params);

  const {
    systemHealth,
    loading,
    error,
    progress,
    summary,
    activeRemediationId,
    checkAll,
    checkEnvironment,
    previewRemediation,
    applyRemediation,
    clearResults,
  } = useHealthCheck();

  const [expandedEnvs, setExpandedEnvs] = useState<Set<string>>(new Set());
  const hasAutoCheckedRef = useRef(false);

  useEffect(() => {
    if (!isDesktop || hasAutoCheckedRef.current) return;
    hasAutoCheckedRef.current = true;
    checkAll();
  }, [checkAll, isDesktop]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedEnvs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const renderStatusIcon = (status: HealthStatus) => {
    const Icon = getStatusIcon(status);
    return <Icon className={cn('h-4 w-4', getStatusTextColor(status))} />;
  };

  const copyToClipboard = useCallback((text: string) => {
    writeClipboard(text);
  }, []);

  const isEnvvarSystemIssue = useCallback(
    (issue: { check_id?: string | null }) => issue.check_id?.startsWith('envvar_') ?? false,
    [],
  );

  const copyDiagnostics = useCallback(() => {
    if (!systemHealth) return;
    const envvarIssues = systemHealth.envvar_issues ?? [];
    const formatIssue = (prefix: string, index: number, issue: {
      severity: string;
      message: string;
      fix_command: string | null;
      signal_source?: string | null;
      confidence?: string | null;
      check_id?: string | null;
    }) => {
      const evidence = [
        issue.signal_source ? `source=${issue.signal_source}` : null,
        issue.confidence ? `confidence=${issue.confidence}` : null,
        issue.check_id ? `check=${issue.check_id}` : null,
      ].filter(Boolean).join(', ');
      return `  ${prefix} ${index}. [${issue.severity}] ${issue.message}${
        issue.fix_command ? ` (fix: ${issue.fix_command})` : ''
      }${evidence ? ` [${evidence}]` : ''}`;
    };

    const lines = [
      `Overall Status: ${systemHealth.overall_status}`,
      `Checked: ${new Date(systemHealth.checked_at).toLocaleString()}`,
      `Summary: total=${summary.issueCount}, verified=${summary.verifiedIssueCount}, advisory=${summary.advisoryIssueCount}`,
      '',
      `Environments (${systemHealth.environments.length}):`,
      ...systemHealth.environments.map(
        (e) => `  ${e.env_type} (${e.provider_id ?? 'N/A'}): ${e.status} - ${e.issues.length} issues [scope=${e.scope_state ?? 'available'}${e.scope_reason ? `, reason=${e.scope_reason}` : ''}]`,
      ),
      '',
      `System Issues (${systemHealth.system_issues.length}):`,
      ...systemHealth.system_issues.map(
        (issue, idx) => formatIssue('S', idx + 1, issue),
      ),
    ];

    if (envvarIssues.length > 0) {
      lines.push('', `EnvVar Issues (${envvarIssues.length}):`, ...envvarIssues.map(
        (issue, idx) => formatIssue('E', idx + 1, issue),
      ));
    }

    const environmentIssues = systemHealth.environments.flatMap((env) =>
      env.issues.map((issue, idx) => formatIssue(`${env.env_type}#`, idx + 1, issue)),
    );
    if (environmentIssues.length > 0) {
      lines.push('', `Environment Issues (${environmentIssues.length}):`, ...environmentIssues);
    }

    if (systemHealth.package_managers?.length) {
      lines.push(
        '',
        `Package Managers (${systemHealth.package_managers.length}):`,
        ...systemHealth.package_managers.map(
          (pm) => `  ${pm.display_name} (${pm.version ?? 'N/A'}): ${pm.status} - ${pm.issues.length} issues [scope=${pm.scope_state ?? 'available'}${pm.scope_reason ? `, reason=${pm.scope_reason}` : ''}]`,
        ),
      );
      const packageManagerIssues = systemHealth.package_managers.flatMap((pm) =>
        pm.issues.map((issue, idx) => formatIssue(`${pm.provider_id}#`, idx + 1, issue)),
      );
      if (packageManagerIssues.length > 0) {
        lines.push('', `Package Manager Issues (${packageManagerIssues.length}):`, ...packageManagerIssues);
      }
    }
    writeClipboard(lines.join('\n'));
  }, [summary.advisoryIssueCount, summary.issueCount, summary.verifiedIssueCount, systemHealth]);

  // Stats
  const envCount = summary.environmentCount;
  const healthyCount = summary.healthyCount;
  const warningCount = summary.warningCount;
  const errorCount = summary.errorCount;
  const unavailableCount = summary.unavailableCount;
  const overallStatus: HealthStatus = systemHealth?.overall_status ?? 'unknown';
  const overallConfig = HEALTH_STATUS_CONFIG[overallStatus];
  const OverallIcon = overallConfig.icon;
  const envvarIssues = systemHealth?.envvar_issues ?? [];
  const envvarSystemIssues = envvarIssues.length > 0
    ? envvarIssues
    : systemHealth?.system_issues.filter(isEnvvarSystemIssue) ?? [];
  const otherSystemIssues =
    systemHealth?.system_issues.filter((issue) => !isEnvvarSystemIssue(issue)) ?? [];

  if (!isDesktop) {
    return (
      <div className="p-4 md:p-6">
        <PageHeader
          title={t('title')}
          description={t('description')}
        />
        <Empty className="border-none py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Monitor />
            </EmptyMedia>
            <EmptyTitle>{_t('environments.desktopOnly')}</EmptyTitle>
            <EmptyDescription>{_t('environments.desktopOnlyDescription')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <div className="flex items-center gap-2">
            {systemHealth && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyDiagnostics}
                  className="gap-2"
                >
                  <ClipboardCopy className="h-4 w-4" />
                  {t('exportDiagnostics')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearResults}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('clearResults')}
                </Button>
              </>
            )}
            <Button
              size="sm"
              onClick={() => checkAll({ force: true })}
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {t('runCheck')}
            </Button>
          </div>
        }
      />

      {/* Progress */}
      {loading && progress && (
        <Card>
          <CardContent className="py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t('progressMessage', {
                    current: progress.currentProvider,
                    completed: progress.completed,
                    total: progress.total,
                  })}
                </span>
                <span className="font-mono text-xs">
                  {progress.completed}/{progress.total}
                </span>
              </div>
              <Progress
                value={progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* No Results */}
      {!systemHealth && !loading && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>{t('noResults')}</p>
              <p className="text-sm mt-1">{t('clickToCheck')}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {systemHealth && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview" className="gap-1.5">
              <LayoutDashboard className="h-3.5 w-3.5" />
              {t('tabOverview')}
            </TabsTrigger>
            <TabsTrigger value="environments" className="gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              {t('tabEnvironments')}
              {envCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {envCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="package-managers" className="gap-1.5">
              <Package className="h-3.5 w-3.5" />
              {t('tabPackageManagers')}
              {(systemHealth.package_managers?.length ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {systemHealth.package_managers.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ===== Overview Tab ===== */}
          <TabsContent value="overview" className="space-y-4">
            {/* Overall Status Banner */}
            <div
              className={cn(
                'p-4 rounded-lg border',
                getStatusColor(systemHealth.overall_status),
              )}
            >
              <div className="flex items-center gap-3">
                <OverallIcon className={cn('h-6 w-6', overallConfig.color)} />
                <div>
                  <span className="font-medium text-lg">
                    {t(`status.${systemHealth.overall_status}`)}
                  </span>
                  <p className="text-sm mt-0.5 opacity-80">
                    {t('checkedAt', {
                      time: new Date(systemHealth.checked_at).toLocaleTimeString(),
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            {envCount > 0 && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-3xl font-bold text-green-600">{healthyCount}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {t('status.healthy')}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-3xl font-bold text-yellow-600">{warningCount}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {t('status.warning')}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-3xl font-bold text-red-600">{errorCount}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {t('status.error')}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-3xl font-bold text-slate-600">{unavailableCount}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {t('status.unknown')}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* System Issues */}
            {envvarSystemIssues.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t('envvarIssues')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {envvarSystemIssues.map((issue, idx) => (
                    <IssueCard
                      key={`envvar-${idx}`}
                      issue={issue}
                      onCopy={copyToClipboard}
                      onPreviewRemediation={previewRemediation}
                      onApplyRemediation={applyRemediation}
                      activeRemediationId={activeRemediationId}
                      t={t}
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {otherSystemIssues.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t('systemIssues')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {otherSystemIssues.map((issue, idx) => (
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
                </CardContent>
              </Card>
            )}

            {envvarSystemIssues.length === 0 && otherSystemIssues.length === 0 && envCount === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {t('noIssues')}
              </div>
            )}
          </TabsContent>

          {/* ===== Environments Tab ===== */}
          <TabsContent value="environments" className="space-y-4">
            {systemHealth.environments.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  {t('noResults')}
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="h-[calc(100vh-320px)]">
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
                            'flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors',
                            env.status === 'healthy' && 'border-green-200 dark:border-green-800',
                            env.status === 'warning' && 'border-yellow-200 dark:border-yellow-800',
                            env.status === 'error' && 'border-red-200 dark:border-red-800',
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
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                checkEnvironment(env.env_type);
                              }}
                              disabled={loading}
                            >
                              <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
                            </Button>
                            <Badge
                              variant={
                                env.status === 'healthy'
                                  ? 'default'
                                  : env.status === 'error'
                                    ? 'destructive'
                                    : 'secondary'
                              }
                            >
                              {env.issues.filter((i) => i.severity !== 'info' && i.confidence !== 'inferred').length} {t('issues')}
                            </Badge>
                            <ChevronDown
                              className={cn(
                                'h-4 w-4 transition-transform',
                                expandedEnvs.has(env.env_type) && 'rotate-180',
                              )}
                            />
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="pl-4 pt-2 space-y-2">
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

                          {env.issues.length === 0 && env.suggestions.length === 0 && (
                            <p className="text-sm text-muted-foreground py-2">
                              {t('noIssues')}
                            </p>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* ===== Package Managers Tab ===== */}
          <TabsContent value="package-managers" className="space-y-4">
            {(!systemHealth.package_managers || systemHealth.package_managers.length === 0) ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  {t('packageManagers.noManagers')}
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="h-[calc(100vh-320px)]">
                <div className="space-y-2 pr-4">
                  {systemHealth.package_managers.map((pm) => (
                    <Collapsible
                      key={pm.provider_id}
                      open={expandedEnvs.has(`pm-${pm.provider_id}`)}
                      onOpenChange={() => toggleExpanded(`pm-${pm.provider_id}`)}
                    >
                      <CollapsibleTrigger asChild>
                        <div
                          className={cn(
                            'flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors',
                            pm.status === 'healthy' && 'border-green-200 dark:border-green-800',
                            pm.status === 'warning' && 'border-yellow-200 dark:border-yellow-800',
                            pm.status === 'error' && 'border-red-200 dark:border-red-800',
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
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                pm.status === 'healthy'
                                  ? 'default'
                                  : pm.status === 'error'
                                    ? 'destructive'
                                    : 'secondary'
                              }
                            >
                              {pm.issues.filter((i) => i.severity !== 'info' && i.confidence !== 'inferred').length} {t('issues')}
                            </Badge>
                            <ChevronDown
                              className={cn(
                                'h-4 w-4 transition-transform',
                                expandedEnvs.has(`pm-${pm.provider_id}`) && 'rotate-180',
                              )}
                            />
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="pl-4 pt-2 space-y-2">
                          {/* PM Details */}
                          {(pm.executable_path || pm.install_instructions) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                              {pm.executable_path && (
                                <div className="text-xs p-2 rounded border bg-muted/30">
                                  <span className="text-muted-foreground">{t('packageManagers.path')}:</span>{' '}
                                  <code className="font-mono">{pm.executable_path}</code>
                                </div>
                              )}
                              {pm.install_instructions && (
                                <div className="text-xs p-2 rounded border bg-muted/30">
                                  <span className="text-muted-foreground">{t('packageManagers.installInstructions')}:</span>{' '}
                                  <code className="font-mono">{pm.install_instructions}</code>
                                </div>
                              )}
                            </div>
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
                              {t('noIssues')}
                            </p>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
