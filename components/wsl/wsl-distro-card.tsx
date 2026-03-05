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
  FolderOpen,
  TerminalSquare,
  Copy,
  Tag,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatBytes } from '@/lib/utils';
import { useWslStore } from '@/lib/stores/wsl';
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
  onOpenInExplorer,
  onOpenInTerminal,
  onClone,
  getDiskUsage,
  t,
}: WslDistroCardProps) {
  const isRunning = distro.state.toLowerCase() === 'running';
  const wslVer = parseInt(distro.wslVersion, 10);
  const targetVersion = wslVer === 1 ? 2 : 1;
  const [diskUsage, setDiskUsage] = useState<WslDiskUsage | null>(null);
  const { distroTags, availableTags, setDistroTags } = useWslStore();
  const tags = distroTags[distro.name] ?? [];

  useEffect(() => {
    if (getDiskUsage) {
      getDiskUsage(distro.name).then(setDiskUsage).catch(() => {});
    }
  }, [distro.name, getDiskUsage]);

  return (
    <Card className="group relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
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
                    {t('wsl.defaultBadge')}
                  </Badge>
                )}
                {tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
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

          <div
            data-testid="wsl-distro-actions"
            className="flex w-full flex-wrap items-center justify-end gap-1.5 md:w-auto md:flex-nowrap"
          >
            {isRunning ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onTerminate(distro.name)}
                className="gap-1.5 whitespace-nowrap"
              >
                <Square className="h-3.5 w-3.5" />
                {t('wsl.terminate')}
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => onLaunch(distro.name)}
                className="gap-1.5 whitespace-nowrap"
              >
                <Play className="h-3.5 w-3.5" />
                {t('wsl.launch')}
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title={t('common.more')}>
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
                {onOpenInExplorer && (
                  <DropdownMenuItem onClick={() => onOpenInExplorer(distro.name)}>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    {t('wsl.openInExplorer')}
                  </DropdownMenuItem>
                )}
                {onOpenInTerminal && (
                  <DropdownMenuItem onClick={() => onOpenInTerminal(distro.name)}>
                    <TerminalSquare className="h-4 w-4 mr-2" />
                    {t('wsl.openInTerminal')}
                  </DropdownMenuItem>
                )}
                {onClone && (
                  <DropdownMenuItem onClick={() => onClone(distro.name)}>
                    <Copy className="h-4 w-4 mr-2" />
                    {t('wsl.clone')}
                  </DropdownMenuItem>
                )}
                {onChangeDefaultUser && (
                  <DropdownMenuItem onClick={() => onChangeDefaultUser(distro.name)}>
                    <UserCog className="h-4 w-4 mr-2" />
                    {t('wsl.changeDefaultUser')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <Popover>
                  <PopoverTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Tag className="h-4 w-4 mr-2" />
                      {t('wsl.tags.manage')}
                    </DropdownMenuItem>
                  </PopoverTrigger>
                  <PopoverContent side="left" align="start" className="w-48 p-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">{t('wsl.tags.title')}</p>
                    <div className="space-y-1">
                      {availableTags.map((tag) => {
                        const isActive = tags.includes(tag);
                        return (
                          <Button
                            key={tag}
                            variant={isActive ? 'default' : 'outline'}
                            size="sm"
                            className="w-full justify-start h-7 text-xs"
                            onClick={() => {
                              const next = isActive
                                ? tags.filter((t2) => t2 !== tag)
                                : [...tags, tag];
                              setDistroTags(distro.name, next);
                            }}
                          >
                            {tag}
                          </Button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
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
