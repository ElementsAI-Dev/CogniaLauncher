'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileText, FolderOpen } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { formatRelativeDate } from '@/lib/utils/git-date';
import { isTauri } from '@/lib/tauri';
import { GitDiffViewer } from './git-diff-viewer';
import type { GitCommitEntry } from '@/types/tauri';
import type { GitFileHistoryProps } from '@/types/git';

const FILE_HISTORY_PAGE_SIZE = 50;

export function GitFileHistory({
  repoPath,
  onGetHistory,
  onGetCommitDiff,
  onSelectCommit,
  queryState,
}: GitFileHistoryProps) {
  const { t } = useLocale();
  const [filePath, setFilePath] = useState('');
  const [history, setHistory] = useState<GitCommitEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState<string>('');
  const [diffLoading, setDiffLoading] = useState(false);

  const handleBrowse = async () => {
    if (!isTauri()) return;
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: false,
        multiple: false,
        defaultPath: repoPath || undefined,
      });
      if (selected && typeof selected === 'string') {
        setFilePath(selected);
        await loadHistory(selected);
      }
    } catch {
      // Dialog cancelled
    }
  };

  const loadHistory = async (file: string, append = false) => {
    if (!file.trim()) return;
    setLoading(true);
    if (!append) {
      setSelectedHash(null);
      setFileDiff('');
    }
    try {
      const result = await onGetHistory({
        file: file.trim(),
        limit: FILE_HISTORY_PAGE_SIZE,
        skip: append ? history.length : 0,
        append,
      });
      setHistory((prev) => (append ? [...prev, ...result] : result));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCommit = useCallback(async (hash: string) => {
    onSelectCommit?.(hash);
    if (!onGetCommitDiff || !filePath.trim()) return;
    if (selectedHash === hash) {
      setSelectedHash(null);
      setFileDiff('');
      return;
    }
    setSelectedHash(hash);
    setDiffLoading(true);
    try {
      const d = await onGetCommitDiff(hash, filePath.trim());
      setFileDiff(d);
    } finally {
      setDiffLoading(false);
    }
  }, [onSelectCommit, onGetCommitDiff, filePath, selectedHash]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4" />
          {t('git.history.fileHistory')}
        </CardTitle>
        <div className="flex items-center gap-2 mt-2">
          <Input
            placeholder={t('git.history.selectFile')}
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadHistory(filePath, false)}
            className="flex-1 font-mono text-xs h-8"
            disabled={loading}
          />
          <Button variant="outline" size="sm" onClick={handleBrowse} disabled={loading}>
            <FolderOpen className="h-3.5 w-3.5 mr-1" />
            {t('git.history.browseFile')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {queryState?.error && (
          <p className="text-xs text-destructive text-center pb-2">
            {queryState.error.message}
          </p>
        )}
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {filePath ? t('git.history.noFileHistory') : t('git.history.selectFile')}
          </p>
        ) : (
          <div className="space-y-1">
            {history.map((commit) => (
              <div
                key={commit.hash}
                className={`flex items-start gap-3 py-1.5 px-1 rounded text-xs ${
                  selectedHash === commit.hash ? 'bg-muted' : 'hover:bg-muted/50'
                } ${onGetCommitDiff ? 'cursor-pointer' : ''}`}
                onClick={() => handleSelectCommit(commit.hash)}
              >
                <code className="font-mono text-muted-foreground shrink-0 mt-0.5">
                  {commit.hash.slice(0, 7)}
                </code>
                <span className="flex-1 truncate">{commit.message}</span>
                <span className="text-muted-foreground shrink-0">
                  {commit.authorName}
                </span>
                <span className="text-muted-foreground shrink-0">
                  {formatRelativeDate(commit.date)}
                </span>
              </div>
            ))}
            {filePath && (queryState?.hasMore ?? history.length >= FILE_HISTORY_PAGE_SIZE) && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-xs"
                onClick={() => loadHistory(filePath, true)}
                disabled={loading}
              >
                {t('git.history.loadMore')}
              </Button>
            )}
          </div>
        )}
        {selectedHash && onGetCommitDiff && (
          <div className="mt-3 border-t pt-3">
            <GitDiffViewer
              diff={fileDiff}
              loading={diffLoading}
              title={`${selectedHash.slice(0, 7)} — ${filePath.split(/[\\/]/).pop() || filePath}`}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
