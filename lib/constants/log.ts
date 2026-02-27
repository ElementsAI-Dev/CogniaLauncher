import type { LogLevel } from '@/types/log';

export const ALL_LEVELS: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error'];

export const LEVEL_STYLES: Record<
  LogLevel,
  {
    variant: "default" | "secondary" | "destructive" | "outline";
    className: string;
    indicator: string;
  }
> = {
  trace: {
    variant: "secondary",
    className:
      "bg-slate-500/10 text-slate-600 hover:bg-slate-500/20 dark:bg-slate-400/10 dark:text-slate-400",
    indicator: "bg-slate-400",
  },
  debug: {
    variant: "secondary",
    className:
      "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:bg-blue-400/10 dark:text-blue-400",
    indicator: "bg-blue-500",
  },
  info: {
    variant: "secondary",
    className:
      "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-400",
    indicator: "bg-emerald-500",
  },
  warn: {
    variant: "secondary",
    className:
      "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:bg-amber-400/10 dark:text-amber-400",
    indicator: "bg-amber-500",
  },
  error: {
    variant: "destructive",
    className:
      "bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:bg-red-400/10 dark:text-red-400",
    indicator: "bg-red-500",
  },
};

export const LEVEL_LABELS: Record<LogLevel, string> = {
  trace: "TRC",
  debug: "DBG",
  info: "INF",
  warn: "WRN",
  error: "ERR",
};

export const LEVEL_COLORS: Record<LogLevel, string> = {
  trace: "text-slate-500",
  debug: "text-blue-500",
  info: "text-green-500",
  warn: "text-yellow-600 dark:text-yellow-400",
  error: "text-red-500",
};
