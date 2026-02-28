'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToolTextArea } from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { Hash, Copy, Check } from 'lucide-react';
import type { ToolComponentProps } from '@/types/toolbox';

const ALGORITHMS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const;

async function computeHash(algo: string, text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest(algo, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function HashGenerator({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const [input, setInput] = useState('');
  const [results, setResults] = useState<Record<string, string>>({});
  const [computing, setComputing] = useState(false);
  const [copiedAlgo, setCopiedAlgo] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!input.trim()) { setResults({}); return; }
    setComputing(true);
    try {
      const entries = await Promise.all(
        ALGORITHMS.map(async (algo) => [algo, await computeHash(algo, input)] as const),
      );
      setResults(Object.fromEntries(entries));
    } finally {
      setComputing(false);
    }
  }, [input]);

  const handleCopy = useCallback(async (algo: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedAlgo(algo);
    setTimeout(() => setCopiedAlgo(null), 1500);
  }, []);

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

        <Button onClick={handleGenerate} size="sm" disabled={computing || !input.trim()} className="gap-1.5">
          <Hash className="h-3.5 w-3.5" />
          {computing ? t('toolbox.tools.hashGenerator.computing') : t('toolbox.tools.hashGenerator.generate')}
        </Button>

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
