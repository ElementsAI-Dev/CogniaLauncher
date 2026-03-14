'use client';

import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { FileCode, Eye, EyeOff, Terminal, ExternalLink, FolderOpen, Copy, Check, Info } from 'lucide-react';
import { highlightShellConfig } from '@/lib/highlight-shell';
import { isTauri } from '@/lib/tauri';
import { toast } from 'sonner';
import { writeClipboard } from '@/lib/clipboard';
import { cn } from '@/lib/utils';
import type { ShellProfileInfo, EnvVarShellGuidance } from '@/types/tauri';

interface EnvVarShellProfilesProps {
  profiles: ShellProfileInfo[];
  onReadProfile: (path: string) => Promise<string | null>;
  guidance?: EnvVarShellGuidance[];
  t: (key: string) => string;
}

export function EnvVarShellProfiles({
  profiles,
  onReadProfile,
  guidance = [],
  t,
}: EnvVarShellProfilesProps) {
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const [profileContent, setProfileContent] = useState<string>('');
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleOpenFile = useCallback(async (path: string) => {
    if (!isTauri()) return;
    try {
      const { openPath } = await import('@tauri-apps/plugin-opener');
      await openPath(path);
    } catch (err) {
      toast.error(String(err));
    }
  }, []);

  const handleRevealInFolder = useCallback(async (path: string) => {
    if (!isTauri()) return;
    try {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
      await revealItemInDir(path);
    } catch (err) {
      toast.error(String(err));
    }
  }, []);

  const handleToggle = useCallback(async (configPath: string) => {
    if (expandedProfile === configPath) {
      setExpandedProfile(null);
      setProfileContent('');
      return;
    }

    setLoadingProfile(true);
    setExpandedProfile(configPath);
    const content = await onReadProfile(configPath);
    setProfileContent(content || '');
    setLoadingProfile(false);
  }, [expandedProfile, onReadProfile]);

  const handleCopyContent = useCallback(async () => {
    if (!profileContent) return;
    await writeClipboard(profileContent);
    setCopied(true);
    toast.success(t('envvar.table.copied'));
    setTimeout(() => setCopied(false), 2000);
  }, [profileContent, t]);

  const expandedShell = profiles.find((p) => p.configPath === expandedProfile)?.shell ?? 'bash';
  const highlightedHtml = useMemo(
    () => (profileContent ? highlightShellConfig(profileContent, expandedShell) : ''),
    [profileContent, expandedShell],
  );

  const lineCount = profileContent ? profileContent.split('\n').length : 0;

  return (
    <Card className="min-h-0 flex-1 gap-0 py-0" data-testid="envvar-shell-profiles-panel">
      <CardHeader className="border-b px-3 py-3 sm:px-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">{t('envvar.shellProfiles.title')}</CardTitle>
            <CardDescription className="mt-1">{t('envvar.description')}</CardDescription>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {profiles.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-0">
        {guidance.length > 0 && (
          <div
            className="border-b bg-blue-500/5 px-4 py-3 dark:bg-blue-500/10"
            data-testid="envvar-shell-guidance"
          >
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <p className="text-sm font-medium">{t('envvar.shellProfiles.guidanceTitle')}</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t('envvar.shellProfiles.guidanceDescription')}</p>
            <div className="mt-3 grid gap-2">
              {guidance.map((entry) => (
                <Card key={`${entry.shell}-${entry.configPath}`} className="gap-0 py-0">
                  <CardHeader className="px-3 py-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <span className="capitalize">{entry.shell}</span>
                      {entry.autoApplied && (
                        <Badge variant="secondary" className="text-[10px]">
                          {t('envvar.shellProfiles.guidanceAutoApplied')}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="font-mono text-[11px] break-all">
                      {entry.configPath}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 pt-0">
                    <pre className="rounded-md border bg-muted/30 p-3 font-mono text-xs whitespace-pre-wrap break-all">
                      {entry.command}
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
        {profiles.length === 0 ? (
          <Empty className="border-none py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Terminal />
              </EmptyMedia>
              <EmptyTitle className="text-sm font-normal text-muted-foreground">
                {t('envvar.shellProfiles.noContent')}
              </EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <ScrollArea className="h-full min-h-0">
            <div className="space-y-3 p-3 sm:p-4">
              {profiles.map((profile) => {
                const isExpanded = expandedProfile === profile.configPath;
                return (
                  <Card
                    key={profile.configPath}
                    className={cn(
                      'overflow-hidden',
                      profile.isCurrent && 'border-l-2 border-l-primary',
                      !profile.exists && 'border-dashed',
                    )}
                  >
                    <Collapsible open={isExpanded}>
                      <CardHeader className="px-4 py-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <CardTitle className="flex items-center gap-2 text-sm">
                            <FileCode className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold capitalize">{profile.shell}</span>
                            {profile.isCurrent && (
                              <Badge variant="default" className="text-[10px]">
                                {t('envvar.shellProfiles.current')}
                              </Badge>
                            )}
                            {!profile.exists && (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                {t('envvar.shellProfiles.noContent')}
                              </Badge>
                            )}
                          </CardTitle>
                          <div className="flex flex-wrap items-center gap-2">
                            <code className="font-mono text-[11px] text-muted-foreground">
                              {profile.configPath}
                            </code>
                            {profile.exists && (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => handleOpenFile(profile.configPath)}
                                      aria-label={t('envvar.shellProfiles.openFile')}
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{t('envvar.shellProfiles.openFile')}</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => handleRevealInFolder(profile.configPath)}
                                      aria-label={t('envvar.shellProfiles.openFolder')}
                                    >
                                      <FolderOpen className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{t('envvar.shellProfiles.openFolder')}</TooltipContent>
                                </Tooltip>
                                <CollapsibleTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 gap-1.5"
                                    onClick={() => handleToggle(profile.configPath)}
                                  >
                                    {isExpanded ? (
                                      <><EyeOff className="h-3 w-3" />{t('common.close')}</>
                                    ) : (
                                      <><Eye className="h-3 w-3" />{t('envvar.shellProfiles.viewConfig')}</>
                                    )}
                                  </Button>
                                </CollapsibleTrigger>
                              </>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CollapsibleContent>
                        <CardContent className="px-4 pb-3 pt-0">
                          {isExpanded && profileContent && !loadingProfile && (
                            <div className="mb-2 flex items-center justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1.5 text-xs"
                                onClick={handleCopyContent}
                              >
                                {copied ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                                {copied ? t('envvar.table.copied') : t('common.copy')}
                              </Button>
                            </div>
                          )}
                          <ScrollArea className="h-75 rounded-md border bg-muted/30">
                            {loadingProfile ? (
                              <div className="space-y-2 p-3">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-5/6" />
                                <Skeleton className="h-4 w-2/3" />
                                <Skeleton className="h-4 w-full" />
                              </div>
                            ) : !profileContent ? (
                              <div className="flex items-center justify-center p-6 text-xs text-muted-foreground">
                                {t('envvar.shellProfiles.noContent')}
                              </div>
                            ) : (
                              <div className="flex">
                                {/* Line numbers gutter */}
                                <div
                                  className="shrink-0 select-none border-r bg-muted/40 px-2 py-3 text-right font-mono text-[10px] leading-[1.625rem] text-muted-foreground/50"
                                  aria-hidden="true"
                                >
                                  {Array.from({ length: lineCount }, (_, i) => (
                                    <div key={i}>{i + 1}</div>
                                  ))}
                                </div>
                                {/* Code content */}
                                <pre
                                  className="hljs min-w-0 flex-1 p-3 font-mono text-xs whitespace-pre-wrap break-all"
                                  dangerouslySetInnerHTML={{
                                    __html: highlightedHtml,
                                  }}
                                />
                              </div>
                            )}
                          </ScrollArea>
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
