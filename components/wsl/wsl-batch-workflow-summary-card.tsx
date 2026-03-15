'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RotateCcw, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import type { WslBatchWorkflowSummaryCardProps } from '@/types/wsl';

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; badgeClass: string }> = {
  success: {
    icon: CheckCircle2,
    color: 'text-green-600 dark:text-green-400',
    badgeClass: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    badgeClass: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  },
  skipped: {
    icon: MinusCircle,
    color: 'text-amber-600 dark:text-amber-400',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  },
};

export function WslBatchWorkflowSummaryCard({ summary, summaries, onRetry, t }: WslBatchWorkflowSummaryCardProps) {
  const history = useMemo(() => {
    const base = summaries?.length ? summaries : summary ? [summary] : [];
    if (!summary) {
      return base;
    }
    return base.some((entry) => entry.id === summary.id) ? base : [summary, ...base];
  }, [summaries, summary]);

  const [selectedSummaryId, setSelectedSummaryId] = useState<string | null>(summary?.id ?? history[0]?.id ?? null);
  const resolvedSummaryId = history.some((entry) => entry.id === selectedSummaryId)
    ? selectedSummaryId
    : summary?.id ?? history[0]?.id ?? null;
  const activeSummary = history.find((entry) => entry.id === resolvedSummaryId) ?? summary ?? history[0] ?? null;

  if (!activeSummary) {
    return null;
  }

  const total = activeSummary.succeeded + activeSummary.failed + activeSummary.skipped;
  const successPercent = total > 0 ? Math.round((activeSummary.succeeded / total) * 100) : 0;
  const hasRetryableFailures = activeSummary.results.some(
    (result) => result.status === 'failed' && result.retryable
  );

  return (
    <Card data-testid="wsl-batch-workflow-summary">
      <CardHeader className="pb-3">
        <h3 className="text-sm font-semibold">{t('wsl.batchWorkflow.summaryTitle')}</h3>
        <p className="text-xs text-muted-foreground">{activeSummary.workflowName}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {history.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{t('wsl.batchWorkflow.history')}</p>
            <div className="flex flex-wrap gap-2">
              {history.map((entry) => (
                <Button
                  key={entry.id}
                  size="sm"
                  variant={entry.id === activeSummary.id ? 'default' : 'outline'}
                  className="h-7 text-xs"
                  onClick={() => setSelectedSummaryId(entry.id)}
                >
                  {entry.workflowName}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{successPercent}% {t('wsl.batchWorkflow.success').toLowerCase()}</span>
            <span>{activeSummary.succeeded}/{total}</span>
          </div>
          <Progress value={successPercent} className="h-2" />
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
            {t('wsl.batchWorkflow.success')}: {activeSummary.succeeded}
          </Badge>
          <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800">
            {t('wsl.batchWorkflow.failed')}: {activeSummary.failed}
          </Badge>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">
            {t('wsl.batchWorkflow.skipped')}: {activeSummary.skipped}
          </Badge>
        </div>

        {activeSummary.stepResults.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{t('wsl.batchWorkflow.steps')}</p>
            <div className="space-y-2">
              {activeSummary.stepResults.map((stepSummary) => (
                <div key={stepSummary.stepId} className="rounded-md border p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{stepSummary.stepLabel}</p>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                        {stepSummary.succeeded}
                      </Badge>
                      <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800">
                        {stepSummary.failed}
                      </Badge>
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                        {stepSummary.skipped}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {stepSummary.results.map((result) => {
                      const config = statusConfig[result.status] ?? statusConfig.skipped;
                      const Icon = config.icon;
                      return (
                        <div key={`${stepSummary.stepId}-${result.distroName}-${result.status}`} className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex min-w-0 items-center gap-2">
                            <Icon className={`h-3.5 w-3.5 shrink-0 ${config.color}`} />
                            <span className="truncate">{result.distroName}</span>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge variant="outline" className={config.badgeClass}>{result.status}</Badge>
                            {result.detail ? <span className="max-w-40 truncate text-muted-foreground">{result.detail}</span> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <ScrollArea className="max-h-48">
          <div className="space-y-1.5">
            {activeSummary.results.map((result) => {
              const config = statusConfig[result.status] ?? statusConfig.skipped;
              const Icon = config.icon;
              return (
                <div key={`${activeSummary.id}-${result.distroName}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${config.color}`} />
                    <span className="truncate">{result.distroName}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={config.badgeClass}>{result.status}</Badge>
                    {result.detail && <span className="text-xs text-muted-foreground max-w-40 truncate">{result.detail}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {hasRetryableFailures && (
          <Button size="sm" variant="outline" onClick={() => onRetry(activeSummary)} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            {t('wsl.batchWorkflow.retryFailed')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
