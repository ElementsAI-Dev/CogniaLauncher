'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FolderOpen, Plus, Trash2 } from 'lucide-react';
import { isTauri } from '@/lib/tauri';
import type { CustomCacheEntry, CustomCacheDialogProps } from '@/types/cache';

interface CustomCacheDialogProps {
  entries: CustomCacheEntry[];
  onEntriesChange: (entries: CustomCacheEntry[]) => void;
  t: (key: string) => string;
}

const CATEGORIES = [
  { value: 'package_manager', labelKey: 'cache.categoryPackageManager' },
  { value: 'devtools', labelKey: 'cache.categoryDevtools' },
  { value: 'system', labelKey: 'cache.categorySystem' },
  { value: 'terminal', labelKey: 'cache.categoryTerminal' },
];

export function CustomCacheDialog({ entries, onEntriesChange, t }: CustomCacheDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [category, setCategory] = useState('package_manager');

  const handleBrowse = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const dialogModule = await import('@tauri-apps/plugin-dialog').catch(() => null);
      if (dialogModule?.open) {
        const selected = await dialogModule.open({
          directory: true,
          multiple: false,
          title: t('settings.customCachePath'),
        });
        if (typeof selected === 'string') {
          setPath(selected);
        }
      }
    } catch {
      // dialog not available
    }
  }, [t]);

  const handleAdd = useCallback(() => {
    if (!name.trim() || !path.trim()) return;
    const id = `custom_${name.trim().toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    const newEntry: CustomCacheEntry = {
      id,
      displayName: name.trim(),
      path: path.trim(),
      category,
    };
    onEntriesChange([...entries, newEntry]);
    setName('');
    setPath('');
    setCategory('package_manager');
    setOpen(false);
  }, [name, path, category, entries, onEntriesChange]);

  const handleRemove = useCallback(
    (id: string) => {
      onEntriesChange(entries.filter((e) => e.id !== id));
    },
    [entries, onEntriesChange],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="font-medium">{t('settings.customCacheEntries')}</Label>
          <p className="text-sm text-muted-foreground">{t('settings.customCacheEntriesDesc')}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              {t('settings.customCacheAdd')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('settings.customCacheAdd')}</DialogTitle>
              <DialogDescription>{t('settings.customCacheEntriesDesc')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{t('settings.customCacheName')}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('cache.customCacheNamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.customCachePath')}</Label>
                <div className="flex gap-2">
                  <Input
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    placeholder={t('cache.customCachePathPlaceholder')}
                    className="flex-1"
                  />
                  {isTauri() && (
                    <Button variant="outline" size="icon" onClick={handleBrowse}>
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('settings.customCacheCategory')}</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {t(cat.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleAdd}
                disabled={!name.trim() || !path.trim()}
              >
                {t('settings.customCacheAdd')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          {t('settings.customCacheEmpty')}
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between p-2.5 rounded-md border bg-card"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{entry.displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{entry.path}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(entry.id)}
                className="ml-2 shrink-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
