'use client';

import { useState, useCallback } from 'react';
import { useCopyToClipboard } from '@/hooks/use-clipboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolPreferences } from '@/hooks/use-tool-preferences';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';
import {
  ToolTextArea,
  ToolSection,
  ToolOptionGroup,
  ToolValidationMessage,
} from '@/components/toolbox/tool-layout';
import { Copy, Check, RefreshCw, Sparkles } from 'lucide-react';
import { generateRandomUuid } from '@/lib/toolbox/browser-api';
import type { ToolComponentProps } from '@/types/toolbox';

function formatUuid(raw: string, uppercase: boolean, noDashes: boolean): string {
  let uuid = raw;
  if (noDashes) uuid = uuid.replace(/-/g, '');
  if (uppercase) uuid = uuid.toUpperCase();
  return uuid;
}

function generateUUIDs(count: number, uppercase: boolean, noDashes: boolean): string[] {
  const uuids: string[] = [];
  for (let i = 0; i < count; i++) {
    const uuid = generateRandomUuid();
    if (!uuid) return [];
    uuids.push(formatUuid(uuid, uppercase, noDashes));
  }
  return uuids;
}

const DEFAULT_PREFERENCES = {
  count: 5,
  uppercase: false,
  noDashes: false,
  separator: 'newline',
} as const;

export default function UuidGenerator({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const { preferences, setPreferences } = useToolPreferences('uuid-generator', DEFAULT_PREFERENCES);
  const [error, setError] = useState<string | null>(null);
  const [singleUuid, setSingleUuid] = useState(() => formatUuid(generateRandomUuid() ?? '', false, false));
  const [batchUuids, setBatchUuids] = useState<string[]>([]);
  const { copied, copy, error: clipboardError } = useCopyToClipboard();
  const [singleCopied, setSingleCopied] = useState(false);

  const count = Number(preferences.count) || 5;
  const uppercase = preferences.uppercase;
  const noDashes = preferences.noDashes;
  const separator = preferences.separator;

  const handleCopySingle = useCallback(async (uuid: string) => {
    await copy(uuid);
    setSingleCopied(true);
    setTimeout(() => setSingleCopied(false), 1500);
  }, [copy]);

  const handleRegenerate = useCallback(() => {
    const uuid = generateRandomUuid();
    if (!uuid) {
      setError(t('toolbox.tools.shared.webCryptoUnavailable'));
      return;
    }
    setError(null);
    setSingleUuid(formatUuid(uuid, uppercase, noDashes));
  }, [t, uppercase, noDashes]);

  const handleGenerateAndCopy = useCallback(async () => {
    const rawUuid = generateRandomUuid();
    if (!rawUuid) {
      setError(t('toolbox.tools.shared.webCryptoUnavailable'));
      return;
    }
    const uuid = formatUuid(rawUuid, uppercase, noDashes);
    setSingleUuid(uuid);
    await copy(uuid);
    setSingleCopied(true);
    setTimeout(() => setSingleCopied(false), 1500);
  }, [copy, t, uppercase, noDashes]);

  const handleBatchGenerate = useCallback(() => {
    if (count > TOOLBOX_LIMITS.generatorCount) {
      setError(t('toolbox.tools.shared.countTooLarge', { limit: TOOLBOX_LIMITS.generatorCount }));
      return;
    }
    const nextBatch = generateUUIDs(
      Math.max(1, Math.min(TOOLBOX_LIMITS.generatorCount, count)),
      uppercase,
      noDashes,
    );
    if (nextBatch.length === 0) {
      setError(t('toolbox.tools.shared.webCryptoUnavailable'));
      return;
    }
    setError(null);
    setBatchUuids(nextBatch);
  }, [count, uppercase, noDashes, t]);

  const batchDelimiter = separator === 'comma' ? ', ' : '\n';
  const batchOutput = batchUuids.join(batchDelimiter);

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Quick Generate */}
        <ToolSection
          title={t('toolbox.tools.uuidGenerator.name')}
          description={t('toolbox.tools.uuidGenerator.desc')}
        >
          <div className="space-y-3">
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleCopySingle(singleUuid)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCopySingle(singleUuid); }}
              className="rounded-lg bg-muted p-4 text-center cursor-pointer transition-colors hover:bg-muted/80 active:bg-muted/60"
            >
              <p className="text-lg md:text-xl font-mono tracking-wider select-all break-all">
                {singleUuid}
              </p>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              {t('toolbox.tools.uuidGenerator.runtimeInfo')}
              {singleCopied && (
                <span className="ml-2 text-green-500 inline-flex items-center gap-0.5">
                  <Check className="h-3 w-3" /> {t('toolbox.actions.copied')}
                </span>
              )}
            </p>

            <div className="flex items-center justify-center gap-2">
              <Button onClick={handleGenerateAndCopy} size="sm" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                {t('toolbox.tools.uuidGenerator.generate')} &amp; {t('toolbox.actions.copy')}
              </Button>
              <Button onClick={handleRegenerate} variant="outline" size="icon" className="h-8 w-8">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </ToolSection>

        {/* Batch Generate */}
        <ToolSection title={t('toolbox.tools.uuidGenerator.generate')}>
          <div className="space-y-4">
            <ToolOptionGroup>
              <div className="space-y-1">
                <Label htmlFor="uuid-count" className="text-xs">{t('toolbox.tools.uuidGenerator.count')}</Label>
                <Input
                  id="uuid-count"
                  type="number"
                  min={1}
                  max={TOOLBOX_LIMITS.generatorCount}
                  value={count}
                  onChange={(e) => setPreferences({ count: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-24 h-8"
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
              <div className="space-y-1">
                <Label className="text-xs">{t('toolbox.tools.uuidGenerator.separator')}</Label>
                <Select value={separator} onValueChange={(value) => setPreferences({ separator: value })}>
                  <SelectTrigger className="w-32 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newline">{t('toolbox.tools.uuidGenerator.separatorNewline')}</SelectItem>
                    <SelectItem value="comma">{t('toolbox.tools.uuidGenerator.separatorComma')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </ToolOptionGroup>

            {error && <ToolValidationMessage message={error} />}

            <div className="flex items-center gap-2">
              <Button onClick={handleBatchGenerate} size="sm" className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                {t('toolbox.tools.uuidGenerator.generate')}
              </Button>
              {batchUuids.length > 0 && (
                <Button
                  onClick={() => copy(batchOutput)}
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? t('toolbox.actions.copied') : t('toolbox.actions.copy')}
                </Button>
              )}
            </div>

            {batchUuids.length > 0 && (
              <ToolTextArea
                label={t('toolbox.tools.uuidGenerator.batchOutput', { count: batchUuids.length })}
                value={batchOutput}
                readOnly
                rows={Math.min(count, 10) + 2}
                showCopy
              />
            )}
            {clipboardError && <ToolValidationMessage message={t('toolbox.actions.copyFailed')} />}
          </div>
        </ToolSection>
      </div>
    </div>
  );
}
