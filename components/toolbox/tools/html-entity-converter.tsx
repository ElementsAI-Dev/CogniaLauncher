'use client';

import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  ToolActionRow,
  ToolTextArea,
  ToolValidationMessage,
  ToolSection,
  ToolOptionGroup,
} from '@/components/toolbox/tool-layout';
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

function encodeNumericEntities(text: string, hex: boolean): string {
  return text.replace(/[\u00A0-\uFFFF<>&"']/g, (char) => {
    const cp = char.codePointAt(0) ?? 0;
    return hex ? `&#x${cp.toString(16).toUpperCase()};` : `&#${cp};`;
  });
}

function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

const DEFAULT_PREFERENCES = {
  mode: 'encode',
  autoConvert: true,
  numericMode: false,
  hexNumeric: false,
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
      const encoded = preferences.numericMode
        ? encodeNumericEntities(input, preferences.hexNumeric)
        : encodeHtmlEntities(input);
      setOutput(isEncoding ? encoded : decodeHtmlEntities(input));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setOutput('');
    }
  }, [input, isEncoding, preferences.hexNumeric, preferences.numericMode, t]);

  const handleSwap = useCallback(() => {
    setPreferences({ mode: isEncoding ? 'decode' : 'encode' });
    setInput(output);
    setOutput('');
    setError(null);
  }, [isEncoding, output, setPreferences]);

  const entityCount = useMemo(() => {
    const m = output.match(/&[#a-zA-Z0-9]+;/g);
    return m ? m.length : 0;
  }, [output]);

  const characterCount = input.length;

  const handleInputChange = (value: string) => {
    setInput(value);
    if (preferences.autoConvert) {
      if (!value.trim()) {
        setOutput('');
        setError(null);
        return;
      }
      try {
        const encoded = preferences.numericMode
          ? encodeNumericEntities(value, preferences.hexNumeric)
          : encodeHtmlEntities(value);
        setOutput(isEncoding ? encoded : decodeHtmlEntities(value));
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    }
  };

  return (
    <div className={className}>
      <div className="space-y-4">
        <ToolSection title={t('toolbox.tools.htmlEntityConverter.name')} description={t('toolbox.tools.htmlEntityConverter.desc')}>
          <ToolTextArea
            label={isEncoding ? t('toolbox.tools.htmlEntityConverter.textInput') : t('toolbox.tools.htmlEntityConverter.entityInput')}
            value={input}
            onChange={handleInputChange}
            placeholder={isEncoding ? '<div class="hello">' : '&lt;div class=&quot;hello&quot;&gt;'}
            showPaste
            showClear
            rows={6}
            maxLength={TOOLBOX_LIMITS.converterChars}
            footer={<span className="text-xs text-muted-foreground">{t('toolbox.tools.htmlEntityConverter.charCount', { count: characterCount })}</span>}
          />

          <ToolOptionGroup className="mt-3">
            <div className="flex items-center gap-2">
              <Switch
                id="html-entity-auto"
                checked={preferences.autoConvert}
                onCheckedChange={(checked) => setPreferences({ autoConvert: checked })}
              />
              <Label htmlFor="html-entity-auto" className="text-sm">{t('toolbox.tools.htmlEntityConverter.autoConvert')}</Label>
            </div>
            {isEncoding && (
              <>
                <div className="flex items-center gap-2">
                  <Switch
                    id="html-entity-numeric"
                    checked={preferences.numericMode}
                    onCheckedChange={(checked) => setPreferences({ numericMode: checked })}
                  />
                  <Label htmlFor="html-entity-numeric" className="text-sm">{t('toolbox.tools.htmlEntityConverter.numericMode')}</Label>
                </div>
                {preferences.numericMode && (
                  <div className="flex items-center gap-2">
                    <Switch
                      id="html-entity-hex"
                      checked={preferences.hexNumeric}
                      onCheckedChange={(checked) => setPreferences({ hexNumeric: checked })}
                    />
                    <Label htmlFor="html-entity-hex" className="text-sm">{t('toolbox.tools.htmlEntityConverter.hexNumeric')}</Label>
                  </div>
                )}
              </>
            )}
          </ToolOptionGroup>

          {!preferences.autoConvert && (
            <ToolActionRow className="mt-3">
              <Button onClick={handleConvert} size="sm">
                {isEncoding ? t('toolbox.tools.htmlEntityConverter.encode') : t('toolbox.tools.htmlEntityConverter.decode')}
              </Button>
            </ToolActionRow>
          )}

          <ToolActionRow className="mt-2">
            <Button onClick={handleSwap} variant="outline" size="sm" className="gap-1.5">
              <ArrowDownUp className="h-3.5 w-3.5" />
              {t('toolbox.tools.htmlEntityConverter.swap')}
            </Button>
          </ToolActionRow>
        </ToolSection>

        {error && <ToolValidationMessage message={error} />}

        <ToolSection title={isEncoding ? t('toolbox.tools.htmlEntityConverter.entityOutput') : t('toolbox.tools.htmlEntityConverter.textOutput')}>
          <ToolTextArea
            label={isEncoding ? t('toolbox.tools.htmlEntityConverter.entityOutput') : t('toolbox.tools.htmlEntityConverter.textOutput')}
            value={output}
            readOnly
            rows={6}
            footer={<span className="text-xs text-muted-foreground">{t('toolbox.tools.htmlEntityConverter.entityCount', { count: entityCount })}</span>}
          />
        </ToolSection>
      </div>
    </div>
  );
}
