'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { FolderOpen, FolderInput, Link2, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { isTauri } from '@/lib/tauri';
import type { CachePathInfo } from '@/lib/tauri';
import type { CachePathCardProps } from '@/types/cache';
import { emitInvalidations } from '@/lib/cache/invalidation';
import { CacheMigrationDialog } from './cache-migration-dialog';

export function CachePathCard({ refreshTrigger, onPathChanged }: CachePathCardProps) {
  const { t } = useLocale();
  const [pathInfo, setPathInfo] = useState<CachePathInfo | null>(null);
  const [newPath, setNewPath] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [migrationOpen, setMigrationOpen] = useState(false);

  const fetchPathInfo = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const { getCachePathInfo } = await import('@/lib/tauri');
      const info = await getCachePathInfo();
      setPathInfo(info);
    } catch (err) {
      console.error('Failed to fetch cache path info:', err);
    }
  }, []);

  useEffect(() => {
    fetchPathInfo();
  }, [fetchPathInfo, refreshTrigger]);

  const handleChangePath = async () => {
    if (!newPath.trim() || !isTauri()) return;
    setSaving(true);
    try {
      const { setCachePath } = await import('@/lib/tauri');
      await setCachePath(newPath.trim());
      toast.success(t('cache.pathChanged'));
      setEditing(false);
      setNewPath('');
      fetchPathInfo();
      onPathChanged?.();
      emitInvalidations(
        ['cache_overview', 'cache_entries', 'about_cache_stats'],
        'cache-path:changed',
      );
    } catch (e) {
      toast.error(`${t('cache.pathChangeFailed')}: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPath = async () => {
    if (!isTauri()) return;
    setSaving(true);
    try {
      const { resetCachePath } = await import('@/lib/tauri');
      await resetCachePath();
      toast.success(t('cache.pathReset'));
      fetchPathInfo();
      onPathChanged?.();
      emitInvalidations(
        ['cache_overview', 'cache_entries', 'about_cache_stats'],
        'cache-path:reset',
      );
    } catch (e) {
      toast.error(`${t('cache.pathResetFailed')}: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleBrowse = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const dialogModule = await import('@tauri-apps/plugin-dialog').catch(() => null);
      if (dialogModule?.open) {
        const selected = await dialogModule.open({
          directory: true,
          multiple: false,
          title: t('cache.enterNewPath'),
        });
        if (typeof selected === 'string') {
          setNewPath(selected);
        }
      }
    } catch (err) {
      console.error('Failed to open folder dialog:', err);
    }
  }, [t]);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FolderOpen className="h-4 w-4" />
            {t('cache.pathManagement')}
            {pathInfo?.isSymlink && (
              <Badge variant="secondary" className="gap-1 text-[10px] px-1.5 py-0">
                <Link2 className="h-2.5 w-2.5" /> {t('cache.symlink')}
              </Badge>
            )}
            {pathInfo?.isCustom && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{t('cache.customPath')}</Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">{t('cache.pathManagementDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!pathInfo ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-14" />
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          ) : (
            <>
              {/* Paths Section */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{t('cache.currentPath')}</p>
                  <p className="text-xs font-mono bg-muted/50 px-2 py-1.5 rounded break-all">{pathInfo.currentPath}</p>
                </div>

                {pathInfo.isSymlink && pathInfo.symlinkTarget && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{t('cache.symlinkTarget')}</p>
                    <p className="text-xs font-mono bg-muted/50 px-2 py-1.5 rounded break-all">{pathInfo.symlinkTarget}</p>
                  </div>
                )}

                {pathInfo.isCustom && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{t('cache.defaultPath')}</p>
                    <p className="text-xs font-mono bg-muted/50 px-2 py-1.5 rounded break-all">{pathInfo.defaultPath}</p>
                  </div>
                )}
              </div>

              {/* Status badges */}
              <div className="flex flex-wrap gap-1.5">
                <Badge variant={pathInfo.exists ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
                  {pathInfo.exists ? t('cache.exists') : t('cache.missing')}
                </Badge>
                <Badge variant={pathInfo.writable ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
                  {pathInfo.writable ? t('cache.writable') : t('cache.readOnly')}
                </Badge>
                {pathInfo.diskAvailable > 0 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {t('cache.diskAvailable')}: {pathInfo.diskAvailableHuman}
                  </Badge>
                )}
              </div>

              {/* Change Path */}
              {editing ? (
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    <Input
                      value={newPath}
                      onChange={(e) => setNewPath(e.target.value)}
                      placeholder={t('cache.enterNewPath')}
                      disabled={saving}
                      className="h-7 text-xs flex-1"
                    />
                    {isTauri() && (
                      <Button size="icon" variant="outline" onClick={handleBrowse} disabled={saving} className="h-7 w-7 shrink-0">
                        <FolderOpen className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" onClick={handleChangePath} disabled={!newPath.trim() || saving} className="h-7 text-xs">
                      <Save className="h-3 w-3 mr-1" />
                      {saving ? '...' : t('cache.changePath')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditing(false); setNewPath(''); }} className="h-7 text-xs">
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="h-7 text-xs">
                        <FolderInput className="h-3 w-3 mr-1" />
                        {t('cache.changePath')}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('cache.pathManagementDesc')}</TooltipContent>
                  </Tooltip>
                  {pathInfo.isCustom && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="outline" onClick={handleResetPath} disabled={saving} className="h-7 text-xs">
                          <RotateCcw className="h-3 w-3 mr-1" />
                          {t('cache.resetPath')}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('cache.defaultPath')}</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="outline" onClick={() => setMigrationOpen(true)} className="h-7 text-xs">
                        <FolderInput className="h-3 w-3 mr-1" />
                        {t('cache.migration')}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('cache.migrationDesc')}</TooltipContent>
                  </Tooltip>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <CacheMigrationDialog
        open={migrationOpen}
        onOpenChange={setMigrationOpen}
        onMigrationComplete={() => {
          fetchPathInfo();
          onPathChanged?.();
        }}
      />
    </>
  );
}
