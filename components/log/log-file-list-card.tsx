"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale } from "@/components/providers/locale-provider";
import { isTauri } from "@/lib/tauri";
import { formatBytes, formatDate } from "@/lib/utils";
import { formatSessionLabel } from "@/lib/log";
import type { LogFileInfo } from "@/types/log";
import {
  Copy,
  FileText,
  FolderOpen,
  Search,
  Trash2,
  X,
} from "lucide-react";

const PAGE_SIZE_PRESETS = [20, 50, 100] as const;
const MIN_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 500;
const SEARCH_DEBOUNCE_MS = 300;

type SortKey = "date-desc" | "date-asc" | "size-desc" | "size-asc" | "name-asc";

interface LogFileListCardProps {
  logFiles: LogFileInfo[];
  logDir: string;
  loading: boolean;
  currentSessionFileName: string | null;
  selectedFiles: Set<string>;
  onToggleFileSelection: (fileName: string) => void;
  onSelectFiles: (fileNames: string[]) => void;
  onDeselectFiles: (fileNames: string[]) => void;
  onViewFile: (fileName: string) => void;
  onDeleteRequest: (fileName: string) => void;
  onDeleteSelectedRequest: () => void;
  onClearHistory: () => void;
  onCopyPath: (path: string) => void;
}

function sortFiles(files: LogFileInfo[], sortKey: SortKey): LogFileInfo[] {
  const sorted = [...files];
  switch (sortKey) {
    case "date-desc":
      return sorted.sort((a, b) => b.modified - a.modified);
    case "date-asc":
      return sorted.sort((a, b) => a.modified - b.modified);
    case "size-desc":
      return sorted.sort((a, b) => b.size - a.size);
    case "size-asc":
      return sorted.sort((a, b) => a.size - b.size);
    case "name-asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return sorted;
  }
}

export function LogFileListCard({
  logFiles,
  logDir,
  loading,
  currentSessionFileName,
  selectedFiles,
  onToggleFileSelection,
  onSelectFiles,
  onDeselectFiles,
  onViewFile,
  onDeleteRequest,
  onDeleteSelectedRequest,
  onClearHistory,
  onCopyPath,
}: LogFileListCardProps) {
  const { t } = useLocale();

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date-desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_PRESETS[0]);
  const [customPageSize, setCustomPageSize] = useState<string>(
    String(PAGE_SIZE_PRESETS[0]),
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchInput = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(value);
      setCurrentPage(1);
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const filteredFiles = useMemo(() => {
    let files = logFiles;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      files = files.filter((f) => {
        const label = formatSessionLabel(f.name);
        return (
          f.name.toLowerCase().includes(q) ||
          (label && label.toLowerCase().includes(q))
        );
      });
    }
    return sortFiles(files, sortKey);
  }, [logFiles, searchQuery, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / pageSize));
  const effectivePage = Math.min(currentPage, totalPages);

  const pagedFiles = useMemo(() => {
    const start = (effectivePage - 1) * pageSize;
    return filteredFiles.slice(start, start + pageSize);
  }, [effectivePage, filteredFiles, pageSize]);

  const applyPageSize = useCallback((value: number) => {
    const normalized = Math.min(
      MAX_PAGE_SIZE,
      Math.max(MIN_PAGE_SIZE, Math.floor(value)),
    );
    setPageSize(normalized);
    setCustomPageSize(String(normalized));
  }, []);

  const handleCustomPageSizeCommit = useCallback(() => {
    const parsed = Number.parseInt(customPageSize, 10);
    if (Number.isNaN(parsed)) {
      setCustomPageSize(String(pageSize));
      return;
    }
    setCurrentPage(1);
    applyPageSize(parsed);
  }, [applyPageSize, customPageSize, pageSize]);

  // Select-all logic for non-current-session files on current page
  const selectableOnPage = useMemo(
    () =>
      pagedFiles.filter((f) => f.name !== currentSessionFileName).map((f) => f.name),
    [pagedFiles, currentSessionFileName],
  );

  const selectedOnPage = useMemo(
    () => selectableOnPage.filter((name) => selectedFiles.has(name)),
    [selectableOnPage, selectedFiles],
  );

  const allPageSelected =
    selectableOnPage.length > 0 &&
    selectedOnPage.length === selectableOnPage.length;
  const somePageSelected =
    selectedOnPage.length > 0 && !allPageSelected;

  const handleToggleSelectAll = useCallback(() => {
    if (allPageSelected) {
      onDeselectFiles(selectableOnPage);
    } else {
      onSelectFiles(selectableOnPage);
    }
  }, [allPageSelected, onDeselectFiles, onSelectFiles, selectableOnPage]);

  return (
    <Card className="flex flex-col min-h-0">
      <CardHeader className="shrink-0 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg">
              {t("logs.logFiles")}
            </CardTitle>
            {logDir && (
              <CardDescription>
                <code className="text-[11px] sm:text-xs bg-muted px-2 py-1 rounded break-all">
                  {logDir}
                </code>
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {selectedFiles.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={onDeleteSelectedRequest}
                className="h-8"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {t("logs.deleteSelected")} ({selectedFiles.size})
              </Button>
            )}
            {logFiles.length > 1 && selectedFiles.size === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClearHistory}
                className="h-8"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {t("logs.clear")}
              </Button>
            )}
          </div>
        </div>

        {/* Search + Sort toolbar */}
        {isTauri() && logFiles.length > 0 && (
          <div className="flex items-center gap-2 pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={t("logs.searchFiles")}
                value={searchInput}
                onChange={(e) => handleSearchInput(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <Select value={sortKey} onValueChange={(v) => { setSortKey(v as SortKey); setCurrentPage(1); }}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder={t("logs.sortBy")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">{t("logs.sortNewest")}</SelectItem>
                <SelectItem value="date-asc">{t("logs.sortOldest")}</SelectItem>
                <SelectItem value="size-desc">{t("logs.sortLargest")}</SelectItem>
                <SelectItem value="size-asc">{t("logs.sortSmallest")}</SelectItem>
                <SelectItem value="name-asc">{t("logs.sortName")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Select-all row */}
        {isTauri() && selectableOnPage.length > 0 && (
          <div className="flex items-center gap-2 pt-2">
            <Checkbox
              checked={somePageSelected ? "indeterminate" : allPageSelected}
              onCheckedChange={handleToggleSelectAll}
              aria-label={allPageSelected ? t("logs.deselectAll") : t("logs.selectAll")}
            />
            <span className="text-xs text-muted-foreground">
              {selectedFiles.size > 0
                ? t("logs.selectedCount", { count: selectedFiles.size })
                : t("logs.selectAll")}
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 min-h-0 pt-0">
        {loading && logFiles.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : !isTauri() ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-muted-foreground">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl scale-150" />
              <FileText className="relative h-14 w-14 sm:h-16 sm:w-16 text-muted-foreground/40" />
            </div>
            <p className="text-sm sm:text-base font-medium text-foreground/70">
              {t("logs.desktopOnly")}
            </p>
            <p className="text-xs sm:text-sm mt-2 text-center max-w-[280px]">
              {t("logs.desktopOnlyDescription")}
            </p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-muted-foreground">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl scale-150" />
              <FileText className="relative h-14 w-14 sm:h-16 sm:w-16 text-muted-foreground/40" />
            </div>
            <p className="text-sm sm:text-base font-medium text-foreground/70">
              {searchQuery ? t("logs.noSearchResults") : t("logs.noFiles")}
            </p>
          </div>
        ) : (
          <>
            <ScrollArea
              data-testid="logs-files-list-scroll-area"
              className="h-full min-h-0"
            >
              <div className="space-y-2 pr-4">
                {pagedFiles.map((file) => {
                  const sessionLabel = formatSessionLabel(file.name);
                  const isCurrent = file.name === currentSessionFileName;
                  const isSelected = selectedFiles.has(file.name);
                  return (
                    <div
                      key={file.name}
                      data-testid="log-file-row"
                      className={`group flex items-center gap-3 p-3 sm:p-4 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-primary/5 border-primary/30"
                          : "bg-card hover:bg-muted/30 hover:border-primary/20"
                      }`}
                      onClick={() => onViewFile(file.name)}
                    >
                      {!isCurrent && (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() =>
                            onToggleFileSelection(file.name)
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0"
                        />
                      )}
                      <div className="shrink-0 p-2 rounded-lg bg-muted/50 group-hover:bg-primary/10 transition-colors">
                        <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">
                            {sessionLabel ?? file.name}
                          </p>
                          {isCurrent && (
                            <Badge
                              variant="secondary"
                              className="shrink-0 text-[10px] px-1.5 py-0"
                            >
                              {t("logs.currentSession")}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatBytes(file.size)} •{" "}
                          {formatDate(file.modified)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewFile(file.name);
                        }}
                        title={t("logs.viewFile")}
                      >
                        <FolderOpen className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onCopyPath(file.path);
                        }}
                        title={t("logs.copyFilePath")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {!isCurrent && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteRequest(file.name);
                          }}
                          title={t("common.delete")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {t("logs.pageSize")}
                </span>
                <div className="flex items-center gap-1">
                  {PAGE_SIZE_PRESETS.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      size="sm"
                      variant={
                        pageSize === preset ? "secondary" : "outline"
                      }
                      className="h-7 px-2 text-[11px]"
                      onClick={() => {
                        setCurrentPage(1);
                        applyPageSize(preset);
                      }}
                    >
                      {preset}
                    </Button>
                  ))}
                </div>
                <Input
                  type="number"
                  min={MIN_PAGE_SIZE}
                  max={MAX_PAGE_SIZE}
                  step={1}
                  value={customPageSize}
                  onChange={(event) =>
                    setCustomPageSize(event.target.value)
                  }
                  onBlur={handleCustomPageSizeCommit}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleCustomPageSizeCommit();
                    }
                  }}
                  aria-label={t("logs.pageSize")}
                  className="h-7 w-20 text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t("logs.pageInfo", {
                    current: effectivePage,
                    total: totalPages,
                  })}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={effectivePage <= 1}
                >
                  {t("common.previous")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() =>
                    setCurrentPage((prev) =>
                      Math.min(totalPages, prev + 1),
                    )
                  }
                  disabled={effectivePage >= totalPages}
                >
                  {t("common.next")}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
