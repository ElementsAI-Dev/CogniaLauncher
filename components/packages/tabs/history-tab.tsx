'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-primitives';
import { useLocale } from '@/components/providers/locale-provider';
import { AlertCircle, RefreshCw, ArrowUp, History } from 'lucide-react';
import { toast } from 'sonner';
import type { ProviderInfo, InstallHistoryEntry, InstallHistoryQuery } from '@/lib/tauri';

interface HistoryFilters {
  name: string;
  provider: string;
  action: string;
  success: 'all' | 'success' | 'failed';
}

const DEFAULT_FILTERS: HistoryFilters = {
  name: '',
  provider: 'all',
  action: 'all',
  success: 'all',
};

export interface HistoryTabProps {
  providers: ProviderInfo[];
  loadHistory: (query: InstallHistoryQuery) => Promise<InstallHistoryEntry[]>;
  clearHistory: () => Promise<void>;
  onOpenDetail: (name: string, provider: string) => void;
}

export function HistoryTab({
  providers,
  loadHistory,
  clearHistory,
  onOpenDetail,
}: HistoryTabProps) {
  const { t } = useLocale();
  const [history, setHistory] = useState<InstallHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);
  const loadedRef = useRef(false);

  const doLoad = useCallback(async (filtersOverride?: Partial<HistoryFilters>) => {
    const effective = { ...filters, ...(filtersOverride ?? {}) };
    setLoading(true);
    setError(null);
    try {
      const entries = await loadHistory({
        limit: 200,
        name: effective.name.trim() || undefined,
        provider: effective.provider !== 'all' ? effective.provider : undefined,
        action: effective.action !== 'all' ? effective.action : undefined,
        success: effective.success === 'all' ? undefined : effective.success === 'success',
      });
      setHistory(entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [loadHistory, filters]);

  // Load on first mount
  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      void doLoad();
    }
  }, [doLoad]);

  const handleClear = useCallback(async () => {
    setClearing(true);
    try {
      await clearHistory();
      setHistory([]);
      setError(null);
      toast.success(t('packages.historyCleared'));
    } catch (err) {
      toast.error(t('packages.historyClearFailed', { error: String(err) }));
    } finally {
      setClearing(false);
    }
  }, [clearHistory, t]);

  const handleReset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    void doLoad(DEFAULT_FILTERS);
  }, [doLoad]);

  return (
    <Card className="flex min-h-0 flex-1 flex-col">
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                {t('packages.installHistory')}
              </CardTitle>
              <CardDescription>
                {t('packages.installHistoryDesc')}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void doLoad()}
                disabled={loading || clearing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {t('providers.refresh')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleClear()}
                disabled={loading || clearing || history.length === 0}
              >
                {t('packages.clearHistory')}
              </Button>
            </div>
          </div>

          {/* Responsive filter bar */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <Input
                placeholder={t('packages.historyNameFilter')}
                value={filters.name}
                onChange={(e) => setFilters((c) => ({ ...c, name: e.target.value }))}
              />
            </div>
            <div className="w-[160px]">
              <Select
                value={filters.provider}
                onValueChange={(v) => setFilters((c) => ({ ...c, provider: v }))}
              >
                <SelectTrigger aria-label={t('packages.providers')}>
                  <SelectValue placeholder={t('packages.providers')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('packages.allProviders')}</SelectItem>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[160px]">
              <Select
                value={filters.action}
                onValueChange={(v) => setFilters((c) => ({ ...c, action: v }))}
              >
                <SelectTrigger aria-label={t('packages.historyActionFilter')}>
                  <SelectValue placeholder={t('packages.historyActionFilter')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('packages.historyActionFilter')}</SelectItem>
                  {['install', 'uninstall', 'update', 'rollback'].map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[160px]">
              <Select
                value={filters.success}
                onValueChange={(v: 'all' | 'success' | 'failed') => setFilters((c) => ({ ...c, success: v }))}
              >
                <SelectTrigger aria-label={t('packages.historyStatusFilter')}>
                  <SelectValue placeholder={t('packages.historyStatusFilter')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('packages.historyStatusAll')}</SelectItem>
                  <SelectItem value="success">{t('packages.historyStatusSuccess')}</SelectItem>
                  <SelectItem value="failed">{t('packages.historyStatusFailed')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => void doLoad()}>
                {t('packages.historyApplyFilters')}
              </Button>
              <Button variant="ghost" onClick={handleReset}>
                {t('packages.historyResetFilters')}
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1">
        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <DashboardEmptyState
            icon={<History className="h-8 w-8 text-muted-foreground" />}
            message={t('packages.noHistory')}
          />
        ) : (
          <ScrollArea className="h-full min-h-0 pr-2">
            <div className="space-y-2">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex flex-col gap-2 p-3 border rounded-lg sm:flex-row sm:items-center sm:justify-between ${
                    entry.success ? '' : 'border-destructive/30 bg-destructive/5'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`p-2 rounded ${
                      entry.success ? 'bg-green-500/10' : 'bg-destructive/10'
                    }`}>
                      {entry.action === 'install' ? (
                        <ArrowUp className={`h-4 w-4 ${entry.success ? 'text-green-500' : 'text-destructive'}`} />
                      ) : (
                        <RefreshCw className={`h-4 w-4 ${entry.success ? 'text-green-500' : 'text-destructive'}`} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium break-all sm:truncate" title={entry.name}>
                        {entry.name}
                      </div>
                      <div className="text-xs text-muted-foreground break-all">
                        {entry.action} • {entry.version} • {entry.provider}
                      </div>
                      {entry.error_message && (
                        <div className="text-xs text-destructive break-all">
                          {entry.error_message}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 sm:text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenDetail(entry.name, entry.provider)}
                    >
                      {t('packages.historyOpenDetails')}
                    </Button>
                    <div className="text-xs text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
