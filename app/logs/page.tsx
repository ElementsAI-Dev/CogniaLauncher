'use client';

import { useEffect, useState, useCallback } from 'react';
import { LogPanel } from '@/components/log';
import { LogFileViewer } from '@/components/log/log-file-viewer';
import { LogManagementCard } from '@/components/log/log-management-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/layout/page-header';
import { useLocale } from '@/components/providers/locale-provider';
import { useLogStore } from '@/lib/stores/log';
import { useLogs } from '@/hooks/use-logs';
import { isTauri, logListFiles, logGetDir } from '@/lib/tauri';
import { formatBytes, formatDate } from '@/lib/utils';
import { formatSessionLabel } from '@/lib/log';
import { ScrollText, FolderOpen, FileText, RefreshCw, Trash2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LogsPage() {
  const { t } = useLocale();
  const { logFiles, setLogFiles, getLogStats, selectedLogFile, setSelectedLogFile } = useLogStore();
  const { cleanupLogs, deleteLogFiles, getTotalSize } = useLogs();
  const [logDir, setLogDir] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [totalSize, setTotalSize] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const stats = getLogStats();

  const loadLogFiles = useCallback(async () => {
    if (!isTauri()) return;
    
    setLoading(true);
    try {
      const [files, dir, size] = await Promise.all([
        logListFiles(),
        logGetDir(),
        getTotalSize(),
      ]);
      setLogFiles(files);
      setLogDir(dir);
      setTotalSize(size);
      setSelectedFiles(new Set());
    } catch (error) {
      console.error('Failed to load log files:', error);
      toast.error(t('logs.loadError'));
    } finally {
      setLoading(false);
    }
  }, [setLogFiles, getTotalSize, t]);

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

  const handleCloseViewer = useCallback(() => setSelectedLogFile(null), [setSelectedLogFile]);

  const toggleFileSelection = useCallback((fileName: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileName)) {
        next.delete(fileName);
      } else {
        next.add(fileName);
      }
      return next;
    });
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedFiles.size === 0) return;
    const result = await deleteLogFiles(Array.from(selectedFiles));
    if (result && result.deletedCount > 0) {
      toast.success(t('logs.deleteSuccess', { count: result.deletedCount }));
      setSelectedFiles(new Set());
      loadLogFiles();
    }
  }, [selectedFiles, deleteLogFiles, t, loadLogFiles]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 p-4 sm:p-6 pb-3 sm:pb-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <PageHeader
          title={
            <span className="flex items-center gap-2">
              <ScrollText className="h-5 w-5 sm:h-6 sm:w-6" />
              {t('logs.title')}
            </span>
          }
          description={t('logs.description')}
          actions={(
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadLogFiles}
                disabled={loading}
                className="h-8 sm:h-9"
              >
                <RefreshCw className={`h-4 w-4 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{t('common.refresh')}</span>
              </Button>
              {logDir && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenLogDir}
                  className="h-8 sm:h-9"
                >
                  <FolderOpen className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">{t('logs.openDir')}</span>
                </Button>
              )}
            </div>
          )}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="realtime" className="flex-1 flex flex-col min-h-0">
        <div className="shrink-0 px-4 sm:px-6 pt-3 sm:pt-4">
          <TabsList className="h-10 p-1">
            <TabsTrigger value="realtime" className="gap-2 px-3 sm:px-4 h-8">
              <ScrollText className="h-4 w-4" />
              <span className="hidden xs:inline">{t('logs.realtime')}</span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-medium tabular-nums">
                {stats.total}
              </span>
            </TabsTrigger>
            <TabsTrigger value="files" className="gap-2 px-3 sm:px-4 h-8">
              <FileText className="h-4 w-4" />
              <span className="hidden xs:inline">{t('logs.files')}</span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-medium tabular-nums">
                {logFiles.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="management" className="gap-2 px-3 sm:px-4 h-8 lg:hidden">
              <Settings2 className="h-4 w-4" />
              <span className="hidden xs:inline">{t('logs.management')}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Real-time logs tab */}
        <TabsContent value="realtime" className="flex-1 mt-0 p-4 sm:p-6 pt-3 sm:pt-4 min-h-0">
          <LogPanel className="h-full" maxHeight="100%" showToolbar />
        </TabsContent>

        {/* Log files tab */}
        <TabsContent value="files" className="flex-1 mt-0 p-4 sm:p-6 pt-3 sm:pt-4 overflow-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 h-full">
            {/* File list */}
            <Card className="flex flex-col">
              <CardHeader className="shrink-0 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base sm:text-lg">{t('logs.logFiles')}</CardTitle>
                    {logDir && (
                      <CardDescription>
                        <code className="text-[11px] sm:text-xs bg-muted px-2 py-1 rounded break-all">{logDir}</code>
                      </CardDescription>
                    )}
                  </div>
                  {selectedFiles.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteSelected}
                      className="h-8"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      {t('logs.deleteSelected')} ({selectedFiles.size})
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 pt-0">
                {!isTauri() ? (
                  <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-muted-foreground">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl scale-150" />
                      <FileText className="relative h-14 w-14 sm:h-16 sm:w-16 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm sm:text-base font-medium text-foreground/70">{t('logs.desktopOnly')}</p>
                    <p className="text-xs sm:text-sm mt-2 text-center max-w-[280px]">{t('logs.desktopOnlyDescription')}</p>
                  </div>
                ) : logFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-muted-foreground">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl scale-150" />
                      <FileText className="relative h-14 w-14 sm:h-16 sm:w-16 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm sm:text-base font-medium text-foreground/70">{t('logs.noFiles')}</p>
                  </div>
                ) : (
                  <ScrollArea className="h-full max-h-[calc(100vh-320px)]">
                    <div className="space-y-2 pr-4">
                      {logFiles.map((file, index) => {
                        const sessionLabel = formatSessionLabel(file.name);
                        const isCurrent = index === 0;
                        const isSelected = selectedFiles.has(file.name);
                        return (
                          <div
                            key={file.name}
                            className={`group flex items-center gap-3 p-3 sm:p-4 rounded-lg border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-primary/5 border-primary/30'
                                : 'bg-card hover:bg-muted/30 hover:border-primary/20'
                            }`}
                            onClick={() => setSelectedLogFile(file.name)}
                          >
                            {!isCurrent && (
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleFileSelection(file.name)}
                                onClick={(e) => e.stopPropagation()}
                                className="shrink-0"
                              />
                            )}
                            <div className="shrink-0 p-2 rounded-lg bg-muted/50 group-hover:bg-primary/10 transition-colors">
                              <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm truncate">
                                  {sessionLabel ?? file.name}
                                </p>
                                {isCurrent && (
                                  <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
                                    {t('logs.currentSession')}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatBytes(file.size)} • {formatDate(file.modified)}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLogFile(file.name);
                              }}
                              title={t('logs.viewFile')}
                            >
                              <FolderOpen className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Management sidebar */}
            {isTauri() && (
              <div className="hidden lg:block">
                <LogManagementCard
                  totalSize={totalSize}
                  fileCount={logFiles.length}
                  onCleanup={cleanupLogs}
                  onRefresh={loadLogFiles}
                />
              </div>
            )}
          </div>
        </TabsContent>

        {/* Management tab (mobile only, on desktop it's a sidebar) */}
        <TabsContent value="management" className="flex-1 mt-0 p-4 sm:p-6 pt-3 sm:pt-4 overflow-auto lg:hidden">
          {isTauri() && (
            <LogManagementCard
              totalSize={totalSize}
              fileCount={logFiles.length}
              onCleanup={cleanupLogs}
              onRefresh={loadLogFiles}
            />
          )}
        </TabsContent>
      </Tabs>

      <LogFileViewer
        open={Boolean(selectedLogFile)}
        fileName={selectedLogFile}
        onOpenChange={(open) => {
          if (!open) handleCloseViewer();
        }}
      />
    </div>
  );
}
