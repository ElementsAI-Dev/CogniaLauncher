'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useLocale } from '@/components/providers/locale-provider';
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

export default function UuidGenerator({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const [count, setCount] = useState(1);
  const [uppercase, setUppercase] = useState(false);
  const [noDashes, setNoDashes] = useState(false);
  const [uuids, setUuids] = useState<string[]>(() => generateUUIDs(1, false, false));
  const [copied, setCopied] = useState(false);

  const handleGenerate = useCallback(() => {
    setUuids(generateUUIDs(Math.max(1, Math.min(100, count)), uppercase, noDashes));
    setCopied(false);
  }, [count, uppercase, noDashes]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(uuids.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [uuids]);

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
              max={100}
              value={count}
              onChange={(e) => setCount(Number(e.target.value) || 1)}
              className="w-24"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="uuid-upper" checked={uppercase} onCheckedChange={setUppercase} />
            <Label htmlFor="uuid-upper" className="text-sm">{t('toolbox.tools.uuidGenerator.uppercase')}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="uuid-nodash" checked={noDashes} onCheckedChange={setNoDashes} />
            <Label htmlFor="uuid-nodash" className="text-sm">{t('toolbox.tools.uuidGenerator.noDashes')}</Label>
          </div>
        </div>

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
          value={uuids.join('\n')}
          readOnly
          rows={Math.min(10, Math.max(3, uuids.length))}
          className="font-mono text-sm resize-none bg-muted/50"
        />
      </div>
    </div>
  );
}
