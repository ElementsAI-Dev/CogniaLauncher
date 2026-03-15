'use client';

import { useState, useMemo, useCallback } from 'react';
import { useCopyToClipboard } from '@/hooks/use-clipboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolPreferences } from '@/hooks/use-tool-preferences';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';
import {
  ToolValidationMessage,
  ToolSection,
  ToolOptionGroup,
} from '@/components/toolbox/tool-layout';
import { Copy, Check, RefreshCw, Type, AlignLeft } from 'lucide-react';
import type { ToolComponentProps } from '@/types/toolbox';

// ── Word list ───────────────────────────────────────────────────────────────

const LOREM_WORDS = [
  'lorem','ipsum','dolor','sit','amet','consectetur','adipiscing','elit','sed','do',
  'eiusmod','tempor','incididunt','ut','labore','et','dolore','magna','aliqua',
  'enim','ad','minim','veniam','quis','nostrud','exercitation','ullamco','laboris',
  'nisi','aliquip','ex','ea','commodo','consequat','duis','aute','irure','in',
  'reprehenderit','voluptate','velit','esse','cillum','fugiat','nulla','pariatur',
  'excepteur','sint','occaecat','cupidatat','non','proident','sunt','culpa','qui',
  'officia','deserunt','mollit','anim','id','est','laborum','ac','ante','bibendum',
  'blandit','congue','cum','cursus','diam','dictum','donec','eget','elementum',
  'eu','facilisis','faucibus','felis','fermentum','gravida','habitant','hendrerit',
  'integer','interdum','justo','lacus','lectus','leo','libero','ligula','lobortis',
  'luctus','maecenas','massa','mattis','mauris','maximus','metus','morbi','nam',
  'nec','neque','nibh','nunc','odio','orci','ornare','pellentesque','pharetra',
  'placerat','porta','posuere','praesent','pretium','proin','pulvinar','purus',
  'quam','quisque','rhoncus','risus','rutrum','sagittis','sapien','scelerisque',
  'semper','sollicitudin','suscipit','tellus','tincidunt','tortor','tristique',
  'turpis','ultrices','urna','varius','vel','vestibulum','vitae','vivamus','viverra','volutpat',
];

const CLASSIC_OPENING = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

// ── Generation helpers ──────────────────────────────────────────────────────

function randomWord(): string {
  return LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)];
}

function randomWords(count: number): string {
  return Array.from({ length: count }, randomWord).join(' ');
}

function generateSentence(): string {
  const len = 8 + Math.floor(Math.random() * 12);
  const words = randomWords(len);
  return words.charAt(0).toUpperCase() + words.slice(1) + '.';
}

function generateParagraph(): string {
  const sentenceCount = 4 + Math.floor(Math.random() * 4);
  return Array.from({ length: sentenceCount }, generateSentence).join(' ');
}

function generate(
  mode: 'paragraphs' | 'sentences' | 'words',
  count: number,
  startWithLorem: boolean,
): string[] {
  if (mode === 'paragraphs') {
    const paragraphs = Array.from({ length: count }, generateParagraph);
    if (startWithLorem && paragraphs.length > 0) {
      paragraphs[0] = CLASSIC_OPENING + '. ' + paragraphs[0];
    }
    return paragraphs;
  }
  if (mode === 'sentences') {
    const sentences = Array.from({ length: count }, generateSentence);
    if (startWithLorem && sentences.length > 0) {
      sentences[0] = CLASSIC_OPENING + '.';
    }
    return [sentences.join(' ')];
  }
  // words
  const raw = randomWords(count);
  if (startWithLorem) {
    const openingWords = CLASSIC_OPENING.replace(/,/g, '').split(' ');
    const remaining = Math.max(0, count - openingWords.length);
    return [openingWords.slice(0, count).join(' ') + (remaining > 0 ? ' ' + randomWords(remaining) : '')];
  }
  return [raw];
}

// ── Preferences ─────────────────────────────────────────────────────────────

const DEFAULT_PREFERENCES = {
  mode: 'paragraphs',
  count: 3,
  startWithLorem: true,
} as const;

// ── Component ───────────────────────────────────────────────────────────────

export default function LoremGenerator({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const { preferences, setPreferences } = useToolPreferences('lorem-generator', DEFAULT_PREFERENCES);
  const { copied, copy, error: plainClipboardError } = useCopyToClipboard();
  const { copied: copiedHtml, copy: copyHtml, error: htmlClipboardError } = useCopyToClipboard();

  const mode = preferences.mode as 'paragraphs' | 'sentences' | 'words';
  const count = Math.min(Math.max(1, Number(preferences.count) || 1), TOOLBOX_LIMITS.generatorCount);
  const startWithLorem = preferences.startWithLorem !== false;

  const validationError =
    Number(preferences.count) > TOOLBOX_LIMITS.generatorCount
      ? t('toolbox.tools.shared.countTooLarge', { limit: TOOLBOX_LIMITS.generatorCount })
      : null;

  const [seed, setSeed] = useState(0);
  const regenerate = useCallback(() => setSeed((s) => s + 1), []);

  const paragraphs = useMemo(() => {
    void seed;
    return generate(mode, count, startWithLorem);
  }, [mode, count, startWithLorem, seed]);

  const plainText = paragraphs.join('\n\n');
  const htmlText = paragraphs.map((p) => `<p>${p}</p>`).join('\n');
  const wordCount = plainText.split(/\s+/).filter(Boolean).length;
  const charCount = plainText.length;

  const handleCopyPlain = useCallback(() => copy(plainText), [copy, plainText]);
  const handleCopyHtml = useCallback(() => copyHtml(htmlText), [copyHtml, htmlText]);

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* ── Options ──────────────────────────────────────────────── */}
        <ToolSection title={t('toolbox.tools.loremGenerator.options')}>
          <ToolOptionGroup>
            <div className="space-y-1.5">
              <Label>{t('toolbox.tools.loremGenerator.mode')}</Label>
              <Select value={mode} onValueChange={(v) => setPreferences({ mode: v })}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paragraphs">{t('toolbox.tools.loremGenerator.paragraphs')}</SelectItem>
                  <SelectItem value="sentences">{t('toolbox.tools.loremGenerator.sentences')}</SelectItem>
                  <SelectItem value="words">{t('toolbox.tools.loremGenerator.words')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t('toolbox.tools.loremGenerator.count')}</Label>
              <Input
                type="number"
                min={1}
                max={TOOLBOX_LIMITS.generatorCount}
                value={count}
                onChange={(e) => setPreferences({ count: Math.max(1, Number(e.target.value) || 1) })}
                className="w-24"
              />
            </div>

            <div className="flex items-center gap-2 self-end pb-0.5">
              <Switch
                id="start-with-lorem"
                checked={startWithLorem}
                onCheckedChange={(v) => setPreferences({ startWithLorem: v })}
              />
              <Label htmlFor="start-with-lorem" className="cursor-pointer">
                {t('toolbox.tools.loremGenerator.startWithLorem')}
              </Label>
            </div>
          </ToolOptionGroup>
        </ToolSection>

        {validationError && <ToolValidationMessage message={validationError} />}

        {/* ── Generated Text ──────────────────────────────────────── */}
        <ToolSection
          title={t('toolbox.tools.loremGenerator.generatedText')}
          headerRight={
            <div className="flex items-center gap-2">
              <Button onClick={regenerate} variant="ghost" size="sm" className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                {t('toolbox.tools.loremGenerator.regenerate')}
              </Button>
              <Button onClick={handleCopyPlain} variant="outline" size="sm" className="gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? t('toolbox.actions.copied') : t('toolbox.actions.copy')}
              </Button>
              {mode === 'paragraphs' && (
                <Button onClick={handleCopyHtml} variant="outline" size="sm" className="gap-1.5">
                  {copiedHtml ? <Check className="h-3.5 w-3.5 text-green-500" /> : <AlignLeft className="h-3.5 w-3.5" />}
                  {copiedHtml
                    ? t('toolbox.actions.copied')
                    : t('toolbox.tools.loremGenerator.copyHtml')}
                </Button>
              )}
            </div>
          }
        >
          <div className="prose prose-sm dark:prose-invert max-w-none max-h-96 overflow-y-auto rounded-md border bg-muted/30 p-4">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Type className="h-3 w-3" />
              {wordCount} {t('toolbox.tools.loremGenerator.words')}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <AlignLeft className="h-3 w-3" />
              {charCount} {t('toolbox.tools.loremGenerator.chars')}
            </Badge>
          </div>
          {(plainClipboardError || htmlClipboardError) && (
            <ToolValidationMessage message={t('toolbox.actions.copyFailed')} className="mt-3" />
          )}
        </ToolSection>
      </div>
    </div>
  );
}
