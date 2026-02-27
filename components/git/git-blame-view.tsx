'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, FolderOpen, Loader2 } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { formatRelativeTimestamp } from '@/lib/utils/git-date';
import { getAuthorColor, getHeatmapColor } from '@/lib/utils/git';
import { isTauri } from '@/lib/tauri';
import type { GitBlameEntry } from '@/types/tauri';
import type { GitBlameViewProps } from '@/types/git';

export function GitBlameView({ repoPath, onGetBlame }: GitBlameViewProps) {
  const { t } = useLocale();
  const [filePath, setFilePath] = useState('');
  const [entries, setEntries] = useState<GitBlameEntry[]>([]);
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
        await loadBlame(selected);
      }
    } catch {
      // Dialog cancelled
    }
  };

  const loadBlame = async (file: string) => {
    if (!file.trim()) return;
    setLoading(true);
    try {
      const result = await onGetBlame(file.trim());
      setEntries(result);
    } finally {
      setLoading(false);
    }
  };

  const { authorMap, minTs, maxTs } = useMemo(() => {
    const map = new Map<string, number>();
    let min = Infinity;
    let max = -Infinity;
    let idx = 0;
    for (const entry of entries) {
      if (!map.has(entry.author)) {
        map.set(entry.author, idx++);
      }
      if (entry.timestamp < min) min = entry.timestamp;
      if (entry.timestamp > max) max = entry.timestamp;
    }
    return { authorMap: map, minTs: min === Infinity ? 0 : min, maxTs: max === -Infinity ? 0 : max };
  }, [entries]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Eye className="h-4 w-4" />
          {t('git.blame.title')}
        </CardTitle>
        <div className="flex items-center gap-2 mt-2">
          <Input
            placeholder={t('git.blame.noBlame')}
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadBlame(filePath)}
            className="flex-1 font-mono text-xs h-8"
            disabled={loading}
          />
          <Button variant="outline" size="sm" onClick={handleBrowse} disabled={loading}>
            <FolderOpen className="h-3.5 w-3.5 mr-1" />
            {t('git.repo.browse')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8 px-4">
            {t('git.blame.noBlame')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              {entries.map((entry, i) => {
                const authorIdx = authorMap.get(entry.author) ?? 0;
                const prevEntry = i > 0 ? entries[i - 1] : null;
                const showAuthor = !prevEntry || prevEntry.commitHash !== entry.commitHash;

                return (
                  <div
                    key={`${entry.lineNumber}-${i}`}
                    className="flex items-stretch text-[11px] leading-5 hover:bg-muted/30 border-b border-border/30"
                  >
                    {/* Heatmap strip */}
                    <div
                      className={`w-1 shrink-0 ${getHeatmapColor(entry.timestamp, minTs, maxTs)}`}
                    />
                    {/* Author color bar */}
                    <div className={`w-0.5 shrink-0 ${getAuthorColor(authorIdx)}`} />
                    {/* Blame info gutter */}
                    <div className="w-[260px] shrink-0 px-2 flex items-center gap-1.5 text-muted-foreground overflow-hidden border-r border-border/50">
                      {showAuthor ? (
                        <>
                          <code className="font-mono shrink-0">{entry.commitHash.slice(0, 7)}</code>
                          <span className="truncate">{entry.author}</span>
                          <span className="shrink-0 ml-auto">{formatRelativeTimestamp(entry.timestamp)}</span>
                        </>
                      ) : (
                        <span className="opacity-0">.</span>
                      )}
                    </div>
                    {/* Line number */}
                    <div className="w-10 shrink-0 text-right pr-2 text-muted-foreground/60 select-none">
                      {entry.lineNumber}
                    </div>
                    {/* Content */}
                    <pre className="flex-1 px-2 font-mono whitespace-pre overflow-hidden text-ellipsis">
                      {entry.content}
                    </pre>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
