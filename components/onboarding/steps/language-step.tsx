'use client';

import { Globe, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { LANGUAGES } from '@/lib/constants/onboarding';
import type { Locale } from '@/lib/i18n';
import type { LanguageStepProps } from '@/types/onboarding';

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
      <RadioGroup
        value={locale}
        onValueChange={(v) => setLocale(v as Locale)}
        className="grid grid-cols-1 gap-3 w-full max-w-sm"
      >
        {LANGUAGES.map((lang) => (
          <Label
            key={lang.value}
            htmlFor={`lang-${lang.value}`}
            className={cn(
              'flex items-center gap-4 rounded-lg border-2 p-4 transition-all text-left cursor-pointer font-normal',
              locale === lang.value
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-transparent bg-muted/30 hover:bg-muted/50',
            )}
          >
            <RadioGroupItem value={lang.value} id={`lang-${lang.value}`} className="sr-only" />
            <span className="text-3xl">{lang.flag}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{lang.nativeLabel}</div>
              <div className="text-sm text-muted-foreground">{lang.label}</div>
            </div>
            {locale === lang.value && (
              <Check className="h-5 w-5 text-primary shrink-0" />
            )}
          </Label>
        ))}
      </RadioGroup>
    </div>
  );
}
