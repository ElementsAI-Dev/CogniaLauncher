'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import type { GitRemoteInfo } from '@/types/tauri';

interface GitRemoteCardProps {
  remotes: GitRemoteInfo[];
}

export function GitRemoteCard({ remotes }: GitRemoteCardProps) {
  const { t } = useLocale();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Globe className="h-4 w-4" />
          {t('git.repo.remote')}
          <Badge variant="secondary" className="ml-auto">{remotes.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {remotes.length === 0 ? (
          <p className="text-xs text-muted-foreground">No remotes configured</p>
        ) : (
          <div className="space-y-3">
            {remotes.map((r) => (
              <div key={r.name} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{r.name}</span>
                </div>
                <div className="text-xs text-muted-foreground pl-2 space-y-0.5">
                  <div className="flex gap-2">
                    <span className="shrink-0">{t('git.repo.fetchUrl')}:</span>
                    <code className="font-mono truncate">{r.fetchUrl}</code>
                  </div>
                  {r.pushUrl !== r.fetchUrl && (
                    <div className="flex gap-2">
                      <span className="shrink-0">{t('git.repo.pushUrl')}:</span>
                      <code className="font-mono truncate">{r.pushUrl}</code>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
