"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { writeClipboard } from '@/lib/clipboard';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Link2,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  Check,
  X,
  FolderOpen,
  Copy,
  Route,
} from "lucide-react";
import { useShim } from "@/hooks/use-shim";
import { isTauri } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EnvDetailShimsProps {
  envType: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function EnvDetailShims({ envType, t }: EnvDetailShimsProps) {
  const {
    shims,
    pathStatus,
    loading,
    error,
    fetchShims,
    createShim,
    removeShim,
    regenerateAll,
    fetchPathStatus,
    setupPath,
    getAddCommand,
  } = useShim();

  const [newBinaryName, setNewBinaryName] = useState("");
  const [newTargetPath, setNewTargetPath] = useState("");
  const [newVersion, setNewVersion] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current && isTauri()) {
      initializedRef.current = true;
      fetchShims();
      fetchPathStatus();
    }
  }, [fetchShims, fetchPathStatus]);

  const envShims = shims.filter(
    (s) => s.envType === envType || !envType
  );

  const handleCreateShim = useCallback(async () => {
    if (!newBinaryName.trim() || !newTargetPath.trim()) return;
    setIsCreating(true);
    try {
      const result = await createShim(
        newBinaryName.trim(),
        envType,
        newVersion.trim() || null,
        newTargetPath.trim()
      );
      if (result) {
        toast.success(t("environments.shims.created", { name: newBinaryName }));
        setNewBinaryName("");
        setNewTargetPath("");
        setNewVersion("");
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setIsCreating(false);
    }
  }, [newBinaryName, newTargetPath, newVersion, envType, createShim, t]);

  const handleRemoveShim = useCallback(
    async (binaryName: string) => {
      const removed = await removeShim(binaryName);
      if (removed) {
        toast.success(t("environments.shims.removed", { name: binaryName }));
      }
    },
    [removeShim, t]
  );

  const handleRegenerateAll = useCallback(async () => {
    const success = await regenerateAll();
    if (success) {
      toast.success(t("environments.shims.regenerated"));
    }
  }, [regenerateAll, t]);

  const handleSetupPath = useCallback(async () => {
    const success = await setupPath();
    if (success) {
      toast.success(t("environments.shims.pathAdded"));
    }
  }, [setupPath, t]);

  const handleCopyAddCommand = useCallback(async () => {
    const cmd = await getAddCommand();
    if (cmd) {
      try {
        await writeClipboard(cmd);
        toast.success(t("common.copied"));
      } catch {
        toast.error(t("common.copyFailed"));
      }
    }
  }, [getAddCommand, t]);

  if (!isTauri()) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-medium">
          {t("environments.shims.desktopOnly")}
        </h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* PATH Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Route className="h-4 w-4" />
            {t("environments.shims.pathStatusTitle")}
          </CardTitle>
          <CardDescription>
            {t("environments.shims.pathStatusDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pathStatus ? (
            <div className="space-y-3">
              <div
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  pathStatus.isInPath
                    ? "bg-green-50/50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                    : "bg-yellow-50/50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800"
                )}
              >
                {pathStatus.isInPath ? (
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                ) : (
                  <X className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {pathStatus.isInPath
                      ? t("environments.shims.pathConfigured")
                      : t("environments.shims.pathNotConfigured")}
                  </p>
                  <code className="text-xs font-mono text-muted-foreground break-all">
                    {pathStatus.shimDir}
                  </code>
                </div>
                {!pathStatus.isInPath && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      onClick={handleSetupPath}
                      disabled={loading}
                      className="gap-1.5"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      {t("environments.shims.addToPath")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyAddCommand}
                      className="gap-1.5"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {t("environments.shims.copyCommand")}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
              {t("common.loading")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shim List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                {t("environments.shims.title")}
              </CardTitle>
              <CardDescription>
                {t("environments.shims.description")}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchShims()}
                disabled={loading}
                className="gap-1.5"
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", loading && "animate-spin")}
                />
                {t("environments.refresh")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerateAll}
                disabled={loading}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t("environments.shims.regenerateAll")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-sm text-destructive mb-3">{error}</div>
          )}

          <ScrollArea className="max-h-[300px]">
            {envShims.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{t("environments.shims.noShims")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {envShims.map((shim) => (
                  <div
                    key={shim.binaryName}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-sm font-medium">
                          {shim.binaryName}
                        </code>
                        <Badge variant="outline" className="text-xs">
                          {shim.envType}
                        </Badge>
                        {shim.version && (
                          <Badge
                            variant="secondary"
                            className="text-xs font-mono"
                          >
                            {shim.version}
                          </Badge>
                        )}
                      </div>
                      <code className="text-xs text-muted-foreground font-mono mt-0.5 block truncate">
                        {shim.targetPath}
                      </code>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {t("common.confirm")}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("environments.shims.deleteConfirm", {
                              name: shim.binaryName,
                            })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            {t("common.cancel")}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveShim(shim.binaryName)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {t("common.delete")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Create New Shim */}
          <div className="mt-4 pt-4 border-t space-y-2">
            <p className="text-sm font-medium">
              {t("environments.shims.createNew")}
            </p>
            <div className="flex gap-2">
              <Input
                placeholder={t("environments.shims.binaryNamePlaceholder")}
                value={newBinaryName}
                onChange={(e) => setNewBinaryName(e.target.value)}
                className="w-[140px] h-9 font-mono text-xs"
              />
              <Input
                placeholder={t("environments.shims.versionPlaceholder")}
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
                className="w-[100px] h-9 font-mono text-xs"
              />
              <Input
                placeholder={t("environments.shims.targetPathPlaceholder")}
                value={newTargetPath}
                onChange={(e) => setNewTargetPath(e.target.value)}
                className="flex-1 h-9 font-mono text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateShim();
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateShim}
                disabled={
                  !newBinaryName.trim() ||
                  !newTargetPath.trim() ||
                  isCreating ||
                  loading
                }
                className="gap-1"
              >
                {isCreating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                {t("common.add")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
