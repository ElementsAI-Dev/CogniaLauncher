"use client";

import { useEffect, useState, useCallback } from "react";
import { isTauri } from "@/lib/platform";
import * as tauri from "@/lib/tauri";
import type { CrashInfo } from "@/types/tauri";
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
import { AlertTriangle, FolderOpen } from "lucide-react";

interface CrashRecoveryDialogProps {
  t: (key: string) => string;
}

export function CrashRecoveryDialog({ t }: CrashRecoveryDialogProps) {
  const [crashInfo, setCrashInfo] = useState<CrashInfo | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;

    const check = async () => {
      try {
        const info = await tauri.diagnosticCheckLastCrash();
        if (info) {
          setCrashInfo(info);
          setOpen(true);
        }
      } catch (err) {
        console.error("Failed to check crash status:", err);
      }
    };

    // Delay check slightly so the app has time to render
    const timer = setTimeout(check, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = useCallback(async () => {
    setOpen(false);
    try {
      await tauri.diagnosticDismissCrash();
    } catch {
      // ignore
    }
  }, []);

  const handleOpenFolder = useCallback(async () => {
    if (!crashInfo) return;
    try {
      const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
      await revealItemInDir(crashInfo.reportPath);
    } catch {
      // fallback: ignore
    }
    handleDismiss();
  }, [crashInfo, handleDismiss]);

  if (!crashInfo) return null;

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {t("diagnostic.crashDetected")}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              {t("diagnostic.crashDescription")}
            </span>
            {crashInfo.message && (
              <span className="block rounded-md bg-muted p-2 font-mono text-xs text-muted-foreground break-all max-h-24 overflow-auto">
                {crashInfo.message}
              </span>
            )}
            <span className="block text-xs text-muted-foreground">
              {t("diagnostic.crashReportSaved")}: {crashInfo.reportPath}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* AlertDialogCancel auto-closes the dialog, which triggers onOpenChange(false) → handleDismiss.
              Do NOT add a separate onClick={handleDismiss} here to avoid double invocation. */}
          <AlertDialogCancel>
            {t("diagnostic.dismiss")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleOpenFolder} className="gap-2">
            <FolderOpen className="h-4 w-4" />
            {t("diagnostic.openFolder")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
