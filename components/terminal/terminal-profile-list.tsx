'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Pencil, Trash2, Star, Plus, Loader2, Copy, Download, Upload } from 'lucide-react';
import type { LaunchResult, TerminalProfile } from '@/types/tauri';
import { useLocale } from '@/components/providers/locale-provider';

interface TerminalProfileListProps {
  profiles: TerminalProfile[];
  onLaunch: (id: string) => void;
  onEdit: (profile: TerminalProfile) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  onCreateNew: () => void;
  onDuplicate?: (id: string) => void;
  onExportAll?: () => void;
  onImport?: (json: string, merge: boolean) => void;
  launchingProfileId?: string | null;
  lastLaunchResult?: {
    profileId: string;
    result: LaunchResult;
  } | null;
  onClearLaunchResult?: () => void;
}

export function TerminalProfileList({
  profiles,
  onLaunch,
  onEdit,
  onDelete,
  onSetDefault,
  onCreateNew,
  onDuplicate,
  onExportAll,
  onImport,
  launchingProfileId = null,
  lastLaunchResult = null,
  onClearLaunchResult,
}: TerminalProfileListProps) {
  const { t } = useLocale();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{t('terminal.profiles')}</h3>
        <div className="flex items-center gap-2">
          {onExportAll && profiles.length > 0 && (
            <Button size="sm" variant="outline" onClick={onExportAll}>
              <Download className="mr-1 h-3.5 w-3.5" />
              {t('terminal.exportProfiles')}
            </Button>
          )}
          {onImport && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    const text = await file.text();
                    onImport(text, true);
                  }
                };
                input.click();
              }}
            >
              <Upload className="mr-1 h-3.5 w-3.5" />
              {t('terminal.importProfiles')}
            </Button>
          )}
          <Button size="sm" onClick={onCreateNew}>
            <Plus className="mr-2 h-4 w-4" />
            {t('terminal.createProfile')}
          </Button>
        </div>
      </div>

      {lastLaunchResult && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">{t('terminal.lastLaunchResult')}</CardTitle>
                <CardDescription>
                  {t('terminal.profileId')}: {lastLaunchResult.profileId}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={lastLaunchResult.result.success ? 'secondary' : 'destructive'}>
                  {lastLaunchResult.result.success ? t('terminal.launchSuccess') : t('terminal.launchFailed')}
                </Badge>
                <Badge variant="outline">
                  {t('terminal.exitCode')}: {lastLaunchResult.result.exitCode}
                </Badge>
                {onClearLaunchResult && (
                  <Button variant="ghost" size="sm" onClick={onClearLaunchResult}>
                    {t('terminal.clearLaunchResult')}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">stdout</p>
              <pre className="max-h-40 overflow-auto rounded-md border bg-muted/30 p-2 text-xs whitespace-pre-wrap">
                {lastLaunchResult.result.stdout || t('terminal.noOutput')}
              </pre>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">stderr</p>
              <pre className="max-h-40 overflow-auto rounded-md border bg-muted/30 p-2 text-xs whitespace-pre-wrap">
                {lastLaunchResult.result.stderr || t('terminal.noOutput')}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {profiles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">{t('terminal.noProfiles')}</p>
            <Button variant="outline" className="mt-4" onClick={onCreateNew}>
              <Plus className="mr-2 h-4 w-4" />
              {t('terminal.createFirst')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {profiles.map((profile) => {
            const isLaunching = launchingProfileId === profile.id;

            return (
              <Card key={profile.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{profile.name}</CardTitle>
                    {profile.isDefault && (
                      <Badge variant="secondary" className="gap-1">
                        <Star className="h-3 w-3" />
                        {t('terminal.default')}
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    {profile.shellId}
                    {profile.envType && ` + ${profile.envType}${profile.envVersion ? ` ${profile.envVersion}` : ''}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => onLaunch(profile.id)}
                      disabled={isLaunching}
                    >
                      {isLaunching ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="mr-1 h-3 w-3" />
                      )}
                      {isLaunching ? t('terminal.launching') : t('terminal.launch')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onEdit(profile)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    {onDuplicate && (
                      <Button size="sm" variant="outline" onClick={() => onDuplicate(profile.id)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                    {!profile.isDefault && (
                      <Button size="sm" variant="outline" onClick={() => onSetDefault(profile.id)}>
                        <Star className="h-3 w-3" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(profile.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
