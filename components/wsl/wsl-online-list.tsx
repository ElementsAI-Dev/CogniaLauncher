'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Globe, Download, Search } from 'lucide-react';
import type { WslOnlineListProps } from '@/types/wsl';

export function WslOnlineList({
  distros,
  installedNames,
  loading,
  onInstall,
  t,
}: WslOnlineListProps) {
  const [search, setSearch] = useState('');

  const filtered = distros.filter(([id, name]) => {
    const q = search.toLowerCase();
    return id.toLowerCase().includes(q) || name.toLowerCase().includes(q);
  });

  const installedSet = new Set(installedNames.map((n) => n.toLowerCase()));

  if (loading && distros.length === 0) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          {t('wsl.available')}
        </CardTitle>
        <Badge variant="secondary">{distros.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <ScrollArea className="h-[320px]">
          <div className="space-y-1.5 pr-3">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {t('common.noResults')}
              </p>
            ) : (
              filtered.map(([id, name]) => {
                const isInstalled = installedSet.has(id.toLowerCase());
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between rounded-md border px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{id}</p>
                    </div>
                    <Button
                      variant={isInstalled ? 'secondary' : 'outline'}
                      size="sm"
                      disabled={isInstalled}
                      onClick={() => onInstall(id)}
                      className="gap-1.5 shrink-0 ml-2"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {isInstalled ? t('wsl.installed') : t('wsl.install')}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
