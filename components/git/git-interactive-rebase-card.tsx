'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { GitPullRequest } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import type { GitInteractiveRebaseCardProps } from '@/types/git';
import type { GitRebaseTodoItem } from '@/types/tauri';

export function GitInteractiveRebaseCard({
  loading,
  supportReason,
  onPreview,
  onStart,
}: GitInteractiveRebaseCardProps) {
  const { t } = useLocale();
  const [base, setBase] = useState('');
  const [todo, setTodo] = useState<GitRebaseTodoItem[]>([]);
  const [busy, setBusy] = useState(false);

  const blocked = Boolean(supportReason);
  const disabled = blocked || loading || busy;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <GitPullRequest className="h-4 w-4" />
          {t('git.interactiveRebase.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t('git.interactiveRebase.description')}</p>
        {supportReason && (
          <p className="text-xs text-muted-foreground">{supportReason}</p>
        )}
        <div className="flex gap-2">
          <Input
            value={base}
            onChange={(e) => setBase(e.target.value)}
            placeholder={t('git.interactiveRebase.basePlaceholder')}
            className="h-7 text-xs font-mono"
            disabled={disabled}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled || !base.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                const preview = await onPreview(base.trim());
                setTodo(preview);
              } catch (e) {
                toast.error(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('git.interactiveRebase.preview')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled || !base.trim() || todo.length === 0}
            onClick={async () => {
              setBusy(true);
              try {
                const msg = await onStart(base.trim(), todo);
                toast.success(t('git.interactiveRebase.success'), { description: msg });
              } catch (e) {
                toast.error(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('git.interactiveRebase.execute')}
          </Button>
        </div>

        {todo.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('git.interactiveRebase.noCommits')}</p>
        ) : (
          <div className="space-y-2">
            <Badge variant="secondary">{todo.length}</Badge>
            {todo.map((item, index) => (
              <div key={`${item.hash}-${index}`} className="flex items-center gap-2 text-xs">
                <select
                  value={item.action}
                  className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                  onChange={(e) => {
                    const next = [...todo];
                    next[index] = {
                      ...item,
                      action: e.target.value as GitRebaseTodoItem['action'],
                    };
                    setTodo(next);
                  }}
                  disabled={disabled}
                >
                  <option value="pick">{t('git.interactiveRebase.actions.pick')}</option>
                  <option value="reword">{t('git.interactiveRebase.actions.reword')}</option>
                  <option value="edit">{t('git.interactiveRebase.actions.edit')}</option>
                  <option value="squash">{t('git.interactiveRebase.actions.squash')}</option>
                  <option value="fixup">{t('git.interactiveRebase.actions.fixup')}</option>
                  <option value="drop">{t('git.interactiveRebase.actions.drop')}</option>
                </select>
                <code className="font-mono shrink-0">{item.hash.slice(0, 8)}</code>
                <span className="truncate">{item.message}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
