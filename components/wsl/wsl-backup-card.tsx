"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Archive,
  RefreshCw,
  Plus,
  Trash2,
  RotateCw,
  Loader2,
  FolderOpen,
} from "lucide-react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { toast } from "sonner";
import { formatBytes } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { resolveWslWorkspaceScopedTarget } from "@/lib/wsl/workflow";

interface BackupEntry {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  createdAt: string;
  distroName: string;
}

interface WslBackupCardProps {
  distroNames: string[];
  activeWorkspaceDistroName?: string | null;
  backupDistro: (name: string, destDir: string) => Promise<BackupEntry>;
  listBackups: (backupDir: string) => Promise<BackupEntry[]>;
  restoreBackup: (
    backupPath: string,
    name: string,
    installLocation: string,
  ) => Promise<void>;
  deleteBackup: (backupPath: string) => Promise<void>;
  onRestoreSuccess?: () => Promise<void> | void;
  onMutationSuccess?: () => Promise<void> | void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const DEFAULT_BACKUP_DIR = "%USERPROFILE%\\WSL-Backups";

function resolveBackupDir(dir: string): string {
  const userProfile =
    typeof window !== "undefined"
      ? (window as unknown as { __USERPROFILE__?: string }).__USERPROFILE__
      : undefined;
  if (dir === DEFAULT_BACKUP_DIR && userProfile) {
    return `${userProfile}\\WSL-Backups`;
  }
  return dir;
}

export function WslBackupCard({
  distroNames,
  activeWorkspaceDistroName,
  backupDistro,
  listBackups,
  restoreBackup,
  deleteBackup,
  onRestoreSuccess,
  onMutationSuccess,
  t,
}: WslBackupCardProps) {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backupDir, setBackupDir] = useState(DEFAULT_BACKUP_DIR);
  const [deleteTarget, setDeleteTarget] = useState<BackupEntry | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BackupEntry | null>(null);
  const [restoreName, setRestoreName] = useState("");
  const [restoreLocation, setRestoreLocation] = useState("");
  const [overrideDistroName, setOverrideDistroName] = useState<string | null>(
    null,
  );
  const [lifecycleState, setLifecycleState] = useState<{
    status: "success" | "failed";
    title: string;
    details?: string;
  } | null>(null);
  const targetResolution = useMemo(
    () =>
      resolveWslWorkspaceScopedTarget({
        activeWorkspaceDistroName,
        overrideDistroName,
        availableDistroNames: distroNames,
        fallbackDistroName: distroNames[0] ?? null,
      }),
    [activeWorkspaceDistroName, distroNames, overrideDistroName],
  );
  const selectedDistro = targetResolution.distroName ?? "";

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const resolved = resolveBackupDir(backupDir);
      const result = await listBackups(resolved);
      setBackups(result);
    } catch {
      setBackups([]);
    } finally {
      setLoading(false);
    }
  }, [backupDir, listBackups]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (overrideDistroName && !distroNames.includes(overrideDistroName)) {
      setOverrideDistroName(null);
    }
  }, [distroNames, overrideDistroName]);

  // Auto-dismiss success feedback after 5 seconds
  useEffect(() => {
    if (lifecycleState?.status === "success") {
      const timer = setTimeout(() => setLifecycleState(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [lifecycleState]);

  const sortedBackups = useMemo(
    () =>
      [...backups].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [backups],
  );

  const totalSize = useMemo(
    () => backups.reduce((sum, b) => sum + b.sizeBytes, 0),
    [backups],
  );

  const handleCreate = useCallback(async () => {
    if (!selectedDistro) return;
    setCreating(true);
    try {
      const resolved = resolveBackupDir(backupDir);
      const backup = await backupDistro(selectedDistro, resolved);
      toast.success(t("wsl.backupMgmt.created"));
      await refresh();
      await onMutationSuccess?.();
      setLifecycleState({
        status: "success",
        title: t("wsl.backupMgmt.created"),
        details: backup.fileName,
      });
    } catch (err) {
      toast.error(String(err));
      setLifecycleState({
        status: "failed",
        title: t("wsl.workflow.failed").replace(
          "{action}",
          t("wsl.backupMgmt.create"),
        ),
        details: String(err),
      });
    } finally {
      setCreating(false);
    }
  }, [backupDistro, selectedDistro, backupDir, onMutationSuccess, refresh, t]);

  const handleRestore = useCallback(async () => {
    if (!restoreTarget || !restoreName.trim() || !restoreLocation.trim())
      return;
    setRestoring(true);
    try {
      await restoreBackup(
        restoreTarget.filePath,
        restoreName.trim(),
        restoreLocation.trim(),
      );
      toast.success(t("wsl.backupMgmt.restored"));
      setRestoreTarget(null);
      setRestoreName("");
      setRestoreLocation("");
      await refresh();
      await onRestoreSuccess?.();
      await onMutationSuccess?.();
      setLifecycleState({
        status: "success",
        title: t("wsl.backupMgmt.restored"),
        details: restoreTarget.fileName,
      });
    } catch (err) {
      toast.error(String(err));
      setLifecycleState({
        status: "failed",
        title: t("wsl.workflow.failed").replace(
          "{action}",
          t("wsl.backupMgmt.restore"),
        ),
        details: String(err),
      });
    } finally {
      setRestoring(false);
    }
  }, [
    onMutationSuccess,
    onRestoreSuccess,
    refresh,
    restoreBackup,
    restoreTarget,
    restoreName,
    restoreLocation,
    t,
  ]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteBackup(deleteTarget.filePath);
      toast.success(t("wsl.backupMgmt.deleted"));
      setDeleteTarget(null);
      await refresh();
      await onMutationSuccess?.();
      setLifecycleState({
        status: "success",
        title: t("wsl.backupMgmt.deleted"),
      });
    } catch (err) {
      toast.error(String(err));
      setLifecycleState({
        status: "failed",
        title: t("wsl.workflow.failed").replace(
          "{action}",
          t("wsl.backupMgmt.delete"),
        ),
        details: String(err),
      });
    }
  }, [deleteBackup, deleteTarget, onMutationSuccess, refresh, t]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Archive className="h-4 w-4 text-muted-foreground" />
            {t("wsl.backupMgmt.title")}
            {backups.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {backups.length}
              </Badge>
            )}
          </CardTitle>
          <CardAction>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={refresh}
                  disabled={loading}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("common.refresh")}</TooltipContent>
            </Tooltip>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          {lifecycleState && (
            <Alert
              data-testid="wsl-backup-lifecycle-feedback"
              variant={
                lifecycleState.status === "failed" ? "destructive" : "default"
              }
            >
              <AlertDescription className="space-y-1">
                <p className="font-medium">{lifecycleState.title}</p>
                {lifecycleState.details && (
                  <p className="text-xs text-muted-foreground">
                    {lifecycleState.details}
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}
          {activeWorkspaceDistroName && selectedDistro && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                {targetResolution.followsWorkspace
                  ? t("wsl.workspaceContext.following").replace(
                      "{name}",
                      selectedDistro,
                    )
                  : t("wsl.workspaceContext.override").replace(
                      "{name}",
                      selectedDistro,
                    )}
              </span>
              {!targetResolution.followsWorkspace && (
                <>
                  <span>
                    {t("wsl.workspaceContext.active").replace(
                      "{name}",
                      activeWorkspaceDistroName,
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setOverrideDistroName(null)}
                  >
                    {t("wsl.workspaceContext.return")}
                  </Button>
                </>
              )}
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">{t("wsl.backupMgmt.backupDir")}</Label>
              <div className="flex gap-1">
                <Input
                  className="h-9 text-xs flex-1"
                  value={backupDir}
                  onChange={(e) => setBackupDir(e.target.value)}
                  placeholder={DEFAULT_BACKUP_DIR}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={async () => {
                    try {
                      const { open } =
                        await import("@tauri-apps/plugin-dialog");
                      const selected = await open({ directory: true });
                      if (selected) setBackupDir(String(selected));
                    } catch {
                      /* not in Tauri */
                    }
                  }}
                >
                  <FolderOpen className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {distroNames.length > 1 ? (
              <select
                className="h-9 text-xs border rounded px-2 flex-1 bg-background"
                value={selectedDistro}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  if (
                    !activeWorkspaceDistroName
                    || nextValue === activeWorkspaceDistroName
                  ) {
                    setOverrideDistroName(null);
                    return;
                  }
                  setOverrideDistroName(nextValue);
                }}
              >
                {distroNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-muted-foreground flex-1 truncate">
                {selectedDistro || "—"}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1 text-xs w-full sm:w-auto"
              disabled={creating || !selectedDistro || !backupDir.trim()}
              onClick={handleCreate}
            >
              {creating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              {t("wsl.backupMgmt.create")}
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : backups.length === 0 ? (
            <Empty className="border-none py-4">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Archive />
                </EmptyMedia>
                <EmptyTitle className="text-sm font-normal text-muted-foreground">
                  {t("wsl.backupMgmt.noBackups")}
                </EmptyTitle>
                <EmptyDescription className="text-xs">
                  {t("wsl.backupMgmt.noBackupsDesc")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1.5">
                {sortedBackups.map((b) => (
                  <div
                    key={b.filePath}
                    className="flex items-center justify-between rounded-md border px-3 py-2 group"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">
                        {b.fileName}
                      </p>
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
                              setRestoreName(b.distroName + "-restored");
                              setRestoreLocation(`C:\\WSL\\${b.distroName}-restored`);
                            }}
                          >
                            <RotateCw className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t("wsl.backupMgmt.restore")}
                        </TooltipContent>
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
                        <TooltipContent>
                          {t("wsl.backupMgmt.delete")}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
              {sortedBackups.length > 0 && (
                <div className="text-xs text-muted-foreground text-right pt-2">
                  {t("wsl.backupMgmt.totalSize")}: {formatBytes(totalSize)}
                </div>
              )}
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Restore Dialog */}
      <AlertDialog
        open={!!restoreTarget}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("wsl.backupMgmt.restore")}</AlertDialogTitle>
            <AlertDialogDescription>
              {restoreTarget?.fileName}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">
                {t("wsl.backupMgmt.distroName")}
              </Label>
              <Input
                className="h-9 text-xs"
                value={restoreName}
                onChange={(e) => setRestoreName(e.target.value)}
                placeholder="Ubuntu-restored"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                {t("wsl.backupMgmt.installLocation")}
              </Label>
              <Input
                className="h-9 text-xs"
                value={restoreLocation}
                onChange={(e) => setRestoreLocation(e.target.value)}
                placeholder="C:\\WSL\\restored"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={
                restoring || !restoreName.trim() || !restoreLocation.trim()
              }
              onClick={handleRestore}
            >
              {restoring && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t("wsl.backupMgmt.restore")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("wsl.backupMgmt.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("wsl.backupMgmt.deleteConfirm")}
              <br />
              <span className="font-mono text-xs">
                {deleteTarget?.fileName}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("wsl.backupMgmt.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
