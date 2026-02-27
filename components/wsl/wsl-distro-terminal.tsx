'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { writeClipboard } from '@/lib/clipboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TerminalSquare, Play, Trash2, Copy, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { ExecHistoryEntry, WslDistroTerminalProps } from '@/types/wsl';

export function WslDistroTerminal({ distroName, isRunning, onExec, t }: WslDistroTerminalProps) {
  const [command, setCommand] = useState('');
  const [user, setUser] = useState('');
  const [executing, setExecuting] = useState(false);
  const [history, setHistory] = useState<ExecHistoryEntry[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  const handleExec = useCallback(async () => {
    if (!command.trim()) return;
    setExecuting(true);
    try {
      const result = await onExec(distroName, command.trim(), user.trim() || undefined);
      setHistory((prev) => [
        ...prev,
        {
          command: command.trim(),
          user: user.trim() || undefined,
          result,
          timestamp: Date.now(),
        },
      ]);
      setCommandHistory((prev) => [...prev, command.trim()]);
      setHistoryIndex(-1);
      setCommand('');
    } catch (err) {
      toast.error(String(err));
    } finally {
      setExecuting(false);
      inputRef.current?.focus();
    }
  }, [command, user, distroName, onExec]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !executing) {
        handleExec();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (commandHistory.length === 0) return;
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCommand(commandHistory[newIndex]);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex === -1) return;
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setCommand('');
        } else {
          setHistoryIndex(newIndex);
          setCommand(commandHistory[newIndex]);
        }
      }
    },
    [executing, handleExec, commandHistory, historyIndex]
  );

  const handleCopy = async (text: string) => {
    await writeClipboard(text);
    toast.success(t('common.copied'));
  };

  const clearHistory = () => {
    setHistory([]);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TerminalSquare className="h-4 w-4 text-muted-foreground" />
          {t('wsl.detail.terminal')} — {distroName}
          {isRunning && (
            <Badge variant="default" className="text-[10px] ml-1">
              {t('wsl.running')}
            </Badge>
          )}
        </CardTitle>
        {history.length > 0 && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={clearHistory}>
            <Trash2 className="h-3 w-3" />
            {t('common.clear')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* User field */}
        <div className="space-y-1">
          <Label className="text-xs">{t('wsl.exec.user')}</Label>
          <Input
            className="h-8 text-xs"
            placeholder="root"
            value={user}
            onChange={(e) => setUser(e.target.value)}
          />
        </div>

        {/* Command input */}
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 font-mono">
            <span className="text-primary font-semibold">{distroName}</span>
            <span>$</span>
          </div>
          <Input
            ref={inputRef}
            className="h-8 text-xs font-mono flex-1"
            placeholder={t('wsl.exec.commandPlaceholder')}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={executing}
            autoFocus
          />
          <Button
            variant="default"
            size="sm"
            className="h-8 gap-1"
            disabled={!command.trim() || executing}
            onClick={handleExec}
          >
            <Play className="h-3 w-3" />
            {t('wsl.exec.run')}
          </Button>
        </div>

        {!isRunning && (
          <p className="text-xs text-amber-600">{t('wsl.exec.noRunningHint')}</p>
        )}

        {/* Output history */}
        {history.length > 0 && (
          <ScrollArea className="max-h-[500px]">
            <div
              ref={outputRef}
              className="rounded-md border bg-zinc-950 text-zinc-100 p-3 space-y-3 font-mono text-xs"
            >
              {history.map((entry, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    {entry.user && <span className="text-yellow-400">{entry.user}@</span>}
                    <span className="text-green-400 font-semibold">{distroName}</span>
                    <span className="text-zinc-500">$</span>
                    <span className="text-zinc-200 flex-1 truncate">{entry.command}</span>
                    {entry.result.exitCode === 0 ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                    ) : (
                      <span className="flex items-center gap-1 text-red-400 shrink-0">
                        <XCircle className="h-3 w-3" />
                        <span>{entry.result.exitCode}</span>
                      </span>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0 text-zinc-500 hover:text-zinc-200"
                          onClick={() => handleCopy(entry.result.stdout || entry.result.stderr)}
                        >
                          <Copy className="h-2.5 w-2.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('common.copy')}</TooltipContent>
                    </Tooltip>
                  </div>
                  {entry.result.stdout && (
                    <pre className="whitespace-pre-wrap break-all text-zinc-300 pl-2 border-l border-zinc-700">
                      {entry.result.stdout}
                    </pre>
                  )}
                  {entry.result.stderr && (
                    <pre className="whitespace-pre-wrap break-all text-red-400 pl-2 border-l border-red-900">
                      {entry.result.stderr}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {history.length === 0 && (
          <div className="rounded-md border bg-zinc-950 text-zinc-500 p-6 text-center text-xs font-mono">
            {t('wsl.detail.terminalEmpty')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
