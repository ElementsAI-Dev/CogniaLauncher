'use client';

import type { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface ToolRuntimeStateProps {
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
}

export function ToolRuntimeState({
  title,
  description,
  actions,
  className,
}: ToolRuntimeStateProps) {
  return (
    <Alert className={className} data-testid="tool-runtime-state">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{description}</p>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </AlertDescription>
    </Alert>
  );
}
