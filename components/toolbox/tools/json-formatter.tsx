'use client';

import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ToolActionRow, ToolTextArea, ToolValidationMessage } from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';
import { useToolPreferences } from '@/hooks/use-tool-preferences';
import { Minimize2, Maximize2 } from 'lucide-react';
import type { ToolComponentProps } from '@/types/toolbox';

const DEFAULT_PREFERENCES = {
  indent: '2',
  sortKeys: false,
  escapeUnicode: false,
} as const;

function sortObjectKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => sortObjectKeysDeep(entry));
  if (!value || typeof value !== 'object') return value;

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, nested]) => [key, sortObjectKeysDeep(nested)] as const);
  return Object.fromEntries(entries);
}

function convertUnicode(value: string): string {
  return value.replace(/[\u007f-\uffff]/g, (char) =>
    `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

function getJsonErrorDetails(error: Error): string {
  const message = error.message;
  const positionMatch = message.match(/position (\d+)/i);
  if (!positionMatch) return message;
  const position = Number(positionMatch[1]);
  if (!Number.isFinite(position) || position < 0) return message;
  return `${message} (char ${position})`;
}

export default function JsonFormatter({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const { preferences, setPreferences } = useToolPreferences('json-formatter', DEFAULT_PREFERENCES);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [outputMeta, setOutputMeta] = useState<{ inputSize: number; outputSize: number; type: string } | null>(null);

  const indent = preferences.indent;

  const processJson = useCallback(
    (minify: boolean) => {
      if (!input.trim()) {
        setOutput('');
        setOutputMeta(null);
        setError(null);
        return;
      }
      if (input.length > TOOLBOX_LIMITS.jsonChars) {
        setError(
          t('toolbox.tools.shared.inputTooLarge', {
            limit: TOOLBOX_LIMITS.jsonChars.toLocaleString(),
          }),
        );
        setOutput('');
        setOutputMeta(null);
        return;
      }

      try {
        const parsed = JSON.parse(input);
        const prepared = preferences.sortKeys ? sortObjectKeysDeep(parsed) : parsed;
        let serialized = JSON.stringify(prepared, null, minify ? 0 : Number(indent));
        if (preferences.escapeUnicode) {
          serialized = convertUnicode(serialized);
        }
        setOutput(serialized);
        setOutputMeta({
          inputSize: input.length,
          outputSize: serialized.length,
          type: Array.isArray(parsed) ? 'array' : typeof parsed,
        });
        setError(null);
      } catch (e) {
        setError(getJsonErrorDetails(e as Error));
        setOutput('');
        setOutputMeta(null);
      }
    },
    [indent, input, preferences.escapeUnicode, preferences.sortKeys, t],
  );

  const handleFormat = useCallback(() => {
    processJson(false);
  }, [processJson]);

  const handleMinify = useCallback(() => {
    processJson(true);
  }, [processJson]);

  const sizeDelta = useMemo(() => {
    if (!outputMeta || outputMeta.inputSize === 0) return 0;
    return Math.round(((outputMeta.outputSize - outputMeta.inputSize) / outputMeta.inputSize) * 100);
  }, [outputMeta]);

  return (
    <div className={className}>
      <div className="space-y-4">
        <ToolTextArea
          label={t('toolbox.tools.jsonFormatter.input')}
          value={input}
          onChange={setInput}
          placeholder='{"key": "value"}'
          showPaste
          showClear
          rows={10}
        />

        {error && <ToolValidationMessage message={error} />}

        <ToolActionRow
          rightSlot={(
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Switch
                  id="json-sort-keys"
                  checked={preferences.sortKeys}
                  onCheckedChange={(checked) => setPreferences({ sortKeys: checked })}
                />
                <Label htmlFor="json-sort-keys" className="text-xs">{t('toolbox.tools.jsonFormatter.sortKeys')}</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <Switch
                  id="json-escape-unicode"
                  checked={preferences.escapeUnicode}
                  onCheckedChange={(checked) => setPreferences({ escapeUnicode: checked })}
                />
                <Label htmlFor="json-escape-unicode" className="text-xs">{t('toolbox.tools.jsonFormatter.escapeUnicode')}</Label>
              </div>
            </div>
          )}
        >
          <Button onClick={handleFormat} size="sm" className="gap-1.5">
            <Maximize2 className="h-3.5 w-3.5" />
            {t('toolbox.tools.jsonFormatter.format')}
          </Button>
          <Button onClick={handleMinify} variant="outline" size="sm" className="gap-1.5">
            <Minimize2 className="h-3.5 w-3.5" />
            {t('toolbox.tools.jsonFormatter.minify')}
          </Button>
          <Select value={indent} onValueChange={(value) => setPreferences({ indent: value })}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 {t('toolbox.tools.jsonFormatter.spaces')}</SelectItem>
              <SelectItem value="4">4 {t('toolbox.tools.jsonFormatter.spaces')}</SelectItem>
              <SelectItem value="1">1 {t('toolbox.tools.jsonFormatter.spaces')}</SelectItem>
            </SelectContent>
          </Select>
        </ToolActionRow>

        <ToolTextArea
          label={t('toolbox.tools.jsonFormatter.output')}
          value={output}
          readOnly
          rows={10}
        />

        {outputMeta && (
          <p className="text-xs text-muted-foreground">
            {t('toolbox.tools.jsonFormatter.meta', {
              inputSize: outputMeta.inputSize,
              outputSize: outputMeta.outputSize,
              type: outputMeta.type,
              delta: sizeDelta,
            })}
          </p>
        )}
      </div>
    </div>
  );
}
