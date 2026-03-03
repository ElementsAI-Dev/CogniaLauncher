'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Archive } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import type { GitArchiveCardProps } from '@/types/git';

export function GitArchiveCard({ loading, onArchive }: GitArchiveCardProps) {
  const { t } = useLocale();
  const [format, setFormat] = useState('zip');
  const [outputPath, setOutputPath] = useState('');
  const [refName, setRefName] = useState('HEAD');
  const [prefix, setPrefix] = useState('');
  const [busy, setBusy] = useState(false);

  const disabled = loading || busy;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Archive className="h-4 w-4" />
          {t('git.archive.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            placeholder={t('git.archive.format')}
            className="h-7 text-xs"
            disabled={disabled}
          />
          <Input
            value={refName}
            onChange={(e) => setRefName(e.target.value)}
            placeholder={t('git.archive.refPlaceholder')}
            className="h-7 text-xs font-mono"
            disabled={disabled}
          />
        </div>
        <Input
          value={outputPath}
          onChange={(e) => setOutputPath(e.target.value)}
          placeholder={t('git.archive.outputPath')}
          className="h-7 text-xs font-mono"
          disabled={disabled}
        />
        <Input
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          placeholder={t('git.archive.prefixPlaceholder')}
          className="h-7 text-xs"
          disabled={disabled}
        />
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={disabled || !format.trim() || !outputPath.trim() || !refName.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              const msg = await onArchive(format.trim(), outputPath.trim(), refName.trim(), prefix.trim() || undefined);
              toast.success(t('git.archive.success'), { description: msg });
            } catch (e) {
              toast.error(String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {t('git.archive.create')}
        </Button>
      </CardContent>
    </Card>
  );
}
