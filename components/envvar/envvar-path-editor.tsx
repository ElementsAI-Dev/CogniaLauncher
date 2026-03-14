'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  GripVertical,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Copy,
  Route,
  FolderOpen,
  Search,
  Wrench,
  ChevronDown,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { isTauri } from '@/lib/tauri';
import type { EnvVarScope, PathEntryInfo, EnvVarPathRepairPreview } from '@/types/tauri';

interface EnvVarPathEditorProps {
  pathEntries: PathEntryInfo[];
  pathScope: EnvVarScope;
  onPathScopeChange: (scope: EnvVarScope) => void;
  onAdd: (path: string, position?: number) => Promise<boolean>;
  onRemove: (path: string) => Promise<boolean>;
  onReorder: (entries: string[]) => Promise<boolean>;
  onDeduplicate: () => Promise<number>;
  onPreviewRepair?: () => Promise<EnvVarPathRepairPreview | null>;
  onApplyRepair?: (fingerprint: string) => Promise<number | null>;
  onClearRepairPreview?: () => void;
  repairPreview?: EnvVarPathRepairPreview | null;
  repairPreviewStale?: boolean;
  onRefresh: () => void;
  loading: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function EnvVarPathEditor({
  pathEntries,
  pathScope,
  onPathScopeChange,
  onAdd,
  onRemove,
  onReorder,
  onDeduplicate,
  onPreviewRepair,
  onApplyRepair,
  onClearRepairPreview,
  repairPreview = null,
  repairPreviewStale = false,
  onRefresh,
  loading,
  t,
}: EnvVarPathEditorProps) {
  const [newPath, setNewPath] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [repairExpanded, setRepairExpanded] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortableIds = useMemo(
    () => pathEntries.map((e, i) => `${e.path}-${i}`),
    [pathEntries],
  );

  const missingCount = pathEntries.filter((e) => !e.exists || !e.isDirectory).length;
  const duplicateCount = pathEntries.filter((e) => e.isDuplicate).length;

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = sortableIds.indexOf(String(active.id));
      const newIndex = sortableIds.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(
        pathEntries.map((e) => e.path),
        oldIndex,
        newIndex,
      );
      const success = await onReorder(reordered);
      if (success) onRefresh();
    },
    [sortableIds, pathEntries, onReorder, onRefresh],
  );

  const handleBrowseFolder = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const dialogModule = await import('@tauri-apps/plugin-dialog');
      const selected = await dialogModule.open({ directory: true, multiple: false });
      if (typeof selected === 'string') {
        setNewPath(selected);
      }
    } catch (err) {
      toast.error(String(err));
    }
  }, []);

  const filteredEntries = useMemo(() => {
    if (!searchQuery) return pathEntries;
    const q = searchQuery.toLowerCase();
    return pathEntries.filter((e) => e.path.toLowerCase().includes(q));
  }, [pathEntries, searchQuery]);

  const handleAdd = useCallback(async () => {
    const trimmed = newPath.trim();
    if (!trimmed) return;
    const success = await onAdd(trimmed);
    if (success) {
      setNewPath('');
      onRefresh();
    }
  }, [newPath, onAdd, onRefresh]);

  const handleRemove = useCallback(
    async (path: string) => {
      const success = await onRemove(path);
      if (success) onRefresh();
      return success;
    },
    [onRemove, onRefresh],
  );

  const handleDeduplicate = useCallback(async () => {
    const removed = await onDeduplicate();
    if (removed > 0) {
      toast.success(t('envvar.pathEditor.deduplicateSuccess', { count: removed }));
      onRefresh();
    }
  }, [onDeduplicate, onRefresh, t]);

  const handlePreviewRepair = useCallback(async () => {
    await onPreviewRepair?.();
    setRepairExpanded(true);
  }, [onPreviewRepair]);

  const handleApplyRepair = useCallback(async () => {
    if (!repairPreview || !onApplyRepair) return;
    const removed = await onApplyRepair(repairPreview.fingerprint);
    if (removed && removed > 0) {
      toast.success(t('envvar.pathEditor.repairSuccess', { count: removed }));
      onRefresh();
      setRepairExpanded(false);
    }
  }, [onApplyRepair, onRefresh, repairPreview, t]);

  const handleOpenFolder = useCallback(async (path: string) => {
    if (!isTauri()) return;
    try {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
      await revealItemInDir(path);
    } catch (err) {
      toast.error(String(err));
    }
  }, []);

  const handleMove = useCallback(
    async (index: number, direction: 'up' | 'down') => {
      const entries = pathEntries.map((e) => e.path);
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= entries.length) return;
      [entries[index], entries[newIndex]] = [entries[newIndex], entries[index]];
      const success = await onReorder(entries);
      if (success) onRefresh();
    },
    [pathEntries, onReorder, onRefresh],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="envvar-path-editor">
      {/* Summary card */}
      <Card className="shrink-0 gap-0 py-0" data-testid="envvar-path-summary">
        <CardHeader className="border-b px-3 py-2.5 sm:px-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <Select
                value={pathScope}
                onValueChange={(v) => {
                  onPathScopeChange(v as EnvVarScope);
                  onClearRepairPreview?.();
                }}
              >
                <SelectTrigger className="h-8 w-32" aria-label={t('envvar.table.scope')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="process">{t('envvar.scopes.process')}</SelectItem>
                  <SelectItem value="user">{t('envvar.scopes.user')}</SelectItem>
                  <SelectItem value="system">{t('envvar.scopes.system')}</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  {pathEntries.length} {t('envvar.pathEditor.title').toLowerCase()}
                </Badge>
                {missingCount > 0 && (
                  <Badge variant="destructive" className="gap-1 text-[10px]">
                    <XCircle className="h-3 w-3" />
                    {missingCount} {t('envvar.pathEditor.missing').toLowerCase()}
                  </Badge>
                )}
                {duplicateCount > 0 && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-amber-500/20 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {duplicateCount} {t('envvar.pathEditor.duplicate').toLowerCase()}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {duplicateCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeduplicate}
                  disabled={loading}
                  className="h-8 gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {t('envvar.pathEditor.deduplicate')}
                </Button>
              )}
              {(duplicateCount > 0 || missingCount > 0) && onPreviewRepair && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviewRepair}
                  disabled={loading}
                  className="h-8 gap-1.5"
                >
                  <Wrench className="h-3.5 w-3.5" />
                  {t('envvar.pathEditor.previewRepair')}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Repair preview collapsible */}
        {repairPreview && (
          <Collapsible open={repairExpanded} onOpenChange={setRepairExpanded}>
            <CardContent className="px-3 py-2.5 sm:px-4" data-testid="envvar-path-repair-preview">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 text-left text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{t('envvar.pathEditor.repairPreviewReady', { count: repairPreview.removedCount })}</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-muted-foreground transition-transform',
                      repairExpanded && 'rotate-180',
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2.5 space-y-2">
                  <Alert className="border-dashed">
                    <AlertDescription className="text-xs">
                      {t('envvar.pathEditor.repairSummary', {
                        missing: repairPreview.missingCount,
                        duplicates: repairPreview.duplicateCount,
                        removed: repairPreview.removedCount,
                      })}
                    </AlertDescription>
                  </Alert>
                  {repairPreview.primaryShellTarget && (
                    <p className="text-xs text-muted-foreground">
                      {t('envvar.pathEditor.repairTarget', { target: repairPreview.primaryShellTarget })}
                    </p>
                  )}
                  {repairPreviewStale && (
                    <Alert
                      className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400 [&>svg]:text-amber-500"
                      data-testid="envvar-path-repair-stale"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{t('envvar.pathEditor.repairPreviewStale')}</AlertDescription>
                    </Alert>
                  )}
                  {onApplyRepair && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleApplyRepair}
                        disabled={loading || repairPreviewStale}
                        className="gap-1.5"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t('envvar.pathEditor.applyRepair')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          onClearRepairPreview?.();
                          setRepairExpanded(false);
                        }}
                      >
                        {t('common.cancel')}
                      </Button>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </CardContent>
          </Collapsible>
        )}
      </Card>

      {/* Add path section */}
      <Card className="shrink-0 gap-0 py-0" data-testid="envvar-path-controls">
        <CardContent className="px-3 py-3 sm:px-4">
          <div className="flex gap-2">
            <Input
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              placeholder={t('envvar.pathEditor.addPlaceholder')}
              aria-label={t('envvar.pathEditor.add')}
              className="h-9"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={handleBrowseFolder}
                  aria-label={t('envvar.pathEditor.browse')}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('envvar.pathEditor.browse')}</TooltipContent>
            </Tooltip>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!newPath.trim() || loading}
              className="shrink-0 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('envvar.pathEditor.add')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Path list */}
      <Card className="min-h-0 flex-1 gap-0 py-0" data-testid="envvar-path-list-card">
        <CardHeader className="border-b px-3 py-2.5 sm:px-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">{t('envvar.pathEditor.title')}</CardTitle>
            {pathEntries.length > 3 && (
              <div className="relative max-w-xs">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('envvar.pathEditor.searchPlaceholder')}
                  aria-label={t('envvar.pathEditor.searchPlaceholder')}
                  className={cn('h-8 pl-8 text-xs', searchQuery && 'pr-7')}
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 px-0 py-0">
          {filteredEntries.length === 0 ? (
            <Empty className="border-none py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Route />
                </EmptyMedia>
                <EmptyTitle className="text-sm font-normal text-muted-foreground">
                  {searchQuery
                    ? t('envvar.pathEditor.noSearchResults')
                    : t('envvar.pathEditor.empty')}
                </EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                <ScrollArea className="h-full max-h-[calc(100vh-420px)] min-h-0">
                  <div className="space-y-1 p-2">
                    {filteredEntries.map((entry, index) => {
                      const realIndex = pathEntries.indexOf(entry);
                      return (
                        <SortablePathEntry
                          key={sortableIds[realIndex] ?? `${entry.path}-${index}`}
                          id={sortableIds[realIndex] ?? `${entry.path}-${index}`}
                          entry={entry}
                          index={realIndex}
                          totalCount={pathEntries.length}
                          onOpenFolder={handleOpenFolder}
                          onMove={handleMove}
                          onRemove={handleRemove}
                          searchQuery={searchQuery}
                          loading={loading}
                          t={t}
                        />
                      );
                    })}
                  </div>
                </ScrollArea>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function highlightText(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-yellow-200 px-0.5 dark:bg-yellow-800">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

interface SortablePathEntryProps {
  id: string;
  entry: PathEntryInfo;
  index: number;
  totalCount: number;
  onOpenFolder: (path: string) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
  onRemove: (path: string) => Promise<boolean>;
  searchQuery: string;
  loading: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function SortablePathEntry({
  id,
  entry,
  index,
  totalCount,
  onOpenFolder,
  onMove,
  onRemove,
  searchQuery,
  loading,
  t,
}: SortablePathEntryProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isMissing = !entry.exists || !entry.isDirectory;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-2 transition-colors hover:bg-muted focus-within:bg-muted',
        isDragging && 'z-10 opacity-70 shadow-lg ring-2 ring-primary/20',
        isMissing && 'bg-red-500/5',
        entry.isDuplicate && !isMissing && 'bg-amber-500/5',
      )}
    >
      {/* Position number */}
      <span className="w-5 shrink-0 text-center text-[10px] tabular-nums text-muted-foreground/60">
        {index + 1}
      </span>

      {/* Drag Handle */}
      <button
        type="button"
        className="touch-none cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label={t('envvar.pathEditor.dragHint')}
      >
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
      </button>

      {/* Status icon */}
      {isMissing ? (
        <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
      ) : entry.isDuplicate ? (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
      )}

      {/* Path text */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="min-w-0 flex-1 truncate font-mono text-xs">
            {highlightText(entry.path, searchQuery)}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-md break-all font-mono text-xs">
          {entry.path}
        </TooltipContent>
      </Tooltip>

      {/* Status badges */}
      {entry.isDuplicate && (
        <Badge
          variant="outline"
          className="shrink-0 border-amber-500/20 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
        >
          {t('envvar.pathEditor.duplicate')}
        </Badge>
      )}
      {isMissing && (
        <Badge
          variant="outline"
          className="shrink-0 border-red-500/20 bg-red-500/10 text-[10px] text-red-600 dark:text-red-400"
        >
          {t('envvar.pathEditor.missing')}
        </Badge>
      )}

      {/* Action buttons */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        {entry.exists && entry.isDirectory && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onOpenFolder(entry.path)}
                aria-label={t('envvar.pathEditor.openFolder')}
              >
                <FolderOpen className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{t('envvar.pathEditor.openFolder')}</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={index === 0 || loading}
              onClick={() => onMove(index, 'up')}
              aria-label={t('envvar.pathEditor.moveUp')}
            >
              <ArrowUp className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{t('envvar.pathEditor.moveUp')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={index === totalCount - 1 || loading}
              onClick={() => onMove(index, 'down')}
              aria-label={t('envvar.pathEditor.moveDown')}
            >
              <ArrowDown className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{t('envvar.pathEditor.moveDown')}</TooltipContent>
        </Tooltip>
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  disabled={loading}
                  aria-label={t('envvar.pathEditor.remove')}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">{t('envvar.pathEditor.remove')}</TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('envvar.confirm.pathChangeTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('envvar.confirm.pathChangeDesc')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onRemove(entry.path)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t('envvar.actions.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
