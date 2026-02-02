'use client';

import { cn } from '@/lib/utils';
import { Copy, Check } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import type { LogEntry as LogEntryType, LogLevel } from '@/lib/stores/log';

const LEVEL_STYLES: Record<LogLevel, { bg: string; text: string; border: string }> = {
  trace: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-500',
    border: 'border-slate-500/20',
  },
  debug: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    border: 'border-blue-500/20',
  },
  info: {
    bg: 'bg-green-500/10',
    text: 'text-green-500',
    border: 'border-green-500/20',
  },
  warn: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-600 dark:text-yellow-400',
    border: 'border-yellow-500/20',
  },
  error: {
    bg: 'bg-red-500/10',
    text: 'text-red-500',
    border: 'border-red-500/20',
  },
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  trace: 'TRC',
  debug: 'DBG',
  info: 'INF',
  warn: 'WRN',
  error: 'ERR',
};

interface LogEntryProps {
  entry: LogEntryType;
  showTimestamp?: boolean;
  showTarget?: boolean;
}

export function LogEntry({ entry, showTimestamp = true, showTarget = true }: LogEntryProps) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const style = LEVEL_STYLES[entry.level];

  const formatTimestamp = useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      const text = `[${formatTimestamp(entry.timestamp)}][${entry.level.toUpperCase()}]${entry.target ? `[${entry.target}]` : ''} ${entry.message}`;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard errors
    }
  }, [entry, formatTimestamp]);

  return (
    <div
      className={cn(
        'group flex items-start gap-2 px-3 py-1.5 font-mono text-xs hover:bg-muted/50 border-l-2',
        style.border
      )}
    >
      {showTimestamp && (
        <span className="shrink-0 text-muted-foreground tabular-nums">
          {formatTimestamp(entry.timestamp)}
        </span>
      )}
      
      <span
        className={cn(
          'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
          style.bg,
          style.text
        )}
      >
        {LEVEL_LABELS[entry.level]}
      </span>

      {showTarget && entry.target && (
        <span className="shrink-0 text-muted-foreground max-w-[120px] truncate">
          {entry.target}
        </span>
      )}

      <span className="flex-1 break-all whitespace-pre-wrap">{entry.message}</span>

      <button
        onClick={handleCopy}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
        title={t('logs.copyEntry')}
        aria-label={t('logs.copyEntry')}
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : (
          <Copy className="h-3 w-3 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}
