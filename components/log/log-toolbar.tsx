"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Toggle } from "@/components/ui/toggle";
import { useLogStore } from "@/lib/stores/log";
import { ALL_LEVELS, LEVEL_COLORS } from "@/lib/constants/log";
import { formatDateTimeInput, parseDateTimeInput } from "@/lib/log";
import { useLocale } from "@/components/providers/locale-provider";
import {
  Search,
  Filter,
  Trash2,
  Download,
  Pause,
  Play,
  ArrowDownToLine,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback, useMemo, useState } from "react";

interface LogToolbarProps {
  onExport?: (format: "txt" | "json") => void;
  showRealtimeControls?: boolean;
  showMaxLogs?: boolean;
}

type TimeRangePreset = "all" | "1h" | "24h" | "7d" | "custom";

const PRESET_ORDER: TimeRangePreset[] = ["all", "1h", "24h", "7d", "custom"];

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
  const [timeRangePreset, setTimeRangePreset] = useState<TimeRangePreset>(
    () => {
      if (filter.startTime || filter.endTime) return "custom";
      return "all";
    },
  );
  const [customStart, setCustomStart] = useState(() =>
    formatDateTimeInput(filter.startTime),
  );
  const [customEnd, setCustomEnd] = useState(() =>
    formatDateTimeInput(filter.endTime),
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const activeFiltersCount =
    (filter.levels.length < ALL_LEVELS.length ? 1 : 0) +
    (filter.startTime || filter.endTime ? 1 : 0) +
    (filter.useRegex ? 1 : 0);

  const timeRangeOptions = useMemo(
    () => ({
      all: t("logs.timeRangeAll"),
      "1h": t("logs.timeRangeLastHour"),
      "24h": t("logs.timeRangeLast24Hours"),
      "7d": t("logs.timeRangeLast7Days"),
      custom: t("logs.timeRangeCustom"),
    }),
    [t],
  );

  const handleExport = useCallback(
    (format: "txt" | "json") => {
      if (onExport) {
        onExport(format);
        return;
      }

      const logs = useLogStore.getState().logs;
      const content =
        format === "json"
          ? JSON.stringify(logs, null, 2)
          : logs
              .map((log) => {
                const date = new Date(log.timestamp);
                const timestamp = date.toISOString();
                return `[${timestamp}][${log.level.toUpperCase()}]${log.target ? `[${log.target}]` : ""} ${log.message}`;
              })
              .join("\n");

      const mimeType = format === "json" ? "application/json" : "text/plain";
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cognia-logs-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [onExport],
  );

  const handlePresetChange = useCallback(
    (value: string) => {
      if (!PRESET_ORDER.includes(value as TimeRangePreset)) return;
      const preset = value as TimeRangePreset;
      setTimeRangePreset(preset);
      const now = Date.now();

      if (preset === "all") {
        setTimeRange(null, null);
        return;
      }

      if (preset === "1h") {
        setTimeRange(now - 60 * 60 * 1000, now);
        return;
      }

      if (preset === "24h") {
        setTimeRange(now - 24 * 60 * 60 * 1000, now);
        return;
      }

      if (preset === "7d") {
        setTimeRange(now - 7 * 24 * 60 * 60 * 1000, now);
        return;
      }

      setCustomStart(formatDateTimeInput(filter.startTime));
      setCustomEnd(formatDateTimeInput(filter.endTime));
    },
    [filter.endTime, filter.startTime, setTimeRange],
  );

  const handleCustomStartChange = useCallback(
    (value: string) => {
      setCustomStart(value);
      setTimeRange(parseDateTimeInput(value), parseDateTimeInput(customEnd));
    },
    [customEnd, setTimeRange],
  );

  const handleCustomEndChange = useCallback(
    (value: string) => {
      setCustomEnd(value);
      setTimeRange(parseDateTimeInput(customStart), parseDateTimeInput(value));
    },
    [customStart, setTimeRange],
  );

  const handleRegexToggle = useCallback(
    (checked: boolean) => {
      setFilter({ useRegex: checked });
    },
    [setFilter],
  );

  const handleMaxLogsChange = useCallback(
    (value: string) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
        setMaxLogs(Math.max(100, parsed));
      }
    },
    [setMaxLogs],
  );

  return (
    <div className="flex flex-col gap-2 p-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Primary row - Search and main actions */}
      <div className="flex items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={t("logs.searchPlaceholder")}
            value={filter.search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 h-9"
          />
          {filter.search && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => setSearch("")}
              aria-label={t("logs.clearSearch")}
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          )}
        </div>

        {/* Level filter dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 shrink-0"
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">{t("logs.filter")}</span>
              {filter.levels.length < ALL_LEVELS.length && (
                <Badge className="ml-0.5 h-5 w-5 p-0 text-[10px]">
                  {filter.levels.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs font-medium">
              {t("logs.logLevels")}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ALL_LEVELS.map((level) => (
              <DropdownMenuCheckboxItem
                key={level}
                checked={filter.levels.includes(level)}
                onCheckedChange={() => toggleLevel(level)}
                className="gap-2"
              >
                <span
                  className={cn("font-mono text-xs font-semibold", LEVEL_COLORS[level])}
                >
                  {level.toUpperCase()}
                </span>
                <span className="ml-auto tabular-nums text-xs text-muted-foreground">
                  {stats.byLevel[level]}
                </span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Advanced filters toggle */}
        <Button
          variant={
            showAdvanced || activeFiltersCount > 0 ? "secondary" : "outline"
          }
          size="sm"
          className="h-9 gap-1.5 shrink-0"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <span className="hidden sm:inline">{t("logs.advanced")}</span>
          {activeFiltersCount > 0 && (
            <Badge className="h-5 w-5 p-0 text-[10px]">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>

        {/* Separator */}
        <Separator orientation="vertical" className="hidden sm:block h-6" />

        {/* Realtime controls */}
        {showRealtimeControls && (
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  pressed={paused}
                  onPressedChange={togglePaused}
                  size="sm"
                  className="h-9 w-9 p-0"
                  aria-label={paused ? t("logs.resume") : t("logs.pause")}
                >
                  {paused ? (
                    <Play className="h-4 w-4 text-green-500" />
                  ) : (
                    <Pause className="h-4 w-4" />
                  )}
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>
                {paused ? t("logs.resume") : t("logs.pause")}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  pressed={autoScroll}
                  onPressedChange={toggleAutoScroll}
                  size="sm"
                  className="h-9 w-9 p-0"
                  aria-label={
                    autoScroll
                      ? t("logs.autoScrollOn")
                      : t("logs.autoScrollOff")
                  }
                >
                  <ArrowDownToLine
                    className={cn("h-4 w-4", autoScroll ? "text-primary" : "text-muted-foreground")}
                  />
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>
                {autoScroll
                  ? t("logs.autoScrollOn")
                  : t("logs.autoScrollOff")}
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Export menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              aria-label={t("logs.export")}
            >
              <Download className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport("txt")}>
              {t("logs.exportTxt")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("json")}>
              {t("logs.exportJson")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Clear button */}
        {showRealtimeControls && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={clearLogs}
                aria-label={t("logs.clear")}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("logs.clear")}</TooltipContent>
          </Tooltip>
        )}

        {/* Stats badge */}
        {showRealtimeControls && (
          <Badge
            variant="secondary"
            className="hidden md:flex items-center gap-2 px-3 py-1.5 text-xs tabular-nums"
          >
            <span className="text-muted-foreground">{t("logs.total")}:</span>
            <span className="font-medium">{stats.total}</span>
            {paused && (
              <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                • {t("logs.paused")}
              </span>
            )}
          </Badge>
        )}
      </div>

      {/* Advanced filters row - collapsible */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleContent>
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-dashed">
            {/* Time range */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">
                {t("logs.timeRange")}:
              </span>
              <Select value={timeRangePreset} onValueChange={handlePresetChange}>
                <SelectTrigger className="h-8 w-[120px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{timeRangeOptions.all}</SelectItem>
                  <SelectItem value="1h">{timeRangeOptions["1h"]}</SelectItem>
                  <SelectItem value="24h">{timeRangeOptions["24h"]}</SelectItem>
                  <SelectItem value="7d">{timeRangeOptions["7d"]}</SelectItem>
                  <SelectItem value="custom">
                    {timeRangeOptions.custom}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {timeRangePreset === "custom" && (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="datetime-local"
                  className="h-8 w-[160px] text-xs"
                  value={customStart}
                  onChange={(event) =>
                    handleCustomStartChange(event.target.value)
                  }
                  aria-label={t("logs.timeRangeStart")}
                />
                <span className="text-xs text-muted-foreground">→</span>
                <Input
                  type="datetime-local"
                  className="h-8 w-[160px] text-xs"
                  value={customEnd}
                  onChange={(event) => handleCustomEndChange(event.target.value)}
                  aria-label={t("logs.timeRangeEnd")}
                />
              </div>
            )}

            <Separator orientation="vertical" className="h-5 hidden sm:block" />

            {/* Regex toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="regex-toggle"
                checked={Boolean(filter.useRegex)}
                onCheckedChange={handleRegexToggle}
              />
              <Label
                htmlFor="regex-toggle"
                className="text-xs text-muted-foreground cursor-pointer"
              >
                {t("logs.regex")}
              </Label>
            </div>

            {showMaxLogs && (
              <>
                <Separator
                  orientation="vertical"
                  className="h-5 hidden sm:block"
                />
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="max-logs"
                    className="text-xs text-muted-foreground shrink-0"
                  >
                    {t("logs.maxLogs")}:
                  </Label>
                  <Input
                    id="max-logs"
                    type="number"
                    min={100}
                    step={100}
                    value={maxLogs}
                    onChange={(event) => handleMaxLogsChange(event.target.value)}
                    className="h-8 w-24"
                  />
                </div>
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
