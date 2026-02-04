'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useLogStore, ALL_LEVELS, type LogLevel } from '@/lib/stores/log';
import { useLocale } from '@/components/providers/locale-provider';
import {
  Search,
  Filter,
  Trash2,
  Download,
  Pause,
  Play,
  ArrowDownToLine,
  X,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

const LEVEL_COLORS: Record<LogLevel, string> = {
  trace: 'text-slate-500',
  debug: 'text-blue-500',
  info: 'text-green-500',
  warn: 'text-yellow-600 dark:text-yellow-400',
  error: 'text-red-500',
};

interface LogToolbarProps {
  onExport?: (format: 'txt' | 'json') => void;
  showRealtimeControls?: boolean;
  showMaxLogs?: boolean;
}

type TimeRangePreset = 'all' | '1h' | '24h' | '7d' | 'custom';

const PRESET_ORDER: TimeRangePreset[] = ['all', '1h', '24h', '7d', 'custom'];

function formatDateTimeInput(value: number | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  const tzOffset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

function parseDateTimeInput(value: string) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export function LogToolbar({
  onExport,
  showRealtimeControls = true,
  showMaxLogs = true,
}: LogToolbarProps) {
  const { t } = useLocale();
  const {
    filter,
    autoScroll,
    paused,
    maxLogs,
    setSearch,
    toggleLevel,
    setFilter,
    setTimeRange,
    toggleAutoScroll,
    togglePaused,
    clearLogs,
    setMaxLogs,
    getLogStats,
  } = useLogStore();

  const stats = getLogStats();
  const [timeRangePreset, setTimeRangePreset] = useState<TimeRangePreset>(() => {
    if (filter.startTime || filter.endTime) return 'custom';
    return 'all';
  });
  const [customStart, setCustomStart] = useState(() => formatDateTimeInput(filter.startTime));
  const [customEnd, setCustomEnd] = useState(() => formatDateTimeInput(filter.endTime));

  const timeRangeOptions = useMemo(
    () => ({
      all: t('logs.timeRangeAll'),
      '1h': t('logs.timeRangeLastHour'),
      '24h': t('logs.timeRangeLast24Hours'),
      '7d': t('logs.timeRangeLast7Days'),
      custom: t('logs.timeRangeCustom'),
    }),
    [t]
  );

  const handleExport = useCallback((format: 'txt' | 'json') => {
    if (onExport) {
      onExport(format);
      return;
    }

    const logs = useLogStore.getState().logs;
    const content = format === 'json'
      ? JSON.stringify(logs, null, 2)
      : logs
          .map((log) => {
            const date = new Date(log.timestamp);
            const timestamp = date.toISOString();
            return `[${timestamp}][${log.level.toUpperCase()}]${log.target ? `[${log.target}]` : ''} ${log.message}`;
          })
          .join('\n');

    const mimeType = format === 'json' ? 'application/json' : 'text/plain';
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cognia-logs-${new Date().toISOString().split('T')[0]}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [onExport]);

  const handlePresetChange = useCallback((value: string) => {
    if (!PRESET_ORDER.includes(value as TimeRangePreset)) return;
    const preset = value as TimeRangePreset;
    setTimeRangePreset(preset);
    const now = Date.now();

    if (preset === 'all') {
      setTimeRange(null, null);
      return;
    }

    if (preset === '1h') {
      setTimeRange(now - 60 * 60 * 1000, now);
      return;
    }

    if (preset === '24h') {
      setTimeRange(now - 24 * 60 * 60 * 1000, now);
      return;
    }

    if (preset === '7d') {
      setTimeRange(now - 7 * 24 * 60 * 60 * 1000, now);
      return;
    }

    setCustomStart(formatDateTimeInput(filter.startTime));
    setCustomEnd(formatDateTimeInput(filter.endTime));
  }, [filter.endTime, filter.startTime, setTimeRange]);

  const handleCustomStartChange = useCallback((value: string) => {
    setCustomStart(value);
    setTimeRange(parseDateTimeInput(value), parseDateTimeInput(customEnd));
  }, [customEnd, setTimeRange]);

  const handleCustomEndChange = useCallback((value: string) => {
    setCustomEnd(value);
    setTimeRange(parseDateTimeInput(customStart), parseDateTimeInput(value));
  }, [customStart, setTimeRange]);

  const handleRegexToggle = useCallback((checked: boolean) => {
    setFilter({ useRegex: checked });
  }, [setFilter]);

  const handleMaxLogsChange = useCallback((value: string) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      setMaxLogs(Math.max(100, parsed));
    }
  }, [setMaxLogs]);

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('logs.searchPlaceholder')}
          value={filter.search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-8"
        />
        {filter.search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={timeRangePreset} onValueChange={handlePresetChange}>
          <SelectTrigger className="h-8" size="sm">
            <SelectValue placeholder={t('logs.timeRange')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{timeRangeOptions.all}</SelectItem>
            <SelectItem value="1h">{timeRangeOptions['1h']}</SelectItem>
            <SelectItem value="24h">{timeRangeOptions['24h']}</SelectItem>
            <SelectItem value="7d">{timeRangeOptions['7d']}</SelectItem>
            <SelectItem value="custom">{timeRangeOptions.custom}</SelectItem>
          </SelectContent>
        </Select>

        {timeRangePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="datetime-local"
              className="h-8 w-[170px]"
              value={customStart}
              onChange={(event) => handleCustomStartChange(event.target.value)}
              aria-label={t('logs.timeRangeStart')}
            />
            <span className="text-xs text-muted-foreground">{t('logs.timeRangeTo')}</span>
            <Input
              type="datetime-local"
              className="h-8 w-[170px]"
              value={customEnd}
              onChange={(event) => handleCustomEndChange(event.target.value)}
              aria-label={t('logs.timeRangeEnd')}
            />
          </div>
        )}

        <div className="flex items-center gap-2 rounded-md border px-2 py-1">
          <Switch
            checked={Boolean(filter.useRegex)}
            onCheckedChange={handleRegexToggle}
            aria-label={t('logs.regex')}
          />
          <span className="text-xs text-muted-foreground">{t('logs.regex')}</span>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('logs.filter')}</span>
            {filter.levels.length < ALL_LEVELS.length && (
              <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                {filter.levels.length}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>{t('logs.logLevels')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {ALL_LEVELS.map((level) => (
            <DropdownMenuCheckboxItem
              key={level}
              checked={filter.levels.includes(level)}
              onCheckedChange={() => toggleLevel(level)}
            >
              <span className={LEVEL_COLORS[level]}>{level.toUpperCase()}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {stats.byLevel[level]}
              </span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex items-center gap-1">
        {showRealtimeControls && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={togglePaused}
              title={paused ? t('logs.resume') : t('logs.pause')}
            >
              {paused ? (
                <Play className="h-4 w-4 text-green-500" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleAutoScroll}
              title={autoScroll ? t('logs.autoScrollOn') : t('logs.autoScrollOff')}
            >
              <ArrowDownToLine
                className={`h-4 w-4 ${autoScroll ? 'text-primary' : 'text-muted-foreground'}`}
              />
            </Button>
          </>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={t('logs.export')}
            >
              <Download className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport('txt')}>
              {t('logs.exportTxt')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('json')}>
              {t('logs.exportJson')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {showRealtimeControls && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={clearLogs}
            title={t('logs.clear')}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      {showMaxLogs && (
        <div className="flex items-center gap-2 rounded-md border px-2 py-1">
          <Label htmlFor="max-logs" className="text-xs text-muted-foreground">
            {t('logs.maxLogs')}
          </Label>
          <Input
            id="max-logs"
            type="number"
            min={100}
            step={100}
            value={maxLogs}
            onChange={(event) => handleMaxLogsChange(event.target.value)}
            className="h-8 w-20"
          />
        </div>
      )}

      {showRealtimeControls && (
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground border-l pl-3">
          <span>{t('logs.total')}: {stats.total}</span>
          {paused && (
            <span className="text-yellow-600 dark:text-yellow-400">
              ({t('logs.paused')})
            </span>
          )}
        </div>
      )}
    </div>
  );
}
