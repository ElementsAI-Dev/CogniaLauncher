'use client';

import { useState, useMemo } from 'react';
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
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Play, Pencil, Trash2, Star, Plus, Loader2, Copy, Download, Upload, MoreHorizontal, Terminal, LayoutTemplate, Bookmark, Search, ChevronDown } from 'lucide-react';
import type { LaunchResult, TerminalProfile } from '@/types/tauri';
import { getShellIcon } from '@/components/terminal/shared/shell-icon';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import { writeClipboard } from '@/lib/clipboard';

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const now = Date.now();
  const diffMs = now - date.getTime();
  if (diffMs < 0) return '';
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

type ImportStrategy = 'merge' | 'replace';

interface ProfileImportSummary {
  total: number;
  valid: number;
  conflicts: number;
  invalid: number;
}

async function readFileText(file: File): Promise<string> {
  const fileWithText = file as File & { text?: () => Promise<string> };
  if (typeof fileWithText.text === 'function') {
    return fileWithText.text();
  }
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('failed to read file'));
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsText(file);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractProfileEntries(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload) && Array.isArray(payload.profiles)) return payload.profiles;
  return null;
}

function isValidImportProfile(value: unknown): value is { id?: string; name: string; shellId: string } {
  return isRecord(value)
    && typeof value.name === 'string'
    && value.name.trim().length > 0
    && typeof value.shellId === 'string'
    && value.shellId.trim().length > 0;
}

interface TerminalProfileListProps {
  profiles: TerminalProfile[];
  onLaunch: (id: string) => void;
  onEdit: (profile: TerminalProfile) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  onCreateNew: () => void;
  onDuplicate?: (id: string) => void;
  onExportAll?: () => void;
  onImport?: (json: string, merge: boolean) => Promise<number | void> | number | void;
  onFromTemplate?: () => void;
  onSaveAsTemplate?: (profileId: string) => void;
  launchingProfileId?: string | null;
  lastLaunchResult?: {
    profileId: string;
    result: LaunchResult;
  } | null;
  onClearLaunchResult?: () => void;
}

export function TerminalProfileList({
  profiles,
  onLaunch,
  onEdit,
  onDelete,
  onSetDefault,
  onCreateNew,
  onDuplicate,
  onExportAll,
  onImport,
  onFromTemplate,
  onSaveAsTemplate,
  launchingProfileId = null,
  lastLaunchResult = null,
  onClearLaunchResult,
}: TerminalProfileListProps) {
  const { t } = useLocale();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importPayload, setImportPayload] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ProfileImportSummary | null>(null);
  const [importStrategy, setImportStrategy] = useState<ImportStrategy>('merge');
  const [importing, setImporting] = useState(false);

  const sortedProfiles = useMemo(() => {
    let filtered = profiles;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = profiles.filter(
        (p) => p.name.toLowerCase().includes(q) || p.shellId.toLowerCase().includes(q) || (p.envType && p.envType.toLowerCase().includes(q)),
      );
    }
    return [...filtered].sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
  }, [profiles, search]);

  const handlePrepareImport = async (file: File) => {
    const raw = await readFileText(file);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      toast.error(t('terminal.importValidationInvalidJson'));
      return;
    }

    const entries = extractProfileEntries(parsed);
    if (!entries) {
      toast.error(t('terminal.importValidationInvalidFormat'));
      return;
    }

    const existingIds = new Set(profiles.map((profile) => profile.id));
    let valid = 0;
    let conflicts = 0;
    let invalid = 0;
    for (const entry of entries) {
      if (!isValidImportProfile(entry)) {
        invalid += 1;
        continue;
      }
      valid += 1;
      if (entry.id && existingIds.has(entry.id)) {
        conflicts += 1;
      }
    }

    if (valid === 0) {
      toast.error(t('terminal.importValidationNoValidEntries'));
      return;
    }

    setImportPayload(raw);
    setImportSummary({ total: entries.length, valid, conflicts, invalid });
    setImportStrategy('merge');
    setImportDialogOpen(true);
  };

  const handleConfirmImport = async () => {
    if (!onImport || !importPayload) return;
    setImporting(true);
    try {
      await onImport(importPayload, importStrategy === 'merge');
      setImportDialogOpen(false);
      setImportPayload(null);
      setImportSummary(null);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {profiles.length > 0 && (
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-9 text-sm"
                placeholder={t('terminal.searchProfiles')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onImport && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) await handlePrepareImport(file);
                };
                input.click();
              }}
            >
              <Upload className="mr-1 h-3.5 w-3.5" />
              {t('terminal.importProfiles')}
            </Button>
          )}
          {onExportAll && profiles.length > 0 && (
            <Button size="sm" variant="outline" onClick={onExportAll}>
              <Download className="mr-1 h-3.5 w-3.5" />
              {t('terminal.exportProfiles')}
            </Button>
          )}
          {onFromTemplate && (
            <Button size="sm" variant="outline" onClick={onFromTemplate}>
              <LayoutTemplate className="mr-1 h-3.5 w-3.5" />
              {t('terminal.fromTemplate')}
            </Button>
          )}
          <Button size="sm" onClick={onCreateNew}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t('terminal.createProfile')}
          </Button>
        </div>
      </div>

      {/* Launch result card */}
      {lastLaunchResult && (
        <Card aria-live="polite">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('terminal.lastLaunchResult')}</CardTitle>
            <CardDescription>
              {t('terminal.profileId')}: {lastLaunchResult.profileId}
            </CardDescription>
            <CardAction className="flex flex-wrap items-center gap-2">
              <Badge variant={lastLaunchResult.result.success ? 'secondary' : 'destructive'}>
                {lastLaunchResult.result.success ? t('terminal.launchSuccess') : t('terminal.launchFailed')}
              </Badge>
              <Badge variant="outline">
                {t('terminal.exitCode')}: {lastLaunchResult.result.exitCode}
              </Badge>
              {onClearLaunchResult && (
                <Button variant="ghost" size="sm" onClick={onClearLaunchResult}>
                  {t('terminal.clearLaunchResult')}
                </Button>
              )}
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            <Collapsible defaultOpen>
              <div className="flex items-center justify-between">
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDown className="h-3 w-3 transition-transform [[data-state=closed]_&]:rotate-(-90)" />
                  stdout
                </CollapsibleTrigger>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={async () => {
                    await writeClipboard(lastLaunchResult.result.stdout || '');
                    toast.success(t('terminal.copied'));
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <CollapsibleContent>
                <pre className="max-h-40 overflow-auto rounded-md border bg-muted/30 p-2 text-xs whitespace-pre-wrap mt-1">
                  {lastLaunchResult.result.stdout || t('terminal.noOutput')}
                </pre>
              </CollapsibleContent>
            </Collapsible>
            <Collapsible defaultOpen>
              <div className="flex items-center justify-between">
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDown className="h-3 w-3 transition-transform [[data-state=closed]_&]:rotate-(-90)" />
                  stderr
                </CollapsibleTrigger>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={async () => {
                    await writeClipboard(lastLaunchResult.result.stderr || '');
                    toast.success(t('terminal.copied'));
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <CollapsibleContent>
                <pre className="max-h-40 overflow-auto rounded-md border bg-muted/30 p-2 text-xs whitespace-pre-wrap mt-1">
                  {lastLaunchResult.result.stderr || t('terminal.noOutput')}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('terminal.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('terminal.confirmDeleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('terminal.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteId) { onDelete(deleteId); setDeleteId(null); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('terminal.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import dialog */}
      <Dialog
        open={importDialogOpen}
        onOpenChange={(open) => {
          setImportDialogOpen(open);
          if (!open && !importing) {
            setImportPayload(null);
            setImportSummary(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{t('terminal.importPreviewTitle')}</DialogTitle>
            <DialogDescription>{t('terminal.importPreviewDesc')}</DialogDescription>
          </DialogHeader>
          {importSummary && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>{t('terminal.importSummaryTotal')}</div>
                <div className="text-right font-medium">{importSummary.total}</div>
                <div>{t('terminal.importSummaryValid')}</div>
                <div className="text-right font-medium">{importSummary.valid}</div>
                <div>{t('terminal.importSummaryConflicts')}</div>
                <div className="text-right font-medium">{importSummary.conflicts}</div>
                <div>{t('terminal.importSummaryInvalid')}</div>
                <div className="text-right font-medium">{importSummary.invalid}</div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">{t('terminal.importStrategyLabel')}</p>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant={importStrategy === 'merge' ? 'default' : 'outline'} onClick={() => setImportStrategy('merge')}>
                    {t('terminal.importMerge')}
                  </Button>
                  <Button type="button" size="sm" variant={importStrategy === 'replace' ? 'default' : 'outline'} onClick={() => setImportStrategy('replace')}>
                    {t('terminal.importReplace')}
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)} disabled={importing}>
              {t('terminal.cancel')}
            </Button>
            <Button onClick={() => void handleConfirmImport()} disabled={importing || !importPayload}>
              {importing ? t('terminal.importing') : t('terminal.importConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile table */}
      {sortedProfiles.length === 0 && profiles.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Terminal />
            </EmptyMedia>
            <EmptyTitle className="text-sm font-normal text-muted-foreground">
              {t('terminal.noProfiles')}
            </EmptyTitle>
          </EmptyHeader>
          <Button variant="outline" onClick={onCreateNew}>
            <Plus className="mr-2 h-4 w-4" />
            {t('terminal.createFirst')}
          </Button>
        </Empty>
      ) : sortedProfiles.length === 0 && search.trim() ? (
        <Empty className="border-dashed py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Search /></EmptyMedia>
            <EmptyTitle className="text-sm font-normal text-muted-foreground">
              {t('terminal.noSearchResults')}
            </EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">{t('terminal.profile')}</th>
                <th className="px-3 py-2.5 text-left font-medium">{t('terminal.shell')}</th>
                <th className="px-3 py-2.5 text-left font-medium">{t('terminal.environment')}</th>
                <th className="hidden px-3 py-2.5 text-left font-medium md:table-cell">{t('terminal.workingDir')}</th>
                <th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">{t('terminal.updated')}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t('terminal.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedProfiles.map((profile) => {
                const isLaunching = launchingProfileId === profile.id;

                return (
                  <tr key={profile.id} className="group">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {profile.color && (
                          <div className="h-6 w-0.5 shrink-0 rounded-full" style={{ backgroundColor: profile.color }} />
                        )}
                        <span className="font-medium">{profile.name}</span>
                        {profile.isDefault && (
                          <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                            <Star className="mr-0.5 h-2.5 w-2.5" />
                            {t('terminal.default')}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        {getShellIcon(profile.shellId)}
                        <span className="text-xs">{profile.shellId}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {profile.envType ? (
                        <span className="text-xs text-muted-foreground">
                          {profile.envType}{profile.envVersion ? ` ${profile.envVersion}` : ''}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="hidden px-3 py-2.5 md:table-cell">
                      {profile.cwd ? (
                        <code className="text-xs text-muted-foreground truncate block max-w-[180px]" title={profile.cwd}>{profile.cwd}</code>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="hidden px-3 py-2.5 text-right sm:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {profile.updatedAt ? getRelativeTime(profile.updatedAt) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs"
                          onClick={() => onLaunch(profile.id)}
                          disabled={isLaunching}
                        >
                          {isLaunching ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <Play className="mr-1 h-3 w-3" />
                          )}
                          {t('terminal.launch')}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(profile)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              {t('terminal.edit')}
                            </DropdownMenuItem>
                            {onDuplicate && (
                              <DropdownMenuItem onClick={() => onDuplicate(profile.id)}>
                                <Copy className="h-4 w-4 mr-2" />
                                {t('terminal.duplicate')}
                              </DropdownMenuItem>
                            )}
                            {onSaveAsTemplate && (
                              <DropdownMenuItem onClick={() => onSaveAsTemplate(profile.id)}>
                                <Bookmark className="h-4 w-4 mr-2" />
                                {t('terminal.saveAsTemplate')}
                              </DropdownMenuItem>
                            )}
                            {!profile.isDefault && (
                              <DropdownMenuItem onClick={() => onSetDefault(profile.id)}>
                                <Star className="h-4 w-4 mr-2" />
                                {t('terminal.setDefault')}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteId(profile.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('terminal.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
