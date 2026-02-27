'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { GitCommit, Loader2 } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import type { GitCommitDialogProps } from '@/types/git';

export function GitCommitDialog({ stagedCount, onCommit, disabled }: GitCommitDialogProps) {
  const { t } = useLocale();
  const [message, setMessage] = useState('');
  const [amend, setAmend] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCommit = async () => {
    if (!message.trim() && !amend) return;
    setLoading(true);
    try {
      await onCommit(message.trim(), amend);
      setMessage('');
      setAmend(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <GitCommit className="h-4 w-4" />
          {t('git.commit.title')}
          {stagedCount > 0 && (
            <Badge variant="secondary">{stagedCount} staged</Badge>
          )}
        </CardTitle>
        <CardDescription className="text-xs">
          {t('git.commit.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Textarea
            placeholder={t('git.commit.messagePlaceholder')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="text-xs font-mono min-h-[80px] resize-none"
            disabled={loading || disabled}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="amend"
                checked={amend}
                onCheckedChange={(checked) => setAmend(checked === true)}
                disabled={loading}
              />
              <Label htmlFor="amend" className="text-xs text-muted-foreground cursor-pointer">
                {t('git.commit.amend')}
              </Label>
            </div>
            <Button
              size="sm"
              onClick={handleCommit}
              disabled={loading || disabled || (stagedCount === 0 && !amend) || (!message.trim() && !amend)}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <GitCommit className="h-3.5 w-3.5 mr-1" />
              )}
              {t('git.actions.commit')}
            </Button>
          </div>
          {stagedCount === 0 && !amend && (
            <p className="text-xs text-muted-foreground">{t('git.commit.noStagedFiles')}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
