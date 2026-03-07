'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ToolTextArea } from '@/components/toolbox/tool-layout';
import { PluginUiRenderer } from '@/components/plugin/plugin-ui-renderer';
import { PluginIframeView } from '@/components/plugin/plugin-iframe-view';
import { MarkdownRenderer } from '@/components/docs/markdown-renderer';
import { useLocale } from '@/components/providers/locale-provider';
import { usePlugins } from '@/hooks/use-plugins';
import { useToolboxStore } from '@/lib/stores/toolbox';
import { Play, AlertCircle, Loader2 } from 'lucide-react';
import { isTauri } from '@/lib/tauri';
import type { PluginToolInfo } from '@/types/plugin';
import type { UiBlock, PluginUiResponse, PluginUiAction } from '@/types/plugin-ui';

interface PluginToolRunnerProps {
  tool: PluginToolInfo;
  className?: string;
}

function toPluginUnifiedToolId(tool: PluginToolInfo): string {
  return `plugin:${tool.pluginId}:${tool.toolId}`;
}

export function PluginToolRunner({ tool, className }: PluginToolRunnerProps) {
  const { t } = useLocale();

  if (!isTauri()) {
    return (
      <Alert className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{t('toolbox.plugin.desktopOnly')}</AlertDescription>
      </Alert>
    );
  }

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
  const setToolLifecycle = useToolboxStore((state) => state.setToolLifecycle);
  const clearToolLifecycle = useToolboxStore((state) => state.clearToolLifecycle);
  const unifiedToolId = toPluginUnifiedToolId(tool);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const cancelledRef = useRef(false);
  const runIdRef = useRef(0);

  useEffect(() => {
    setToolLifecycle(unifiedToolId, 'idle');
    return () => clearToolLifecycle(unifiedToolId);
  }, [unifiedToolId, setToolLifecycle, clearToolLifecycle]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsedMs((v) => v + 100), 100);
    return () => clearInterval(id);
  }, [running]);

  const handleRun = useCallback(async () => {
    const currentRunId = ++runIdRef.current;
    cancelledRef.current = false;
    setToolLifecycle(unifiedToolId, 'prepare');
    setToolLifecycle(unifiedToolId, 'validate');
    setRunning(true);
    setError(null);
    setOutput('');
    setElapsedMs(0);
    try {
      setToolLifecycle(unifiedToolId, 'execute');
      const result = await callTool(tool.pluginId, tool.entry, input);
      if (!cancelledRef.current && runIdRef.current === currentRunId) {
        setToolLifecycle(unifiedToolId, 'postProcess');
        setOutput(result ?? '');
        setToolLifecycle(unifiedToolId, 'success');
      }
    } catch (e) {
      if (!cancelledRef.current && runIdRef.current === currentRunId) {
        const message = (e as Error).message ?? String(e);
        setError(message);
        setToolLifecycle(unifiedToolId, 'failure', message);
      }
    } finally {
      if (runIdRef.current === currentRunId) {
        setRunning(false);
      }
    }
  }, [callTool, tool.pluginId, tool.entry, input, setToolLifecycle, unifiedToolId]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    setRunning(false);
    setError(t('toolbox.plugin.cancelled'));
    setToolLifecycle(unifiedToolId, 'failure', t('toolbox.plugin.cancelled'));
  }, [t, setToolLifecycle, unifiedToolId]);

  const elapsedDisplay = running ? `${(elapsedMs / 1000).toFixed(1)}s` : null;

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

        <div className="flex items-center gap-2">
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
          {running && (
            <>
              <Button onClick={handleCancel} size="sm" variant="outline" className="gap-1.5">
                {t('common.cancel')}
              </Button>
              {elapsedDisplay && (
                <span className="text-xs text-muted-foreground font-mono">{elapsedDisplay}</span>
              )}
            </>
          )}
        </div>

        {output && <SmartOutput output={output} label={t('toolbox.plugin.output')} />}
      </div>
    </div>
  );
}

function SmartOutput({ output, label }: { output: string; label: string }) {
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(output);
  } catch {
    // not JSON — render as plain text
  }

  if (parsed && typeof parsed === 'object' && parsed.__type === 'markdown' && typeof parsed.content === 'string') {
    return (
      <div className="space-y-2">
        <span className="text-sm font-medium">{label}</span>
        <div className="rounded-md border p-4">
          <MarkdownRenderer content={parsed.content as string} className="prose-sm max-w-none" />
        </div>
      </div>
    );
  }

  if (parsed && typeof parsed === 'object') {
    const prettyJson = JSON.stringify(parsed, null, 2);
    return (
      <ToolTextArea
        label={label}
        value={prettyJson}
        readOnly
        rows={Math.min(20, prettyJson.split('\n').length + 1)}
        language="json"
      />
    );
  }

  return (
    <ToolTextArea
      label={label}
      value={output}
      readOnly
      rows={8}
    />
  );
}

function normalizeDeclarativeAction(
  action: PluginUiAction,
  toolId: string,
  pluginId: string,
): PluginUiAction {
  const correlationId = action.correlationId
    ?? (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  return {
    ...action,
    version: action.version ?? 2,
    sourceType: action.sourceType ?? 'declarative',
    sourceId: action.sourceId ?? toolId,
    correlationId,
    runtimeContext: {
      toolId,
      pluginId,
      uiMode: 'declarative',
      ...(action.runtimeContext ?? {}),
    },
  };
}

function normalizeDeclarativeResponse(parsed: PluginUiResponse): {
  blocks: UiBlock[];
  state?: Record<string, unknown>;
} {
  const outputChannels = parsed.outputChannels;
  const baseBlocks = Array.isArray(parsed.ui) ? parsed.ui : [];
  const structuredBlocks = Array.isArray(outputChannels?.structured)
    ? outputChannels.structured
    : [];
  const streamEntries = Array.isArray(outputChannels?.stream)
    ? outputChannels.stream
    : Array.isArray(parsed.stream)
      ? parsed.stream
      : [];
  const artifactActions = Array.isArray(outputChannels?.artifacts)
    ? outputChannels.artifacts
    : Array.isArray(parsed.artifacts)
      ? parsed.artifacts
      : [];

  const blocks: UiBlock[] = [...baseBlocks, ...structuredBlocks];

  if (outputChannels?.summary) {
    if (typeof outputChannels.summary === 'string') {
      blocks.push({ type: 'result', message: outputChannels.summary });
    } else {
      blocks.push({
        type: 'result',
        title: outputChannels.summary.title,
        message: outputChannels.summary.message,
        details: outputChannels.summary.details,
        status: outputChannels.summary.status,
      });
    }
  }

  if (streamEntries.length > 0) {
    blocks.push({ type: 'log-stream', entries: streamEntries });
  }

  if (artifactActions.length > 0) {
    blocks.push({ type: 'artifact-actions', artifacts: artifactActions });
  }

  return {
    blocks,
    state: parsed.state,
  };
}

// ============================================================================
// Declarative Mode (JSON UI blocks)
// ============================================================================

function DeclarativeToolRunner({ tool, className }: PluginToolRunnerProps) {
  const { t } = useLocale();
  const { callTool } = usePlugins();
  const setToolLifecycle = useToolboxStore((state) => state.setToolLifecycle);
  const clearToolLifecycle = useToolboxStore((state) => state.clearToolLifecycle);
  const unifiedToolId = toPluginUnifiedToolId(tool);
  const [blocks, setBlocks] = useState<UiBlock[]>([]);
  const [uiState, setUiState] = useState<Record<string, unknown> | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Initial render: call WASM with empty input to get initial UI
  const loadInitialUi = useCallback(async () => {
    setToolLifecycle(unifiedToolId, 'prepare');
    try {
      setToolLifecycle(unifiedToolId, 'execute');
      const result = await callTool(tool.pluginId, tool.entry, '');
      const parsed: PluginUiResponse = JSON.parse(result ?? '{}');
      const normalized = normalizeDeclarativeResponse(parsed);
      setToolLifecycle(unifiedToolId, 'postProcess');
      setBlocks(normalized.blocks);
      setUiState(normalized.state);
      setError(null);
      setToolLifecycle(unifiedToolId, 'success');
    } catch (e) {
      const message = (e as Error).message ?? String(e);
      setError(message);
      setToolLifecycle(unifiedToolId, 'failure', message);
    } finally {
      setLoading(false);
    }
  }, [callTool, tool.pluginId, tool.entry, setToolLifecycle, unifiedToolId]);

  // Load on mount
  useEffect(() => {
    setToolLifecycle(unifiedToolId, 'idle');
    loadInitialUi();
    return () => clearToolLifecycle(unifiedToolId);
  }, [loadInitialUi, unifiedToolId, setToolLifecycle, clearToolLifecycle]);

  // Handle actions from UI blocks (button clicks, form submissions)
  const handleAction = useCallback(
    async (action: PluginUiAction) => {
      setProcessing(true);
      try {
        setToolLifecycle(unifiedToolId, 'validate');
        const normalized = normalizeDeclarativeAction(
          action,
          tool.toolId,
          tool.pluginId,
        );
        setToolLifecycle(unifiedToolId, 'execute');
        const result = await callTool(
          tool.pluginId,
          tool.entry,
          JSON.stringify(normalized),
        );
        const parsed: PluginUiResponse = JSON.parse(result ?? '{}');
        const response = normalizeDeclarativeResponse(parsed);
        setToolLifecycle(unifiedToolId, 'postProcess');
        setBlocks(response.blocks);
        setUiState(response.state);
        setError(null);
        setToolLifecycle(unifiedToolId, 'success');
      } catch (e) {
        const message = (e as Error).message ?? String(e);
        setError(message);
        setToolLifecycle(unifiedToolId, 'failure', message);
      } finally {
        setProcessing(false);
      }
    },
    [callTool, tool.pluginId, tool.entry, tool.toolId, setToolLifecycle, unifiedToolId],
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
  const setToolLifecycle = useToolboxStore((state) => state.setToolLifecycle);
  const clearToolLifecycle = useToolboxStore((state) => state.clearToolLifecycle);
  const unifiedToolId = toPluginUnifiedToolId(tool);

  useEffect(() => {
    setToolLifecycle(unifiedToolId, 'prepare');
    setToolLifecycle(unifiedToolId, 'success');
    return () => clearToolLifecycle(unifiedToolId);
  }, [unifiedToolId, setToolLifecycle, clearToolLifecycle]);

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
