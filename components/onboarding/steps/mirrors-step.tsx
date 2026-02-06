'use client';

import { Server, Check } from 'lucide-react';
import { useState } from 'react';

interface MirrorsStepProps {
  t: (key: string) => string;
}

type MirrorPreset = 'default' | 'china' | 'custom';

const MIRROR_PRESETS: { value: MirrorPreset; labelKey: string; descKey: string }[] = [
  {
    value: 'default',
    labelKey: 'onboarding.mirrorsDefault',
    descKey: 'onboarding.mirrorsDefaultDesc',
  },
  {
    value: 'china',
    labelKey: 'onboarding.mirrorsChinaPreset',
    descKey: 'onboarding.mirrorsChinaPresetDesc',
  },
  {
    value: 'custom',
    labelKey: 'onboarding.mirrorsCustom',
    descKey: 'onboarding.mirrorsCustomDesc',
  },
];

export function MirrorsStep({ t }: MirrorsStepProps) {
  const [preset, setPreset] = useState<MirrorPreset>('default');

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
      <div className="grid grid-cols-1 gap-3 w-full max-w-sm">
        {MIRROR_PRESETS.map((item) => (
          <button
            key={item.value}
            onClick={() => setPreset(item.value)}
            className={`flex items-center gap-4 rounded-lg border-2 p-4 transition-all text-left ${
              preset === item.value
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-transparent bg-muted/30 hover:bg-muted/50'
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{t(item.labelKey)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t(item.descKey)}</div>
            </div>
            {preset === item.value && (
              <Check className="h-5 w-5 text-primary shrink-0" />
            )}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground max-w-sm">
        {t('onboarding.mirrorsHint')}
      </p>
    </div>
  );
}
