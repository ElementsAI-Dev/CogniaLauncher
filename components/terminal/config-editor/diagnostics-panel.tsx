'use client';

import { AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { TerminalConfigDiagnostic } from '@/types/tauri';
import type { TerminalConfigEditorDiagnosticsPanelProps } from './types';

function formatDiagnosticLocation(diagnostic: TerminalConfigDiagnostic) {
  const line = diagnostic.location?.line;
  const column = diagnostic.location?.column;

  if (typeof line !== 'number') {
    return null;
  }

  return `L${line}${typeof column === 'number' ? `:${column}` : ''}`;
}

export function getDiagnosticSummaryLabel(count: number) {
  return `${count} issue${count === 1 ? '' : 's'} detected`;
}

export function TerminalConfigEditorDiagnosticsPanel({
  diagnostics,
}: TerminalConfigEditorDiagnosticsPanelProps) {
  if (diagnostics.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{getDiagnosticSummaryLabel(diagnostics.length)}</AlertTitle>
        <AlertDescription>
          <p>Review validation details before saving this terminal configuration.</p>
        </AlertDescription>
      </Alert>

      <div className="rounded-md border">
        <ScrollArea className="max-h-[260px]">
          <div className="space-y-2 p-3">
            {diagnostics.map((diagnostic, index) => {
              const location = formatDiagnosticLocation(diagnostic);
              return (
                <div
                  key={`${diagnostic.message}-${index}`}
                  className="rounded-md border border-border/70 bg-muted/20 p-3"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{diagnostic.category}</Badge>
                    {diagnostic.stage && <Badge variant="secondary">{diagnostic.stage}</Badge>}
                    {location && <Badge variant="outline">{location}</Badge>}
                  </div>
                  <p className="text-sm text-foreground">{diagnostic.message}</p>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
