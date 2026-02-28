'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ToolTextArea } from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { AlertCircle, ArrowDownUp } from 'lucide-react';
import type { ToolComponentProps } from '@/types/toolbox';

export default function UrlEncoder({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [isEncoding, setIsEncoding] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleConvert = useCallback(() => {
    if (!input.trim()) { setOutput(''); setError(null); return; }
    try {
      setOutput(isEncoding ? encodeURIComponent(input) : decodeURIComponent(input));
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
          label={isEncoding ? t('toolbox.tools.urlEncoder.textInput') : t('toolbox.tools.urlEncoder.encodedInput')}
          value={input}
          onChange={setInput}
          placeholder={isEncoding ? 'Hello World & more' : 'Hello%20World%20%26%20more'}
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
            {isEncoding ? t('toolbox.tools.urlEncoder.encode') : t('toolbox.tools.urlEncoder.decode')}
          </Button>
          <Button onClick={handleSwap} variant="outline" size="sm" className="gap-1.5">
            <ArrowDownUp className="h-3.5 w-3.5" />
            {t('toolbox.tools.urlEncoder.swap')}
          </Button>
        </div>

        <ToolTextArea
          label={isEncoding ? t('toolbox.tools.urlEncoder.encodedOutput') : t('toolbox.tools.urlEncoder.textOutput')}
          value={output}
          readOnly
          rows={6}
        />
      </div>
    </div>
  );
}
