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
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Toggle } from "@/components/ui/toggle";
import { useLogStore } from "@/lib/stores/log";
import { useLogs } from "@/hooks/use-logs";
import { ALL_LEVELS, LEVEL_COLORS, LEVEL_STYLES, KNOWN_TARGETS } from "@/lib/constants/log";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LogFilter, LogLevel, LogPresetScope } from "@/types/log";

interface LogToolbarProps {
  onExport?: (format: "txt" | "json" | "csv") => void;
  onDiagnosticExport?: () => void;
  showRealtimeControls?: boolean;
  showMaxLogs?: boolean;
  showQueryScanLimit?: boolean;
  showPresetControls?: boolean;
  presetScope?: LogPresetScope;
  filterState?: LogFilter;
  onSearchChange?: (search: string) => void;
  onToggleLevel?: (level: LogLevel) => void;
  onFilterChange?: (filter: Partial<LogFilter>) => void;
  onTimeRangeChange?: (startTime: number | null, endTime: number | null) => void;
  showBookmarksOnly?: boolean;
  onShowBookmarksOnlyChange?: (show: boolean) => void;
  showBookmarksToggle?: boolean;
}

type TimeRangePreset = "all" | "1h" | "24h" | "7d" | "custom";

const PRESET_ORDER: TimeRangePreset[] = ["all", "1h", "24h", "7d", "custom"];
const MIN_SCAN_LINES = 1_000;
const MAX_SCAN_LINES = 200_000;
const SCAN_LINE_PRESETS = [5_000, 20_000, 50_000] as const;

export function LogToolbar({
  onExport,
  onDiagnosticExport,
  showRealtimeControls = true,
  showMaxLogs = true,
  showQueryScanLimit = false,
  showPresetControls = true,
  presetScope = "realtime",
  filterState,
  onSearchChange,
  onToggleLevel,
  onFilterChange,
  onTimeRangeChange,
  showBookmarksOnly,
  onShowBookmarksOnlyChange,
  showBookmarksToggle = true,
}: LogToolbarProps) {
  const { t } = useLocale();
  const {
    filter: storeFilter,
    autoScroll,
    paused,
    maxLogs,
    setSearch: setStoreSearch,
    toggleLevel: toggleStoreLevel,
    setFilter: setStoreFilter,
    setTimeRange: setStoreTimeRange,
    toggleAutoScroll,
    togglePaused,
    clearLogs,
    setMaxLogs,
    getLogStats,
    showBookmarksOnly: storeShowBookmarksOnly,
    setShowBookmarksOnly: setStoreShowBookmarksOnly,
    saveFilterPreset,
    deleteFilterPreset,
    getFilterPresets,
  } = useLogStore();
  const { exportLogs } = useLogs();
  const filter = filterState ?? storeFilter;
  const setSearch = onSearchChange ?? setStoreSearch;
  const toggleLevel = onToggleLevel ?? toggleStoreLevel;
  const setFilter = onFilterChange ?? setStoreFilter;
  const setTimeRange = onTimeRangeChange ?? setStoreTimeRange;
  const activeShowBookmarksOnly = showBookmarksOnly ?? storeShowBookmarksOnly;
  const setShowBookmarksOnly = onShowBookmarksOnlyChange ?? setStoreShowBookmarksOnly;

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
  const [localSearch, setLocalSearch] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string>("none");
  const searchValue = localSearch ?? filter.search;
  const scopedPresets = getFilterPresets(presetScope);

  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value);
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
      searchDebounceRef.current = setTimeout(() => {
        setSearch(value);
        setLocalSearch((current) => (current === value ? null : current));
      }, 300);
    },
    [setSearch],
  );

  useEffect(() => () => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
  }, []);

  const activeFiltersCount =
    (filter.startTime || filter.endTime ? 1 : 0) +
    (filter.useRegex ? 1 : 0) +
    (filter.target ? 1 : 0) +
    (filter.maxScanLines ? 1 : 0) +
    (showBookmarksToggle && activeShowBookmarksOnly ? 1 : 0);

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
    (format: "txt" | "json" | "csv") => {
      if (onExport) {
        onExport(format);
        return;
      }
      exportLogs(format);
    },
    [onExport, exportLogs],
  );

  const handleDiagnosticExport = useCallback(() => {
    if (onDiagnosticExport) {
      onDiagnosticExport();
      return;
    }
    handleExport("json");
  }, [handleExport, onDiagnosticExport]);

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

  const handleMaxScanLinesChange = useCallback(
    (value: string) => {
      if (!value.trim()) {
        setFilter({ maxScanLines: null });
        return;
      }
      const parsed = Number.parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
        const clamped = Math.min(MAX_SCAN_LINES, Math.max(MIN_SCAN_LINES, parsed));
        setFilter({ maxScanLines: clamped });
      }
    },
    [setFilter],
  );

  const applyFilterPreset = useCallback(
    (presetId: string) => {
      if (presetId === "none") {
        setActivePresetId("none");
        return;
      }
      const preset = scopedPresets.find((item) => item.id === presetId);
      if (!preset) {
        setActivePresetId("none");
        return;
      }

      setLocalSearch(null);
      setSearch(preset.filter.search ?? "");
      setFilter({
        levels: [...preset.filter.levels],
        target: preset.filter.target,
        useRegex: preset.filter.useRegex ?? false,
        maxScanLines: preset.filter.maxScanLines ?? null,
      });
      setTimeRange(
        preset.filter.startTime ?? null,
        preset.filter.endTime ?? null,
      );
      setCustomStart(formatDateTimeInput(preset.filter.startTime));
      setCustomEnd(formatDateTimeInput(preset.filter.endTime));
      setTimeRangePreset(
        preset.filter.startTime || preset.filter.endTime ? "custom" : "all",
      );
      setActivePresetId(presetId);
    },
    [scopedPresets, setFilter, setSearch, setTimeRange],
  );

  const handleSavePreset = useCallback(() => {
    const name = window.prompt(
      t("logs.presetNamePrompt"),
      t("logs.presetDefaultName"),
    );
    if (!name) return;
    const id = saveFilterPreset(name, presetScope, {
      levels: [...filter.levels],
      search: searchValue,
      target: filter.target,
      useRegex: filter.useRegex ?? false,
      maxScanLines: filter.maxScanLines ?? null,
      startTime: filter.startTime ?? null,
      endTime: filter.endTime ?? null,
    });
    setActivePresetId(id);
  }, [filter, presetScope, saveFilterPreset, searchValue, t]);

  const handleDeletePreset = useCallback(() => {
    if (activePresetId === "none") return;
    deleteFilterPreset(activePresetId);
    setActivePresetId("none");
  }, [activePresetId, deleteFilterPreset]);

  return (
    <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
    <div className="flex flex-col gap-2 p-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Primary row - Search and main actions */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search input */}
        <div className="relative min-w-0 flex-1 basis-full sm:basis-auto">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={t("logs.searchPlaceholder")}
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-8 h-9"
          />
          {searchValue && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => {
                if (searchDebounceRef.current) {
                  clearTimeout(searchDebounceRef.current);
                }
                setLocalSearch(null);
                setSearch("");
              }}
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
        <CollapsibleTrigger asChild>
          <Button
            variant={
              showAdvanced || activeFiltersCount > 0 ? "secondary" : "outline"
            }
            size="sm"
            className="h-9 gap-1.5 shrink-0"
          >
            <span className="hidden sm:inline">{t("logs.advanced")}</span>
            {activeFiltersCount > 0 && (
              <Badge className="h-5 w-5 p-0 text-[10px]">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </CollapsibleTrigger>

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
            <DropdownMenuItem onClick={() => handleExport("csv")}>
              {t("logs.exportCsv")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDiagnosticExport}>
              {t("logs.exportDiagnostic")}
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

        {/* Stats badge + level bar */}
        {showRealtimeControls && (
          <div className="hidden md:flex items-center gap-2">
            {stats.total > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="h-2 w-20 rounded-full overflow-hidden bg-muted flex">
                    {ALL_LEVELS.map((level) => {
                      const pct = (stats.byLevel[level] / stats.total) * 100;
                      if (pct === 0) return null;
                      return (
                        <div
                          key={level}
                          className={cn("h-full", LEVEL_STYLES[level].indicator)}
                          style={{ width: `${pct}%` }}
                        />
                      );
                    })}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {ALL_LEVELS.map((level) => (
                    stats.byLevel[level] > 0 && (
                      <span key={level} className={cn("mr-2", LEVEL_COLORS[level])}>
                        {level.toUpperCase()}: {stats.byLevel[level]}
                      </span>
                    )
                  ))}
                </TooltipContent>
              </Tooltip>
            )}
            <Badge
              variant="secondary"
              className="flex items-center gap-2 px-3 py-1.5 text-xs tabular-nums"
            >
              <span className="text-muted-foreground">{t("logs.total")}:</span>
              <span className="font-medium">{stats.total}</span>
              {paused && (
                <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                  • {t("logs.paused")}
                </span>
              )}
            </Badge>
          </div>
        )}
      </div>

      {/* Advanced filters row - collapsible */}
        <CollapsibleContent>
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-dashed">
            {/* Time range */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground shrink-0">
                {t("logs.timeRange")}:
              </Label>
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

            {showPresetControls && (
              <>
                <Separator orientation="vertical" className="h-5 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground shrink-0">
                    {t("logs.presets")}:
                  </Label>
                  <Select value={activePresetId} onValueChange={applyFilterPreset}>
                    <SelectTrigger className="h-8 w-[170px]" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("logs.presetNone")}</SelectItem>
                      {scopedPresets.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          {preset.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" size="sm" variant="outline" className="h-8" onClick={handleSavePreset}>
                    {t("logs.savePreset")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={handleDeletePreset}
                    disabled={activePresetId === "none"}
                  >
                    {t("logs.deletePreset")}
                  </Button>
                </div>
              </>
            )}

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

            {/* Target filter */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground shrink-0">
                {t("logs.targetFilter")}:
              </Label>
              <Select
                value={filter.target ?? "all"}
                onValueChange={(v) => setFilter({ target: v === "all" ? undefined : v })}
              >
                <SelectTrigger className="h-8 w-[140px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("logs.allTargets")}</SelectItem>
                  {KNOWN_TARGETS.map((target) => (
                    <SelectItem key={target} value={target}>
                      {target}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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

            {/* Bookmarks only toggle */}
            {showBookmarksToggle && (
              <>
                <Separator orientation="vertical" className="h-5 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <Switch
                    id="bookmarks-toggle"
                    checked={activeShowBookmarksOnly}
                    onCheckedChange={setShowBookmarksOnly}
                  />
                  <Label
                    htmlFor="bookmarks-toggle"
                    className="text-xs text-muted-foreground cursor-pointer"
                  >
                    {t("logs.bookmarksOnly")}
                  </Label>
                </div>
              </>
            )}

            {showQueryScanLimit && (
              <>
                <Separator
                  orientation="vertical"
                  className="h-5 hidden sm:block"
                />
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="max-scan-lines"
                    className="text-xs text-muted-foreground shrink-0"
                  >
                    {t("logs.maxScanLines")}:
                  </Label>
                  <Input
                    id="max-scan-lines"
                    type="number"
                    min={MIN_SCAN_LINES}
                    max={MAX_SCAN_LINES}
                    step={1_000}
                    value={filter.maxScanLines ?? ""}
                    placeholder="20000"
                    onChange={(event) =>
                      handleMaxScanLinesChange(event.target.value)
                    }
                    className="h-8 w-28"
                  />
                </div>
                <div className="flex items-center gap-1">
                  {SCAN_LINE_PRESETS.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      size="sm"
                      variant={
                        filter.maxScanLines === preset ? "secondary" : "outline"
                      }
                      className="h-7 px-2 text-[11px]"
                      onClick={() => setFilter({ maxScanLines: preset })}
                    >
                      {preset / 1000}k
                    </Button>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant={filter.maxScanLines == null ? "secondary" : "outline"}
                    className="h-7 px-2 text-[11px]"
                    onClick={() => setFilter({ maxScanLines: null })}
                  >
                    {t("logs.scanAll")}
                  </Button>
                </div>
              </>
            )}

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
    </div>
    </Collapsible>
  );
}
