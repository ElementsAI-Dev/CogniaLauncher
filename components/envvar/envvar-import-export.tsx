'use client';

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Upload, Download, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { downloadEnvFile } from '@/lib/envvar';
import type { EnvVarScope, EnvFileFormat, EnvVarImportResult } from '@/types/tauri';

interface EnvVarImportExportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (content: string, scope: EnvVarScope) => Promise<EnvVarImportResult | null>;
  onExport: (scope: EnvVarScope, format: EnvFileFormat) => Promise<string | null>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function EnvVarImportExport({
  open,
  onOpenChange,
  onImport,
  onExport,
  t,
}: EnvVarImportExportProps) {
  const [importContent, setImportContent] = useState('');
  const [importScope, setImportScope] = useState<EnvVarScope>('process');
  const [exportScope, setExportScope] = useState<EnvVarScope>('process');
  const [exportFormat, setExportFormat] = useState<EnvFileFormat>('dotenv');
  const [exportContent, setExportContent] = useState('');
  const [copied, setCopied] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (!importContent.trim()) return;
    setImporting(true);
    const result = await onImport(importContent, importScope);
    setImporting(false);
    if (result) {
      if (result.errors.length === 0) {
        toast.success(t('envvar.importExport.importSuccess', { count: result.imported }));
      } else {
        toast.warning(t('envvar.importExport.importPartial', {
          imported: result.imported,
          skipped: result.skipped,
        }));
      }
      setImportContent('');
      onOpenChange(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    const content = await onExport(exportScope, exportFormat);
    setExporting(false);
    if (content) {
      setExportContent(content);
    }
  };

  const handleCopyExport = () => {
    navigator.clipboard.writeText(exportContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t('envvar.table.copied'));
    });
  };

  const handleDownloadExport = () => {
    downloadEnvFile(exportContent, exportFormat);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) setImportContent(content);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('envvar.importExport.import')} / {t('envvar.importExport.export')}</DialogTitle>
          <DialogDescription>{t('envvar.description')}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="import" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import" className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              {t('envvar.importExport.import')}
            </TabsTrigger>
            <TabsTrigger value="export" className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              {t('envvar.importExport.export')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="space-y-3 mt-3">
            <div className="space-y-2">
              <Label>{t('envvar.table.scope')}</Label>
              <Select value={importScope} onValueChange={(v) => setImportScope(v as EnvVarScope)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="process">{t('envvar.scopes.process')}</SelectItem>
                  <SelectItem value="user">{t('envvar.scopes.user')}</SelectItem>
                  <SelectItem value="system">{t('envvar.scopes.system')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('envvar.importExport.pasteContent')}</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".env,.sh,.ps1,.fish,text/plain"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3 w-3" />
                  {t('common.file')}
                </Button>
              </div>
              <Textarea
                value={importContent}
                onChange={(e) => setImportContent(e.target.value)}
                placeholder={'KEY=VALUE\nANOTHER_KEY="some value"'}
                className="font-mono text-xs min-h-[160px]"
              />
            </div>

            <DialogFooter>
              <Button onClick={handleImport} disabled={!importContent.trim() || importing}>
                {importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {importing ? t('common.loading') : t('envvar.importExport.import')}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="export" className="space-y-3 mt-3">
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label>{t('envvar.table.scope')}</Label>
                <Select value={exportScope} onValueChange={(v) => setExportScope(v as EnvVarScope)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="process">{t('envvar.scopes.process')}</SelectItem>
                    <SelectItem value="user">{t('envvar.scopes.user')}</SelectItem>
                    <SelectItem value="system">{t('envvar.scopes.system')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-2">
                <Label>Format</Label>
                <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as EnvFileFormat)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dotenv">{t('envvar.importExport.formatDotenv')}</SelectItem>
                    <SelectItem value="shell">{t('envvar.importExport.formatShell')}</SelectItem>
                    <SelectItem value="fish">{t('envvar.importExport.formatFish')}</SelectItem>
                    <SelectItem value="powershell">{t('envvar.importExport.formatPowerShell')}</SelectItem>
                    <SelectItem value="nushell">{t('envvar.importExport.formatNushell')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button variant="outline" onClick={handleExport} disabled={exporting} className="w-full gap-1.5">
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {exporting ? t('common.loading') : t('envvar.importExport.export')}
            </Button>

            {exportContent && (
              <>
                <Separator />
                <Textarea
                  value={exportContent}
                  readOnly
                  className="font-mono text-xs min-h-[160px]"
                />
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={handleCopyExport} className="gap-1.5">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? t('envvar.table.copied') : t('common.copy')}
                  </Button>
                  <Button onClick={handleDownloadExport} className="gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    {t('common.download')}
                  </Button>
                </DialogFooter>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
