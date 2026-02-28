'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ToolTextArea } from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { AlertCircle, ArrowDownUp } from 'lucide-react';
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

export default function HtmlEntityConverter({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [isEncoding, setIsEncoding] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleConvert = useCallback(() => {
    if (!input.trim()) { setOutput(''); setError(null); return; }
    try {
      setOutput(isEncoding ? encodeHtmlEntities(input) : decodeHtmlEntities(input));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setOutput('');
    }
  }, [input, isEncoding]);

  const handleSwap = useCallback(() => {
    setIsEncoding((prev) => !prev);
    setInput(output);
    setOutput('');
    setError(null);
  }, [output]);

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

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={handleConvert} size="sm">
            {isEncoding ? t('toolbox.tools.htmlEntityConverter.encode') : t('toolbox.tools.htmlEntityConverter.decode')}
          </Button>
          <Button onClick={handleSwap} variant="outline" size="sm" className="gap-1.5">
            <ArrowDownUp className="h-3.5 w-3.5" />
            {t('toolbox.tools.htmlEntityConverter.swap')}
          </Button>
        </div>

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
