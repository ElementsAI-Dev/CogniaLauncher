'use client';

import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocale } from '@/components/providers/locale-provider';
import { cn } from '@/lib/utils';
import { Copy, ClipboardPaste, Trash2, Check, AlertCircle, Info } from 'lucide-react';
import { useCallback } from 'react';
import { useCopyToClipboard } from '@/hooks/use-clipboard';
import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * ToolTextArea
 * --------------------------------------------------------------------------- */

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
  maxLength?: number;
  footer?: ReactNode;
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
  maxLength,
  footer,
}: ToolTextAreaProps) {
  const { t } = useLocale();
  const { copied, copy, paste } = useCopyToClipboard();

  const handleCopy = useCallback(async () => {
    await copy(value);
  }, [copy, value]);

  const handlePaste = useCallback(async () => {
    const text = await paste();
    onChange?.(text);
  }, [paste, onChange]);

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
        maxLength={maxLength}
      />
      {(maxLength != null || footer) && (
        <div className="flex items-center justify-between">
          <div className="flex-1">{footer}</div>
          {maxLength != null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {value.length.toLocaleString()} / {maxLength.toLocaleString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * ToolActionRow
 * --------------------------------------------------------------------------- */

interface ToolActionRowProps {
  children?: ReactNode;
  className?: string;
  rightSlot?: ReactNode;
}

export function ToolActionRow({ children, className, rightSlot }: ToolActionRowProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {rightSlot ? <div className="ml-auto">{rightSlot}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * ToolValidationMessage
 * --------------------------------------------------------------------------- */

interface ToolValidationMessageProps {
  message: string;
  tone?: 'error' | 'info';
  className?: string;
}

export function ToolValidationMessage({ message, tone = 'error', className }: ToolValidationMessageProps) {
  const isError = tone === 'error';
  return (
    <Alert variant={isError ? 'destructive' : 'default'} className={className}>
      {isError ? <AlertCircle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
      <AlertDescription className="font-mono text-xs">{message}</AlertDescription>
    </Alert>
  );
}

/* ---------------------------------------------------------------------------
 * ToolSection
 * --------------------------------------------------------------------------- */

interface ToolSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  headerRight?: ReactNode;
  noPadding?: boolean;
}

export function ToolSection({
  title,
  description,
  children,
  className,
  headerRight,
  noPadding = false,
}: ToolSectionProps) {
  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              {description && (
                <CardDescription className="text-xs">{description}</CardDescription>
              )}
            </div>
            {headerRight && <div className="ml-auto pl-4">{headerRight}</div>}
          </div>
        </CardHeader>
      )}
      <CardContent className={cn(noPadding && 'p-0')}>{children}</CardContent>
    </Card>
  );
}

/* ---------------------------------------------------------------------------
 * ToolOptionGroup
 * --------------------------------------------------------------------------- */

interface ToolOptionGroupProps {
  children: ReactNode;
  className?: string;
}

export function ToolOptionGroup({ children, className }: ToolOptionGroupProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', className)}>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * ToolOutputBlock
 * --------------------------------------------------------------------------- */

interface ToolOutputBlockProps {
  label?: string;
  value: string;
  className?: string;
  breakAll?: boolean;
}

export function ToolOutputBlock({ label, value, className, breakAll = false }: ToolOutputBlockProps) {
  const { t } = useLocale();
  const { copied, copy } = useCopyToClipboard();

  const handleCopy = useCallback(async () => {
    await copy(value);
  }, [copy, value]);

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <Label className="text-sm font-medium">{label}</Label>}
      <div className="relative">
        <pre
          className={cn(
            'rounded-md border bg-muted/50 p-3 font-mono text-sm whitespace-pre-wrap',
            breakAll && 'break-all',
          )}
        >
          {value}
        </pre>
        {value && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1.5 right-1.5 h-7 w-7"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span className="sr-only">{t('toolbox.actions.copy')}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
