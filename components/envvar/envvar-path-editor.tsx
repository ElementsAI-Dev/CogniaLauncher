'use client';

import { useState, useCallback } from 'react';
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
import { GripVertical, Plus, Trash2, CheckCircle2, XCircle, ArrowUp, ArrowDown, Copy, Route, FolderOpen } from 'lucide-react';
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
      console.error('Failed to open folder:', err);
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
        <Button size="sm" onClick={handleAdd} disabled={!newPath.trim() || loading} className="gap-1.5 shrink-0">
          <Plus className="h-3.5 w-3.5" />
          {t('envvar.pathEditor.add')}
        </Button>
      </div>

      {/* Entries list */}
      {pathEntries.length === 0 ? (
        <Empty className="border-none py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Route />
            </EmptyMedia>
            <EmptyTitle className="text-sm font-normal text-muted-foreground">
              {t('envvar.pathEditor.empty')}
            </EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ScrollArea className="max-h-[480px]">
          <div className="space-y-1">
            {pathEntries.map((entry, index) => (
              <div
                key={`${entry.path}-${index}`}
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 group hover:bg-muted"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0 cursor-grab" />

                <span className="font-mono text-xs flex-1 break-all min-w-0">{entry.path}</span>

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
                          onClick={() => handleOpenFolder(entry.path)}
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
                        onClick={() => handleMove(index, 'up')}
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
                        disabled={index === pathEntries.length - 1}
                        onClick={() => handleMove(index, 'down')}
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
                          onClick={() => handleRemove(entry.path)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {t('envvar.actions.delete')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
