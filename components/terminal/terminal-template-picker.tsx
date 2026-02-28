'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Terminal,
  GitBranch,
  Hexagon,
  Code,
  Settings,
  Box,
  Container,
  Search,
  Trash2,
  User,
} from 'lucide-react';
import type { TerminalProfileTemplate, TemplateCategory } from '@/types/tauri';
import { useLocale } from '@/components/providers/locale-provider';

interface TerminalTemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: TerminalProfileTemplate[];
  onSelect: (template: TerminalProfileTemplate) => void;
  onDelete?: (id: string) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  terminal: <Terminal className="h-5 w-5" />,
  'git-branch': <GitBranch className="h-5 w-5" />,
  hexagon: <Hexagon className="h-5 w-5" />,
  code: <Code className="h-5 w-5" />,
  settings: <Settings className="h-5 w-5" />,
  box: <Box className="h-5 w-5" />,
  container: <Container className="h-5 w-5" />,
  user: <User className="h-5 w-5" />,
};

const CATEGORY_ORDER: TemplateCategory[] = ['general', 'development', 'devOps', 'admin', 'custom'];

function getCategoryLabel(category: TemplateCategory, t: (key: string) => string): string {
  const map: Record<TemplateCategory, string> = {
    general: t('terminal.categoryGeneral'),
    development: t('terminal.categoryDevelopment'),
    devOps: t('terminal.categoryDevOps'),
    admin: t('terminal.categoryAdmin'),
    custom: t('terminal.categoryCustom'),
  };
  return map[category] ?? category;
}

function getCategoryVariant(category: TemplateCategory): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (category) {
    case 'development':
      return 'default';
    case 'devOps':
      return 'secondary';
    case 'admin':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function TerminalTemplatePicker({
  open,
  onOpenChange,
  templates,
  onSelect,
  onDelete,
}: TerminalTemplatePickerProps) {
  const { t } = useLocale();
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(
      (tpl) =>
        tpl.name.toLowerCase().includes(q) ||
        tpl.description.toLowerCase().includes(q),
    );
  }, [templates, search]);

  const grouped = useMemo(() => {
    const map = new Map<TemplateCategory, TerminalProfileTemplate[]>();
    for (const tpl of filtered) {
      const list = map.get(tpl.category) ?? [];
      list.push(tpl);
      map.set(tpl.category, list);
    }
    return CATEGORY_ORDER
      .filter((cat) => map.has(cat))
      .map((cat) => ({ category: cat, items: map.get(cat)! }));
  }, [filtered]);

  const handleSelect = (tpl: TerminalProfileTemplate) => {
    onSelect(tpl);
    onOpenChange(false);
    setSearch('');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSearch(''); }}>
        <DialogContent className="sm:max-w-[640px] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>{t('terminal.templatePicker')}</DialogTitle>
            <DialogDescription>{t('terminal.templatePickerDesc')}</DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t('terminal.searchTemplates')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <ScrollArea className="max-h-[55vh] pr-2">
            {grouped.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('terminal.noTemplates')}
              </p>
            ) : (
              <div className="space-y-5">
                {grouped.map(({ category, items }) => (
                  <div key={category}>
                    <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                      {getCategoryLabel(category, t)}
                    </h4>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {items.map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          className="group flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => handleSelect(tpl)}
                        >
                          <div className="mt-0.5 shrink-0 text-muted-foreground group-hover:text-accent-foreground">
                            {ICON_MAP[tpl.icon] ?? <Terminal className="h-5 w-5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{tpl.name}</span>
                              <Badge variant={getCategoryVariant(tpl.category)} className="shrink-0 text-[10px] px-1.5 py-0">
                                {getCategoryLabel(tpl.category, t)}
                              </Badge>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                              {tpl.description}
                            </p>
                          </div>
                          {!tpl.isBuiltin && onDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 text-destructive"
                              onClick={(e) => { e.stopPropagation(); setDeleteId(tpl.id); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </button>
                      ))}
                    </div>
                    <Separator className="mt-4" />
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => { onOpenChange(false); setSearch(''); }}>
              {t('terminal.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('terminal.deleteTemplate')}</AlertDialogTitle>
            <AlertDialogDescription>{t('terminal.confirmDeleteTemplate')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('terminal.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId && onDelete) {
                  onDelete(deleteId);
                  setDeleteId(null);
                }
              }}
            >
              {t('terminal.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
