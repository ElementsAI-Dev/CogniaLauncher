'use client';

import { useState, useCallback } from 'react';
import { useCopyToClipboard } from '@/hooks/use-clipboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolPreferences } from '@/hooks/use-tool-preferences';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';
import { ToolValidationMessage } from '@/components/toolbox/tool-layout';
import { Copy, Check, RefreshCw } from 'lucide-react';
import type { ToolComponentProps } from '@/types/toolbox';

function generateUUIDs(count: number, uppercase: boolean, noDashes: boolean): string[] {
  const uuids: string[] = [];
  for (let i = 0; i < count; i++) {
    let uuid = crypto.randomUUID();
    if (noDashes) uuid = uuid.replace(/-/g, '');
    if (uppercase) uuid = uuid.toUpperCase();
    uuids.push(uuid);
  }
  return uuids;
}

const DEFAULT_PREFERENCES = {
  count: 1,
  uppercase: false,
  noDashes: false,
  separator: 'newline',
} as const;

export default function UuidGenerator({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const { preferences, setPreferences } = useToolPreferences('uuid-generator', DEFAULT_PREFERENCES);
  const [error, setError] = useState<string | null>(null);
  const [uuids, setUuids] = useState<string[]>(() => generateUUIDs(1, false, false));
  const { copied, copy } = useCopyToClipboard();

  const count = Number(preferences.count) || 1;
  const uppercase = preferences.uppercase;
  const noDashes = preferences.noDashes;
  const separator = preferences.separator;

  const handleGenerate = useCallback(() => {
    if (count > TOOLBOX_LIMITS.generatorCount) {
      setError(t('toolbox.tools.shared.countTooLarge', { limit: TOOLBOX_LIMITS.generatorCount }));
      return;
    }
    setError(null);
    setUuids(generateUUIDs(Math.max(1, Math.min(TOOLBOX_LIMITS.generatorCount, count)), uppercase, noDashes));
  }, [count, noDashes, t, uppercase]);

  const handleCopy = useCallback(async () => {
    const delimiter = separator === 'comma' ? ', ' : '\n';
    await copy(uuids.join(delimiter));
  }, [copy, separator, uuids]);

  return (
    <div className={className}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="uuid-count">{t('toolbox.tools.uuidGenerator.count')}</Label>
            <Input
              id="uuid-count"
              type="number"
              min={1}
              max={TOOLBOX_LIMITS.generatorCount}
              value={count}
              onChange={(e) => setPreferences({ count: Math.max(1, Number(e.target.value) || 1) })}
              className="w-24"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="uuid-upper" checked={uppercase} onCheckedChange={(checked) => setPreferences({ uppercase: checked })} />
            <Label htmlFor="uuid-upper" className="text-sm">{t('toolbox.tools.uuidGenerator.uppercase')}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="uuid-nodash" checked={noDashes} onCheckedChange={(checked) => setPreferences({ noDashes: checked })} />
            <Label htmlFor="uuid-nodash" className="text-sm">{t('toolbox.tools.uuidGenerator.noDashes')}</Label>
          </div>
          <div className="space-y-2">
            <Label>{t('toolbox.tools.uuidGenerator.separator')}</Label>
            <Select value={separator} onValueChange={(value) => setPreferences({ separator: value })}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newline">{t('toolbox.tools.uuidGenerator.separatorNewline')}</SelectItem>
                <SelectItem value="comma">{t('toolbox.tools.uuidGenerator.separatorComma')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && <ToolValidationMessage message={error} />}

        <div className="flex items-center gap-2">
          <Button onClick={handleGenerate} size="sm" className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            {t('toolbox.tools.uuidGenerator.generate')}
          </Button>
          <Button onClick={handleCopy} variant="outline" size="sm" className="gap-1.5">
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? t('toolbox.actions.copied') : t('toolbox.actions.copy')}
          </Button>
        </div>

        <Textarea
          value={uuids.join(separator === 'comma' ? ', ' : '\n')}
          readOnly
          rows={Math.min(10, Math.max(3, uuids.length))}
          className="font-mono text-sm resize-none bg-muted/50"
        />
      </div>
    </div>
  );
}
