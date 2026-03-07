'use client';

import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { highlightShellConfig } from '@/lib/highlight-shell';
import { applyPairInsert, applyTabIndent, EDITOR_PAIR_MAP } from './keyboard-helpers';
import type { TerminalConfigEditorSurfaceProps } from './types';

export function TerminalConfigEditorHighlighted({
  value,
  language,
  diagnostics = [],
  onChange,
}: TerminalConfigEditorSurfaceProps) {
  const highlighted = useMemo(() => highlightShellConfig(value, language), [value, language]);
  const lineCount = Math.max(1, value.split('\n').length);
  const diagnosticLines = useMemo(
    () =>
      new Set(
        diagnostics
          .map((item) => item.location?.line ?? null)
          .filter((line): line is number => typeof line === 'number' && line > 0),
      ),
    [diagnostics],
  );

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-md border">
        <div className="grid min-h-[260px] grid-cols-[44px,1fr]">
          <div className="border-r bg-muted/30 px-1 py-2 text-right font-mono text-[11px] leading-5 text-muted-foreground">
            {Array.from({ length: lineCount }, (_, index) => {
              const line = index + 1;
              const hasIssue = diagnosticLines.has(line);
              return (
                <div
                  key={line}
                  className={hasIssue ? 'font-semibold text-destructive' : undefined}
                >
                  {line}
                </div>
              );
            })}
          </div>

          <textarea
            data-testid="terminal-config-editor-highlighted"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              const target = event.currentTarget;
              const { selectionStart, selectionEnd } = target;

              if (event.key === 'Tab') {
                event.preventDefault();
                const result = applyTabIndent(value, selectionStart, selectionEnd);
                onChange(result.nextValue);
                requestAnimationFrame(() => {
                  target.setSelectionRange(result.nextStart, result.nextEnd);
                });
                return;
              }

              const pair = EDITOR_PAIR_MAP[event.key];
              if (!pair) {
                return;
              }

              event.preventDefault();
              const result = applyPairInsert(value, selectionStart, selectionEnd, pair[0], pair[1]);
              onChange(result.nextValue);
              requestAnimationFrame(() => {
                target.setSelectionRange(result.nextStart, result.nextEnd);
              });
            }}
            className="min-h-[260px] w-full resize-y border-0 bg-background px-3 py-2 font-mono text-xs leading-5 outline-none"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <div className="border-b bg-muted/40 px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          Highlight Preview
        </div>
        <ScrollArea className="max-h-[260px]">
          <pre className="hljs bg-background p-3 font-mono text-xs leading-5">
            <code dangerouslySetInnerHTML={{ __html: highlighted || '&nbsp;' }} />
          </pre>
        </ScrollArea>
      </div>
    </div>
  );
}
