'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Package, Search, RefreshCw, FileCode, Trash2, ArrowUpCircle } from 'lucide-react';
import type { PSModuleInfo, PSScriptInfo } from '@/types/tauri';
import { useLocale } from '@/components/providers/locale-provider';

interface TerminalPsModulesTableProps {
  modules: PSModuleInfo[];
  scripts: PSScriptInfo[];
  onFetchModules: () => Promise<void>;
  onFetchScripts: () => Promise<void>;
  onInstallModule?: (name: string, scope: string) => Promise<void>;
  onUninstallModule?: (name: string) => Promise<void>;
  onUpdateModule?: (name: string) => Promise<void>;
  loading?: boolean;
}

export function TerminalPsModulesTable({
  modules,
  scripts,
  onFetchModules,
  onFetchScripts,
  onInstallModule,
  onUninstallModule,
  onUpdateModule,
  loading,
}: TerminalPsModulesTableProps) {
  const { t } = useLocale();
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState<PSModuleInfo | null>(null);
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [installModuleName, setInstallModuleName] = useState('');
  const [uninstallTarget, setUninstallTarget] = useState<string | null>(null);

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
            <div className="flex items-center gap-2">
              {onInstallModule && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setInstallDialogOpen(true)}
                >
                  <Package className="h-3.5 w-3.5 mr-1" />
                  {t('terminal.installModule')}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleRefresh}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                {t('common.refresh')}
              </Button>
            </div>
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
                <Empty className="border-none py-8">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Package />
                    </EmptyMedia>
                    <EmptyTitle className="text-sm font-normal text-muted-foreground">
                      {search ? t('terminal.noSearchResults') : t('terminal.noModules')}
                    </EmptyTitle>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('terminal.name')}</TableHead>
                          <TableHead className="w-[100px]">{t('terminal.version')}</TableHead>
                          <TableHead className="w-[100px]">{t('terminal.moduleType')}</TableHead>
                          <TableHead className="w-[80px] text-right" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredModules.map((mod) => (
                          <TableRow
                            key={`${mod.name}-${mod.version}`}
                            className="cursor-pointer"
                            onClick={() => setSelectedModule(mod)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2 min-w-0">
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
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{mod.version}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {mod.moduleType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-0.5">
                                {onUpdateModule && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7"
                                        onClick={(e) => { e.stopPropagation(); onUpdateModule(mod.name); }}
                                      >
                                        <ArrowUpCircle className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">{t('terminal.updateModule')}</TooltipContent>
                                  </Tooltip>
                                )}
                                {onUninstallModule && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-destructive"
                                        onClick={(e) => { e.stopPropagation(); setUninstallTarget(mod.name); }}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">{t('terminal.uninstallModule')}</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="scripts">
              {filteredScripts.length === 0 ? (
                <Empty className="border-none py-8">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileCode />
                    </EmptyMedia>
                    <EmptyTitle className="text-sm font-normal text-muted-foreground">
                      {search ? t('terminal.noSearchResults') : t('terminal.noScripts')}
                    </EmptyTitle>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('terminal.name')}</TableHead>
                          <TableHead className="w-[100px]">{t('terminal.version')}</TableHead>
                          <TableHead className="w-[120px] text-right">{t('terminal.author')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredScripts.map((script) => (
                          <TableRow key={script.name}>
                            <TableCell>
                              <div className="flex items-center gap-2 min-w-0">
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
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{script.version}</Badge>
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {script.author}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
              <div className="rounded-md border">
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-muted-foreground font-medium">{t('terminal.version')}</TableCell>
                      <TableCell>{selectedModule.version}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground font-medium">{t('terminal.moduleType')}</TableCell>
                      <TableCell>{selectedModule.moduleType}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground font-medium">{t('terminal.exportedCommands')}</TableCell>
                      <TableCell>{selectedModule.exportedCommandsCount}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
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

      {/* Install Module Dialog */}
      <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t('terminal.installModule')}</DialogTitle>
            <DialogDescription>{t('terminal.installModuleName')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="module-name">{t('terminal.name')}</Label>
            <Input
              id="module-name"
              value={installModuleName}
              onChange={(e) => setInstallModuleName(e.target.value)}
              placeholder="PSReadLine"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && installModuleName.trim() && onInstallModule) {
                  onInstallModule(installModuleName.trim(), 'CurrentUser');
                  setInstallModuleName('');
                  setInstallDialogOpen(false);
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInstallDialogOpen(false)}>
              {t('terminal.cancel')}
            </Button>
            <Button
              disabled={!installModuleName.trim()}
              onClick={() => {
                if (onInstallModule && installModuleName.trim()) {
                  onInstallModule(installModuleName.trim(), 'CurrentUser');
                  setInstallModuleName('');
                  setInstallDialogOpen(false);
                }
              }}
            >
              {t('terminal.installModule')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Uninstall Confirmation */}
      <AlertDialog open={!!uninstallTarget} onOpenChange={(open) => !open && setUninstallTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('terminal.confirmUninstall')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('terminal.confirmUninstallDesc', { name: uninstallTarget ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('terminal.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (uninstallTarget && onUninstallModule) {
                  onUninstallModule(uninstallTarget);
                  setUninstallTarget(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('terminal.uninstallModule')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
