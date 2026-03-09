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
import { Play, Pencil, Trash2, Star, Plus, Loader2, Copy, Download, Upload, MoreVertical, Terminal, LayoutTemplate, Bookmark, Search } from 'lucide-react';
import type { LaunchResult, TerminalProfile } from '@/types/tauri';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';

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
    setImportSummary({
      total: entries.length,
      valid,
      conflicts,
      invalid,
    });
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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h3 className="text-lg font-medium shrink-0">{t('terminal.profiles')}</h3>
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
          {onExportAll && profiles.length > 0 && (
            <Button size="sm" variant="outline" onClick={onExportAll}>
              <Download className="mr-1 h-3.5 w-3.5" />
              {t('terminal.exportProfiles')}
            </Button>
          )}
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
                  if (file) {
                    await handlePrepareImport(file);
                  }
                };
                input.click();
              }}
            >
              <Upload className="mr-1 h-3.5 w-3.5" />
              {t('terminal.importProfiles')}
            </Button>
          )}
          {onFromTemplate && (
            <Button size="sm" variant="outline" onClick={onFromTemplate}>
              <LayoutTemplate className="mr-1 h-3.5 w-3.5" />
              {t('terminal.fromTemplate')}
            </Button>
          )}
          <Button size="sm" onClick={onCreateNew}>
            <Plus className="mr-2 h-4 w-4" />
            {t('terminal.createProfile')}
          </Button>
        </div>
      </div>

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
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">stdout</p>
              <pre className="max-h-40 overflow-auto rounded-md border bg-muted/30 p-2 text-xs whitespace-pre-wrap">
                {lastLaunchResult.result.stdout || t('terminal.noOutput')}
              </pre>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">stderr</p>
              <pre className="max-h-40 overflow-auto rounded-md border bg-muted/30 p-2 text-xs whitespace-pre-wrap">
                {lastLaunchResult.result.stderr || t('terminal.noOutput')}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

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
                  <Button
                    type="button"
                    size="sm"
                    variant={importStrategy === 'merge' ? 'default' : 'outline'}
                    onClick={() => setImportStrategy('merge')}
                  >
                    {t('terminal.importMerge')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={importStrategy === 'replace' ? 'default' : 'outline'}
                    onClick={() => setImportStrategy('replace')}
                  >
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
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {sortedProfiles.map((profile) => {
            const isLaunching = launchingProfileId === profile.id;

            return (
              <Card key={profile.id} className="relative overflow-hidden">
                {profile.color && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ backgroundColor: profile.color }} />
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{profile.name}</CardTitle>
                    {profile.isDefault && (
                      <Badge variant="secondary" className="gap-1">
                        <Star className="h-3 w-3" />
                        {t('terminal.default')}
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    {profile.shellId}
                    {profile.envType && ` + ${profile.envType}${profile.envVersion ? ` ${profile.envVersion}` : ''}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => onLaunch(profile.id)}
                      disabled={isLaunching}
                    >
                      {isLaunching ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="mr-1 h-3 w-3" />
                      )}
                      {isLaunching ? t('terminal.launching') : t('terminal.launch')}
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={`${profile.name} actions`}
                        >
                          <MoreVertical className="h-4 w-4" />
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
