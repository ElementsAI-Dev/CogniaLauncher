'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, FolderOpen, FolderInput, Link2, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { isTauri } from '@/lib/tauri';
import type { CachePathInfo } from '@/lib/tauri';
import { CacheMigrationDialog } from './cache-migration-dialog';

interface CachePathCardProps {
  refreshTrigger?: number;
  onPathChanged?: () => void;
}

export function CachePathCard({ refreshTrigger, onPathChanged }: CachePathCardProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
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
    } catch {
      // silently fail
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
    } catch (e) {
      toast.error(`${t('cache.pathResetFailed')}: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <Collapsible open={open} onOpenChange={(o) => { setOpen(o); if (o) fetchPathInfo(); }}>
          <CardHeader className="pb-2">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  <CardTitle className="text-base">{t('cache.pathManagement')}</CardTitle>
                  {pathInfo?.isSymlink && (
                    <Badge variant="secondary" className="gap-1">
                      <Link2 className="h-3 w-3" /> Symlink
                    </Badge>
                  )}
                  {pathInfo?.isCustom && (
                    <Badge variant="outline">{t('cache.customPath')}</Badge>
                  )}
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
              </div>
            </CollapsibleTrigger>
            <CardDescription>{t('cache.pathManagementDesc')}</CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <Separator />

              {pathInfo && (
                <div className="space-y-3">
                  {/* Current Path */}
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">{t('cache.currentPath')}</p>
                    <p className="text-sm font-mono bg-muted/50 p-2 rounded break-all">{pathInfo.currentPath}</p>
                  </div>

                  {/* Symlink Target */}
                  {pathInfo.isSymlink && pathInfo.symlinkTarget && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">{t('cache.symlinkTarget')}</p>
                      <p className="text-sm font-mono bg-muted/50 p-2 rounded break-all">{pathInfo.symlinkTarget}</p>
                    </div>
                  )}

                  {/* Default Path */}
                  {pathInfo.isCustom && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">{t('cache.defaultPath')}</p>
                      <p className="text-sm font-mono bg-muted/50 p-2 rounded break-all">{pathInfo.defaultPath}</p>
                    </div>
                  )}

                  {/* Status badges */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={pathInfo.exists ? 'default' : 'destructive'}>
                      {pathInfo.exists ? 'Exists' : 'Missing'}
                    </Badge>
                    <Badge variant={pathInfo.writable ? 'default' : 'destructive'}>
                      {pathInfo.writable ? 'Writable' : 'Read-only'}
                    </Badge>
                    {pathInfo.diskAvailable > 0 && (
                      <Badge variant="outline">{t('cache.diskAvailable')}: {pathInfo.diskAvailableHuman}</Badge>
                    )}
                  </div>

                  {/* Change Path */}
                  {editing ? (
                    <div className="space-y-2">
                      <Input
                        value={newPath}
                        onChange={(e) => setNewPath(e.target.value)}
                        placeholder={t('cache.enterNewPath')}
                        disabled={saving}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleChangePath} disabled={!newPath.trim() || saving}>
                          <Save className="h-4 w-4 mr-1" />
                          {saving ? '...' : t('cache.changePath')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditing(false); setNewPath(''); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                        <FolderInput className="h-4 w-4 mr-1" />
                        {t('cache.changePath')}
                      </Button>
                      {pathInfo.isCustom && (
                        <Button size="sm" variant="outline" onClick={handleResetPath} disabled={saving}>
                          <RotateCcw className="h-4 w-4 mr-1" />
                          {t('cache.resetPath')}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setMigrationOpen(true)}>
                        <FolderInput className="h-4 w-4 mr-1" />
                        {t('cache.migration')}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
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
