'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
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
import { FileCode, Eye, EyeOff, Terminal } from 'lucide-react';
import type { ShellProfileInfo } from '@/types/tauri';

interface EnvVarShellProfilesProps {
  profiles: ShellProfileInfo[];
  onReadProfile: (path: string) => Promise<string | null>;
  t: (key: string) => string;
}

export function EnvVarShellProfiles({
  profiles,
  onReadProfile,
  t,
}: EnvVarShellProfilesProps) {
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const [profileContent, setProfileContent] = useState<string>('');
  const [loadingProfile, setLoadingProfile] = useState(false);

  const handleToggle = useCallback(async (configPath: string) => {
    if (expandedProfile === configPath) {
      setExpandedProfile(null);
      setProfileContent('');
      return;
    }

    setLoadingProfile(true);
    setExpandedProfile(configPath);
    const content = await onReadProfile(configPath);
    setProfileContent(content || t('envvar.shellProfiles.noContent'));
    setLoadingProfile(false);
  }, [expandedProfile, onReadProfile, t]);

  if (profiles.length === 0) {
    return (
      <Empty className="border-none py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Terminal />
          </EmptyMedia>
          <EmptyTitle className="text-sm font-normal text-muted-foreground">
            {t('envvar.shellProfiles.noContent')}
          </EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      {profiles.map((profile) => {
        const isExpanded = expandedProfile === profile.configPath;
        return (
          <Card key={profile.configPath} className="overflow-hidden">
            <Collapsible open={isExpanded}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
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
                  <div className="flex items-center gap-2">
                    <code className="text-[11px] text-muted-foreground font-mono">
                      {profile.configPath}
                    </code>
                    {profile.exists && (
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
                    )}
                  </div>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="px-4 pb-3 pt-0">
                  <ScrollArea className="h-[300px] rounded-md border bg-muted/30 p-3">
                    {loadingProfile ? (
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-5/6" />
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    ) : (
                      <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                        {profileContent}
                      </pre>
                    )}
                  </ScrollArea>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}
    </div>
  );
}
