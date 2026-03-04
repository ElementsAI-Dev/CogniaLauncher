'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ToolActionRow, ToolTextArea, ToolValidationMessage } from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolPreferences } from '@/hooks/use-tool-preferences';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';
import { ArrowDownUp } from 'lucide-react';
import type { ToolComponentProps } from '@/types/toolbox';

const DEFAULT_PREFERENCES = {
  mode: 'encode',
  encodeFullUrl: false,
  plusForSpace: false,
} as const;

export default function UrlEncoder({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const { preferences, setPreferences } = useToolPreferences('url-encoder', DEFAULT_PREFERENCES);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ inputSize: number; outputSize: number } | null>(null);

  const isEncoding = preferences.mode === 'encode';

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
        result = preferences.encodeFullUrl ? encodeURI(input) : encodeURIComponent(input);
        if (preferences.plusForSpace) {
          result = result.replace(/%20/g, '+');
        }
      } else {
        const prepared = preferences.plusForSpace ? input.replace(/\+/g, ' ') : input;
        result = decodeURIComponent(prepared);
      }
      setOutput(result);
      setMeta({ inputSize: input.length, outputSize: result.length });
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setOutput('');
      setMeta(null);
    }
  }, [input, isEncoding, preferences.encodeFullUrl, preferences.plusForSpace, t]);

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
          label={isEncoding ? t('toolbox.tools.urlEncoder.textInput') : t('toolbox.tools.urlEncoder.encodedInput')}
          value={input}
          onChange={setInput}
          placeholder={isEncoding ? 'Hello World & more' : 'Hello%20World%20%26%20more'}
          showPaste
          showClear
          rows={6}
        />

        {error && <ToolValidationMessage message={error} />}

        <ToolActionRow
          rightSlot={(
            <div className="flex items-center gap-4">
              {isEncoding && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="url-encode-full"
                    checked={preferences.encodeFullUrl}
                    onCheckedChange={(checked) => setPreferences({ encodeFullUrl: checked })}
                  />
                  <Label htmlFor="url-encode-full" className="text-xs">{t('toolbox.tools.urlEncoder.encodeFull')}</Label>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch
                  id="url-plus-space"
                  checked={preferences.plusForSpace}
                  onCheckedChange={(checked) => setPreferences({ plusForSpace: checked })}
                />
                <Label htmlFor="url-plus-space" className="text-xs">{t('toolbox.tools.urlEncoder.plusForSpace')}</Label>
              </div>
            </div>
          )}
        >
          <Button onClick={handleConvert} size="sm">
            {isEncoding ? t('toolbox.tools.urlEncoder.encode') : t('toolbox.tools.urlEncoder.decode')}
          </Button>
          <Button onClick={handleSwap} variant="outline" size="sm" className="gap-1.5">
            <ArrowDownUp className="h-3.5 w-3.5" />
            {t('toolbox.tools.urlEncoder.swap')}
          </Button>
        </ToolActionRow>

        <ToolTextArea
          label={isEncoding ? t('toolbox.tools.urlEncoder.encodedOutput') : t('toolbox.tools.urlEncoder.textOutput')}
          value={output}
          readOnly
          rows={6}
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
