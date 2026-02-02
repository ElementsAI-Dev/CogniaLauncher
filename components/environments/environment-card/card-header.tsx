'use client';

import { Scan } from 'lucide-react';
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
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
          <Scan className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
          <span className="text-xs font-medium text-green-700 dark:text-green-300">
            {t('environments.detectedVersion', {
              version: detectedVersion.version,
              source: detectedVersion.source,
            })}
          </span>
        </div>
      )}

      {/* Title */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold capitalize">{envType}</h3>
      </div>
    </>
  );
}
