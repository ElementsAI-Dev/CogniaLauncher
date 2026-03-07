'use client';

import { useState, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ToolActionRow, ToolValidationMessage } from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolPreferences } from '@/hooks/use-tool-preferences';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';
import type { ToolComponentProps } from '@/types/toolbox';

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

const CRON_FIELDS = [
  { id: 'minute', labelKey: 'toolbox.tools.cronParser.fields.minute' },
  { id: 'hour', labelKey: 'toolbox.tools.cronParser.fields.hour' },
  { id: 'dayOfMonth', labelKey: 'toolbox.tools.cronParser.fields.dayOfMonth' },
  { id: 'month', labelKey: 'toolbox.tools.cronParser.fields.month' },
  { id: 'dayOfWeek', labelKey: 'toolbox.tools.cronParser.fields.dayOfWeek' },
] as const;

const PRESETS = [
  { labelKey: 'toolbox.tools.cronParser.presets.everyMinute', cron: '* * * * *' },
  { labelKey: 'toolbox.tools.cronParser.presets.everyHour', cron: '0 * * * *' },
  { labelKey: 'toolbox.tools.cronParser.presets.everyDayMidnight', cron: '0 0 * * *' },
  { labelKey: 'toolbox.tools.cronParser.presets.everyMondayNine', cron: '0 9 * * 1' },
  { labelKey: 'toolbox.tools.cronParser.presets.everyFiveMinutes', cron: '*/5 * * * *' },
  { labelKey: 'toolbox.tools.cronParser.presets.everyDayNoon', cron: '0 12 * * *' },
  { labelKey: 'toolbox.tools.cronParser.presets.firstDayOfMonth', cron: '0 0 1 * *' },
  { labelKey: 'toolbox.tools.cronParser.presets.weekdaysEight', cron: '0 8 * * 1-5' },
];

function describeCronField(value: string, fieldLabel: string, t: TranslateFn): string {
  if (value === '*') {
    return t('toolbox.tools.cronParser.describe.everyField', { field: fieldLabel });
  }
  if (value.startsWith('*/')) {
    return t('toolbox.tools.cronParser.describe.everyStepField', {
      step: value.slice(2),
      field: fieldLabel,
    });
  }
  return t('toolbox.tools.cronParser.describe.fieldValue', {
    field: fieldLabel,
    value,
  });
}

function describeCron(expression: string, t: TranslateFn): string {
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5) return t('toolbox.tools.cronParser.invalidDescription');
  return CRON_FIELDS.map((field, index) => (
    describeCronField(parts[index] ?? '*', t(field.labelKey), t)
  )).join(', ');
}

function getNextRuns(
  expression: string,
  count: number,
  maxIterations: number,
): { runs: Date[]; exhausted: boolean } {
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5) return { runs: [], exhausted: false };

  const results: Date[] = [];
  const now = new Date();
  const check = new Date(now);
  check.setSeconds(0, 0);
  check.setMinutes(check.getMinutes() + 1);

  let iterations = 0;

  while (results.length < count && iterations < maxIterations) {
    if (matchesCron(check, parts)) {
      results.push(new Date(check));
    }
    check.setMinutes(check.getMinutes() + 1);
    iterations++;
  }
  return {
    runs: results,
    exhausted: results.length < count && iterations >= maxIterations,
  };
}

function matchesCron(date: Date, parts: string[]): boolean {
  return (
    matchesField(date.getMinutes(), parts[0]) &&
    matchesField(date.getHours(), parts[1]) &&
    matchesField(date.getDate(), parts[2]) &&
    matchesField(date.getMonth() + 1, parts[3]) &&
    matchesField(date.getDay(), parts[4])
  );
}

function matchesField(value: number, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern.startsWith('*/')) {
    const step = parseInt(pattern.slice(2), 10);
    return !isNaN(step) && step > 0 && value % step === 0;
  }
  return pattern.split(',').some((part) => {
    if (part.includes('-')) {
      const [lo, hi] = part.split('-').map(Number);
      return value >= lo && value <= hi;
    }
    return Number(part) === value;
  });
}

const DEFAULT_PREFERENCES = {
  expression: '0 * * * *',
  previewCount: 5,
} as const;

export default function CronParser({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const { preferences, setPreferences } = useToolPreferences('cron-parser', DEFAULT_PREFERENCES);
  const [expression, setExpression] = useState(preferences.expression);
  const [nextRuns, setNextRuns] = useState<Date[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardrailMessage, setGuardrailMessage] = useState<string | null>(null);
  const previewCount = Math.max(
    1,
    Math.min(TOOLBOX_LIMITS.cronPreviewCount, Number(preferences.previewCount) || 5),
  );

  const description = useMemo(() => describeCron(expression, t), [expression, t]);

  const handleParse = useCallback(() => {
    if (expression.length > TOOLBOX_LIMITS.cronExpressionChars) {
      setError(
        t('toolbox.tools.shared.inputTooLarge', {
          limit: TOOLBOX_LIMITS.cronExpressionChars.toLocaleString(),
        }),
      );
      setNextRuns([]);
      return;
    }

    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) {
      setError(t('toolbox.tools.cronParser.invalidExpression'));
      setNextRuns([]);
      return;
    }

    setError(null);
    const result = getNextRuns(expression, previewCount, 525600);
    setNextRuns(result.runs);
    setGuardrailMessage(
      result.exhausted
        ? t('toolbox.tools.cronParser.previewSearchBounded', { limit: (525600).toLocaleString() })
        : null,
    );
    setPreferences({ expression });
  }, [expression, previewCount, setPreferences, t]);

  return (
    <div className={className}>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{t('toolbox.tools.cronParser.expression')}</Label>
          <div className="flex gap-2">
            <Input
              value={expression}
              onChange={(e) => {
                setExpression(e.target.value);
                setError(null);
                setGuardrailMessage(null);
              }}
              placeholder="* * * * *"
              className="font-mono flex-1"
            />
            <Button onClick={handleParse} size="sm">
              {t('toolbox.tools.cronParser.parse')}
            </Button>
          </div>
        </div>

        <ToolActionRow
          rightSlot={(
            <div className="flex items-center gap-2">
              <Label htmlFor="cron-preview-count" className="text-xs">{t('toolbox.tools.cronParser.previewCount')}</Label>
              <Input
                id="cron-preview-count"
                type="number"
                min={1}
                max={TOOLBOX_LIMITS.cronPreviewCount}
                value={previewCount}
                onChange={(e) => {
                  const rawValue = Number(e.target.value);
                  const boundedValue = Math.max(
                    1,
                    Math.min(TOOLBOX_LIMITS.cronPreviewCount, Number.isFinite(rawValue) ? rawValue : 1),
                  );
                  setPreferences({ previewCount: boundedValue });
                  if (rawValue > TOOLBOX_LIMITS.cronPreviewCount || rawValue < 1) {
                    setGuardrailMessage(
                      t('toolbox.tools.cronParser.previewCountBounded', {
                        limit: TOOLBOX_LIMITS.cronPreviewCount,
                      }),
                    );
                  } else {
                    setGuardrailMessage(null);
                  }
                }}
                className="h-7 w-16"
              />
            </div>
          )}
        />

        {error && <ToolValidationMessage message={error} />}
        {guardrailMessage && <ToolValidationMessage message={guardrailMessage} />}

        <div className="flex flex-wrap gap-1">
          {PRESETS.map((preset) => (
            <Badge
              key={preset.cron}
              variant="outline"
              className="cursor-pointer hover:bg-accent text-xs"
              onClick={() => { setExpression(preset.cron); setNextRuns([]); setGuardrailMessage(null); }}
            >
              {t(preset.labelKey)}
            </Badge>
          ))}
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">{t('toolbox.tools.cronParser.description')}</Label>
              <p className="text-sm mt-1">{description}</p>
            </div>

            <div className="grid grid-cols-5 gap-2 text-center text-xs">
              {CRON_FIELDS.map((field, index) => (
                <div key={field.id}>
                  <Badge variant="secondary" className="text-[10px] w-full justify-center">{t(field.labelKey)}</Badge>
                  <code className="block mt-1 font-mono">{expression.trim().split(/\s+/)[index] ?? '*'}</code>
                </div>
              ))}
            </div>

            {nextRuns.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">{t('toolbox.tools.cronParser.nextRuns')}</Label>
                <div className="space-y-1 mt-1">
                  {nextRuns.map((date, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="text-[10px] shrink-0">#{i + 1}</Badge>
                      <code className="font-mono text-xs">{date.toLocaleString()}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
