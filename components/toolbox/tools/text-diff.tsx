'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { ToolTextArea } from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { cn } from '@/lib/utils';
import type { ToolComponentProps } from '@/types/toolbox';

type DiffLine = { type: 'equal' | 'add' | 'remove'; text: string; lineNum: number };

function computeDiff(a: string, b: string): DiffLine[] {
  const linesA = a.split('\n');
  const linesB = b.split('\n');
  const result: DiffLine[] = [];
  const max = Math.max(linesA.length, linesB.length);

  for (let i = 0; i < max; i++) {
    const la = i < linesA.length ? linesA[i] : undefined;
    const lb = i < linesB.length ? linesB[i] : undefined;

    if (la === lb) {
      result.push({ type: 'equal', text: la ?? '', lineNum: i + 1 });
    } else {
      if (la !== undefined) result.push({ type: 'remove', text: la, lineNum: i + 1 });
      if (lb !== undefined) result.push({ type: 'add', text: lb, lineNum: i + 1 });
    }
  }
  return result;
}

export default function TextDiff({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');

  const diff = useMemo(() => {
    if (!textA && !textB) return [];
    return computeDiff(textA, textB);
  }, [textA, textB]);

  const added = diff.filter((d) => d.type === 'add').length;
  const removed = diff.filter((d) => d.type === 'remove').length;

  return (
    <div className={className}>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <ToolTextArea
            label={t('toolbox.tools.textDiff.original')}
            value={textA}
            onChange={setTextA}
            placeholder={t('toolbox.tools.textDiff.originalPlaceholder')}
            showPaste
            showClear
            rows={10}
          />
          <ToolTextArea
            label={t('toolbox.tools.textDiff.modified')}
            value={textB}
            onChange={setTextB}
            placeholder={t('toolbox.tools.textDiff.modifiedPlaceholder')}
            showPaste
            showClear
            rows={10}
          />
        </div>

        {diff.length > 0 && (
          <>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400">
                +{added} {t('toolbox.tools.textDiff.added')}
              </Badge>
              <Badge variant="secondary" className="bg-red-500/10 text-red-600 dark:text-red-400">
                -{removed} {t('toolbox.tools.textDiff.removed')}
              </Badge>
            </div>
            <div className="rounded-md border overflow-auto max-h-80 font-mono text-xs">
              {diff.map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex gap-2 px-3 py-0.5 border-b border-border/30',
                    line.type === 'add' && 'bg-green-500/10',
                    line.type === 'remove' && 'bg-red-500/10',
                  )}
                >
                  <span className="w-8 text-right text-muted-foreground shrink-0 select-none">
                    {line.lineNum}
                  </span>
                  <span className={cn(
                    'w-4 shrink-0 text-center select-none',
                    line.type === 'add' && 'text-green-600',
                    line.type === 'remove' && 'text-red-600',
                  )}>
                    {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                  </span>
                  <span className="whitespace-pre-wrap break-all">{line.text || '\u00A0'}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
