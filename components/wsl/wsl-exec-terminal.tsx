'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { writeClipboard } from '@/lib/clipboard';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TerminalSquare, Play, Trash2, Copy, CheckCircle2, XCircle, Star, BookmarkPlus, AlertTriangle } from 'lucide-react';
import { Kbd } from '@/components/ui/kbd';
import { toast } from 'sonner';
import { useWslStore } from '@/lib/stores/wsl';
import { PRESET_COMMANDS } from '@/lib/constants/wsl';
import type { ExecHistoryEntry, WslExecTerminalProps } from '@/types/wsl';
import { resolveWslWorkspaceScopedTarget } from '@/lib/wsl/workflow';

export function WslExecTerminal({
  distros,
  onExec,
  activeWorkspaceDistroName,
  onTargetExecuted,
  t,
}: WslExecTerminalProps) {
  const [overrideDistroName, setOverrideDistroName] = useState<string | null>(null);
  const [command, setCommand] = useState('');
  const [user, setUser] = useState('');
  const [executing, setExecuting] = useState(false);
  const [history, setHistory] = useState<ExecHistoryEntry[]>([]);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { savedCommands, addSavedCommand, removeSavedCommand } = useWslStore();
  const allSavedCommands = [...PRESET_COMMANDS, ...savedCommands];
  const defaultDistroName = useMemo(
    () => distros.find((d) => d.isDefault)?.name ?? distros[0]?.name ?? null,
    [distros],
  );
  const targetResolution = useMemo(
    () => resolveWslWorkspaceScopedTarget({
      activeWorkspaceDistroName,
      overrideDistroName,
      availableDistroNames: distros.map((d) => d.name),
      fallbackDistroName: defaultDistroName,
    }),
    [activeWorkspaceDistroName, defaultDistroName, distros, overrideDistroName],
  );
  const selectedDistro = targetResolution.distroName ?? '';

  useEffect(() => {
    if (overrideDistroName && !distros.some((d) => d.name === overrideDistroName)) {
      setOverrideDistroName(null);
    }
  }, [distros, overrideDistroName]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  const handleExec = async () => {
    if (!selectedDistro || !command.trim()) return;
    setExecuting(true);
    try {
      const result = await onExec(selectedDistro, command.trim(), user.trim() || undefined);
      setHistory((prev) => [
        ...prev.slice(-99),
        {
          command: command.trim(),
          distro: selectedDistro,
          result,
          timestamp: Date.now(),
        },
      ]);
      onTargetExecuted?.(selectedDistro);
      setCommand('');
    } catch (err) {
      toast.error(String(err));
    } finally {
      setExecuting(false);
    }
  };

  const handleCopy = async (text: string) => {
    await writeClipboard(text);
    toast.success(t('common.copied'));
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const runningDistros = distros.filter((d) => d.state.toLowerCase() === 'running');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TerminalSquare className="h-4 w-4 text-muted-foreground" />
          {t('wsl.exec.title')}
        </CardTitle>
        {history.length > 0 && (
          <CardAction>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={clearHistory}
            >
              <Trash2 className="h-3 w-3" />
              {t('common.clear')}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {activeWorkspaceDistroName && selectedDistro && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              {targetResolution.followsWorkspace
                ? t('wsl.workspaceContext.following').replace('{name}', selectedDistro)
                : t('wsl.workspaceContext.override').replace('{name}', selectedDistro)}
            </span>
            {!targetResolution.followsWorkspace && (
              <>
                <span>{t('wsl.workspaceContext.active').replace('{name}', activeWorkspaceDistroName)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setOverrideDistroName(null)}
                >
                  {t('wsl.workspaceContext.return')}
                </Button>
              </>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">{t('wsl.distros')}</Label>
            <Select
              value={selectedDistro}
              onValueChange={(value) => {
                if (!activeWorkspaceDistroName || value === activeWorkspaceDistroName) {
                  setOverrideDistroName(null);
                  return;
                }
                setOverrideDistroName(value);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={t('wsl.exec.selectDistro')} />
              </SelectTrigger>
              <SelectContent>
                {distros.map((d) => (
                  <SelectItem key={d.name} value={d.name}>
                    <span className="flex items-center gap-1.5">
                      {d.name}
                      {d.state.toLowerCase() === 'running' && (
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('wsl.exec.user')}</Label>
            <Input
              className="h-8 text-xs"
              placeholder="root"
              value={user}
              onChange={(e) => setUser(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <Star className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-2">
              <p className="text-xs font-medium text-muted-foreground mb-2">{t('wsl.savedCmd.title')}</p>
              <ScrollArea className="max-h-48">
                <div className="space-y-1">
                  {allSavedCommands.map((cmd) => (
                    <div key={cmd.id} className="flex items-center gap-1 group">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 justify-start h-7 text-xs font-mono truncate"
                        onClick={() => {
                          setCommand(cmd.command);
                          if (cmd.user) setUser(cmd.user);
                          inputRef.current?.focus();
                        }}
                      >
                        <span className="truncate">{cmd.name}</span>
                      </Button>
                      {!cmd.isPreset && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                          onClick={() => removeSavedCommand(cmd.id)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {command.trim() && (
                <>
                  <div className="border-t my-2" />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-xs gap-1"
                    onClick={() => {
                      addSavedCommand({ name: command.trim().slice(0, 40), command: command.trim(), user: user.trim() || undefined });
                      toast.success(t('wsl.savedCmd.added'));
                    }}
                  >
                    <BookmarkPlus className="h-3 w-3" />
                    {t('wsl.savedCmd.saveCurrent')}
                  </Button>
                </>
              )}
            </PopoverContent>
          </Popover>
          <Input
            ref={inputRef}
            className="h-8 text-xs font-mono flex-1"
            placeholder={t('wsl.exec.commandPlaceholder')}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !executing) handleExec();
            }}
            disabled={executing || !selectedDistro}
          />
          <Button
            variant="default"
            size="sm"
            className="h-8 gap-1"
            disabled={!command.trim() || !selectedDistro || executing}
            onClick={handleExec}
          >
            <Play className="h-3 w-3" />
            {t('wsl.exec.run')}
            <Kbd>↵</Kbd>
          </Button>
        </div>

        {runningDistros.length === 0 && distros.length > 0 && (
          <Alert variant="default" className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs text-amber-700 dark:text-amber-400">
              {t('wsl.exec.noRunningHint')}
            </AlertDescription>
          </Alert>
        )}

        {history.length > 0 && (
          <ScrollArea className="max-h-64">
            <div
              ref={outputRef}
              className="rounded-md border bg-muted/30 p-2 space-y-2"
            >
              {history.map((entry, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="font-medium">{entry.distro}</span>
                    <span>$</span>
                    <span className="font-mono flex-1 truncate">{entry.command}</span>
                    {entry.result.exitCode === 0 ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="h-3 w-3 text-destructive shrink-0" />
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0"
                          onClick={() => handleCopy(entry.result.stdout || entry.result.stderr)}
                        >
                          <Copy className="h-2.5 w-2.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('common.copy')}</TooltipContent>
                    </Tooltip>
                  </div>
                  {entry.result.stdout && (
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all text-foreground">
                      {entry.result.stdout}
                    </pre>
                  )}
                  {entry.result.stderr && (
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all text-destructive">
                      {entry.result.stderr}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
