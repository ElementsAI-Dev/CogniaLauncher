'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ToolActionRow, ToolTextArea, ToolValidationMessage } from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolPreferences } from '@/hooks/use-tool-preferences';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';
import { ArrowDownUp } from 'lucide-react';
import type { ToolComponentProps } from '@/types/toolbox';

function encodeHtmlEntities(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

const DEFAULT_PREFERENCES = {
  mode: 'encode',
} as const;

export default function HtmlEntityConverter({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const { preferences, setPreferences } = useToolPreferences('html-entity-converter', DEFAULT_PREFERENCES);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isEncoding = preferences.mode === 'encode';

  const handleConvert = useCallback(() => {
    if (!input.trim()) {
      setOutput('');
      setError(null);
      return;
    }
    if (input.length > TOOLBOX_LIMITS.converterChars) {
      setError(
        t('toolbox.tools.shared.inputTooLarge', {
          limit: TOOLBOX_LIMITS.converterChars.toLocaleString(),
        }),
      );
      setOutput('');
      return;
    }
    try {
      setOutput(isEncoding ? encodeHtmlEntities(input) : decodeHtmlEntities(input));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setOutput('');
    }
  }, [input, isEncoding, t]);

  const handleSwap = useCallback(() => {
    setPreferences({ mode: isEncoding ? 'decode' : 'encode' });
    setInput(output);
    setOutput('');
    setError(null);
  }, [isEncoding, output, setPreferences]);

  return (
    <div className={className}>
      <div className="space-y-4">
        <ToolTextArea
          label={isEncoding ? t('toolbox.tools.htmlEntityConverter.textInput') : t('toolbox.tools.htmlEntityConverter.entityInput')}
          value={input}
          onChange={setInput}
          placeholder={isEncoding ? '<div class="hello">' : '&lt;div class=&quot;hello&quot;&gt;'}
          showPaste
          showClear
          rows={6}
        />

        {error && <ToolValidationMessage message={error} />}

        <ToolActionRow>
          <Button onClick={handleConvert} size="sm">
            {isEncoding ? t('toolbox.tools.htmlEntityConverter.encode') : t('toolbox.tools.htmlEntityConverter.decode')}
          </Button>
          <Button onClick={handleSwap} variant="outline" size="sm" className="gap-1.5">
            <ArrowDownUp className="h-3.5 w-3.5" />
            {t('toolbox.tools.htmlEntityConverter.swap')}
          </Button>
        </ToolActionRow>

        <ToolTextArea
          label={isEncoding ? t('toolbox.tools.htmlEntityConverter.entityOutput') : t('toolbox.tools.htmlEntityConverter.textOutput')}
          value={output}
          readOnly
          rows={6}
        />
      </div>
    </div>
  );
}
