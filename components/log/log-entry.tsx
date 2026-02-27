"use client";

import { cn } from "@/lib/utils";
import { writeClipboard } from '@/lib/clipboard';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { useState, useCallback, useMemo, type ReactNode } from "react";
import { useLocale } from "@/components/providers/locale-provider";
import type { LogEntry as LogEntryType } from "@/types/log";
import { LEVEL_STYLES, LEVEL_LABELS } from "@/lib/constants/log";
import { escapeRegExp, formatLogTimestamp } from "@/lib/log";

interface LogEntryProps {
  entry: LogEntryType;
  showTimestamp?: boolean;
  showTarget?: boolean;
  highlightText?: string;
  highlightRegex?: boolean;
  allowCollapse?: boolean;
}

export function LogEntry({
  entry,
  showTimestamp = true,
  showTarget = true,
  highlightText,
  highlightRegex = false,
  allowCollapse = false,
}: LogEntryProps) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const style = LEVEL_STYLES[entry.level];
  const isExpandable =
    allowCollapse &&
    (entry.message.length > 160 || entry.message.includes("\n"));

  const handleCopy = useCallback(async () => {
    try {
      const text = `[${formatLogTimestamp(entry.timestamp)}][${entry.level.toUpperCase()}]${entry.target ? `[${entry.target}]` : ""} ${entry.message}`;
      await writeClipboard(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard errors
    }
  }, [entry]);

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
    <div
      className={cn(
        "group relative flex items-start gap-3 px-4 py-2.5 font-mono text-xs transition-colors",
        "hover:bg-muted/40 dark:hover:bg-muted/20",
      )}
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
        <span className="shrink-0 text-muted-foreground/60 text-[11px] max-w-[140px] truncate pt-0.5">
          {entry.target}
        </span>
      )}

      {/* Message content */}
      <span
        className={cn(
          "flex-1 break-words whitespace-pre-wrap leading-relaxed text-foreground/90",
          isExpandable &&
            !expanded &&
            "max-h-[3.5rem] overflow-hidden relative",
          isExpandable &&
            !expanded &&
            "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-4 after:bg-gradient-to-t after:from-background/80 after:to-transparent",
        )}
      >
        {highlightNodes}
      </span>

      {/* Action buttons */}
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
              onClick={handleCopy}
              aria-label={t("logs.copyEntry")}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("logs.copyEntry")}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
