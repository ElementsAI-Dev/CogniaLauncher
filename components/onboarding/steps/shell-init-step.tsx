'use client';

import { useState, useCallback } from 'react';
import { Terminal, Copy, CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

interface ShellInitStepProps {
  t: (key: string) => string;
}

type ShellType = 'powershell' | 'bash' | 'zsh' | 'fish';

interface ShellOption {
  value: ShellType;
  label: string;
  configFile: string;
  command: string;
}

const SHELL_OPTIONS: ShellOption[] = [
  {
    value: 'powershell',
    label: 'PowerShell',
    configFile: '$PROFILE',
    command: '# Add CogniaLauncher shim directory to PATH\n$env:PATH = "$env:LOCALAPPDATA\\CogniaLauncher\\shims;$env:PATH"',
  },
  {
    value: 'bash',
    label: 'Bash',
    configFile: '~/.bashrc',
    command: '# Add CogniaLauncher shim directory to PATH\nexport PATH="$HOME/.cognia/shims:$PATH"',
  },
  {
    value: 'zsh',
    label: 'Zsh',
    configFile: '~/.zshrc',
    command: '# Add CogniaLauncher shim directory to PATH\nexport PATH="$HOME/.cognia/shims:$PATH"',
  },
  {
    value: 'fish',
    label: 'Fish',
    configFile: '~/.config/fish/config.fish',
    command: '# Add CogniaLauncher shim directory to PATH\nfish_add_path $HOME/.cognia/shims',
  },
];

export function ShellInitStep({ t }: ShellInitStepProps) {
  const isWindows = typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows');
  const [selectedShell, setSelectedShell] = useState<ShellType>(isWindows ? 'powershell' : 'bash');
  const [copied, setCopied] = useState(false);

  const currentShell = SHELL_OPTIONS.find((s) => s.value === selectedShell)!;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(currentShell.command);
      setCopied(true);
      toast.success(t('onboarding.shellCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('onboarding.shellCopyFailed'));
    }
  }, [currentShell.command, t]);

  return (
    <div className="flex flex-col items-center text-center space-y-6 py-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Terminal className="h-8 w-8" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold">{t('onboarding.shellTitle')}</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          {t('onboarding.shellDesc')}
        </p>
      </div>

      {/* Shell selector */}
      <ToggleGroup
        type="single"
        value={selectedShell}
        onValueChange={(v) => {
          if (v) {
            setSelectedShell(v as ShellType);
            setCopied(false);
          }
        }}
        variant="outline"
        className="flex-wrap justify-center"
      >
        {SHELL_OPTIONS.map((shell) => (
          <ToggleGroupItem key={shell.value} value={shell.value} size="sm">
            {shell.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {/* Command display */}
      <Card className="w-full max-w-md py-0 overflow-hidden">
        <CardHeader className="flex-row items-center justify-between border-b px-3 py-2 bg-muted/30">
          <span className="text-xs text-muted-foreground font-mono">
            {currentShell.configFile}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={handleCopy}
          >
            {copied ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? t('onboarding.shellCopied') : t('onboarding.shellCopy')}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <pre className="p-3 text-sm text-left font-mono overflow-x-auto whitespace-pre-wrap break-all">
            {currentShell.command}
          </pre>
        </CardContent>
      </Card>

      <Alert className="max-w-sm">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          {t('onboarding.shellHint')}
        </AlertDescription>
      </Alert>
    </div>
  );
}
