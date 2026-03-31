"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLocale } from "@/components/providers/locale-provider";
import {
  useEnvironmentStore,
  type InstallationProgress,
} from "@/lib/stores/environment";
import { useEnvironments } from "@/hooks/environments/use-environments";
import { cn } from "@/lib/utils";
import { Download, Check, Loader2, AlertCircle, Minimize2 } from "lucide-react";
import {
  INSTALLATION_PHASE_LABELS,
  INSTALLATION_PHASES,
  INSTALLATION_FAILURE_CLASS_LABELS,
  INSTALLATION_STEP_LABELS,
  INSTALLATION_STEP_TO_PHASE,
  type InstallationPhase,
} from "@/lib/constants/environments";

type PhaseStatus = "completed" | "active" | "pending" | "error" | "cancelled";

function resolveTerminalState(progress: InstallationProgress) {
  if (progress.terminalState) return progress.terminalState;
  if (progress.step === "done") return "completed" as const;
  if (progress.step === "error") return "failed" as const;
  if (progress.step === "cancelled") return "cancelled" as const;
  return undefined;
}

function resolveCurrentPhase(progress: InstallationProgress): InstallationPhase {
  if (progress.phase) return progress.phase;
  return INSTALLATION_STEP_TO_PHASE[progress.step];
}

export function InstallationProgressDialog() {
  const { t } = useLocale();
  const { progressDialogOpen, installationProgress, closeProgressDialog } =
    useEnvironmentStore();
  const { cancelInstallation } = useEnvironments();

  if (!installationProgress) return null;

  const terminalState = resolveTerminalState(installationProgress);
  const currentPhase = resolveCurrentPhase(installationProgress);
  const {
    envType,
    version,
    provider,
    progress,
    error,
    downloadedSize,
    totalSize,
    speed,
    failureClass,
    stageMessage,
    selectionRationale,
    retryable,
    retryAfterSeconds,
    artifact,
  } = installationProgress;
  const isTerminal =
    terminalState === "completed" ||
    terminalState === "failed" ||
    terminalState === "cancelled";

  const getPhaseStatus = (phase: InstallationPhase): PhaseStatus => {
    const phaseIndex = INSTALLATION_PHASES.indexOf(phase);
    const currentIndex = INSTALLATION_PHASES.indexOf(currentPhase);

    if (terminalState === "completed") return "completed";
    if (terminalState === "failed") {
      if (phaseIndex < currentIndex) return "completed";
      if (phaseIndex === currentIndex) return "error";
      return "pending";
    }
    if (terminalState === "cancelled") {
      if (phaseIndex < currentIndex) return "completed";
      if (phaseIndex === currentIndex) return "cancelled";
      return "pending";
    }

    if (phaseIndex < currentIndex) return "completed";
    if (phaseIndex === currentIndex) return "active";
    return "pending";
  };

  const getPhaseIcon = (status: PhaseStatus) => {
    switch (status) {
      case "completed":
        return <Check className="h-3 w-3 text-white" />;
      case "active":
        return <Loader2 className="h-3 w-3 text-white animate-spin" />;
      case "error":
      case "cancelled":
        return <AlertCircle className="h-3 w-3 text-white" />;
      default:
        return <span className="h-2 w-2 rounded-full bg-current" />;
    }
  };

  const primaryStatusText = (() => {
    if (stageMessage) return stageMessage;
    if (terminalState === "failed") return error || t("environments.progress.error");
    if (terminalState === "cancelled") return t("environments.progress.cancel");
    return t(`environments.${INSTALLATION_PHASE_LABELS[currentPhase]}`);
  })();

  return (
    <Dialog
      open={progressDialogOpen}
      onOpenChange={(open) => !open && isTerminal && closeProgressDialog()}
    >
      <DialogContent className="sm:max-w-130" showCloseButton={isTerminal}>
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <Download className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <DialogTitle className="text-base">
                {t("environments.progress.title", { name: envType })}
              </DialogTitle>
              <DialogDescription>
                {t("environments.progress.subtitle", {
                  version: artifact?.version ?? version,
                  provider: artifact?.provider ?? provider,
                })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{primaryStatusText}</span>
              <span
                className={cn(
                  "font-mono text-sm font-semibold",
                  terminalState === "failed"
                    ? "text-destructive"
                    : terminalState === "cancelled"
                      ? "text-amber-600"
                      : "text-green-600",
                )}
              >
                {terminalState === "failed"
                  ? t("environments.progress.error")
                  : terminalState === "cancelled"
                    ? t("environments.progress.cancel")
                    : `${progress}%`}
              </span>
            </div>
            <Progress
              value={progress}
              className={cn(
                "h-2",
                terminalState === "failed" && "bg-destructive/20",
                terminalState === "cancelled" && "bg-amber-100",
              )}
            />
            {currentPhase === "download" && downloadedSize && totalSize && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {downloadedSize} / {totalSize}
                </span>
                {speed && <span>{speed}</span>}
              </div>
            )}
            {selectionRationale && (
              <div className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
                {selectionRationale}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("environments.progress.steps")}
            </span>
            <div className="space-y-2">
              {INSTALLATION_PHASES.map((phase) => {
                const status = getPhaseStatus(phase);
                return (
                  <div key={phase} className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full",
                        status === "completed" && "bg-green-600",
                        status === "active" && "bg-green-600",
                        status === "error" && "bg-destructive",
                        status === "cancelled" && "bg-amber-600",
                        status === "pending" && "bg-muted",
                      )}
                    >
                      {getPhaseIcon(status)}
                    </div>
                    <span
                      className={cn(
                        "text-sm",
                        status === "active" && "font-medium",
                        status === "pending" && "text-muted-foreground",
                        status === "error" && "text-destructive",
                        status === "cancelled" && "text-amber-700",
                      )}
                    >
                      {t(`environments.${INSTALLATION_PHASE_LABELS[phase]}`)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {(terminalState === "failed" || terminalState === "cancelled") && (
            <div
              className={cn(
                "rounded-md p-3 text-sm",
                terminalState === "failed"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-amber-100 text-amber-800",
              )}
            >
              <div className="font-medium">
                {failureClass
                  ? INSTALLATION_FAILURE_CLASS_LABELS[failureClass]
                  : t(
                      `environments.${INSTALLATION_STEP_LABELS[installationProgress.step]}`,
                    )}
              </div>
              {error && <div className="mt-1">{error}</div>}
              {retryable === true && (
                <div className="mt-1 text-xs">
                  Retry available
                  {retryAfterSeconds ? ` in ${retryAfterSeconds}s` : ""}.
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          {isTerminal ? (
            <Button onClick={closeProgressDialog}>{t("common.close")}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={cancelInstallation}>
                {t("environments.progress.cancel")}
              </Button>
              <Button
                variant="secondary"
                className="gap-2"
                onClick={closeProgressDialog}
              >
                <Minimize2 className="h-4 w-4" />
                {t("environments.progress.runInBackground")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
