'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3, FolderOpen, Loader2 } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { isTauri } from '@/lib/tauri';
import type { GitFileStatEntry } from '@/types/tauri';
import type { GitVisualFileHistoryProps } from '@/types/git';

export function GitVisualFileHistory({ repoPath, onGetFileStats }: GitVisualFileHistoryProps) {
  const { t } = useLocale();
  const [filePath, setFilePath] = useState('');
  const [stats, setStats] = useState<GitFileStatEntry[]>([]);
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
        await loadStats(selected);
      }
    } catch {
      // Dialog cancelled
    }
  };

  const loadStats = async (file: string) => {
    if (!file.trim()) return;
    setLoading(true);
    try {
      const result = await onGetFileStats(file.trim(), 50);
      setStats(result);
    } finally {
      setLoading(false);
    }
  };

  const chartData = stats.map((s) => ({
    hash: s.hash.slice(0, 7),
    date: s.date.split('T')[0],
    additions: s.additions,
    deletions: -s.deletions,
    author: s.authorName,
  })).reverse();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          {t('git.visualHistory.title')}
        </CardTitle>
        <div className="flex items-center gap-2 mt-2">
          <Input
            placeholder={t('git.history.selectFile')}
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadStats(filePath)}
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
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : chartData.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            {filePath ? t('git.history.noFileHistory') : t('git.history.selectFile')}
          </p>
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} stackOffset="sign">
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ fontSize: 11 }}
                  formatter={((value: number, name: string) => [
                    Math.abs(value),
                    name === 'additions' ? 'Added' : 'Deleted',
                  ]) as never}
                  labelFormatter={((label: string, payload: Array<{ payload?: { hash?: string; author?: string } }>) => {
                    if (payload && payload.length > 0) {
                      const item = payload[0]?.payload;
                      return `${label} • ${item?.hash} • ${item?.author}`;
                    }
                    return label;
                  }) as never}
                />
                <Bar dataKey="additions" stackId="a" fill="#22c55e" radius={[2, 2, 0, 0]} />
                <Bar dataKey="deletions" stackId="a" fill="#ef4444" radius={[0, 0, 2, 2]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
