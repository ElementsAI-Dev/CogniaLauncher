"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Trash2,
  HardDrive,
  Loader2,
  Check,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import type { InstalledVersion, EnvCleanupResult } from "@/lib/tauri";
import { formatSize, cn } from "@/lib/utils";

interface CleanupDialogProps {
  envType: string;
  installedVersions: InstalledVersion[];
  currentVersion: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleanup: (versions: string[]) => Promise<EnvCleanupResult | null>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function CleanupDialog({
  envType,
  installedVersions,
  currentVersion,
  open,
  onOpenChange,
  onCleanup,
  t,
}: CleanupDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState<EnvCleanupResult | null>(null);

  const removableVersions = useMemo(
    () => installedVersions.filter((v) => v.version !== currentVersion),
    [installedVersions, currentVersion],
  );

  const selectedSize = useMemo(() => {
    return installedVersions
      .filter((v) => selected.has(v.version))
      .reduce((acc, v) => acc + (v.size || 0), 0);
  }, [selected, installedVersions]);

  const toggleVersion = useCallback((version: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(version)) {
        next.delete(version);
      } else {
        next.add(version);
      }
      return next;
    });
  }, []);

  const selectAllRemovable = useCallback(() => {
    setSelected(new Set(removableVersions.map((v) => v.version)));
  }, [removableVersions]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  const handleCleanup = useCallback(async () => {
    if (selected.size === 0) return;
    setCleaning(true);
    setResult(null);
    try {
      const res = await onCleanup(Array.from(selected));
      setResult(res);
      if (res && res.errors.length === 0) {
        setSelected(new Set());
      }
    } finally {
      setCleaning(false);
    }
  }, [selected, onCleanup]);

  const handleClose = useCallback(
    (isOpen: boolean) => {
      if (!cleaning) {
        onOpenChange(isOpen);
        if (!isOpen) {
          setResult(null);
          setSelected(new Set());
        }
      }
    },
    [cleaning, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            {t("environments.cleanup.title")}
          </DialogTitle>
          <DialogDescription>
            {t("environments.cleanup.description", { envType })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Quick actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAllRemovable}
              disabled={cleaning || removableVersions.length === 0}
            >
              {t("environments.cleanup.selectAll")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              disabled={cleaning || selected.size === 0}
            >
              {t("environments.cleanup.clearSelection")}
            </Button>
            {selected.size > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {t("environments.cleanup.willFree", {
                  size: formatSize(selectedSize),
                })}
              </Badge>
            )}
          </div>

          {/* Version list */}
          <ScrollArea className="h-[300px] pr-3">
            {installedVersions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {t("environments.cleanup.noVersions")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {installedVersions.map((v) => {
                  const isCurrent = v.version === currentVersion;
                  const isSelected = selected.has(v.version);
                  return (
                    <div
                      key={v.version}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                        isCurrent && "bg-primary/5 border-primary/20",
                        isSelected &&
                          !isCurrent &&
                          "bg-destructive/5 border-destructive/20",
                        !isCurrent &&
                          !isSelected &&
                          "hover:bg-muted/50",
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleVersion(v.version)}
                        disabled={isCurrent || cleaning}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-sm">
                            {v.version}
                          </span>
                          {isCurrent && (
                            <Badge variant="default" className="text-xs">
                              {t("environments.currentVersion")}
                            </Badge>
                          )}
                        </div>
                        {v.installed_at && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(v.installed_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatSize(v.size || 0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Result */}
          {result && (
            <Alert
              variant={result.errors.length > 0 ? "destructive" : "default"}
            >
              {result.errors.length > 0 ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <AlertDescription>
                {result.removed.length > 0 && (
                  <p>
                    {t("environments.cleanup.removed", {
                      count: result.removed.length,
                      size: formatSize(result.freedBytes),
                    })}
                  </p>
                )}
                {result.errors.map((err, idx) => (
                  <p key={idx} className="text-xs mt-1">
                    {err}
                  </p>
                ))}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <div className="flex items-center gap-2 w-full">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <HardDrive className="h-3.5 w-3.5" />
              <span>
                {t("environments.cleanup.totalInstalled", {
                  count: installedVersions.length,
                })}
              </span>
            </div>
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={cleaning}
              >
                {t("common.close")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleCleanup}
                disabled={selected.size === 0 || cleaning}
                className="gap-2"
              >
                {cleaning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {t("environments.cleanup.cleanSelected", {
                  count: selected.size,
                })}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
