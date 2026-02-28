'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Settings2, Plus, Trash2, Save, Search, ChevronRight, FileEdit, FolderOpen } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import type { GitConfigEntry } from '@/types/tauri';
import type { GitConfigCardProps } from '@/types/git';

function groupBySection(entries: GitConfigEntry[]): Record<string, GitConfigEntry[]> {
  const groups: Record<string, GitConfigEntry[]> = {};
  for (const entry of entries) {
    const dotIdx = entry.key.indexOf('.');
    const section = dotIdx > 0 ? entry.key.substring(0, dotIdx) : 'other';
    if (!groups[section]) groups[section] = [];
    groups[section].push(entry);
  }
  return groups;
}

export function GitConfigCard({ config, onSet, onRemove, configFilePath, onOpenInEditor }: GitConfigCardProps) {
  const { t } = useLocale();
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConfig = useMemo(() => {
    if (!searchQuery.trim()) return config;
    const q = searchQuery.toLowerCase();
    return config.filter(
      (e) => e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q),
    );
  }, [config, searchQuery]);

  const grouped = useMemo(() => groupBySection(filteredConfig), [filteredConfig]);
  const sectionNames = useMemo(() => Object.keys(grouped).sort(), [grouped]);

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

  const renderEntry = (entry: GitConfigEntry) => (
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('git.config.confirmRemoveTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('git.config.confirmRemoveDesc', { key: entry.key })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('git.config.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={() => onRemove(entry.key)}>
                  {t('git.config.confirmRemove')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              {t('git.config.title')}
              <Badge variant="secondary" className="text-xs">{config.length}</Badge>
            </CardTitle>
            {configFilePath && (
              <CardDescription className="flex items-center gap-1 mt-1 font-mono text-xs">
                <FolderOpen className="h-3 w-3" />
                {configFilePath}
              </CardDescription>
            )}
          </div>
          {onOpenInEditor && (
            <Button variant="outline" size="sm" onClick={onOpenInEditor} className="gap-1">
              <FileEdit className="h-3 w-3" />
              {t('git.config.openInEditor')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={t('git.config.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-xs pl-8"
          />
        </div>

        {filteredConfig.length === 0 ? (
          <p className="text-sm text-muted-foreground">{searchQuery ? t('git.config.noResults') : t('git.config.empty')}</p>
        ) : (
          <div className="space-y-1 mb-4 max-h-[400px] overflow-y-auto">
            {sectionNames.map((section) => (
              <Collapsible key={section} defaultOpen>
                <CollapsibleTrigger className="flex items-center gap-1.5 w-full py-1 text-xs font-semibold text-muted-foreground hover:text-foreground uppercase tracking-wider group">
                  <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
                  {section}
                  <Badge variant="outline" className="text-[10px] ml-1 h-4 px-1">
                    {grouped[section].length}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pl-4 pb-2">
                  {grouped[section].map(renderEntry)}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}

        <Separator className="my-2" />
        <div className="flex items-center gap-2">
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
