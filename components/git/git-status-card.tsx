'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { GitBranch, Download, RefreshCw, ArrowUpCircle } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import type { GitStatusCardProps } from '@/types/git';

export function GitStatusCard({
  available,
  version,
  executablePath,
  loading,
  onInstall,
  onUpdate,
  onRefresh,
}: GitStatusCardProps) {
  const { t } = useLocale();

  if (available === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            {t('git.status.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            {t('git.status.title')}
          </CardTitle>
          <div className="flex items-center gap-2">
            {available && (
              <Button variant="outline" size="sm" onClick={onUpdate} disabled={loading}>
                <ArrowUpCircle className="h-4 w-4 mr-1" />
                {t('git.status.update')}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {available ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('git.status.version')}:</span>
              <Badge variant="secondary">{version || 'Unknown'}</Badge>
              <Badge variant="outline" className="text-green-600 border-green-600">
                {t('git.status.installed')}
              </Badge>
            </div>
            {executablePath && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('git.status.path')}:</span>
                <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                  {executablePath}
                </code>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="destructive">{t('git.status.notInstalled')}</Badge>
            </div>
            <Button onClick={onInstall} disabled={loading}>
              <Download className="h-4 w-4 mr-2" />
              {loading ? t('git.status.installing') : t('git.status.install')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
