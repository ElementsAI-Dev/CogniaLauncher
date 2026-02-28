'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { openExternal, revealPath } from '@/lib/tauri';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Blocks, Puzzle, RefreshCw, ExternalLink, Palette, FileText, Sparkles, Plug, Terminal, FolderOpen, HardDrive, Trash2, ScanSearch } from 'lucide-react';
import type { ShellInfo, ShellType, ShellFrameworkInfo, ShellPlugin, FrameworkCategory, FrameworkCacheInfo } from '@/types/tauri';
import { useLocale } from '@/components/providers/locale-provider';
import { formatBytes } from '@/lib/utils';

interface TerminalShellFrameworkProps {
  shells: ShellInfo[];
  frameworks: ShellFrameworkInfo[];
  plugins: ShellPlugin[];
  frameworkCacheStats?: FrameworkCacheInfo[];
  frameworkCacheLoading?: boolean;
  onDetectFrameworks: (shellType: ShellType) => Promise<void>;
  onFetchPlugins: (frameworkName: string, frameworkPath: string, shellType: ShellType, configPath?: string | null) => Promise<void>;
  onFetchCacheStats?: () => Promise<void>;
  onCleanFrameworkCache?: (name: string) => Promise<void>;
  loading?: boolean;
}

const categoryConfig: Record<FrameworkCategory, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: typeof Blocks }> = {
  'framework': { label: 'Framework', variant: 'default', icon: Blocks },
  'plugin-manager': { label: 'Plugin Manager', variant: 'secondary', icon: Plug },
  'prompt-engine': { label: 'Prompt Engine', variant: 'outline', icon: Sparkles },
  'theme': { label: 'Theme', variant: 'outline', icon: Palette },
};

export function TerminalShellFramework({
  shells,
  frameworks,
  plugins,
  frameworkCacheStats,
  frameworkCacheLoading,
  onDetectFrameworks,
  onFetchPlugins,
  onFetchCacheStats,
  onCleanFrameworkCache,
  loading,
}: TerminalShellFrameworkProps) {
  const { t } = useLocale();
  const [detecting, setDetecting] = useState(false);
  const [cleaningFramework, setCleaningFramework] = useState<string | null>(null);
  const [selectedFramework, setSelectedFramework] = useState<ShellFrameworkInfo | null>(null);

  const handleDetectAll = async () => {
    setDetecting(true);
    try {
      for (const shell of shells) {
        await onDetectFrameworks(shell.shellType);
      }
    } finally {
      setDetecting(false);
    }
  };

  const handleSelectFramework = async (fw: ShellFrameworkInfo) => {
    setSelectedFramework(fw);
    await onFetchPlugins(fw.name, fw.path, fw.shellType, fw.configPath);
  };

  const handleCleanCache = async (name: string) => {
    if (!onCleanFrameworkCache) return;
    setCleaningFramework(name);
    try {
      await onCleanFrameworkCache(name);
    } finally {
      setCleaningFramework(null);
    }
  };

  const totalCacheSize = frameworkCacheStats?.reduce((acc, c) => acc + c.totalSize, 0) ?? 0;
  const totalCacheHuman = frameworkCacheStats?.length
    ? frameworkCacheStats.reduce((acc, c) => acc + c.totalSize, 0) > 0
      ? formatBytes(totalCacheSize)
      : '0 B'
    : null;

  const getCategoryInfo = (category: FrameworkCategory) =>
    categoryConfig[category] || categoryConfig['framework'];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{t('terminal.frameworks')}</CardTitle>
            <CardDescription>{t('terminal.frameworksDesc')}</CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDetectAll}
            disabled={detecting || shells.length === 0}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${detecting ? 'animate-spin' : ''}`} />
            {t('terminal.detectFrameworks')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading || detecting ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : frameworks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {t('terminal.noFrameworks')}
          </p>
        ) : (
          <div className="space-y-3">
            {frameworks.map((fw) => {
              const catInfo = getCategoryInfo(fw.category);
              const CatIcon = catInfo.icon;
              return (
                <div
                  key={`${fw.name}-${fw.shellType}`}
                  className={cn(
                    'flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors hover:bg-accent/50',
                    selectedFramework?.name === fw.name && selectedFramework?.shellType === fw.shellType && 'border-primary bg-accent/30'
                  )}
                  onClick={() => handleSelectFramework(fw)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                      <CatIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{fw.name}</span>
                        {fw.version && (
                          <Badge variant="outline" className="text-xs">
                            v{fw.version}
                          </Badge>
                        )}
                        <Badge variant={catInfo.variant} className="text-xs">
                          {catInfo.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {fw.description}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {fw.activeTheme && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1">
                                <Palette className="h-3 w-3 shrink-0" />
                                <span className="font-mono truncate max-w-[200px]">{fw.activeTheme}</span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-sm font-mono text-xs break-all">
                              {fw.activeTheme}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {fw.configPath && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1 font-mono truncate max-w-[200px]">
                                <FileText className="h-3 w-3 shrink-0" />
                                {fw.configPath.split(/[/\\]/).filter(Boolean).pop()}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-sm font-mono text-xs break-all">
                              {fw.configPath}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="flex items-center gap-1 hover:text-primary transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                revealPath(fw.path);
                              }}
                            >
                              <FolderOpen className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-sm font-mono text-xs break-all">
                            {fw.path}
                          </TooltipContent>
                        </Tooltip>
                        {fw.homepage && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="flex items-center gap-1 hover:text-primary transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openExternal(fw.homepage!);
                                }}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              {fw.homepage}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      <Terminal className="h-3 w-3 mr-1" />
                      {fw.shellType}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedFramework && plugins.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Puzzle className="h-4 w-4" />
              {t('terminal.plugins')}
              <Badge variant="secondary">{plugins.length}</Badge>
            </h4>
            <ScrollArea className="max-h-[250px]">
              <div className="rounded-md border divide-y">
                {plugins.map((plugin) => (
                  <div
                    key={plugin.name}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${plugin.enabled ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                      <span className="text-sm font-mono">{plugin.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {plugin.source}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {selectedFramework && plugins.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            {t('terminal.noPlugins')}
          </p>
        )}

        {/* Framework Cache Section */}
        {frameworks.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                {t('terminal.frameworkCache')}
                {totalCacheHuman && (
                  <Badge variant="secondary">{totalCacheHuman}</Badge>
                )}
              </h4>
              <Button
                size="sm"
                variant="outline"
                onClick={onFetchCacheStats}
                disabled={frameworkCacheLoading}
              >
                <ScanSearch className={`h-3.5 w-3.5 mr-1 ${frameworkCacheLoading ? 'animate-spin' : ''}`} />
                {t('terminal.scanCache')}
              </Button>
            </div>

            {frameworkCacheLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !frameworkCacheStats || frameworkCacheStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">
                {t('terminal.noCacheData')}
              </p>
            ) : (
              <div className="rounded-md border divide-y">
                {frameworkCacheStats.map((cache) => (
                  <div
                    key={cache.frameworkName}
                    className="flex items-center justify-between px-3 py-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{cache.frameworkName}</span>
                        <Badge variant={cache.totalSize > 0 ? 'default' : 'secondary'} className="text-xs">
                          {cache.totalSizeHuman}
                        </Badge>
                      </div>
                      {cache.cachePaths.length > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-xs text-muted-foreground truncate max-w-[400px] mt-0.5 font-mono">
                              {cache.cachePaths[0]}
                              {cache.cachePaths.length > 1 && ` (+${cache.cachePaths.length - 1})`}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-md font-mono text-xs">
                            {cache.cachePaths.map((p, i) => (
                              <div key={i}>{p}</div>
                            ))}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!cache.canClean || cleaningFramework === cache.frameworkName}
                          className="ml-2"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          {cleaningFramework === cache.frameworkName
                            ? t('terminal.cleanCache') + '...'
                            : t('terminal.cleanCache')}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {t('terminal.cleanCache')} - {cache.frameworkName}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('terminal.cleanCacheConfirm', { name: cache.frameworkName })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleCleanCache(cache.frameworkName)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {t('terminal.cleanCache')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
