'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ToolActionRow,
  ToolValidationMessage,
  ToolSection,
  ToolOptionGroup,
} from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolPreferences } from '@/hooks/use-tool-preferences';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';
import type { ToolComponentProps } from '@/types/toolbox';

const BASES = [
  { labelKey: 'toolbox.tools.numberBaseConverter.baseBinary', base: 2, prefix: '0b' },
  { labelKey: 'toolbox.tools.numberBaseConverter.baseOctal', base: 8, prefix: '0o' },
  { labelKey: 'toolbox.tools.numberBaseConverter.baseDecimal', base: 10, prefix: '' },
  { labelKey: 'toolbox.tools.numberBaseConverter.baseHexadecimal', base: 16, prefix: '0x' },
] as const;

const DEFAULT_PREFERENCES = {
  uppercaseHex: true,
  showPrefix: false,
} as const;

const QUICK_VALUES = [
  { key: 'zero', value: '0' },
  { key: 'maxI32', value: '2147483647' },
  { key: 'maxI64', value: '9223372036854775807' },
  { key: 'byteMask', value: '255' },
] as const;

function groupDigits(value: string, size: number): string {
  const sign = value.startsWith('-') ? '-' : '';
  const body = sign ? value.slice(1) : value;
  const grouped = body.replace(new RegExp(`(.{${size}})`, 'g'), '$1 ').trim();
  return `${sign}${grouped}`;
}

export default function NumberBaseConverter({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const { preferences, setPreferences } = useToolPreferences('number-base-converter', DEFAULT_PREFERENCES);
  const [values, setValues] = useState<Record<number, string>>({ 2: '', 8: '', 10: '', 16: '' });
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback((base: number, value: string) => {
    const rawValue = value.trim();
    if (!rawValue) {
      setValues({ 2: '', 8: '', 10: '', 16: '' });
      setError(null);
      return;
    }

    if (rawValue.length > TOOLBOX_LIMITS.numberBaseChars) {
      setError(
        t('toolbox.tools.shared.inputTooLarge', {
          limit: TOOLBOX_LIMITS.numberBaseChars.toLocaleString(),
        }),
      );
      return;
    }

    const sign = rawValue.startsWith('-') ? '-' : rawValue.startsWith('+') ? '+' : '';
    const unsignedValue = sign ? rawValue.slice(1) : rawValue;
    const normalizedValue = base === 10 ? rawValue : unsignedValue.replace(/^0[bxo]/i, '');
    try {
      const prefixed = base === 10
        ? normalizedValue
        : `${sign}${BASES.find((item) => item.base === base)?.prefix ?? ''}${normalizedValue}`;
      const num = BigInt(prefixed);
      setValues({
        2: num.toString(2),
        8: num.toString(8),
        10: num.toString(10),
        16: preferences.uppercaseHex ? num.toString(16).toUpperCase() : num.toString(16).toLowerCase(),
      });
      setError(null);
    } catch {
      setValues((prev) => ({ ...prev, [base]: normalizedValue }));
      setError(t('toolbox.tools.numberBaseConverter.invalidNumber'));
    }
  }, [preferences.uppercaseHex, t]);

  const applyDecimal = useCallback((decimal: string) => {
    handleChange(10, decimal);
  }, [handleChange]);

  const asciiPreview = (() => {
    if (!values[10]) return null;
    try {
      const n = Number(values[10]);
      if (!Number.isFinite(n) || n < 0 || n > 255) return null;
      const ch = String.fromCharCode(n);
      return /[\x20-\x7e]/.test(ch) ? ch : null;
    } catch {
      return null;
    }
  })();

  const formattedBinary = values[2] ? groupDigits(values[2], 4) : '';
  const formattedDecimal = values[10] ? groupDigits(values[10], 3) : '';
  const formattedHex = values[16] ? groupDigits(values[16], 2) : '';

  return (
    <div className={className}>
      <div className="space-y-4">
        <ToolSection title={t('toolbox.tools.numberBaseConverter.name')} description={t('toolbox.tools.numberBaseConverter.desc')}>
          <ToolOptionGroup>
            <div className="flex items-center gap-2">
              <Switch
                id="number-base-uppercase"
                checked={preferences.uppercaseHex}
                onCheckedChange={(checked) => setPreferences({ uppercaseHex: checked })}
              />
              <Label htmlFor="number-base-uppercase" className="text-xs">{t('toolbox.tools.numberBaseConverter.uppercaseHex')}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="number-base-prefix"
                checked={preferences.showPrefix}
                onCheckedChange={(checked) => setPreferences({ showPrefix: checked })}
              />
              <Label htmlFor="number-base-prefix" className="text-xs">{t('toolbox.tools.numberBaseConverter.showPrefix')}</Label>
            </div>
          </ToolOptionGroup>

          <ToolActionRow className="mt-3">
            {QUICK_VALUES.map((item) => (
              <Button
                key={item.key}
                size="sm"
                variant="outline"
                onClick={() => applyDecimal(item.value)}
              >
                {t(`toolbox.tools.numberBaseConverter.quick.${item.key}`)}
              </Button>
            ))}
          </ToolActionRow>
        </ToolSection>

        <ToolSection title={t('toolbox.tools.numberBaseConverter.values')}>
          <Card>
            <CardContent className="p-4 space-y-4">
              {BASES.map(({ labelKey, base, prefix }) => (
                <div key={base} className="space-y-1.5">
                  <Label htmlFor={`number-base-input-${base}`} className="text-sm">{t(labelKey)}</Label>
                  <Input
                    id={`number-base-input-${base}`}
                    value={preferences.showPrefix && values[base] ? `${prefix}${values[base]}` : values[base]}
                    onChange={(e) => handleChange(base, e.target.value)}
                    placeholder={t('toolbox.tools.numberBaseConverter.quick.zero')}
                    className="font-mono"
                    maxLength={TOOLBOX_LIMITS.numberBaseChars}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </ToolSection>

        <ToolSection title={t('toolbox.tools.numberBaseConverter.visualization')}>
          <div className="space-y-2 text-xs">
            <div className="rounded border p-2 font-mono">
              <p className="text-muted-foreground mb-1">
                {t('toolbox.tools.numberBaseConverter.visualizationBinary')}
              </p>
              <p className="break-all">{formattedBinary || '-'}</p>
            </div>
            <div className="rounded border p-2 font-mono">
              <p className="text-muted-foreground mb-1">
                {t('toolbox.tools.numberBaseConverter.visualizationDecimal')}
              </p>
              <p className="break-all">{formattedDecimal || '-'}</p>
            </div>
            <div className="rounded border p-2 font-mono">
              <p className="text-muted-foreground mb-1">
                {t('toolbox.tools.numberBaseConverter.visualizationHex')}
              </p>
              <p className="break-all">{formattedHex || '-'}</p>
            </div>
            {asciiPreview && (
              <Badge variant="secondary" className="mt-1">
                {t('toolbox.tools.numberBaseConverter.asciiPreview', { value: asciiPreview })}
              </Badge>
            )}
          </div>
        </ToolSection>
        {error && <ToolValidationMessage message={error} />}
      </div>
    </div>
  );
}
