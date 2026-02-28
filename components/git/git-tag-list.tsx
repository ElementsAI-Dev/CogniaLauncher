'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag, Plus, Trash2, Upload } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import type { GitTagListProps } from '@/types/git';

export function GitTagList({ tags, onCreateTag, onDeleteTag, onPushTags }: GitTagListProps) {
  const { t } = useLocale();
  const [newTagName, setNewTagName] = useState('');
  const [newTagMsg, setNewTagMsg] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!onCreateTag || !newTagName.trim()) return;
    setCreating(true);
    try {
      const msg = await onCreateTag(newTagName.trim(), undefined, newTagMsg.trim() || undefined);
      toast.success(t('git.tag.createSuccess'), { description: msg });
      setNewTagName('');
      setNewTagMsg('');
    } catch (e) {
      toast.error(String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!onDeleteTag) return;
    try {
      const msg = await onDeleteTag(name);
      toast.success(t('git.tag.deleteSuccess'), { description: msg });
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handlePushTags = async () => {
    if (!onPushTags) return;
    try {
      const msg = await onPushTags();
      toast.success(t('git.branchAction.pushTagsSuccess'), { description: msg });
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Tag className="h-4 w-4" />
            {t('git.repo.tag')}
            <Badge variant="secondary">{tags.length}</Badge>
          </CardTitle>
          {onPushTags && tags.length > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handlePushTags}>
              <Upload className="h-3 w-3 mr-1" />
              {t('git.branchAction.pushTags')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {tags.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('git.repo.noTags')}</p>
        ) : (
          <div className="space-y-1.5">
            {tags.map((tag) => (
              <div key={tag.name} className="flex items-center gap-2 text-xs group">
                <Badge variant="outline" className="font-mono text-[10px] h-5 px-1.5">
                  {tag.name}
                </Badge>
                <span className="font-mono text-muted-foreground">{tag.shortHash}</span>
                {tag.date && (
                  <span className="text-muted-foreground ml-auto">
                    {tag.date.split(' ')[0]}
                  </span>
                )}
                {onDeleteTag && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                    onClick={() => handleDelete(tag.name)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {onCreateTag && (
          <div className="flex items-center gap-2 pt-1 border-t">
            <Input
              placeholder={t('git.tagAction.namePlaceholder')}
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              className="w-28 h-7 text-xs"
              disabled={creating}
            />
            <Input
              placeholder={t('git.tagAction.messagePlaceholder')}
              value={newTagMsg}
              onChange={(e) => setNewTagMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="flex-1 h-7 text-xs"
              disabled={creating}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleCreate}
              disabled={creating || !newTagName.trim()}
            >
              <Plus className="h-3 w-3 mr-1" />
              {t('git.tagAction.create')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
