'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';
import type { EnvVarScope } from '@/types/tauri';

interface EnvVarToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  scopeFilter: EnvVarScope | 'all';
  onScopeFilterChange: (scope: EnvVarScope | 'all') => void | Promise<void>;
  disabled?: boolean;
  t: (key: string) => string;
}

export function EnvVarToolbar({
  searchQuery,
  onSearchChange,
  scopeFilter,
  onScopeFilterChange,
  disabled = false,
  t,
}: EnvVarToolbarProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" data-testid="envvar-toolbar">
      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder={t('envvar.table.search')}
          aria-label={t('envvar.table.search')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 pl-8"
          disabled={disabled}
        />
      </div>
      <div className="w-full sm:w-auto">
        <Select
          value={scopeFilter}
          onValueChange={(v) => {
            void onScopeFilterChange(v as EnvVarScope | 'all');
          }}
          disabled={disabled}
        >
          <SelectTrigger className="h-9 w-full sm:w-37.5" aria-label={t('envvar.table.scope')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="process">{t('envvar.scopes.process')}</SelectItem>
            <SelectItem value="user">{t('envvar.scopes.user')}</SelectItem>
            <SelectItem value="system">{t('envvar.scopes.system')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
