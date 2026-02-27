'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
  UserCog,
  HardDrive,
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import type { WslDistroCardProps } from '@/types/wsl';
import type { WslDiskUsage } from '@/types/tauri';

export function WslDistroCard({
  distro,
  onLaunch,
  onTerminate,
  onSetDefault,
  onSetVersion,
  onExport,
  onUnregister,
  onChangeDefaultUser,
  getDiskUsage,
  t,
}: WslDistroCardProps) {
  const isRunning = distro.state.toLowerCase() === 'running';
  const wslVer = parseInt(distro.wslVersion, 10);
  const targetVersion = wslVer === 1 ? 2 : 1;
  const [diskUsage, setDiskUsage] = useState<WslDiskUsage | null>(null);

  useEffect(() => {
    if (getDiskUsage) {
      getDiskUsage(distro.name).then(setDiskUsage).catch(() => {});
    }
  }, [distro.name, getDiskUsage]);

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
                <Link
                  href={`/wsl/distro?name=${encodeURIComponent(distro.name)}`}
                  className="font-semibold truncate hover:underline hover:text-primary transition-colors"
                >
                  {distro.name}
                </Link>
                {distro.isDefault && (
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
                  WSL {distro.wslVersion}
                </Badge>
                {distro.isDefault && (
                  <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300">
                    Default
                  </Badge>
                )}
              </div>
              {diskUsage && diskUsage.totalBytes > 0 && (
                <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                  <HardDrive className="h-3 w-3 shrink-0" />
                  <Progress
                    value={(diskUsage.usedBytes / diskUsage.totalBytes) * 100}
                    className="h-1.5 flex-1 max-w-[120px]"
                  />
                  <span>{formatBytes(diskUsage.usedBytes)} / {formatBytes(diskUsage.totalBytes)}</span>
                </div>
              )}
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
                <Button variant="ghost" size="icon" className="h-8 w-8" title={t('common.more')}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!distro.isDefault && (
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
                {onChangeDefaultUser && (
                  <DropdownMenuItem onClick={() => onChangeDefaultUser(distro.name)}>
                    <UserCog className="h-4 w-4 mr-2" />
                    {t('wsl.changeDefaultUser')}
                  </DropdownMenuItem>
                )}
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
