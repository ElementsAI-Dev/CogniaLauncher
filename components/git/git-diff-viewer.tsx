'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileCode } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';

interface GitDiffViewerProps {
  diff: string;
  loading?: boolean;
  title?: string;
}

function parseDiffLine(line: string) {
  if (line.startsWith('+') && !line.startsWith('+++')) {
    return { type: 'add' as const, content: line };
  }
  if (line.startsWith('-') && !line.startsWith('---')) {
    return { type: 'del' as const, content: line };
  }
  if (line.startsWith('@@')) {
    return { type: 'hunk' as const, content: line };
  }
  if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) {
    return { type: 'meta' as const, content: line };
  }
  return { type: 'ctx' as const, content: line };
}

export function GitDiffViewer({ diff, loading, title }: GitDiffViewerProps) {
  const { t } = useLocale();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileCode className="h-4 w-4" />
          {title || t('git.diffView.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !diff ? (
          <p className="text-xs text-muted-foreground text-center py-8 px-4">
            {t('git.diffView.noChanges')}
          </p>
        ) : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <pre className="text-[11px] leading-5 font-mono">
              {diff.split('\n').map((line, i) => {
                const parsed = parseDiffLine(line);
                let className = 'px-3 ';
                switch (parsed.type) {
                  case 'add':
                    className += 'bg-green-500/10 text-green-700 dark:text-green-400';
                    break;
                  case 'del':
                    className += 'bg-red-500/10 text-red-700 dark:text-red-400';
                    break;
                  case 'hunk':
                    className += 'bg-blue-500/10 text-blue-700 dark:text-blue-400 font-semibold';
                    break;
                  case 'meta':
                    className += 'bg-muted/50 text-muted-foreground font-semibold';
                    break;
                  default:
                    className += 'text-foreground/80';
                }
                return (
                  <div key={i} className={className}>
                    <span className="text-muted-foreground/50 select-none w-8 inline-block text-right mr-2">
                      {i + 1}
                    </span>
                    {parsed.content}
                  </div>
                );
              })}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
