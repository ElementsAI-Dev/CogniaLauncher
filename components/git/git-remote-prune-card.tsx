'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Scissors } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import type { GitRemotePruneCardProps } from '@/types/git';

export function GitRemotePruneCard({ remotes, loading, onPrune }: GitRemotePruneCardProps) {
  const { t } = useLocale();
  const firstRemote = useMemo(() => remotes[0]?.name ?? '', [remotes]);
  const [remote, setRemote] = useState(firstRemote);
  const [busy, setBusy] = useState(false);

  const disabled = loading || busy;

  useEffect(() => {
    if (!remote.trim()) {
      setRemote(firstRemote);
      return;
    }
    const exists = remotes.some((item) => item.name === remote.trim());
    if (!exists) {
      setRemote(firstRemote);
    }
  }, [firstRemote, remotes, remote]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Scissors className="h-4 w-4" />
          {t('git.remotePrune.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          value={remote}
          onChange={(e) => setRemote(e.target.value)}
          className="h-7 text-xs font-mono"
          placeholder="origin"
          list="remote-prune-options"
          disabled={disabled}
        />
        <datalist id="remote-prune-options">
          {remotes.map((item) => (
            <option key={item.name} value={item.name} />
          ))}
        </datalist>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={disabled || !remote.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              const msg = await onPrune(remote.trim());
              toast.success(t('git.remotePrune.success'), { description: msg });
            } catch (e) {
              toast.error(String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {t('git.remotePrune.title')}
        </Button>
      </CardContent>
    </Card>
  );
}
