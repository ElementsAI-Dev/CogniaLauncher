'use client';

import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/components/providers/locale-provider';
import { cn } from '@/lib/utils';
import { Copy, ClipboardPaste, Trash2, Check } from 'lucide-react';
import { useState, useCallback } from 'react';

interface ToolTextAreaProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  rows?: number;
  className?: string;
  language?: string;
  showCopy?: boolean;
  showPaste?: boolean;
  showClear?: boolean;
}

export function ToolTextArea({
  label,
  value,
  onChange,
  readOnly = false,
  placeholder,
  rows = 8,
  className,
  showCopy = true,
  showPaste = false,
  showClear = false,
}: ToolTextAreaProps) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [value]);

  const handlePaste = useCallback(async () => {
    const text = await navigator.clipboard.readText();
    onChange?.(text);
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange?.('');
  }, [onChange]);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex items-center gap-1">
          {showPaste && !readOnly && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs px-2" onClick={handlePaste}>
              <ClipboardPaste className="h-3 w-3" />
              {t('toolbox.actions.paste')}
            </Button>
          )}
          {showClear && !readOnly && value && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs px-2" onClick={handleClear}>
              <Trash2 className="h-3 w-3" />
              {t('toolbox.actions.clear')}
            </Button>
          )}
          {showCopy && value && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs px-2" onClick={handleCopy}>
              {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              {copied ? t('toolbox.actions.copied') : t('toolbox.actions.copy')}
            </Button>
          )}
        </div>
      </div>
      <Textarea
        value={value}
        onChange={readOnly ? undefined : (e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        rows={rows}
        className={cn('font-mono text-sm resize-none', readOnly && 'bg-muted/50')}
      />
    </div>
  );
}
