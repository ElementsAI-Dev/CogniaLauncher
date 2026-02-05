'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Loader2, CheckCircle2, XCircle, Activity } from 'lucide-react';
import type { ProviderInfo } from '@/lib/tauri';
import { cn } from '@/lib/utils';

export interface ProviderCardProps {
  provider: ProviderInfo;
  isAvailable?: boolean;
  isToggling: boolean;
  onToggle: (providerId: string, enabled: boolean) => void;
  onCheckStatus: (providerId: string) => Promise<boolean>;
  t: (key: string) => string;
}

const PROVIDER_ICONS: Record<string, string> = {
  npm: '📦',
  pnpm: '⚡',
  uv: '🐍',
  cargo: '🦀',
  chocolatey: '🍫',
  scoop: '🥄',
  winget: '🪟',
  brew: '🍺',
  apt: '🐧',
  dnf: '🎩',
  pacman: '👻',
  zypper: '🦎',
  apk: '🏔️',
  vcpkg: '📚',
  docker: '🐳',
  psgallery: '💠',
  github: '🐙',
  nvm: '💚',
  fnm: '⚡',
  pyenv: '🐍',
  rustup: '🦀',
  goenv: '🔵',
  flatpak: '📦',
  snap: '🔶',
  macports: '🚢',
  pip: '🐍',
  yarn: '🧶',
};

const PLATFORM_ICONS: Record<string, string> = {
  windows: '🪟',
  linux: '🐧',
  macos: '🍎',
  darwin: '🍎',
};

const CAPABILITY_COLORS: Record<string, string> = {
  install: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  uninstall: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  search: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  update: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  list: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  version_switch: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
  multi_version: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  lock_version: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
  rollback: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
  project_local: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300',
};

export function ProviderCard({
  provider,
  isAvailable,
  isToggling,
  onToggle,
  onCheckStatus,
  t,
}: ProviderCardProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [localAvailable, setLocalAvailable] = useState<boolean | undefined>(isAvailable);

  const handleCheckStatus = useCallback(async () => {
    setIsChecking(true);
    try {
      const available = await onCheckStatus(provider.id);
      setLocalAvailable(available);
    } finally {
      setIsChecking(false);
    }
  }, [onCheckStatus, provider.id]);

  const getProviderIcon = (providerId: string) => {
    return PROVIDER_ICONS[providerId] || '📦';
  };

  const getPlatformIcon = (platform: string) => {
    return PLATFORM_ICONS[platform.toLowerCase()] || '💻';
  };

  const getCapabilityColor = (capability: string) => {
    return CAPABILITY_COLORS[capability] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  };

  const availabilityStatus = localAvailable ?? isAvailable;

  return (
    <Card className={cn(
      'transition-all duration-200 overflow-hidden min-w-0',
      !provider.enabled && 'opacity-60'
    )}>
      <CardHeader className="pb-3 overflow-hidden max-w-full">
        <div className="flex items-start justify-between gap-2 w-full max-w-full overflow-hidden">
          <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
            <span className="text-2xl flex-shrink-0" aria-hidden="true">
              {getProviderIcon(provider.id)}
            </span>
            <div className="min-w-0 overflow-hidden">
              <CardTitle className="text-lg truncate max-w-full" title={provider.display_name}>{provider.display_name}</CardTitle>
              <CardDescription className="font-mono text-xs">{provider.id}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {provider.is_environment_provider && (
              <Badge variant="outline" className="text-xs whitespace-nowrap">
                {t('providers.filterEnvironment')}
              </Badge>
            )}
            {availabilityStatus !== undefined && (
              <Badge
                variant={availabilityStatus ? 'default' : 'destructive'}
                className={cn(
                  'text-xs whitespace-nowrap gap-1',
                  availabilityStatus && 'bg-green-600 hover:bg-green-700'
                )}
              >
                {availabilityStatus ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    {t('providers.statusAvailable')}
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3" />
                    {t('providers.statusUnavailable')}
                  </>
                )}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">
            {t('providers.platforms')}
          </Label>
          <div className="flex flex-wrap gap-2">
            {provider.platforms.map((platform) => (
              <span
                key={platform}
                className="text-sm inline-flex items-center gap-1"
                title={platform}
              >
                <span aria-hidden="true">{getPlatformIcon(platform)}</span>
                <span>{platform}</span>
              </span>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">
            {t('providers.capabilities')}
          </Label>
          <div className="flex flex-wrap gap-1">
            {provider.capabilities.map((cap) => (
              <Badge
                key={cap}
                variant="secondary"
                className={cn('text-xs', getCapabilityColor(cap))}
              >
                {cap.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        </div>

        <Separator className="my-3" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label htmlFor={`enabled-${provider.id}`} className="text-sm font-medium">
              {t('providers.enabled')}
            </Label>
            {isToggling && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCheckStatus}
                  disabled={isChecking}
                  className="h-8 px-2"
                >
                  {isChecking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Activity className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('providers.checkStatus')}</p>
              </TooltipContent>
            </Tooltip>
            <Switch
              id={`enabled-${provider.id}`}
              checked={provider.enabled}
              onCheckedChange={(checked) => onToggle(provider.id, checked)}
              disabled={isToggling}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t('providers.priority')}: {provider.priority}</span>
        </div>
      </CardContent>
    </Card>
  );
}
