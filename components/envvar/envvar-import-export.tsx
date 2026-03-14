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
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Upload, Download, Copy, Check, Loader2, ClipboardPaste, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { writeClipboard, readClipboard } from '@/lib/clipboard';
import { downloadEnvFile } from '@/lib/envvar';
import type {
  EnvVarScope,
  EnvFileFormat,
  EnvVarImportResult,
  EnvVarImportPreview,
} from '@/types/tauri';

const FORMAT_EXTENSIONS: Record<EnvFileFormat, string> = {
  dotenv: '.env',
  shell: '.sh',
  fish: '.fish',
  powershell: '.ps1',
  nushell: '.nu',
};

interface EnvVarImportExportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport?: (content: string, scope: EnvVarScope) => Promise<EnvVarImportResult | null>;
  onPreviewImport?: (content: string, scope: EnvVarScope) => Promise<EnvVarImportPreview | null>;
  onApplyImportPreview?: (
    content: string,
    scope: EnvVarScope,
    fingerprint: string,
  ) => Promise<EnvVarImportResult | null>;
  onClearImportPreview?: () => void;
  importPreview?: EnvVarImportPreview | null;
  importPreviewStale?: boolean;
  onExport: (scope: EnvVarScope, format: EnvFileFormat) => Promise<string | null>;
  defaultTab?: 'import' | 'export';
  busy?: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function EnvVarImportExport({
  open,
  onOpenChange,
  onImport,
  onPreviewImport,
  onApplyImportPreview,
  onClearImportPreview,
  importPreview = null,
  importPreviewStale = false,
  onExport,
  defaultTab = 'import',
  busy = false,
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
  const previewModeEnabled = Boolean(onPreviewImport && onApplyImportPreview);

  const getPreviewActionLabel = (action: EnvVarImportPreview['items'][number]['action']) => {
    switch (action) {
      case 'add':
        return t('envvar.importExport.previewActionAdd');
      case 'update':
        return t('envvar.importExport.previewActionUpdate');
      case 'noop':
        return t('envvar.importExport.previewActionNoop');
      case 'invalid':
        return t('envvar.importExport.previewActionInvalid');
      case 'skipped':
        return t('envvar.importExport.previewActionSkipped');
      default:
        return action;
    }
  };

  const getPreviewActionBadgeClasses = (action: EnvVarImportPreview['items'][number]['action']) => {
    switch (action) {
      case 'add':
        return 'border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400';
      case 'update':
        return 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400';
      case 'invalid':
        return 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400';
      case 'skipped':
        return 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400';
      case 'noop':
      default:
        return '';
    }
  };

  const handleImport = async () => {
    if (!importContent.trim()) return;
    setImporting(true);
    const result = await onImport?.(importContent, importScope);
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

  const handlePreviewImport = async () => {
    if (!importContent.trim() || !onPreviewImport) return;
    setImporting(true);
    await onPreviewImport(importContent, importScope);
    setImporting(false);
  };

  const handleApplyPreview = async () => {
    if (!importContent.trim() || !importPreview || !onApplyImportPreview) return;
    setImporting(true);
    const result = await onApplyImportPreview(importContent, importScope, importPreview.fingerprint);
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
      onClearImportPreview?.();
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

  const handleCopyExport = async () => {
    await writeClipboard(exportContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(t('envvar.table.copied'));
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
      if (content) {
        setImportContent(content);
        onClearImportPreview?.();
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('envvar.importExport.import')} / {t('envvar.importExport.export')}</DialogTitle>
          <DialogDescription>{t('envvar.description')}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={defaultTab} className="w-full">
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

          {/* ========== IMPORT TAB ========== */}
          <TabsContent value="import" className="mt-3 space-y-3">
            <div className="space-y-2">
              <Label>{t('envvar.table.scope')}</Label>
              <Select
                value={importScope}
                onValueChange={(v) => {
                  setImportScope(v as EnvVarScope);
                  onClearImportPreview?.();
                }}
                disabled={busy || importing}
              >
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
                <div className="flex items-center gap-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".env,.sh,.ps1,.fish,text/plain"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy || importing}
                  >
                    <Upload className="h-3 w-3" />
                    {t('common.file')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1"
                    onClick={async () => {
                      try {
                        const text = await readClipboard();
                        if (text?.trim()) {
                          setImportContent(text);
                          onClearImportPreview?.();
                        }
                      } catch {
                        // Clipboard read failed
                      }
                    }}
                    disabled={busy || importing}
                  >
                    <ClipboardPaste className="h-3 w-3" />
                    {t('envvar.importExport.paste')}
                  </Button>
                </div>
              </div>
              <Alert className="border-dashed">
                <AlertDescription className="text-xs">
                  {t('envvar.importExport.importHint')}
                </AlertDescription>
              </Alert>
              <Textarea
                value={importContent}
                onChange={(e) => {
                  setImportContent(e.target.value);
                  onClearImportPreview?.();
                }}
                placeholder={'KEY=VALUE\nANOTHER_KEY="some value"'}
                className="min-h-40 font-mono text-xs"
                disabled={busy || importing}
              />
            </div>

            {/* Preview summary with colored stat badges */}
            {previewModeEnabled && importPreview && (
              <div className="space-y-2" data-testid="envvar-import-preview-summary">
                <div className="flex flex-wrap items-center gap-1.5">
                  {importPreview.additions > 0 && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-green-500/20 bg-green-500/10 text-[10px] text-green-600 dark:text-green-400"
                    >
                      +{importPreview.additions} {t('envvar.importExport.previewActionAdd')}
                    </Badge>
                  )}
                  {importPreview.updates > 0 && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-blue-500/20 bg-blue-500/10 text-[10px] text-blue-600 dark:text-blue-400"
                    >
                      ~{importPreview.updates} {t('envvar.importExport.previewActionUpdate')}
                    </Badge>
                  )}
                  {importPreview.noops > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {importPreview.noops} {t('envvar.importExport.previewActionNoop')}
                    </Badge>
                  )}
                  {importPreview.invalid > 0 && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-red-500/20 bg-red-500/10 text-[10px] text-red-600 dark:text-red-400"
                    >
                      {importPreview.invalid} {t('envvar.importExport.previewActionInvalid')}
                    </Badge>
                  )}
                  {importPreview.skipped > 0 && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-amber-500/20 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
                    >
                      {importPreview.skipped} {t('envvar.importExport.previewActionSkipped')}
                    </Badge>
                  )}
                </div>
                {importPreview.primaryShellTarget && (
                  <p className="text-xs text-muted-foreground">
                    {t('envvar.importExport.previewTarget', { target: importPreview.primaryShellTarget })}
                  </p>
                )}
              </div>
            )}

            {previewModeEnabled && importPreview && importPreview.items.length > 0 && (
              <div className="space-y-2" data-testid="envvar-import-preview-items">
                <Label>{t('envvar.importExport.previewItems')}</Label>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border bg-muted/20 p-2">
                  {importPreview.items.map((item, index) => (
                    <div
                      key={`${item.key}-${item.action}-${index}`}
                      className="rounded-md border bg-background px-2.5 py-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="break-all font-mono font-medium">{item.key}</p>
                          {item.reason && (
                            <p className="mt-1 break-all text-muted-foreground">{item.reason}</p>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={cn('shrink-0 text-[10px]', getPreviewActionBadgeClasses(item.action))}
                        >
                          {getPreviewActionLabel(item.action)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stale preview warning - amber instead of destructive */}
            {previewModeEnabled && importPreviewStale && (
              <Alert
                className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400 [&>svg]:text-amber-500"
                data-testid="envvar-import-preview-stale"
              >
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{t('envvar.importExport.previewStale')}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                onClick={previewModeEnabled
                  ? (importPreview && !importPreviewStale ? handleApplyPreview : handlePreviewImport)
                  : handleImport}
                disabled={!importContent.trim() || importing || busy}
              >
                {importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {importing
                  ? t('common.loading')
                  : previewModeEnabled
                    ? (importPreview && !importPreviewStale
                        ? t('envvar.importExport.applyPreview')
                        : t('envvar.importExport.preview'))
                    : t('envvar.importExport.import')}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* ========== EXPORT TAB ========== */}
          <TabsContent value="export" className="mt-3 space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label>{t('envvar.table.scope')}</Label>
                <Select value={exportScope} onValueChange={(v) => setExportScope(v as EnvVarScope)} disabled={busy || exporting}>
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
                <Label>{t('envvar.importExport.formatLabel')}</Label>
                <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as EnvFileFormat)} disabled={busy || exporting}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dotenv">
                      <span>{t('envvar.importExport.formatDotenv')}</span>
                      <span className="ml-1.5 text-muted-foreground">{FORMAT_EXTENSIONS.dotenv}</span>
                    </SelectItem>
                    <SelectItem value="shell">
                      <span>{t('envvar.importExport.formatShell')}</span>
                      <span className="ml-1.5 text-muted-foreground">{FORMAT_EXTENSIONS.shell}</span>
                    </SelectItem>
                    <SelectItem value="fish">
                      <span>{t('envvar.importExport.formatFish')}</span>
                      <span className="ml-1.5 text-muted-foreground">{FORMAT_EXTENSIONS.fish}</span>
                    </SelectItem>
                    <SelectItem value="powershell">
                      <span>{t('envvar.importExport.formatPowerShell')}</span>
                      <span className="ml-1.5 text-muted-foreground">{FORMAT_EXTENSIONS.powershell}</span>
                    </SelectItem>
                    <SelectItem value="nushell">
                      <span>{t('envvar.importExport.formatNushell')}</span>
                      <span className="ml-1.5 text-muted-foreground">{FORMAT_EXTENSIONS.nushell}</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Alert className="border-dashed">
              <AlertDescription className="text-xs">
                {t('envvar.importExport.exportHint')}
              </AlertDescription>
            </Alert>

            <Button variant="outline" onClick={handleExport} disabled={exporting || busy} className="w-full gap-1.5">
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {exporting ? t('common.loading') : t('envvar.importExport.export')}
            </Button>

            {exportContent && (
              <>
                <Separator />
                <Textarea
                  value={exportContent}
                  readOnly
                  className="min-h-40 font-mono text-xs"
                />
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={handleCopyExport} className="gap-1.5" disabled={busy || exporting}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? t('envvar.table.copied') : t('common.copy')}
                  </Button>
                  <Button onClick={handleDownloadExport} className="gap-1.5" disabled={busy || exporting}>
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
