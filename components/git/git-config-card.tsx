'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Settings2, Plus, Trash2, Save } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import type { GitConfigEntry } from '@/types/tauri';
import type { GitConfigCardProps } from '@/types/git';

export function GitConfigCard({ config, onSet, onRemove }: GitConfigCardProps) {
  const { t } = useLocale();
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleAdd = async () => {
    if (!newKey.trim()) return;
    await onSet(newKey.trim(), newValue);
    setNewKey('');
    setNewValue('');
  };

  const handleSaveEdit = async (key: string) => {
    await onSet(key, editValue);
    setEditingKey(null);
    setEditValue('');
  };

  const startEdit = (entry: GitConfigEntry) => {
    setEditingKey(entry.key);
    setEditValue(entry.value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          {t('git.config.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {config.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('git.config.empty')}</p>
        ) : (
          <div className="space-y-2 mb-4">
            {config.map((entry) => (
              <div key={entry.key} className="flex items-center gap-2 text-sm">
                <code className="bg-muted px-2 py-0.5 rounded font-mono text-xs min-w-[180px] shrink-0">
                  {entry.key}
                </code>
                {editingKey === entry.key ? (
                  <>
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="h-7 text-xs flex-1"
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(entry.key)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleSaveEdit(entry.key)}
                    >
                      <Save className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span
                      className="text-xs truncate flex-1 cursor-pointer hover:text-foreground text-muted-foreground"
                      onClick={() => startEdit(entry)}
                    >
                      {entry.value}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => onRemove(entry.key)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Input
            placeholder={t('git.config.keyPlaceholder')}
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="h-8 text-xs"
          />
          <Input
            placeholder={t('git.config.valuePlaceholder')}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="h-8 text-xs"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={!newKey.trim()}
          >
            <Plus className="h-3 w-3 mr-1" />
            {t('git.config.add')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
