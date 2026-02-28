'use client';

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useLocale } from '@/components/providers/locale-provider';
import type { ToolComponentProps } from '@/types/toolbox';

const BASES = [
  { label: 'Binary (2)', base: 2, prefix: '0b' },
  { label: 'Octal (8)', base: 8, prefix: '0o' },
  { label: 'Decimal (10)', base: 10, prefix: '' },
  { label: 'Hexadecimal (16)', base: 16, prefix: '0x' },
] as const;

export default function NumberBaseConverter({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const [values, setValues] = useState<Record<number, string>>({ 2: '', 8: '', 10: '', 16: '' });
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback((base: number, value: string) => {
    if (!value.trim()) {
      setValues({ 2: '', 8: '', 10: '', 16: '' });
      setError(null);
      return;
    }
    try {
      const num = BigInt(base === 10 ? value : `0${'box'[Math.log2(base) - 1] ?? ''}${value}`);
      setValues({
        2: num.toString(2),
        8: num.toString(8),
        10: num.toString(10),
        16: num.toString(16).toUpperCase(),
      });
      setError(null);
    } catch {
      setValues((prev) => ({ ...prev, [base]: value }));
      setError(t('toolbox.tools.numberBaseConverter.invalidNumber'));
    }
  }, [t]);

  return (
    <div className={className}>
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 space-y-4">
            {BASES.map(({ label, base }) => (
              <div key={base} className="space-y-1.5">
                <Label className="text-sm">{label}</Label>
                <Input
                  value={values[base]}
                  onChange={(e) => handleChange(base, e.target.value)}
                  placeholder="0"
                  className="font-mono"
                />
              </div>
            ))}
          </CardContent>
        </Card>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
