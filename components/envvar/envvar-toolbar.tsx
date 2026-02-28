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
  onScopeFilterChange: (scope: EnvVarScope | 'all') => void;
  t: (key: string) => string;
}

export function EnvVarToolbar({
  searchQuery,
  onSearchChange,
  scopeFilter,
  onScopeFilterChange,
  t,
}: EnvVarToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
      <div className="relative max-w-xs w-full">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder={t('envvar.table.search')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 pl-8"
        />
      </div>
      <Select
        value={scopeFilter}
        onValueChange={(v) => onScopeFilterChange(v as EnvVarScope | 'all')}
      >
        <SelectTrigger className="w-[130px] h-9">
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
  );
}
