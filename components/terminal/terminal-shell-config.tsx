'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Copy, RefreshCw, Pencil, Save } from 'lucide-react';
import type { ShellInfo, ShellType, ShellConfigEntries } from '@/types/tauri';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';

interface TerminalShellConfigProps {
  shells: ShellInfo[];
  onReadConfig: (path: string) => Promise<string>;
  onFetchConfigEntries: (path: string, shellType: ShellType) => Promise<ShellConfigEntries | null>;
  onBackupConfig: (path: string) => Promise<string | undefined>;
  onWriteConfig?: (path: string, content: string) => Promise<void>;
}

export function TerminalShellConfig({
  shells,
  onReadConfig,
  onFetchConfigEntries,
  onBackupConfig,
  onWriteConfig,
}: TerminalShellConfigProps) {
  const { t } = useLocale();
  const [selectedShellId, setSelectedShellId] = useState<string>(shells[0]?.id ?? '');
  const [selectedConfigPath, setSelectedConfigPath] = useState<string>('');
  const [configContent, setConfigContent] = useState<string>('');
  const [editContent, setEditContent] = useState<string>('');
  const [editing, setEditing] = useState(false);
  const [entries, setEntries] = useState<ShellConfigEntries | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedShell = shells.find((s) => s.id === selectedShellId);
  const configFiles = selectedShell?.configFiles.filter((f) => f.exists) ?? [];

  const handleShellChange = (shellId: string) => {
    setSelectedShellId(shellId);
    setSelectedConfigPath('');
    setConfigContent('');
    setEditContent('');
    setEditing(false);
    setEntries(null);
  };

  const handleLoadConfig = async () => {
    if (!selectedConfigPath || !selectedShell) return;
    setLoading(true);
    try {
      const [content, parsed] = await Promise.all([
        onReadConfig(selectedConfigPath),
        onFetchConfigEntries(selectedConfigPath, selectedShell.shellType),
      ]);
      setConfigContent(content);
      setEntries(parsed);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyContent = async () => {
    if (!configContent) return;
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

        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}

        {entries && !loading && (
          <div className="space-y-4">
            {entries.aliases.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  {t('terminal.aliases')}
                  <Badge variant="secondary">{entries.aliases.length}</Badge>
                </h4>
                <div className="rounded-md border">
                  <ScrollArea className="max-h-[200px]">
                    <div className="p-2 space-y-1">
                      {entries.aliases.map(([name, value], i) => (
                        <div key={i} className="flex items-center gap-2 text-xs font-mono">
                          <span className="text-primary font-semibold min-w-[100px]">{name}</span>
                          <span className="text-muted-foreground">=</span>
                          <span className="truncate">{value}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}

            {entries.exports.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  {t('terminal.envExports')}
                  <Badge variant="secondary">{entries.exports.length}</Badge>
                </h4>
                <div className="rounded-md border">
                  <ScrollArea className="max-h-[200px]">
                    <div className="p-2 space-y-1">
                      {entries.exports.map(([key, value], i) => (
                        <div key={i} className="flex items-center gap-2 text-xs font-mono">
                          <span className="text-primary font-semibold min-w-[100px]">{key}</span>
                          <span className="text-muted-foreground">=</span>
                          <span className="truncate">{value}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}

            {entries.sources.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  {t('terminal.sources')}
                  <Badge variant="secondary">{entries.sources.length}</Badge>
                </h4>
                <div className="rounded-md border p-2 space-y-1">
                  {entries.sources.map((src, i) => (
                    <div key={i} className="text-xs font-mono flex items-center gap-2">
                      <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{src}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {configContent && !loading && (
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
        )}
      </CardContent>
    </Card>
  );
}
