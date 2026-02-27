'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileText, FolderOpen } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { formatRelativeDate } from '@/lib/utils/git-date';
import { isTauri } from '@/lib/tauri';
import type { GitCommitEntry } from '@/types/tauri';
import type { GitFileHistoryProps } from '@/types/git';

export function GitFileHistory({ repoPath, onGetHistory }: GitFileHistoryProps) {
  const { t } = useLocale();
  const [filePath, setFilePath] = useState('');
  const [history, setHistory] = useState<GitCommitEntry[]>([]);
  const [loading, setLoading] = useState(false);

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

  const loadHistory = async (file: string) => {
    if (!file.trim()) return;
    setLoading(true);
    try {
      const result = await onGetHistory(file.trim(), 50);
      setHistory(result);
    } finally {
      setLoading(false);
    }
  };

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
            onKeyDown={(e) => e.key === 'Enter' && loadHistory(filePath)}
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
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {filePath ? t('git.history.noFileHistory') : t('git.history.selectFile')}
          </p>
        ) : (
          <div className="space-y-1">
            {history.map((commit) => (
              <div
                key={commit.hash}
                className="flex items-start gap-3 py-1.5 px-1 rounded hover:bg-muted/50 text-xs"
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
