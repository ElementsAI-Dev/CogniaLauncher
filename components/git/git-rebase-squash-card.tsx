'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GitCommitHorizontal } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import type { GitRebaseSquashCardProps } from '@/types/git';

export function GitRebaseSquashCard({
  loading,
  supportReason,
  onRebase,
  onSquash,
}: GitRebaseSquashCardProps) {
  const { t } = useLocale();
  const [onto, setOnto] = useState('');
  const [countText, setCountText] = useState('2');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const blocked = Boolean(supportReason);
  const disabled = blocked || loading || busy;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <GitCommitHorizontal className="h-4 w-4" />
          {t('git.quickOps.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t('git.quickOps.description')}</p>
        {supportReason && (
          <p className="text-xs text-muted-foreground">{supportReason}</p>
        )}

        <div className="space-y-2">
          <Input
            value={onto}
            onChange={(e) => setOnto(e.target.value)}
            placeholder={t('git.interactiveRebase.basePlaceholder')}
            className="h-7 text-xs font-mono"
            disabled={disabled}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled || !onto.trim()}
            onClick={async () => {
              const confirmed = window.confirm(t('git.quickOps.rewriteConfirm'));
              if (!confirmed) return;
              setBusy(true);
              try {
                const result = await onRebase(onto.trim(), true);
                toast.success(t('git.quickOps.rebaseSuccess'), { description: result });
              } catch (e) {
                toast.error(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('git.quickOps.rebase')}
          </Button>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              value={countText}
              onChange={(e) => setCountText(e.target.value)}
              placeholder={t('git.quickOps.countPlaceholder')}
              className="h-7 text-xs font-mono"
              disabled={disabled}
              inputMode="numeric"
            />
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('git.commit.messagePlaceholder')}
              className="h-7 text-xs"
              disabled={disabled}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled || !countText.trim() || !message.trim()}
            onClick={async () => {
              const count = Number.parseInt(countText, 10);
              if (!Number.isFinite(count) || count < 2) {
                toast.error(t('git.quickOps.squashCountInvalid'));
                return;
              }
              const confirmed = window.confirm(t('git.quickOps.rewriteConfirm'));
              if (!confirmed) return;
              setBusy(true);
              try {
                const result = await onSquash(count, message.trim(), true);
                toast.success(t('git.quickOps.squashSuccess'), { description: result });
              } catch (e) {
                toast.error(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('git.quickOps.squash')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
