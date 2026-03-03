'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import type { GitSignatureVerifyCardProps } from '@/types/git';

export function GitSignatureVerifyCard({
  loading,
  onVerifyCommit,
  onVerifyTag,
}: GitSignatureVerifyCardProps) {
  const { t } = useLocale();
  const [commitHash, setCommitHash] = useState('');
  const [tag, setTag] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  const disabled = loading || busy;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          {t('git.signature.verifyCommit')} / {t('git.signature.verifyTag')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={commitHash}
            onChange={(e) => setCommitHash(e.target.value)}
            placeholder="commit hash"
            className="h-7 text-xs font-mono"
            disabled={disabled}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled || !commitHash.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                const verifyResult = await onVerifyCommit(commitHash.trim());
                setResult(verifyResult);
                toast.success(t('git.signature.verifyCommit'));
              } catch (e) {
                toast.error(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('git.signature.verifyCommit')}
          </Button>
        </div>

        <div className="flex gap-2">
          <Input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="tag"
            className="h-7 text-xs font-mono"
            disabled={disabled}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled || !tag.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                const verifyResult = await onVerifyTag(tag.trim());
                setResult(verifyResult);
                toast.success(t('git.signature.verifyTag'));
              } catch (e) {
                toast.error(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('git.signature.verifyTag')}
          </Button>
        </div>

        {result && (
          <Badge variant="outline" className="max-w-full whitespace-normal break-words">
            {result}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
