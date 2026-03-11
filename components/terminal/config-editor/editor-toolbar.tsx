'use client';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLocale } from '@/components/providers/locale-provider';
import type { TerminalConfigEditorToolbarProps } from './types';

function truncateFingerprint(fingerprint?: string | null) {
  if (!fingerprint) {
    return null;
  }

  if (fingerprint.length <= 12) {
    return fingerprint;
  }

  return `${fingerprint.slice(0, 12)}…`;
}

export function TerminalConfigEditorToolbar({
  configPath,
  fingerprint,
  hasDiagnostics,
  hasPendingChanges,
  language,
  lineCount,
  shellType,
  snapshotPath,
}: TerminalConfigEditorToolbarProps) {
  const { t } = useLocale();
  const shortFingerprint = truncateFingerprint(fingerprint);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {shellType && <Badge variant="secondary">{t('terminal.editorShellBadge', { shellType })}</Badge>}
        <Badge variant="outline">{t('terminal.editorLanguageBadge', { language })}</Badge>
        <Badge variant="outline">{t('terminal.editorLineCount', { count: lineCount })}</Badge>
        {hasDiagnostics && <Badge variant="destructive">{t('terminal.editorViewDiagnostics')}</Badge>}
        {hasPendingChanges && <Badge variant="secondary">{t('terminal.editorUnsavedChanges')}</Badge>}
      </div>

      {(configPath || snapshotPath || shortFingerprint) && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {configPath && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="max-w-full truncate rounded-md border px-2 py-1 font-mono">
                    {configPath}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm break-all font-mono text-xs">
                  {configPath}
                </TooltipContent>
              </Tooltip>
            )}

            {snapshotPath && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="rounded-md border px-2 py-1 font-mono">{t('terminal.editorSnapshotReady')}</span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm break-all font-mono text-xs">
                  {snapshotPath}
                </TooltipContent>
              </Tooltip>
            )}

            {shortFingerprint && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="rounded-md border px-2 py-1 font-mono">{shortFingerprint}</span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm break-all font-mono text-xs">
                  {fingerprint}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <Separator />
        </>
      )}
    </div>
  );
}
