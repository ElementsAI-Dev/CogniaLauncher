'use client';

import { useState, useMemo, useCallback } from 'react';
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
} from '@/components/ui/empty';
import { Copy, Pencil, Trash2, Check, X, Variable, FolderOpen, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { isTauri } from '@/lib/tauri';
import type { EnvVarScope } from '@/types/tauri';
import type { EnvVarRow } from '@/lib/envvar';

interface EnvVarTableProps {
  rows: EnvVarRow[];
  scopeFilter: EnvVarScope | 'all';
  searchQuery: string;
  onEdit: (key: string, value: string, scope: EnvVarScope) => void;
  onDelete: (key: string, scope: EnvVarScope) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function EnvVarTable({
  rows,
  scopeFilter,
  searchQuery,
  onEdit,
  onDelete,
  t,
}: EnvVarTableProps) {
  const [editingRow, setEditingRow] = useState<{ key: string; scope: EnvVarScope } | null>(null);
  const [editValue, setEditValue] = useState('');

  const looksLikePath = useCallback((value: string): boolean => {
    if (!value || value.length < 2) return false;
    if (/^[A-Za-z]:[/\\]/.test(value)) return true;
    if (value.startsWith('/') && !value.startsWith('//')) return true;
    if (value.startsWith('~/')  || value.startsWith('~\\')) return true;
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

  const getScopeBadgeLabel = useCallback((scope: EnvVarScope) => {
    switch (scope) {
      case 'user':
        return t('envvar.scopes.user');
      case 'system':
        return t('envvar.scopes.system');
      default:
        return t('envvar.scopes.process');
    }
  }, [t]);

  const handleCopy = useCallback(async (value: string) => {
    await writeClipboard(value);
    toast.success(t('envvar.table.copied'));
  }, [t]);

  const handleStartEdit = useCallback((row: EnvVarRow) => {
    setEditingRow({ key: row.key, scope: row.scope });
    setEditValue(row.value);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingRow) {
      onEdit(editingRow.key, editValue, editingRow.scope);
      setEditingRow(null);
      setEditValue('');
    }
  }, [editingRow, editValue, onEdit]);

  const handleCancelEdit = useCallback(() => {
    setEditingRow(null);
    setEditValue('');
  }, []);

  if (filteredRows.length === 0) {
    return (
      <Empty className="border-none py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Variable />
          </EmptyMedia>
          <EmptyTitle className="text-sm font-normal text-muted-foreground">
            {searchQuery
              ? t('envvar.table.noResults')
              : isPersistentScope
                ? t('envvar.table.noPersistentVars')
                : t('envvar.table.noResults')}
          </EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ScrollArea className="max-h-[600px]">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[280px]">{t('envvar.table.key')}</TableHead>
              <TableHead>{t('envvar.table.value')}</TableHead>
              <TableHead className="w-[100px]">{t('envvar.table.scope')}</TableHead>
              <TableHead className="w-[100px] text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row, index) => {
              const rowId = `${row.scope}:${row.key}:${index}`;
              const isEditing = editingRow?.key === row.key && editingRow.scope === row.scope;
              const value = row.value;
              return (
              <TableRow key={rowId} className="group">
                <TableCell className="font-mono text-xs py-2">
                  <div className="space-y-1">
                    <span className="break-all">{row.key}</span>
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
                    <div className="flex items-center gap-1">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        className="h-7 text-xs"
                        autoFocus
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleSaveEdit}>
                        <Check className="h-3 w-3 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCancelEdit}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={cn(
                            'text-xs text-muted-foreground break-all line-clamp-2 cursor-pointer hover:text-foreground',
                          )}
                          onDoubleClick={() => handleStartEdit(row)}
                        >
                          {value || <span className="italic opacity-50">(empty)</span>}
                        </span>
                      </TooltipTrigger>
                      {value && value.length > 60 && (
                        <TooltipContent side="bottom" className="max-w-sm font-mono text-xs break-all">
                          {value}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell className="py-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {getScopeBadgeLabel(row.scope)}
                  </Badge>
                </TableCell>
                <TableCell className="py-2 text-right">
                  <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {looksLikePath(value) && (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRevealPath(value)}>
                              <FolderOpen className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">{t('envvar.table.openPath')}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenPath(value)}>
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">{t('envvar.table.openFile')}</TooltipContent>
                        </Tooltip>
                      </>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(value)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">{t('envvar.table.copy')}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleStartEdit(row)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">{t('envvar.actions.edit')}</TooltipContent>
                    </Tooltip>
                    <AlertDialog>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                              <Trash2 className="h-3 w-3" />
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
                </TableCell>
              </TableRow>
            )})}
          </TableBody>
        </Table>
      </div>
    </ScrollArea>
  );
}
