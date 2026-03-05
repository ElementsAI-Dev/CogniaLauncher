"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { LogEntry as UiLogEntry } from "@/types/log";
import { normalizeLevel, parseTimestamp } from "@/lib/log";
import { useLocale } from "@/components/providers/locale-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { FileText, Loader2, RefreshCw, ArrowDownToLine } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
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

export function LogFileViewer({
  open,
  fileName,
  onOpenChange,
}: LogFileViewerProps) {
  const { t } = useLocale();
  const { filter } = useLogStore();
  const { queryLogFile, exportLogFile } = useLogs();
  const [entries, setEntries] = useState<UiLogEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  const requestSequenceRef = useRef(0);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const rowObserversRef = useRef<Map<string, ResizeObserver>>(new Map());

  const queryOptions = useMemo(
    () => ({
      fileName: fileName ?? undefined,
      levelFilter: filter.levels.map((level) => level.toUpperCase()),
      search: filter.search || undefined,
      useRegex: filter.useRegex,
      maxScanLines:
        filter.maxScanLines && filter.maxScanLines > 0
          ? filter.maxScanLines
          : undefined,
      startTime: filter.startTime ?? undefined,
      endTime: filter.endTime ?? undefined,
    }),
    [
      fileName,
      filter.endTime,
      filter.levels,
      filter.maxScanLines,
      filter.search,
      filter.startTime,
      filter.useRegex,
    ],
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

        if (!result) {
          setEntries([]);
          setHasMore(false);
          setTotalCount(0);
          return;
        }

        const nextEntries = result.entries.map(mapEntry);
        setEntries((prev) =>
          append ? [...nextEntries, ...prev] : nextEntries,
        );
        setHasMore(result.hasMore);
        setTotalCount(result.totalCount);
      } catch (error) {
        if (requestId !== requestSequenceRef.current) {
          return;
        }
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

  const handleRefresh = useCallback(() => {
    loadEntries(0, false);
  }, [loadEntries]);

  const handleLoadMore = useCallback(() => {
    loadEntries(entries.length, true);
  }, [entries.length, loadEntries]);

  const handleExport = useCallback(
    async (format: "txt" | "json" | "csv") => {
      if (!fileName) return;
      // Backend only supports txt/json; csv is handled by frontend-only exportLogs
      const backendFormat = format === "csv" ? "txt" : format;
      const exportQueryOptions = {
        fileName: queryOptions.fileName,
        levelFilter: queryOptions.levelFilter,
        search: queryOptions.search,
        useRegex: queryOptions.useRegex,
        startTime: queryOptions.startTime,
        endTime: queryOptions.endTime,
      };
      try {
        const result = await exportLogFile({
          ...exportQueryOptions,
          format: backendFormat,
        });
        if (!result) return;

        const mimeType = format === "json" ? "application/json" : "text/plain";
        const blob = new Blob([result.content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = result.fileName;
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

  useEffect(() => {
    if (!open || !fileName) {
      requestSequenceRef.current += 1;
      setLoading(false);
      setFollowing(false);
      setScrollTop(0);
      setRowHeights({});
      return;
    }
    loadEntries(0, false);
  }, [fileName, loadEntries, open]);

  useEffect(
    () => () => {
      requestSequenceRef.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (!open) return;

    const scrollRoot = scrollAreaRef.current;
    if (!scrollRoot) return;

    const viewport = scrollRoot.querySelector(
      "[data-slot='scroll-area-viewport']",
    ) as HTMLDivElement | null;

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
    };
  }, [open, entries.length]);

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
  const { logFiles } = useLogStore();
  const isCurrentSession = logFiles.length > 0 && logFiles[0]?.name === fileName;

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
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-3 sm:px-6 sm:py-4"
        >
          <div className="shrink-0">
            <LogToolbar
              onExport={handleExport}
              showRealtimeControls={false}
              showMaxLogs={false}
              showQueryScanLimit
            />
          </div>

          <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{t("logs.fileEntries", { count: totalCount })}</span>
            <div className="flex flex-wrap items-center gap-1">
              {isCurrentSession && (
                <Toggle
                  pressed={following}
                  onPressedChange={setFollowing}
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

          <ScrollArea
            ref={scrollAreaRef}
            data-testid="log-file-viewer-scroll-area"
            className="h-full min-h-0 flex-1 rounded-lg border"
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
                        highlightText={filter.search}
                        highlightRegex={Boolean(filter.useRegex)}
                        allowCollapse
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
