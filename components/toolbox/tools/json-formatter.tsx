'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  ToolActionRow,
  ToolTextArea,
  ToolValidationMessage,
  ToolSection,
  ToolOptionGroup,
} from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { useCopyToClipboard } from '@/hooks/use-clipboard';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';
import { useToolPreferences } from '@/hooks/use-tool-preferences';
import { Minimize2, Maximize2, Copy, Check } from 'lucide-react';
import type { ToolComponentProps } from '@/types/toolbox';

/* ---------------------------------------------------------------------------
 * Preferences
 * --------------------------------------------------------------------------- */

const DEFAULT_PREFERENCES = {
  indent: '2',
  sortKeys: false,
  escapeUnicode: false,
  autoFormat: false,
} as const;

/* ---------------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------------- */

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

interface JsonErrorInfo {
  message: string;
  line?: number;
  column?: number;
  position?: number;
}

function getJsonErrorDetails(error: Error, input: string): JsonErrorInfo {
  const message = error.message;
  const positionMatch = message.match(/position\s+(\d+)/i);
  if (!positionMatch) return { message };

  const position = Number(positionMatch[1]);
  if (!Number.isFinite(position) || position < 0) return { message };

  const before = input.slice(0, position);
  const line = (before.match(/\n/g) || []).length + 1;
  const lastNewline = before.lastIndexOf('\n');
  const column = position - lastNewline;

  return { message, line, column, position };
}

function getJsonType(parsed: unknown): string {
  if (Array.isArray(parsed)) return 'Array';
  if (parsed !== null && typeof parsed === 'object') return 'Object';
  return 'Primitive';
}

function formatDelta(inputSize: number, outputSize: number): string {
  if (inputSize === 0) return '';
  const pct = Math.round(((outputSize - inputSize) / inputSize) * 100);
  const sign = pct > 0 ? '+' : '';
  return `${inputSize.toLocaleString()} → ${outputSize.toLocaleString()} (${sign}${pct}%)`;
}

/* ---------------------------------------------------------------------------
 * Error Snippet
 * --------------------------------------------------------------------------- */

function ErrorSnippet({
  input,
  errorInfo,
  locationLabel,
}: {
  input: string;
  errorInfo: JsonErrorInfo;
  locationLabel: string;
}) {
  const snippet = useMemo(() => {
    if (errorInfo.line == null) return null;
    const lines = input.split('\n');
    const lineIdx = errorInfo.line - 1;
    const start = Math.max(0, lineIdx - 2);
    const end = Math.min(lines.length, lineIdx + 3);
    return lines.slice(start, end).map((text, i) => ({
      num: start + i + 1,
      text,
      isError: start + i === lineIdx,
    }));
  }, [input, errorInfo.line]);

  return (
    <Card className="border-destructive">
      <CardContent className="p-3 space-y-2">
        <p className="text-xs font-medium text-destructive">
          {errorInfo.message}
          {errorInfo.line != null && (
            <span className="ml-2 text-muted-foreground">
              {locationLabel}
            </span>
          )}
        </p>
        {snippet && (
          <pre className="text-xs font-mono bg-muted/50 rounded p-2 overflow-x-auto">
            {snippet.map(({ num, text, isError }) => (
              <div
                key={num}
                className={isError ? 'bg-destructive/15 -mx-2 px-2' : ''}
              >
                <span className="inline-block w-8 text-muted-foreground select-none text-right mr-2">
                  {num}
                </span>
                {text}
              </div>
            ))}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------------------------------------------------------------------
 * Main Component
 * --------------------------------------------------------------------------- */

export default function JsonFormatter({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const { copy, copied, error: clipboardError } = useCopyToClipboard();
  const { preferences, setPreferences } = useToolPreferences('json-formatter', DEFAULT_PREFERENCES);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [errorInfo, setErrorInfo] = useState<JsonErrorInfo | null>(null);
  const [jsonType, setJsonType] = useState<string | null>(null);
  const [outputMeta, setOutputMeta] = useState<{ inputSize: number; outputSize: number } | null>(null);
  const [copiedMinified, setCopiedMinified] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const indent = preferences.indent;

  const processJson = useCallback(
    (raw: string, minify: boolean) => {
      if (!raw.trim()) {
        setOutput('');
        setOutputMeta(null);
        setErrorInfo(null);
        setJsonType(null);
        return;
      }
      if (raw.length > TOOLBOX_LIMITS.jsonChars) {
        setErrorInfo({
          message: t('toolbox.tools.shared.inputTooLarge', {
            limit: TOOLBOX_LIMITS.jsonChars.toLocaleString(),
          }),
        });
        setOutput('');
        setOutputMeta(null);
        setJsonType(null);
        return;
      }

      try {
        const parsed = JSON.parse(raw);
        const prepared = preferences.sortKeys ? sortObjectKeysDeep(parsed) : parsed;
        const space = minify ? 0 : (indent === 'tab' ? '\t' : Number(indent));
        let serialized = JSON.stringify(prepared, null, space);
        if (preferences.escapeUnicode) {
          serialized = convertUnicode(serialized);
        }
        setOutput(serialized);
        setOutputMeta({ inputSize: raw.length, outputSize: serialized.length });
        setJsonType(getJsonType(parsed));
        setErrorInfo(null);
      } catch (e) {
        const info = getJsonErrorDetails(e as Error, raw);
        setErrorInfo(info);
        setOutput('');
        setOutputMeta(null);
        setJsonType(null);
      }
    },
    [indent, preferences.escapeUnicode, preferences.sortKeys, t],
  );

  const handleFormat = useCallback(() => {
    processJson(input, false);
  }, [processJson, input]);

  const handleMinify = useCallback(() => {
    processJson(input, true);
  }, [processJson, input]);

  // Auto-format on input change (debounced 300ms)
  useEffect(() => {
    if (!preferences.autoFormat) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      processJson(input, false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input, preferences.autoFormat, processJson]);

  const handleCopyFormatted = useCallback(async () => {
    if (output) await copy(output);
  }, [copy, output]);

  const handleCopyMinified = useCallback(async () => {
    if (!output) return;
    try {
      const parsed = JSON.parse(output);
      const minified = JSON.stringify(parsed);
      await copy(minified);
      setCopiedMinified(true);
      setTimeout(() => setCopiedMinified(false), 2000);
    } catch {
      // output is always valid JSON when present
    }
  }, [copy, output]);

  const deltaText = useMemo(() => {
    if (!outputMeta || outputMeta.inputSize === 0) return null;
    return formatDelta(outputMeta.inputSize, outputMeta.outputSize);
  }, [outputMeta]);

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Input Section */}
        <ToolSection title={t('toolbox.tools.jsonFormatter.input')}>
          <ToolTextArea
            label={t('toolbox.tools.jsonFormatter.input')}
            value={input}
            onChange={setInput}
            placeholder='{"key": "value"}'
            showPaste
            showClear
            rows={10}
            maxLength={TOOLBOX_LIMITS.jsonChars}
          />
        </ToolSection>

        {/* Error Display */}
        {errorInfo && (
          errorInfo.line != null && errorInfo.column != null ? (
            <ErrorSnippet
              input={input}
              errorInfo={errorInfo}
              locationLabel={t('toolbox.tools.jsonFormatter.errorLocation', {
                line: errorInfo.line,
                column: errorInfo.column,
              })}
            />
          ) : (
            <ToolValidationMessage message={errorInfo.message} />
          )
        )}

        {/* Options */}
        <ToolOptionGroup>
          <div className="flex items-center gap-1.5">
            <Switch
              id="json-auto-format"
              checked={preferences.autoFormat}
              onCheckedChange={(checked) => setPreferences({ autoFormat: checked })}
            />
            <Label htmlFor="json-auto-format" className="text-xs">
              {t('toolbox.tools.jsonFormatter.autoFormat')}
            </Label>
          </div>
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
          <Select value={indent} onValueChange={(value) => setPreferences({ indent: value })}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 {t('toolbox.tools.jsonFormatter.spaces')}</SelectItem>
              <SelectItem value="4">4 {t('toolbox.tools.jsonFormatter.spaces')}</SelectItem>
              <SelectItem value="tab">{t('toolbox.tools.jsonFormatter.tab')}</SelectItem>
            </SelectContent>
          </Select>
        </ToolOptionGroup>

        {/* Action Buttons (hidden when auto-format is on) */}
        {!preferences.autoFormat && (
          <ToolActionRow>
            <Button onClick={handleFormat} size="sm" className="gap-1.5">
              <Maximize2 className="h-3.5 w-3.5" />
              {t('toolbox.tools.jsonFormatter.format')}
            </Button>
            <Button onClick={handleMinify} variant="outline" size="sm" className="gap-1.5">
              <Minimize2 className="h-3.5 w-3.5" />
              {t('toolbox.tools.jsonFormatter.minify')}
            </Button>
          </ToolActionRow>
        )}

        {/* Output Section */}
        <ToolSection
          title={t('toolbox.tools.jsonFormatter.output')}
          headerRight={jsonType && <Badge variant="secondary">{jsonType}</Badge>}
        >
          <ToolTextArea
            label={t('toolbox.tools.jsonFormatter.output')}
            value={output}
            readOnly
            rows={10}
          />

          {output && (
            <ToolActionRow className="mt-3">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopyFormatted}>
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? t('toolbox.actions.copied') : t('toolbox.tools.jsonFormatter.copyFormatted')}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopyMinified}>
                {copiedMinified ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Minimize2 className="h-3.5 w-3.5" />}
                {copiedMinified ? t('toolbox.actions.copied') : t('toolbox.tools.jsonFormatter.copyMinified')}
              </Button>
            </ToolActionRow>
          )}

          {deltaText && (
            <div className="mt-2">
              <Badge variant="outline" className="font-mono text-xs">
                {deltaText}
              </Badge>
            </div>
          )}
        </ToolSection>
        {clipboardError && <ToolValidationMessage message={t('toolbox.actions.copyFailed')} />}
      </div>
    </div>
  );
}
