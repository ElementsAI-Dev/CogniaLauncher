'use client';

import { useState } from 'react';
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
import { Search, Loader2 } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { formatRelativeDate } from '@/lib/utils/git-date';
import type { GitCommitEntry } from '@/types/tauri';
import type { GitSearchCommitsProps } from '@/types/git';

export function GitSearchCommits({ onSearch, onSelectCommit }: GitSearchCommitsProps) {
  const { t } = useLocale();
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<string>('message');
  const [results, setResults] = useState<GitCommitEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await onSearch(query.trim(), searchType, 50);
      setResults(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Search className="h-4 w-4" />
          {t('git.search.title')}
        </CardTitle>
        <div className="flex items-center gap-2 mt-2">
          <Select value={searchType} onValueChange={setSearchType}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="message">{t('git.search.byMessage')}</SelectItem>
              <SelectItem value="author">{t('git.search.byAuthor')}</SelectItem>
              <SelectItem value="diff">{t('git.search.byDiff')}</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Input
              placeholder={t('git.search.placeholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="h-8 text-xs"
              disabled={loading}
            />
          </div>
          <Button size="sm" onClick={handleSearch} disabled={loading || !query.trim()}>
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!searched ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {t('git.search.hint')}
          </p>
        ) : results.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {t('git.search.noResults')}
          </p>
        ) : (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground mb-2">
              <Badge variant="secondary">{results.length}</Badge> {t('git.search.results')}
            </div>
            {results.map((commit) => (
              <div
                key={commit.hash}
                className="flex items-start gap-3 py-1.5 px-1 rounded hover:bg-muted/50 text-xs cursor-pointer"
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
