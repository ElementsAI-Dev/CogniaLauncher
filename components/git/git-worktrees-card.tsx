'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { GitBranch, Plus, RefreshCw, Trash2, Scissors } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import type { GitWorktreesCardProps } from '@/types/git';

export function GitWorktreesCard({
  worktrees,
  loading,
  onRefresh,
  onAdd,
  onRemove,
  onPrune,
}: GitWorktreesCardProps) {
  const { t } = useLocale();
  const [dest, setDest] = useState('');
  const [branch, setBranch] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);

  const disabled = loading || busy;

  const run = async (fn: () => Promise<string>, successMessage: string) => {
    setBusy(true);
    try {
      const msg = await fn();
      toast.success(successMessage, { description: msg });
      await onRefresh?.();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          {t('git.worktrees.title')}
          <Badge variant="secondary" className="ml-auto">
            {worktrees.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {onPrune && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={disabled}
              onClick={() => run(onPrune, t('git.worktrees.pruneSuccess'))}
            >
              <Scissors className="h-3 w-3 mr-1" />
              {t('git.worktrees.prune')}
            </Button>
          )}
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs ml-auto"
              disabled={disabled}
              onClick={() => onRefresh()}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${disabled ? 'animate-spin' : ''}`} />
              {t('git.refresh')}
            </Button>
          )}
        </div>

        {worktrees.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('git.worktrees.noWorktrees')}</p>
        ) : (
          <div className="space-y-2">
            {worktrees.map((worktree) => (
              <div key={worktree.path} className="flex items-center gap-2 text-xs group">
                <code className="font-mono truncate">{worktree.path}</code>
                {worktree.branch && <Badge variant="outline">{worktree.branch}</Badge>}
                {worktree.isDetached && <Badge variant="outline">{t('git.worktrees.detached')}</Badge>}
                {worktree.isBare && <Badge variant="outline">{t('git.worktrees.bare')}</Badge>}
                <span className="ml-auto font-mono text-muted-foreground shrink-0">{worktree.head}</span>
                {onRemove && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive"
                    onClick={() => run(() => onRemove(worktree.path, force), t('git.worktrees.removeSuccess'))}
                    title={t('git.worktrees.remove')}
                    disabled={disabled}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {onAdd && (
          <div className="space-y-2 pt-1 border-t">
            <Input
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              placeholder={t('git.worktrees.destination')}
              className="h-7 text-xs font-mono"
              disabled={disabled}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder={t('git.worktrees.branch')}
                className="h-7 text-xs"
                disabled={disabled}
              />
              <Input
                value={newBranch}
                onChange={(e) => setNewBranch(e.target.value)}
                placeholder={t('git.worktrees.newBranch')}
                className="h-7 text-xs"
                disabled={disabled}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={force} onCheckedChange={(v) => setForce(v === true)} />
                <span>remove --force</span>
              </label>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs ml-auto"
                disabled={disabled || !dest.trim()}
                onClick={async () => {
                  await run(
                    () => onAdd(dest.trim(), branch.trim() ? branch.trim() : undefined, newBranch.trim() ? newBranch.trim() : undefined),
                    t('git.worktrees.addSuccess'),
                  );
                  setDest('');
                  setBranch('');
                  setNewBranch('');
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                {t('git.worktrees.add')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
