'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RefreshCw, Save, Zap } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import type { GitHooksCardProps } from '@/types/git';

export function GitHooksCard({
  hooks,
  loading,
  onRefresh,
  onGetContent,
  onSetContent,
  onToggle,
}: GitHooksCardProps) {
  const { t } = useLocale();
  const [selectedHook, setSelectedHook] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  const disabled = loading || busy;

  const loadHookContent = async (name: string) => {
    setBusy(true);
    try {
      const next = await onGetContent(name);
      setSelectedHook(name);
      setContent(next);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (selectedHook && !hooks.some((hook) => hook.name === selectedHook)) {
      setSelectedHook(null);
      setContent('');
    }
  }, [hooks, selectedHook]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4" />
          {t('git.hooks.title')}
          <Badge variant="secondary" className="ml-auto">
            {hooks.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
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

        {hooks.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('git.hooks.noHooks')}</p>
        ) : (
          <div className="space-y-2">
            {hooks.map((hook) => (
              <div key={hook.name} className="flex items-center gap-2 text-xs">
                <Button
                  variant={selectedHook === hook.name ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => loadHookContent(hook.name)}
                  disabled={disabled}
                >
                  {hook.name}
                </Button>
                <label className="inline-flex items-center gap-2">
                  <Checkbox
                    checked={hook.enabled}
                    onCheckedChange={async (v) => {
                      setBusy(true);
                      try {
                        await onToggle(hook.name, v === true);
                        toast.success(v === true ? t('git.hooks.enable') : t('git.hooks.disable'));
                        await onRefresh?.();
                      } catch (e) {
                        toast.error(String(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                  <span>{hook.enabled ? t('git.hooks.enable') : t('git.hooks.disable')}</span>
                </label>
                <Badge variant="outline">{hook.hasContent ? t('git.hooks.hasContent') : t('git.hooks.empty')}</Badge>
              </div>
            ))}
          </div>
        )}

        {selectedHook && (
          <div className="space-y-2 pt-1 border-t">
            <p className="text-xs text-muted-foreground font-mono">{selectedHook}</p>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[160px] text-xs font-mono"
              disabled={disabled}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={disabled}
              onClick={async () => {
                setBusy(true);
                try {
                  await onSetContent(selectedHook, content);
                  toast.success(t('git.hooks.saved'));
                  await onRefresh?.();
                } catch (e) {
                  toast.error(String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Save className="h-3 w-3 mr-1" />
              {t('git.hooks.save')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
