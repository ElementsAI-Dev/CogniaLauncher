'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { GitFork, RefreshCw } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import type { GitBisectCardProps } from '@/types/git';

export function GitBisectCard({
  bisectState,
  loading,
  onRefreshState,
  onStart,
  onGood,
  onBad,
  onSkip,
  onReset,
  onLog,
}: GitBisectCardProps) {
  const { t } = useLocale();
  const [badRef, setBadRef] = useState('HEAD');
  const [goodRef, setGoodRef] = useState('');
  const [log, setLog] = useState('');
  const [busy, setBusy] = useState(false);

  const disabled = loading || busy;

  const run = async (fn: () => Promise<string>, successMessage?: string) => {
    setBusy(true);
    try {
      const msg = await fn();
      if (successMessage) {
        toast.success(successMessage, { description: msg });
      }
      await onRefreshState();
      return msg;
    } catch (e) {
      toast.error(String(e));
      return '';
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <GitFork className="h-4 w-4" />
          {t('git.bisect.title')}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs ml-auto"
            disabled={disabled}
            onClick={() => onRefreshState()}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${disabled ? 'animate-spin' : ''}`} />
            {t('git.refresh')}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!bisectState.active ? (
          <div className="space-y-2">
            <Input
              value={badRef}
              onChange={(e) => setBadRef(e.target.value)}
              placeholder={t('git.bisect.badRefPlaceholder')}
              className="h-7 text-xs font-mono"
              disabled={disabled}
            />
            <Input
              value={goodRef}
              onChange={(e) => setGoodRef(e.target.value)}
              placeholder={t('git.bisect.goodRefPlaceholder')}
              className="h-7 text-xs font-mono"
              disabled={disabled}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={disabled || !badRef.trim() || !goodRef.trim()}
              onClick={() => run(() => onStart(badRef.trim(), goodRef.trim()), t('git.bisect.start'))}
            >
              {t('git.bisect.start')}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">{t('git.bisect.currentCommit')}: {bisectState.currentHash?.slice(0, 10) ?? 'N/A'}</Badge>
              <Badge variant="outline">{t('git.bisect.stepsTaken', { count: String(bisectState.stepsTaken) })}</Badge>
              {bisectState.remainingEstimate !== null && (
                <Badge variant="outline">
                  {t('git.bisect.stepsRemaining', { count: String(bisectState.remainingEstimate) })}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={disabled} onClick={() => run(onGood)}>
                {t('git.bisect.good')}
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={disabled} onClick={() => run(onBad)}>
                {t('git.bisect.bad')}
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={disabled} onClick={() => run(onSkip)}>
                {t('git.bisect.skip')}
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={disabled} onClick={() => run(onReset, t('git.bisect.reset'))}>
                {t('git.bisect.reset')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={disabled}
                onClick={async () => {
                  const logResult = await run(onLog);
                  if (logResult) setLog(logResult);
                }}
              >
                {t('git.bisect.log')}
              </Button>
            </div>
          </div>
        )}
        {log && (
          <pre className="rounded border bg-muted/30 p-2 text-xs overflow-auto max-h-48">
            {log}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
