'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Archive, RefreshCw, Plus, Trash2, RotateCw, Loader2, FolderOpen } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { toast } from 'sonner';
import { formatBytes } from '@/lib/utils';
import {
  isTauri,
  wslBackupDistro,
  wslListBackups,
  wslRestoreBackup,
  wslDeleteBackup,
} from '@/lib/tauri';

interface BackupEntry {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  createdAt: string;
  distroName: string;
}

interface WslBackupCardProps {
  distroNames: string[];
  t: (key: string, params?: Record<string, string | number>) => string;
}

const DEFAULT_BACKUP_DIR = '%USERPROFILE%\\WSL-Backups';

function resolveBackupDir(dir: string): string {
  const userProfile = typeof window !== 'undefined'
    ? (window as Record<string, unknown>).__USERPROFILE__ as string | undefined
    : undefined;
  if (dir === DEFAULT_BACKUP_DIR && userProfile) {
    return `${userProfile}\\WSL-Backups`;
  }
  return dir;
}

export function WslBackupCard({ distroNames, t }: WslBackupCardProps) {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backupDir, setBackupDir] = useState(DEFAULT_BACKUP_DIR);
  const [deleteTarget, setDeleteTarget] = useState<BackupEntry | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BackupEntry | null>(null);
  const [restoreName, setRestoreName] = useState('');
  const [restoreLocation, setRestoreLocation] = useState('');
  const [selectedDistro, setSelectedDistro] = useState('');

  const refresh = useCallback(async () => {
    if (!isTauri()) return;
    setLoading(true);
    try {
      const resolved = resolveBackupDir(backupDir);
      const result = await wslListBackups(resolved);
      setBackups(result);
    } catch {
      setBackups([]);
    } finally {
      setLoading(false);
    }
  }, [backupDir]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (distroNames.length > 0 && !selectedDistro) {
      setSelectedDistro(distroNames[0]);
    }
  }, [distroNames, selectedDistro]);

  const handleCreate = useCallback(async () => {
    if (!selectedDistro || !isTauri()) return;
    setCreating(true);
    try {
      const resolved = resolveBackupDir(backupDir);
      await wslBackupDistro(selectedDistro, resolved);
      toast.success(t('wsl.backupMgmt.created'));
      await refresh();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setCreating(false);
    }
  }, [selectedDistro, backupDir, refresh, t]);

  const handleRestore = useCallback(async () => {
    if (!restoreTarget || !restoreName.trim() || !restoreLocation.trim()) return;
    setRestoring(true);
    try {
      await wslRestoreBackup(restoreTarget.filePath, restoreName.trim(), restoreLocation.trim());
      toast.success(t('wsl.backupMgmt.restored'));
      setRestoreTarget(null);
      setRestoreName('');
      setRestoreLocation('');
    } catch (err) {
      toast.error(String(err));
    } finally {
      setRestoring(false);
    }
  }, [restoreTarget, restoreName, restoreLocation, t]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await wslDeleteBackup(deleteTarget.filePath);
      toast.success(t('wsl.backupMgmt.deleted'));
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      toast.error(String(err));
    }
  }, [deleteTarget, refresh, t]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Archive className="h-4 w-4 text-muted-foreground" />
            {t('wsl.backupMgmt.title')}
            {backups.length > 0 && (
              <Badge variant="secondary" className="text-xs">{backups.length}</Badge>
            )}
          </CardTitle>
          <CardAction>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={refresh} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('common.refresh')}</TooltipContent>
            </Tooltip>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">{t('wsl.backupMgmt.backupDir')}</Label>
              <div className="flex gap-1">
                <Input
                  className="h-7 text-xs flex-1"
                  value={backupDir}
                  onChange={(e) => setBackupDir(e.target.value)}
                  placeholder={DEFAULT_BACKUP_DIR}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={async () => {
                    try {
                      const { open } = await import('@tauri-apps/plugin-dialog');
                      const selected = await open({ directory: true });
                      if (selected) setBackupDir(String(selected));
                    } catch { /* not in Tauri */ }
                  }}
                >
                  <FolderOpen className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {distroNames.length > 1 ? (
              <select
                className="h-7 text-xs border rounded px-2 flex-1 bg-background"
                value={selectedDistro}
                onChange={(e) => setSelectedDistro(e.target.value)}
              >
                {distroNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-muted-foreground flex-1 truncate">
                {selectedDistro || '—'}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              disabled={creating || !selectedDistro}
              onClick={handleCreate}
            >
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              {t('wsl.backupMgmt.create')}
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : backups.length === 0 ? (
            <Empty className="border-none py-4">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Archive /></EmptyMedia>
                <EmptyTitle className="text-sm font-normal text-muted-foreground">
                  {t('wsl.backupMgmt.noBackups')}
                </EmptyTitle>
                <EmptyDescription className="text-xs">
                  {t('wsl.backupMgmt.noBackupsDesc')}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1.5">
                {backups.map((b) => (
                  <div
                    key={b.filePath}
                    className="flex items-center justify-between rounded-md border px-3 py-2 group"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{b.fileName}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{b.distroName}</span>
                        <span>{formatBytes(b.sizeBytes)}</span>
                        <span>{new Date(b.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              setRestoreTarget(b);
                              setRestoreName(b.distroName + '-restored');
                            }}
                          >
                            <RotateCw className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('wsl.backupMgmt.restore')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => setDeleteTarget(b)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('wsl.backupMgmt.delete')}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Restore Dialog */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('wsl.backupMgmt.restore')}</AlertDialogTitle>
            <AlertDialogDescription>
              {restoreTarget?.fileName}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">{t('wsl.backupMgmt.distroName')}</Label>
              <Input
                className="h-8 text-xs"
                value={restoreName}
                onChange={(e) => setRestoreName(e.target.value)}
                placeholder="Ubuntu-restored"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('wsl.backupMgmt.installLocation')}</Label>
              <Input
                className="h-8 text-xs"
                value={restoreLocation}
                onChange={(e) => setRestoreLocation(e.target.value)}
                placeholder="C:\WSL\restored"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={restoring || !restoreName.trim() || !restoreLocation.trim()}
              onClick={handleRestore}
            >
              {restoring && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t('wsl.backupMgmt.restore')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('wsl.backupMgmt.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('wsl.backupMgmt.deleteConfirm')}
              <br />
              <span className="font-mono text-xs">{deleteTarget?.fileName}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('wsl.backupMgmt.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
