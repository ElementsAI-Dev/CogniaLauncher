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
  const { accentColor, setAccentColor, chartColorTheme, setChartColorTheme, interfaceRadius, setInterfaceRadius, interfaceDensity, setInterfaceDensity, reducedMotion, setReducedMotion } = useAppearanceStore();
  const appearanceConfigRef = useRef<string>('');

  useEffect(() => {
    if (!config || Object.keys(config).length === 0) return;

    const appearanceSnapshot = JSON.stringify({
      theme: config['appearance.theme'],
      accentColor: config['appearance.accent_color'],
      chartColorTheme: config['appearance.chart_color_theme'],
      interfaceRadius: config['appearance.interface_radius'],
      interfaceDensity: config['appearance.interface_density'],
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

    if (parsed.chartColorTheme && parsed.chartColorTheme !== chartColorTheme) {
      setChartColorTheme(parsed.chartColorTheme);
    }

    if (parsed.interfaceRadius !== undefined && parsed.interfaceRadius !== interfaceRadius) {
      setInterfaceRadius(parsed.interfaceRadius);
    }

    if (parsed.interfaceDensity && parsed.interfaceDensity !== interfaceDensity) {
      setInterfaceDensity(parsed.interfaceDensity);
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
            case 'chartColorTheme':
              return t('settings.chartColorTheme');
            case 'interfaceRadius':
              return t('settings.interfaceRadius');
            case 'interfaceDensity':
              return t('settings.interfaceDensity');
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
  }, [config, theme, accentColor, chartColorTheme, interfaceRadius, interfaceDensity, reducedMotion, locale, setTheme, setAccentColor, setChartColorTheme, setInterfaceRadius, setInterfaceDensity, setReducedMotion, setLocale, t]);
}
