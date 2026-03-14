'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ToolSection,
  ToolTextArea,
  ToolOptionGroup,
  ToolValidationMessage,
} from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';
import { useToolPreferences } from '@/hooks/use-tool-preferences';
import { ArrowDown, ArrowUp, ArrowDownUp } from 'lucide-react';
import type { ToolComponentProps } from '@/types/toolbox';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

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

function byteSize(text: string): number {
  return new TextEncoder().encode(text).length;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const DEFAULT_PREFERENCES = {
  mode: 'encode',
  urlSafe: false,
  stripWhitespace: true,
} as const;

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function Base64Converter({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const { preferences, setPreferences } = useToolPreferences('base64-converter', DEFAULT_PREFERENCES);
  const [input, setInput] = useState('');

  const isEncoding = preferences.mode === 'encode';
  const urlSafe = preferences.urlSafe;

  /* ---- Real-time conversion -------------------------------------------- */

  const { output, error } = useMemo(() => {
    if (!input.trim()) return { output: '', error: null };

    if (input.length > TOOLBOX_LIMITS.converterChars) {
      return {
        output: '',
        error: t('toolbox.tools.shared.inputTooLarge', {
          limit: TOOLBOX_LIMITS.converterChars.toLocaleString(),
        }),
      };
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
      return { output: result, error: null };
    } catch (e) {
      return {
        output: '',
        error: (e as Error).message || t('toolbox.tools.base64Converter.invalidInput'),
      };
    }
  }, [input, isEncoding, preferences.stripWhitespace, t, urlSafe]);

  /* ---- Swap handler ---------------------------------------------------- */

  const handleSwap = useCallback(() => {
    setPreferences({ mode: isEncoding ? 'decode' : 'encode' });
    setInput(output);
  }, [isEncoding, output, setPreferences]);

  /* ---- Toggle direction ------------------------------------------------ */

  const toggleDirection = useCallback(() => {
    setPreferences({ mode: isEncoding ? 'decode' : 'encode' });
  }, [isEncoding, setPreferences]);

  /* ---- Byte-size footer ------------------------------------------------ */

  const bytesFooter = output ? (
    <span className="text-xs text-muted-foreground tabular-nums">
      {t('toolbox.tools.shared.ioMeta', {
        inputSize: byteSize(input),
        outputSize: byteSize(output),
      })}{' '}
      bytes
    </span>
  ) : null;

  /* ---- Render ---------------------------------------------------------- */

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Input section */}
        <ToolSection
          title={
            isEncoding
              ? t('toolbox.tools.base64Converter.textInput')
              : t('toolbox.tools.base64Converter.base64Input')
          }
          headerRight={
            <Badge variant="secondary" className="text-xs font-normal">
              {isEncoding ? 'Text → Base64' : 'Base64 → Text'}
            </Badge>
          }
        >
          <ToolTextArea
            label={
              isEncoding
                ? t('toolbox.tools.base64Converter.textInput')
                : t('toolbox.tools.base64Converter.base64Input')
            }
            value={input}
            onChange={setInput}
            placeholder={isEncoding ? 'Hello, World!' : 'SGVsbG8sIFdvcmxkIQ=='}
            showPaste
            showClear
            rows={8}
            maxLength={TOOLBOX_LIMITS.converterChars}
          />
        </ToolSection>

        {/* Options + direction indicator */}
        <div className="flex flex-col items-center gap-3">
          <ToolOptionGroup>
            <div className="flex items-center gap-2">
              <Switch
                id="base64-url-safe"
                checked={urlSafe}
                onCheckedChange={(checked) => setPreferences({ urlSafe: checked })}
              />
              <Label htmlFor="base64-url-safe" className="text-sm">
                {t('toolbox.tools.base64Converter.urlSafe')}
              </Label>
            </div>
            {!isEncoding && (
              <div className="flex items-center gap-2">
                <Switch
                  id="base64-strip-spaces"
                  checked={preferences.stripWhitespace}
                  onCheckedChange={(checked) => setPreferences({ stripWhitespace: checked })}
                />
                <Label htmlFor="base64-strip-spaces" className="text-sm">
                  {t('toolbox.tools.base64Converter.stripWhitespace')}
                </Label>
              </div>
            )}
          </ToolOptionGroup>

          {/* Direction arrow + swap */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={toggleDirection}
              aria-label={isEncoding ? 'Encoding' : 'Decoding'}
            >
              {isEncoding ? (
                <ArrowDown className="h-4 w-4" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
            <Button
              onClick={handleSwap}
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!output}
            >
              <ArrowDownUp className="h-3.5 w-3.5" />
              {t('toolbox.tools.base64Converter.swap')}
            </Button>
          </div>
        </div>

        {/* Error display */}
        {error && <ToolValidationMessage message={error} />}

        {/* Output section */}
        <ToolSection
          title={
            isEncoding
              ? t('toolbox.tools.base64Converter.base64Output')
              : t('toolbox.tools.base64Converter.textOutput')
          }
        >
          <ToolTextArea
            label={
              isEncoding
                ? t('toolbox.tools.base64Converter.base64Output')
                : t('toolbox.tools.base64Converter.textOutput')
            }
            value={output}
            readOnly
            rows={8}
            showCopy
            footer={bytesFooter}
          />
        </ToolSection>
      </div>
    </div>
  );
}
