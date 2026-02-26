'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw, Plus, Upload, Download } from 'lucide-react';
import type { EnvVarScope } from '@/types/tauri';

interface EnvVarToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  scopeFilter: EnvVarScope | 'all';
  onScopeFilterChange: (scope: EnvVarScope | 'all') => void;
  onRefresh: () => void;
  onAdd: () => void;
  onImport: () => void;
  onExport: () => void;
  isLoading: boolean;
  t: (key: string) => string;
}

export function EnvVarToolbar({
  searchQuery,
  onSearchChange,
  scopeFilter,
  onScopeFilterChange,
  onRefresh,
  onAdd,
  onImport,
  onExport,
  isLoading,
  t,
}: EnvVarToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
      <Input
        placeholder={t('envvar.table.search')}
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="max-w-xs h-9"
      />
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

      <div className="flex items-center gap-1 ml-auto">
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {t('envvar.actions.refresh')}
        </Button>
        <Button variant="outline" size="sm" onClick={onImport} className="gap-1.5">
          <Upload className="h-3.5 w-3.5" />
          {t('envvar.importExport.import')}
        </Button>
        <Button variant="outline" size="sm" onClick={onExport} className="gap-1.5">
          <Download className="h-3.5 w-3.5" />
          {t('envvar.importExport.export')}
        </Button>
        <Button size="sm" onClick={onAdd} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {t('envvar.actions.add')}
        </Button>
      </div>
    </div>
  );
}
