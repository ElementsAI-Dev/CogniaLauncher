"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { LogEntry } from "./log-entry";
import { LogToolbar } from "./log-toolbar";
import { useLogStore } from "@/lib/stores/log";
import { useLocale } from "@/components/providers/locale-provider";
import { FileText } from "lucide-react";

const ROW_HEIGHT = 44;
const OVERSCAN = 5;

function EmptyState() {
  const { t } = useLocale();
  return (
    <Empty className="border-none">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileText />
        </EmptyMedia>
        <EmptyTitle>{t("logs.noLogs")}</EmptyTitle>
        <EmptyDescription>{t("logs.noLogsDescription")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

interface LogPanelProps {
  className?: string;
  showToolbar?: boolean;
  maxHeight?: string;
}

/**
 * Log panel component for displaying log entries with virtualized scrolling.
 *
 * Note: Console interception and Tauri event listeners are handled by LogProvider
 * at the app level. This component only handles UI rendering and auto-scroll.
 */
export function LogPanel({
  className,
  showToolbar = true,
  maxHeight = "100%",
}: LogPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { autoScroll, getFilteredLogs, filter } = useLogStore();
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  const filteredLogs = getFilteredLogs();
  const totalHeight = filteredLogs.length * ROW_HEIGHT;

  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIdx = Math.min(
    filteredLogs.length,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN,
  );
  const visibleLogs = useMemo(
    () => filteredLogs.slice(startIdx, endIdx),
    [filteredLogs, startIdx, endIdx],
  );

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Measure viewport height on mount and resize
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    setViewportHeight(el.clientHeight);
    return () => observer.disconnect();
  }, []);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = totalHeight;
    }
  }, [filteredLogs.length, autoScroll, totalHeight]);

  return (
    <div
      className={cn("flex flex-col overflow-hidden rounded-lg border bg-card", className)}
      style={{ maxHeight }}
    >
      {showToolbar && <LogToolbar />}

      {filteredLogs.length === 0 ? (
        <div className="flex-1 min-h-0">
          <EmptyState />
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-auto"
          onScroll={handleScroll}
        >
          <div style={{ height: totalHeight, position: "relative" }}>
            {visibleLogs.map((entry, i) => (
              <div
                key={entry.id}
                style={{
                  position: "absolute",
                  top: (startIdx + i) * ROW_HEIGHT,
                  height: ROW_HEIGHT,
                  width: "100%",
                }}
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
    </div>
  );
}
