'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Settings2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import type { GitLocalConfigCardProps } from '@/types/git';

export function GitLocalConfigCard({
  config,
  loading,
  onRefresh,
  onSet,
  onRemove,
}: GitLocalConfigCardProps) {
  const { t } = useLocale();
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  const disabled = loading || busy;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          {t('git.localConfig.title')}
          <Badge variant="secondary" className="ml-auto">
            {config.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={t('git.config.keyPlaceholder')}
            className="h-7 text-xs font-mono"
            disabled={disabled}
          />
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t('git.config.valuePlaceholder')}
            className="h-7 text-xs font-mono"
            disabled={disabled}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled || !key.trim() || !value.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await onSet(key.trim(), value);
                toast.success(t('git.config.saved'));
                setKey('');
                setValue('');
                await onRefresh();
              } catch (e) {
                toast.error(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Plus className="h-3 w-3 mr-1" />
            {t('git.config.add')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled}
            onClick={() => onRefresh()}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${disabled ? 'animate-spin' : ''}`} />
            {t('git.refresh')}
          </Button>
        </div>

        <div className="space-y-2">
          {config.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('git.config.empty')}</p>
          ) : (
            config.map((entry) => (
              <div key={entry.key} className="flex items-center gap-2 text-xs group">
                <code className="font-mono">{entry.key}</code>
                <span className="text-muted-foreground">=</span>
                <span className="font-mono truncate">{entry.value}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 ml-auto opacity-0 group-hover:opacity-100 text-destructive"
                  disabled={disabled}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onRemove(entry.key);
                      toast.success(t('git.config.removed'));
                      await onRefresh();
                    } catch (e) {
                      toast.error(String(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                  title={t('git.config.remove')}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
