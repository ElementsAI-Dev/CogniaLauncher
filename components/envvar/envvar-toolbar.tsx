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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Plus, Upload, Download, Search } from 'lucide-react';
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

      <Separator orientation="vertical" className="hidden sm:block h-6 mx-1" />

      <div className="flex items-center gap-1 ml-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              {t('envvar.actions.refresh')}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('envvar.actions.refresh')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" onClick={onImport} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              {t('envvar.importExport.import')}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('envvar.importExport.import')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" onClick={onExport} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              {t('envvar.importExport.export')}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('envvar.importExport.export')}</TooltipContent>
        </Tooltip>
        <Button size="sm" onClick={onAdd} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {t('envvar.actions.add')}
        </Button>
      </div>
    </div>
  );
}
