'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ToolTextArea } from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { AlertCircle, Minimize2, Maximize2 } from 'lucide-react';
import type { ToolComponentProps } from '@/types/toolbox';

export default function JsonFormatter({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [indent, setIndent] = useState('2');
  const [error, setError] = useState<string | null>(null);

  const handleFormat = useCallback(() => {
    if (!input.trim()) { setOutput(''); setError(null); return; }
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed, null, Number(indent)));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setOutput('');
    }
  }, [input, indent]);

  const handleMinify = useCallback(() => {
    if (!input.trim()) { setOutput(''); setError(null); return; }
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setOutput('');
    }
  }, [input]);

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

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={handleFormat} size="sm" className="gap-1.5">
            <Maximize2 className="h-3.5 w-3.5" />
            {t('toolbox.tools.jsonFormatter.format')}
          </Button>
          <Button onClick={handleMinify} variant="outline" size="sm" className="gap-1.5">
            <Minimize2 className="h-3.5 w-3.5" />
            {t('toolbox.tools.jsonFormatter.minify')}
          </Button>
          <Select value={indent} onValueChange={setIndent}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 {t('toolbox.tools.jsonFormatter.spaces')}</SelectItem>
              <SelectItem value="4">4 {t('toolbox.tools.jsonFormatter.spaces')}</SelectItem>
              <SelectItem value="1">{t('toolbox.tools.jsonFormatter.tab')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ToolTextArea
          label={t('toolbox.tools.jsonFormatter.output')}
          value={output}
          readOnly
          rows={10}
        />
      </div>
    </div>
  );
}
