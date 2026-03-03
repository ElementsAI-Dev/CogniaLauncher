'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { HardDrive, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import type { GitLfsCardProps } from '@/types/git';

export function GitLfsCard({
  lfsAvailable,
  lfsVersion,
  trackedPatterns,
  lfsFiles,
  loading,
  onCheckAvailability,
  onRefreshTrackedPatterns,
  onRefreshLfsFiles,
  onTrack,
  onUntrack,
  onInstall,
}: GitLfsCardProps) {
  const { t } = useLocale();
  const [pattern, setPattern] = useState('');
  const [busy, setBusy] = useState(false);

  const disabled = loading || busy;

  const refresh = async () => {
    setBusy(true);
    try {
      await onCheckAvailability();
      await onRefreshTrackedPatterns();
      await onRefreshLfsFiles();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <HardDrive className="h-4 w-4" />
          {t('git.lfs.title')}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs ml-auto"
            disabled={disabled}
            onClick={() => refresh()}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${disabled ? 'animate-spin' : ''}`} />
            {t('git.refresh')}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant={lfsAvailable ? 'default' : 'outline'}>
            {lfsAvailable ? t('git.lfs.available') : t('git.lfs.notAvailable')}
          </Badge>
          {lfsVersion && (
            <Badge variant="secondary">
              {t('git.lfs.version')}: {lfsVersion}
            </Badge>
          )}
          {lfsAvailable === false && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={disabled}
              onClick={async () => {
                setBusy(true);
                try {
                  const msg = await onInstall();
                  toast.success(t('git.lfs.installed'), { description: msg });
                  await refresh();
                } catch (e) {
                  toast.error(String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('git.lfs.install')}
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium">{t('git.lfs.trackedPatterns')}</p>
          {trackedPatterns.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('git.lfs.noPatterns')}</p>
          ) : (
            <div className="space-y-1">
              {trackedPatterns.map((tracked) => (
                <div key={tracked} className="flex items-center gap-2 text-xs group">
                  <code className="font-mono">{tracked}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const msg = await onUntrack(tracked);
                        toast.success(t('git.lfs.untrackSuccess'), { description: msg });
                        await onRefreshTrackedPatterns();
                      } catch (e) {
                        toast.error(String(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                    disabled={disabled}
                    title={t('git.lfs.untrack')}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder={t('git.lfs.trackPlaceholder')}
              className="h-7 text-xs font-mono"
              disabled={disabled}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={disabled || !pattern.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  const msg = await onTrack(pattern.trim());
                  toast.success(t('git.lfs.trackSuccess'), { description: msg });
                  setPattern('');
                  await onRefreshTrackedPatterns();
                } catch (e) {
                  toast.error(String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              {t('git.lfs.track')}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium">{t('git.lfs.files')}</p>
          {lfsFiles.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('git.lfs.noFiles')}</p>
          ) : (
            <div className="space-y-1">
              {lfsFiles.map((file) => (
                <div key={`${file.oid}-${file.name}`} className="text-xs flex items-center gap-2">
                  <code className="font-mono truncate">{file.name}</code>
                  <span className="text-muted-foreground">{file.pointerStatus}</span>
                  <span className="ml-auto text-muted-foreground font-mono">{file.oid.slice(0, 12)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
