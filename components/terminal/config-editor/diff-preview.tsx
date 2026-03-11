'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLocale } from '@/components/providers/locale-provider';
import type { TerminalConfigEditorDiffPreviewProps } from './types';

export function TerminalConfigEditorDiffPreview({
  baselineValue,
  value,
}: TerminalConfigEditorDiffPreviewProps) {
  const { t } = useLocale();

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('terminal.editorPersistedBaseline')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[220px]">
            <pre className="whitespace-pre-wrap font-mono text-xs leading-5">{baselineValue}</pre>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('terminal.editorPendingDraft')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[220px]">
            <pre className="whitespace-pre-wrap font-mono text-xs leading-5">{value}</pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
