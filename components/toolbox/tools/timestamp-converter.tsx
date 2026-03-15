'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useCopyToClipboard } from '@/hooks/use-clipboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useLocale } from '@/components/providers/locale-provider';
import {
  ToolSection,
  ToolOptionGroup,
  ToolValidationMessage,
} from '@/components/toolbox/tool-layout';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';
import { useToolPreferences } from '@/hooks/use-tool-preferences';
import { Clock, ArrowDownUp, Copy, Check, Calendar, RefreshCw } from 'lucide-react';
import type { ToolComponentProps } from '@/types/toolbox';

/* ---------------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------------- */

function getRelativeTime(
  date: Date,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  const now = Date.now();
  const diff = date.getTime() - now;
  const abs = Math.abs(diff);
  const future = diff > 0;

  if (abs < 60_000) return t('toolbox.tools.timestampConverter.relativeJustNow');
  if (abs < 3_600_000) {
    const m = Math.floor(abs / 60_000);
    return future
      ? t('toolbox.tools.timestampConverter.relativeInMinutes', { count: m })
      : t('toolbox.tools.timestampConverter.relativeMinutesAgo', { count: m });
  }
  if (abs < 86_400_000) {
    const h = Math.floor(abs / 3_600_000);
    return future
      ? t('toolbox.tools.timestampConverter.relativeInHours', { count: h })
      : t('toolbox.tools.timestampConverter.relativeHoursAgo', { count: h });
  }
  if (abs < 2_592_000_000) {
    const d = Math.floor(abs / 86_400_000);
    return future
      ? t('toolbox.tools.timestampConverter.relativeInDays', { count: d })
      : t('toolbox.tools.timestampConverter.relativeDaysAgo', { count: d });
  }
  if (abs < 31_536_000_000) {
    const mo = Math.floor(abs / 2_592_000_000);
    return future
      ? t('toolbox.tools.timestampConverter.relativeInMonths', { count: mo })
      : t('toolbox.tools.timestampConverter.relativeMonthsAgo', { count: mo });
  }
  const y = Math.floor(abs / 31_536_000_000);
  return future
    ? t('toolbox.tools.timestampConverter.relativeInYears', { count: y })
    : t('toolbox.tools.timestampConverter.relativeYearsAgo', { count: y });
}

interface FormatResult {
  key: string;
  label: string;
  value: string;
}

function computeFormats(
  date: Date,
  t: (key: string, values?: Record<string, string | number>) => string,
): FormatResult[] {
  return [
    { key: 'iso', label: t('toolbox.tools.timestampConverter.formatIso'), value: date.toISOString() },
    { key: 'utc', label: t('toolbox.tools.timestampConverter.formatUtc'), value: date.toUTCString() },
    { key: 'local', label: t('toolbox.tools.timestampConverter.formatLocal'), value: date.toLocaleString() },
    { key: 'date', label: t('toolbox.tools.timestampConverter.formatDateOnly'), value: date.toLocaleDateString() },
    { key: 'time', label: t('toolbox.tools.timestampConverter.formatTimeOnly'), value: date.toLocaleTimeString() },
    { key: 'unixSeconds', label: t('toolbox.tools.timestampConverter.formatUnixSeconds'), value: Math.floor(date.getTime() / 1000).toString() },
    { key: 'unixMs', label: t('toolbox.tools.timestampConverter.formatUnixMilliseconds'), value: date.getTime().toString() },
    { key: 'relative', label: t('toolbox.tools.timestampConverter.formatRelative'), value: getRelativeTime(date, t) },
  ];
}

/* ---------------------------------------------------------------------------
 * Constants
 * --------------------------------------------------------------------------- */

const DEFAULT_PREFERENCES = {
  mode: 'toDate',
  assumeMilliseconds: false,
} as const;

/* ---------------------------------------------------------------------------
 * Component
 * --------------------------------------------------------------------------- */

export default function TimestampConverter({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const { preferences, setPreferences } = useToolPreferences('timestamp-converter', DEFAULT_PREFERENCES);
  const [input, setInput] = useState('');
  const { copy, error: clipboardError } = useCopyToClipboard();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [liveMode, setLiveMode] = useState(false);

  const mode = preferences.mode as 'toDate' | 'toTimestamp';
  const assumeMs = preferences.assumeMilliseconds as boolean;

  // Live ticker — updates input every second with current UNIX timestamp
  useEffect(() => {
    if (!liveMode) return;
    const id = setInterval(() => {
      setInput(String(Math.floor(Date.now() / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [liveMode]);

  // Stop live mode when switching modes
  useEffect(() => {
    setLiveMode(false);
  }, [mode]);

  // Real-time conversion via useMemo
  const { results, error } = useMemo<{ results: FormatResult[] | null; error: string | null }>(() => {
    if (!input.trim()) return { results: null, error: null };
    if (input.length > TOOLBOX_LIMITS.converterChars) {
      return {
        results: null,
        error: t('toolbox.tools.shared.inputTooLarge', {
          limit: TOOLBOX_LIMITS.converterChars.toLocaleString(),
        }),
      };
    }
    try {
      if (mode === 'toDate') {
        const num = Number(input.trim());
        if (isNaN(num)) throw new Error(t('toolbox.tools.timestampConverter.invalidTimestamp'));
        const ms = assumeMs ? num : (num > 1e12 ? num : num * 1000);
        const date = new Date(ms);
        if (isNaN(date.getTime())) throw new Error(t('toolbox.tools.timestampConverter.invalidTimestamp'));
        return { results: computeFormats(date, t), error: null };
      } else {
        const date = new Date(input.trim());
        if (isNaN(date.getTime())) throw new Error(t('toolbox.tools.timestampConverter.invalidDate'));
        return { results: computeFormats(date, t), error: null };
      }
    } catch (e) {
      return { results: null, error: (e as Error).message };
    }
  }, [input, mode, assumeMs, t]);

  const handleNow = useCallback(() => {
    if (liveMode) {
      setLiveMode(false);
      return;
    }
    if (mode === 'toDate') {
      setLiveMode(true);
      setInput(String(Math.floor(Date.now() / 1000)));
    } else {
      setInput(new Date().toISOString());
    }
  }, [mode, liveMode]);

  const handleSwap = useCallback(() => {
    setPreferences({ mode: mode === 'toDate' ? 'toTimestamp' : 'toDate' });
    setInput('');
    setLiveMode(false);
  }, [mode, setPreferences]);

  const handleCopy = useCallback(async (key: string, value: string) => {
    await copy(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }, [copy]);

  const handleDateTimeLocalChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) setInput(e.target.value);
  }, []);

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* ---- Input Section ---- */}
        <ToolSection title={t('toolbox.tools.timestampConverter.inputSection')}>
          <div className="space-y-4">
            {/* Mode toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === 'toDate'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                onClick={() => {
                  if (mode !== 'toDate') handleSwap();
                }}
              >
                {t('toolbox.tools.timestampConverter.timestampToDate')}
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === 'toTimestamp'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                onClick={() => {
                  if (mode !== 'toTimestamp') handleSwap();
                }}
              >
                {t('toolbox.tools.timestampConverter.dateToTimestamp')}
              </button>

              <div className="ml-auto flex items-center gap-2">
                <Button
                  onClick={handleNow}
                  variant={liveMode ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5"
                >
                  {liveMode ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Clock className="h-3.5 w-3.5" />
                  )}
                  {t('toolbox.tools.timestampConverter.now')}
                  {liveMode && (
                      <Badge variant="secondary" className="ml-1 animate-pulse text-[10px] px-1.5 py-0">
                      {t('toolbox.tools.timestampConverter.live')}
                    </Badge>
                  )}
                </Button>
                <Button onClick={handleSwap} variant="outline" size="sm" className="gap-1.5">
                  <ArrowDownUp className="h-3.5 w-3.5" />
                  {t('toolbox.tools.timestampConverter.swap')}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Input field */}
            <div className="space-y-2">
              <Label>
                {mode === 'toDate'
                  ? t('toolbox.tools.timestampConverter.timestampInput')
                  : t('toolbox.tools.timestampConverter.dateInput')}
              </Label>
              <Input
                value={input}
                onChange={(e) => {
                  setLiveMode(false);
                  setInput(e.target.value);
                }}
                placeholder={mode === 'toDate' ? '1709136000' : '2024-02-28T12:00:00Z'}
                className="font-mono"
              />
            </div>

            {/* Date-time picker for toTimestamp mode */}
            {mode === 'toTimestamp' && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  {t('toolbox.tools.timestampConverter.datePickerHelper')}
                </Label>
                <input
                  type="datetime-local"
                  onChange={handleDateTimeLocalChange}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-mono shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            )}

            {/* Options */}
            {mode === 'toDate' && (
              <ToolOptionGroup>
                <div className="flex items-center gap-2">
                  <Switch
                    id="timestamp-ms-mode"
                    checked={assumeMs}
                    onCheckedChange={(checked) => setPreferences({ assumeMilliseconds: checked })}
                  />
                  <Label htmlFor="timestamp-ms-mode" className="text-xs">
                    {t('toolbox.tools.timestampConverter.assumeMilliseconds')}
                  </Label>
                </div>
              </ToolOptionGroup>
            )}
          </div>
        </ToolSection>

        {/* Validation */}
        {error && <ToolValidationMessage message={error} />}

        {/* ---- Output Formats Section ---- */}
        {results && (
          <ToolSection title={t('toolbox.tools.timestampConverter.outputSection')}>
            <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-2 items-center">
              {results.map(({ key, label, value }) => (
                <div key={key} className="contents">
                  <Badge variant="secondary" className="text-[11px] shrink-0 justify-center min-w-20">
                    {label}
                  </Badge>
                  <code className="text-xs font-mono truncate select-all">{value}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleCopy(key, value)}
                  >
                    {copiedKey === key ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </ToolSection>
        )}
        {clipboardError && <ToolValidationMessage message={t('toolbox.actions.copyFailed')} />}
      </div>
    </div>
  );
}
