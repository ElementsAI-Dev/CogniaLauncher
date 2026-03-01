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
import { GripVertical, Plus, Trash2, CheckCircle2, XCircle, ArrowUp, ArrowDown, Copy, Route, FolderOpen, Search } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { isTauri } from '@/lib/tauri';
import type { EnvVarScope, PathEntryInfo } from '@/types/tauri';

interface EnvVarPathEditorProps {
  pathEntries: PathEntryInfo[];
  pathScope: EnvVarScope;
  onPathScopeChange: (scope: EnvVarScope) => void;
  onAdd: (path: string, position?: number) => Promise<boolean>;
  onRemove: (path: string) => Promise<boolean>;
  onReorder: (entries: string[]) => Promise<boolean>;
  onDeduplicate: () => Promise<number>;
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
  onRefresh,
  loading,
  t,
}: EnvVarPathEditorProps) {
  const [newPath, setNewPath] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortableIds = useMemo(
    () => pathEntries.map((e, i) => `${e.path}-${i}`),
    [pathEntries],
  );

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortableIds.indexOf(String(active.id));
    const newIndex = sortableIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(pathEntries.map((e) => e.path), oldIndex, newIndex);
    const success = await onReorder(reordered);
    if (success) onRefresh();
  }, [sortableIds, pathEntries, onReorder, onRefresh]);

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

  const handleRemove = useCallback(async (path: string) => {
    const success = await onRemove(path);
    if (success) {
      onRefresh();
    }
    return success;
  }, [onRemove, onRefresh]);

  const handleDeduplicate = useCallback(async () => {
    const removed = await onDeduplicate();
    if (removed > 0) {
      toast.success(t('envvar.pathEditor.deduplicateSuccess', { count: removed }));
      onRefresh();
    }
  }, [onDeduplicate, onRefresh, t]);

  const missingCount = pathEntries.filter((e) => !e.exists || !e.isDirectory).length;
  const duplicateCount = pathEntries.filter((e) => e.isDuplicate).length;

  const handleOpenFolder = useCallback(async (path: string) => {
    if (!isTauri()) return;
    try {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
      await revealItemInDir(path);
    } catch (err) {
      toast.error(String(err));
    }
  }, []);

  const handleMove = useCallback(async (index: number, direction: 'up' | 'down') => {
    const entries = pathEntries.map((e) => e.path);
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= entries.length) return;

    [entries[index], entries[newIndex]] = [entries[newIndex], entries[index]];
    const success = await onReorder(entries);
    if (success) {
      onRefresh();
    }
  }, [pathEntries, onReorder, onRefresh]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={pathScope} onValueChange={(v) => onPathScopeChange(v as EnvVarScope)}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="process">{t('envvar.scopes.process')}</SelectItem>
            <SelectItem value="user">{t('envvar.scopes.user')}</SelectItem>
            <SelectItem value="system">{t('envvar.scopes.system')}</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {pathEntries.length} {t('envvar.pathEditor.title').toLowerCase()}
        </span>
        {missingCount > 0 && (
          <Badge variant="destructive" className="text-[10px] gap-1">
            <XCircle className="h-3 w-3" />
            {t('envvar.pathEditor.missingCount', { count: missingCount })}
          </Badge>
        )}
        {duplicateCount > 0 && (
          <Badge variant="outline" className="text-[10px] gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
            {t('envvar.pathEditor.duplicateCount', { count: duplicateCount })}
          </Badge>
        )}
        {duplicateCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleDeduplicate} disabled={loading} className="gap-1.5 ml-auto">
            <Copy className="h-3.5 w-3.5" />
            {t('envvar.pathEditor.deduplicate')}
          </Button>
        )}
      </div>

      {/* Add new entry */}
      <div className="flex gap-2">
        <Input
          value={newPath}
          onChange={(e) => setNewPath(e.target.value)}
          placeholder={t('envvar.pathEditor.addPlaceholder')}
          className="h-9"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={handleBrowseFolder}>
              <FolderOpen className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{t('envvar.pathEditor.browse') || 'Browse'}</TooltipContent>
        </Tooltip>
        <Button size="sm" onClick={handleAdd} disabled={!newPath.trim() || loading} className="gap-1.5 shrink-0">
          <Plus className="h-3.5 w-3.5" />
          {t('envvar.pathEditor.add')}
        </Button>
      </div>

      {/* Search PATH entries */}
      {pathEntries.length > 5 && (
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('envvar.pathEditor.searchPlaceholder') || 'Search paths...'}
            className="h-8 pl-8 text-xs"
          />
        </div>
      )}

      {/* Entries list */}
      {filteredEntries.length === 0 ? (
        <Empty className="border-none py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Route />
            </EmptyMedia>
            <EmptyTitle className="text-sm font-normal text-muted-foreground">
              {searchQuery ? t('envvar.pathEditor.noSearchResults') || 'No matching paths' : t('envvar.pathEditor.empty')}
            </EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <ScrollArea className="max-h-[480px]">
              <div className="space-y-1">
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
                      t={t}
                    />
                  );
                })}
              </div>
            </ScrollArea>
          </SortableContext>
        </DndContext>
      )}
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
      <mark className="bg-yellow-200 dark:bg-yellow-800 rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
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
  t,
}: SortablePathEntryProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 group hover:bg-muted',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary/20',
      )}
    >
      <button
        type="button"
        className="touch-none cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
      </button>

      <span className="font-mono text-xs flex-1 break-all min-w-0">
        {highlightText(entry.path, searchQuery)}
      </span>

      <Badge
        variant="outline"
        className={cn(
          'shrink-0 text-[10px]',
          entry.exists && entry.isDirectory
            ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
            : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
        )}
      >
        {entry.exists && entry.isDirectory ? (
          <><CheckCircle2 className="h-3 w-3 mr-0.5" />{t('envvar.pathEditor.exists')}</>
        ) : (
          <><XCircle className="h-3 w-3 mr-0.5" />{t('envvar.pathEditor.missing')}</>
        )}
      </Badge>

      {entry.isDuplicate && (
        <Badge
          variant="outline"
          className="shrink-0 text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
        >
          {t('envvar.pathEditor.duplicate')}
        </Badge>
      )}

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {entry.exists && entry.isDirectory && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onOpenFolder(entry.path)}
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
              disabled={index === 0}
              onClick={() => onMove(index, 'up')}
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
              disabled={index === totalCount - 1}
              onClick={() => onMove(index, 'down')}
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
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive">
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
