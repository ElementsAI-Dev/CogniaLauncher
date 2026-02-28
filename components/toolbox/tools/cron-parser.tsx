'use client';

import { useState, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useLocale } from '@/components/providers/locale-provider';
import type { ToolComponentProps } from '@/types/toolbox';

const FIELD_NAMES = ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek'] as const;

const PRESETS = [
  { label: 'Every minute', cron: '* * * * *' },
  { label: 'Every hour', cron: '0 * * * *' },
  { label: 'Every day at midnight', cron: '0 0 * * *' },
  { label: 'Every Monday at 9am', cron: '0 9 * * 1' },
  { label: 'Every 5 minutes', cron: '*/5 * * * *' },
  { label: 'Every day at noon', cron: '0 12 * * *' },
  { label: 'First day of month', cron: '0 0 1 * *' },
  { label: 'Weekdays at 8am', cron: '0 8 * * 1-5' },
];

function describeCronField(value: string, fieldName: string): string {
  if (value === '*') return `every ${fieldName}`;
  if (value.startsWith('*/')) return `every ${value.slice(2)} ${fieldName}s`;
  if (value.includes(',')) return `${fieldName} ${value}`;
  if (value.includes('-')) return `${fieldName} ${value}`;
  return `${fieldName} ${value}`;
}

function describeCron(expression: string): string {
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5) return 'Invalid cron expression';
  return FIELD_NAMES.map((name, i) => describeCronField(parts[i], name)).join(', ');
}

function getNextRuns(expression: string, count: number): Date[] {
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5) return [];

  const results: Date[] = [];
  const now = new Date();
  const check = new Date(now);
  check.setSeconds(0, 0);
  check.setMinutes(check.getMinutes() + 1);

  const maxIterations = 525600; // 1 year of minutes
  let iterations = 0;

  while (results.length < count && iterations < maxIterations) {
    if (matchesCron(check, parts)) {
      results.push(new Date(check));
    }
    check.setMinutes(check.getMinutes() + 1);
    iterations++;
  }
  return results;
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
    const step = parseInt(pattern.slice(2));
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

export default function CronParser({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const [expression, setExpression] = useState('0 * * * *');
  const [nextRuns, setNextRuns] = useState<Date[]>([]);

  const description = useMemo(() => describeCron(expression), [expression]);

  const handleParse = useCallback(() => {
    setNextRuns(getNextRuns(expression, 5));
  }, [expression]);

  return (
    <div className={className}>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{t('toolbox.tools.cronParser.expression')}</Label>
          <div className="flex gap-2">
            <Input
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="* * * * *"
              className="font-mono flex-1"
            />
            <Button onClick={handleParse} size="sm">
              {t('toolbox.tools.cronParser.parse')}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {PRESETS.map((preset) => (
            <Badge
              key={preset.cron}
              variant="outline"
              className="cursor-pointer hover:bg-accent text-xs"
              onClick={() => { setExpression(preset.cron); setNextRuns([]); }}
            >
              {preset.label}
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
              {FIELD_NAMES.map((name, i) => (
                <div key={name}>
                  <Badge variant="secondary" className="text-[10px] w-full justify-center">{name}</Badge>
                  <code className="block mt-1 font-mono">{expression.trim().split(/\s+/)[i] ?? '*'}</code>
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
