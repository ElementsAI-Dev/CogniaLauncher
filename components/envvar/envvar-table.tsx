'use client';

import { useState, useMemo, useCallback } from 'react';
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
import { Copy, Pencil, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EnvVarTableProps {
  envVars: Record<string, string>;
  searchQuery: string;
  onEdit: (key: string, value: string) => void;
  onDelete: (key: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function EnvVarTable({
  envVars,
  searchQuery,
  onEdit,
  onDelete,
  t,
}: EnvVarTableProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const filteredVars = useMemo(() => {
    const entries = Object.entries(envVars);
    if (!searchQuery) return entries;
    const query = searchQuery.toLowerCase();
    return entries.filter(
      ([key, value]) =>
        key.toLowerCase().includes(query) || value.toLowerCase().includes(query),
    );
  }, [envVars, searchQuery]);

  const handleCopy = useCallback((value: string) => {
    navigator.clipboard.writeText(value).then(() => {
      toast.success(t('envvar.table.copied'));
    });
  }, [t]);

  const handleStartEdit = useCallback((key: string, currentValue: string) => {
    setEditingKey(key);
    setEditValue(currentValue);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingKey) {
      onEdit(editingKey, editValue);
      setEditingKey(null);
      setEditValue('');
    }
  }, [editingKey, editValue, onEdit]);

  const handleCancelEdit = useCallback(() => {
    setEditingKey(null);
    setEditValue('');
  }, []);

  if (filteredVars.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        {searchQuery ? t('envvar.table.noResults') : t('envvar.table.noResults')}
      </div>
    );
  }

  return (
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
          {filteredVars.map(([key, value]) => (
            <TableRow key={key} className="group">
              <TableCell className="font-mono text-xs py-2">
                <span className="break-all">{key}</span>
              </TableCell>
              <TableCell className="py-2">
                {editingKey === key ? (
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
                  <span
                    className={cn(
                      'text-xs text-muted-foreground break-all line-clamp-2 cursor-pointer hover:text-foreground',
                    )}
                    onDoubleClick={() => handleStartEdit(key, value)}
                    title={value}
                  >
                    {value || <span className="italic opacity-50">(empty)</span>}
                  </span>
                )}
              </TableCell>
              <TableCell className="py-2">
                <Badge variant="secondary" className="text-[10px]">
                  {t('envvar.scopes.process')}
                </Badge>
              </TableCell>
              <TableCell className="py-2 text-right">
                <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(value)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{t('envvar.table.copied')}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleStartEdit(key, value)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{t('envvar.actions.edit')}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(key)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{t('envvar.actions.delete')}</TooltipContent>
                  </Tooltip>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
