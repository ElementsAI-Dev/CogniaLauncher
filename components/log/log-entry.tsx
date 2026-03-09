"use client";

import { cn } from "@/lib/utils";
import { writeClipboard } from '@/lib/clipboard';
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Copy, ChevronDown, ChevronUp, Star } from "lucide-react";
import { memo, useState, useCallback, useMemo, type ReactNode } from "react";
import { useLocale } from "@/components/providers/locale-provider";
import type { LogEntry as LogEntryType } from "@/types/log";
import { useLogStore } from "@/lib/stores/log";
import { LEVEL_STYLES, LEVEL_LABELS } from "@/lib/constants/log";
import { escapeRegExp, formatLogTimestamp } from "@/lib/log";

interface LogEntryProps {
  entry: LogEntryType;
  showTimestamp?: boolean;
  showTarget?: boolean;
  highlightText?: string;
  highlightRegex?: boolean;
  allowCollapse?: boolean;
  singleLine?: boolean;
}

function areLogEntryPropsEqual(prev: LogEntryProps, next: LogEntryProps): boolean {
  if (
    prev.showTimestamp !== next.showTimestamp ||
    prev.showTarget !== next.showTarget ||
    prev.highlightText !== next.highlightText ||
    prev.highlightRegex !== next.highlightRegex ||
    prev.allowCollapse !== next.allowCollapse ||
    prev.singleLine !== next.singleLine
  ) {
    return false;
  }

  if (prev.entry === next.entry) {
    return true;
  }

  return (
    prev.entry.id === next.entry.id &&
    prev.entry.timestamp === next.entry.timestamp &&
    prev.entry.level === next.entry.level &&
    prev.entry.message === next.entry.message &&
    prev.entry.target === next.entry.target &&
    prev.entry.file === next.entry.file &&
    prev.entry.line === next.entry.line &&
    prev.entry.context === next.entry.context
  );
}

function LogEntryComponent({
  entry,
  showTimestamp = true,
  showTarget = true,
  highlightText,
  highlightRegex = false,
  allowCollapse = false,
  singleLine = false,
}: LogEntryProps) {
  const { t } = useLocale();
  const toggleBookmark = useLogStore((state) => state.toggleBookmark);
  const isBookmarked = useLogStore(
    useCallback((state) => state.bookmarkedIds.includes(entry.id), [entry.id]),
  );
  const [expanded, setExpanded] = useState(false);
  const style = LEVEL_STYLES[entry.level];
  const entrySemanticsLabel = entry.target
    ? `${LEVEL_LABELS[entry.level]} ${entry.target}`
    : LEVEL_LABELS[entry.level];
  const isExpandable =
    allowCollapse &&
    !singleLine &&
    (entry.message.length > 160 || entry.message.includes("\n"));

  const handleCopy = useCallback(async () => {
    try {
      const text = `[${formatLogTimestamp(entry.timestamp)}][${entry.level.toUpperCase()}]${entry.target ? `[${entry.target}]` : ""} ${entry.message}`;
      await writeClipboard(text);
      toast.success(t("common.copied"));
    } catch {
      toast.error(t("common.copyFailed"));
    }
  }, [entry, t]);

  const highlightNodes = useMemo(() => {
    if (!highlightText) return entry.message;

    const pattern = highlightRegex
      ? highlightText
      : escapeRegExp(highlightText);
    let regex: RegExp | null = null;

    try {
      regex = new RegExp(pattern, "gi");
    } catch {
      regex = null;
    }

    if (!regex) return entry.message;

    const nodes: ReactNode[] = [];
    let lastIndex = 0;
    const matches = entry.message.matchAll(regex);

    for (const match of matches) {
      if (match.index === undefined) {
        break;
      }

      if (match[0].length === 0) {
        break;
      }

      const start = match.index;
      const end = start + match[0].length;
      if (start > lastIndex) {
        nodes.push(entry.message.slice(lastIndex, start));
      }
      nodes.push(
        <mark
          key={`${entry.id}-${start}`}
          className="rounded bg-yellow-200/60 px-0.5 text-yellow-900 dark:bg-yellow-400/20 dark:text-yellow-200"
        >
          {match[0]}
        </mark>,
      );
      lastIndex = end;
    }

    if (lastIndex < entry.message.length) {
      nodes.push(entry.message.slice(lastIndex));
    }

    return nodes.length > 0 ? nodes : entry.message;
  }, [entry.id, entry.message, highlightRegex, highlightText]);

  return (
    <article
      className={cn(
        "group relative flex items-start gap-3 px-4 py-2.5 font-mono text-xs transition-colors",
        "hover:bg-muted/40 dark:hover:bg-muted/20",
      )}
      aria-label={entrySemanticsLabel}
    >
      {/* Level indicator bar */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 rounded-r",
          style.indicator,
        )}
      />

      {/* Timestamp */}
      {showTimestamp && (
        <span className="shrink-0 text-muted-foreground/70 tabular-nums text-[11px] pt-0.5">
          {formatLogTimestamp(entry.timestamp)}
        </span>
      )}

      {/* Level badge */}
      <Badge
        variant={style.variant}
        className={cn(
          "shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
          style.className,
        )}
      >
        {LEVEL_LABELS[entry.level]}
      </Badge>

      {/* Target/Source */}
      {showTarget && entry.target && (
        <span className="shrink-0 text-muted-foreground/60 text-[11px] max-w-35 truncate pt-0.5">
          {entry.target}
        </span>
      )}

      {/* Message content */}
      <div
        title={singleLine ? entry.message : undefined}
        className={cn(
          "flex-1 min-w-0 leading-relaxed text-foreground/90",
          singleLine
            ? "overflow-hidden text-ellipsis whitespace-nowrap"
            : "wrap-break-word whitespace-pre-wrap",
          isExpandable &&
            !expanded &&
            "max-h-14 overflow-hidden relative",
          isExpandable &&
            !expanded &&
            "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-4 after:bg-linear-to-t after:from-background/80 after:to-transparent",
        )}
      >
        {highlightNodes}
        {expanded && entry.context && Object.keys(entry.context).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(entry.context).map(([k, v]) => (
              <Badge key={k} variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                {k}={v}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div
        className="shrink-0 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        role="group"
        aria-label="Log entry actions"
      >
        {isExpandable && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setExpanded((prev) => !prev)}
                aria-label={expanded ? t("logs.collapse") : t("logs.expand")}
              >
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {expanded ? t("logs.collapse") : t("logs.expand")}
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => toggleBookmark(entry.id)}
              aria-label={t("logs.bookmark")}
            >
              <Star className={cn("h-3.5 w-3.5", isBookmarked && "fill-yellow-400 text-yellow-400")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("logs.bookmark")}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleCopy}
              aria-label={t("logs.copyEntry")}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("logs.copyEntry")}</TooltipContent>
        </Tooltip>
      </div>
    </article>
  );
}

export const LogEntry = memo(LogEntryComponent, areLogEntryPropsEqual);
LogEntry.displayName = "LogEntry";
