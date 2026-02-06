'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Play,
  Square,
  Star,
  MoreVertical,
  Download,
  Trash2,
  ArrowUpDown,
  Terminal,
} from 'lucide-react';
import type { WslDistroStatus } from '@/types/tauri';

interface WslDistroCardProps {
  distro: WslDistroStatus;
  onLaunch: (name: string) => void;
  onTerminate: (name: string) => void;
  onSetDefault: (name: string) => void;
  onSetVersion: (name: string, version: number) => void;
  onExport: (name: string) => void;
  onUnregister: (name: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function WslDistroCard({
  distro,
  onLaunch,
  onTerminate,
  onSetDefault,
  onSetVersion,
  onExport,
  onUnregister,
  t,
}: WslDistroCardProps) {
  const isRunning = distro.state.toLowerCase() === 'running';
  const wslVer = parseInt(distro.wsl_version, 10);
  const targetVersion = wslVer === 1 ? 2 : 1;

  return (
    <Card className="group relative">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Terminal className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{distro.name}</h3>
                {distro.is_default && (
                  <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge
                  variant={isRunning ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {isRunning ? t('wsl.running') : t('wsl.stopped')}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  WSL {distro.wsl_version}
                </Badge>
                {distro.is_default && (
                  <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300">
                    Default
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isRunning ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onTerminate(distro.name)}
                className="gap-1.5"
              >
                <Square className="h-3.5 w-3.5" />
                {t('wsl.terminate')}
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => onLaunch(distro.name)}
                className="gap-1.5"
              >
                <Play className="h-3.5 w-3.5" />
                {t('wsl.launch')}
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!distro.is_default && (
                  <DropdownMenuItem onClick={() => onSetDefault(distro.name)}>
                    <Star className="h-4 w-4 mr-2" />
                    {t('wsl.setDefault')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onSetVersion(distro.name, targetVersion)}>
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  {t('wsl.setVersion')} → WSL {targetVersion}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport(distro.name)}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('wsl.export')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onUnregister(distro.name)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('wsl.unregister')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
