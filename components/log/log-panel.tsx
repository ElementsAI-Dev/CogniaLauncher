"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LogEntry } from "./log-entry";
import { LogToolbar } from "./log-toolbar";
import { useLogStore } from "@/lib/stores/log";
import { useLocale } from "@/components/providers/locale-provider";
import { FileText } from "lucide-react";

function EmptyState() {
  const { t } = useLocale();
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[280px] text-muted-foreground px-4">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl scale-150" />
        <FileText className="relative h-16 w-16 mb-6 text-muted-foreground/40" />
      </div>
      <p className="text-base font-medium text-foreground/70">
        {t("logs.noLogs")}
      </p>
      <p className="text-sm mt-2 text-center max-w-[280px]">
        {t("logs.noLogsDescription")}
      </p>
    </div>
  );
}

interface LogPanelProps {
  className?: string;
  showToolbar?: boolean;
  maxHeight?: string;
}

/**
 * Log panel component for displaying log entries.
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

  const filteredLogs = getFilteredLogs();

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [filteredLogs.length, autoScroll]);

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-lg border bg-card ${className}`}
      style={{ maxHeight }}
    >
      {showToolbar && <LogToolbar />}

      <ScrollArea ref={scrollRef} className="flex-1 min-h-0">
        {filteredLogs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-border/30">
            {filteredLogs.map((entry) => (
              <LogEntry
                key={entry.id}
                entry={entry}
                highlightText={filter.search}
                highlightRegex={Boolean(filter.useRegex)}
                allowCollapse
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
