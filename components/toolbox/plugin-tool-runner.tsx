'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ToolTextArea } from '@/components/toolbox/tool-layout';
import { PluginUiRenderer } from '@/components/plugin/plugin-ui-renderer';
import { PluginIframeView } from '@/components/plugin/plugin-iframe-view';
import { useLocale } from '@/components/providers/locale-provider';
import { usePlugins } from '@/hooks/use-plugins';
import { Play, AlertCircle, Loader2 } from 'lucide-react';
import type { PluginToolInfo } from '@/types/plugin';
import type { UiBlock, PluginUiResponse, PluginUiAction } from '@/types/plugin-ui';

interface PluginToolRunnerProps {
  tool: PluginToolInfo;
  className?: string;
}

export function PluginToolRunner({ tool, className }: PluginToolRunnerProps) {
  const uiMode = tool.uiMode || 'text';

  if (uiMode === 'iframe') {
    return <IframeToolRunner tool={tool} className={className} />;
  }

  if (uiMode === 'declarative') {
    return <DeclarativeToolRunner tool={tool} className={className} />;
  }

  return <TextToolRunner tool={tool} className={className} />;
}

// ============================================================================
// Text Mode (original behavior)
// ============================================================================

function TextToolRunner({ tool, className }: PluginToolRunnerProps) {
  const { t } = useLocale();
  const { callTool } = usePlugins();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setError(null);
    setOutput('');
    try {
      const result = await callTool(tool.pluginId, tool.entry, input);
      setOutput(result ?? '');
    } catch (e) {
      setError((e as Error).message ?? String(e));
    } finally {
      setRunning(false);
    }
  }, [callTool, tool.pluginId, tool.entry, input]);

  return (
    <div className={className}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">
            {t('toolbox.plugin.providedBy')} {tool.pluginName}
          </Badge>
        </div>

        <ToolTextArea
          label={t('toolbox.plugin.input')}
          value={input}
          onChange={setInput}
          placeholder={t('toolbox.plugin.inputPlaceholder')}
          showPaste
          showClear
          rows={8}
        />

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleRun}
          size="sm"
          disabled={running}
          className="gap-1.5"
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {running ? t('toolbox.plugin.running') : t('toolbox.plugin.run')}
        </Button>

        {output && (
          <ToolTextArea
            label={t('toolbox.plugin.output')}
            value={output}
            readOnly
            rows={8}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Declarative Mode (JSON UI blocks)
// ============================================================================

function DeclarativeToolRunner({ tool, className }: PluginToolRunnerProps) {
  const { t } = useLocale();
  const { callTool } = usePlugins();
  const [blocks, setBlocks] = useState<UiBlock[]>([]);
  const [uiState, setUiState] = useState<Record<string, unknown> | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Initial render: call WASM with empty input to get initial UI
  const loadInitialUi = useCallback(async () => {
    try {
      const result = await callTool(tool.pluginId, tool.entry, '');
      const parsed: PluginUiResponse = JSON.parse(result ?? '{}');
      setBlocks(parsed.ui ?? []);
      setUiState(parsed.state);
      setError(null);
    } catch (e) {
      setError((e as Error).message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [callTool, tool.pluginId, tool.entry]);

  // Load on mount
  useState(() => {
    loadInitialUi();
  });

  // Handle actions from UI blocks (button clicks, form submissions)
  const handleAction = useCallback(
    async (action: PluginUiAction) => {
      setProcessing(true);
      try {
        const result = await callTool(
          tool.pluginId,
          tool.entry,
          JSON.stringify(action),
        );
        const parsed: PluginUiResponse = JSON.parse(result ?? '{}');
        if (parsed.ui) {
          setBlocks(parsed.ui);
          setUiState(parsed.state);
        }
        setError(null);
      } catch (e) {
        setError((e as Error).message ?? String(e));
      } finally {
        setProcessing(false);
      }
    },
    [callTool, tool.pluginId, tool.entry],
  );

  return (
    <div className={className}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">
            {t('toolbox.plugin.providedBy')} {tool.pluginName}
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            {t('toolbox.plugin.uiModeDeclarative')}
          </Badge>
          {processing && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-8 w-32" />
          </div>
        ) : blocks.length > 0 ? (
          <PluginUiRenderer
            blocks={blocks}
            onAction={handleAction}
            state={uiState}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('toolbox.plugin.noUiBlocks')}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// iframe Mode (custom HTML)
// ============================================================================

function IframeToolRunner({ tool, className }: PluginToolRunnerProps) {
  const { t } = useLocale();

  return (
    <div className={className}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">
            {t('toolbox.plugin.providedBy')} {tool.pluginName}
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            {t('toolbox.plugin.uiModeIframe')}
          </Badge>
        </div>

        <PluginIframeView
          pluginId={tool.pluginId}
          toolEntry={tool.entry}
        />
      </div>
    </div>
  );
}
