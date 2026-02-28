'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  GitBranch,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Trash2,
  LogIn,
} from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import type { GitBranchCardProps } from '@/types/git';

export function GitBranchCard({
  branches,
  aheadBehind,
  onCheckout,
  onCreate,
  onDelete,
}: GitBranchCardProps) {
  const { t } = useLocale();
  const [newBranch, setNewBranch] = useState('');
  const [creating, setCreating] = useState(false);
  const localBranches = branches.filter((b) => !b.isRemote);
  const remoteBranches = branches.filter((b) => b.isRemote);

  const handleCheckout = async (name: string) => {
    if (!onCheckout) return;
    try {
      const msg = await onCheckout(name);
      toast.success(t('git.branch.checkoutSuccess'), { description: msg });
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleCreate = async () => {
    if (!onCreate || !newBranch.trim()) return;
    setCreating(true);
    try {
      const msg = await onCreate(newBranch.trim());
      toast.success(t('git.branch.createSuccess'), { description: msg });
      setNewBranch('');
    } catch (e) {
      toast.error(String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!onDelete) return;
    try {
      const msg = await onDelete(name);
      toast.success(t('git.branch.deleteSuccess'), { description: msg });
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          {t('git.repo.branch')}
          {aheadBehind && (aheadBehind.ahead > 0 || aheadBehind.behind > 0) && (
            <span className="flex items-center gap-1 text-[10px] font-normal">
              {aheadBehind.ahead > 0 && (
                <Badge variant="outline" className="h-4 px-1 text-[10px] text-green-600 border-green-600">
                  <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
                  {aheadBehind.ahead}
                </Badge>
              )}
              {aheadBehind.behind > 0 && (
                <Badge variant="outline" className="h-4 px-1 text-[10px] text-orange-600 border-orange-600">
                  <ArrowDownLeft className="h-2.5 w-2.5 mr-0.5" />
                  {aheadBehind.behind}
                </Badge>
              )}
            </span>
          )}
          <Badge variant="secondary" className="ml-auto">{branches.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {branches.length === 0 ? (
          <p className="text-xs text-muted-foreground">No branches</p>
        ) : (
          <div className="space-y-3">
            {localBranches.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  {t('git.repo.localBranches')} ({localBranches.length})
                </p>
                <div className="space-y-1">
                  {localBranches.map((b) => (
                    <div key={b.name} className="flex items-center gap-2 text-xs group">
                      {b.isCurrent ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                      ) : (
                        onCheckout && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleCheckout(b.name)}
                            title={t('git.branchAction.checkout')}
                          >
                            <LogIn className="h-3 w-3" />
                          </Button>
                        )
                      )}
                      <span className={`font-mono truncate ${b.isCurrent ? 'font-semibold' : ''}`}>
                        {b.name}
                      </span>
                      {b.isCurrent && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1 text-green-600 border-green-600">
                          {t('git.repo.currentBranch')}
                        </Badge>
                      )}
                      {b.upstream && (
                        <span className="text-muted-foreground truncate">→ {b.upstream}</span>
                      )}
                      <span className="text-muted-foreground ml-auto font-mono shrink-0">{b.shortHash}</span>
                      {!b.isCurrent && onDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                          onClick={() => handleDelete(b.name)}
                          title={t('git.branchAction.delete')}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {remoteBranches.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  {t('git.repo.remoteBranches')} ({remoteBranches.length})
                </p>
                <div className="space-y-1">
                  {remoteBranches.map((b) => (
                    <div key={b.name} className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-muted-foreground truncate">{b.name}</span>
                      <span className="text-muted-foreground ml-auto font-mono shrink-0">{b.shortHash}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {onCreate && (
          <div className="flex items-center gap-2 pt-1 border-t">
            <Input
              placeholder={t('git.branchAction.newBranchName')}
              value={newBranch}
              onChange={(e) => setNewBranch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="flex-1 h-7 text-xs"
              disabled={creating}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleCreate}
              disabled={creating || !newBranch.trim()}
            >
              <Plus className="h-3 w-3 mr-1" />
              {t('git.branchAction.create')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
