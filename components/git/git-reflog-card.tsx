'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, Loader2, RotateCcw } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { formatRelativeDate } from '@/lib/utils/git-date';
import type { GitReflogEntry } from '@/types/tauri';
import type { GitReflogCardProps } from '@/types/git';

export function GitReflogCard({ onGetReflog, onResetTo }: GitReflogCardProps) {
  const { t } = useLocale();
  const [entries, setEntries] = useState<GitReflogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const handleLoad = useCallback(async () => {
    setLoading(true);
    try {
      const data = await onGetReflog(50);
      setEntries(data);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [onGetReflog]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4" />
            {t('git.reflog.title')}
            {loaded && <Badge variant="secondary">{entries.length}</Badge>}
          </CardTitle>
          {!loaded && (
            <Button size="sm" variant="outline" onClick={handleLoad} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('git.reflog.load')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!loaded && !loading ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            {t('git.reflog.empty')}
          </p>
        ) : loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            {t('git.reflog.empty')}
          </p>
        ) : (
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {entries.map((entry, i) => (
              <div
                key={`${entry.selector}-${i}`}
                className="flex items-center gap-2 text-xs py-1.5 px-1 rounded hover:bg-muted/50"
              >
                <code className="font-mono text-muted-foreground shrink-0 w-14">
                  {entry.hash.slice(0, 7)}
                </code>
                <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">
                  {entry.action}
                </Badge>
                <span className="truncate flex-1">{entry.message}</span>
                <span className="text-muted-foreground shrink-0">
                  {formatRelativeDate(entry.date)}
                </span>
                {onResetTo && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0"
                    onClick={() => onResetTo(entry.hash, 'mixed')}
                    title={t('git.reflog.resetTo')}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
