'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useAppearanceStore } from '@/lib/stores/appearance';
import { useLocale } from '@/components/providers/locale-provider';
import { parseAppearanceConfig } from '@/lib/theme';
import { toast } from 'sonner';

export function useAppearanceConfigSync(config: Record<string, string>) {
  const { t, locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const { accentColor, setAccentColor, reducedMotion, setReducedMotion } = useAppearanceStore();
  const appearanceConfigRef = useRef<string>('');

  useEffect(() => {
    if (!config || Object.keys(config).length === 0) return;

    const appearanceSnapshot = JSON.stringify({
      theme: config['appearance.theme'],
      accentColor: config['appearance.accent_color'],
      reducedMotion: config['appearance.reduced_motion'],
      language: config['appearance.language'],
    });

    if (appearanceSnapshot === appearanceConfigRef.current) return;

    const parsed = parseAppearanceConfig(config);

    if (parsed.theme && parsed.theme !== theme) {
      setTheme(parsed.theme);
    }

    if (parsed.accentColor && parsed.accentColor !== accentColor) {
      setAccentColor(parsed.accentColor);
    }

    if (typeof parsed.reducedMotion === 'boolean' && parsed.reducedMotion !== reducedMotion) {
      setReducedMotion(parsed.reducedMotion);
    }

    if (parsed.locale && parsed.locale !== locale) {
      setLocale(parsed.locale);
    }

    if (parsed.invalidKeys.length > 0) {
      const fieldLabels = parsed.invalidKeys
        .map((key) => {
          switch (key) {
            case 'theme':
              return t('settings.theme');
            case 'accentColor':
              return t('settings.accentColor');
            case 'reducedMotion':
              return t('settings.reducedMotion');
            case 'language':
              return t('settings.language');
            default:
              return key;
          }
        })
        .join(', ');

      toast.warning(t('settings.appearanceConfigInvalid', { fields: fieldLabels }));
    }

    appearanceConfigRef.current = appearanceSnapshot;
  }, [config, theme, accentColor, reducedMotion, locale, setTheme, setAccentColor, setReducedMotion, setLocale, t]);
}
