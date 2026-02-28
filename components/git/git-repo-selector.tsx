'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  FolderOpen,
  FolderPlus,
  Star,
  StarOff,
  Clock,
  X,
  Trash2,
  GitBranch,
} from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { isTauri } from '@/lib/tauri';
import { useGitRepoStore } from '@/lib/stores/git';
import { toast } from 'sonner';
import type { GitRepoSelectorProps } from '@/types/git';

export function GitRepoSelector({ repoPath, onSelect, onInit, loading }: GitRepoSelectorProps) {
  const { t } = useLocale();
  const [inputPath, setInputPath] = useState(repoPath || '');
  const store = useGitRepoStore();

  const handleBrowse = async () => {
    if (!isTauri()) return;
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === 'string') {
        setInputPath(selected);
        await onSelect(selected);
      }
    } catch {
      // Dialog cancelled or not available
    }
  };

  const handleSubmit = async () => {
    if (inputPath.trim()) {
      await onSelect(inputPath.trim());
    }
  };

  const handleInitRepo = async () => {
    if (!onInit) return;
    if (!isTauri()) return;
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === 'string') {
        const msg = await onInit(selected);
        toast.success(t('git.initAction.success'), { description: msg });
        setInputPath(selected);
        await onSelect(selected);
      }
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleSelectRecent = async (path: string) => {
    setInputPath(path);
    await onSelect(path);
  };

  const isPinned = (path: string) => store.pinnedRepos.includes(path);

  const displayName = (path: string) => {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || path;
  };

  const allRepos = [
    ...store.pinnedRepos.filter((p) => !store.recentRepos.includes(p)),
    ...store.recentRepos,
  ];
  const hasRepos = allRepos.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          {t('git.repo.selectRepo')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            placeholder={t('git.repo.pathPlaceholder')}
            value={inputPath}
            onChange={(e) => setInputPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="flex-1 font-mono text-xs"
            disabled={loading}
          />
          <Button variant="outline" size="sm" onClick={handleBrowse} disabled={loading}>
            <FolderOpen className="h-4 w-4 mr-1" />
            {t('git.repo.browse')}
          </Button>
          {onInit && (
            <Button variant="outline" size="sm" onClick={handleInitRepo} disabled={loading}>
              <FolderPlus className="h-4 w-4 mr-1" />
              {t('git.actions.init')}
            </Button>
          )}
        </div>

        {store.pinnedRepos.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <Star className="h-3 w-3" />
              {t('git.repo.pinned')}
            </p>
            <div className="space-y-0.5">
              {store.pinnedRepos.map((path) => (
                <div
                  key={`pin-${path}`}
                  className={`flex items-center gap-2 text-xs py-1 px-2 rounded-md cursor-pointer hover:bg-accent transition-colors ${
                    repoPath === path ? 'bg-accent' : ''
                  }`}
                  onClick={() => handleSelectRecent(path)}
                >
                  <Star className="h-3 w-3 text-yellow-500 shrink-0" />
                  <span className="font-medium truncate">{displayName(path)}</span>
                  <span className="text-muted-foreground truncate flex-1 text-[10px]">{path}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      store.unpinRepo(path);
                    }}
                  >
                    <StarOff className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {store.recentRepos.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {t('git.repo.recent')}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-[10px]"
                onClick={() => store.clearRecent()}
              >
                <Trash2 className="h-3 w-3 mr-0.5" />
                {t('git.repo.clearRecent')}
              </Button>
            </div>
            <div className="space-y-0.5">
              {store.recentRepos.map((path) => (
                <div
                  key={`recent-${path}`}
                  className={`flex items-center gap-2 text-xs py-1 px-2 rounded-md cursor-pointer hover:bg-accent transition-colors ${
                    repoPath === path ? 'bg-accent' : ''
                  }`}
                  onClick={() => handleSelectRecent(path)}
                >
                  <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">{displayName(path)}</span>
                  <span className="text-muted-foreground truncate flex-1 text-[10px]">{path}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isPinned(path)) { store.unpinRepo(path); } else { store.pinRepo(path); }
                    }}
                  >
                    {isPinned(path) ? (
                      <Star className="h-3 w-3 text-yellow-500" />
                    ) : (
                      <Star className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      store.removeRecentRepo(path);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasRepos && !repoPath && (
          <p className="text-xs text-muted-foreground text-center py-2">
            {t('git.repo.noRecentRepos')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
