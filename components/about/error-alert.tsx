'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorAlertProps {
  error: string | null;
  onRetry: () => void;
  onDismiss: () => void;
  t: (key: string) => string;
}

export function ErrorAlert({ error, onRetry, onDismiss, t }: ErrorAlertProps) {
  if (!error) {
    return null;
  }

  const getErrorMessage = (errorKey: string): string => {
    switch (errorKey) {
      case 'network_error':
        return t('about.networkError');
      case 'timeout_error':
        return t('about.timeoutError');
      case 'update_check_failed':
        return t('about.updateCheckFailed');
      default:
        return errorKey;
    }
  };

  return (
    <Alert 
      variant="destructive" 
      role="alert" 
      aria-live="assertive"
      className="flex items-center justify-between"
    >
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <AlertDescription>{getErrorMessage(error)}</AlertDescription>
      </div>
      <div className="flex items-center gap-2 ml-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="h-7 px-2 text-destructive-foreground hover:bg-destructive/80"
        >
          <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
          {t('common.retry')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="h-7 px-2 text-destructive-foreground hover:bg-destructive/80"
          aria-label={t('common.close')}
        >
          ×
        </Button>
      </div>
    </Alert>
  );
}
