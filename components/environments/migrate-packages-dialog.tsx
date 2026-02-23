"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Package,
  ArrowRight,
  Loader2,
  Check,
  X,
  SkipForward,
} from "lucide-react";
import type { GlobalPackageInfo, EnvMigrateResult } from "@/lib/tauri";
import * as tauri from "@/lib/tauri";
import { cn } from "@/lib/utils";

interface MigratePackagesDialogProps {
  envType: string;
  fromVersion: string;
  toVersion: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function MigratePackagesDialog({
  envType,
  fromVersion,
  toVersion,
  open,
  onOpenChange,
  t,
}: MigratePackagesDialogProps) {
  const [packages, setPackages] = useState<GlobalPackageInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; package: string } | null>(null);
  const [result, setResult] = useState<EnvMigrateResult | null>(null);

  useEffect(() => {
    if (!open || !tauri.isTauri()) return;

    let cancelled = false;
    setLoadingPackages(true);
    setResult(null);
    setProgress(null);

    tauri.envListGlobalPackages(envType, fromVersion)
      .then((pkgs) => {
        if (!cancelled) {
          setPackages(pkgs);
          setSelected(new Set(pkgs.map((p) => p.name)));
        }
      })
      .catch(() => {
        if (!cancelled) setPackages([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPackages(false);
      });

    return () => { cancelled = true; };
  }, [open, envType, fromVersion]);

  const togglePackage = useCallback((name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const handleMigrate = useCallback(async () => {
    if (selected.size === 0) return;
    setMigrating(true);
    setResult(null);

    let unlisten: (() => void) | null = null;
    try {
      unlisten = await tauri.listenEnvMigrateProgress((p) => {
        setProgress(p);
      });

      const res = await tauri.envMigratePackages(
        envType,
        fromVersion,
        toVersion,
        Array.from(selected),
      );
      setResult(res);
    } catch {
      // Error handled by result
    } finally {
      setMigrating(false);
      unlisten?.();
    }
  }, [selected, envType, fromVersion, toVersion]);

  const progressPercent = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !migrating && onOpenChange(isOpen)}>
      <DialogContent className="sm:max-w-[520px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t("environments.migrate.title")}
          </DialogTitle>
          <DialogDescription>
            <span className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="font-mono">{fromVersion}</Badge>
              <ArrowRight className="h-3 w-3" />
              <Badge variant="default" className="font-mono">{toVersion}</Badge>
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {loadingPackages ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{t("environments.migrate.loadingPackages")}</span>
            </div>
          ) : packages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t("environments.migrate.noPackages")}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t("environments.migrate.packagesFound", { count: packages.length })}
                </span>
                <Badge variant="secondary">{selected.size} {t("common.selected")}</Badge>
              </div>

              <ScrollArea className="h-[250px] pr-3">
                <div className="space-y-1.5">
                  {packages.map((pkg) => (
                    <div
                      key={pkg.name}
                      className={cn(
                        "flex items-center gap-3 p-2.5 rounded-lg border transition-colors",
                        selected.has(pkg.name) ? "bg-primary/5 border-primary/20" : "hover:bg-muted/50",
                      )}
                    >
                      <Checkbox
                        checked={selected.has(pkg.name)}
                        onCheckedChange={() => togglePackage(pkg.name)}
                        disabled={migrating}
                      />
                      <span className="font-mono text-sm flex-1 truncate">{pkg.name}</span>
                      <Badge variant="outline" className="font-mono text-xs shrink-0">
                        {pkg.version}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}

          {/* Migration progress */}
          {migrating && progress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{progress.package}</span>
                <span>{progress.current}/{progress.total}</span>
              </div>
              <Progress value={progressPercent} className="h-1.5" />
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-2">
              {result.migrated.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {result.migrated.map((name) => (
                    <Badge key={name} variant="default" className="text-xs gap-1">
                      <Check className="h-3 w-3" />{name}
                    </Badge>
                  ))}
                </div>
              )}
              {result.failed.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {result.failed.map((f) => (
                      <div key={f.name} className="flex items-center gap-1 text-xs">
                        <X className="h-3 w-3 shrink-0" />
                        <span className="font-mono">{f.name}</span>: {f.error}
                      </div>
                    ))}
                  </AlertDescription>
                </Alert>
              )}
              {result.skipped.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {result.skipped.map((name) => (
                    <Badge key={name} variant="secondary" className="text-xs gap-1">
                      <SkipForward className="h-3 w-3" />{name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={migrating}>
            {result ? t("common.close") : t("common.cancel")}
          </Button>
          {!result && (
            <Button
              onClick={handleMigrate}
              disabled={selected.size === 0 || migrating || loadingPackages}
              className="gap-2"
            >
              {migrating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Package className="h-4 w-4" />
              )}
              {t("environments.migrate.migrateSelected", { count: selected.size })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
