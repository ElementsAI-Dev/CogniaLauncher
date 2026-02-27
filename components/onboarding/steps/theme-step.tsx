'use client';

import { Palette, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { THEMES } from '@/lib/constants/onboarding';
import type { ThemeStepProps } from '@/types/onboarding';

export function ThemeStep({ theme, setTheme, t }: ThemeStepProps) {
  return (
    <div className="flex flex-col items-center text-center space-y-6 py-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Palette className="h-8 w-8" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold">{t('onboarding.themeTitle')}</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          {t('onboarding.themeDesc')}
        </p>
      </div>
      <RadioGroup
        value={theme}
        onValueChange={(v) => setTheme(v)}
        className="grid grid-cols-3 gap-4 w-full max-w-md"
      >
        {THEMES.map((item) => {
          const Icon = item.icon;
          const isActive = theme === item.value;
          return (
            <Label
              key={item.value}
              htmlFor={`theme-${item.value}`}
              className={cn(
              'relative flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-all cursor-pointer font-normal',
              isActive
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-transparent bg-muted/30 hover:bg-muted/50',
            )}
            >
              <RadioGroupItem value={item.value} id={`theme-${item.value}`} className="sr-only" />
              {isActive && (
                <div className="absolute top-2 right-2">
                  <Check className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg border ${item.preview}`}>
                <Icon className="h-6 w-6" />
              </div>
              <span className="text-sm font-medium">
                {t(`onboarding.theme${item.value.charAt(0).toUpperCase() + item.value.slice(1)}`)}
              </span>
            </Label>
          );
        })}
      </RadioGroup>
    </div>
  );
}
