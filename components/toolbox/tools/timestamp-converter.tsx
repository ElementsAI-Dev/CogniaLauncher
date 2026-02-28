'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/components/providers/locale-provider';
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

export default function TimestampConverter({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'toDate' | 'toTimestamp'>('toDate');
  const [results, setResults] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleConvert = useCallback(() => {
    if (!input.trim()) { setResults(null); setError(null); return; }
    try {
      if (mode === 'toDate') {
        const num = Number(input.trim());
        if (isNaN(num)) throw new Error('Invalid timestamp');
        const ms = num > 1e12 ? num : num * 1000;
        const date = new Date(ms);
        if (isNaN(date.getTime())) throw new Error('Invalid timestamp');
        setResults(formatDate(date));
        setError(null);
      } else {
        const date = new Date(input.trim());
        if (isNaN(date.getTime())) throw new Error('Invalid date string');
        setResults(formatDate(date));
        setError(null);
      }
    } catch (e) {
      setError((e as Error).message);
      setResults(null);
    }
  }, [input, mode]);

  const handleNow = useCallback(() => {
    const now = new Date();
    if (mode === 'toDate') {
      setInput(Math.floor(now.getTime() / 1000).toString());
    } else {
      setInput(now.toISOString());
    }
    setResults(formatDate(now));
    setError(null);
  }, [mode]);

  const handleSwap = useCallback(() => {
    setMode((prev) => (prev === 'toDate' ? 'toTimestamp' : 'toDate'));
    setInput('');
    setResults(null);
    setError(null);
  }, []);

  const handleCopy = useCallback(async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }, []);

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
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex items-center gap-2">
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
        </div>

        {results && (
          <Card>
            <CardContent className="p-4 space-y-2">
              {Object.entries(results).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <Badge variant="secondary" className="text-xs shrink-0 w-24 justify-center">{key}</Badge>
                  <code className="flex-1 text-xs font-mono truncate">{value}</code>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleCopy(key, value)}>
                    {copied === key ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
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
