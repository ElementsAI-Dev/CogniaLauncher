'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCopyToClipboard } from '@/hooks/use-clipboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  ToolSection,
  ToolTextArea,
  ToolValidationMessage,
  ToolOptionGroup,
} from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolPreferences } from '@/hooks/use-tool-preferences';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';
import { digestWithSubtle, supportsSubtleDigest } from '@/lib/toolbox/browser-api';
import { Hash, Copy, Check, ShieldCheck, ShieldX } from 'lucide-react';
import type { ToolComponentProps } from '@/types/toolbox';

const ALGORITHMS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const;
type Algorithm = (typeof ALGORITHMS)[number];

const ALGO_KEY_MAP: Record<Algorithm, keyof typeof DEFAULT_PREFERENCES> = {
  'SHA-1': 'sha1',
  'SHA-256': 'sha256',
  'SHA-384': 'sha384',
  'SHA-512': 'sha512',
};

const DEFAULT_PREFERENCES = {
  sha1: true,
  sha256: true,
  sha384: true,
  sha512: true,
} as const;

async function computeHash(algo: string, text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await digestWithSubtle(algo, data);
  if (!hashBuffer) {
    throw new Error('web-crypto-unavailable');
  }
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
  const [compareHash, setCompareHash] = useState('');
  const { copy, error: clipboardError } = useCopyToClipboard();
  const [copiedAlgo, setCopiedAlgo] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enabledAlgorithms = ALGORITHMS.filter((algo) => preferences[ALGO_KEY_MAP[algo]]);

  // Real-time debounced hashing
  useEffect(() => {
    if (!input.trim() || enabledAlgorithms.length === 0) {
      setResults({});
      setError(null);
      setComputing(false);
      return;
    }
    if (!supportsSubtleDigest()) {
      setResults({});
      setError(t('toolbox.tools.hashGenerator.cryptoUnavailable'));
      setComputing(false);
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
    setComputing(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const entries = await Promise.all(
          enabledAlgorithms.map(async (algo) => [algo, await computeHash(algo, input)] as const),
        );
        setResults(Object.fromEntries(entries));
        setError(null);
      } catch (err) {
        const message = err instanceof Error && err.message === 'web-crypto-unavailable'
          ? t('toolbox.tools.hashGenerator.cryptoUnavailable')
          : (err as Error).message;
        setResults({});
        setError(message);
      } finally {
        setComputing(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, enabledAlgorithms.join(',')]);

  const handleCopy = useCallback(
    async (algo: string, value: string) => {
      await copy(value);
      setCopiedAlgo(algo);
      setTimeout(() => setCopiedAlgo(null), 1500);
    },
    [copy],
  );

  const handleCopyAll = useCallback(async () => {
    const text = Object.entries(results)
      .map(([algo, value]) => `${algo}: ${value}`)
      .join('\n');
    await copy(text);
    setCopiedAlgo('all');
    setTimeout(() => setCopiedAlgo(null), 1500);
  }, [copy, results]);

  // Compare logic
  const compareResult = (() => {
    const trimmed = compareHash.trim().toLowerCase();
    if (!trimmed || Object.keys(results).length === 0) return null;
    for (const [algo, hash] of Object.entries(results)) {
      if (hash.toLowerCase() === trimmed) return { match: true, algo };
    }
    return { match: false, algo: null };
  })();

  const hasResults = Object.keys(results).length > 0;

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Input Section */}
        <ToolSection title={t('toolbox.tools.hashGenerator.input')}>
          <ToolTextArea
            label=""
            value={input}
            onChange={setInput}
            placeholder={t('toolbox.tools.hashGenerator.placeholder')}
            showPaste
            showClear
            showCopy={false}
            rows={6}
            maxLength={TOOLBOX_LIMITS.converterChars}
          />
        </ToolSection>

        {/* Options Section */}
        <ToolSection title={t('toolbox.tools.hashGenerator.algorithms')}>
          <ToolOptionGroup>
            {ALGORITHMS.map((algo) => {
              const key = ALGO_KEY_MAP[algo];
              return (
                <div key={algo} className="flex items-center gap-1.5">
                  <Switch
                    checked={preferences[key]}
                    onCheckedChange={(checked) => setPreferences({ [key]: checked })}
                  />
                  <Label className="text-xs">{algo}</Label>
                </div>
              );
            })}
          </ToolOptionGroup>
        </ToolSection>

        {error && <ToolValidationMessage message={error} />}

        {/* Results Section */}
        <ToolSection
          title={t('toolbox.tools.hashGenerator.results')}
          headerRight={
            hasResults ? (
              <Button onClick={handleCopyAll} variant="outline" size="sm" className="gap-1.5">
                {copiedAlgo === 'all' ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copiedAlgo === 'all'
                  ? t('toolbox.actions.copied')
                  : t('toolbox.tools.hashGenerator.copyAll')}
              </Button>
            ) : null
          }
        >
          {computing && !hasResults && (
            <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
              <Hash className="h-4 w-4 animate-spin" />
              <span className="text-sm">{t('toolbox.tools.hashGenerator.computing')}</span>
            </div>
          )}

          {!computing && !hasResults && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t('toolbox.tools.hashGenerator.emptyState')}
            </p>
          )}

          {hasResults && (
            <div className="space-y-2">
              {ALGORITHMS.map((algo) => {
                const value = results[algo];
                if (!value) return null;
                return (
                  <div
                    key={algo}
                    className="flex items-start gap-2 rounded-md border bg-muted/30 p-2"
                  >
                    <Badge variant="secondary" className="mt-0.5 shrink-0 text-xs">
                      {algo}
                    </Badge>
                    <code className="flex-1 text-xs font-mono break-all pt-0.5">{value}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => handleCopy(algo, value)}
                    >
                      {copiedAlgo === algo ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                );
              })}
              {computing && (
                <div className="flex items-center gap-1.5 px-2">
                  <Badge variant="outline" className="text-xs animate-pulse">
                    {t('toolbox.tools.hashGenerator.computing')}
                  </Badge>
                </div>
              )}
            </div>
          )}
        </ToolSection>

        {/* Compare Section */}
        <ToolSection title={t('toolbox.tools.hashGenerator.compare')}>
          <div className="space-y-2">
            <Input
              value={compareHash}
              onChange={(e) => setCompareHash(e.target.value)}
              placeholder={t('toolbox.tools.hashGenerator.comparePlaceholder')}
              className="font-mono text-xs"
            />
            {compareResult && (
              <div className="flex items-center gap-2 text-sm">
                {compareResult.match ? (
                  <>
                    <ShieldCheck className="h-4 w-4 text-green-500" />
                    <span className="text-green-600 dark:text-green-400">
                      {t('toolbox.tools.hashGenerator.matchFound', { algo: compareResult.algo ?? 'unknown' })}
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldX className="h-4 w-4 text-red-500" />
                    <span className="text-red-600 dark:text-red-400">
                      {t('toolbox.tools.hashGenerator.noMatch')}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </ToolSection>
        {clipboardError && <ToolValidationMessage message={t('toolbox.actions.copyFailed')} />}
      </div>
    </div>
  );
}
