"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  Box,
  X,
} from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";

interface SelectedVersion {
  envType: string;
  version: string;
}

interface BatchOperationsProps {
  selectedVersions: SelectedVersion[];
  onBatchInstall: (versions: SelectedVersion[]) => Promise<void>;
  onBatchUninstall: (versions: SelectedVersion[]) => Promise<void>;
  onClearSelection: () => void;
}

type OperationType = "install" | "uninstall";

interface OperationResult {
  successful: SelectedVersion[];
  failed: { version: SelectedVersion; error: string }[];
}

export function EnvironmentBatchOperations({
  selectedVersions,
  onBatchInstall,
  onBatchUninstall,
  onClearSelection,
}: BatchOperationsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [operationType, setOperationType] = useState<OperationType>("install");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<OperationResult | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const { t } = useLocale();

  const handleOperation = useCallback(async () => {
    setIsProcessing(true);
    setResult(null);
    setCurrentIndex(0);

    const successful: SelectedVersion[] = [];
    const failed: { version: SelectedVersion; error: string }[] = [];

    for (let i = 0; i < selectedVersions.length; i++) {
      setCurrentIndex(i);
      const version = selectedVersions[i];

      try {
        if (operationType === "install") {
          await onBatchInstall([version]);
        } else {
          await onBatchUninstall([version]);
        }
        successful.push(version);
      } catch (error) {
        failed.push({
          version,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    setResult({ successful, failed });
    setIsProcessing(false);

    if (failed.length === 0) {
      onClearSelection();
    }
  }, [
    operationType,
    selectedVersions,
    onBatchInstall,
    onBatchUninstall,
    onClearSelection,
  ]);

  const openDialog = useCallback((type: OperationType) => {
    setOperationType(type);
    setResult(null);
    setCurrentIndex(0);
    setIsDialogOpen(true);
  }, []);

  const getOperationLabel = () => {
    return operationType === "install"
      ? t("common.install")
      : t("common.uninstall");
  };

  const getOperationIcon = () => {
    return operationType === "install" ? (
      <Download className="h-4 w-4" />
    ) : (
      <Trash2 className="h-4 w-4" />
    );
  };

  if (selectedVersions.length === 0) {
    return null;
  }

  return (
    <>
      {/* Floating Action Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-card border rounded-lg shadow-lg p-3 flex items-center gap-4 z-50">
        <div className="flex items-center gap-2">
          <Box className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {t("environments.batch.selected", {
              count: selectedVersions.length,
            })}
          </span>
        </div>

        <div className="h-6 w-px bg-border" />

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={() => openDialog("install")}
          >
            <Download className="h-4 w-4 mr-1" />
            {t("common.install")}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => openDialog("uninstall")}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {t("common.uninstall")}
          </Button>
        </div>

        <div className="h-6 w-px bg-border" />

        <Button size="sm" variant="ghost" onClick={onClearSelection}>
          <X className="h-4 w-4 mr-1" />
          {t("common.clear")}
        </Button>
      </div>

      {/* Operation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getOperationIcon()}
              {t("environments.batch.title", { action: getOperationLabel() })}
            </DialogTitle>
            <DialogDescription>
              {result
                ? t("environments.batch.completed")
                : t("environments.batch.description", {
                    action: getOperationLabel(),
                    count: selectedVersions.length,
                  })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Version List */}
            {!result && !isProcessing && (
              <div className="space-y-2">
                <div className="text-sm font-medium">
                  {t("environments.batch.versions")}:
                </div>
                <ScrollArea className="h-[200px] border rounded-md p-2">
                  <div className="space-y-1">
                    {selectedVersions.map((v, i) => (
                      <div
                        key={`${v.envType}-${v.version}-${i}`}
                        className="flex items-center gap-2 p-2 rounded hover:bg-accent"
                      >
                        <Box className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="outline">{v.envType}</Badge>
                        <span className="text-sm font-mono">{v.version}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Processing State */}
            {isProcessing && (
              <div className="space-y-4 py-4">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <div className="text-center">
                    <div className="font-medium">
                      {t("environments.batch.processing")} ({currentIndex + 1}/
                      {selectedVersions.length})
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {selectedVersions[currentIndex]?.envType}{" "}
                      {selectedVersions[currentIndex]?.version}
                    </div>
                  </div>
                </div>
                <Progress
                  value={
                    selectedVersions.length > 0
                      ? ((currentIndex + 1) / selectedVersions.length) * 100
                      : 0
                  }
                  className="h-2"
                />
              </div>
            )}

            {/* Results */}
            {result && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-1" />
                    <div className="text-2xl font-bold text-green-600">
                      {result.successful.length}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("environments.batch.successful")}
                    </div>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                    <XCircle className="h-5 w-5 text-red-500 mx-auto mb-1" />
                    <div className="text-2xl font-bold text-red-600">
                      {result.failed.length}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("environments.batch.failed")}
                    </div>
                  </div>
                </div>

                {/* Detailed Results */}
                <ScrollArea className="h-[150px] border rounded-md">
                  <div className="p-2 space-y-2">
                    {result.successful.map((v, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2 rounded bg-green-500/5"
                      >
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <Badge variant="outline">{v.envType}</Badge>
                        <span className="text-sm font-mono">{v.version}</span>
                      </div>
                    ))}

                    {result.failed.map((item, i) => (
                      <div
                        key={i}
                        className="p-2 rounded bg-red-500/5 space-y-1"
                      >
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-500" />
                          <Badge variant="outline">
                            {item.version.envType}
                          </Badge>
                          <span className="text-sm font-mono">
                            {item.version.version}
                          </span>
                        </div>
                        <div className="text-xs text-red-500 ml-6">
                          {item.error}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          <DialogFooter>
            {!result && !isProcessing && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={handleOperation}
                  variant={
                    operationType === "uninstall" ? "destructive" : "default"
                  }
                >
                  {getOperationIcon()}
                  <span className="ml-2">{getOperationLabel()}</span>
                </Button>
              </>
            )}
            {(result || isProcessing) && (
              <Button
                onClick={() => setIsDialogOpen(false)}
                disabled={isProcessing}
              >
                {result ? t("common.close") : t("common.cancel")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
