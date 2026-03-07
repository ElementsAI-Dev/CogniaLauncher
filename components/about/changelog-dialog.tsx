"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  FileText,
  Calendar,
  Tag,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Filter,
} from "lucide-react";
import { MarkdownRenderer } from "@/components/docs/markdown-renderer";
import { getTypeColor, getTypeLabel } from "@/lib/constants/changelog-utils";
import { ALL_CHANGE_TYPES } from "@/lib/constants/about";
import type {
  ChangelogEntry,
  ChangelogChangeType,
} from "@/lib/constants/about";
import { formatLocalizedRelativeDate } from "@/lib/utils/date";

export interface ChangelogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  entries: ChangelogEntry[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function ChangelogSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="space-y-2 pl-1">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

function VersionEntry({
  entry,
  isOpen,
  onToggle,
  typeFilter,
  locale,
  t,
}: {
  entry: ChangelogEntry;
  isOpen: boolean;
  onToggle: () => void;
  typeFilter: ChangelogChangeType | null;
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const filteredChanges = useMemo(() => {
    if (!typeFilter) return entry.changes;
    return entry.changes.filter((c) => c.type === typeFilter);
  }, [entry.changes, typeFilter]);

  const hasMarkdown = !!entry.markdownBody;
  const hasChanges = filteredChanges.length > 0 || hasMarkdown;

  if (!hasChanges && typeFilter) return null;

  const sourceLabel =
    entry.source === "remote"
      ? t("about.changelogRemote")
      : t("about.changelogLocal");

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <article className="space-y-2">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-3 w-full text-left py-1.5 px-2 -mx-2 rounded-md hover:bg-muted/50 transition-colors"
          >
            {isOpen ? (
              <ChevronDown
                className="h-4 w-4 text-muted-foreground flex-shrink-0"
                aria-hidden="true"
              />
            ) : (
              <ChevronRight
                className="h-4 w-4 text-muted-foreground flex-shrink-0"
                aria-hidden="true"
              />
            )}
            <div className="flex items-center gap-2 flex-wrap min-w-0 w-full">
              <div className="flex items-center gap-1.5">
                <Tag
                  className="h-3.5 w-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="font-semibold text-foreground">
                  v{entry.version}
                </span>
              </div>
              {entry.prerelease && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-5 border-amber-300 text-amber-600 dark:text-amber-400"
                >
                  {t("about.changelogPrerelease")}
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                {sourceLabel}
              </Badge>
              <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                <Calendar className="h-3 w-3" aria-hidden="true" />
                <time dateTime={entry.date}>{entry.date}</time>
                <span className="text-muted-foreground/60">
                  ({formatLocalizedRelativeDate(entry.date, locale, t)})
                </span>
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="pl-8 space-y-3">
            {hasMarkdown && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {t("about.changelogReleaseNotes")}
                </p>
                <MarkdownRenderer
                  content={entry.markdownBody!}
                  className="prose-sm"
                />
              </div>
            )}

            {filteredChanges.length > 0 && (
              <ul
                className="space-y-1.5"
                aria-label={`Changes in version ${entry.version}`}
              >
                {filteredChanges.map((change, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Badge
                      variant="secondary"
                      className={`text-[10px] px-1.5 py-0 h-5 flex-shrink-0 ${getTypeColor(change.type)}`}
                    >
                      {getTypeLabel(change.type, t)}
                    </Badge>
                    <span className="text-sm text-foreground">
                      {change.description}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {entry.url && (
              <a
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                {t("about.changelogViewOnGithub")}
              </a>
            )}
          </div>
        </CollapsibleContent>
      </article>
    </Collapsible>
  );
}

export function ChangelogDialog({
  open,
  onOpenChange,
  locale,
  entries,
  loading = false,
  error = null,
  onRetry,
  t,
}: ChangelogDialogProps) {
  const [typeFilter, setTypeFilter] = useState<ChangelogChangeType | null>(
    null,
  );
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(
    new Set(),
  );

  const availableTypes = useMemo(() => {
    const types = new Set<ChangelogChangeType>();
    for (const entry of entries) {
      for (const change of entry.changes) {
        types.add(change.type);
      }
    }
    return ALL_CHANGE_TYPES.filter((type) => types.has(type));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (!typeFilter) return entries;
    return entries.filter(
      (entry) =>
        entry.changes.some((c) => c.type === typeFilter) ||
        !!entry.markdownBody,
    );
  }, [entries, typeFilter]);

  const visibleExpandedVersions = useMemo(() => {
    const next = new Set<string>();
    const available = new Set(filteredEntries.map((entry) => entry.version));
    for (const version of expandedVersions) {
      if (available.has(version)) {
        next.add(version);
      }
    }
    if (next.size === 0 && filteredEntries[0]) {
      next.add(filteredEntries[0].version);
    }
    return next;
  }, [expandedVersions, filteredEntries]);

  const allExpanded =
    filteredEntries.length > 0 &&
    filteredEntries.every((entry) =>
      visibleExpandedVersions.has(entry.version),
    );

  const toggleAllExpanded = () => {
    if (allExpanded) {
      setExpandedVersions(new Set());
      return;
    }
    setExpandedVersions(new Set(filteredEntries.map((entry) => entry.version)));
  };

  const toggleVersion = (version: string) => {
    setExpandedVersions((previous) => {
      const next = new Set(previous);
      if (next.has(version)) {
        next.delete(version);
      } else {
        next.add(version);
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" aria-hidden="true" />
            {t("about.changelog")}
          </DialogTitle>
          <DialogDescription>
            {t("about.changelogDescription")}
          </DialogDescription>
        </DialogHeader>

        {availableTypes.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Filter
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="text-xs text-muted-foreground">
              {t("about.changelogFilterByType")}
            </span>
            <button
              type="button"
              onClick={() => setTypeFilter(null)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                typeFilter === null
                  ? "bg-foreground text-background border-foreground"
                  : "border-border hover:bg-muted"
              }`}
            >
              {t("about.changelogAllTypes")}
            </button>
            {availableTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  typeFilter === type
                    ? "bg-foreground text-background border-foreground"
                    : "border-border hover:bg-muted"
                }`}
              >
                {getTypeLabel(type, t)}
              </button>
            ))}
          </div>
        )}

        {filteredEntries.length > 1 && (
          <div className="flex items-center justify-end">
            <Button variant="ghost" size="sm" onClick={toggleAllExpanded}>
              {allExpanded
                ? t("about.changelogCollapseAll")
                : t("about.changelogExpandAll")}
            </Button>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            <AlertTriangle
              className="h-4 w-4 flex-shrink-0"
              aria-hidden="true"
            />
            <span className="flex-1">{t("about.changelogFetchError")}</span>
            {onRetry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
                className="h-7 px-2"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                {t("about.changelogRetry")}
              </Button>
            )}
          </div>
        )}

        <ScrollArea className="h-[55vh] pr-4">
          {loading && entries.length === 0 ? (
            <ChangelogSkeleton />
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <FileText className="h-8 w-8" aria-hidden="true" />
              <p className="text-sm">{t("about.changelogNoResults")}</p>
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                  {t("about.changelogRetry")}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEntries.map((entry, entryIndex) => (
                <div key={entry.version}>
                  {entryIndex > 0 && <Separator className="my-3" />}
                  <VersionEntry
                    entry={entry}
                    isOpen={visibleExpandedVersions.has(entry.version)}
                    onToggle={() => toggleVersion(entry.version)}
                    typeFilter={typeFilter}
                    locale={locale}
                    t={t}
                  />
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                  <RefreshCw
                    className="h-3.5 w-3.5 animate-spin"
                    aria-hidden="true"
                  />
                  {t("about.changelogLoading")}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
