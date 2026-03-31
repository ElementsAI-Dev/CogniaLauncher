'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToolSection, ToolActionRow, ToolValidationMessage } from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolPreferences } from '@/hooks/toolbox/use-tool-preferences';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';
import { Calendar, Clock } from 'lucide-react';
import type { ToolComponentProps } from '@/types/toolbox';

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

/* ---------------------------------------------------------------------------
 * Constants
 * --------------------------------------------------------------------------- */

const CRON_FIELDS = [
  { id: 'minute', labelKey: 'toolbox.tools.cronParser.fields.minute' },
  { id: 'hour', labelKey: 'toolbox.tools.cronParser.fields.hour' },
  { id: 'dayOfMonth', labelKey: 'toolbox.tools.cronParser.fields.dayOfMonth' },
  { id: 'month', labelKey: 'toolbox.tools.cronParser.fields.month' },
  { id: 'dayOfWeek', labelKey: 'toolbox.tools.cronParser.fields.dayOfWeek' },
] as const;

const FIELD_COLORS = [
  'bg-blue-500/10 border-blue-500/20',
  'bg-purple-500/10 border-purple-500/20',
  'bg-amber-500/10 border-amber-500/20',
  'bg-emerald-500/10 border-emerald-500/20',
  'bg-rose-500/10 border-rose-500/20',
];

const PRESETS = [
  { label: 'Every minute', cron: '* * * * *' },
  { label: 'Every 5 min', cron: '*/5 * * * *' },
  { label: 'Hourly', cron: '0 * * * *' },
  { label: 'Daily midnight', cron: '0 0 * * *' },
  { label: 'Daily noon', cron: '0 12 * * *' },
  { label: 'Mon 9am', cron: '0 9 * * 1' },
  { label: 'Weekdays 8am', cron: '0 8 * * 1-5' },
];

const MINUTE_OPTIONS = ['*', '*/5', '*/10', '*/15', '0', '15', '30', '45'];
const HOUR_OPTIONS = ['*', '*/2', '*/4', '*/6', '0', '6', '8', '9', '12', '18'];
const DOM_OPTIONS = ['*', '1', '15', '28'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_OPTIONS = ['*', ...Array.from({ length: 12 }, (_, i) => String(i + 1))];
const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_OPTIONS = ['*', '0', '1', '2', '3', '4', '5', '6', '1-5'];

/* ---------------------------------------------------------------------------
 * Cron parse helpers
 * --------------------------------------------------------------------------- */

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
  return CRON_FIELDS.map((field, index) =>
    describeCronField(parts[index] ?? '*', t(field.labelKey), t),
  ).join(', ');
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

function matchesCron(date: Date, parts: string[]): boolean {
  return (
    matchesField(date.getMinutes(), parts[0]) &&
    matchesField(date.getHours(), parts[1]) &&
    matchesField(date.getDate(), parts[2]) &&
    matchesField(date.getMonth() + 1, parts[3]) &&
    matchesField(date.getDay(), parts[4])
  );
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

function formatRelativeTime(date: Date, now: Date): string {
  const diffMs = date.getTime() - now.getTime();
  if (diffMs < 0) return 'past';
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'in <1 min';
  if (diffMin < 60) return `in ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    const remainMin = diffMin % 60;
    return remainMin > 0 ? `in ${diffHr}h ${remainMin}m` : `in ${diffHr}h`;
  }
  const diffDay = Math.floor(diffHr / 24);
  const remainHr = diffHr % 24;
  return remainHr > 0 ? `in ${diffDay}d ${remainHr}h` : `in ${diffDay}d`;
}

function formatDateTime(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

/* ---------------------------------------------------------------------------
 * Visual builder helpers
 * --------------------------------------------------------------------------- */

function getMonthLabel(val: string): string {
  const num = parseInt(val, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) return `${num} (${MONTH_NAMES[num - 1]})`;
  return val;
}

function getDowLabel(val: string): string {
  const num = parseInt(val, 10);
  if (!isNaN(num) && num >= 0 && num <= 6) return `${num} (${DOW_NAMES[num]})`;
  if (val === '1-5') return '1-5 (Mon-Fri)';
  return val;
}

function bestMatchSelector(fieldValue: string, options: string[]): string {
  if (options.includes(fieldValue)) return fieldValue;
  return options[0];
}

/* ---------------------------------------------------------------------------
 * Component
 * --------------------------------------------------------------------------- */

const DEFAULT_PREFERENCES = {
  expression: '0 * * * *',
  previewCount: 5,
} as const;

export default function CronParser({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const { preferences, setPreferences } = useToolPreferences('cron-parser', DEFAULT_PREFERENCES);
  const [expression, setExpression] = useState(preferences.expression);
  const [nextRuns, setNextRuns] = useState<Date[]>([]);
  const [guardrailMessage, setGuardrailMessage] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const previewCount = Math.max(
    1,
    Math.min(TOOLBOX_LIMITS.cronPreviewCount, Number(preferences.previewCount) || 5),
  );

  // Auto-parse: description + field breakdown + validation
  const { description, fieldValues, error } = useMemo(() => {
    const trimmed = expression.trim();
    if (!trimmed) {
      return { description: '', fieldValues: ['*', '*', '*', '*', '*'], error: null };
    }
    if (trimmed.length > TOOLBOX_LIMITS.cronExpressionChars) {
      return {
        description: '',
        fieldValues: ['*', '*', '*', '*', '*'],
        error: t('toolbox.tools.shared.inputTooLarge', {
          limit: TOOLBOX_LIMITS.cronExpressionChars.toLocaleString(),
        }),
      };
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length !== 5) {
      return {
        description: '',
        fieldValues: parts.concat(Array(5 - parts.length).fill('*')).slice(0, 5),
        error: t('toolbox.tools.cronParser.invalidExpression'),
      };
    }
    return {
      description: describeCron(trimmed, t),
      fieldValues: parts,
      error: null,
    };
  }, [expression, t]);

  // Debounced next-runs computation
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (error) {
      return;
    }
    debounceRef.current = setTimeout(() => {
      const result = getNextRuns(expression, previewCount, 525600);
      setNextRuns(result.runs);
      setGuardrailMessage(
        result.exhausted
          ? t('toolbox.tools.cronParser.previewSearchBounded', { limit: (525600).toLocaleString() })
          : null,
      );
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [expression, previewCount, error, t]);

  // Visual builder: sync from expression → selectors
  const selectorValues = useMemo(() => [
    bestMatchSelector(fieldValues[0], MINUTE_OPTIONS),
    bestMatchSelector(fieldValues[1], HOUR_OPTIONS),
    bestMatchSelector(fieldValues[2], DOM_OPTIONS),
    bestMatchSelector(fieldValues[3], MONTH_OPTIONS),
    bestMatchSelector(fieldValues[4], DOW_OPTIONS),
  ], [fieldValues]);

  const handleSelectorChange = useCallback((index: number, value: string) => {
    const parts = expression.trim().split(/\s+/);
    const current = parts.length === 5 ? parts : ['*', '*', '*', '*', '*'];
    current[index] = value;
    setExpression(current.join(' '));
  }, [expression]);

  const handlePreviewCountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
  }, [setPreferences, t]);

  const visibleNextRuns = error ? [] : nextRuns;
  const now = useMemo(() => new Date(), [visibleNextRuns]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Expression Input + Presets */}
        <ToolSection title={t('toolbox.tools.cronParser.expression')}>
          <div className="space-y-3">
            <Input
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="* * * * *"
              className="font-mono"
            />

            {error && <ToolValidationMessage message={error} />}
            {guardrailMessage && <ToolValidationMessage message={guardrailMessage} />}

            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((preset) => (
                <Badge
                  key={preset.cron}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent text-xs gap-1"
                  onClick={() => setExpression(preset.cron)}
                >
                  {preset.label}
                  <span className="text-muted-foreground font-mono">{preset.cron}</span>
                </Badge>
              ))}
            </div>
          </div>
        </ToolSection>

        {/* Visual Builder */}
        <ToolSection title={t('toolbox.tools.cronParser.visualBuilder') ?? 'Visual Builder'}>
          <div className="grid grid-cols-5 gap-2">
            {CRON_FIELDS.map((field, index) => (
              <div key={field.id} className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {t(field.labelKey)}
                </Label>
                <Select
                  value={selectorValues[index]}
                  onValueChange={(val) => handleSelectorChange(index, val)}
                >
                  <SelectTrigger className="h-8 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {index === 0 && MINUTE_OPTIONS.map((v) => (
                      <SelectItem key={v} value={v} className="text-xs font-mono">{v}</SelectItem>
                    ))}
                    {index === 1 && HOUR_OPTIONS.map((v) => (
                      <SelectItem key={v} value={v} className="text-xs font-mono">{v}</SelectItem>
                    ))}
                    {index === 2 && DOM_OPTIONS.map((v) => (
                      <SelectItem key={v} value={v} className="text-xs font-mono">{v}</SelectItem>
                    ))}
                    {index === 3 && MONTH_OPTIONS.map((v) => (
                      <SelectItem key={v} value={v} className="text-xs font-mono">{getMonthLabel(v)}</SelectItem>
                    ))}
                    {index === 4 && DOW_OPTIONS.map((v) => (
                      <SelectItem key={v} value={v} className="text-xs font-mono">{getDowLabel(v)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </ToolSection>

        {/* Description */}
        {description && (
          <ToolSection title={t('toolbox.tools.cronParser.description')}>
            <div className="bg-primary/5 border-primary/20 border rounded-lg p-3 flex items-start gap-2">
              <Calendar className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm">{description}</p>
            </div>
          </ToolSection>
        )}

        {/* Per-field breakdown */}
        <div className="grid grid-cols-5 gap-2">
          {CRON_FIELDS.map((field, index) => (
            <div
              key={field.id}
              className={`${FIELD_COLORS[index]} border rounded-lg p-2 text-center`}
            >
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide block">
                {t(field.labelKey)}
              </span>
              <code className="block mt-1 font-mono text-sm font-semibold">
                {fieldValues[index] ?? '*'}
              </code>
            </div>
          ))}
        </div>

        {/* Schedule Preview */}
        {visibleNextRuns.length > 0 && (
          <ToolSection
            title={t('toolbox.tools.cronParser.nextRuns')}
            headerRight={
              <ToolActionRow
                rightSlot={
                  <div className="flex items-center gap-2">
                    <Label htmlFor="cron-preview-count" className="text-xs">
                      {t('toolbox.tools.cronParser.previewCount')}
                    </Label>
                    <Input
                      id="cron-preview-count"
                      type="number"
                      min={1}
                      max={TOOLBOX_LIMITS.cronPreviewCount}
                      value={previewCount}
                      onChange={handlePreviewCountChange}
                      className="h-7 w-16"
                    />
                  </div>
                }
              />
            }
          >
            <div className="rounded-lg overflow-hidden border">
              {visibleNextRuns.map((date, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-3 py-1.5 text-sm ${
                    i % 2 === 1 ? 'bg-muted/30' : ''
                  }`}
                >
                  <Badge variant="outline" className="text-[10px] shrink-0 w-8 justify-center">
                    #{i + 1}
                  </Badge>
                  <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                  <code className="font-mono text-xs">{formatDateTime(date)}</code>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatRelativeTime(date, now)}
                  </span>
                </div>
              ))}
            </div>
          </ToolSection>
        )}
      </div>
    </div>
  );
}
