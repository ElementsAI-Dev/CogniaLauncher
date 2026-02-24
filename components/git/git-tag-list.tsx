'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tag } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import type { GitTagInfo } from '@/types/tauri';

interface GitTagListProps {
  tags: GitTagInfo[];
}

export function GitTagList({ tags }: GitTagListProps) {
  const { t } = useLocale();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Tag className="h-4 w-4" />
          {t('git.repo.tag')}
          <Badge variant="secondary" className="ml-auto">{tags.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tags.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('git.repo.noTags')}</p>
        ) : (
          <div className="space-y-1.5">
            {tags.map((tag) => (
              <div key={tag.name} className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="font-mono text-[10px] h-5 px-1.5">
                  {tag.name}
                </Badge>
                <span className="font-mono text-muted-foreground">{tag.shortHash}</span>
                {tag.date && (
                  <span className="text-muted-foreground ml-auto">
                    {tag.date.split(' ')[0]}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
