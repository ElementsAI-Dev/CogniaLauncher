'use client';

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { ToolActionRow, ToolValidationMessage } from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolPreferences } from '@/hooks/use-tool-preferences';
import type { ToolComponentProps } from '@/types/toolbox';

const BASES = [
  { label: 'Binary (2)', base: 2, prefix: '0b' },
  { label: 'Octal (8)', base: 8, prefix: '0o' },
  { label: 'Decimal (10)', base: 10, prefix: '' },
  { label: 'Hexadecimal (16)', base: 16, prefix: '0x' },
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
    const normalizedValue = base === 10 ? rawValue : rawValue.replace(/^0[bxo]/i, '');
    try {
      const num = BigInt(base === 10 ? normalizedValue : `0${'box'[Math.log2(base) - 1] ?? ''}${normalizedValue}`);
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
            {BASES.map(({ label, base, prefix }) => (
              <div key={base} className="space-y-1.5">
                <Label className="text-sm">{label}</Label>
                <Input
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
