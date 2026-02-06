'use client';

import { Globe, Check } from 'lucide-react';
import type { Locale } from '@/lib/i18n';

interface LanguageStepProps {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const LANGUAGES: { value: Locale; label: string; nativeLabel: string; flag: string }[] = [
  { value: 'en', label: 'English', nativeLabel: 'English', flag: '🇺🇸' },
  { value: 'zh', label: 'Chinese (Simplified)', nativeLabel: '简体中文', flag: '🇨🇳' },
];

export function LanguageStep({ locale, setLocale, t }: LanguageStepProps) {
  return (
    <div className="flex flex-col items-center text-center space-y-6 py-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Globe className="h-8 w-8" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold">{t('onboarding.languageTitle')}</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          {t('onboarding.languageDesc')}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 w-full max-w-sm">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.value}
            onClick={() => setLocale(lang.value)}
            className={`flex items-center gap-4 rounded-lg border-2 p-4 transition-all text-left ${
              locale === lang.value
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-transparent bg-muted/30 hover:bg-muted/50'
            }`}
          >
            <span className="text-3xl">{lang.flag}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{lang.nativeLabel}</div>
              <div className="text-sm text-muted-foreground">{lang.label}</div>
            </div>
            {locale === lang.value && (
              <Check className="h-5 w-5 text-primary shrink-0" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
