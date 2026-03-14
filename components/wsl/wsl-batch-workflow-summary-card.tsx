'use client';

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

export function WslBatchWorkflowSummaryCard({ summary, onRetry, t }: WslBatchWorkflowSummaryCardProps) {
  if (!summary) {
    return null;
  }

  const total = summary.succeeded + summary.failed + summary.skipped;
  const successPercent = total > 0 ? Math.round((summary.succeeded / total) * 100) : 0;

  const hasRetryableFailures = summary.results.some(
    (result) => result.status === 'failed' && result.retryable
  );

  return (
    <Card data-testid="wsl-batch-workflow-summary">
      <CardHeader className="pb-3">
        <h3 className="text-sm font-semibold">{t('wsl.batchWorkflow.summaryTitle')}</h3>
        <p className="text-xs text-muted-foreground">{summary.workflowName}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{successPercent}% {t('wsl.batchWorkflow.success').toLowerCase()}</span>
            <span>{summary.succeeded}/{total}</span>
          </div>
          <Progress value={successPercent} className="h-2" />
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
            {t('wsl.batchWorkflow.success')}: {summary.succeeded}
          </Badge>
          <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800">
            {t('wsl.batchWorkflow.failed')}: {summary.failed}
          </Badge>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">
            {t('wsl.batchWorkflow.skipped')}: {summary.skipped}
          </Badge>
        </div>

        <ScrollArea className="max-h-48">
          <div className="space-y-1.5">
            {summary.results.map((result) => {
              const config = statusConfig[result.status] ?? statusConfig.skipped;
              const Icon = config.icon;
              return (
                <div key={`${summary.id}-${result.distroName}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
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
          <Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            {t('wsl.batchWorkflow.retryFailed')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
