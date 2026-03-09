"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LogToolbar } from "./log-toolbar";
import { LogEntry } from "./log-entry";
import { useLogs } from "@/hooks/use-logs";
import { useLogStore } from "@/lib/stores/log";
import type { LogEntry as UiLogEntry, LogFilter, LogLevel } from "@/types/log";
import { normalizeLevel, parseTimestamp } from "@/lib/log";
import { useLocale } from "@/components/providers/locale-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { FileText, Loader2, RefreshCw, ArrowDownToLine } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import { writeClipboard } from "@/lib/clipboard";
import { toast } from "sonner";

interface LogFileViewerProps {
  open: boolean;
  fileName: string | null;
  onOpenChange: (open: boolean) => void;
}

const PAGE_SIZE = 200;
const FOLLOW_MODE_MAX_SCAN_LINES = 20_000;
const VIRTUAL_ESTIMATED_ROW_HEIGHT = 56;
const VIRTUAL_OVERSCAN_PX = 640;
const SCROLL_ADJUSTMENT_RETRIES = 6;
const DEFAULT_HISTORICAL_FILTER: LogFilter = {
  levels: ["info", "warn", "error"],
  search: "",
  useRegex: false,
  target: undefined,
  maxScanLines: null,
  startTime: null,
  endTime: null,
};

function findNearestEntryIndex(offsets: number[], targetOffset: number): number {
  if (offsets.length <= 1) return 0;

  let low = 0;
  let high = offsets.length - 1;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (offsets[mid] <= targetOffset) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return Math.max(0, Math.min(offsets.length - 2, low - 1));
}

type PendingScrollIntent =
  | { type: "top" }
  | { type: "tail"; remainingAdjustments: number }
  | {
      type: "preserve-anchor";
      entryId: string;
      offsetWithinViewport: number;
      remainingAdjustments: number;
    };

export function LogFileViewer({
  open,
  fileName,
  onOpenChange,
}: LogFileViewerProps) {
  const { t } = useLocale();
  const logFiles = useLogStore((state) => state.logFiles);
  const { queryLogFile, exportLogFile } = useLogs();
  const [entries, setEntries] = useState<UiLogEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState(false);
  const [historicalFilter, setHistoricalFilter] = useState<LogFilter>(
    DEFAULT_HISTORICAL_FILTER,
  );
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  const requestSequenceRef = useRef(0);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const followingRef = useRef(false);
  const pendingScrollIntentRef = useRef<PendingScrollIntent | null>(null);
  const lastLoadedFileRef = useRef<string | null>(null);
  const rowObserversRef = useRef<Map<string, ResizeObserver>>(new Map());
  const controlsRegionId = useId();
  const statusRegionId = useId();
  const contentRegionDescriptionId = useId();

  const getScrollViewport = useCallback(() => {
    if (viewportRef.current?.isConnected) {
      return viewportRef.current;
    }

    const scrollRoot = scrollAreaRef.current;
    if (!scrollRoot) return null;

    const viewport = scrollRoot.querySelector(
      "[data-slot='scroll-area-viewport']",
    ) as HTMLDivElement | null;

    if (viewport) {
      viewportRef.current = viewport;
    }

    return viewport;
  }, []);

  const createTailScrollIntent = useCallback(
    (): PendingScrollIntent => ({
      type: "tail",
      remainingAdjustments: SCROLL_ADJUSTMENT_RETRIES,
    }),
    [],
  );

  const queryOptions = useMemo(
    () => ({
      fileName: fileName ?? undefined,
      levelFilter: historicalFilter.levels.map((level) => level.toUpperCase()),
      search: historicalFilter.search || undefined,
      useRegex: historicalFilter.useRegex,
      maxScanLines:
        historicalFilter.maxScanLines && historicalFilter.maxScanLines > 0
          ? historicalFilter.maxScanLines
          : undefined,
      startTime: historicalFilter.startTime ?? undefined,
      endTime: historicalFilter.endTime ?? undefined,
      target: historicalFilter.target || undefined,
    }),
    [
      fileName,
      historicalFilter.endTime,
      historicalFilter.levels,
      historicalFilter.maxScanLines,
      historicalFilter.search,
      historicalFilter.startTime,
      historicalFilter.target,
      historicalFilter.useRegex,
    ],
  );

  const handleHistoricalSearchChange = useCallback((search: string) => {
    setHistoricalFilter((prev) => ({ ...prev, search }));
  }, []);

  const handleHistoricalFilterChange = useCallback((next: Partial<LogFilter>) => {
    setHistoricalFilter((prev) => ({ ...prev, ...next }));
  }, []);

  const handleHistoricalToggleLevel = useCallback((level: LogLevel) => {
    setHistoricalFilter((prev) => {
      const nextLevels = [...prev.levels];
      const index = nextLevels.indexOf(level);
      if (index === -1) {
        nextLevels.push(level);
      } else {
        nextLevels.splice(index, 1);
      }
      return { ...prev, levels: nextLevels };
    });
  }, []);

  const handleHistoricalTimeRangeChange = useCallback(
    (startTime: number | null, endTime: number | null) => {
      setHistoricalFilter((prev) => ({ ...prev, startTime, endTime }));
    },
    [],
  );

  const mapEntry = useCallback(
    (entry: {
      timestamp: string;
      level: string;
      target: string;
      message: string;
      lineNumber: number;
    }): UiLogEntry => ({
      id: `file-${fileName ?? "log"}-${entry.lineNumber}`,
      timestamp: parseTimestamp(entry.timestamp),
      level: normalizeLevel(entry.level),
      message: entry.message,
      target: entry.target || undefined,
      file: fileName ?? undefined,
      line: entry.lineNumber,
    }),
    [fileName],
  );

  const loadEntries = useCallback(
    async (offset = 0, append = false, maxScanLines?: number) => {
      if (!fileName) return;
      const requestId = ++requestSequenceRef.current;
      setLoading(true);
      try {
        const result = await queryLogFile({
          ...queryOptions,
          limit: PAGE_SIZE,
          offset,
          maxScanLines: maxScanLines ?? queryOptions.maxScanLines,
        });

        if (requestId !== requestSequenceRef.current) {
          return;
        }

        if (!result.ok) {
          pendingScrollIntentRef.current = null;
          setEntries([]);
          setHasMore(false);
          setTotalCount(0);
          toast.error(result.error || t("logs.loadEntriesError"));
          return;
        }

        const nextEntries = result.data.entries.map(mapEntry);
        setEntries((prev) =>
          append ? [...nextEntries, ...prev] : nextEntries,
        );
        setHasMore(result.data.hasMore);
        setTotalCount(result.data.totalCount);
      } catch (error) {
        if (requestId !== requestSequenceRef.current) {
          return;
        }
        pendingScrollIntentRef.current = null;
        console.error("Failed to load log entries:", error);
        toast.error(t("logs.loadEntriesError"));
      } finally {
        if (requestId === requestSequenceRef.current) {
          setLoading(false);
        }
      }
    },
    [fileName, mapEntry, queryLogFile, queryOptions, t],
  );

  const setMeasuredRowRef = useCallback(
    (entryId: string) => (node: HTMLDivElement | null) => {
      const existingObserver = rowObserversRef.current.get(entryId);
      if (existingObserver) {
        existingObserver.disconnect();
        rowObserversRef.current.delete(entryId);
      }

      if (!node || typeof ResizeObserver === "undefined") return;

      const updateHeight = () => {
        const nextHeight = Math.ceil(node.getBoundingClientRect().height);
        if (nextHeight <= 0) return;
        setRowHeights((prev) =>
          prev[entryId] === nextHeight ? prev : { ...prev, [entryId]: nextHeight },
        );
      };

      updateHeight();
      const observer = new ResizeObserver(() => updateHeight());
      observer.observe(node);
      rowObserversRef.current.set(entryId, observer);
    },
    [],
  );

  const rowOffsets = useMemo(() => {
    const offsets = new Array(entries.length + 1);
    offsets[0] = 0;
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      offsets[index + 1] =
        offsets[index] + (rowHeights[entry.id] ?? VIRTUAL_ESTIMATED_ROW_HEIGHT);
    }
    return offsets;
  }, [entries, rowHeights]);

  const totalVirtualHeight = rowOffsets[entries.length] ?? 0;

  const visibleRange = useMemo(() => {
    if (entries.length === 0) {
      return { startIndex: 0, endIndex: -1 };
    }

    const viewportBottom = scrollTop + Math.max(1, viewportHeight);
    const startIndex = findNearestEntryIndex(
      rowOffsets,
      Math.max(0, scrollTop - VIRTUAL_OVERSCAN_PX),
    );
    const endIndex = Math.min(
      entries.length - 1,
      findNearestEntryIndex(rowOffsets, viewportBottom + VIRTUAL_OVERSCAN_PX),
    );

    return { startIndex, endIndex: Math.max(startIndex, endIndex) };
  }, [entries.length, rowOffsets, scrollTop, viewportHeight]);

  const visibleRows = useMemo(() => {
    const { startIndex, endIndex } = visibleRange;
    if (endIndex < startIndex) return [];

    return entries.slice(startIndex, endIndex + 1).map((entry, localIndex) => {
      const index = startIndex + localIndex;
      return {
        entry,
        top: rowOffsets[index] ?? 0,
      };
    });
  }, [entries, rowOffsets, visibleRange]);

  const createPreserveAnchorIntent = useCallback((): PendingScrollIntent | null => {
    if (entries.length === 0) return null;

    const currentScrollTop = getScrollViewport()?.scrollTop ?? scrollTop;
    const anchorIndex = findNearestEntryIndex(rowOffsets, currentScrollTop);
    const anchorEntry = entries[anchorIndex];
    if (!anchorEntry) return null;

    return {
      type: "preserve-anchor",
      entryId: anchorEntry.id,
      offsetWithinViewport: currentScrollTop - (rowOffsets[anchorIndex] ?? 0),
      remainingAdjustments: SCROLL_ADJUSTMENT_RETRIES,
    };
  }, [entries, getScrollViewport, rowOffsets, scrollTop]);

  const handleRefresh = useCallback(() => {
    pendingScrollIntentRef.current = followingRef.current
      ? createTailScrollIntent()
      : { type: "top" };
    loadEntries(0, false);
  }, [createTailScrollIntent, loadEntries]);

  const handleLoadMore = useCallback(() => {
    pendingScrollIntentRef.current = createPreserveAnchorIntent();
    loadEntries(entries.length, true);
  }, [createPreserveAnchorIntent, entries.length, loadEntries]);

  const handleExport = useCallback(
    async (format: "txt" | "json" | "csv") => {
      if (!fileName) return;
      const exportQueryOptions = {
        fileName: queryOptions.fileName,
        levelFilter: queryOptions.levelFilter,
        target: queryOptions.target,
        search: queryOptions.search,
        useRegex: queryOptions.useRegex,
        startTime: queryOptions.startTime,
        endTime: queryOptions.endTime,
      };
      const result = await exportLogFile({
        ...exportQueryOptions,
        format,
      });

      if (!result.ok) {
        toast.error(result.error || t("logs.exportError"));
        return;
      }

      try {
        const mimeType = format === "json"
          ? "application/json"
          : format === "csv"
            ? "text/csv"
            : "text/plain";
        const blob = new Blob([result.data.content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = result.data.fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        toast.success(t("logs.exportSuccess"));
      } catch (error) {
        console.error("Failed to export log file:", error);
        toast.error(t("logs.exportError"));
      }
    },
    [exportLogFile, fileName, queryOptions, t],
  );

  const handleDiagnosticExport = useCallback(async () => {
    if (!fileName) return;

    const result = await exportLogFile({
      fileName: queryOptions.fileName,
      levelFilter: queryOptions.levelFilter,
      target: queryOptions.target,
      search: queryOptions.search,
      useRegex: queryOptions.useRegex,
      startTime: queryOptions.startTime,
      endTime: queryOptions.endTime,
      format: "json",
      diagnosticMode: true,
      sanitizeSensitive: true,
    });

    if (!result.ok) {
      toast.error(result.error || t("logs.exportError"));
      return;
    }

    try {
      const blob = new Blob([result.data.content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.data.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      toast.success(t("logs.exportSuccess"));
    } catch (error) {
      console.error("Failed to export diagnostic log file:", error);
      toast.error(t("logs.exportError"));
    }
  }, [exportLogFile, fileName, queryOptions, t]);

  useEffect(() => {
    if (!open || !fileName) {
      requestSequenceRef.current += 1;
      pendingScrollIntentRef.current = null;
      lastLoadedFileRef.current = null;
      viewportRef.current = null;
      setLoading(false);
      setFollowing(false);
      followingRef.current = false;
      setScrollTop(0);
      setRowHeights({});
      return;
    }

    pendingScrollIntentRef.current =
      followingRef.current && lastLoadedFileRef.current === fileName
        ? createTailScrollIntent()
        : { type: "top" };
    lastLoadedFileRef.current = fileName;
    loadEntries(0, false);
  }, [createTailScrollIntent, fileName, loadEntries, open]);

  useEffect(() => {
    if (open) return;
    setHistoricalFilter(DEFAULT_HISTORICAL_FILTER);
  }, [open]);

  useEffect(
    () => () => {
      requestSequenceRef.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (!open) return;

    const viewport = getScrollViewport();
    if (!viewport) return;

    const handleScroll = () => {
      setScrollTop(viewport.scrollTop);
    };

    handleScroll();
    setViewportHeight(viewport.clientHeight || 600);
    viewport.addEventListener("scroll", handleScroll, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      setViewportHeight(viewport.clientHeight || 600);
    });
    resizeObserver.observe(viewport);

    return () => {
      viewport.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
      if (viewportRef.current === viewport) {
        viewportRef.current = null;
      }
    };
  }, [getScrollViewport, open]);

  useEffect(() => {
    if (!open || !fileName) return;
    setScrollTop(0);
    setRowHeights({});
  }, [fileName, open]);

  useEffect(() => {
    const knownIds = new Set(entries.map((entry) => entry.id));
    setRowHeights((prev) => {
      let changed = false;
      const next: Record<string, number> = {};
      for (const [id, height] of Object.entries(prev)) {
        if (knownIds.has(id)) {
          next[id] = height;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [entries]);

  useEffect(
    () => () => {
      rowObserversRef.current.forEach((observer) => observer.disconnect());
      rowObserversRef.current.clear();
    },
    [],
  );

  useLayoutEffect(() => {
    if (!open) return;

    const viewport = getScrollViewport();
    const pendingScrollIntent = pendingScrollIntentRef.current;
    if (!viewport || !pendingScrollIntent) return;

    const availableViewportHeight = Math.max(
      1,
      viewport.clientHeight || viewportHeight,
    );
    let nextScrollTop = viewport.scrollTop;
    let nextIntent: PendingScrollIntent | null = null;

    if (pendingScrollIntent.type === "top") {
      nextScrollTop = 0;
    } else if (pendingScrollIntent.type === "tail") {
      nextScrollTop = Math.max(0, totalVirtualHeight - availableViewportHeight);
      if (pendingScrollIntent.remainingAdjustments > 1) {
        nextIntent = {
          ...pendingScrollIntent,
          remainingAdjustments: pendingScrollIntent.remainingAdjustments - 1,
        };
      }
    } else {
      const anchorIndex = entries.findIndex(
        (entry) => entry.id === pendingScrollIntent.entryId,
      );

      if (anchorIndex === -1) {
        pendingScrollIntentRef.current = null;
        return;
      }

      nextScrollTop = Math.max(
        0,
        (rowOffsets[anchorIndex] ?? 0) + pendingScrollIntent.offsetWithinViewport,
      );

      if (pendingScrollIntent.remainingAdjustments > 1) {
        nextIntent = {
          ...pendingScrollIntent,
          remainingAdjustments: pendingScrollIntent.remainingAdjustments - 1,
        };
      }
    }

    if (viewport.scrollTop !== nextScrollTop) {
      viewport.scrollTop = nextScrollTop;
    }
    setScrollTop(nextScrollTop);
    pendingScrollIntentRef.current = nextIntent;
  }, [
    entries,
    getScrollViewport,
    open,
    rowOffsets,
    totalVirtualHeight,
    viewportHeight,
  ]);

  // Follow mode: auto-refresh every 3 seconds for current session file
  useEffect(() => {
    if (!following || !open || !fileName) return;
    const followModeScanLines =
      queryOptions.maxScanLines ?? FOLLOW_MODE_MAX_SCAN_LINES;
    const timer = setInterval(
      () => loadEntries(0, false, followModeScanLines),
      3000,
    );
    return () => clearInterval(timer);
  }, [following, open, fileName, loadEntries, queryOptions.maxScanLines]);

  // Determine if this is the current session (first/newest file)
  const isCurrentSession = logFiles.length > 0 && logFiles[0]?.name === fileName;
  const selectedLogPath = useMemo(
    () => logFiles.find((file) => file.name === fileName)?.path ?? null,
    [fileName, logFiles],
  );
  const primaryContentRegionLabel = fileName
    ? `${t("logs.fileViewerTitle")}: ${fileName}`
    : t("logs.fileViewerTitle");

  const handleCopyFilePath = useCallback(async () => {
    if (!selectedLogPath) return;
    try {
      await writeClipboard(selectedLogPath);
      toast.success(t("logs.copyPathSuccess"));
    } catch {
      toast.error(t("logs.copyPathFailed"));
    }
  }, [selectedLogPath, t]);

  const handleFollowingChange = useCallback(
    (nextFollowing: boolean) => {
      setFollowing(nextFollowing);
      followingRef.current = nextFollowing;
      if (nextFollowing) {
        pendingScrollIntentRef.current = createTailScrollIntent();
      }
    },
    [createTailScrollIntent],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,72rem)] max-w-5xl max-h-[85dvh] min-h-0 overflow-hidden p-0 gap-0 flex flex-col">
        <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6 sm:py-4">
          <DialogTitle>{t("logs.fileViewerTitle")}</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {fileName}
          </DialogDescription>
        </DialogHeader>

        <div
          data-testid="log-file-viewer-body"
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card"
        >
          <section
            aria-labelledby={controlsRegionId}
            className="shrink-0 border-b p-3 sm:p-4"
          >
            <h2 id={controlsRegionId} className="sr-only">
              {t("logs.filter")}
            </h2>
            <LogToolbar
              onExport={handleExport}
              onDiagnosticExport={handleDiagnosticExport}
              showRealtimeControls={false}
              showMaxLogs={false}
              showQueryScanLimit
              presetScope="historical"
              filterState={historicalFilter}
              onSearchChange={handleHistoricalSearchChange}
              onToggleLevel={handleHistoricalToggleLevel}
              onFilterChange={handleHistoricalFilterChange}
              onTimeRangeChange={handleHistoricalTimeRangeChange}
              showBookmarksToggle={false}
            />
          </section>

          <section
            id={statusRegionId}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="shrink-0 border-b px-3 py-2 text-xs text-muted-foreground sm:px-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{t("logs.fileEntries", { count: totalCount })}</span>
              <div
                className="flex flex-wrap items-center gap-1"
                role="group"
                aria-label="Historical viewer actions"
              >
                {selectedLogPath && (
                  <Button variant="ghost" size="sm" onClick={handleCopyFilePath}>
                    {t("logs.copyFilePath")}
                  </Button>
                )}
                {isCurrentSession && (
                  <Toggle
                    pressed={following}
                    onPressedChange={handleFollowingChange}
                    size="sm"
                    className="h-8 gap-1 px-2"
                    aria-label={t("logs.follow")}
                  >
                    <ArrowDownToLine className={cn("h-3 w-3", following && "text-primary")} />
                    <span className="text-xs">{t("logs.follow")}</span>
                  </Toggle>
                )}
                <Button variant="ghost" size="sm" onClick={handleRefresh}>
                  <RefreshCw className="mr-2 h-3 w-3" />
                  {t("common.refresh")}
                </Button>
              </div>
            </div>
          </section>

          <section
            role="region"
            aria-label={primaryContentRegionLabel}
            aria-describedby={contentRegionDescriptionId}
            className="min-h-0 flex-1 p-3 sm:p-4"
          >
            <p id={contentRegionDescriptionId} className="sr-only">
              {fileName ? `${fileName}. ` : ""}
              {t("logs.fileEntries", { count: totalCount })}
            </p>
            <ScrollArea
              ref={scrollAreaRef}
              data-testid="log-file-viewer-scroll-area"
              className="h-full min-h-0 flex-1 rounded-md"
            >
              {loading && entries.length === 0 ? (
                <div className="divide-y divide-border/50 p-1">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 px-4 py-2.5"
                    >
                      <Skeleton className="h-4 w-20 shrink-0" />
                      <Skeleton className="h-5 w-10 shrink-0 rounded-full" />
                      <Skeleton className="h-4 w-16 shrink-0" />
                      <Skeleton className="h-4 flex-1" />
                    </div>
                  ))}
                </div>
              ) : entries.length === 0 ? (
                <Empty className="h-full border-none">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileText />
                    </EmptyMedia>
                    <EmptyTitle className="text-sm font-normal text-muted-foreground">
                      {t("logs.noFileEntries")}
                    </EmptyTitle>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="divide-y divide-border/50">
                  {hasMore && (
                    <div className="p-3 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLoadMore}
                        disabled={loading}
                      >
                        {loading ? (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : null}
                        {t("logs.loadMore")}
                      </Button>
                    </div>
                  )}
                  <div
                    data-testid="log-file-viewer-virtual-list"
                    className="relative"
                    style={{ height: totalVirtualHeight }}
                  >
                    {visibleRows.map(({ entry, top }) => (
                      <div
                        key={entry.id}
                        ref={setMeasuredRowRef(entry.id)}
                        data-testid="log-file-viewer-virtual-row"
                        className="absolute left-0 right-0 border-b border-border/50"
                        style={{ top }}
                      >
                        <LogEntry
                          entry={entry}
                          highlightText={historicalFilter.search}
                          highlightRegex={Boolean(historicalFilter.useRegex)}
                          allowCollapse
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ScrollArea>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
