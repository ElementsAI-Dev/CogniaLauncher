'use client';

import { Scan } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { DetectedEnvironment } from '@/lib/tauri';

interface CardHeaderProps {
  envType: string;
  detectedVersion?: DetectedEnvironment | null;
  t: (key: string, params?: Record<string, string>) => string;
}

export function CardHeader({ envType, detectedVersion, t }: CardHeaderProps) {
  return (
    <>
      {/* Detected Version Badge */}
      {detectedVersion && (
        <Badge 
          variant="outline" 
          className="gap-2 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
        >
          <Scan className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
          {t('environments.detectedVersion', {
            version: detectedVersion.version,
            source: detectedVersion.source,
          })}
        </Badge>
      )}

      {/* Title */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold capitalize">{envType}</h3>
      </div>
    </>
  );
}
