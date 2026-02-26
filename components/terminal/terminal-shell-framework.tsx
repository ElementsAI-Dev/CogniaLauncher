'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Blocks, Puzzle, RefreshCw } from 'lucide-react';
import type { ShellInfo, ShellType, ShellFrameworkInfo, ShellPlugin } from '@/types/tauri';
import { useLocale } from '@/components/providers/locale-provider';

interface TerminalShellFrameworkProps {
  shells: ShellInfo[];
  frameworks: ShellFrameworkInfo[];
  plugins: ShellPlugin[];
  onDetectFrameworks: (shellType: ShellType) => Promise<void>;
  onFetchPlugins: (frameworkName: string, frameworkPath: string, shellType: ShellType) => Promise<void>;
  loading?: boolean;
}

export function TerminalShellFramework({
  shells,
  frameworks,
  plugins,
  onDetectFrameworks,
  onFetchPlugins,
  loading,
}: TerminalShellFrameworkProps) {
  const { t } = useLocale();
  const [detecting, setDetecting] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState<ShellFrameworkInfo | null>(null);

  const handleDetectAll = async () => {
    setDetecting(true);
    try {
      for (const shell of shells) {
        await onDetectFrameworks(shell.shellType);
      }
    } finally {
      setDetecting(false);
    }
  };

  const handleSelectFramework = async (fw: ShellFrameworkInfo) => {
    setSelectedFramework(fw);
    await onFetchPlugins(fw.name, fw.path, fw.shellType);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{t('terminal.frameworks')}</CardTitle>
            <CardDescription>{t('terminal.frameworksDesc')}</CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDetectAll}
            disabled={detecting || shells.length === 0}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${detecting ? 'animate-spin' : ''}`} />
            {t('terminal.detectFrameworks')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading || detecting ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : frameworks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {t('terminal.noFrameworks')}
          </p>
        ) : (
          <div className="space-y-3">
            {frameworks.map((fw) => (
              <div
                key={`${fw.name}-${fw.shellType}`}
                className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors hover:bg-accent/50 ${
                  selectedFramework?.name === fw.name ? 'border-primary bg-accent/30' : ''
                }`}
                onClick={() => handleSelectFramework(fw)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                    <Blocks className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{fw.name}</span>
                      {fw.version && (
                        <Badge variant="outline" className="text-xs">
                          v{fw.version}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate max-w-[300px]">
                      {fw.path}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">{fw.shellType}</Badge>
              </div>
            ))}
          </div>
        )}

        {selectedFramework && plugins.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Puzzle className="h-4 w-4" />
              {t('terminal.plugins')}
              <Badge variant="secondary">{plugins.length}</Badge>
            </h4>
            <ScrollArea className="max-h-[250px]">
              <div className="rounded-md border divide-y">
                {plugins.map((plugin) => (
                  <div
                    key={plugin.name}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${plugin.enabled ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                      <span className="text-sm font-mono">{plugin.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {plugin.source}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {selectedFramework && plugins.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            {t('terminal.noPlugins')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
