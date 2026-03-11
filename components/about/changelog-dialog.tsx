"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FileText,
  Calendar,
  Tag,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Filter,
  Search,
  X,
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

const FILTER_ALL = "all" as const;
type ChangelogFilterValue = typeof FILTER_ALL | ChangelogChangeType;

const SOURCE_ALL = "all" as const;
type ChangelogSourceValue = typeof SOURCE_ALL | "local" | "remote";

function normalizeSearchQuery(input: string): string[] {
  return input
    .trim()
    .toLowerCase()
    .split(/\s+/g)
    .filter(Boolean);
}

function entryMatchesQuery(entry: ChangelogEntry, queryTokens: string[]): boolean {
  if (queryTokens.length === 0) return true;

  const changeText = entry.changes.map((c) => c.description).join(" ");
  const markdownText = entry.markdownBody ?? "";
  const haystack = `${entry.version} ${changeText} ${markdownText}`.toLowerCase();

  return queryTokens.every((token) => haystack.includes(token));
}

function ChangelogSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex flex-col gap-2 pl-1">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      ))}
    </div>
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
  const [typeFilter, setTypeFilter] = useState<ChangelogFilterValue>(
    FILTER_ALL,
  );
  const [sourceFilter, setSourceFilter] = useState<ChangelogSourceValue>(
    SOURCE_ALL,
  );
  const [showPrerelease, setShowPrerelease] = useState(true);
  const [query, setQuery] = useState("");
  const [userExpandedVersions, setUserExpandedVersions] = useState<string[]>([]);

  const queryTokens = useMemo(() => normalizeSearchQuery(query), [query]);

  const hasLocal = useMemo(
    () => entries.some((e) => (e.source ?? "local") === "local"),
    [entries],
  );
  const hasRemote = useMemo(
    () => entries.some((e) => e.source === "remote"),
    [entries],
  );
  const hasPrerelease = useMemo(
    () => entries.some((e) => !!e.prerelease),
    [entries],
  );

  const facetEntries = useMemo(() => {
    return entries.filter((entry) => {
      const entrySource = entry.source ?? "local";
      if (sourceFilter !== SOURCE_ALL && entrySource !== sourceFilter) {
        return false;
      }
      if (!showPrerelease && entry.prerelease) {
        return false;
      }
      return true;
    });
  }, [entries, sourceFilter, showPrerelease]);

  const availableTypes = useMemo(() => {
    const types = new Set<ChangelogChangeType>();
    for (const entry of facetEntries) {
      for (const change of entry.changes) {
        types.add(change.type);
      }
    }
    return ALL_CHANGE_TYPES.filter((type) => types.has(type));
  }, [facetEntries]);

  const effectiveTypeFilter =
    typeFilter !== FILTER_ALL && !availableTypes.includes(typeFilter)
      ? FILTER_ALL
      : typeFilter;

  const typeFilteredEntries = useMemo(() => {
    if (effectiveTypeFilter === FILTER_ALL) return facetEntries;
    return facetEntries.filter((entry) =>
      entry.changes.some((c) => c.type === effectiveTypeFilter),
    );
  }, [facetEntries, effectiveTypeFilter]);

  const filteredEntries = useMemo(() => {
    if (queryTokens.length === 0) return typeFilteredEntries;
    return typeFilteredEntries.filter((entry) =>
      entryMatchesQuery(entry, queryTokens),
    );
  }, [typeFilteredEntries, queryTokens]);

  const effectiveExpandedVersions = useMemo(() => {
    if (!open) return [];
    if (filteredEntries.length === 0) return [];

    const visibleSet = new Set(filteredEntries.map((entry) => entry.version));
    const visibleManual = userExpandedVersions.filter((v) => visibleSet.has(v));
    if (visibleManual.length > 0) return visibleManual;
    return [filteredEntries[0]!.version];
  }, [open, filteredEntries, userExpandedVersions]);

  const allExpanded =
    filteredEntries.length > 0 &&
    effectiveExpandedVersions.length === filteredEntries.length;
  const hasFilterControls = availableTypes.length > 1;
  const hasDisclosureControls = filteredEntries.length > 1;
  const hasSourceControls = hasLocal && hasRemote;

  const toggleAllExpanded = () => {
    if (allExpanded) {
      setUserExpandedVersions([]);
      return;
    }
    setUserExpandedVersions(filteredEntries.map((entry) => entry.version));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" aria-hidden="true" />
            {t("about.changelog")}
          </DialogTitle>
          <DialogDescription>{t("about.changelogDescription")}</DialogDescription>
        </DialogHeader>

        <div
          className="flex flex-col gap-2 rounded-md border bg-muted/30 p-2.5"
          role="toolbar"
          aria-label={t("about.changelog")}
          data-testid="changelog-controls"
        >
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("about.changelogSearchPlaceholder")}
                aria-label={t("about.changelogSearchPlaceholder")}
                className="h-8"
              />
              {query ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setQuery("")}
                  aria-label={t("about.changelogClearSearch")}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              {hasFilterControls ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t("about.changelogFilterByType")}</span>
                  </div>
                  <ToggleGroup
                    type="single"
                    value={effectiveTypeFilter}
                    onValueChange={(value) => {
                      setTypeFilter((value || FILTER_ALL) as ChangelogFilterValue);
                    }}
                    variant="outline"
                    size="sm"
                    spacing={1}
                    className="flex w-full flex-wrap"
                    aria-label={t("about.changelogFilterByType")}
                  >
                    <ToggleGroupItem value={FILTER_ALL}>
                      {t("about.changelogAllTypes")}
                    </ToggleGroupItem>
                    {availableTypes.map((type) => (
                      <ToggleGroupItem key={type} value={type}>
                        {getTypeLabel(type, t)}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 justify-between">
                {hasSourceControls ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {t("about.changelogFilterBySource")}
                    </span>
                    <ToggleGroup
                      type="single"
                      value={sourceFilter}
                      onValueChange={(value) => {
                        setSourceFilter((value || SOURCE_ALL) as ChangelogSourceValue);
                      }}
                      variant="outline"
                      size="sm"
                      spacing={1}
                      aria-label={t("about.changelogFilterBySource")}
                      className="flex flex-wrap"
                    >
                      <ToggleGroupItem value={SOURCE_ALL}>
                        {t("about.changelogAllSources")}
                      </ToggleGroupItem>
                      <ToggleGroupItem value="local">
                        {t("about.changelogLocal")}
                      </ToggleGroupItem>
                      <ToggleGroupItem value="remote">
                        {t("about.changelogRemote")}
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                ) : null}

                {hasPrerelease ? (
                  <div className="flex items-center gap-2">
                    <Switch
                      id="changelog-prerelease"
                      checked={showPrerelease}
                      onCheckedChange={(checked) => setShowPrerelease(!!checked)}
                      aria-label={t("about.changelogShowPrerelease")}
                    />
                    <Label htmlFor="changelog-prerelease" className="text-xs text-muted-foreground">
                      {t("about.changelogShowPrerelease")}
                    </Label>
                  </div>
                ) : null}

                {hasDisclosureControls ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleAllExpanded}
                    aria-pressed={allExpanded}
                    className="ml-auto"
                  >
                    {allExpanded
                      ? t("about.changelogCollapseAll")
                      : t("about.changelogExpandAll")}
                  </Button>
                ) : null}
              </div>
            </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>{t("about.changelogFetchError")}</AlertTitle>
            <AlertDescription>
              <span>{error}</span>
              {onRetry ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="mt-2 h-7 w-fit px-2"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                  {t("about.changelogRetry")}
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        )}

        <ScrollArea className="h-[55vh] pr-4" aria-label={t("about.changelog")}>
          {loading && entries.length === 0 ? (
            <ChangelogSkeleton />
          ) : filteredEntries.length === 0 ? (
            <Empty className="py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText className="size-5" aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle className="text-base">
                  {t("about.changelogNoResults")}
                </EmptyTitle>
                <EmptyDescription>
                  {t("about.changelogNoResults")}
                </EmptyDescription>
              </EmptyHeader>
              {onRetry ? (
                <EmptyContent>
                  <Button variant="outline" size="sm" onClick={onRetry}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                    {t("about.changelogRetry")}
                  </Button>
                </EmptyContent>
              ) : null}
            </Empty>
          ) : (
            <div className="flex flex-col gap-2">
              <Accordion
                type="multiple"
                value={effectiveExpandedVersions}
                onValueChange={setUserExpandedVersions}
                className="w-full"
                aria-label={t("about.changelog")}
              >
                {filteredEntries.map((entry) => {
                  const filteredChanges =
                    effectiveTypeFilter === FILTER_ALL
                      ? entry.changes
                      : entry.changes.filter((c) => c.type === effectiveTypeFilter);
                  const sourceLabel =
                    entry.source === "remote"
                      ? t("about.changelogRemote")
                      : t("about.changelogLocal");

                  return (
                    <AccordionItem key={entry.version} value={entry.version}>
                      <AccordionTrigger className="py-2 hover:no-underline">
                        <div className="flex w-full items-center gap-2 flex-wrap text-left pr-2">
                          <div className="flex items-center gap-1.5">
                            <Tag
                              className="h-3.5 w-3.5 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <span className="font-semibold text-foreground">
                              v{entry.version}
                            </span>
                          </div>
                          {entry.prerelease ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 h-5 border-amber-300 text-amber-600 dark:text-amber-400"
                            >
                              {t("about.changelogPrerelease")}
                            </Badge>
                          ) : null}
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                            {sourceLabel}
                          </Badge>
                          <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" aria-hidden="true" />
                            <time dateTime={entry.date}>{entry.date}</time>
                            <span className="text-muted-foreground/60">
                              ({formatLocalizedRelativeDate(entry.date, locale, t)})
                            </span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pl-2 flex flex-col gap-3">
                        {entry.markdownBody ? (
                          <div className="rounded-md border bg-muted/30 p-3 text-sm">
                            <p className="mb-2 text-xs font-medium text-muted-foreground">
                              {t("about.changelogReleaseNotes")}
                            </p>
                            <MarkdownRenderer
                              content={entry.markdownBody}
                              className="prose-sm"
                            />
                          </div>
                        ) : null}

                        {filteredChanges.length > 0 ? (
                          <ul
                            className="flex flex-col gap-1.5"
                            aria-label={`Changes in version ${entry.version}`}
                          >
                            {filteredChanges.map((change, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <Badge
                                  variant="secondary"
                                  className={`text-[10px] px-1.5 py-0 h-5 shrink-0 ${getTypeColor(change.type)}`}
                                >
                                  {getTypeLabel(change.type, t)}
                                </Badge>
                                <span className="text-sm text-foreground">
                                  {change.description}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        {entry.url ? (
                          <a
                            href={entry.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            {t("about.changelogViewOnGithub")}
                          </a>
                        ) : null}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>

              {loading ? (
                <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                  <RefreshCw
                    className="h-3.5 w-3.5 animate-spin"
                    aria-hidden="true"
                  />
                  {t("about.changelogLoading")}
                </div>
              ) : null}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
