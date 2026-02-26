'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Search, RefreshCw, FileCode } from 'lucide-react';
import type { PSModuleInfo, PSScriptInfo } from '@/types/tauri';
import { useLocale } from '@/components/providers/locale-provider';

interface TerminalPsModulesTableProps {
  modules: PSModuleInfo[];
  scripts: PSScriptInfo[];
  onFetchModules: () => Promise<void>;
  onFetchScripts: () => Promise<void>;
  loading?: boolean;
}

export function TerminalPsModulesTable({
  modules,
  scripts,
  onFetchModules,
  onFetchScripts,
  loading,
}: TerminalPsModulesTableProps) {
  const { t } = useLocale();
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState<PSModuleInfo | null>(null);

  const filteredModules = modules.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredScripts = scripts.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleRefresh = async () => {
    await Promise.all([onFetchModules(), onFetchScripts()]);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{t('terminal.psModulesScripts')}</CardTitle>
              <CardDescription>{t('terminal.psModulesScriptsDesc')}</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              {t('common.refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t('terminal.searchModules')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Tabs defaultValue="modules">
            <TabsList>
              <TabsTrigger value="modules" className="gap-1.5">
                <Package className="h-3.5 w-3.5" />
                {t('terminal.modules')}
                <Badge variant="secondary" className="ml-1">{modules.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="scripts" className="gap-1.5">
                <FileCode className="h-3.5 w-3.5" />
                {t('terminal.scripts')}
                <Badge variant="secondary" className="ml-1">{scripts.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="modules">
              {filteredModules.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {search ? t('terminal.noSearchResults') : t('terminal.noModules')}
                </p>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="rounded-md border divide-y">
                    {filteredModules.map((mod) => (
                      <div
                        key={`${mod.name}-${mod.version}`}
                        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => setSelectedModule(mod)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <span className="text-sm font-medium">{mod.name}</span>
                            {mod.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                                {mod.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline">{mod.version}</Badge>
                          <Badge variant="secondary" className="text-xs">
                            {mod.moduleType}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="scripts">
              {filteredScripts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {search ? t('terminal.noSearchResults') : t('terminal.noScripts')}
                </p>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="rounded-md border divide-y">
                    {filteredScripts.map((script) => (
                      <div
                        key={script.name}
                        className="flex items-center justify-between px-3 py-2"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileCode className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <span className="text-sm font-medium">{script.name}</span>
                            {script.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                                {script.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline">{script.version}</Badge>
                          <span className="text-xs text-muted-foreground">{script.author}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Module Detail Dialog */}
      <Dialog open={!!selectedModule} onOpenChange={(open) => !open && setSelectedModule(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{selectedModule?.name}</DialogTitle>
            <DialogDescription>
              {t('terminal.moduleDetail')}
            </DialogDescription>
          </DialogHeader>
          {selectedModule && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('terminal.version')}</span>
                  <p className="font-medium">{selectedModule.version}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('terminal.moduleType')}</span>
                  <p className="font-medium">{selectedModule.moduleType}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">{t('terminal.exportedCommands')}</span>
                  <p className="font-medium">{selectedModule.exportedCommandsCount}</p>
                </div>
              </div>
              {selectedModule.description && (
                <div>
                  <span className="text-sm text-muted-foreground">{t('terminal.description')}</span>
                  <p className="text-sm">{selectedModule.description}</p>
                </div>
              )}
              <div>
                <span className="text-sm text-muted-foreground">{t('terminal.path')}</span>
                <p className="text-xs font-mono bg-muted rounded px-2 py-1 mt-1 break-all">
                  {selectedModule.path}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
