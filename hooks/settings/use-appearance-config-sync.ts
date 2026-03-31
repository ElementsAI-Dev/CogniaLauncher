'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useAppearanceStore } from '@/lib/stores/appearance';
import { useLocale } from '@/components/providers/locale-provider';
import { APPEARANCE_CONFIG_PATHS, parseAppearanceConfig } from '@/lib/theme';
import { configSet, isTauri } from '@/lib/tauri';
import { toast } from 'sonner';

export function useAppearanceConfigSync(config: Record<string, string>) {
  const { t, locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const { accentColor, setAccentColor, chartColorTheme, setChartColorTheme, interfaceRadius, setInterfaceRadius, interfaceDensity, setInterfaceDensity, reducedMotion, setReducedMotion, windowEffect, setWindowEffect } = useAppearanceStore();
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
      windowEffect: config['appearance.window_effect'],
      language: config['appearance.language'],
    });

    if (appearanceSnapshot === appearanceConfigRef.current) return;

    const parsed = parseAppearanceConfig(config);

    if (parsed.theme !== theme) {
      setTheme(parsed.theme);
    }

    if (parsed.accentColor !== accentColor) {
      setAccentColor(parsed.accentColor);
    }

    if (parsed.chartColorTheme !== chartColorTheme) {
      setChartColorTheme(parsed.chartColorTheme);
    }

    if (parsed.interfaceRadius !== interfaceRadius) {
      setInterfaceRadius(parsed.interfaceRadius);
    }

    if (parsed.interfaceDensity !== interfaceDensity) {
      setInterfaceDensity(parsed.interfaceDensity);
    }

    if (parsed.reducedMotion !== reducedMotion) {
      setReducedMotion(parsed.reducedMotion);
    }

    if (parsed.windowEffect !== windowEffect) {
      setWindowEffect(parsed.windowEffect);
    }

    if (parsed.locale !== locale) {
      setLocale(parsed.locale);
    }

    if (parsed.invalidKeys.length > 0) {
      if (isTauri()) {
        void Promise.all(
          parsed.invalidKeys.map(async (key) => {
            const configPath = APPEARANCE_CONFIG_PATHS[key];
            let canonicalValue = '';
            switch (key) {
              case 'theme':
                canonicalValue = parsed.theme;
                break;
              case 'accentColor':
                canonicalValue = parsed.accentColor;
                break;
              case 'chartColorTheme':
                canonicalValue = parsed.chartColorTheme;
                break;
              case 'interfaceRadius':
                canonicalValue = String(parsed.interfaceRadius);
                break;
              case 'interfaceDensity':
                canonicalValue = parsed.interfaceDensity;
                break;
              case 'reducedMotion':
                canonicalValue = String(parsed.reducedMotion);
                break;
              case 'windowEffect':
                canonicalValue = parsed.windowEffect;
                break;
              case 'language':
                canonicalValue = parsed.locale;
                break;
            }
            await configSet(configPath, canonicalValue);
          }),
        ).catch((err) => {
          console.error('Failed to write canonical appearance values:', err);
        });
      }

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
            case 'windowEffect':
              return t('settings.windowEffect');
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
  }, [config, theme, accentColor, chartColorTheme, interfaceRadius, interfaceDensity, reducedMotion, windowEffect, locale, setTheme, setAccentColor, setChartColorTheme, setInterfaceRadius, setInterfaceDensity, setReducedMotion, setWindowEffect, setLocale, t]);
}
