'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2 } from 'lucide-react';
import type { TerminalProfile, ShellInfo } from '@/types/tauri';
import { useLocale } from '@/components/providers/locale-provider';

interface TerminalProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: TerminalProfile | null;
  shells: ShellInfo[];
  onSave: (profile: TerminalProfile) => void;
  fromTemplate?: TerminalProfile | null;
}

export function TerminalProfileDialog({
  open,
  onOpenChange,
  profile,
  shells,
  onSave,
  fromTemplate,
}: TerminalProfileDialogProps) {
  const { t } = useLocale();
  const source = profile ?? fromTemplate ?? null;
  const isEdit = !!profile?.id;
  const fallbackShellId = shells[0]?.id ?? '';
  const resolvedShellId =
    source?.shellId && shells.some((shell) => shell.id === source.shellId)
      ? source.shellId
      : fallbackShellId;

  const [name, setName] = useState(source?.name ?? '');
  const [shellId, setShellId] = useState(resolvedShellId);
  const [args, setArgs] = useState(source?.args?.join(' ') ?? '');
  const [cwd, setCwd] = useState(source?.cwd ?? '');
  const [startupCommand, setStartupCommand] = useState(source?.startupCommand ?? '');
  const [envType, setEnvType] = useState(source?.envType ?? '');
  const [envVersion, setEnvVersion] = useState(source?.envVersion ?? '');
  const [envVars, setEnvVars] = useState<[string, string][]>(
    Object.entries(source?.envVars ?? {}) as [string, string][]
  );

  const handleAddEnvVar = () => {
    setEnvVars((prev) => [...prev, ['', '']]);
  };

  const handleRemoveEnvVar = (index: number) => {
    setEnvVars((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEnvVarChange = (index: number, field: 0 | 1, value: string) => {
    setEnvVars((prev) => {
      const next = [...prev];
      next[index] = [...next[index]] as [string, string];
      next[index][field] = value;
      return next;
    });
  };

  const handleSave = () => {
    if (!shellId) {
      return;
    }

    const envVarsObj: Record<string, string> = {};
    for (const [key, value] of envVars) {
      if (key.trim()) {
        envVarsObj[key.trim()] = value;
      }
    }
    const newProfile: TerminalProfile = {
      id: profile?.id ?? '',
      name: name.trim() || 'Untitled',
      shellId,
      args: args.trim() ? args.trim().split(/\s+/) : [],
      envVars: envVarsObj,
      cwd: cwd.trim() || null,
      startupCommand: startupCommand.trim() || null,
      envType: envType.trim() || null,
      envVersion: envVersion.trim() || null,
      isDefault: profile?.isDefault ?? false,
      createdAt: profile?.createdAt ?? '',
      updatedAt: profile?.updatedAt ?? '',
    };
    onSave(newProfile);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('terminal.editProfile') : t('terminal.createProfile')}
          </DialogTitle>
          <DialogDescription>
            {t('terminal.profileDescription')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">{t('terminal.profileName')}</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Terminal" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="shell">{t('terminal.shell')}</Label>
            <Select value={shellId} onValueChange={setShellId} disabled={shells.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={t('terminal.selectShell')} />
              </SelectTrigger>
              <SelectContent>
                {shells.map((shell) => (
                  <SelectItem key={shell.id} value={shell.id}>
                    {shell.name} {shell.version ? `(v${shell.version})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="args">{t('terminal.shellArgs')}</Label>
            <Input id="args" value={args} onChange={(e) => setArgs(e.target.value)} placeholder="-NoLogo -l" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cwd">{t('terminal.workingDirectory')}</Label>
            <Input id="cwd" value={cwd} onChange={(e) => setCwd(e.target.value)} placeholder="~/projects" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="startupCommand">{t('terminal.startupCommand')}</Label>
            <Input id="startupCommand" value={startupCommand} onChange={(e) => setStartupCommand(e.target.value)} placeholder="echo Hello" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="envType">{t('terminal.envType')}</Label>
              <Input id="envType" value={envType} onChange={(e) => setEnvType(e.target.value)} placeholder="node" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="envVersion">{t('terminal.envVersion')}</Label>
              <Input id="envVersion" value={envVersion} onChange={(e) => setEnvVersion(e.target.value)} placeholder="20.11.0" />
            </div>
          </div>

          <Separator />

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>{t('terminal.envVars')}</Label>
              <Button type="button" size="sm" variant="outline" onClick={handleAddEnvVar}>
                <Plus className="h-3 w-3 mr-1" />
                {t('terminal.addEnvVar')}
              </Button>
            </div>
            {envVars.length > 0 && (
              <div className="space-y-2">
                {envVars.map(([key, value], i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      className="font-mono text-xs flex-1"
                      value={key}
                      onChange={(e) => handleEnvVarChange(i, 0, e.target.value)}
                      placeholder="KEY"
                    />
                    <span className="text-muted-foreground">=</span>
                    <Input
                      className="font-mono text-xs flex-1"
                      value={value}
                      onChange={(e) => handleEnvVarChange(i, 1, e.target.value)}
                      placeholder="value"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive shrink-0"
                      onClick={() => handleRemoveEnvVar(i)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t('terminal.envVarsHint')}</p>
          </div>
        </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('terminal.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || !shellId || shells.length === 0}>
            {isEdit ? t('terminal.save') : t('terminal.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
