'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ToolTextArea } from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import type { ToolComponentProps } from '@/types/toolbox';

export default function RegexTester({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const [pattern, setPattern] = useState('');
  const [testText, setTestText] = useState('');
  const [flagG, setFlagG] = useState(true);
  const [flagI, setFlagI] = useState(false);
  const [flagM, setFlagM] = useState(false);
  const [flagS, setFlagS] = useState(false);

  const flags = `${flagG ? 'g' : ''}${flagI ? 'i' : ''}${flagM ? 'm' : ''}${flagS ? 's' : ''}`;

  const { matches, error } = useMemo(() => {
    if (!pattern || !testText) return { matches: [], error: null };
    try {
      const re = new RegExp(pattern, flags);
      const found: { text: string; index: number; groups: string[] }[] = [];
      let m: RegExpExecArray | null;
      const limit = 100;
      let count = 0;
      while ((m = re.exec(testText)) !== null && count < limit) {
        found.push({
          text: m[0],
          index: m.index,
          groups: m.slice(1),
        });
        count++;
        if (!flagG) break;
      }
      return { matches: found, error: null };
    } catch (e) {
      return { matches: [], error: (e as Error).message };
    }
  }, [pattern, testText, flags, flagG]);

  return (
    <div className={className}>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{t('toolbox.tools.regexTester.pattern')}</Label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-mono">/</span>
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="[a-z]+"
              className="font-mono flex-1"
            />
            <span className="text-muted-foreground font-mono">/{flags}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {([['g', flagG, setFlagG], ['i', flagI, setFlagI], ['m', flagM, setFlagM], ['s', flagS, setFlagS]] as const).map(
            ([flag, value, setter]) => (
              <div key={flag} className="flex items-center gap-1.5">
                <Switch id={`flag-${flag}`} checked={value} onCheckedChange={setter as (v: boolean) => void} />
                <Label htmlFor={`flag-${flag}`} className="text-sm font-mono">{flag}</Label>
              </div>
            ),
          )}
        </div>

        {error && <p className="text-sm text-destructive font-mono">{error}</p>}

        <ToolTextArea
          label={t('toolbox.tools.regexTester.testText')}
          value={testText}
          onChange={setTestText}
          placeholder={t('toolbox.tools.regexTester.testTextPlaceholder')}
          showPaste
          showClear
          rows={6}
        />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>{t('toolbox.tools.regexTester.matches')}</Label>
            <Badge variant="secondary" className="text-xs">{matches.length}</Badge>
          </div>
          {matches.length > 0 ? (
            <div className="rounded-md border p-3 space-y-2 max-h-48 overflow-auto">
              {matches.map((m, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Badge variant="outline" className="shrink-0 text-[10px]">#{i + 1}</Badge>
                  <code className="font-mono break-all">&quot;{m.text}&quot;</code>
                  <span className="text-muted-foreground shrink-0">@{m.index}</span>
                  {m.groups.length > 0 && (
                    <span className="text-muted-foreground">
                      groups: [{m.groups.map((g, j) => <code key={j} className="mx-0.5">&quot;{g}&quot;</code>)}]
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            pattern && testText && !error && (
              <p className="text-sm text-muted-foreground">{t('toolbox.tools.regexTester.noMatches')}</p>
            )
          )}
        </div>
      </div>
    </div>
  );
}
