'use client';

import { Server, Check, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useCallback } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MIRROR_PRESETS } from '@/lib/constants/mirrors';
import type { MirrorsStepProps } from '@/types/onboarding';

export function MirrorsStep({ t, onApplyPreset, mode = 'quick' }: MirrorsStepProps) {
  const [selected, setSelected] = useState<string>('default');

  const handleChange = useCallback((key: string) => {
    setSelected(key);
    onApplyPreset(key);
  }, [onApplyPreset]);

  const presetEntries = Object.entries(MIRROR_PRESETS);

  return (
    <div className="flex flex-col items-center text-center space-y-6 py-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Server className="h-8 w-8" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold">{t('onboarding.mirrorsTitle')}</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          {t('onboarding.mirrorsDesc')}
        </p>
      </div>
      {mode === 'detailed' && (
        <Alert className="w-full max-w-md text-left">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {t('onboarding.mirrorsDetailedRecommendation')}
          </AlertDescription>
        </Alert>
      )}
      <RadioGroup
        value={selected}
        onValueChange={handleChange}
        className="grid grid-cols-1 gap-3 w-full max-w-sm"
      >
        {presetEntries.map(([key, preset]) => (
          <Label
            key={key}
            htmlFor={`mirror-${key}`}
            className={cn(
              'flex items-center gap-4 rounded-lg border-2 p-4 transition-all text-left cursor-pointer font-normal',
              selected === key
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-transparent bg-muted/30 hover:bg-muted/50',
            )}
          >
            <RadioGroupItem value={key} id={`mirror-${key}`} className="sr-only" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{t(preset.labelKey)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {t(`onboarding.mirrorPresetDesc_${key}`)}
              </div>
            </div>
            {selected === key && (
              <Check className="h-5 w-5 text-primary shrink-0" />
            )}
          </Label>
        ))}
      </RadioGroup>
      {mode === 'detailed' && (
        <Alert className="max-w-md text-left">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {t('onboarding.mirrorsDetailedSafety')}
          </AlertDescription>
        </Alert>
      )}
      <Alert className="max-w-sm">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          {t('onboarding.mirrorsHint')}
        </AlertDescription>
      </Alert>
    </div>
  );
}
