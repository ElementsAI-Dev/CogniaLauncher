'use client';

import { useState, useCallback } from 'react';
import { useCopyToClipboard } from '@/hooks/use-clipboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ToolActionRow, ToolTextArea, ToolValidationMessage } from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolPreferences } from '@/hooks/use-tool-preferences';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';
import { Hash, Copy, Check } from 'lucide-react';
import type { ToolComponentProps } from '@/types/toolbox';

const ALGORITHMS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const;
const DEFAULT_PREFERENCES = {
  sha1: true,
  sha256: true,
  sha384: true,
  sha512: true,
} as const;

async function computeHash(algo: string, text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest(algo, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function HashGenerator({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const { preferences, setPreferences } = useToolPreferences('hash-generator', DEFAULT_PREFERENCES);
  const [input, setInput] = useState('');
  const [results, setResults] = useState<Record<string, string>>({});
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { copy } = useCopyToClipboard();
  const [copiedAlgo, setCopiedAlgo] = useState<string | null>(null);

  const enabledAlgorithms = ALGORITHMS.filter((algo) => {
    if (algo === 'SHA-1') return preferences.sha1;
    if (algo === 'SHA-256') return preferences.sha256;
    if (algo === 'SHA-384') return preferences.sha384;
    return preferences.sha512;
  });

  const handleGenerate = useCallback(async () => {
    if (!input.trim()) {
      setResults({});
      setError(null);
      return;
    }
    if (input.length > TOOLBOX_LIMITS.converterChars) {
      setError(
        t('toolbox.tools.shared.inputTooLarge', {
          limit: TOOLBOX_LIMITS.converterChars.toLocaleString(),
        }),
      );
      setResults({});
      return;
    }
    if (enabledAlgorithms.length === 0) {
      setError(t('toolbox.tools.hashGenerator.selectAtLeastOne'));
      setResults({});
      return;
    }
    setComputing(true);
    setError(null);
    try {
      const entries = await Promise.all(
        enabledAlgorithms.map(async (algo) => [algo, await computeHash(algo, input)] as const),
      );
      setResults(Object.fromEntries(entries));
    } finally {
      setComputing(false);
    }
  }, [enabledAlgorithms, input, t]);

  const handleCopy = useCallback(async (algo: string, value: string) => {
    await copy(value);
    setCopiedAlgo(algo);
    setTimeout(() => setCopiedAlgo(null), 1500);
  }, [copy]);

  const handleCopyAll = useCallback(async () => {
    const text = Object.entries(results)
      .map(([algo, value]) => `${algo}: ${value}`)
      .join('\n');
    await copy(text);
    setCopiedAlgo('all');
    setTimeout(() => setCopiedAlgo(null), 1500);
  }, [copy, results]);

  return (
    <div className={className}>
      <div className="space-y-4">
        <ToolTextArea
          label={t('toolbox.tools.hashGenerator.input')}
          value={input}
          onChange={setInput}
          placeholder={t('toolbox.tools.hashGenerator.placeholder')}
          showPaste
          showClear
          rows={6}
        />

        <ToolActionRow
          rightSlot={
            <div className="flex flex-wrap items-center gap-3">
              {([
                ['SHA-1', preferences.sha1, 'sha1'],
                ['SHA-256', preferences.sha256, 'sha256'],
                ['SHA-384', preferences.sha384, 'sha384'],
                ['SHA-512', preferences.sha512, 'sha512'],
              ] as const).map(([label, value, key]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <Switch checked={value} onCheckedChange={(checked) => setPreferences({ [key]: checked })} />
                  <Label className="text-xs">{label}</Label>
                </div>
              ))}
            </div>
          }
        >
          <Button onClick={handleGenerate} size="sm" disabled={computing || !input.trim()} className="gap-1.5">
            <Hash className="h-3.5 w-3.5" />
            {computing ? t('toolbox.tools.hashGenerator.computing') : t('toolbox.tools.hashGenerator.generate')}
          </Button>
          {Object.keys(results).length > 0 && (
            <Button onClick={handleCopyAll} variant="outline" size="sm" className="gap-1.5">
              {copiedAlgo === 'all' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              {copiedAlgo === 'all' ? t('toolbox.actions.copied') : t('toolbox.tools.hashGenerator.copyAll')}
            </Button>
          )}
        </ToolActionRow>

        {error && <ToolValidationMessage message={error} />}

        {Object.keys(results).length > 0 && (
          <div className="space-y-3">
            {ALGORITHMS.map((algo) => {
              const value = results[algo];
              if (!value) return null;
              return (
                <div key={algo} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">{algo}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs px-2"
                      onClick={() => handleCopy(algo, value)}
                    >
                      {copiedAlgo === algo ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      {copiedAlgo === algo ? t('toolbox.actions.copied') : t('toolbox.actions.copy')}
                    </Button>
                  </div>
                  <code className="block w-full rounded-md bg-muted p-2 text-xs font-mono break-all">
                    {value}
                  </code>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
