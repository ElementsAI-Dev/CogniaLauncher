'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useCopyToClipboard } from '@/hooks/use-clipboard';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolPreferences } from '@/hooks/use-tool-preferences';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';
import { fillRandomValues } from '@/lib/toolbox/browser-api';
import {
  ToolTextArea,
  ToolActionRow,
  ToolValidationMessage,
  ToolSection,
  ToolOptionGroup,
} from '@/components/toolbox/tool-layout';
import { RefreshCw, Copy, Check, Shield, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import type { ToolComponentProps } from '@/types/toolbox';

// ── Character sets ──────────────────────────────────────────────────────────

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SPECIAL = '!@#$%^&*()_+-=[]{}|;:,.<>?';
const SIMILAR = 'iIlL1oO0';

// ── Word list for passphrase mode ───────────────────────────────────────────

const WORD_LIST = [
  'apple','banana','cherry','delta','eagle','falcon','garden','harbor','island','jungle',
  'karma','lemon','mango','noble','ocean','piano','quest','river','solar','tiger',
  'ultra','vivid','walrus','xenon','yacht','zebra','anchor','bridge','castle','drift',
  'ember','flame','globe','haven','ivory','jewel','knight','lunar','marble','nectar',
  'orbit','pulse','quartz','royal','storm','torch','unity','vapor','wander','apex',
  'blaze','coral','dawn','echo','frost','grace','haze','iris','jade','kite',
  'lotus','mist','nova','oasis','prism','ridge','silk','terra','umbra','vortex',
  'wisp','zephyr','arrow','bloom','cliff','dune','fern','glow','hawk','inlet',
  'jasper','kelp','lynx','mesa','nest','onyx','pearl','quill','reed','sage',
  'thorn','unity','vale','wave','birch','cedar','drizzle','elm','fable','granite',
  'holly','icicle','juniper','kettle','lantern','maple','nutmeg','olive','pepper','robin',
  'sable','tulip','umber','violet','willow',
] as const;

const SEPARATORS = ['-', '.', ' ', '_'] as const;

// ── Password generation ─────────────────────────────────────────────────────

function buildCharset(upper: boolean, lower: boolean, digits: boolean, special: boolean, excludeSimilar: boolean): string {
  let chars = '';
  if (upper) chars += UPPER;
  if (lower) chars += LOWER;
  if (digits) chars += DIGITS;
  if (special) chars += SPECIAL;
  if (!chars) chars = LOWER + DIGITS;
  if (excludeSimilar) {
    chars = chars.split('').filter((c) => !SIMILAR.includes(c)).join('');
  }
  return chars;
}

function generatePassword(length: number, charset: string): string | null {
  const arr = new Uint32Array(length);
  if (!fillRandomValues(arr)) return null;
  return Array.from(arr, (v) => charset[v % charset.length]).join('');
}

function generatePassphrase(wordCount: number, separator: string, capitalize: boolean): string | null {
  const arr = new Uint32Array(wordCount);
  if (!fillRandomValues(arr)) return null;
  return Array.from(arr, (v) => {
    const word = WORD_LIST[v % WORD_LIST.length];
    return capitalize ? word.charAt(0).toUpperCase() + word.slice(1) : word;
  }).join(separator);
}

// ── Entropy & strength ──────────────────────────────────────────────────────

function calcEntropy(charsetSize: number, length: number): number {
  if (charsetSize <= 1) return 0;
  return Math.floor(length * Math.log2(charsetSize));
}

function calcPassphraseEntropy(wordCount: number): number {
  return Math.floor(wordCount * Math.log2(WORD_LIST.length));
}

type StrengthLevel = 'weak' | 'fair' | 'good' | 'strong' | 'veryStrong';

function getStrengthFromEntropy(entropy: number): { level: StrengthLevel; percent: number } {
  if (entropy <= 20) return { level: 'weak', percent: Math.min(20, Math.max(5, entropy)) };
  if (entropy <= 40) return { level: 'fair', percent: 20 + ((entropy - 20) / 20) * 20 };
  if (entropy <= 60) return { level: 'good', percent: 40 + ((entropy - 40) / 20) * 20 };
  if (entropy <= 80) return { level: 'strong', percent: 60 + ((entropy - 60) / 20) * 20 };
  return { level: 'veryStrong', percent: Math.min(100, 80 + ((entropy - 80) / 40) * 20) };
}

const STRENGTH_COLORS: Record<StrengthLevel, string> = {
  weak: 'bg-red-500',
  fair: 'bg-orange-500',
  good: 'bg-yellow-500',
  strong: 'bg-green-500',
  veryStrong: 'bg-green-600',
};

// ── Preferences ─────────────────────────────────────────────────────────────

const DEFAULT_PREFERENCES = {
  mode: 'password' as 'password' | 'passphrase',
  length: 16,
  count: 1,
  upper: true,
  lower: true,
  digits: true,
  special: true,
  excludeSimilar: false,
  wordCount: 4,
  separator: '-',
  capitalizeWords: true,
} as const;

// ── Component ───────────────────────────────────────────────────────────────

export default function PasswordGenerator({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const { preferences, setPreferences } = useToolPreferences('password-generator', DEFAULT_PREFERENCES);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [batchOutput, setBatchOutput] = useState('');
  const [showPassword, setShowPassword] = useState(true);
  const { copied, copy, error: clipboardError } = useCopyToClipboard();

  const length = Number(preferences.length) || 16;
  const count = Number(preferences.count) || 1;
  const wordCount = Number(preferences.wordCount) || 4;
  const mode = preferences.mode || 'password';
  const separator = preferences.separator ?? '-';
  const capitalizeWords = preferences.capitalizeWords ?? true;

  const charset = useMemo(
    () => buildCharset(preferences.upper, preferences.lower, preferences.digits, preferences.special, preferences.excludeSimilar),
    [preferences.upper, preferences.lower, preferences.digits, preferences.special, preferences.excludeSimilar],
  );

  const generateOne = useCallback((): string | null => {
    if (mode === 'passphrase') {
      return generatePassphrase(wordCount, separator, capitalizeWords);
    }
    return generatePassword(length, charset);
  }, [mode, length, charset, wordCount, separator, capitalizeWords]);

  const handleGenerate = useCallback(() => {
    const nextPassword = generateOne();
    if (!nextPassword) {
      setError(t('toolbox.tools.passwordGenerator.cryptoUnavailable'));
      return;
    }
    setError(null);
    setPassword(nextPassword);
  }, [generateOne, t]);

  const handleBatchGenerate = useCallback(() => {
    if (count > TOOLBOX_LIMITS.generatorCount) {
      setError(t('toolbox.tools.shared.countTooLarge', { limit: TOOLBOX_LIMITS.generatorCount }));
      return;
    }
    const results = Array.from({ length: count }, () => generateOne());
    if (results.some((value) => value === null)) {
      setError(t('toolbox.tools.passwordGenerator.cryptoUnavailable'));
      return;
    }
    setError(null);
    setBatchOutput((results as string[]).join('\n'));
  }, [count, generateOne, t]);

  // Auto-generate on mount
  useEffect(() => {
    const nextPassword = generateOne();
    if (!nextPassword) {
      setError(t('toolbox.tools.passwordGenerator.cryptoUnavailable'));
      return;
    }
    setPassword(nextPassword);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Entropy / strength calculation ──────────────────────────────────────

  const entropy = useMemo(() => {
    if (mode === 'passphrase') return calcPassphraseEntropy(wordCount);
    return calcEntropy(charset.length, length);
  }, [mode, charset.length, length, wordCount]);

  const strength = useMemo(() => getStrengthFromEntropy(entropy), [entropy]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* ── Mode toggle ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <Button
            variant={mode === 'password' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setPreferences({ mode: 'password' });
              setPassword('');
              setTimeout(() => {
                const nextPassword = generatePassword(length, charset);
                if (!nextPassword) {
                  setError(t('toolbox.tools.passwordGenerator.cryptoUnavailable'));
                  return;
                }
                setError(null);
                setPassword(nextPassword);
              }, 0);
            }}
          >
            <Shield className="mr-1.5 h-3.5 w-3.5" />
            {t('toolbox.tools.passwordGenerator.modePassword')}
          </Button>
          <Button
            variant={mode === 'passphrase' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setPreferences({ mode: 'passphrase' });
              setPassword('');
              setTimeout(() => {
                const nextPassword = generatePassphrase(wordCount, separator, capitalizeWords);
                if (!nextPassword) {
                  setError(t('toolbox.tools.passwordGenerator.cryptoUnavailable'));
                  return;
                }
                setError(null);
                setPassword(nextPassword);
              }, 0);
            }}
          >
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            {t('toolbox.tools.passwordGenerator.modePassphrase')}
          </Button>
        </div>

        {/* ── Hero: Generated Password ─────────────────────────────────── */}
        <ToolSection title={t('toolbox.tools.passwordGenerator.generated')}>
          <div className="space-y-3">
            <div
              className="relative cursor-pointer rounded-lg bg-muted p-4 transition-colors hover:bg-muted/80"
              onClick={() => copy(password)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') copy(password); }}
            >
              <div className="pr-24 text-lg font-mono tracking-wide break-all md:text-2xl">
                {password ? (
                  showPassword ? (
                    password.split('').map((ch, i) => {
                      const cls = /[0-9]/.test(ch)
                        ? 'text-blue-500'
                        : /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(ch)
                          ? 'text-orange-500'
                          : /[A-Z]/.test(ch)
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : '';
                      return <span key={i} className={cls}>{ch}</span>;
                    })
                  ) : (
                    <span className="text-muted-foreground select-none">{'•'.repeat(Math.min(password.length, 40))}</span>
                  )
                ) : (
                  <span className="text-muted-foreground italic">—</span>
                )}
              </div>
              <div className="absolute right-3 top-3 flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => { e.stopPropagation(); setShowPassword(!showPassword); }}
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <ToolActionRow>
              <Button onClick={handleGenerate} size="sm" className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                {t('toolbox.tools.passwordGenerator.generate')}
              </Button>
              <Button
                onClick={() => copy(password)}
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={!password}
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? t('toolbox.actions.copied') : t('toolbox.actions.copy')}
              </Button>
            </ToolActionRow>

            {/* Strength meter */}
            {password && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    {t(`toolbox.tools.passwordGenerator.strength${strength.level.charAt(0).toUpperCase()}${strength.level.slice(1)}`)}
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                      ~{entropy} bits
                    </Badge>
                  </span>
                  <span className="text-muted-foreground">{Math.round(strength.percent)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${STRENGTH_COLORS[strength.level]}`}
                    style={{ width: `${strength.percent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </ToolSection>

        {/* ── Options ──────────────────────────────────────────────────── */}
        <ToolSection title={t('toolbox.tools.passwordGenerator.options')}>
          <div className="space-y-4">
            {mode === 'password' ? (
              <>
                {/* Length slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t('toolbox.tools.passwordGenerator.length')}</Label>
                    <Badge variant="outline" className="font-mono tabular-nums">{length}</Badge>
                  </div>
                  <Slider value={[length]} onValueChange={([v]) => setPreferences({ length: v })} min={4} max={128} step={1} />
                </div>

                <Separator />

                {/* Character set toggles */}
                <ToolOptionGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {([
                    ['upper', preferences.upper, 'A-Z'],
                    ['lower', preferences.lower, 'a-z'],
                    ['digits', preferences.digits, '0-9'],
                    ['special', preferences.special, '!@#'],
                  ] as const).map(([key, value, hint]) => (
                    <div key={key} className="flex items-center gap-2">
                      <Switch
                        id={`pw-${key}`}
                        checked={value}
                        onCheckedChange={(checked) => setPreferences({ [key]: checked })}
                      />
                      <Label htmlFor={`pw-${key}`} className="text-sm">
                        {t(`toolbox.tools.passwordGenerator.${key}`)}
                        {' '}<span className="text-muted-foreground">({hint})</span>
                      </Label>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <Switch
                      id="pw-excludeSimilar"
                      checked={preferences.excludeSimilar}
                      onCheckedChange={(checked) => setPreferences({ excludeSimilar: checked })}
                    />
                    <Label htmlFor="pw-excludeSimilar" className="text-sm">
                      {t('toolbox.tools.passwordGenerator.excludeSimilar')}
                    </Label>
                  </div>
                </ToolOptionGroup>
              </>
            ) : (
              <>
                {/* Passphrase options */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t('toolbox.tools.passwordGenerator.wordCount')}</Label>
                    <Badge variant="outline" className="font-mono tabular-nums">{wordCount}</Badge>
                  </div>
                  <Slider value={[wordCount]} onValueChange={([v]) => setPreferences({ wordCount: v })} min={3} max={8} step={1} />
                </div>

                <Separator />

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">{t('toolbox.tools.passwordGenerator.separator')}</Label>
                    <div className="flex gap-1">
                      {SEPARATORS.map((sep) => (
                        <Button
                          key={sep}
                          variant={separator === sep ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 w-8 font-mono text-xs"
                          onClick={() => setPreferences({ separator: sep })}
                        >
                          {sep === ' ' ? '␣' : sep}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      id="pw-capitalize"
                      checked={capitalizeWords}
                      onCheckedChange={(checked) => setPreferences({ capitalizeWords: checked })}
                    />
                    <Label htmlFor="pw-capitalize" className="text-sm">
                      {t('toolbox.tools.passwordGenerator.capitalize')}
                    </Label>
                  </div>
                </div>
              </>
            )}
          </div>
        </ToolSection>

        {/* ── Batch Generate ───────────────────────────────────────────── */}
        <ToolSection title={t('toolbox.tools.passwordGenerator.batch')}>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Label htmlFor="pw-count" className="text-sm shrink-0">
                {t('toolbox.tools.passwordGenerator.count')}
              </Label>
              <Input
                id="pw-count"
                type="number"
                min={1}
                max={TOOLBOX_LIMITS.generatorCount}
                value={count}
                onChange={(e) => setPreferences({ count: Math.max(1, Math.min(TOOLBOX_LIMITS.generatorCount, Number(e.target.value) || 1)) })}
                className="h-8 w-24 font-mono"
              />
              <Button onClick={handleBatchGenerate} size="sm" className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                {t('toolbox.tools.passwordGenerator.generateAll')}
              </Button>
            </div>

            {error && <ToolValidationMessage message={error} />}

            {batchOutput && (
              <ToolTextArea
                label={t('toolbox.tools.passwordGenerator.batchOutput')}
                value={batchOutput}
                readOnly
                rows={Math.min(10, Math.max(3, count))}
                showCopy
              />
            )}
            {clipboardError && <ToolValidationMessage message={t('toolbox.actions.copyFailed')} />}
          </div>
        </ToolSection>
      </div>
    </div>
  );
}
