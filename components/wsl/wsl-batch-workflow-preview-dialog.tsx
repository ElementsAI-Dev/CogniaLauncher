'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ListChecks } from 'lucide-react';
import type { WslBatchWorkflowPreviewDialogProps } from '@/types/wsl';

const statusColors: Record<string, string> = {
  runnable: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
  blocked: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  skipped: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  missing: 'bg-muted text-muted-foreground',
};

export function WslBatchWorkflowPreviewDialog({
  open,
  workflowName,
  preview,
  running = false,
  onOpenChange,
  onConfirm,
  t,
}: WslBatchWorkflowPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            {t('wsl.batchWorkflow.previewTitle')}
          </DialogTitle>
          <DialogDescription>{workflowName || t('wsl.batchWorkflow.previewDesc')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 text-sm" data-testid="wsl-batch-workflow-preview">
          <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
            {t('wsl.batchWorkflow.runnable')}: {preview?.runnableCount ?? 0}
          </Badge>
          <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800">
            {t('wsl.batchWorkflow.blocked')}: {preview?.blockedCount ?? 0}
          </Badge>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">
            {t('wsl.batchWorkflow.skipped')}: {preview?.skippedCount ?? 0}
          </Badge>
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            {t('wsl.batchWorkflow.missing')}: {preview?.missingCount ?? 0}
          </Badge>
        </div>

        {preview?.warnings.length ? (
          <Alert>
            <AlertDescription className="space-y-1">
              {preview.warnings.map((warning) => (
                <p key={warning} className="text-xs">{warning}</p>
              ))}
            </AlertDescription>
          </Alert>
        ) : null}

        {preview?.steps.length ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{t('wsl.batchWorkflow.steps')}</p>
            <div className="space-y-1 rounded-md border p-2">
              {preview.steps.map((step, index) => (
                <div key={step.stepId} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{step.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t('wsl.batchWorkflow.stepIndex').replace('{index}', String(index + 1))}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1 shrink-0">
                    {step.longRunning && (
                      <Badge variant="outline">{t('wsl.batchWorkflow.longRunning')}</Badge>
                    )}
                    {step.backupCoverage !== 'not-applicable' && (
                      <Badge variant="outline">{step.backupCoverage}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <ScrollArea className="max-h-64">
          <div className="space-y-1.5 rounded-md border p-2">
            {preview?.targets.map((target) => (
              <div key={target.distroName} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                <span className="font-medium truncate">{target.distroName}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={statusColors[target.status] ?? ''}>
                    {target.status}
                  </Badge>
                  {target.reason && <span className="text-xs text-muted-foreground max-w-45 truncate">{target.reason}</span>}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onConfirm} disabled={running || (preview?.runnableCount ?? 0) === 0} className="gap-2">
            {running && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
