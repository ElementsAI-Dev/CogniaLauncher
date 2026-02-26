'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { FolderOpen, Download, Loader2, ChevronDown, CheckCircle2, XCircle, FolderGit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/components/providers/locale-provider';
import { isTauri, listenGitCloneProgress } from '@/lib/tauri';
import type { GitCloneOptions, GitCloneProgress } from '@/types/tauri';

interface GitCloneDialogProps {
  onClone: (url: string, destPath: string, options?: GitCloneOptions) => Promise<string>;
  onExtractRepoName?: (url: string) => Promise<string | null>;
  onValidateUrl?: (url: string) => Promise<boolean>;
  onOpenRepo?: (path: string) => void;
}

export function GitCloneDialog({ onClone, onExtractRepoName, onValidateUrl, onOpenRepo }: GitCloneDialogProps) {
  const { t } = useLocale();
  const [url, setUrl] = useState('');
  const [destPath, setDestPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [urlValid, setUrlValid] = useState<boolean | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [options, setOptions] = useState<GitCloneOptions>({});
  const [progress, setProgress] = useState<GitCloneProgress | null>(null);
  const [cloneSuccess, setCloneSuccess] = useState(false);
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
      if (onExtractRepoName && !destPath.trim()) {
        const name = await onExtractRepoName(trimmed);
        if (name) {
          setDestPath(prev => prev.trim() ? prev : name);
        }
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [url, onValidateUrl, onExtractRepoName, destPath]);

  const handleBrowse = async () => {
    if (!isTauri()) return;
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === 'string') {
        setDestPath(selected);
      }
    } catch {
      // Dialog cancelled
    }
  };

  const handleClone = async () => {
    if (!url.trim() || !destPath.trim()) return;
    setLoading(true);
    setProgress(null);
    setCloneSuccess(false);
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
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Download className="h-4 w-4" />
          {t('git.cloneAction.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* URL Input */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t('git.cloneAction.url')}</label>
            <div className="relative">
              <Input
                placeholder={t('git.cloneAction.urlPlaceholder')}
                value={url}
                onChange={(e) => { setUrl(e.target.value); setCloneSuccess(false); }}
                className={cn(
                  "h-8 text-xs font-mono pr-7",
                  urlValid === true && "border-green-500/50",
                  urlValid === false && "border-red-500/50",
                )}
                disabled={loading}
              />
              {urlValid !== null && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {urlValid ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Destination Input */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t('git.cloneAction.destination')}</label>
            <div className="flex items-center gap-2">
              <Input
                value={destPath}
                onChange={(e) => setDestPath(e.target.value)}
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
                  <label className="text-xs text-muted-foreground mb-1 block">{t('git.cloneAction.branch')}</label>
                  <Input
                    placeholder={t('git.cloneAction.branchPlaceholder')}
                    value={options.branch ?? ''}
                    onChange={(e) => updateOption('branch', e.target.value || undefined)}
                    className="h-7 text-xs"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t('git.cloneAction.depth')}</label>
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

              {/* Filter & Jobs */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t('git.cloneAction.filter')}</label>
                  <Input
                    placeholder={t('git.cloneAction.filterPlaceholder')}
                    value={options.filter ?? ''}
                    onChange={(e) => updateOption('filter', e.target.value || undefined)}
                    className="h-7 text-xs font-mono"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t('git.cloneAction.remoteName')}</label>
                  <Input
                    placeholder={t('git.cloneAction.remoteNamePlaceholder')}
                    value={options.remoteName ?? ''}
                    onChange={(e) => updateOption('remoteName', e.target.value || undefined)}
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
                {progress.percent != null && <span>{progress.percent}%</span>}
              </div>
              <Progress value={progress.percent ?? 0} className="h-1.5" />
              {progress.current != null && progress.total != null && (
                <div className="text-[10px] text-muted-foreground text-right">
                  {progress.current}/{progress.total}
                </div>
              )}
            </div>
          )}

          {/* Clone Button */}
          {!cloneSuccess ? (
            <Button
              size="sm"
              onClick={handleClone}
              disabled={loading || !url.trim() || !destPath.trim()}
              className="w-full"
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
        </div>
      </CardContent>
    </Card>
  );
}
