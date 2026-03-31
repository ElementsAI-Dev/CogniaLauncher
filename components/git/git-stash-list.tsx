'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Archive, Play, Trash2, Plus, FileText, Undo2, GitBranch } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import type { GitStashListProps } from '@/types/git';
import { useGitActionDialogs } from './use-git-action-dialogs';

export function GitStashList({
  stashes,
  onApply,
  onPop,
  onDrop,
  onSave,
  onBranchFromStash,
  onPushFiles,
  onShowDiff,
}: GitStashListProps) {
  const { t } = useLocale();
  const [stashMsg, setStashMsg] = useState('');
  const [stashFiles, setStashFiles] = useState('');
  const [includeUntracked, setIncludeUntracked] = useState(false);
  const [saving, setSaving] = useState(false);
  const { prompt, dialogs } = useGitActionDialogs();

  const handleApply = async (id: string) => {
    if (!onApply) return;
    try {
      const msg = await onApply(id);
      toast.success(t('git.stash.applySuccess'), { description: msg });
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleDrop = async (id: string) => {
    if (!onDrop) return;
    try {
      const msg = await onDrop(id);
      toast.success(t('git.stash.dropSuccess'), { description: msg });
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handlePop = async (id: string) => {
    if (!onPop) return;
    try {
      const msg = await onPop(id);
      toast.success(t('git.stash.popSuccess'), { description: msg });
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      const msg = await onSave(stashMsg || undefined, includeUntracked);
      toast.success(t('git.stashAction.saveSuccess'), { description: msg });
      setStashMsg('');
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFiles = async () => {
    if (!onPushFiles) return;
    const files = stashFiles
      .split(',')
      .map((file) => file.trim())
      .filter(Boolean);
    if (files.length === 0) return;
    setSaving(true);
    try {
      const msg = await onPushFiles(files, stashMsg || undefined, includeUntracked);
      toast.success(t('git.stashAction.saveSuccess'), { description: msg });
      setStashMsg('');
      setStashFiles('');
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleBranchFromStash = async (stashId: string) => {
    if (!onBranchFromStash) return;
    const branchName = await prompt({
      title: t('git.stashBranch.title'),
      label: t('git.stashBranch.branchName'),
      placeholder: t('git.branchAction.newBranchName'),
    });
    if (!branchName || !branchName.trim()) return;
    try {
      const msg = await onBranchFromStash(branchName.trim(), stashId);
      toast.success(t('git.stashBranch.success'), { description: msg });
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleShowDiff = async (stashId: string) => {
    if (!onShowDiff) return;
    try {
      await onShowDiff(stashId);
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <>
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Archive className="h-4 w-4" />
          {t('git.repo.stash')}
          <Badge variant="secondary" className="ml-auto">{stashes.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {stashes.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('git.repo.noStashes')}</p>
        ) : (
          <div className="space-y-2">
            {stashes.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-xs group">
                <code className="font-mono text-muted-foreground shrink-0">{s.id}</code>
                <span className="truncate flex-1">{s.message}</span>
                <span className="text-muted-foreground shrink-0">{s.date.split('T')[0]}</span>
                <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {onShowDiff && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => handleShowDiff(s.id)}
                      title={t('git.stashAction.showDiff')}
                    >
                      <FileText className="h-3 w-3" />
                    </Button>
                  )}
                  {onBranchFromStash && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => handleBranchFromStash(s.id)}
                      title={t('git.stashBranch.title')}
                    >
                      <GitBranch className="h-3 w-3" />
                    </Button>
                  )}
                  {onApply && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => handleApply(s.id)}
                      title={t('git.actions.stashApply')}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  )}
                  {onPop && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => handlePop(s.id)}
                      title={t('git.stash.popSuccess')}
                    >
                      <Undo2 className="h-3 w-3" />
                    </Button>
                  )}
                  {onDrop && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-destructive"
                      onClick={() => handleDrop(s.id)}
                      title={t('git.actions.stashDrop')}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {onSave && (
          <div className="space-y-2 pt-1 border-t">
            <div className="flex items-center gap-2">
              <Input
                placeholder={t('git.stashAction.savePlaceholder')}
                value={stashMsg}
                onChange={(e) => setStashMsg(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="flex-1 h-7 text-xs"
                disabled={saving}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleSave}
                disabled={saving}
              >
                <Plus className="h-3 w-3 mr-1" />
                {t('git.stashAction.save')}
              </Button>
              {onPushFiles && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleSaveFiles}
                  disabled={saving}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Stash Files
                </Button>
              )}
            </div>
            {onPushFiles && (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="file1.ts,file2.ts"
                  value={stashFiles}
                  onChange={(e) => setStashFiles(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveFiles()}
                  className="flex-1 h-7 text-xs font-mono"
                  disabled={saving}
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Checkbox
                id="includeUntracked"
                checked={includeUntracked}
                onCheckedChange={(v) => setIncludeUntracked(v === true)}
              />
              <label htmlFor="includeUntracked" className="text-xs text-muted-foreground cursor-pointer">
                {t('git.stashAction.includeUntracked')}
              </label>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    {dialogs}
    </>
  );
}
