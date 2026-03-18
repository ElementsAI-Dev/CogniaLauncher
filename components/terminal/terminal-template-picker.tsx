'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
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
import type { ShellType, TerminalProfileTemplate, TemplateCategory } from '@/types/tauri';
import { useLocale } from '@/components/providers/locale-provider';

interface TerminalTemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: TerminalProfileTemplate[];
  onSelect: (template: TerminalProfileTemplate) => void;
  onCreateCustom?: (template: TerminalProfileTemplate) => Promise<string | void> | string | void;
  onDelete?: (id: string) => Promise<boolean | void> | boolean | void;
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
const CUSTOM_TEMPLATE_SHELLS: ShellType[] = ['bash', 'zsh', 'fish', 'powershell', 'cmd', 'nushell'];

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
  onCreateCustom,
  onDelete,
}: TerminalTemplatePickerProps) {
  const { t } = useLocale();
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<{
    name: string;
    description: string;
    shellType: ShellType | '';
    startupCommand: string;
  }>({
    name: '',
    description: '',
    shellType: '',
    startupCommand: '',
  });
  const [createValidation, setCreateValidation] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    status: 'success' | 'error';
    title: string;
    description: string;
  } | null>(null);

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

  const resetCreateState = () => {
    setCreateDraft({
      name: '',
      description: '',
      shellType: '',
      startupCommand: '',
    });
    setCreateValidation(null);
  };

  const buildCustomTemplate = (): TerminalProfileTemplate => ({
    id: '',
    name: createDraft.name.trim(),
    description: createDraft.description.trim() || t('terminal.customTemplateDescriptionFallback'),
    icon: 'terminal',
    category: 'custom',
    shellType: createDraft.shellType || null,
    args: [],
    envVars: {},
    cwd: null,
    startupCommand: createDraft.startupCommand.trim() || null,
    envType: null,
    envVersion: null,
    isBuiltin: false,
  });

  const handleCreateCustomTemplate = async () => {
    if (!onCreateCustom) return;
    if (!createDraft.name.trim()) {
      setCreateValidation(t('terminal.templateValidationNameRequired'));
      return;
    }
    if (!createDraft.shellType) {
      setCreateValidation(t('terminal.templateValidationShellRequired'));
      return;
    }

    setCreateValidation(null);
    const result = await onCreateCustom(buildCustomTemplate());
    if (!result) {
      setActionFeedback({
        status: 'error',
        title: t('terminal.templateActionErrorTitle'),
        description: t('terminal.templateActionCreateFailed'),
      });
      return;
    }

    setActionFeedback({
      status: 'success',
      title: t('terminal.templateActionSuccessTitle'),
      description: t('terminal.templateActionCreated', { name: createDraft.name.trim() }),
    });
    setCreateOpen(false);
    resetCreateState();
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          onOpenChange(v);
          if (!v) {
            setSearch('');
            setCreateOpen(false);
            resetCreateState();
          }
        }}
      >
        <DialogContent className="sm:max-w-[640px] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>{t('terminal.templatePicker')}</DialogTitle>
            <DialogDescription>{t('terminal.templatePickerDesc')} ({templates.length})</DialogDescription>
          </DialogHeader>

          {actionFeedback && (
            <Alert variant={actionFeedback.status === 'error' ? 'destructive' : 'default'}>
              <AlertTitle>{actionFeedback.title}</AlertTitle>
              <AlertDescription>{actionFeedback.description}</AlertDescription>
            </Alert>
          )}

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
              <Empty className="border-none py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Terminal />
                  </EmptyMedia>
                  <EmptyTitle className="text-sm font-normal text-muted-foreground">
                    {search.trim() && templates.length > 0
                      ? t('terminal.noSearchResults')
                      : t('terminal.noTemplates')}
                  </EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-5">
                {grouped.map(({ category, items }) => (
                  <div key={category}>
                    <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                      {getCategoryLabel(category, t)}
                    </h4>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {items.map((tpl) => (
                        <Tooltip key={tpl.id}>
                          <TooltipTrigger asChild>
                            <Card
                              role="button"
                              tabIndex={0}
                              className="group cursor-pointer border transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() => handleSelect(tpl)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  handleSelect(tpl);
                                }
                              }}
                            >
                              <CardContent className="flex items-start gap-3 p-3">
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
                                  <div className="mt-1.5 flex flex-wrap gap-1">
                                    {tpl.shellType && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{tpl.shellType}</Badge>
                                    )}
                                    {tpl.envType && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{tpl.envType}</Badge>
                                    )}
                                  </div>
                                </div>
                                {!tpl.isBuiltin && onDelete && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 text-destructive"
                                    aria-label={t('terminal.deleteTemplate')}
                                    onClick={(e) => { e.stopPropagation(); setDeleteId(tpl.id); }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </CardContent>
                            </Card>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-[280px] space-y-1 text-xs">
                            {tpl.shellType && <p><span className="font-medium">{t('terminal.tooltipShell')}</span> {tpl.shellType}</p>}
                            {tpl.args && tpl.args.length > 0 && <p><span className="font-medium">{t('terminal.tooltipArgs')}</span> {tpl.args.join(' ')}</p>}
                            {tpl.envType && <p><span className="font-medium">{t('terminal.tooltipEnv')}</span> {tpl.envType}{tpl.envVersion ? ` ${tpl.envVersion}` : ''}</p>}
                            {tpl.startupCommand && <p><span className="font-medium">{t('terminal.tooltipStartup')}</span> {tpl.startupCommand}</p>}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                    <Separator className="mt-4" />
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            {onCreateCustom && (
              <Button
                variant="outline"
                onClick={() => {
                  setCreateOpen(true);
                  setCreateValidation(null);
                }}
              >
                {t('terminal.createCustomTemplate')}
              </Button>
            )}
            <Button variant="outline" onClick={() => { onOpenChange(false); setSearch(''); }}>
              {t('terminal.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={createOpen}
        onOpenChange={(nextOpen) => {
          setCreateOpen(nextOpen);
          if (!nextOpen) {
            resetCreateState();
          }
        }}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{t('terminal.createCustomTemplate')}</DialogTitle>
            <DialogDescription>{t('terminal.createCustomTemplateDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="custom-template-name">{t('terminal.templateName')}</Label>
              <Input
                id="custom-template-name"
                value={createDraft.name}
                onChange={(event) => setCreateDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="custom-template-description">{t('terminal.templateDescription')}</Label>
              <Input
                id="custom-template-description"
                value={createDraft.description}
                onChange={(event) => setCreateDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('terminal.templateShellType')}</Label>
              <Select
                value={createDraft.shellType}
                onValueChange={(value) => setCreateDraft((current) => ({
                  ...current,
                  shellType: value as ShellType,
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('terminal.templateSelectShellType')} />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOM_TEMPLATE_SHELLS.map((shellType) => (
                    <SelectItem key={shellType} value={shellType}>
                      {shellType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="custom-template-startup">{t('terminal.tooltipStartup')}</Label>
              <Input
                id="custom-template-startup"
                value={createDraft.startupCommand}
                onChange={(event) => setCreateDraft((current) => ({
                  ...current,
                  startupCommand: event.target.value,
                }))}
              />
            </div>
            {createValidation && (
              <Alert variant="destructive">
                <AlertTitle>{t('terminal.templateActionErrorTitle')}</AlertTitle>
                <AlertDescription>{createValidation}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                resetCreateState();
              }}
            >
              {t('terminal.cancel')}
            </Button>
            <Button onClick={() => void handleCreateCustomTemplate()}>
              {t('terminal.saveTemplate')}
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
                  void Promise.resolve(onDelete(deleteId)).then((result) => {
                    setActionFeedback(
                      result === false
                        ? {
                            status: 'error',
                            title: t('terminal.templateActionErrorTitle'),
                            description: t('terminal.templateActionDeleteFailed'),
                          }
                        : {
                            status: 'success',
                            title: t('terminal.templateActionSuccessTitle'),
                            description: t('terminal.templateActionDeleted'),
                          },
                    );
                    setDeleteId(null);
                  });
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
