'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  History,
  Download,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { useLocale } from '@/components/providers/locale-provider';
import { ACTION_ICONS } from '@/lib/constants/packages';
import type { PackageHistoryListProps } from '@/types/packages';

export function PackageHistoryList({
  history,
  loading,
}: PackageHistoryListProps) {
  const { t } = useLocale();

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      install: t('packages.detail.actionInstall'),
      uninstall: t('packages.detail.actionUninstall'),
      update: t('packages.detail.actionUpdate'),
      rollback: t('packages.detail.actionRollback'),
      pin: t('packages.detail.actionPin'),
      unpin: t('packages.detail.actionUnpin'),
    };
    return labels[action] || action;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {t('packages.detail.installHistory')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          {t('packages.detail.installHistory')}
        </CardTitle>
        <CardDescription>
          {t('packages.detail.installHistoryDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <Empty className="border-none py-12">
            <EmptyHeader>
              <EmptyMedia>
                <History className="h-12 w-12 opacity-50" />
              </EmptyMedia>
              <EmptyTitle className="text-sm font-normal text-muted-foreground">
                {t('packages.detail.noHistoryForPackage')}
              </EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-2 pr-4">
              {history.map((entry) => {
                const ActionIcon = ACTION_ICONS[entry.action] || Download;
                return (
                  <div
                    key={entry.id}
                    className={`
                      flex items-center justify-between p-3 border rounded-lg
                      ${entry.success ? '' : 'border-destructive/30 bg-destructive/5'}
                    `}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 ${
                        entry.success ? 'bg-green-500/10' : 'bg-destructive/10'
                      }`}>
                        <ActionIcon className={`h-4 w-4 ${
                          entry.success ? 'text-green-600' : 'text-destructive'
                        }`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{getActionLabel(entry.action)}</span>
                          <Badge variant="outline" className="font-mono text-xs">{entry.version}</Badge>
                          <Badge variant="secondary" className="text-xs">{entry.provider}</Badge>
                          {entry.success ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                          )}
                        </div>
                        {entry.error_message && (
                          <p className="text-xs text-destructive mt-1 truncate">
                            {t('packages.detail.errorMessage', { message: entry.error_message })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0 ml-4">
                      {new Date(entry.timestamp).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
