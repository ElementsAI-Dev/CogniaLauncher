'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Ban, Plus, RefreshCw, Save, Search } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import type { GitGitignoreCardProps } from '@/types/git';

export function GitGitignoreCard({
  loading,
  onGetGitignore,
  onSetGitignore,
  onCheckIgnore,
  onAddToGitignore,
}: GitGitignoreCardProps) {
  const { t } = useLocale();
  const [content, setContent] = useState('');
  const [pattern, setPattern] = useState('');
  const [checkFile, setCheckFile] = useState('');
  const [ignored, setIgnored] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const disabled = loading || busy;

  const refresh = async () => {
    setBusy(true);
    try {
      const next = await onGetGitignore();
      setContent(next);
      setIgnored(null);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Ban className="h-4 w-4" />
          {t('git.gitignore.title')}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs ml-auto"
            disabled={disabled}
            onClick={() => refresh()}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${disabled ? 'animate-spin' : ''}`} />
            {t('git.refresh')}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[180px] text-xs font-mono"
          placeholder={t('git.gitignore.empty')}
          disabled={disabled}
        />

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled}
            onClick={async () => {
              setBusy(true);
              try {
                await onSetGitignore(content);
                toast.success(t('git.gitignore.saved'));
              } catch (e) {
                toast.error(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Save className="h-3 w-3 mr-1" />
            {t('git.gitignore.save')}
          </Button>
        </div>

        <div className="flex items-center gap-2 pt-1 border-t">
          <Input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder={t('git.gitignore.addPattern')}
            className="h-7 text-xs"
            disabled={disabled}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled || !pattern.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await onAddToGitignore([pattern.trim()]);
                toast.success(t('git.gitignore.saved'));
                setPattern('');
                await refresh();
              } catch (e) {
                toast.error(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Plus className="h-3 w-3 mr-1" />
            {t('git.gitignore.addPattern')}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={checkFile}
            onChange={(e) => setCheckFile(e.target.value)}
            placeholder={t('git.gitignore.checkPlaceholder')}
            className="h-7 text-xs"
            disabled={disabled}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled || !checkFile.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                const ignoredFiles = await onCheckIgnore([checkFile.trim()]);
                setIgnored(ignoredFiles.length > 0);
              } catch (e) {
                toast.error(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Search className="h-3 w-3 mr-1" />
            {t('git.gitignore.checkFile')}
          </Button>
          {ignored !== null && (
            <Badge variant={ignored ? 'default' : 'outline'}>
              {ignored ? t('git.gitignore.ignored') : t('git.gitignore.notIgnored')}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
