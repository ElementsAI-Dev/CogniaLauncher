'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
import { useGitActionDialogs } from './use-git-action-dialogs';

type ActionKey = 'push' | 'pull' | 'fetch' | 'clean';

export function GitRepoActionBar({
  repoPath,
  currentBranch,
  remotes,
  aheadBehind,
  loading: externalLoading,
  onPush,
  onPull,
  onFetch,
  onClean,
  onCleanPreview,
  onRefresh,
}: GitRepoActionBarProps) {
  const { t } = useLocale();
  const [busyAction, setBusyAction] = useState<ActionKey | null>(null);
  const [remote, setRemote] = useState(() => remotes?.[0]?.name ?? '');
  const [branch, setBranch] = useState(() => currentBranch ?? '');
  const [remoteEdited, setRemoteEdited] = useState(false);
  const [branchEdited, setBranchEdited] = useState(false);
  const [pushForce, setPushForce] = useState(false);
  const [pushForceLease, setPushForceLease] = useState(false);
  const [pushSetUpstream, setPushSetUpstream] = useState(false);
  const [pullRebase, setPullRebase] = useState(false);
  const [pullAutostash, setPullAutostash] = useState(false);
  const [fetchPrune, setFetchPrune] = useState(false);
  const [fetchAll, setFetchAll] = useState(false);
  const [cleanDirectories, setCleanDirectories] = useState(false);
  const { confirm, dialogs } = useGitActionDialogs();

  const disabled = !repoPath || !!externalLoading;

  useEffect(() => {
    setRemote(remotes?.[0]?.name ?? '');
    setBranch(currentBranch ?? '');
    setRemoteEdited(false);
    setBranchEdited(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath]);

  useEffect(() => {
    if (remoteEdited) return;
    setRemote(remotes?.[0]?.name ?? '');
  }, [remotes, remoteEdited]);

  useEffect(() => {
    if (branchEdited) return;
    setBranch(currentBranch ?? '');
  }, [currentBranch, branchEdited]);

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

  const handleClean = async () => {
    if (!onClean) return;
    if (onCleanPreview) {
      try {
        const preview = await onCleanPreview(cleanDirectories);
        if (preview.length === 0) {
          toast.success(t('git.cleanAction.wouldRemove', { count: '0' }));
          return;
        }
      } catch (e) {
        toast.error(String(e));
        return;
      }
    }

    const shouldClean = await confirm({
      title: t('git.actions.clean'),
      description: t('git.actions.cleanConfirm'),
    });
    if (!shouldClean) return;

    await runAction(
      'clean',
      () => onClean(cleanDirectories, true),
      'git.cleanAction.success',
    );
  };

  return (
    <>
    <Card>
      <CardContent className="py-3">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
          {onPush && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={disabled || busyAction !== null}
              onClick={async () => {
                const requiresRiskConfirm = pushForce || pushForceLease;
                if (requiresRiskConfirm) {
                  const confirmed = await confirm({
                    title: t('git.actions.push'),
                    description: t('git.actions.pushConfirm'),
                  });
                  if (!confirmed) return;
                }
                await runAction(
                  'push',
                  () =>
                    onPush(
                      remote.trim() ? remote.trim() : undefined,
                      branch.trim() ? branch.trim() : undefined,
                      pushForce,
                      pushForceLease,
                      pushSetUpstream,
                      requiresRiskConfirm,
                    ),
                  'git.pushAction.success',
                );
              }}
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
              onClick={() => runAction(
                'pull',
                () => onPull(
                  remote.trim() ? remote.trim() : undefined,
                  branch.trim() ? branch.trim() : undefined,
                  pullRebase,
                  pullAutostash,
                ),
                'git.pullAction.success',
              )}
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
              onClick={() => runAction(
                'fetch',
                () => onFetch(
                  fetchAll ? undefined : (remote.trim() ? remote.trim() : undefined),
                  fetchPrune,
                  fetchAll,
                ),
                'git.fetchAction.success',
              )}
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
              onClick={handleClean}
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

          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            <Input
              value={remote}
              onChange={(e) => {
                setRemoteEdited(true);
                setRemote(e.target.value);
              }}
              placeholder="remote"
              className="h-7 text-xs font-mono"
              disabled={disabled || busyAction !== null}
              list="git-remote-names"
            />
            <Input
              value={branch}
              onChange={(e) => {
                setBranchEdited(true);
                setBranch(e.target.value);
              }}
              placeholder="branch"
              className="h-7 text-xs font-mono"
              disabled={disabled || busyAction !== null}
            />
            {remotes && remotes.length > 0 && (
              <datalist id="git-remote-names">
                {remotes.map((r) => (
                  <option key={r.name} value={r.name} />
                ))}
              </datalist>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <label className="inline-flex items-center gap-2">
              <Checkbox
                checked={pushForce}
                onCheckedChange={(v) => setPushForce(v === true)}
                disabled={disabled || busyAction !== null}
              />
              <span>push --force</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <Checkbox
                checked={pushForceLease}
                onCheckedChange={(v) => setPushForceLease(v === true)}
                disabled={disabled || busyAction !== null}
              />
              <span>{t('git.pushAction.forceLease')}</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <Checkbox
                checked={pushSetUpstream}
                onCheckedChange={(v) => setPushSetUpstream(v === true)}
                disabled={disabled || busyAction !== null}
              />
              <span>push --set-upstream</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <Checkbox
                checked={pullRebase}
                onCheckedChange={(v) => setPullRebase(v === true)}
                disabled={disabled || busyAction !== null}
              />
              <span>{t('git.pullAction.rebase')}</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <Checkbox
                checked={pullAutostash}
                onCheckedChange={(v) => setPullAutostash(v === true)}
                disabled={disabled || busyAction !== null}
              />
              <span>pull --autostash</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <Checkbox
                checked={fetchPrune}
                onCheckedChange={(v) => setFetchPrune(v === true)}
                disabled={disabled || busyAction !== null}
              />
              <span>fetch --prune</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <Checkbox
                checked={fetchAll}
                onCheckedChange={(v) => setFetchAll(v === true)}
                disabled={disabled || busyAction !== null}
              />
              <span>fetch --all</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <Checkbox
                checked={cleanDirectories}
                onCheckedChange={(v) => setCleanDirectories(v === true)}
                disabled={disabled || busyAction !== null}
              />
              <span>clean -d</span>
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
    {dialogs}
    </>
  );
}
