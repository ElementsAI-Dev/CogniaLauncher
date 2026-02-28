'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useLocale } from '@/components/providers/locale-provider';
import { RefreshCw, Copy, Check } from 'lucide-react';
import type { ToolComponentProps } from '@/types/toolbox';

const WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum'.split(' ');

function randomWords(count: number): string {
  return Array.from({ length: count }, () => WORDS[Math.floor(Math.random() * WORDS.length)]).join(' ');
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

export default function LoremGenerator({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const [mode, setMode] = useState<'paragraphs' | 'sentences' | 'words'>('paragraphs');
  const [count, setCount] = useState(3);
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = useCallback(() => {
    let result: string;
    if (mode === 'paragraphs') {
      result = Array.from({ length: count }, generateParagraph).join('\n\n');
    } else if (mode === 'sentences') {
      result = Array.from({ length: count }, generateSentence).join(' ');
    } else {
      result = randomWords(count);
    }
    setOutput(result);
    setCopied(false);
  }, [mode, count]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [output]);

  return (
    <div className={className}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>{t('toolbox.tools.loremGenerator.mode')}</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
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
          <div className="space-y-2">
            <Label>{t('toolbox.tools.loremGenerator.count')}</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
              className="w-24"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleGenerate} size="sm" className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            {t('toolbox.tools.loremGenerator.generate')}
          </Button>
          {output && (
            <Button onClick={handleCopy} variant="outline" size="sm" className="gap-1.5">
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t('toolbox.actions.copied') : t('toolbox.actions.copy')}
            </Button>
          )}
        </div>

        {output && (
          <Textarea
            value={output}
            readOnly
            rows={12}
            className="font-sans text-sm resize-none bg-muted/50"
          />
        )}
      </div>
    </div>
  );
}
