'use client';

import { useState, useMemo, useCallback } from 'react';
import { useCopyToClipboard } from '@/hooks/shared/use-clipboard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ToolOptionGroup, ToolSection, ToolValidationMessage } from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolPreferences } from '@/hooks/toolbox/use-tool-preferences';
import { Copy, Check, Palette, Pipette } from 'lucide-react';
import type { ToolComponentProps } from '@/types/toolbox';

/* -------------------------------------------------------------------------- */
/*  Color conversion helpers                                                   */
/* -------------------------------------------------------------------------- */

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function rgbToOklch(r: number, g: number, b: number): { L: number; C: number; H: number } {
  const lr = srgbToLinear(r / 255), lg = srgbToLinear(g / 255), lb = srgbToLinear(b / 255);
  const l_ = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m_ = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s_ = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l = Math.cbrt(l_), m = Math.cbrt(m_), s = Math.cbrt(s_);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const b2 = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  const C = Math.sqrt(a * a + b2 * b2);
  const H = (Math.atan2(b2, a) * 180 / Math.PI + 360) % 360;
  return {
    L: Math.round(L * 100 * 100) / 100,
    C: Math.round(C * 100) / 100,
    H: Math.round(H * 10) / 10,
  };
}

function getContrastRatio(hex: string): { white: number; black: number } | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const lum = [rgb.r, rgb.g, rgb.b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  const l = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
  const white = 1.05 / (l + 0.05);
  const black = (l + 0.05) / 0.05;
  return { white, black };
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#000000', '#374151', '#6b7280', '#9ca3af', '#d1d5db', '#f3f4f6', '#ffffff',
];

const PREFERRED_FORMATS = ['hex', 'rgb', 'hsl', 'oklch'] as const;
type PreferredFormat = (typeof PREFERRED_FORMATS)[number];

const FORMAT_LABEL_KEYS: Record<PreferredFormat, string> = {
  hex: 'toolbox.tools.colorPicker.formatHex',
  rgb: 'toolbox.tools.colorPicker.formatRgb',
  hsl: 'toolbox.tools.colorPicker.formatHsl',
  oklch: 'toolbox.tools.colorPicker.formatOklch',
};

const DEFAULT_PREFERENCES = {
  hex: '#3b82f6',
  preferredFormat: 'hex',
} as const;

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function FormatRow({
  label,
  value,
  copiedKey,
  onCopy,
  formatKey,
}: {
  label: string;
  value: string;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
  formatKey: string;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs font-medium text-muted-foreground w-16 shrink-0">{label}</span>
      <code className="flex-1 text-sm font-mono truncate">{value}</code>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => onCopy(value, formatKey)}
      >
        {copiedKey === formatKey ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

function WcagBadge({ pass, label }: { pass: boolean; label: string }) {
  return (
    <Badge variant={pass ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
      {label}
    </Badge>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main component                                                             */
/* -------------------------------------------------------------------------- */

export default function ColorPicker({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const { preferences, setPreferences } = useToolPreferences('color-picker', DEFAULT_PREFERENCES);
  const [hex, setHex] = useState(preferences.hex);
  const { copy, error: clipboardError } = useCopyToClipboard();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const preferredFormat = preferences.preferredFormat as PreferredFormat;

  const rgb = hexToRgb(hex);
  const hsl = rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null;
  const oklch = rgb ? rgbToOklch(rgb.r, rgb.g, rgb.b) : null;
  const contrast = getContrastRatio(hex);
  const validHex = hex.length === 7 && !!rgb;
  const hasError = hex.length > 0 && !rgb && !/^#[a-fA-F\d]{0,5}$/.test(hex);

  const handleColorInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setHex(e.target.value);
    setPreferences({ hex: e.target.value });
  }, [setPreferences]);

  const handleHexInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (!val.startsWith('#')) val = '#' + val;
    setHex(val);
    if (/^#[a-fA-F\d]{6}$/.test(val)) setPreferences({ hex: val });
  }, [setPreferences]);

  const handleRgbChange = useCallback((channel: 'r' | 'g' | 'b', value: string) => {
    if (!rgb) return;
    const n = Math.max(0, Math.min(255, Number(value) || 0));
    const newRgb = { ...rgb, [channel]: n };
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    setHex(newHex);
    setPreferences({ hex: newHex });
  }, [rgb, setPreferences]);

  const handlePaletteClick = useCallback((color: string) => {
    setHex(color);
    setPreferences({ hex: color });
  }, [setPreferences]);

  const handleCopy = useCallback(async (text: string, key: string) => {
    await copy(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }, [copy]);

  const formats = useMemo(() => {
    const entries = [
      { key: 'hex', label: t('toolbox.tools.colorPicker.formatHex'), value: validHex ? hex.toUpperCase() : '-' },
      { key: 'rgb', label: t('toolbox.tools.colorPicker.formatRgb'), value: rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : '-' },
      { key: 'hsl', label: t('toolbox.tools.colorPicker.formatHsl'), value: hsl ? `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` : '-' },
      { key: 'oklch', label: t('toolbox.tools.colorPicker.formatOklch'), value: oklch ? `oklch(${oklch.L}% ${oklch.C} ${oklch.H})` : '-' },
      { key: 'css-var', label: t('toolbox.tools.colorPicker.formatCssVariable'), value: validHex ? 'var(--color-primary)' : '-' },
    ];

    return [...entries].sort((left, right) => {
      if (left.key === preferredFormat) return -1;
      if (right.key === preferredFormat) return 1;
      return 0;
    });
  }, [hex, hsl, oklch, preferredFormat, rgb, t, validHex]);

  const preferredFormatValue = formats.find((entry) => entry.key === preferredFormat)?.value ?? '-';

  const bgColor = validHex ? hex : '#000000';

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* ── Color Input ─────────────────────────────────── */}
        <ToolSection title={t('toolbox.tools.colorPicker.pickColor')}>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Pipette className="h-3 w-3" />
                  {t('toolbox.tools.colorPicker.pickColor')}
                </Label>
                <input
                  type="color"
                  value={validHex ? hex : '#000000'}
                  onChange={handleColorInput}
                  className="h-20 w-20 cursor-pointer rounded-lg border"
                />
              </div>
              <div className="flex-1 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t('toolbox.tools.colorPicker.formatHex')}</Label>
                  <Input value={hex} onChange={handleHexInput} className="font-mono" placeholder="#3b82f6" />
                </div>
                {rgb && (
                  <div className="grid grid-cols-3 gap-2">
                    {(['r', 'g', 'b'] as const).map((ch) => (
                      <div key={ch} className="space-y-1">
                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase">{ch}</Label>
                        <Input
                          type="number"
                          min={0}
                          max={255}
                          value={rgb[ch]}
                          onChange={(e) => handleRgbChange(ch, e.target.value)}
                          className="font-mono text-sm h-8"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {hasError && <ToolValidationMessage message={t('toolbox.tools.colorPicker.invalidHex')} />}

            {/* Palette presets */}
            <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Palette className="h-3 w-3" />
                  {t('toolbox.tools.colorPicker.presets')}
                </Label>
              <div className="flex flex-wrap gap-1.5">
                {PALETTE.map((color) => (
                  <Tooltip key={color}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="h-6 w-6 rounded-full border border-border/50 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        style={{ backgroundColor: color }}
                        onClick={() => handlePaletteClick(color)}
                        aria-label={color}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs font-mono">
                      {color.toUpperCase()}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>
        </ToolSection>

        {/* ── Color Preview ───────────────────────────────── */}
        <ToolSection title={t('toolbox.tools.colorPicker.previewTitle')}>
          <div
            className="relative h-24 rounded-lg border overflow-hidden"
            style={{ backgroundColor: bgColor }}
          >
            <div className="absolute inset-0 flex items-center justify-center gap-6">
              <span className="text-2xl font-bold text-white drop-shadow-md select-none">Aa</span>
              <span className="text-2xl font-bold text-black drop-shadow-md select-none">Aa</span>
            </div>
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs font-mono px-2 py-0.5 rounded bg-black/30 text-white select-none backdrop-blur-sm">
              {validHex ? hex.toUpperCase() : '---'}
            </span>
          </div>
        </ToolSection>

        {/* ── Color Formats ───────────────────────────────── */}
        <ToolSection
          title={t('toolbox.tools.colorPicker.formatsTitle')}
          headerRight={
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => handleCopy(`color: ${hex};`, 'css-color')}
            >
              {copiedKey === 'css-color' ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {t('toolbox.tools.colorPicker.copyCss')}
            </Button>
          }
        >
          <div className="space-y-3">
            <ToolOptionGroup>
              {PREFERRED_FORMATS.map((format) => (
                <Button
                  key={format}
                  type="button"
                  size="sm"
                  variant={preferredFormat === format ? 'default' : 'outline'}
                  aria-pressed={preferredFormat === format}
                  onClick={() => setPreferences({ preferredFormat: format })}
                >
                  {t(FORMAT_LABEL_KEYS[format])}
                </Button>
              ))}
            </ToolOptionGroup>

            <div className="rounded-md border bg-muted/20 px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t('toolbox.tools.colorPicker.preferredFormat')}
              </p>
              <code className="mt-1 block text-sm font-mono">{preferredFormatValue}</code>
            </div>

            <div className="divide-y divide-border">
              {formats.map(({ key, label, value }) => (
                <FormatRow
                  key={key}
                  label={label}
                  value={value}
                  copiedKey={copiedKey}
                  onCopy={handleCopy}
                  formatKey={key}
                />
              ))}
            </div>
          </div>
        </ToolSection>

        {/* ── Accessibility (WCAG) ────────────────────────── */}
        <ToolSection title={t('toolbox.tools.colorPicker.accessibilityTitle')}>
          {contrast ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {t('toolbox.tools.colorPicker.contrastValue', {
                  white: contrast.white.toFixed(2),
                  black: contrast.black.toFixed(2),
                })}
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t('toolbox.tools.colorPicker.contrastVsWhite')}</span>
                  <span className="text-sm font-mono tabular-nums">{contrast.white.toFixed(2)}:1</span>
                </div>
                <div className="flex gap-1.5">
                  <WcagBadge pass={contrast.white >= 4.5} label={`AA ${contrast.white >= 4.5 ? t('toolbox.tools.colorPicker.pass') : t('toolbox.tools.colorPicker.fail')}`} />
                  <WcagBadge pass={contrast.white >= 7} label={`AAA ${contrast.white >= 7 ? t('toolbox.tools.colorPicker.pass') : t('toolbox.tools.colorPicker.fail')}`} />
                  <WcagBadge pass={contrast.white >= 3} label={`AA Large ${contrast.white >= 3 ? t('toolbox.tools.colorPicker.pass') : t('toolbox.tools.colorPicker.fail')}`} />
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t('toolbox.tools.colorPicker.contrastVsBlack')}</span>
                  <span className="text-sm font-mono tabular-nums">{contrast.black.toFixed(2)}:1</span>
                </div>
                <div className="flex gap-1.5">
                  <WcagBadge pass={contrast.black >= 4.5} label={`AA ${contrast.black >= 4.5 ? t('toolbox.tools.colorPicker.pass') : t('toolbox.tools.colorPicker.fail')}`} />
                  <WcagBadge pass={contrast.black >= 7} label={`AAA ${contrast.black >= 7 ? t('toolbox.tools.colorPicker.pass') : t('toolbox.tools.colorPicker.fail')}`} />
                  <WcagBadge pass={contrast.black >= 3} label={`AA Large ${contrast.black >= 3 ? t('toolbox.tools.colorPicker.pass') : t('toolbox.tools.colorPicker.fail')}`} />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('toolbox.tools.colorPicker.accessibilityHint')}</p>
          )}
        </ToolSection>
        {clipboardError && <ToolValidationMessage message={t('toolbox.actions.copyFailed')} />}
      </div>
    </div>
  );
}
