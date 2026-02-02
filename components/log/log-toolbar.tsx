'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
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
import { useCallback } from 'react';

const LEVEL_COLORS: Record<LogLevel, string> = {
  trace: 'text-slate-500',
  debug: 'text-blue-500',
  info: 'text-green-500',
  warn: 'text-yellow-600 dark:text-yellow-400',
  error: 'text-red-500',
};

interface LogToolbarProps {
  onExport?: () => void;
}

export function LogToolbar({ onExport }: LogToolbarProps) {
  const { t } = useLocale();
  const {
    filter,
    autoScroll,
    paused,
    setSearch,
    toggleLevel,
    toggleAutoScroll,
    togglePaused,
    clearLogs,
    getLogStats,
  } = useLogStore();

  const stats = getLogStats();

  const handleExport = useCallback(() => {
    if (onExport) {
      onExport();
      return;
    }

    const logs = useLogStore.getState().logs;
    const content = logs
      .map((log) => {
        const date = new Date(log.timestamp);
        const timestamp = date.toISOString();
        return `[${timestamp}][${log.level.toUpperCase()}]${log.target ? `[${log.target}]` : ''} ${log.message}`;
      })
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cognia-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [onExport]);

  return (
    <div className="flex items-center gap-2 p-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleExport}
          title={t('logs.export')}
        >
          <Download className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={clearLogs}
          title={t('logs.clear')}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground border-l pl-3">
        <span>{t('logs.total')}: {stats.total}</span>
        {paused && (
          <span className="text-yellow-600 dark:text-yellow-400">
            ({t('logs.paused')})
          </span>
        )}
      </div>
    </div>
  );
}
