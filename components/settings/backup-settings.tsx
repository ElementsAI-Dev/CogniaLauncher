"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Archive,
  CheckCircle2,
  Clock,
  Database,
  FileArchive,
  HardDrive,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useBackup } from "@/hooks/use-backup";
import { isTauri } from "@/lib/tauri";
import type {
  BackupContentType,
  BackupInfo,
  BackupOperationStatus,
  BackupValidationResult,
} from "@/types/tauri";

const ALL_CONTENT_TYPES: { key: BackupContentType; labelKey: string }[] = [
  { key: "config", labelKey: "backup.contentTypes.config" },
  { key: "terminal_profiles", labelKey: "backup.contentTypes.terminal_profiles" },
  { key: "environment_profiles", labelKey: "backup.contentTypes.environment_profiles" },
  { key: "cache_database", labelKey: "backup.contentTypes.cache_database" },
  { key: "download_history", labelKey: "backup.contentTypes.download_history" },
  { key: "cleanup_history", labelKey: "backup.contentTypes.cleanup_history" },
  { key: "custom_detection_rules", labelKey: "backup.contentTypes.custom_detection_rules" },
  { key: "environment_settings", labelKey: "backup.contentTypes.environment_settings" },
];

interface BackupSettingsProps {
  t: (key: string, params?: Record<string, string | number>) => string;
}

type BackupActionOutcome = {
  status: BackupOperationStatus;
  reasonCode?: string | null;
  issues?: { message: string }[];
  error?: string | null;
};

export function getBackupActionHint(reasonCode?: string | null): string | null {
  switch (reasonCode) {
    case "operation_in_progress":
      return "Another backup operation is running. Please wait for completion and retry.";
    case "restore_safety_backup_failed":
      return "Restore finished, but the safety backup step failed. Review backup integrity before continuing.";
    case "cleanup_policy_unbounded":
      return "Cleanup policy is unbounded (0/0), so no cleanup operation is performed.";
    case "backup_create_permission_denied":
    case "backup_restore_permission_denied":
    case "backup_delete_permission_denied":
    case "backup_export_permission_denied":
    case "backup_import_permission_denied":
    case "backup_cleanup_permission_denied":
      return "Operation failed due to insufficient file-system permissions.";
    case "backup_create_path_error":
    case "backup_restore_path_error":
    case "backup_delete_path_error":
    case "backup_export_path_error":
    case "backup_import_path_error":
    case "backup_import_path_conflict":
    case "backup_cleanup_path_error":
      return "Operation failed because the backup path is invalid, missing, or conflicts with existing data.";
    default:
      return null;
  }
}

function getOutcomeMessage(outcome: BackupActionOutcome): string {
  return (
    outcome.error ||
    getBackupActionHint(outcome.reasonCode) ||
    outcome.issues?.[0]?.message ||
    "Unknown error"
  );
}

export function BackupSettings({ t }: BackupSettingsProps) {
  const {
    backups,
    loading,
    error,
    creating,
    restoring,
    refresh,
    create,
    restore,
    remove,
    validate,
    checkIntegrity,
    getDatabaseInfo,
  } = useBackup();

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createNote, setCreateNote] = useState("");
  const [createContents, setCreateContents] = useState<BackupContentType[]>(
    ALL_CONTENT_TYPES.map((c) => c.key)
  );

  // Restore dialog state
  const [restoreTarget, setRestoreTarget] = useState<BackupInfo | null>(null);
  const [restoreContents, setRestoreContents] = useState<BackupContentType[]>([]);

  // Validation state
  const [validating, setValidating] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<BackupValidationResult | null>(null);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);

  // DB info state
  const [dbChecking, setDbChecking] = useState(false);

  const describeStatus = useCallback(
    (status: BackupOperationStatus) => {
      switch (status) {
        case "success":
          return "success";
        case "partial":
          return "partial";
        case "skipped":
          return "skipped";
        default:
          return "failed";
      }
    },
    [],
  );

  const handleCreateBackup = useCallback(async () => {
    const result = await create(createContents, createNote || undefined);
    const message = getOutcomeMessage(result);
    if (result.status === "success") {
      toast.success(t("backup.backupCreated", { duration: String(result.durationMs) }));
      setCreateOpen(false);
      setCreateNote("");
      setCreateContents(ALL_CONTENT_TYPES.map((c) => c.key));
      return;
    }

    if (result.status === "partial") {
      toast.warning(
        t("backup.backupFailed", {
          error: `${message} (${describeStatus(result.status)}, ${result.issues?.length ?? 0} issues)`,
        }),
      );
      setCreateOpen(false);
      return;
    }

    toast.error(t("backup.backupFailed", { error: message }));
  }, [create, createContents, createNote, describeStatus, t]);

  const handleRestore = useCallback(async () => {
    if (!restoreTarget) return;
    const result = await restore(restoreTarget.path, restoreContents);
    const hint = getBackupActionHint(result.reasonCode);
    if (result.status === "success") {
      toast.success(t("backup.restoreSuccess"));
      setRestoreTarget(null);
      return;
    }

    const skippedReason = result.skipped.map((s) => `${s.contentType}: ${s.reason}`).join(", ");
    const restoreError = result.error || hint || skippedReason || "Unknown error";
    if (result.status === "partial") {
      toast.warning(t("backup.restoreFailed", { error: restoreError }));
    } else {
      toast.error(t("backup.restoreFailed", { error: restoreError }));
    }
  }, [restore, restoreTarget, restoreContents, t]);

  const handleValidate = useCallback(async (backup: BackupInfo) => {
    setValidating(backup.path);
    const result = await validate(backup.path);
    setValidating(null);
    if (result) {
      setValidationResult(result);
      setValidationDialogOpen(true);
    }
  }, [validate]);

  const handleDelete = useCallback(async (backup: BackupInfo) => {
    const result = await remove(backup.path);
    const deleteError = getOutcomeMessage(result);
    if (result.status === "success" && result.deleted) {
      toast.success(t("backup.deleteSuccess"));
    } else if (result.status === "skipped") {
      toast.warning(deleteError);
    } else {
      toast.error(deleteError);
    }
  }, [remove, t]);

  const handleIntegrityCheck = useCallback(async () => {
    setDbChecking(true);
    const result = await checkIntegrity();
    setDbChecking(false);
    if (result) {
      if (result.ok) {
        toast.success(t("backup.database.integrityOk"));
      } else {
        toast.error(t("backup.database.integrityErrors", { count: String(result.errors.length) }));
      }
    }
  }, [checkIntegrity, t]);

  const handleDbInfo = useCallback(async () => {
    const info = await getDatabaseInfo();
    if (info) {
      toast.info(
        `${t("backup.database.dbSize")}: ${info.dbSizeHuman} | ${t("backup.database.walSize")}: ${info.walSizeHuman || "0 B"} | ${t("backup.database.pageCount")}: ${info.pageCount}`
      );
    }
  }, [getDatabaseInfo, t]);

  const toggleCreateContent = useCallback((key: BackupContentType) => {
    setCreateContents((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]
    );
  }, []);

  const toggleRestoreContent = useCallback((key: BackupContentType) => {
    setRestoreContents((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]
    );
  }, []);

  const openRestoreDialog = useCallback((backup: BackupInfo) => {
    setRestoreTarget(backup);
    setRestoreContents(backup.manifest.contents);
  }, []);

  if (!isTauri()) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("backup.description")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={creating}>
              {creating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {creating ? t("backup.creating") : t("backup.create")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("backup.create")}</DialogTitle>
              <DialogDescription>{t("backup.selectContents")}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="grid grid-cols-2 gap-2">
                {ALL_CONTENT_TYPES.map((ct) => (
                  <Label
                    key={ct.key}
                    className="flex items-center gap-2 cursor-pointer rounded-md border p-2 hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      checked={createContents.includes(ct.key)}
                      onCheckedChange={() => toggleCreateContent(ct.key)}
                    />
                    <span className="text-sm">{t(ct.labelKey)}</span>
                  </Label>
                ))}
              </div>
              <div>
                <Label htmlFor="backup-note" className="text-sm">
                  {t("backup.addNote")}
                </Label>
                <Input
                  id="backup-note"
                  value={createNote}
                  onChange={(e) => setCreateNote(e.target.value)}
                  placeholder={t("backup.addNote")}
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreateBackup}
                disabled={creating || createContents.length === 0}
              >
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t("backup.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleDbInfo}>
            <Database className="h-4 w-4 mr-2" />
            {t("backup.database.info")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleIntegrityCheck}
            disabled={dbChecking}
          >
            {dbChecking ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4 mr-2" />
            )}
            {t("backup.database.integrityCheck")}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {/* Backup list */}
      {loading && backups.length === 0 ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : backups.length === 0 ? (
        <Empty className="min-h-[220px] border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileArchive />
            </EmptyMedia>
            <EmptyTitle className="text-base">{t("backup.noBackups")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ScrollArea className="max-h-[480px]">
          <div className="flex flex-col gap-3 pr-3">
            {backups.map((backup) => (
              <BackupCard
                key={backup.path}
                backup={backup}
                t={t}
                validating={validating === backup.path}
                restoring={restoring && restoreTarget?.path === backup.path}
                onValidate={() => handleValidate(backup)}
                onRestore={() => openRestoreDialog(backup)}
                onDelete={() => handleDelete(backup)}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Restore confirmation dialog */}
      <AlertDialog
        open={restoreTarget !== null}
        onOpenChange={(open) => { if (!open) setRestoreTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("backup.restore")}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block text-destructive font-medium">
                {t("backup.restoreWarning")}
              </span>
              <span className="block">
                {t("backup.selectContents")}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-2 py-2">
            {restoreTarget?.manifest.contents.map((ct) => {
              const def = ALL_CONTENT_TYPES.find((c) => c.key === ct);
              if (!def) return null;
              return (
                <Label
                  key={ct}
                  className="flex items-center gap-2 cursor-pointer rounded-md border p-2 hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={restoreContents.includes(ct)}
                    onCheckedChange={() => toggleRestoreContent(ct)}
                  />
                  <span className="text-sm">{t(def.labelKey)}</span>
                </Label>
              );
            })}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              disabled={restoring || restoreContents.length === 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {restoring && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("backup.restore")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Validation result dialog */}
      <Dialog open={validationDialogOpen} onOpenChange={setValidationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("backup.validate")}</DialogTitle>
          </DialogHeader>
          {validationResult && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                {validationResult.valid ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium">{t("backup.validationPassed")}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-destructive" />
                    <span className="text-sm font-medium">{t("backup.validationFailed")}</span>
                  </>
                )}
              </div>
              {validationResult.missingFiles.length > 0 && (
                <div className="text-sm">
                  <span className="text-muted-foreground">
                    {t("backup.missingFiles", { count: String(validationResult.missingFiles.length) })}
                  </span>
                  <ul className="list-disc list-inside mt-1">
                    {validationResult.missingFiles.map((f) => (
                      <li key={f} className="text-xs text-muted-foreground">{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {validationResult.checksumMismatches.length > 0 && (
                <div className="text-sm">
                  <span className="text-muted-foreground">
                    {t("backup.checksumMismatches", { count: String(validationResult.checksumMismatches.length) })}
                  </span>
                  <ul className="list-disc list-inside mt-1">
                    {validationResult.checksumMismatches.map((f) => (
                      <li key={f} className="text-xs text-muted-foreground">{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {validationResult.errors.length > 0 && (
                <div className="text-sm">
                  {validationResult.errors.map((e, i) => (
                    <p key={i} className="text-xs text-destructive">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setValidationDialogOpen(false)}>
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Sub-component: BackupCard
// ============================================================================

interface BackupCardProps {
  backup: BackupInfo;
  t: (key: string, params?: Record<string, string | number>) => string;
  validating: boolean;
  restoring: boolean;
  onValidate: () => void;
  onRestore: () => void;
  onDelete: () => void;
}

function BackupCard({
  backup,
  t,
  validating,
  restoring,
  onValidate,
  onRestore,
  onDelete,
}: BackupCardProps) {
  const createdAt = new Date(backup.manifest.createdAt);
  const isAutoBackup = backup.manifest.note?.includes("auto-backup");
  const dateStr = createdAt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Card className="group">
      <CardHeader className="py-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Archive className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{backup.name}</span>
              {isAutoBackup && (
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  {t("backup.autoLabel")}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs mt-1 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {dateStr}
              </span>
              <span className="flex items-center gap-1">
                <HardDrive className="h-3 w-3" />
                {backup.sizeHuman}
              </span>
              <span className="text-muted-foreground">
                v{backup.manifest.appVersion}
              </span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onValidate}
                  disabled={validating}
                >
                  {validating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("backup.validate")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onRestore}
                  disabled={restoring}
                >
                  {restoring ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("backup.restore")}</TooltipContent>
            </Tooltip>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("backup.delete")}</TooltipContent>
                </Tooltip>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("backup.delete")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("backup.deleteConfirm")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t("backup.delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      {(backup.manifest.note || backup.manifest.contents.length > 0) && (
        <CardContent className="py-0 pb-3 px-4">
          <div className="flex flex-wrap gap-1">
            {backup.manifest.contents.map((ct) => {
              const def = ALL_CONTENT_TYPES.find((c) => c.key === ct);
              return (
                <Badge key={ct} variant="outline" className="text-[10px]">
                  {def ? t(def.labelKey) : ct}
                </Badge>
              );
            })}
          </div>
          {backup.manifest.note && (
            <p className="text-xs text-muted-foreground mt-1.5 italic">
              {backup.manifest.note}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
