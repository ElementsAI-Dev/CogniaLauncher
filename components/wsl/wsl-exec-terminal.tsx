'use client';

import { useState, useRef, useEffect } from 'react';
import { writeClipboard } from '@/lib/clipboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { TerminalSquare, Play, Trash2, Copy, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { ExecHistoryEntry, WslExecTerminalProps } from '@/types/wsl';

export function WslExecTerminal({ distros, onExec, t }: WslExecTerminalProps) {
  const [selectedDistro, setSelectedDistro] = useState('');
  const [command, setCommand] = useState('');
  const [user, setUser] = useState('');
  const [executing, setExecuting] = useState(false);
  const [history, setHistory] = useState<ExecHistoryEntry[]>([]);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (distros.length > 0 && !selectedDistro) {
      const defaultDistro = distros.find((d) => d.isDefault);
      setSelectedDistro(defaultDistro?.name ?? distros[0].name);
    }
  }, [distros, selectedDistro]);

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
        ...prev,
        {
          command: command.trim(),
          distro: selectedDistro,
          result,
          timestamp: Date.now(),
        },
      ]);
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TerminalSquare className="h-4 w-4 text-muted-foreground" />
          {t('wsl.exec.title')}
        </CardTitle>
        {history.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={clearHistory}
          >
            <Trash2 className="h-3 w-3" />
            {t('common.clear')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">{t('wsl.distros')}</Label>
            <Select value={selectedDistro} onValueChange={setSelectedDistro}>
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
          <Input
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
          </Button>
        </div>

        {runningDistros.length === 0 && distros.length > 0 && (
          <p className="text-xs text-amber-600">{t('wsl.exec.noRunningHint')}</p>
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
