'use client';

import { useState, useCallback } from 'react';
import { useCopyToClipboard } from '@/hooks/use-clipboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/components/providers/locale-provider';
import { Switch } from '@/components/ui/switch';
import { ToolActionRow, ToolValidationMessage } from '@/components/toolbox/tool-layout';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';
import { useToolPreferences } from '@/hooks/use-tool-preferences';
import { Clock, ArrowDownUp, Copy, Check } from 'lucide-react';
import type { ToolComponentProps } from '@/types/toolbox';

function formatDate(date: Date): Record<string, string> {
  return {
    iso: date.toISOString(),
    utc: date.toUTCString(),
    local: date.toLocaleString(),
    date: date.toLocaleDateString(),
    time: date.toLocaleTimeString(),
    unixSeconds: Math.floor(date.getTime() / 1000).toString(),
    unixMs: date.getTime().toString(),
  };
}

const DEFAULT_PREFERENCES = {
  mode: 'toDate',
  assumeMilliseconds: false,
} as const;

export default function TimestampConverter({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const { preferences, setPreferences } = useToolPreferences('timestamp-converter', DEFAULT_PREFERENCES);
  const [input, setInput] = useState('');
  const [results, setResults] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { copy } = useCopyToClipboard();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const mode = preferences.mode as 'toDate' | 'toTimestamp';

  const handleConvert = useCallback(() => {
    if (!input.trim()) {
      setResults(null);
      setError(null);
      return;
    }
    if (input.length > TOOLBOX_LIMITS.converterChars) {
      setError(
        t('toolbox.tools.shared.inputTooLarge', {
          limit: TOOLBOX_LIMITS.converterChars.toLocaleString(),
        }),
      );
      setResults(null);
      return;
    }
    try {
      if (mode === 'toDate') {
        const num = Number(input.trim());
        if (isNaN(num)) throw new Error(t('toolbox.tools.timestampConverter.invalidTimestamp'));
        const ms = preferences.assumeMilliseconds ? num : (num > 1e12 ? num : num * 1000);
        const date = new Date(ms);
        if (isNaN(date.getTime())) throw new Error(t('toolbox.tools.timestampConverter.invalidTimestamp'));
        setResults(formatDate(date));
        setError(null);
      } else {
        const date = new Date(input.trim());
        if (isNaN(date.getTime())) throw new Error(t('toolbox.tools.timestampConverter.invalidDate'));
        setResults(formatDate(date));
        setError(null);
      }
    } catch (e) {
      setError((e as Error).message);
      setResults(null);
    }
  }, [input, mode, preferences.assumeMilliseconds, t]);

  const handleNow = useCallback(() => {
    const now = new Date();
    if (mode === 'toDate') {
      const value = preferences.assumeMilliseconds
        ? now.getTime().toString()
        : Math.floor(now.getTime() / 1000).toString();
      setInput(value);
    } else {
      setInput(now.toISOString());
    }
    setResults(formatDate(now));
    setError(null);
  }, [mode, preferences.assumeMilliseconds]);

  const handleSwap = useCallback(() => {
    setPreferences({ mode: mode === 'toDate' ? 'toTimestamp' : 'toDate' });
    setInput('');
    setResults(null);
    setError(null);
  }, [mode, setPreferences]);

  const handleCopy = useCallback(async (key: string, value: string) => {
    await copy(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }, [copy]);

  return (
    <div className={className}>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{mode === 'toDate' ? t('toolbox.tools.timestampConverter.timestampInput') : t('toolbox.tools.timestampConverter.dateInput')}</Label>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === 'toDate' ? '1709136000' : '2024-02-28T12:00:00Z'}
            className="font-mono"
          />
        </div>

        {error && (
          <ToolValidationMessage message={error} />
        )}

        <ToolActionRow
          rightSlot={
            mode === 'toDate' ? (
              <div className="flex items-center gap-2">
                <Switch
                  id="timestamp-ms-mode"
                  checked={preferences.assumeMilliseconds}
                  onCheckedChange={(checked) => setPreferences({ assumeMilliseconds: checked })}
                />
                <Label htmlFor="timestamp-ms-mode" className="text-xs">
                  {t('toolbox.tools.timestampConverter.assumeMilliseconds')}
                </Label>
              </div>
            ) : null
          }
        >
          <Button onClick={handleConvert} size="sm">
            {t('toolbox.tools.timestampConverter.convert')}
          </Button>
          <Button onClick={handleNow} variant="outline" size="sm" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {t('toolbox.tools.timestampConverter.now')}
          </Button>
          <Button onClick={handleSwap} variant="outline" size="sm" className="gap-1.5">
            <ArrowDownUp className="h-3.5 w-3.5" />
            {t('toolbox.tools.timestampConverter.swap')}
          </Button>
        </ToolActionRow>

        {results && (
          <Card>
            <CardContent className="p-4 space-y-2">
              {Object.entries(results).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <Badge variant="secondary" className="text-xs shrink-0 w-24 justify-center">{key}</Badge>
                  <code className="flex-1 text-xs font-mono truncate">{value}</code>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleCopy(key, value)}>
                    {copiedKey === key ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
