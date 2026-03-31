"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Download,
  Upload,
  Copy,
  FileJson,
  FileText,
  Check,
  Package,
  Loader2,
  ClipboardPaste,
} from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import {
  usePackageExport,
  ExportedPackageList,
  type ImportPreviewEntry,
} from "@/hooks/packages/use-package-export";
import { toast } from "sonner";
import type { ExportImportDialogProps } from "@/types/packages";

export function ExportImportDialog({
  trigger,
  onImport,
}: ExportImportDialogProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"export" | "import">("export");
  const [importedData, setImportedData] = useState<ExportedPackageList | null>(
    null,
  );
  const [selectedForImport, setSelectedForImport] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [restoreBookmarks, setRestoreBookmarks] = useState(true);
  const [importSummary, setImportSummary] = useState<{
    applied: number;
    skipped: number;
    invalid: number;
    restoredBookmarks: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    exportPackages,
    importPackages,
    importFromClipboard,
    exportToClipboard,
    getImportPreview,
    getNormalizedBookmarks,
  } = usePackageExport();
  const importPreview = useMemo(
    () => (importedData ? getImportPreview(importedData) : null),
    [getImportPreview, importedData],
  );
  const normalizedBookmarks = useMemo(
    () => (importedData ? getNormalizedBookmarks(importedData) : []),
    [getNormalizedBookmarks, importedData],
  );
  const canConfirmImport = selectedForImport.length > 0
    || (restoreBookmarks && normalizedBookmarks.length > 0);

  const handleExportJson = useCallback(() => {
    exportPackages();
    toast.success(t("packages.exportSuccess"));
  }, [exportPackages, t]);

  const handleExportClipboard = useCallback(async () => {
    await exportToClipboard();
  }, [exportToClipboard]);

  const handleImportedData = useCallback((data: ExportedPackageList | null) => {
    setImportedData(data);
    if (!data) {
      setSelectedForImport([]);
      setRestoreBookmarks(true);
      setImportSummary(null);
      return;
    }

    const preview = getImportPreview(data);
    setSelectedForImport(preview.installable.map((entry) => entry.id));
    setRestoreBookmarks(getNormalizedBookmarks(data).length > 0);
    setImportSummary(null);
  }, [getImportPreview, getNormalizedBookmarks]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const data = await importPackages(file);
      handleImportedData(data);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleImportedData, importPackages],
  );

  const handleImportConfirm = useCallback(async () => {
    if (!importedData || !onImport || !importPreview) return;

    const filteredData: ExportedPackageList = {
      ...importedData,
      packages: importPreview.installable
        .filter((entry) => selectedForImport.includes(entry.id))
        .map((entry) => ({
          name: entry.name,
          version: entry.version,
          provider: entry.provider,
        })),
      bookmarks: restoreBookmarks ? normalizedBookmarks : [],
    };

    setIsImporting(true);
    try {
      await onImport(filteredData);
      setImportSummary({
        applied: filteredData.packages.length,
        skipped: importPreview.skipped.length,
        invalid: importPreview.invalid.length,
        restoredBookmarks: filteredData.bookmarks.length,
      });
      toast.success(
        t("packages.importCompleted", { count: filteredData.packages.length }),
      );
    } catch (err) {
      toast.error(t("packages.importFailed", { error: String(err) }));
    } finally {
      setIsImporting(false);
    }
  }, [importPreview, importedData, normalizedBookmarks, onImport, restoreBookmarks, selectedForImport, t]);

  const togglePackageSelection = useCallback((entryId: string) => {
    setSelectedForImport((prev) =>
      prev.includes(entryId)
        ? prev.filter((id) => id !== entryId)
        : [...prev, entryId],
    );
  }, []);

  const toggleAllSelection = useCallback(() => {
    if (!importPreview) return;
    if (selectedForImport.length === importPreview.installable.length) {
      setSelectedForImport([]);
    } else {
      setSelectedForImport(importPreview.installable.map((entry) => entry.id));
    }
  }, [importPreview, selectedForImport]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <FileJson className="h-4 w-4 mr-2" />
            {t("packages.exportImport")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[85dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("packages.exportImportTitle")}</DialogTitle>
          <DialogDescription>
            {t("packages.exportImportDesc")}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "export" | "import")}
          className="min-h-0 flex-1"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export" className="gap-2">
              <Download className="h-4 w-4" />
              {t("packages.export")}
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <Upload className="h-4 w-4" />
              {t("packages.import")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4 mt-4">
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-3"
                onClick={handleExportJson}
              >
                <FileJson className="h-5 w-5 mr-3 text-blue-500" />
                <div className="text-left">
                  <div className="font-medium">
                    {t("packages.exportAsJson")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("packages.exportAsJsonDesc")}
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-auto py-3"
                onClick={handleExportClipboard}
              >
                <Copy className="h-5 w-5 mr-3 text-green-500" />
                <div className="text-left">
                  <div className="font-medium">
                    {t("packages.exportToClipboard")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("packages.exportToClipboardDesc")}
                  </div>
                </div>
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="import" className="space-y-4 mt-4 min-h-0">
            {!importedData ? (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileText className="h-5 w-5 mr-3 text-orange-500" />
                  <div className="text-left">
                    <div className="font-medium">
                      {t("packages.selectFile")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("packages.selectFileDesc")}
                    </div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                  onClick={async () => {
                    const data = await importFromClipboard();
                    handleImportedData(data);
                  }}
                >
                  <ClipboardPaste className="h-5 w-5 mr-3 text-purple-500" />
                  <div className="text-left">
                    <div className="font-medium">
                      {t("packages.importFromClipboard")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("packages.importFromClipboardDesc")}
                    </div>
                  </div>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">
                      {t("packages.fileLoaded")}
                    </span>
                  </div>
                  <Badge variant="secondary">
                    {importedData.packages.length} {t("packages.packagesLabel")}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 pb-2 border-b">
                  <Checkbox
                    checked={
                      selectedForImport.length === (importPreview?.installable.length ?? 0)
                    }
                    onCheckedChange={toggleAllSelection}
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedForImport.length > 0
                      ? t("packages.selected", {
                          count: selectedForImport.length,
                        })
                      : t("packages.selectAll")}
                  </span>
                </div>

                <ScrollArea className="max-h-[45dvh] min-h-0 border rounded-md">
                  <div className="p-2 space-y-4">
                    {([
                      ["packages.importPreviewInstallable", importPreview?.installable ?? []],
                      ["packages.importPreviewSkipped", importPreview?.skipped ?? []],
                      ["packages.importPreviewInvalid", importPreview?.invalid ?? []],
                    ] as const).map(([labelKey, entries]) => (
                      <div key={labelKey} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{t(labelKey)}</span>
                          <Badge variant="secondary">{entries.length}</Badge>
                        </div>
                        <div className="space-y-1">
                          {entries.map((entry: ImportPreviewEntry) => (
                            <div
                              key={entry.id}
                              className="flex items-center gap-2 p-2 rounded border"
                              onClick={() => {
                                if (entry.status === "installable") {
                                  togglePackageSelection(entry.id);
                                }
                              }}
                            >
                              {entry.status === "installable" ? (
                                <Checkbox
                                  checked={selectedForImport.includes(entry.id)}
                                  onCheckedChange={() =>
                                    togglePackageSelection(entry.id)
                                  }
                                />
                              ) : (
                                <div className="w-4 shrink-0" />
                              )}
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm flex-1 min-w-0 break-all" title={entry.name}>
                                {entry.name || "—"}
                              </span>
                              {entry.version && (
                                <Badge
                                  variant="outline"
                                  className="text-xs font-mono shrink-0"
                                >
                                  {entry.version}
                                </Badge>
                              )}
                              {entry.provider && (
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  {entry.provider}
                                </Badge>
                              )}
                              {entry.reason && (
                                <Badge variant="outline" className="text-xs shrink-0">
                                  {entry.reason}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {normalizedBookmarks.length > 0 && (
                  <label className="flex items-center gap-3 rounded-md border p-3">
                    <Checkbox
                      checked={restoreBookmarks}
                      onCheckedChange={(checked) => setRestoreBookmarks(Boolean(checked))}
                    />
                    <span className="text-sm font-medium">
                      {t("packages.restoreBookmarks")}
                    </span>
                  </label>
                )}

                {importSummary && (
                  <div className="rounded-md border p-3 text-sm">
                    <div className="font-medium">{t("packages.importSummary")}</div>
                    <div className="mt-2 text-muted-foreground">
                      applied={importSummary.applied} skipped={importSummary.skipped} invalid={importSummary.invalid} bookmarks={importSummary.restoredBookmarks}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      handleImportedData(null);
                    }}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleImportConfirm}
                    disabled={!canConfirmImport || isImporting}
                  >
                    {isImporting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {selectedForImport.length > 0
                      ? t("packages.installSelected", {
                          count: selectedForImport.length,
                        })
                      : t("packages.restoreBookmarks")}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
