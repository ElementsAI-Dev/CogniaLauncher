'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Archive, Play, Trash2, Plus, FileText } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import type { GitStashListProps } from '@/types/git';

export function GitStashList({
  stashes,
  onApply,
  onDrop,
  onSave,
  onShowDiff,
}: GitStashListProps) {
  const { t } = useLocale();
  const [stashMsg, setStashMsg] = useState('');
  const [includeUntracked, setIncludeUntracked] = useState(false);
  const [saving, setSaving] = useState(false);

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

  return (
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
                      onClick={() => onShowDiff(s.id)}
                      title={t('git.stashAction.showDiff')}
                    >
                      <FileText className="h-3 w-3" />
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
            </div>
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
  );
}
