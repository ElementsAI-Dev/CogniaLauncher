'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Boxes, Plus, RefreshCw, Trash2, Link2 } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import type { GitSubmodulesCardProps } from '@/types/git';

export function GitSubmodulesCard({
  submodules,
  loading,
  onRefresh,
  onAdd,
  onUpdate,
  onRemove,
  onSync,
}: GitSubmodulesCardProps) {
  const { t } = useLocale();
  const [url, setUrl] = useState('');
  const [subpath, setSubpath] = useState('');
  const [init, setInit] = useState(true);
  const [recursive, setRecursive] = useState(true);
  const [busy, setBusy] = useState(false);

  const disabled = loading || busy;

  const run = async (fn: () => Promise<string>, successMessage: string) => {
    setBusy(true);
    try {
      const msg = await fn();
      toast.success(successMessage, { description: msg });
      await onRefresh?.();
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
          <Boxes className="h-4 w-4" />
          {t('git.submodules.title')}
          <Badge variant="secondary" className="ml-auto">
            {submodules.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {onUpdate && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={disabled}
              onClick={() => run(() => onUpdate(init, recursive), t('git.submodules.updateSuccess'))}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              {t('git.submodules.update')}
            </Button>
          )}
          {onSync && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={disabled}
              onClick={() => run(onSync, t('git.submodules.syncSuccess'))}
            >
              <Link2 className="h-3 w-3 mr-1" />
              {t('git.submodules.sync')}
            </Button>
          )}
          {onRefresh && (
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
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label className="inline-flex items-center gap-2">
            <Checkbox checked={init} onCheckedChange={(v) => setInit(v === true)} />
            <span>--init</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <Checkbox checked={recursive} onCheckedChange={(v) => setRecursive(v === true)} />
            <span>--recursive</span>
          </label>
        </div>

        {submodules.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('git.submodules.noSubmodules')}</p>
        ) : (
          <div className="space-y-2">
            {submodules.map((submodule) => (
              <div key={submodule.path} className="flex items-center gap-2 text-xs group">
                <span className="font-mono truncate">{submodule.path}</span>
                <Badge variant="outline">{submodule.status}</Badge>
                <span className="text-muted-foreground truncate">{submodule.describe}</span>
                <span className="text-muted-foreground font-mono ml-auto shrink-0">{submodule.hash}</span>
                {onRemove && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive"
                    onClick={() => run(() => onRemove(submodule.path), t('git.submodules.removeSuccess'))}
                    title={t('git.submodules.remove')}
                    disabled={disabled}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {onAdd && (
          <div className="space-y-2 pt-1 border-t">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('git.submodules.urlPlaceholder')}
              className="h-7 text-xs font-mono"
              disabled={disabled}
            />
            <div className="flex gap-2">
              <Input
                value={subpath}
                onChange={(e) => setSubpath(e.target.value)}
                placeholder={t('git.submodules.pathPlaceholder')}
                className="h-7 text-xs"
                disabled={disabled}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs shrink-0"
                disabled={disabled || !url.trim() || !subpath.trim()}
                onClick={async () => {
                  await run(() => onAdd(url.trim(), subpath.trim()), t('git.submodules.addSuccess'));
                  setUrl('');
                  setSubpath('');
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                {t('git.submodules.add')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
