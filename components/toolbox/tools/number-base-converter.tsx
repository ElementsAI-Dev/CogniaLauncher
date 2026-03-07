'use client';

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { ToolActionRow, ToolValidationMessage } from '@/components/toolbox/tool-layout';
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

  return (
    <div className={className}>
      <div className="space-y-4">
        <ToolActionRow
          rightSlot={(
            <div className="flex items-center gap-4">
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
            </div>
          )}
        />
        <Card>
          <CardContent className="p-4 space-y-4">
            {BASES.map(({ labelKey, base, prefix }) => (
              <div key={base} className="space-y-1.5">
                <Label htmlFor={`number-base-input-${base}`} className="text-sm">{t(labelKey)}</Label>
                <Input
                  id={`number-base-input-${base}`}
                  value={preferences.showPrefix && values[base] ? `${prefix}${values[base]}` : values[base]}
                  onChange={(e) => handleChange(base, e.target.value)}
                  placeholder="0"
                  className="font-mono"
                />
              </div>
            ))}
          </CardContent>
        </Card>
        {error && <ToolValidationMessage message={error} />}
      </div>
    </div>
  );
}
