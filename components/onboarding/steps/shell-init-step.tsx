'use client';

import { useState, useCallback, useEffect } from 'react';
import { writeClipboard } from '@/lib/clipboard';
import { Terminal, Copy, CheckCircle2, Info, Wand2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { isWindows as isWindowsOS } from '@/lib/platform';
import { isTauri } from '@/lib/tauri';
import { SHELL_OPTIONS } from '@/lib/constants/onboarding';
import type { ShellInitStepProps, ShellType } from '@/types/onboarding';

export function ShellInitStep({ t, mode = 'quick', onSummaryChange }: ShellInitStepProps) {
  const [selectedShell, setSelectedShell] = useState<ShellType>(isWindowsOS() ? 'powershell' : 'bash');
  const [copied, setCopied] = useState(false);
  const [pathConfigured, setPathConfigured] = useState<boolean | null>(null);
  const [autoSetupLoading, setAutoSetupLoading] = useState(false);

  const currentShell = SHELL_OPTIONS.find((s) => s.value === selectedShell)!;

  useEffect(() => {
    onSummaryChange?.({
      shellType: selectedShell,
      shellConfigured: pathConfigured,
    });
  }, [onSummaryChange, pathConfigured, selectedShell]);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    (async () => {
      try {
        const { pathCheck } = await import('@/lib/tauri');
        const result = await pathCheck();
        if (!cancelled) setPathConfigured(result);
      } catch {
        if (!cancelled) setPathConfigured(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleAutoSetup = useCallback(async () => {
    setAutoSetupLoading(true);
    try {
      const { pathSetup } = await import('@/lib/tauri');
      await pathSetup();
      setPathConfigured(true);
      toast.success(t('onboarding.shellAutoSetupSuccess'));
    } catch {
      toast.error(t('onboarding.shellAutoSetupFailed'));
    } finally {
      setAutoSetupLoading(false);
    }
  }, [t]);

  const handleCopy = useCallback(async () => {
    try {
      await writeClipboard(currentShell.command);
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

      {/* Auto setup for Tauri mode */}
      {isTauri() && (
        <div className="w-full max-w-md">
          {pathConfigured ? (
            <Alert className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-xs text-green-700 dark:text-green-400">
                {t('onboarding.shellAlreadyConfigured')}
              </AlertDescription>
            </Alert>
          ) : (
            <Button
              onClick={handleAutoSetup}
              disabled={autoSetupLoading}
              className="gap-2 w-full"
            >
              {autoSetupLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              {t('onboarding.shellAutoSetup')}
            </Button>
          )}
        </div>
      )}

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

      {mode === 'detailed' && (
        <div className="grid w-full max-w-md gap-3 text-left md:grid-cols-2">
          <Card className="py-0">
            <CardHeader className="pb-2">
              <div className="text-sm font-semibold">{t('onboarding.shellDetailedWhereTitle')}</div>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              {t('onboarding.shellDetailedWhereDesc')}
            </CardContent>
          </Card>
          <Card className="py-0">
            <CardHeader className="pb-2">
              <div className="text-sm font-semibold">{t('onboarding.shellDetailedVerifyTitle')}</div>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              {t('onboarding.shellDetailedVerifyDesc')}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
