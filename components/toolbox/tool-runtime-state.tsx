'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/components/providers/locale-provider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import type { ToolExecutionError } from '@/types/toolbox';

interface ToolRuntimeStateProps {
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
  progressValue?: number | null;
  progressLabel?: string | null;
  indeterminate?: boolean;
  error?: ToolExecutionError | null;
  onCancel?: () => void;
}

export function ToolRuntimeState({
  title,
  description,
  actions,
  className,
  progressValue = null,
  progressLabel = null,
  indeterminate = false,
  error = null,
  onCancel,
}: ToolRuntimeStateProps) {
  const { t } = useLocale();
  const hasProgress = indeterminate || typeof progressValue === 'number';
  const hasActions = Boolean(actions) || Boolean(onCancel);

  return (
    <Alert className={className} data-testid="tool-runtime-state">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{description}</p>
        {hasProgress ? (
          <div className="space-y-2">
            {progressLabel && progressLabel !== description ? (
              <p className="text-xs font-medium text-foreground">{progressLabel}</p>
            ) : null}
            {indeterminate ? (
              <div
                className="h-2 w-full animate-pulse rounded-full bg-primary/20"
                data-testid="tool-runtime-progress-indeterminate"
              />
            ) : (
              <Progress value={progressValue ?? 0} />
            )}
          </div>
        ) : null}
        {error ? (
          <div className="space-y-2">
            <Badge variant="outline" className="font-mono lowercase">
              {error.kind}
            </Badge>
            <p className="text-xs font-mono text-foreground">{error.message}</p>
          </div>
        ) : null}
        {hasActions ? (
          <div className="flex flex-wrap items-center gap-2">
            {onCancel ? (
              <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                {t('common.cancel')}
              </Button>
            ) : null}
            {actions}
          </div>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
