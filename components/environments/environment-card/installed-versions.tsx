'use client';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Check } from 'lucide-react';
import { formatSize } from '@/lib/utils';
import type { InstalledVersion } from '@/lib/tauri';

interface InstalledVersionsProps {
  versions: InstalledVersion[];
  currentVersion: string | null;
  onSetGlobal: (version: string) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

export function InstalledVersions({ 
  versions, 
  currentVersion, 
  onSetGlobal, 
  t 
}: InstalledVersionsProps) {
  if (versions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('environments.notInstalled')}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {versions.map((v) => (
        <Tooltip key={v.version}>
          <TooltipTrigger asChild>
            <Badge
              variant={currentVersion === v.version ? 'default' : 'secondary'}
              className="cursor-pointer hover:opacity-80 transition-opacity gap-1"
              onClick={() => onSetGlobal(v.version)}
            >
              {currentVersion === v.version && <Check className="h-3 w-3" />}
              {v.version}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs">
              <p>Size: {formatSize(v.size)}</p>
              {v.installed_at && (
                <p>Installed: {new Date(v.installed_at).toLocaleDateString()}</p>
              )}
              <p className="text-muted-foreground">{t('environments.setGlobal')}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
