'use client';

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLocale } from '@/components/providers/locale-provider';
import { Copy, Check } from 'lucide-react';
import type { ToolComponentProps } from '@/types/toolbox';

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

function getContrastRatio(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '-';
  const lum = [rgb.r, rgb.g, rgb.b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  const l = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
  const white = (1.05) / (l + 0.05);
  const black = (l + 0.05) / 0.05;
  return `W:${white.toFixed(2)} B:${black.toFixed(2)}`;
}

export default function ColorPicker({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const [hex, setHex] = useState('#3b82f6');
  const [copied, setCopied] = useState<string | null>(null);

  const rgb = hexToRgb(hex);
  const hsl = rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null;
  const contrast = getContrastRatio(hex);

  const handleColorInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setHex(e.target.value);
  }, []);

  const handleHexInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (!val.startsWith('#')) val = '#' + val;
    setHex(val);
  }, []);

  const handleRgbChange = useCallback((channel: 'r' | 'g' | 'b', value: string) => {
    if (!rgb) return;
    const n = Math.max(0, Math.min(255, Number(value) || 0));
    const newRgb = { ...rgb, [channel]: n };
    setHex(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
  }, [rgb]);

  const handleCopy = useCallback(async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }, []);

  const formats = [
    { key: 'hex', label: 'HEX', value: hex.toUpperCase() },
    { key: 'rgb', label: 'RGB', value: rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : '-' },
    { key: 'hsl', label: 'HSL', value: hsl ? `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` : '-' },
    { key: 'contrast', label: t('toolbox.tools.colorPicker.contrast'), value: contrast },
  ];

  return (
    <div className={className}>
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="space-y-2">
            <Label>{t('toolbox.tools.colorPicker.pickColor')}</Label>
            <input
              type="color"
              value={hex.length === 7 ? hex : '#000000'}
              onChange={handleColorInput}
              className="h-20 w-20 cursor-pointer rounded-lg border"
            />
          </div>
          <div className="flex-1 space-y-2">
            <Label>HEX</Label>
            <Input value={hex} onChange={handleHexInput} className="font-mono" placeholder="#3b82f6" />
            {rgb && (
              <div className="grid grid-cols-3 gap-2">
                {(['r', 'g', 'b'] as const).map((ch) => (
                  <div key={ch} className="space-y-1">
                    <Label className="text-xs">{ch.toUpperCase()}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={255}
                      value={rgb[ch]}
                      onChange={(e) => handleRgbChange(ch, e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          className="h-16 rounded-lg border"
          style={{ backgroundColor: hex.length === 7 ? hex : '#000' }}
        />

        <Card>
          <CardContent className="p-4 space-y-2">
            {formats.map(({ key, label, value }) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium w-20">{label}</span>
                <code className="flex-1 text-xs font-mono">{value}</code>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleCopy(value, key)}>
                  {copied === key ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
