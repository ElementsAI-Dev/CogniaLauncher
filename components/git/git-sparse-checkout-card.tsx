'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Filter, Plus, RefreshCw, Slash } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import type { GitSparseCheckoutCardProps } from '@/types/git';

export function GitSparseCheckoutCard({
  isSparseCheckout,
  sparsePatterns,
  loading,
  supportReason,
  onRefresh,
  onInit,
  onSet,
  onAdd,
  onDisable,
}: GitSparseCheckoutCardProps) {
  const { t } = useLocale();
  const [pattern, setPattern] = useState('');
  const [coneMode, setConeMode] = useState(true);
  const [busy, setBusy] = useState(false);

  const blocked = Boolean(supportReason);
  const disabled = blocked || loading || busy;

  const run = async (fn: () => Promise<string>, successMessage?: string) => {
    setBusy(true);
    try {
      const msg = await fn();
      toast.success(successMessage ?? msg, { description: msg });
      await onRefresh();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Filter className="h-4 w-4" />
          {t('git.sparseCheckout.title')}
          <Badge variant={isSparseCheckout ? 'default' : 'outline'} className="ml-auto">
            {isSparseCheckout ? t('git.sparseCheckout.enabled') : t('git.sparseCheckout.disabled')}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {supportReason && (
          <p className="text-xs text-muted-foreground">{supportReason}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled}
            onClick={() => run(() => onInit(coneMode), t('git.sparseCheckout.enabled'))}
          >
            {t('git.sparseCheckout.init')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled || !isSparseCheckout}
            onClick={() => run(onDisable, t('git.sparseCheckout.disableSuccess'))}
          >
            <Slash className="h-3 w-3 mr-1" />
            {t('git.sparseCheckout.disable')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs ml-auto"
            disabled={disabled}
            onClick={() => onRefresh()}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${disabled ? 'animate-spin' : ''}`} />
            {t('git.refresh')}
          </Button>
        </div>

        <label className="inline-flex items-center gap-2 text-xs">
          <Checkbox checked={coneMode} onCheckedChange={(v) => setConeMode(v === true)} />
          <span>{t('git.sparseCheckout.initCone')}</span>
        </label>

        <div className="flex gap-2">
          <Input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder={t('git.sparseCheckout.patternPlaceholder')}
            className="h-7 text-xs font-mono"
            disabled={disabled}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled || !pattern.trim()}
            onClick={() => run(() => onAdd([pattern.trim()]), t('git.sparseCheckout.addSuccess'))}
          >
            <Plus className="h-3 w-3 mr-1" />
            {t('git.sparseCheckout.addPattern')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled || !pattern.trim()}
            onClick={() => run(() => onSet([pattern.trim()]), t('git.sparseCheckout.setSuccess'))}
          >
            {t('git.sparseCheckout.init')}
          </Button>
        </div>

        {sparsePatterns.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('git.sparseCheckout.noPatterns')}</p>
        ) : (
          <div className="space-y-1">
            {sparsePatterns.map((entry) => (
              <code key={entry} className="block text-xs font-mono text-muted-foreground">
                {entry}
              </code>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
