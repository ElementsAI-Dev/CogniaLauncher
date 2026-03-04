'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ToolActionRow, ToolTextArea, ToolValidationMessage } from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';
import { useToolPreferences } from '@/hooks/use-tool-preferences';
import { ArrowDownUp } from 'lucide-react';
import type { ToolComponentProps } from '@/types/toolbox';

const DEFAULT_PREFERENCES = {
  mode: 'encode',
  urlSafe: false,
  stripWhitespace: true,
} as const;

function encodeUnicodeToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64ToUnicode(base64: string): string {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export default function Base64Converter({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const { preferences, setPreferences } = useToolPreferences('base64-converter', DEFAULT_PREFERENCES);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ inputSize: number; outputSize: number } | null>(null);

  const isEncoding = preferences.mode === 'encode';
  const urlSafe = preferences.urlSafe;

  const handleConvert = useCallback(() => {
    if (!input.trim()) {
      setOutput('');
      setMeta(null);
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
      setMeta(null);
      return;
    }

    try {
      let result = '';
      if (isEncoding) {
        let encoded = encodeUnicodeToBase64(input);
        if (urlSafe) {
          encoded = encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        }
        result = encoded;
      } else {
        let decoded = input;
        if (preferences.stripWhitespace) {
          decoded = decoded.replace(/\s+/g, '');
        }
        if (urlSafe) {
          decoded = decoded.replace(/-/g, '+').replace(/_/g, '/');
          while (decoded.length % 4) decoded += '=';
        }
        result = decodeBase64ToUnicode(decoded);
      }
      setOutput(result);
      setMeta({ inputSize: input.length, outputSize: result.length });
      setError(null);
    } catch (e) {
      setError((e as Error).message || t('toolbox.tools.base64Converter.invalidInput'));
      setOutput('');
      setMeta(null);
    }
  }, [input, isEncoding, preferences.stripWhitespace, t, urlSafe]);

  const handleSwap = useCallback(() => {
    setPreferences({ mode: isEncoding ? 'decode' : 'encode' });
    setInput(output);
    setOutput('');
    setMeta(null);
    setError(null);
  }, [isEncoding, output, setPreferences]);

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

        {error && <ToolValidationMessage message={error} />}

        <ToolActionRow
          rightSlot={(
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="base64-url-safe"
                  checked={urlSafe}
                  onCheckedChange={(checked) => setPreferences({ urlSafe: checked })}
                />
                <Label htmlFor="base64-url-safe" className="text-sm">{t('toolbox.tools.base64Converter.urlSafe')}</Label>
              </div>
              {!isEncoding && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="base64-strip-spaces"
                    checked={preferences.stripWhitespace}
                    onCheckedChange={(checked) => setPreferences({ stripWhitespace: checked })}
                  />
                  <Label htmlFor="base64-strip-spaces" className="text-sm">{t('toolbox.tools.base64Converter.stripWhitespace')}</Label>
                </div>
              )}
            </div>
          )}
        >
          <Button onClick={handleConvert} size="sm">
            {isEncoding ? t('toolbox.tools.base64Converter.encode') : t('toolbox.tools.base64Converter.decode')}
          </Button>
          <Button onClick={handleSwap} variant="outline" size="sm" className="gap-1.5">
            <ArrowDownUp className="h-3.5 w-3.5" />
            {t('toolbox.tools.base64Converter.swap')}
          </Button>
        </ToolActionRow>

        <ToolTextArea
          label={isEncoding ? t('toolbox.tools.base64Converter.base64Output') : t('toolbox.tools.base64Converter.textOutput')}
          value={output}
          readOnly
          rows={8}
        />

        {meta && (
          <p className="text-xs text-muted-foreground">
            {t('toolbox.tools.shared.ioMeta', { inputSize: meta.inputSize, outputSize: meta.outputSize })}
          </p>
        )}
      </div>
    </div>
  );
}
