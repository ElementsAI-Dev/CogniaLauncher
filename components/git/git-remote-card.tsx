'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Globe, Plus, Trash2 } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import type { GitRemoteCardProps } from '@/types/git';

export function GitRemoteCard({ remotes, onAdd, onRemove }: GitRemoteCardProps) {
  const { t } = useLocale();
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!onAdd || !newName.trim() || !newUrl.trim()) return;
    setAdding(true);
    try {
      const msg = await onAdd(newName.trim(), newUrl.trim());
      toast.success(t('git.remoteAction.addSuccess'), { description: msg });
      setNewName('');
      setNewUrl('');
    } catch (e) {
      toast.error(String(e));
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (name: string) => {
    if (!onRemove) return;
    try {
      const msg = await onRemove(name);
      toast.success(t('git.remoteAction.removeSuccess'), { description: msg });
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Globe className="h-4 w-4" />
          {t('git.repo.remote')}
          <Badge variant="secondary" className="ml-auto">{remotes.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {remotes.length === 0 ? (
          <p className="text-xs text-muted-foreground">No remotes configured</p>
        ) : (
          <div className="space-y-3">
            {remotes.map((r) => (
              <div key={r.name} className="space-y-1 group">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{r.name}</span>
                  {onRemove && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                      onClick={() => handleRemove(r.name)}
                      title={t('git.remoteAction.remove')}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
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

        {onAdd && (
          <div className="space-y-2 pt-1 border-t">
            <div className="flex items-center gap-2">
              <Input
                placeholder={t('git.remoteAction.namePlaceholder')}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-28 h-7 text-xs"
                disabled={adding}
              />
              <Input
                placeholder={t('git.remoteAction.urlPlaceholder')}
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className="flex-1 h-7 text-xs font-mono"
                disabled={adding}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleAdd}
                disabled={adding || !newName.trim() || !newUrl.trim()}
              >
                <Plus className="h-3 w-3 mr-1" />
                {t('git.remoteAction.add')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
