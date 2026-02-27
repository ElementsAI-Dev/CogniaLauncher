'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { History, Search, ChevronDown } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { formatRelativeDate } from '@/lib/utils/git-date';
import type { GitCommitLogProps } from '@/types/git';

export function GitCommitLog({ commits, onLoadMore, onSelectCommit, selectedHash }: GitCommitLogProps) {
  const { t } = useLocale();
  const [search, setSearch] = useState('');
  const [authorFilter, setAuthorFilter] = useState<string>('__all__');

  const authors = useMemo(() => {
    const set = new Set(commits.map((c) => c.authorName));
    return Array.from(set).sort();
  }, [commits]);

  const filtered = useMemo(() => {
    let result = commits;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.message.toLowerCase().includes(q) ||
          c.hash.toLowerCase().startsWith(q) ||
          c.authorName.toLowerCase().includes(q),
      );
    }
    if (authorFilter !== '__all__') {
      result = result.filter((c) => c.authorName === authorFilter);
    }
    return result;
  }, [commits, search, authorFilter]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4" />
            {t('git.history.title')}
            <Badge variant="secondary">{filtered.length}</Badge>
          </CardTitle>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t('git.history.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Select value={authorFilter} onValueChange={setAuthorFilter}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder={t('git.history.filterByAuthor')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('git.history.allAuthors')}</SelectItem>
              {authors.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {t('git.history.noCommits')}
          </p>
        ) : (
          <div className="space-y-1">
            {filtered.map((commit) => (
              <div
                key={commit.hash}
                className={`flex items-start gap-3 py-1.5 px-1 rounded hover:bg-muted/50 text-xs ${
                  selectedHash === commit.hash ? 'bg-muted' : ''
                } ${onSelectCommit ? 'cursor-pointer' : ''}`}
                onClick={() => onSelectCommit?.(commit.hash)}
              >
                <code className="font-mono text-muted-foreground shrink-0 mt-0.5">
                  {commit.hash.slice(0, 7)}
                </code>
                <span className="flex-1 truncate">{commit.message}</span>
                <span className="text-muted-foreground shrink-0 hidden sm:block">
                  {commit.authorName}
                </span>
                <span className="text-muted-foreground shrink-0">
                  {formatRelativeDate(commit.date)}
                </span>
              </div>
            ))}
            {onLoadMore && commits.length >= 50 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs mt-2"
                onClick={() => onLoadMore({ limit: commits.length + 50 })}
              >
                <ChevronDown className="h-3 w-3 mr-1" />
                {t('git.history.loadMore')}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
