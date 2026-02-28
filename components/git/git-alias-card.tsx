'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Terminal, Plus, Trash2, Save, Sparkles } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import type { GitConfigEntry } from '@/types/tauri';
import type { GitAliasCardProps } from '@/types/git';

const RECOMMENDED_ALIASES: { name: string; command: string }[] = [
  { name: 'co', command: 'checkout' },
  { name: 'br', command: 'branch' },
  { name: 'ci', command: 'commit' },
  { name: 'st', command: 'status' },
  { name: 'lg', command: 'log --oneline --graph --decorate --all' },
  { name: 'last', command: 'log -1 HEAD' },
  { name: 'unstage', command: 'reset HEAD --' },
  { name: 'amend', command: 'commit --amend --no-edit' },
];

export function GitAliasCard({
  onListAliases,
  onSetAlias,
  onRemoveAlias,
}: GitAliasCardProps) {
  const { t } = useLocale();
  const [aliases, setAliases] = useState<GitConfigEntry[]>([]);
  const [newName, setNewName] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editCommand, setEditCommand] = useState('');
  const [loading, setLoading] = useState(true);
  const initRef = useRef(false);

  const refreshAliases = useCallback(async () => {
    try {
      const result = await onListAliases();
      setAliases(result);
    } catch {
      setAliases([]);
    } finally {
      setLoading(false);
    }
  }, [onListAliases]);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      queueMicrotask(() => { refreshAliases(); });
    }
  }, [refreshAliases]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    await onSetAlias(name, newCommand);
    setNewName('');
    setNewCommand('');
    await refreshAliases();
  };

  const handleSaveEdit = async (name: string) => {
    await onSetAlias(name, editCommand);
    setEditingName(null);
    setEditCommand('');
    await refreshAliases();
  };

  const handleRemove = async (name: string) => {
    await onRemoveAlias(name);
    await refreshAliases();
  };

  const handleApplyRecommended = async () => {
    for (const preset of RECOMMENDED_ALIASES) {
      const exists = aliases.some((a) => a.key === preset.name);
      if (!exists) {
        await onSetAlias(preset.name, preset.command);
      }
    }
    await refreshAliases();
  };

  const existingNames = new Set(aliases.map((a) => a.key));

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            {t('git.alias.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            {t('git.alias.title')}
            {aliases.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {aliases.length}
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleApplyRecommended}
            className="gap-1"
          >
            <Sparkles className="h-3 w-3" />
            {t('git.alias.applyPresets')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {aliases.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-4">{t('git.alias.empty')}</p>
        ) : (
          <div className="space-y-2 mb-4">
            {aliases.map((alias) => (
              <div key={alias.key} className="flex items-center gap-2 text-sm">
                <code className="bg-muted px-2 py-0.5 rounded font-mono text-xs min-w-[100px] shrink-0">
                  git {alias.key}
                </code>
                {editingName === alias.key ? (
                  <>
                    <Input
                      value={editCommand}
                      onChange={(e) => setEditCommand(e.target.value)}
                      className="h-7 text-xs flex-1 font-mono"
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(alias.key)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleSaveEdit(alias.key)}
                    >
                      <Save className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span
                      className="text-xs truncate flex-1 cursor-pointer hover:text-foreground text-muted-foreground font-mono"
                      onClick={() => {
                        setEditingName(alias.key);
                        setEditCommand(alias.value);
                      }}
                    >
                      {alias.value}
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
                          <AlertDialogTitle>{t('git.alias.confirmRemoveTitle')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('git.alias.confirmRemoveDesc', { name: alias.key })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('git.alias.cancel')}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRemove(alias.key)}>
                            {t('git.alias.confirmRemove')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Recommended aliases preview */}
        {RECOMMENDED_ALIASES.some((p) => !existingNames.has(p.name)) && (
          <div className="mb-4 p-3 rounded-md bg-muted/50 border border-dashed">
            <p className="text-xs font-medium mb-2">{t('git.alias.recommended')}</p>
            <div className="flex flex-wrap gap-1.5">
              {RECOMMENDED_ALIASES.filter((p) => !existingNames.has(p.name)).map((preset) => (
                <Badge key={preset.name} variant="outline" className="text-xs font-mono">
                  {preset.name} → {preset.command}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Add new alias */}
        <div className="flex items-center gap-2">
          <Input
            placeholder={t('git.alias.namePlaceholder')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-8 text-xs w-28 font-mono"
          />
          <Input
            placeholder={t('git.alias.commandPlaceholder')}
            value={newCommand}
            onChange={(e) => setNewCommand(e.target.value)}
            className="h-8 text-xs flex-1 font-mono"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={!newName.trim()}
          >
            <Plus className="h-3 w-3 mr-1" />
            {t('git.alias.add')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
