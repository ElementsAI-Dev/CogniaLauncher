'use client';

import { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FileText, Copy, RefreshCw, Pencil, Save, AlertCircle } from 'lucide-react';
import type { ShellInfo, ShellType, ShellConfigEntries } from '@/types/tauri';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';

interface TerminalShellConfigProps {
  shells: ShellInfo[];
  onReadConfig: (path: string) => Promise<string>;
  onFetchConfigEntries: (path: string, shellType: ShellType) => Promise<ShellConfigEntries | null>;
  onParseConfigContent?: (content: string, shellType: ShellType) => Promise<ShellConfigEntries | null>;
  onBackupConfig: (path: string) => Promise<string | undefined>;
  onWriteConfig?: (path: string, content: string) => Promise<void>;
}

export function TerminalShellConfig({
  shells,
  onReadConfig,
  onFetchConfigEntries,
  onParseConfigContent,
  onBackupConfig,
  onWriteConfig,
}: TerminalShellConfigProps) {
  const { t } = useLocale();
  const [selectedShellId, setSelectedShellId] = useState<string>(shells[0]?.id ?? '');
  const [selectedConfigPath, setSelectedConfigPath] = useState<string>('');
  const [configContent, setConfigContent] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [editing, setEditing] = useState(false);
  const [entries, setEntries] = useState<ShellConfigEntries | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const selectedShell = shells.find((s) => s.id === selectedShellId);
  const configFiles = selectedShell?.configFiles.filter((f) => f.exists) ?? [];

  const handleShellChange = (shellId: string) => {
    setSelectedShellId(shellId);
    setSelectedConfigPath('');
    setConfigContent(null);
    setEditContent('');
    setEditing(false);
    setEntries(null);
    setError(null);
    setLoaded(false);
  };

  const handleLoadConfig = async () => {
    if (!selectedConfigPath || !selectedShell) return;
    setLoading(true);
    setError(null);
    try {
      const content = await onReadConfig(selectedConfigPath);
      setConfigContent(content);
      // Parse from already-read content (avoids double file read)
      const parsed = onParseConfigContent
        ? await onParseConfigContent(content, selectedShell.shellType)
        : await onFetchConfigEntries(selectedConfigPath, selectedShell.shellType);
      setEntries(parsed);
      setLoaded(true);
    } catch (e) {
      setError(String(e));
      setConfigContent(null);
      setEntries(null);
      setLoaded(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyContent = async () => {
    if (configContent == null) return;
    try {
      await navigator.clipboard.writeText(configContent);
      toast.success(t('terminal.configCopied'));
    } catch {
      toast.error(t('terminal.configCopyFailed'));
    }
  };

  const handleBackup = async () => {
    if (!selectedConfigPath) return;
    await onBackupConfig(selectedConfigPath);
  };

  if (shells.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('terminal.shellConfig')}</CardTitle>
        <CardDescription>{t('terminal.shellConfigDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Select value={selectedShellId} onValueChange={handleShellChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('terminal.selectShell')} />
            </SelectTrigger>
            <SelectContent>
              {shells.map((shell) => (
                <SelectItem key={shell.id} value={shell.id}>
                  {shell.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {configFiles.length > 0 && (
            <Select value={selectedConfigPath} onValueChange={setSelectedConfigPath}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={t('terminal.selectConfigFile')} />
              </SelectTrigger>
              <SelectContent>
                {configFiles.map((cf) => (
                  <SelectItem key={cf.path} value={cf.path}>
                    <span className="font-mono text-xs">{cf.path}</span>
                    <span className="ml-2 text-muted-foreground text-xs">
                      ({(cf.sizeBytes / 1024).toFixed(1)} KB)
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            size="sm"
            onClick={handleLoadConfig}
            disabled={!selectedConfigPath || loading}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            {t('terminal.loadConfig')}
          </Button>
        </div>

        {configFiles.length === 0 && selectedShellId && (
          <p className="text-sm text-muted-foreground">{t('terminal.noConfigFiles')}</p>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="break-all">{error}</span>
            <Button size="sm" variant="outline" className="ml-auto shrink-0" onClick={handleLoadConfig}>
              {t('terminal.loadConfig')}
            </Button>
          </div>
        )}

        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}

        {entries && !loading && (
          <Accordion type="multiple" defaultValue={['aliases', 'exports', 'sources']}>
            {entries.aliases.length > 0 && (
              <AccordionItem value="aliases">
                <AccordionTrigger className="py-3">
                  <span className="flex items-center gap-2 text-sm">
                    {t('terminal.aliases')}
                    <Badge variant="secondary">{entries.aliases.length}</Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="rounded-md border">
                    <ScrollArea className="max-h-[200px]">
                      <div className="p-2 space-y-1">
                        {entries.aliases.map(([name, value], i) => (
                          <div key={i} className="flex items-center gap-2 text-xs font-mono">
                            <span className="text-primary font-semibold min-w-[100px]">{name}</span>
                            <span className="text-muted-foreground">=</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="truncate cursor-default">{value}</span>
                              </TooltipTrigger>
                              {value.length > 40 && (
                                <TooltipContent side="bottom" className="max-w-sm font-mono text-xs break-all">
                                  {value}
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {entries.exports.length > 0 && (
              <AccordionItem value="exports">
                <AccordionTrigger className="py-3">
                  <span className="flex items-center gap-2 text-sm">
                    {t('terminal.envExports')}
                    <Badge variant="secondary">{entries.exports.length}</Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="rounded-md border">
                    <ScrollArea className="max-h-[200px]">
                      <div className="p-2 space-y-1">
                        {entries.exports.map(([key, value], i) => (
                          <div key={i} className="flex items-center gap-2 text-xs font-mono">
                            <span className="text-primary font-semibold min-w-[100px]">{key}</span>
                            <span className="text-muted-foreground">=</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="truncate cursor-default">{value}</span>
                              </TooltipTrigger>
                              {value.length > 40 && (
                                <TooltipContent side="bottom" className="max-w-sm font-mono text-xs break-all">
                                  {value}
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {entries.sources.length > 0 && (
              <AccordionItem value="sources">
                <AccordionTrigger className="py-3">
                  <span className="flex items-center gap-2 text-sm">
                    {t('terminal.sources')}
                    <Badge variant="secondary">{entries.sources.length}</Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="rounded-md border p-2 space-y-1">
                    {entries.sources.map((src, i) => (
                      <div key={i} className="text-xs font-mono flex items-center gap-2">
                        <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="truncate cursor-default">{src}</span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-sm font-mono text-xs break-all">
                            {src}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        )}

        {loaded && configContent != null && !loading && (
          <>
          <Separator />
          <div className="space-y-3">
            {editing ? (
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="font-mono text-xs min-h-[200px]"
              />
            ) : null}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleCopyContent}>
                <Copy className="h-3.5 w-3.5 mr-1" />
                {t('terminal.copyConfig')}
              </Button>
              <Button size="sm" variant="outline" onClick={handleBackup}>
                <FileText className="h-3.5 w-3.5 mr-1" />
                {t('terminal.backupConfig')}
              </Button>
              {onWriteConfig && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (editing) {
                      setEditing(false);
                      setEditContent('');
                    } else {
                      setEditContent(configContent);
                      setEditing(true);
                    }
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  {editing ? t('terminal.cancel') : t('terminal.editConfig')}
                </Button>
              )}
              {editing && onWriteConfig && (
                <Button
                  size="sm"
                  onClick={async () => {
                    await onWriteConfig(selectedConfigPath, editContent);
                    setConfigContent(editContent);
                    setEditing(false);
                  }}
                >
                  <Save className="h-3.5 w-3.5 mr-1" />
                  {t('terminal.saveConfig')}
                </Button>
              )}
            </div>
          </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
