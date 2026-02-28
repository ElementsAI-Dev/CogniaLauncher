'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowUpFromLine,
  ArrowDownToLine,
  RefreshCw,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import type { GitRepoActionBarProps } from '@/types/git';

type ActionKey = 'push' | 'pull' | 'fetch' | 'clean';

export function GitRepoActionBar({
  repoPath,
  aheadBehind,
  loading: externalLoading,
  onPush,
  onPull,
  onFetch,
  onClean,
  onRefresh,
}: GitRepoActionBarProps) {
  const { t } = useLocale();
  const [busyAction, setBusyAction] = useState<ActionKey | null>(null);

  const disabled = !repoPath || !!externalLoading;

  const runAction = async (key: ActionKey, fn: () => Promise<string>, successKey: string) => {
    setBusyAction(key);
    try {
      const msg = await fn();
      toast.success(t(successKey), { description: msg });
      onRefresh?.();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex flex-wrap items-center gap-2">
          {onPush && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={disabled || busyAction !== null}
              onClick={() => runAction('push', () => onPush(), 'git.pushAction.success')}
            >
              <ArrowUpFromLine className="h-3.5 w-3.5 mr-1" />
              {t('git.actions.push')}
              {aheadBehind && aheadBehind.ahead > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
                  {aheadBehind.ahead}
                </Badge>
              )}
            </Button>
          )}

          {onPull && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={disabled || busyAction !== null}
              onClick={() => runAction('pull', () => onPull(), 'git.pullAction.success')}
            >
              <ArrowDownToLine className="h-3.5 w-3.5 mr-1" />
              {t('git.actions.pull')}
              {aheadBehind && aheadBehind.behind > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  <ArrowDownLeft className="h-2.5 w-2.5 mr-0.5" />
                  {aheadBehind.behind}
                </Badge>
              )}
            </Button>
          )}

          {onFetch && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={disabled || busyAction !== null}
              onClick={() => runAction('fetch', () => onFetch(), 'git.fetchAction.success')}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${busyAction === 'fetch' ? 'animate-spin' : ''}`} />
              {t('git.actions.fetch')}
            </Button>
          )}

          {onClean && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-destructive"
              disabled={disabled || busyAction !== null}
              onClick={() => runAction('clean', () => onClean(), 'git.cleanAction.success')}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              {t('git.actions.clean')}
            </Button>
          )}

          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs ml-auto"
              disabled={disabled || busyAction !== null}
              onClick={onRefresh}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${externalLoading ? 'animate-spin' : ''}`} />
              {t('git.refresh')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
