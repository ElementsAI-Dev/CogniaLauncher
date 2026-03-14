'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EnvVarScope } from '@/types/tauri';

const SCOPE_COLORS: Record<EnvVarScope | 'all', string> = {
  all: 'bg-muted-foreground',
  process: 'bg-muted-foreground',
  user: 'bg-blue-500',
  system: 'bg-amber-500',
};

interface EnvVarToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  scopeFilter: EnvVarScope | 'all';
  onScopeFilterChange: (scope: EnvVarScope | 'all') => void | Promise<void>;
  disabled?: boolean;
  totalCount?: number;
  filteredCount?: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function EnvVarToolbar({
  searchQuery,
  onSearchChange,
  scopeFilter,
  onScopeFilterChange,
  disabled = false,
  totalCount,
  filteredCount,
  t,
}: EnvVarToolbarProps) {
  const showCount = totalCount !== undefined && filteredCount !== undefined;
  const isFiltered = showCount && filteredCount !== totalCount;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center" data-testid="envvar-toolbar">
      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('envvar.table.search')}
          aria-label={t('envvar.table.search')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn('h-9 pl-8', searchQuery && 'pr-8')}
          disabled={disabled}
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => onSearchChange('')}
            aria-label={t('common.clear')}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={scopeFilter}
          onValueChange={(v) => {
            void onScopeFilterChange(v as EnvVarScope | 'all');
          }}
          disabled={disabled}
        >
          <SelectTrigger className="h-9 w-full sm:w-[160px]" aria-label={t('envvar.table.scope')}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-block h-2 w-2 shrink-0 rounded-full',
                  SCOPE_COLORS[scopeFilter],
                )}
              />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <span className={cn('inline-block h-2 w-2 rounded-full', SCOPE_COLORS.all)} />
                {t('common.all')}
              </div>
            </SelectItem>
            <SelectItem value="process">
              <div className="flex items-center gap-2">
                <span className={cn('inline-block h-2 w-2 rounded-full', SCOPE_COLORS.process)} />
                {t('envvar.scopes.process')}
              </div>
            </SelectItem>
            <SelectItem value="user">
              <div className="flex items-center gap-2">
                <span className={cn('inline-block h-2 w-2 rounded-full', SCOPE_COLORS.user)} />
                {t('envvar.scopes.user')}
              </div>
            </SelectItem>
            <SelectItem value="system">
              <div className="flex items-center gap-2">
                <span className={cn('inline-block h-2 w-2 rounded-full', SCOPE_COLORS.system)} />
                {t('envvar.scopes.system')}
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        {showCount && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {isFiltered
              ? t('envvar.table.showingFiltered', { filtered: filteredCount, total: totalCount })
              : t('envvar.table.showingTotal', { total: totalCount })}
          </span>
        )}
      </div>
    </div>
  );
}
