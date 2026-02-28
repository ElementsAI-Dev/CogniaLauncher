'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { FolderOpen, Download, Loader2, ChevronDown, CheckCircle2, XCircle, FolderGit2, ClipboardPaste, AlertCircle, History, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/components/providers/locale-provider';
import { isTauri, listenGitCloneProgress } from '@/lib/tauri';
import { readClipboard } from '@/lib/clipboard';
import type { GitCloneOptions, GitCloneProgress } from '@/types/tauri';
import type { GitCloneDialogProps } from '@/types/git';

export function GitCloneDialog({ onClone, onExtractRepoName, onValidateUrl, onOpenRepo, onCancelClone, cloneHistory, onClearCloneHistory }: GitCloneDialogProps) {
  const { t } = useLocale();
  const [url, setUrl] = useState('');
  const [destPath, setDestPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [urlValid, setUrlValid] = useState<boolean | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [options, setOptions] = useState<GitCloneOptions>({});
  const [progress, setProgress] = useState<GitCloneProgress | null>(null);
  const [cloneSuccess, setCloneSuccess] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [browsedDir, setBrowsedDir] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateOption = useCallback(<K extends keyof GitCloneOptions>(key: K, value: GitCloneOptions[K]) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = url.trim();
    if (!trimmed) {
      setUrlValid(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      if (onValidateUrl) {
        const valid = await onValidateUrl(trimmed);
        setUrlValid(valid);
      }
      if (onExtractRepoName) {
        const name = await onExtractRepoName(trimmed);
        if (name) {
          if (browsedDir && destPath.trim()) {
            const sep = destPath.includes('\\') ? '\\' : '/';
            const base = destPath.replace(/[\\/]+$/, '');
            const currentEnd = base.split(/[\\/]/).pop();
            if (currentEnd !== name) {
              setDestPath(`${base}${sep}${name}`);
            }
          } else if (!destPath.trim()) {
            setDestPath(name);
          }
        }
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [url, onValidateUrl, onExtractRepoName, destPath, browsedDir]);

  const handleBrowse = async () => {
    if (!isTauri()) return;
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === 'string') {
        setDestPath(selected);
        setBrowsedDir(true);
      }
    } catch {
      // Dialog cancelled
    }
  };

  const handlePasteUrl = async () => {
    try {
      const text = await readClipboard();
      if (text?.trim()) {
        setUrl(text.trim());
        setCloneSuccess(false);
        setCloneError(null);
      }
    } catch {
      // Clipboard not available
    }
  };

  const handleClone = async () => {
    if (!url.trim() || !destPath.trim()) return;
    setLoading(true);
    setProgress(null);
    setCloneSuccess(false);
    setCloneError(null);
    let unlisten: (() => void) | undefined;
    try {
      unlisten = await listenGitCloneProgress((p) => setProgress(p));
    } catch {
      // Event listener not available outside Tauri
    }
    try {
      const hasOptions = Object.values(options).some(v => v !== undefined && v !== null && v !== false && v !== '');
      await onClone(url.trim(), destPath.trim(), hasOptions ? options : undefined);
      setCloneSuccess(true);
    } catch (e) {
      setCloneError(String(e));
    } finally {
      unlisten?.();
      setLoading(false);
    }
  };

  const handleReset = () => {
    setUrl('');
    setDestPath('');
    setUrlValid(null);
    setOptions({});
    setProgress(null);
    setCloneSuccess(false);
    setCloneError(null);
    setBrowsedDir(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Download className="h-4 w-4" />
          {t('git.cloneAction.title')}
        </CardTitle>
        <CardDescription className="text-xs">
          {t('git.cloneAction.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* URL Input */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">{t('git.cloneAction.url')}</Label>
            <div className="relative">
              <Input
                placeholder={t('git.cloneAction.urlPlaceholder')}
                value={url}
                onChange={(e) => { setUrl(e.target.value); setCloneSuccess(false); setCloneError(null); }}
                className={cn(
                  "h-8 text-xs font-mono pr-14",
                  urlValid === true && "border-green-500/50",
                  urlValid === false && "border-red-500/50",
                )}
                disabled={loading}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePasteUrl}
                  disabled={loading}
                  className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  title={t('git.cloneAction.pasteUrl')}
                >
                  <ClipboardPaste className="h-3.5 w-3.5" />
                </button>
                {urlValid !== null && (
                  urlValid ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                  )
                )}
              </div>
            </div>
          </div>

          {/* Destination Input */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">{t('git.cloneAction.destination')}</Label>
            <div className="flex items-center gap-2">
              <Input
                value={destPath}
                onChange={(e) => { setDestPath(e.target.value); setBrowsedDir(false); }}
                className="h-8 text-xs font-mono flex-1"
                disabled={loading}
              />
              <Button variant="outline" size="sm" onClick={handleBrowse} disabled={loading}>
                <FolderOpen className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Advanced Options */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between h-7 px-2 text-xs">
                {t('git.cloneAction.advancedOptions')}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAdvanced && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {/* Branch & Depth */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">{t('git.cloneAction.branch')}</Label>
                  <Input
                    placeholder={t('git.cloneAction.branchPlaceholder')}
                    value={options.branch ?? ''}
                    onChange={(e) => updateOption('branch', e.target.value || undefined)}
                    className="h-7 text-xs"
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">{t('git.cloneAction.depth')}</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder={t('git.cloneAction.depthPlaceholder')}
                    value={options.depth ?? ''}
                    onChange={(e) => updateOption('depth', e.target.value ? Number(e.target.value) : undefined)}
                    className="h-7 text-xs"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Filter with presets */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">{t('git.cloneAction.filter')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={t('git.cloneAction.filterPlaceholder')}
                    value={options.filter ?? ''}
                    onChange={(e) => updateOption('filter', e.target.value || undefined)}
                    className="h-7 text-xs font-mono flex-1"
                    disabled={loading}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] px-2"
                    disabled={loading}
                    onClick={() => updateOption('filter', 'blob:none')}
                  >
                    {t('git.cloneAction.blobless')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] px-2"
                    disabled={loading}
                    onClick={() => updateOption('filter', 'tree:0')}
                  >
                    {t('git.cloneAction.treeless')}
                  </Button>
                </div>
              </div>

              {/* Remote Name & Jobs */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">{t('git.cloneAction.remoteName')}</Label>
                  <Input
                    placeholder={t('git.cloneAction.remoteNamePlaceholder')}
                    value={options.remoteName ?? ''}
                    onChange={(e) => updateOption('remoteName', e.target.value || undefined)}
                    className="h-7 text-xs"
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">{t('git.cloneAction.jobs')}</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder={t('git.cloneAction.jobsPlaceholder')}
                    value={options.jobs ?? ''}
                    onChange={(e) => updateOption('jobs', e.target.value ? Number(e.target.value) : undefined)}
                    className="h-7 text-xs"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Checkbox grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {([
                  ['singleBranch', 'git.cloneAction.singleBranch'],
                  ['recurseSubmodules', 'git.cloneAction.recurseSubmodules'],
                  ['shallowSubmodules', 'git.cloneAction.shallowSubmodules'],
                  ['noCheckout', 'git.cloneAction.noCheckout'],
                  ['bare', 'git.cloneAction.bare'],
                  ['mirror', 'git.cloneAction.mirror'],
                  ['sparse', 'git.cloneAction.sparse'],
                  ['noTags', 'git.cloneAction.noTags'],
                ] as const).map(([key, labelKey]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={`clone-${key}`}
                      checked={!!options[key]}
                      onCheckedChange={(checked) => updateOption(key, checked === true ? true : undefined)}
                      disabled={loading}
                    />
                    <Label htmlFor={`clone-${key}`} className="text-xs cursor-pointer">
                      {t(labelKey)}
                    </Label>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Progress */}
          {progress && loading && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t(`git.cloneAction.phase.${progress.phase}`)}</span>
                <span className="flex items-center gap-2">
                  {progress.speed && <span className="text-[10px]">{progress.speed}</span>}
                  {progress.percent != null && <span>{progress.percent}%</span>}
                </span>
              </div>
              <Progress value={progress.percent ?? 0} className="h-1.5" />
              {progress.current != null && progress.total != null && (
                <div className="text-[10px] text-muted-foreground text-right">
                  {progress.current}/{progress.total}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {cloneError && (
            <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-500/10 rounded-md p-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="break-all">{cloneError}</span>
            </div>
          )}

          {/* Clone Button */}
          {!cloneSuccess ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleClone}
                disabled={loading || !url.trim() || !destPath.trim()}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    {t('git.cloneAction.cloning')}
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5 mr-1" />
                    {t('git.actions.clone')}
                  </>
                )}
              </Button>
              {loading && onCancelClone && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    try { await onCancelClone(); } catch { /* ignore */ }
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t('git.cloneAction.success')}
              </div>
              <div className="flex gap-2">
                {onOpenRepo && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { onOpenRepo(destPath); handleReset(); }}
                    className="flex-1"
                  >
                    <FolderGit2 className="h-3.5 w-3.5 mr-1" />
                    {t('git.cloneAction.openCloned')}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={handleReset} className="flex-1">
                  {t('git.actions.clone')}
                </Button>
              </div>
            </div>
          )}

          {/* Clone History */}
          {cloneHistory && cloneHistory.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between h-7 px-2 text-xs">
                  <span className="flex items-center gap-1.5">
                    <History className="h-3 w-3" />
                    {t('git.cloneAction.recentClones')} ({cloneHistory.length})
                  </span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-1 space-y-1">
                {cloneHistory.slice(0, 5).map((entry, i) => (
                  <div
                    key={`${entry.timestamp}-${i}`}
                    className="flex items-center gap-2 text-[11px] px-1.5 py-1 rounded hover:bg-muted/50 cursor-pointer group"
                    onClick={() => {
                      setUrl(entry.url);
                      setDestPath(entry.destPath);
                      setCloneSuccess(false);
                      setCloneError(null);
                    }}
                    title={`${entry.url} → ${entry.destPath}`}
                  >
                    {entry.status === 'success' ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                    )}
                    <span className="font-mono truncate flex-1">{entry.url}</span>
                    <span className="text-muted-foreground shrink-0">
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))}
                {onClearCloneHistory && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-6 text-[10px] text-muted-foreground"
                    onClick={onClearCloneHistory}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    {t('git.cloneAction.clearHistory')}
                  </Button>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
