'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ToolTextArea } from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { AlertCircle, ArrowDownUp } from 'lucide-react';
import type { ToolComponentProps } from '@/types/toolbox';

export default function Base64Converter({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [isEncoding, setIsEncoding] = useState(true);
  const [urlSafe, setUrlSafe] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConvert = useCallback(() => {
    if (!input.trim()) { setOutput(''); setError(null); return; }
    try {
      if (isEncoding) {
        let encoded = btoa(unescape(encodeURIComponent(input)));
        if (urlSafe) {
          encoded = encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        }
        setOutput(encoded);
      } else {
        let decoded = input;
        if (urlSafe) {
          decoded = decoded.replace(/-/g, '+').replace(/_/g, '/');
          while (decoded.length % 4) decoded += '=';
        }
        setOutput(decodeURIComponent(escape(atob(decoded))));
      }
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setOutput('');
    }
  }, [input, isEncoding, urlSafe]);

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
          label={isEncoding ? t('toolbox.tools.base64Converter.textInput') : t('toolbox.tools.base64Converter.base64Input')}
          value={input}
          onChange={setInput}
          placeholder={isEncoding ? 'Hello, World!' : 'SGVsbG8sIFdvcmxkIQ=='}
          showPaste
          showClear
          rows={8}
        />

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-4">
          <Button onClick={handleConvert} size="sm">
            {isEncoding ? t('toolbox.tools.base64Converter.encode') : t('toolbox.tools.base64Converter.decode')}
          </Button>
          <Button onClick={handleSwap} variant="outline" size="sm" className="gap-1.5">
            <ArrowDownUp className="h-3.5 w-3.5" />
            {t('toolbox.tools.base64Converter.swap')}
          </Button>
          <div className="flex items-center gap-2 ml-auto">
            <Switch id="url-safe" checked={urlSafe} onCheckedChange={setUrlSafe} />
            <Label htmlFor="url-safe" className="text-sm">{t('toolbox.tools.base64Converter.urlSafe')}</Label>
          </div>
        </div>

        <ToolTextArea
          label={isEncoding ? t('toolbox.tools.base64Converter.base64Output') : t('toolbox.tools.base64Converter.textOutput')}
          value={output}
          readOnly
          rows={8}
        />
      </div>
    </div>
  );
}
