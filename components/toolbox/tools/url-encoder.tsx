'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  ToolSection,
  ToolTextArea,
  ToolOptionGroup,
  ToolValidationMessage,
} from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolPreferences } from '@/hooks/use-tool-preferences';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';
import { ArrowDown, ArrowUp, ArrowDownUp } from 'lucide-react';
import type { ToolComponentProps } from '@/types/toolbox';

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const DEFAULT_PREFERENCES = {
  mode: 'encode',
  encodeFullUrl: false,
  plusForSpace: false,
} as const;

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function UrlEncoder({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const { preferences, setPreferences } = useToolPreferences('url-encoder', DEFAULT_PREFERENCES);
  const [input, setInput] = useState('');

  const isEncoding = preferences.mode === 'encode';
  const encodeFullUrl = preferences.encodeFullUrl;
  const plusForSpace = preferences.plusForSpace;

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
      let result: string;
      if (isEncoding) {
        result = encodeFullUrl ? encodeURI(input) : encodeURIComponent(input);
        if (plusForSpace) result = result.replace(/%20/g, '+');
      } else {
        let decoded = input;
        if (plusForSpace) decoded = decoded.replace(/\+/g, '%20');
        result = encodeFullUrl ? decodeURI(decoded) : decodeURIComponent(decoded);
      }
      return { output: result, error: null };
    } catch (e) {
      return { output: '', error: (e as Error).message };
    }
  }, [input, isEncoding, encodeFullUrl, plusForSpace, t]);

  /* ---- URL breakdown (decode mode only) -------------------------------- */

  const urlParts = useMemo(() => {
    if (isEncoding || !output) return null;
    try {
      const url = new URL(output);
      return {
        protocol: url.protocol,
        host: url.hostname,
        port: url.port,
        path: url.pathname,
        query: url.search,
        fragment: url.hash,
        params: Array.from(url.searchParams.entries()),
      };
    } catch {
      return null;
    }
  }, [isEncoding, output]);

  /* ---- Swap handler ---------------------------------------------------- */

  const handleSwap = useCallback(() => {
    setPreferences({ mode: isEncoding ? 'decode' : 'encode' });
    setInput(output);
  }, [isEncoding, output, setPreferences]);

  /* ---- Toggle direction ------------------------------------------------ */

  const toggleDirection = useCallback(() => {
    setPreferences({ mode: isEncoding ? 'decode' : 'encode' });
  }, [isEncoding, setPreferences]);

  /* ---- I/O meta footer ------------------------------------------------- */

  const ioFooter = output ? (
    <Badge variant="secondary" className="text-xs font-normal tabular-nums">
      {t('toolbox.tools.shared.ioMeta', {
        inputSize: input.length,
        outputSize: output.length,
      })}
    </Badge>
  ) : null;

  /* ---- Render ---------------------------------------------------------- */

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Input section */}
        <ToolSection
          title={
            isEncoding
              ? t('toolbox.tools.urlEncoder.textInput')
              : t('toolbox.tools.urlEncoder.encodedInput')
          }
          headerRight={
            <Badge variant="secondary" className="text-xs font-normal">
              {isEncoding ? 'Text → URL' : 'URL → Text'}
            </Badge>
          }
        >
          <ToolTextArea
            label={
              isEncoding
                ? t('toolbox.tools.urlEncoder.textInput')
                : t('toolbox.tools.urlEncoder.encodedInput')
            }
            value={input}
            onChange={setInput}
            placeholder={isEncoding ? 'Hello World & more' : 'Hello%20World%20%26%20more'}
            showPaste
            showClear
            rows={6}
            maxLength={TOOLBOX_LIMITS.converterChars}
          />
        </ToolSection>

        {/* Options + direction indicator */}
        <div className="flex flex-col items-center gap-3">
          <ToolOptionGroup>
            {isEncoding && (
              <div className="flex items-center gap-2">
                <Switch
                  id="url-encode-full"
                  checked={encodeFullUrl}
                  onCheckedChange={(checked) => setPreferences({ encodeFullUrl: checked })}
                />
                <Label htmlFor="url-encode-full" className="text-sm">
                  {t('toolbox.tools.urlEncoder.encodeFull')}
                </Label>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch
                id="url-plus-space"
                checked={plusForSpace}
                onCheckedChange={(checked) => setPreferences({ plusForSpace: checked })}
              />
              <Label htmlFor="url-plus-space" className="text-sm">
                {t('toolbox.tools.urlEncoder.plusForSpace')}
              </Label>
            </div>
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
              {t('toolbox.tools.urlEncoder.swap')}
            </Button>
          </div>
        </div>

        {/* Error display */}
        {error && <ToolValidationMessage message={error} />}

        {/* Output section */}
        <ToolSection
          title={
            isEncoding
              ? t('toolbox.tools.urlEncoder.encodedOutput')
              : t('toolbox.tools.urlEncoder.textOutput')
          }
        >
          <ToolTextArea
            label={
              isEncoding
                ? t('toolbox.tools.urlEncoder.encodedOutput')
                : t('toolbox.tools.urlEncoder.textOutput')
            }
            value={output}
            readOnly
            rows={6}
            showCopy
            footer={ioFooter}
          />
        </ToolSection>

        {/* URL component breakdown (decode mode only) */}
        {urlParts && (
          <Card className="border-dashed">
            <CardContent className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">URL Breakdown</p>
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                {[
                  ['Protocol', urlParts.protocol],
                  ['Host', urlParts.host],
                  ['Port', urlParts.port],
                  ['Path', urlParts.path],
                  ['Query', urlParts.query],
                  ['Fragment', urlParts.fragment],
                ].map(
                  ([label, value]) =>
                    value && (
                      <div key={label} className="contents">
                        <span className="font-medium text-muted-foreground">{label}</span>
                        <span className="font-mono break-all">{value}</span>
                      </div>
                    ),
                )}
              </div>

              {/* Query parameter table */}
              {urlParts.params.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Query Parameters</p>
                  <div className="rounded-md border text-xs">
                    <div className="grid grid-cols-2 gap-px bg-muted">
                      <div className="bg-muted px-2 py-1 font-medium">Key</div>
                      <div className="bg-muted px-2 py-1 font-medium">Value</div>
                    </div>
                    {urlParts.params.map(([key, value], i) => (
                      <div key={`${key}-${i}`} className="grid grid-cols-2 gap-px border-t">
                        <div className="bg-background px-2 py-1 font-mono break-all">{key}</div>
                        <div className="bg-background px-2 py-1 font-mono break-all">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
