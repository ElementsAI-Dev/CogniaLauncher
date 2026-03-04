'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ToolActionRow, ToolTextArea, ToolValidationMessage } from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { cn } from '@/lib/utils';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';
import { useToolPreferences } from '@/hooks/use-tool-preferences';
import type { ToolComponentProps } from '@/types/toolbox';

type DiffLine = { type: 'equal' | 'add' | 'remove'; text: string; lineNum: number };

const DEFAULT_PREFERENCES = {
  ignoreWhitespace: false,
  ignoreCase: false,
} as const;

function normalizeLine(line: string, ignoreWhitespace: boolean, ignoreCase: boolean): string {
  let value = line;
  if (ignoreWhitespace) value = value.trim().replace(/\s+/g, ' ');
  if (ignoreCase) value = value.toLowerCase();
  return value;
}

function computeDiff(a: string, b: string, ignoreWhitespace: boolean, ignoreCase: boolean): DiffLine[] {
  const linesA = a.split('\n');
  const linesB = b.split('\n');
  const result: DiffLine[] = [];
  const max = Math.max(linesA.length, linesB.length);

  for (let i = 0; i < max; i++) {
    const la = i < linesA.length ? linesA[i] : undefined;
    const lb = i < linesB.length ? linesB[i] : undefined;

    const normalizedA = la === undefined ? undefined : normalizeLine(la, ignoreWhitespace, ignoreCase);
    const normalizedB = lb === undefined ? undefined : normalizeLine(lb, ignoreWhitespace, ignoreCase);

    if (normalizedA === normalizedB) {
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
  const { preferences, setPreferences } = useToolPreferences('text-diff', DEFAULT_PREFERENCES);
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');

  const guardrailError = useMemo(() => {
    if (textA.length > TOOLBOX_LIMITS.diffCharsPerInput || textB.length > TOOLBOX_LIMITS.diffCharsPerInput) {
      return t('toolbox.tools.shared.inputTooLarge', {
        limit: TOOLBOX_LIMITS.diffCharsPerInput.toLocaleString(),
      });
    }
    if (textA.split('\n').length > TOOLBOX_LIMITS.diffLines || textB.split('\n').length > TOOLBOX_LIMITS.diffLines) {
      return t('toolbox.tools.textDiff.tooManyLines', { limit: TOOLBOX_LIMITS.diffLines });
    }
    return null;
  }, [t, textA, textB]);

  const diff = useMemo(() => {
    if (!textA && !textB) return [];
    if (guardrailError) return [];
    return computeDiff(textA, textB, preferences.ignoreWhitespace, preferences.ignoreCase);
  }, [guardrailError, preferences.ignoreCase, preferences.ignoreWhitespace, textA, textB]);

  const added = diff.filter((d) => d.type === 'add').length;
  const removed = diff.filter((d) => d.type === 'remove').length;
  const unchanged = diff.filter((d) => d.type === 'equal').length;
  const totalCompared = added + removed + unchanged;

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

        <ToolActionRow
          rightSlot={(
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="diff-ignore-whitespace"
                  checked={preferences.ignoreWhitespace}
                  onCheckedChange={(checked) => setPreferences({ ignoreWhitespace: checked })}
                />
                <Label htmlFor="diff-ignore-whitespace" className="text-xs">{t('toolbox.tools.textDiff.ignoreWhitespace')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="diff-ignore-case"
                  checked={preferences.ignoreCase}
                  onCheckedChange={(checked) => setPreferences({ ignoreCase: checked })}
                />
                <Label htmlFor="diff-ignore-case" className="text-xs">{t('toolbox.tools.textDiff.ignoreCase')}</Label>
              </div>
            </div>
          )}
        />

        {guardrailError && <ToolValidationMessage message={guardrailError} />}

        {diff.length > 0 && (
          <>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400">
                +{added} {t('toolbox.tools.textDiff.added')}
              </Badge>
              <Badge variant="secondary" className="bg-red-500/10 text-red-600 dark:text-red-400">
                -{removed} {t('toolbox.tools.textDiff.removed')}
              </Badge>
              <Badge variant="outline" className="text-xs">
                ={unchanged} {t('toolbox.tools.textDiff.unchanged')}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {t('toolbox.tools.textDiff.total', { count: totalCompared })}
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
