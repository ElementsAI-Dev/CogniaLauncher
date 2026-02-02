'use client';

import { useEffect, useState, useCallback } from 'react';
import { LogPanel } from '@/components/log';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLocale } from '@/components/providers/locale-provider';
import { useLogStore } from '@/lib/stores/log';
import { isTauri, logListFiles, logGetDir } from '@/lib/tauri';
import { ScrollText, FolderOpen, FileText, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

export default function LogsPage() {
  const { t } = useLocale();
  const { logFiles, setLogFiles, getLogStats } = useLogStore();
  const [logDir, setLogDir] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const stats = getLogStats();

  const loadLogFiles = useCallback(async () => {
    if (!isTauri()) return;
    
    setLoading(true);
    try {
      const [files, dir] = await Promise.all([
        logListFiles(),
        logGetDir(),
      ]);
      setLogFiles(files);
      setLogDir(dir);
    } catch (error) {
      console.error('Failed to load log files:', error);
      toast.error(t('logs.loadError'));
    } finally {
      setLoading(false);
    }
  }, [setLogFiles, t]);

  useEffect(() => {
    loadLogFiles();
  }, [loadLogFiles]);

  const handleOpenLogDir = async () => {
    if (!logDir || !isTauri()) return;
    
    try {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
      await revealItemInDir(logDir);
    } catch (error) {
      console.error('Failed to open log directory:', error);
      toast.error(t('logs.openDirError'));
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-6 pb-4 border-b">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScrollText className="h-6 w-6" />
            {t('logs.title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('logs.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadLogFiles}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </Button>
          {logDir && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenLogDir}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              {t('logs.openDir')}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="realtime" className="flex-1 flex flex-col">
        <div className="px-6 pt-4">
          <TabsList>
            <TabsTrigger value="realtime" className="gap-2">
              <ScrollText className="h-4 w-4" />
              {t('logs.realtime')}
              <span className="ml-1 text-xs text-muted-foreground">
                ({stats.total})
              </span>
            </TabsTrigger>
            <TabsTrigger value="files" className="gap-2">
              <FileText className="h-4 w-4" />
              {t('logs.files')}
              <span className="ml-1 text-xs text-muted-foreground">
                ({logFiles.length})
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="realtime" className="flex-1 mt-0 p-6 pt-4">
          <Card className="h-full flex flex-col">
            <CardContent className="flex-1 p-0 overflow-hidden">
              <LogPanel className="h-full" maxHeight="100%" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="flex-1 mt-0 p-6 pt-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>{t('logs.logFiles')}</CardTitle>
              <CardDescription>
                {logDir && (
                  <span className="font-mono text-xs">{logDir}</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">{t('logs.noFiles')}</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {logFiles.map((file) => (
                      <div
                        key={file.name}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatBytes(file.size)} • {formatDate(file.modified)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              // TODO: Implement file viewer
                              toast.info(t('logs.viewerComingSoon'));
                            }}
                          >
                            <FolderOpen className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
