'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { writeClipboard } from '@/lib/clipboard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { Copy, Pencil, Trash2, Check, X, Variable, FolderOpen, ExternalLink, Search } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { isTauri } from '@/lib/tauri';
import type { EnvVarScope } from '@/types/tauri';
import type { EnvVarRow } from '@/lib/envvar';

const SCOPE_BORDER_COLORS: Record<EnvVarScope, string> = {
  process: 'border-l-muted-foreground/30',
  user: 'border-l-blue-500/40',
  system: 'border-l-amber-500/40',
};

const SCOPE_BADGE_VARIANTS: Record<EnvVarScope, string> = {
  process: '',
  user: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  system: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400',
};

interface EnvVarTableProps {
  rows: EnvVarRow[];
  scopeFilter: EnvVarScope | 'all';
  searchQuery: string;
  onEdit: (key: string, value: string, scope: EnvVarScope) => void;
  onDelete: (key: string, scope: EnvVarScope) => void;
  busy?: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function EnvVarTable({
  rows,
  scopeFilter,
  searchQuery,
  onEdit,
  onDelete,
  busy = false,
  t,
}: EnvVarTableProps) {
  const [editingRow, setEditingRow] = useState<{ key: string; scope: EnvVarScope } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [compactMode, setCompactMode] = useState(false);

  useEffect(() => {
    const syncViewport = () => setCompactMode(window.innerWidth < 768);
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  const showScopeColumn = scopeFilter === 'all';

  const looksLikePath = useCallback((value: string): boolean => {
    if (!value || value.length < 2) return false;
    if (/^[A-Za-z]:[/\\]/.test(value)) return true;
    if (value.startsWith('/') && !value.startsWith('//')) return true;
    if (value.startsWith('~/') || value.startsWith('~\\')) return true;
    return false;
  }, []);

  const handleOpenPath = useCallback(async (path: string) => {
    if (!isTauri()) return;
    try {
      const { openPath } = await import('@tauri-apps/plugin-opener');
      await openPath(path);
    } catch (err) {
      toast.error(String(err));
    }
  }, []);

  const handleRevealPath = useCallback(async (path: string) => {
    if (!isTauri()) return;
    try {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
      await revealItemInDir(path);
    } catch (err) {
      toast.error(String(err));
    }
  }, []);

  const isPersistentScope = scopeFilter === 'user' || scopeFilter === 'system';

  const filteredRows = useMemo(() => {
    if (!searchQuery) return rows;
    const query = searchQuery.toLowerCase();
    return rows.filter(
      (row) =>
        row.key.toLowerCase().includes(query) || row.value.toLowerCase().includes(query),
    );
  }, [rows, searchQuery]);

  const getScopeBadgeLabel = useCallback(
    (scope: EnvVarScope) => {
      switch (scope) {
        case 'user':
          return t('envvar.scopes.user');
        case 'system':
          return t('envvar.scopes.system');
        default:
          return t('envvar.scopes.process');
      }
    },
    [t],
  );

  const handleCopy = useCallback(
    async (value: string) => {
      await writeClipboard(value);
      toast.success(t('envvar.table.copied'));
    },
    [t],
  );

  const handleStartEdit = useCallback(
    (row: EnvVarRow) => {
      if (busy) return;
      setEditingRow({ key: row.key, scope: row.scope });
      setEditValue(row.value);
    },
    [busy],
  );

  const handleSaveEdit = useCallback(() => {
    if (!editingRow || busy) return;
    onEdit(editingRow.key, editValue, editingRow.scope);
    setEditingRow(null);
    setEditValue('');
  }, [busy, editingRow, editValue, onEdit]);

  const handleCancelEdit = useCallback(() => {
    setEditingRow(null);
    setEditValue('');
  }, []);

  if (filteredRows.length === 0) {
    return (
      <Empty className="border-none py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {searchQuery ? <Search /> : <Variable />}
          </EmptyMedia>
          <EmptyTitle className="text-sm font-normal text-muted-foreground">
            {searchQuery
              ? t('envvar.table.noResults')
              : isPersistentScope
                ? t('envvar.table.noPersistentVars')
                : t('envvar.table.noResults')}
          </EmptyTitle>
          {searchQuery && (
            <EmptyDescription className="text-xs text-muted-foreground">
              {t('envvar.table.noSearchMatch', { query: searchQuery })}
            </EmptyDescription>
          )}
        </EmptyHeader>
      </Empty>
    );
  }

  const renderActionButtons = (row: EnvVarRow, isCompact: boolean) => {
    const value = row.value;
    const btnSize = isCompact ? 'h-7 w-7' : 'h-7 w-7';
    const iconSize = 'h-3 w-3';
    return (
      <div
        className={cn(
          'flex items-center gap-0.5',
          isCompact
            ? 'justify-end opacity-100'
            : 'justify-end opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100',
        )}
      >
        {looksLikePath(value) && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={btnSize}
                  onClick={() => handleRevealPath(value)}
                  disabled={busy}
                  aria-label={t('envvar.table.openPath')}
                >
                  <FolderOpen className={iconSize} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('envvar.table.openPath')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={btnSize}
                  onClick={() => handleOpenPath(value)}
                  disabled={busy}
                  aria-label={t('envvar.table.openFile')}
                >
                  <ExternalLink className={iconSize} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('envvar.table.openFile')}</TooltipContent>
            </Tooltip>
          </>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={btnSize}
              onClick={() => handleCopy(value)}
              disabled={busy}
              aria-label={t('envvar.table.copy')}
            >
              <Copy className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{t('envvar.table.copy')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={btnSize}
              onClick={() => handleStartEdit(row)}
              disabled={busy}
              aria-label={t('envvar.actions.edit')}
            >
              <Pencil className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{t('envvar.actions.edit')}</TooltipContent>
        </Tooltip>
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(btnSize, 'text-destructive')}
                  disabled={busy}
                  aria-label={t('envvar.actions.delete')}
                >
                  <Trash2 className={iconSize} />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">{t('envvar.actions.delete')}</TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('envvar.confirm.deleteTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('envvar.confirm.deleteDesc')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(row.key, row.scope)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t('envvar.actions.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  };

  const renderEditMode = (row: EnvVarRow, isCompact: boolean) => (
    <div className="flex items-center gap-1">
      <Input
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSaveEdit();
          if (e.key === 'Escape') handleCancelEdit();
        }}
        className={cn('text-xs font-mono', isCompact ? 'h-8' : 'h-7')}
        autoFocus
        disabled={busy}
      />
      <Button
        variant="ghost"
        size="icon"
        className={cn('shrink-0', isCompact ? 'h-8 w-8' : 'h-7 w-7')}
        onClick={handleSaveEdit}
        disabled={busy}
      >
        <span className="sr-only">{t('common.save')}</span>
        <Check className="h-3.5 w-3.5 text-green-600" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn('shrink-0', isCompact ? 'h-8 w-8' : 'h-7 w-7')}
        onClick={handleCancelEdit}
        disabled={busy}
      >
        <span className="sr-only">{t('common.cancel')}</span>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  // --- Compact mode (mobile) ---
  if (compactMode) {
    return (
      <div className="space-y-2 p-2" data-testid="envvar-compact-list">
        {filteredRows.map((row, index) => {
          const rowId = `${row.scope}:${row.key}:${index}`;
          const isEditing = editingRow?.key === row.key && editingRow.scope === row.scope;
          return (
            <div
              key={rowId}
              className={cn(
                'group rounded-md border-l-[3px] border bg-background p-3 space-y-2',
                SCOPE_BORDER_COLORS[row.scope],
                row.conflict && 'bg-destructive/5',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-medium break-all">{row.key}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Badge
                      variant="outline"
                      className={cn('text-[10px] px-1.5 py-0', SCOPE_BADGE_VARIANTS[row.scope])}
                    >
                      {getScopeBadgeLabel(row.scope)}
                    </Badge>
                    {row.conflict && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        {t('envvar.conflicts.title')}
                      </Badge>
                    )}
                    {row.regType && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {row.regType}
                      </Badge>
                    )}
                  </div>
                </div>
                {renderActionButtons(row, true)}
              </div>

              <div>
                {isEditing ? (
                  renderEditMode(row, true)
                ) : (
                  <p
                    className={cn(
                      'font-mono text-xs text-muted-foreground break-all line-clamp-3',
                      !busy && 'cursor-pointer',
                    )}
                    onDoubleClick={() => handleStartEdit(row)}
                  >
                    {row.value || <span className="italic opacity-50">(empty)</span>}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // --- Desktop mode ---
  return (
    <ScrollArea className="h-full min-h-0" data-testid="envvar-table-desktop">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[220px] min-w-[160px]">{t('envvar.table.key')}</TableHead>
              <TableHead>{t('envvar.table.value')}</TableHead>
              {showScopeColumn && (
                <TableHead className="w-[100px]">{t('envvar.table.scope')}</TableHead>
              )}
              <TableHead className="w-[120px] text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row, index) => {
              const rowId = `${row.scope}:${row.key}:${index}`;
              const isEditing = editingRow?.key === row.key && editingRow.scope === row.scope;
              return (
                <TableRow
                  key={rowId}
                  className={cn(
                    'group border-l-[3px]',
                    SCOPE_BORDER_COLORS[row.scope],
                    row.conflict && 'bg-destructive/5',
                  )}
                >
                  <TableCell className="py-2">
                    <div className="space-y-1">
                      <span className="font-mono text-xs font-medium break-all">
                        {row.key}
                      </span>
                      <div className="flex items-center gap-1">
                        {row.conflict && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            {t('envvar.conflicts.title')}
                          </Badge>
                        )}
                        {row.regType && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {row.regType}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    {isEditing ? (
                      renderEditMode(row, false)
                    ) : (
                      <div className="group/value flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={cn(
                                'font-mono text-xs text-muted-foreground break-all line-clamp-2',
                                !busy && 'cursor-pointer hover:text-foreground',
                              )}
                              onDoubleClick={() => handleStartEdit(row)}
                            >
                              {row.value || (
                                <span className="italic opacity-50">(empty)</span>
                              )}
                            </span>
                          </TooltipTrigger>
                          {row.value && row.value.length > 60 && (
                            <TooltipContent
                              side="bottom"
                              className="max-w-md break-all font-mono text-xs"
                            >
                              {row.value}
                            </TooltipContent>
                          )}
                        </Tooltip>
                        <Pencil className="h-3 w-3 shrink-0 text-muted-foreground/0 transition-colors group-hover/value:text-muted-foreground/50" />
                      </div>
                    )}
                  </TableCell>
                  {showScopeColumn && (
                    <TableCell className="py-2">
                      <Badge
                        variant="outline"
                        className={cn('text-[10px]', SCOPE_BADGE_VARIANTS[row.scope])}
                      >
                        {getScopeBadgeLabel(row.scope)}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell className="py-2 text-right">
                    {renderActionButtons(row, false)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </ScrollArea>
  );
}
