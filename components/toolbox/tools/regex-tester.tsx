'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  ToolSection,
  ToolTextArea,
  ToolValidationMessage,
  ToolOptionGroup,
  ToolOutputBlock,
} from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';
import { useToolPreferences } from '@/hooks/use-tool-preferences';
import type { ToolComponentProps } from '@/types/toolbox';

const DEFAULT_PREFERENCES = {
  flagG: true,
  flagI: false,
  flagM: false,
  flagS: false,
  replaceMode: false,
} as const;

const QUICK_PATTERNS = [
  { key: 'email', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
  { key: 'url', pattern: 'https?://[^\\s]+' },
  { key: 'ipv4', pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b' },
  { key: 'number', pattern: '-?\\d+(?:\\.\\d+)?' },
  { key: 'hex', pattern: '#?[0-9a-fA-F]{6}\\b' },
] as const;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderHighlightedHtml(text: string, re: RegExp): string {
  if (!text) return '';
  let lastIndex = 0;
  const chunks: string[] = [];
  let m: RegExpExecArray | null;
  let guard = 0;

  while ((m = re.exec(text)) !== null && guard < TOOLBOX_LIMITS.regexMatches) {
    const start = m.index;
    const matchText = m[0] ?? '';
    const end = start + matchText.length;

    chunks.push(escapeHtml(text.slice(lastIndex, start)));
    chunks.push(`<mark class="rounded bg-amber-200/80 px-0.5 dark:bg-amber-700/50">${escapeHtml(matchText)}</mark>`);

    lastIndex = end;
    guard += 1;
    if (matchText.length === 0) re.lastIndex += 1;
    if (!re.global) break;
  }

  chunks.push(escapeHtml(text.slice(lastIndex)));
  return chunks.join('');
}

export default function RegexTester({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const { preferences, setPreferences } = useToolPreferences('regex-tester', DEFAULT_PREFERENCES);
  const [pattern, setPattern] = useState('');
  const [testText, setTestText] = useState('');
  const [replacement, setReplacement] = useState('');

  const flags = `${preferences.flagG ? 'g' : ''}${preferences.flagI ? 'i' : ''}${preferences.flagM ? 'm' : ''}${preferences.flagS ? 's' : ''}`;

  const { matches, error, truncated, highlightedHtml, replacedText } = useMemo(() => {
    if (!pattern || !testText) {
      return {
        matches: [],
        error: null,
        truncated: false,
        highlightedHtml: '',
        replacedText: '',
      };
    }
    if (pattern.length + testText.length > TOOLBOX_LIMITS.regexChars) {
      return {
        matches: [],
        error: t('toolbox.tools.shared.inputTooLarge', { limit: TOOLBOX_LIMITS.regexChars.toLocaleString() }),
        truncated: false,
        highlightedHtml: '',
        replacedText: '',
      };
    }
    try {
      const re = new RegExp(pattern, flags);
      const found: { text: string; index: number; groups: string[] }[] = [];
      let m: RegExpExecArray | null;
      const limit = TOOLBOX_LIMITS.regexMatches;
      let count = 0;
      while ((m = re.exec(testText)) !== null && count < limit) {
        found.push({
          text: m[0],
          index: m.index,
          groups: m.slice(1),
        });
        count++;
        if (!preferences.flagG) break;
      }

      const highlightRe = new RegExp(pattern, flags.includes('g') ? flags : `${flags}g`);
      const replaced = preferences.replaceMode ? testText.replace(re, replacement) : '';

      return {
        matches: found,
        error: null,
        truncated: count >= limit,
        highlightedHtml: renderHighlightedHtml(testText, highlightRe),
        replacedText: replaced,
      };
    } catch (e) {
      return {
        matches: [],
        error: (e as Error).message,
        truncated: false,
        highlightedHtml: '',
        replacedText: '',
      };
    }
  }, [flags, pattern, preferences.flagG, preferences.replaceMode, replacement, t, testText]);

  return (
    <div className={className}>
      <div className="space-y-4">
        <ToolSection title={t('toolbox.tools.regexTester.pattern')}>
          <div className="space-y-3">
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

            <ToolOptionGroup>
              {([['g', preferences.flagG], ['i', preferences.flagI], ['m', preferences.flagM], ['s', preferences.flagS]] as const).map(
                ([flag, value]) => (
                  <div key={flag} className="flex items-center gap-1.5">
                    <Switch
                      id={`flag-${flag}`}
                      checked={value}
                      onCheckedChange={(checked) => {
                        const key = (`flag${flag.toUpperCase()}` as keyof typeof DEFAULT_PREFERENCES);
                        setPreferences({ [key]: checked });
                      }}
                    />
                    <Label htmlFor={`flag-${flag}`} className="text-sm font-mono">{flag}</Label>
                  </div>
                ),
              )}
              <div className="flex items-center gap-1.5">
                <Switch
                  id="regex-replace-mode"
                  checked={preferences.replaceMode}
                  onCheckedChange={(checked) => setPreferences({ replaceMode: checked })}
                />
                <Label htmlFor="regex-replace-mode" className="text-sm">
                  {t('toolbox.tools.regexTester.replaceMode')}
                </Label>
              </div>
            </ToolOptionGroup>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_PATTERNS.map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setPattern(item.pattern)}
                >
                  {t(`toolbox.tools.regexTester.quick.${item.key}`)}
                </Button>
              ))}
            </div>

            {preferences.replaceMode && (
              <div className="space-y-1.5">
                <Label className="text-sm">{t('toolbox.tools.regexTester.replacement')}</Label>
                <Input
                  value={replacement}
                  onChange={(e) => setReplacement(e.target.value)}
                  placeholder="$1"
                  className="font-mono"
                />
              </div>
            )}
          </div>
        </ToolSection>

        {error && <ToolValidationMessage message={error} />}

        <ToolSection title={t('toolbox.tools.regexTester.testText')}>
          <ToolTextArea
            label={t('toolbox.tools.regexTester.testText')}
            value={testText}
            onChange={setTestText}
            placeholder={t('toolbox.tools.regexTester.testTextPlaceholder')}
            showPaste
            showClear
            rows={8}
            maxLength={TOOLBOX_LIMITS.regexChars}
          />
        </ToolSection>

        <ToolSection title={t('toolbox.tools.regexTester.matches')}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{matches.length}</Badge>
              {truncated && <Badge variant="outline" className="text-xs">{t('toolbox.tools.regexTester.truncated')}</Badge>}
            </div>

            <div className="rounded-md border p-3">
              <Label className="text-xs text-muted-foreground">{t('toolbox.tools.regexTester.highlighted')}</Label>
              <pre
                className="mt-1 whitespace-pre-wrap wrap-break-word font-mono text-xs leading-5"
                dangerouslySetInnerHTML={{ __html: highlightedHtml || escapeHtml(testText || '') }}
              />
            </div>

            {preferences.replaceMode && (
              <ToolOutputBlock
                label={t('toolbox.tools.regexTester.replacedOutput')}
                value={replacedText}
              />
            )}

            {matches.length > 0 ? (
              <div className="rounded-md border p-3 space-y-2 max-h-60 overflow-auto">
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
        </ToolSection>
      </div>
    </div>
  );
}
