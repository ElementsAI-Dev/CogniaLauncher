'use client';

import { useState } from 'react';
import { toast } from 'sonner';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Package, Search, RefreshCw, FileCode, Trash2, ArrowUpCircle, Loader2, Copy } from 'lucide-react';
import type { PSModuleInfo, PSScriptInfo } from '@/types/tauri';
import { useLocale } from '@/components/providers/locale-provider';
import { writeClipboard } from '@/lib/clipboard';

interface TerminalPsModulesTableProps {
  modules: PSModuleInfo[];
  scripts: PSScriptInfo[];
  onFetchModules: () => Promise<void>;
  onFetchScripts: () => Promise<void>;
  onInstallModule?: (name: string, scope: string) => Promise<boolean | void>;
  onUninstallModule?: (name: string) => Promise<boolean | void>;
  onUpdateModule?: (name: string) => Promise<boolean | void>;
  onSearchModules?: (query: string) => Promise<PSModuleInfo[]>;
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
  onSearchModules,
  loading,
}: TerminalPsModulesTableProps) {
  const { t } = useLocale();
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState<PSModuleInfo | null>(null);
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [installModuleName, setInstallModuleName] = useState('');
  const [installScope, setInstallScope] = useState<string>('CurrentUser');
  const [uninstallTarget, setUninstallTarget] = useState<string | null>(null);
  const [operatingModule, setOperatingModule] = useState<string | null>(null);
  const [galleryDialogOpen, setGalleryDialogOpen] = useState(false);
  const [gallerySearch, setGallerySearch] = useState('');
  const [galleryResults, setGalleryResults] = useState<PSModuleInfo[]>([]);
  const [gallerySearching, setGallerySearching] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    status: 'success' | 'error';
    title: string;
    description: string;
  } | null>(null);

  const filteredModules = modules.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredScripts = scripts.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleRefresh = async () => {
    await Promise.all([onFetchModules(), onFetchScripts()]);
  };

  const setModuleFeedback = (
    status: 'success' | 'error',
    titleKey: string,
    descriptionKey: string,
    name: string,
  ) => {
    setActionFeedback({
      status,
      title: t(titleKey),
      description: t(descriptionKey, { name }),
    });
  };

  const runModuleAction = async (
    name: string,
    execute: () => Promise<boolean | void>,
    successKey: string,
    errorKey: string,
  ) => {
    const result = await execute();
    if (result === false) {
      setModuleFeedback('error', 'terminal.moduleActionErrorTitle', errorKey, name);
      return false;
    }
    setModuleFeedback('success', 'terminal.moduleActionSuccessTitle', successKey, name);
    return true;
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
          <CardTitle className="text-base">{t('terminal.psModulesScripts')}</CardTitle>
          <CardDescription>{t('terminal.psModulesScriptsDesc')}</CardDescription>
          <CardAction className="flex items-center gap-2">
            {onSearchModules && (
              <Button size="sm" variant="outline" onClick={() => setGalleryDialogOpen(true)}>
                <Search className="h-3.5 w-3.5 mr-1" />
                {t('terminal.searchGallery')}
              </Button>
            )}
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
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {actionFeedback && (
            <Alert variant={actionFeedback.status === 'error' ? 'destructive' : 'default'}>
              <AlertTitle>{actionFeedback.title}</AlertTitle>
              <AlertDescription>{actionFeedback.description}</AlertDescription>
            </Alert>
          )}
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
                            tabIndex={0}
                            aria-label={`${t('terminal.moduleDetail')}: ${mod.name}`}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                setSelectedModule(mod);
                              }
                            }}
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
                                        disabled={operatingModule === mod.name}
                                        title={t('terminal.updateModule')}
                                        aria-label={`${t('terminal.updateModule')} ${mod.name}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setOperatingModule(mod.name);
                                          void runModuleAction(
                                            mod.name,
                                            () => onUpdateModule(mod.name),
                                            'terminal.moduleActionUpdateSuccess',
                                            'terminal.moduleActionUpdateFailed',
                                          ).finally(() => setOperatingModule(null));
                                        }}
                                      >
                                        {operatingModule === mod.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpCircle className="h-3.5 w-3.5" />}
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
                                        disabled={operatingModule === mod.name}
                                        title={t('terminal.uninstallModule')}
                                        aria-label={`${t('terminal.uninstallModule')} ${mod.name}`}
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
                          <TableHead className="w-[120px]">{t('terminal.author')}</TableHead>
                          <TableHead className="w-[50px] text-right" />
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
                            <TableCell className="text-xs text-muted-foreground">
                              {script.author}
                            </TableCell>
                            <TableCell className="text-right">
                              {script.installPath && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      title={t('terminal.copyPath')}
                                      aria-label={`${t('terminal.copyPath')} ${script.name}`}
                                      onClick={() => {
                                        writeClipboard(script.installPath).then(() => {
                                          toast.success(t('terminal.pathCopied'));
                                        });
                                      }}
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">{t('terminal.copyPath')}</TooltipContent>
                                </Tooltip>
                              )}
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
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="module-name">{t('terminal.name')}</Label>
              <Input
                id="module-name"
                value={installModuleName}
                onChange={(e) => setInstallModuleName(e.target.value)}
                placeholder="PSReadLine"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && installModuleName.trim() && onInstallModule) {
                    void runModuleAction(
                      installModuleName.trim(),
                      () => onInstallModule(installModuleName.trim(), installScope),
                      'terminal.moduleActionInstallSuccess',
                      'terminal.moduleActionInstallFailed',
                    ).then((success) => {
                      if (!success) return;
                      setInstallModuleName('');
                      setInstallDialogOpen(false);
                    });
                  }
                }}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('terminal.installModuleScope')}</Label>
              <Select value={installScope} onValueChange={setInstallScope}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CurrentUser">{t('terminal.scopeCurrentUser')}</SelectItem>
                  <SelectItem value="AllUsers">{t('terminal.scopeAllUsers')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInstallDialogOpen(false)}>
              {t('terminal.cancel')}
            </Button>
            <Button
              disabled={!installModuleName.trim()}
              onClick={() => {
                if (onInstallModule && installModuleName.trim()) {
                  void runModuleAction(
                    installModuleName.trim(),
                    () => onInstallModule(installModuleName.trim(), installScope),
                    'terminal.moduleActionInstallSuccess',
                    'terminal.moduleActionInstallFailed',
                  ).then((success) => {
                    if (!success) return;
                    setInstallModuleName('');
                    setInstallDialogOpen(false);
                  });
                }
              }}
            >
              {t('terminal.installModule')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gallery Search Dialog */}
      <Dialog open={galleryDialogOpen} onOpenChange={setGalleryDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t('terminal.galleryResults')}</DialogTitle>
            <DialogDescription>{t('terminal.searchGalleryPlaceholder')}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={gallerySearch}
                onChange={(e) => setGallerySearch(e.target.value)}
                placeholder={t('terminal.searchGalleryPlaceholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && gallerySearch.trim() && onSearchModules) {
                    setGallerySearching(true);
                    onSearchModules(gallerySearch.trim()).then(setGalleryResults).finally(() => setGallerySearching(false));
                  }
                }}
              />
            </div>
            <Button size="sm" disabled={!gallerySearch.trim() || gallerySearching || !onSearchModules} onClick={() => {
              if (!onSearchModules) return;
              setGallerySearching(true);
              onSearchModules(gallerySearch.trim()).then(setGalleryResults).finally(() => setGallerySearching(false));
            }}>
              {gallerySearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          <ScrollArea className="max-h-[50vh]">
            {galleryResults.length > 0 ? (
              <div className="rounded-md border divide-y">
                {galleryResults.map((mod) => (
                  <div key={mod.name} className="flex items-center justify-between p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{mod.name}</p>
                      {mod.description && <p className="text-xs text-muted-foreground truncate">{mod.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Badge variant="outline">{mod.version}</Badge>
                      {onInstallModule && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                          void runModuleAction(
                            mod.name,
                            () => onInstallModule(mod.name, 'CurrentUser'),
                            'terminal.moduleActionInstallSuccess',
                            'terminal.moduleActionInstallFailed',
                          ).then((success) => {
                            if (!success) return;
                            setGalleryDialogOpen(false);
                          });
                        }}>
                          {t('terminal.installModule')}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : gallerySearching ? (
              <div className="py-8 text-center">
                <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
              </div>
            ) : null}
          </ScrollArea>
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
                  void runModuleAction(
                    uninstallTarget,
                    () => onUninstallModule(uninstallTarget),
                    'terminal.moduleActionUninstallSuccess',
                    'terminal.moduleActionUninstallFailed',
                  ).then(() => {
                    setUninstallTarget(null);
                  });
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
