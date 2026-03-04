'use client';

import { useState, useCallback } from 'react';
import { useCopyToClipboard } from '@/hooks/use-clipboard';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolPreferences } from '@/hooks/use-tool-preferences';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';
import { ToolValidationMessage } from '@/components/toolbox/tool-layout';
import { RefreshCw, Copy, Check } from 'lucide-react';
import type { ToolComponentProps } from '@/types/toolbox';

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SPECIAL = '!@#$%^&*()_+-=[]{}|;:,.<>?';
const SIMILAR = 'iIlL1oO0';

function generatePassword(length: number, upper: boolean, lower: boolean, digits: boolean, special: boolean, excludeSimilar: boolean): string {
  let chars = '';
  if (upper) chars += UPPER;
  if (lower) chars += LOWER;
  if (digits) chars += DIGITS;
  if (special) chars += SPECIAL;
  if (!chars) chars = LOWER + DIGITS;
  if (excludeSimilar) {
    chars = chars.split('').filter((c) => !SIMILAR.includes(c)).join('');
  }
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (v) => chars[v % chars.length]).join('');
}

function getStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;
  if (/[a-z]/.test(password)) score += 15;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 15;
  return Math.min(100, score);
}

const DEFAULT_PREFERENCES = {
  length: 16,
  count: 1,
  upper: true,
  lower: true,
  digits: true,
  special: true,
  excludeSimilar: false,
} as const;

export default function PasswordGenerator({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const { preferences, setPreferences } = useToolPreferences('password-generator', DEFAULT_PREFERENCES);
  const [error, setError] = useState<string | null>(null);
  const [passwords, setPasswords] = useState<string[]>([]);
  const { copied, copy } = useCopyToClipboard();

  const length = Number(preferences.length) || 16;
  const count = Number(preferences.count) || 1;

  const handleGenerate = useCallback(() => {
    if (count > TOOLBOX_LIMITS.generatorCount) {
      setError(t('toolbox.tools.shared.countTooLarge', { limit: TOOLBOX_LIMITS.generatorCount }));
      return;
    }
    const results = Array.from({ length: count }, () =>
      generatePassword(
        length,
        preferences.upper,
        preferences.lower,
        preferences.digits,
        preferences.special,
        preferences.excludeSimilar,
      ),
    );
    setError(null);
    setPasswords(results);
  }, [count, length, preferences.digits, preferences.excludeSimilar, preferences.lower, preferences.special, preferences.upper, t]);

  const handleCopy = useCallback(async () => {
    await copy(passwords.join('\n'));
  }, [copy, passwords]);

  const strength = passwords[0] ? getStrength(passwords[0]) : 0;
  const strengthColor = strength < 40 ? 'bg-red-500' : strength < 70 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className={className}>
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>{t('toolbox.tools.passwordGenerator.length')}: {length}</Label>
            <div className="flex items-center gap-2">
              <Label htmlFor="password-count" className="text-xs">{t('toolbox.tools.passwordGenerator.count')}</Label>
              <Input
                id="password-count"
                type="number"
                min={1}
                max={TOOLBOX_LIMITS.generatorCount}
                value={count}
                onChange={(e) => setPreferences({ count: Math.max(1, Number(e.target.value) || 1) })}
                className="h-7 w-20"
              />
            </div>
          </div>
          <Slider value={[length]} onValueChange={([v]) => setPreferences({ length: v })} min={4} max={128} step={1} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {([
            ['upper', preferences.upper, 'A-Z'],
            ['lower', preferences.lower, 'a-z'],
            ['digits', preferences.digits, '0-9'],
            ['special', preferences.special, '!@#'],
          ] as const).map(([key, value, hint]) => (
            <div key={key} className="flex items-center gap-2">
              <Switch checked={value} onCheckedChange={(checked) => setPreferences({ [key]: checked })} />
              <Label className="text-sm">{t(`toolbox.tools.passwordGenerator.${key}`)} <span className="text-muted-foreground">({hint})</span></Label>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Switch checked={preferences.excludeSimilar} onCheckedChange={(checked) => setPreferences({ excludeSimilar: checked })} />
            <Label className="text-sm">{t('toolbox.tools.passwordGenerator.excludeSimilar')}</Label>
          </div>
        </div>

        {error && <ToolValidationMessage message={error} />}

        <div className="flex items-center gap-2">
          <Button onClick={handleGenerate} size="sm" className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            {t('toolbox.tools.passwordGenerator.generate')}
          </Button>
          {passwords.length > 0 && (
            <Button onClick={handleCopy} variant="outline" size="sm" className="gap-1.5">
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t('toolbox.actions.copied') : t('toolbox.actions.copy')}
            </Button>
          )}
        </div>

        {passwords.length > 0 && (
          <>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span>{t('toolbox.tools.passwordGenerator.strength')}</span>
                <span>{strength}%</span>
              </div>
              <Progress value={strength} className={`h-2 [&>div]:${strengthColor}`} />
            </div>
            <Textarea
              value={passwords.join('\n')}
              readOnly
              rows={Math.min(8, Math.max(2, passwords.length))}
              className="font-mono text-sm resize-none bg-muted/50"
            />
          </>
        )}
      </div>
    </div>
  );
}
