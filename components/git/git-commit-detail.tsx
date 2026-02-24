'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, X, GitCommit, FileText, Plus, Minus } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { formatRelativeDate } from '@/lib/utils/git-date';
import type { GitCommitDetail as GitCommitDetailType } from '@/types/tauri';

interface GitCommitDetailProps {
  hash: string | null;
  detail: GitCommitDetailType | null;
  loading: boolean;
  onClose: () => void;
}

export function GitCommitDetail({ hash, detail, loading, onClose }: GitCommitDetailProps) {
  const { t } = useLocale();

  if (!hash) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <GitCommit className="h-4 w-4" />
            {t('git.detail.title')}
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : detail ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <code className="font-mono text-muted-foreground">{detail.hash.slice(0, 10)}</code>
                <span className="text-muted-foreground">{formatRelativeDate(detail.date)}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{detail.message}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{detail.authorName}</span>
                <span>&lt;{detail.authorEmail}&gt;</span>
              </div>
              {detail.parents.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{t('git.detail.parents')}:</span>
                  {detail.parents.map((p) => (
                    <code key={p} className="font-mono bg-muted px-1 rounded">
                      {p.slice(0, 7)}
                    </code>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t pt-3">
              <div className="flex items-center gap-3 text-xs mb-2">
                <span className="font-medium">
                  {detail.filesChanged} {t('git.detail.filesChanged')}
                </span>
                <span className="text-green-600 flex items-center gap-0.5">
                  <Plus className="h-3 w-3" />
                  {detail.insertions}
                </span>
                <span className="text-red-600 flex items-center gap-0.5">
                  <Minus className="h-3 w-3" />
                  {detail.deletions}
                </span>
              </div>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {detail.files.map((file) => (
                  <div
                    key={file.path}
                    className="flex items-center gap-2 text-xs py-1 px-1 rounded hover:bg-muted/50"
                  >
                    <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="font-mono truncate flex-1">{file.path}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {file.insertions > 0 && (
                        <span className="text-green-600">+{file.insertions}</span>
                      )}
                      {file.deletions > 0 && (
                        <span className="text-red-600">-{file.deletions}</span>
                      )}
                    </div>
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
                      {(file.insertions + file.deletions) > 0 && (
                        <>
                          <div
                            className="h-full bg-green-500 float-left"
                            style={{
                              width: `${(file.insertions / (file.insertions + file.deletions)) * 100}%`,
                            }}
                          />
                          <div
                            className="h-full bg-red-500 float-left"
                            style={{
                              width: `${(file.deletions / (file.insertions + file.deletions)) * 100}%`,
                            }}
                          />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">
            {t('git.detail.notFound')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
