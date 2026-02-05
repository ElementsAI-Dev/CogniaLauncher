'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Download,
  Upload,
  Copy,
  FileJson,
  FileText,
  Check,
  Package,
  Loader2,
} from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { usePackageExport, ExportedPackageList } from '@/hooks/use-package-export';
import { toast } from 'sonner';

interface ExportImportDialogProps {
  trigger?: React.ReactNode;
  onImport?: (data: ExportedPackageList) => Promise<void>;
}

export function ExportImportDialog({ trigger, onImport }: ExportImportDialogProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [importedData, setImportedData] = useState<ExportedPackageList | null>(null);
  const [selectedForImport, setSelectedForImport] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { exportPackages, importPackages, exportToClipboard } = usePackageExport();

  const handleExportJson = useCallback(() => {
    exportPackages();
    toast.success(t('packages.exportSuccess'));
  }, [exportPackages, t]);

  const handleExportClipboard = useCallback(async () => {
    await exportToClipboard();
  }, [exportToClipboard]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const data = await importPackages(file);
      if (data) {
        setImportedData(data);
        setSelectedForImport(data.packages.map((p) => p.name));
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [importPackages]
  );

  const handleImportConfirm = useCallback(async () => {
    if (!importedData || !onImport) return;

    const filteredData: ExportedPackageList = {
      ...importedData,
      packages: importedData.packages.filter((p) =>
        selectedForImport.includes(p.name)
      ),
    };

    setIsImporting(true);
    try {
      await onImport(filteredData);
      toast.success(
        t('packages.importCompleted', { count: filteredData.packages.length })
      );
      setOpen(false);
      setImportedData(null);
      setSelectedForImport([]);
    } catch (err) {
      toast.error(t('packages.importFailed', { error: String(err) }));
    } finally {
      setIsImporting(false);
    }
  }, [importedData, selectedForImport, onImport, t]);

  const togglePackageSelection = useCallback((name: string) => {
    setSelectedForImport((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }, []);

  const toggleAllSelection = useCallback(() => {
    if (!importedData) return;
    if (selectedForImport.length === importedData.packages.length) {
      setSelectedForImport([]);
    } else {
      setSelectedForImport(importedData.packages.map((p) => p.name));
    }
  }, [importedData, selectedForImport]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <FileJson className="h-4 w-4 mr-2" />
            {t('packages.exportImport')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('packages.exportImportTitle')}</DialogTitle>
          <DialogDescription>
            {t('packages.exportImportDesc')}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'export' | 'import')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export" className="gap-2">
              <Download className="h-4 w-4" />
              {t('packages.export')}
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <Upload className="h-4 w-4" />
              {t('packages.import')}
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
                  <div className="font-medium">{t('packages.exportAsJson')}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('packages.exportAsJsonDesc')}
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
                  <div className="font-medium">{t('packages.exportToClipboard')}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('packages.exportToClipboardDesc')}
                  </div>
                </div>
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="import" className="space-y-4 mt-4">
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
                    <div className="font-medium">{t('packages.selectFile')}</div>
                    <div className="text-xs text-muted-foreground">
                      {t('packages.selectFileDesc')}
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
                      {t('packages.fileLoaded')}
                    </span>
                  </div>
                  <Badge variant="secondary">
                    {importedData.packages.length} {t('packages.packagesLabel')}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 pb-2 border-b">
                  <Checkbox
                    checked={
                      selectedForImport.length === importedData.packages.length
                    }
                    onCheckedChange={toggleAllSelection}
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedForImport.length > 0
                      ? t('packages.selected', { count: selectedForImport.length })
                      : t('packages.selectAll')}
                  </span>
                </div>

                <ScrollArea className="h-[200px] border rounded-md">
                  <div className="p-2 space-y-1">
                    {importedData.packages.map((pkg) => (
                      <div
                        key={pkg.name}
                        className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                        onClick={() => togglePackageSelection(pkg.name)}
                      >
                        <Checkbox
                          checked={selectedForImport.includes(pkg.name)}
                          onCheckedChange={() => togglePackageSelection(pkg.name)}
                        />
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm flex-1">{pkg.name}</span>
                        {pkg.version && (
                          <Badge variant="outline" className="text-xs font-mono">
                            {pkg.version}
                          </Badge>
                        )}
                        {pkg.provider && (
                          <Badge variant="secondary" className="text-xs">
                            {pkg.provider}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setImportedData(null);
                      setSelectedForImport([]);
                    }}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleImportConfirm}
                    disabled={selectedForImport.length === 0 || isImporting}
                  >
                    {isImporting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {t('packages.installSelected', {
                      count: selectedForImport.length,
                    })}
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
