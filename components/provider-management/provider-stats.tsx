'use client';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, XCircle, Power, PowerOff } from 'lucide-react';

export interface ProviderStatsProps {
  total: number;
  enabled: number;
  available: number;
  unavailable: number;
  t: (key: string) => string;
}

export function ProviderStats({
  total,
  enabled,
  available,
  unavailable,
  t,
}: ProviderStatsProps) {
  const disabled = total - enabled;

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{t('providers.statsTotal')}:</span>
        <Badge variant="secondary" className="font-mono">
          {total}
        </Badge>
      </div>

      <Separator orientation="vertical" className="h-4" />

      <div className="flex items-center gap-2">
        <Power className="h-4 w-4 text-green-600" />
        <span className="text-sm text-muted-foreground">{t('providers.statsEnabled')}:</span>
        <Badge variant="secondary" className="font-mono bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
          {enabled}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <PowerOff className="h-4 w-4 text-gray-500" />
        <span className="text-sm text-muted-foreground">{t('providers.statsDisabled')}:</span>
        <Badge variant="secondary" className="font-mono">
          {disabled}
        </Badge>
      </div>

      <Separator orientation="vertical" className="h-4" />

      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <span className="text-sm text-muted-foreground">{t('providers.statsAvailable')}:</span>
        <Badge variant="secondary" className="font-mono bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
          {available}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <XCircle className="h-4 w-4 text-red-500" />
        <span className="text-sm text-muted-foreground">{t('providers.statsUnavailable')}:</span>
        <Badge variant="secondary" className="font-mono bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
          {unavailable}
        </Badge>
      </div>
    </div>
  );
}
