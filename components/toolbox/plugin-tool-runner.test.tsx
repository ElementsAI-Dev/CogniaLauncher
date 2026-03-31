import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { PluginToolRunner } from './plugin-tool-runner';
import type { PluginToolInfo } from '@/types/plugin';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (k: string) => k, locale: 'en' }),
}));

const mockCallTool = jest.fn().mockResolvedValue('{"result":"ok"}');
const mockCancelTool = jest.fn().mockResolvedValue(true);
const mockUseToolProgress = jest.fn(() => ({
  phase: null,
  progress: null,
  message: null,
  error: null,
}));
jest.mock('@/hooks/plugins/use-plugins', () => ({
  usePlugins: () => ({
    callTool: mockCallTool,
    cancelTool: mockCancelTool,
    getLocales: jest.fn().mockResolvedValue(null),
    translatePluginKey: jest.fn((_l: unknown, _lo: string, k: string) => k),
  }),
}));
jest.mock('@/hooks/toolbox/use-tool-progress', () => ({
  useToolProgress: (...args: Parameters<typeof mockUseToolProgress>) => mockUseToolProgress(...args),
}));

const mockIsTauri = jest.fn(() => true);
jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  pluginGetUiEntry: jest.fn().mockRejectedValue(new Error('Not desktop')),
}));

jest.mock('@/lib/clipboard', () => ({
  writeClipboard: jest.fn(),
  readClipboard: jest.fn().mockResolvedValue(''),
}));

jest.mock('@/components/plugin/plugin-ui-renderer', () => ({
  PluginUiRenderer: ({
    blocks,
    onAction,
    state,
  }: {
    blocks: unknown[];
    onAction: (action: Record<string, unknown>) => void;
    state?: Record<string, unknown>;
  }) => (
    <div data-testid="plugin-ui-renderer">
      blocks: {blocks.length}
      <button
        type="button"
        onClick={() => onAction({ action: 'button_click', buttonId: 'mock-button', state })}
      >
        trigger-action
      </button>
    </div>
  ),
}));

jest.mock('@/components/plugin/plugin-iframe-view', () => ({
  PluginIframeView: ({ pluginId }: { pluginId: string }) => (
    <div data-testid="plugin-iframe-view">iframe: {pluginId}</div>
  ),
}));

jest.mock('@/components/docs/markdown-renderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="markdown-renderer">{content}</div>
  ),
}));

const baseTool: PluginToolInfo = {
  pluginId: 'com.example.test',
  pluginName: 'Test Plugin',
  toolId: 'tool-1',
  nameEn: 'Test Tool',
  nameZh: null,
  descriptionEn: 'A test tool',
  descriptionZh: null,
  category: 'developer',
  keywords: ['test'],
  icon: 'Wrench',
  entry: 'test_fn',
  uiMode: 'text',
};

describe('PluginToolRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockUseToolProgress.mockReturnValue({
      phase: null,
      progress: null,
      message: null,
      error: null,
    });
  });

  it('shows explicit empty fallback when text mode returns empty output', async () => {
    mockCallTool.mockResolvedValueOnce('');

    render(<PluginToolRunner tool={baseTool} />);

    await act(async () => {
      fireEvent.click(screen.getByText('toolbox.plugin.run'));
    });

    await waitFor(() => {
      expect(screen.getByText('toolbox.runtime.emptyDescription')).toBeInTheDocument();
    });
  });

  // --- Desktop-only guard ---

  it('shows desktop-required fallback when not in Tauri', () => {
    mockIsTauri.mockReturnValue(false);
    render(<PluginToolRunner tool={baseTool} />);
    expect(screen.getByText('toolbox.runtime.desktopRequiredDescription')).toBeInTheDocument();
    expect(screen.queryByText('toolbox.plugin.run')).not.toBeInTheDocument();
  });

  // --- Mode selection ---

  it('renders text mode by default', () => {
    render(<PluginToolRunner tool={baseTool} />);
    expect(screen.getByText('toolbox.plugin.providedBy Test Plugin')).toBeInTheDocument();
    expect(screen.getByText('toolbox.plugin.run')).toBeInTheDocument();
  });

  it('renders plugin point badge when metadata is available', () => {
    render(<PluginToolRunner tool={{ ...baseTool, pluginPointId: 'tool-text' }} />);
    expect(screen.getByText('tool-text')).toBeInTheDocument();
  });

  it('shows capability readiness feedback when sdk coverage is blocked', () => {
    render(
      <PluginToolRunner
        tool={{
          ...baseTool,
          sdkCapabilityCoverage: [
            {
              capabilityId: 'process',
              permissionGuidance: ['process_exec'],
              hostPrerequisites: ['desktop-host'],
              usagePaths: [],
              requiredPermissions: ['process_exec'],
              recoveryActions: ['manage-plugin'],
              desktopOnly: true,
              status: 'blocked',
              reason: 'Missing permissions: process_exec',
              missingPermissions: ['process_exec'],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Missing permissions: process_exec')).toBeInTheDocument();
  });

  it('renders text mode when uiMode is "text"', () => {
    const tool = { ...baseTool, uiMode: 'text' };
    render(<PluginToolRunner tool={tool} />);
    expect(screen.getByText('toolbox.plugin.run')).toBeInTheDocument();
  });

  it('renders text mode when uiMode is empty string', () => {
    const tool = { ...baseTool, uiMode: '' };
    render(<PluginToolRunner tool={tool} />);
    expect(screen.getByText('toolbox.plugin.run')).toBeInTheDocument();
  });

  it('renders declarative mode', () => {
    const tool = { ...baseTool, uiMode: 'declarative' };
    render(<PluginToolRunner tool={tool} />);
    expect(screen.getByText('toolbox.plugin.uiModeDeclarative')).toBeInTheDocument();
  });

  it('normalizes declarative action payload before calling plugin runtime', async () => {
    mockCallTool
      .mockResolvedValueOnce(JSON.stringify({ ui: [{ type: 'text', content: 'hello' }] }))
      .mockResolvedValueOnce(JSON.stringify({ ui: [{ type: 'text', content: 'after-action' }] }));

    const tool = { ...baseTool, uiMode: 'declarative' };
    render(<PluginToolRunner tool={tool} />);

    await waitFor(() => {
      expect(screen.getByTestId('plugin-ui-renderer')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('trigger-action'));
    });

    await waitFor(() => {
      expect(mockCallTool).toHaveBeenCalledTimes(2);
    });

    const payload = JSON.parse(String(mockCallTool.mock.calls[1][2]));
    expect(payload.action).toBe('button_click');
    expect(payload.buttonId).toBe('mock-button');
    expect(payload.version).toBe(2);
    expect(payload.sourceType).toBe('declarative');
    expect(payload.sourceId).toBe(baseTool.toolId);
    expect(payload.correlationId).toEqual(expect.any(String));
    expect(payload.runtimeContext).toEqual(
      expect.objectContaining({
        toolId: baseTool.toolId,
        pluginId: baseTool.pluginId,
        uiMode: 'declarative',
      }),
    );
  });

  it('merges multi-channel declarative output into renderer blocks', async () => {
    mockCallTool.mockResolvedValueOnce(
      JSON.stringify({
        ui: [{ type: 'text', content: 'base' }],
        outputChannels: {
          structured: [{ type: 'result', message: 'ok', status: 'success' }],
          stream: [{ level: 'info', message: 'working' }],
          artifacts: [{ id: 'report', label: 'Report', href: 'https://example.com' }],
        },
      }),
    );

    const tool = { ...baseTool, uiMode: 'declarative' };
    render(<PluginToolRunner tool={tool} />);

    await waitFor(() => {
      expect(screen.getByTestId('plugin-ui-renderer')).toHaveTextContent('blocks: 4');
    });
  });

  it('shows declarative action error and keeps panel responsive', async () => {
    mockCallTool
      .mockResolvedValueOnce(JSON.stringify({ ui: [{ type: 'text', content: 'hello' }] }))
      .mockRejectedValueOnce(new Error('Action execution failed'));

    const tool = { ...baseTool, uiMode: 'declarative' };
    render(<PluginToolRunner tool={tool} />);

    await waitFor(() => {
      expect(screen.getByTestId('plugin-ui-renderer')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('trigger-action'));
    });

    await waitFor(() => {
      expect(screen.getByText('Action execution failed')).toBeInTheDocument();
    });

    expect(screen.getByTestId('plugin-ui-renderer')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-ui-renderer')).toHaveTextContent('blocks: 1');
  });

  it('renders iframe mode', () => {
    const tool = { ...baseTool, uiMode: 'iframe' };
    render(<PluginToolRunner tool={tool} />);
    expect(screen.getByText('toolbox.plugin.uiModeIframe')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-iframe-view')).toBeInTheDocument();
  });

  // --- Badge display ---

  it('shows plugin name badge in text mode', () => {
    render(<PluginToolRunner tool={baseTool} />);
    expect(screen.getByText('toolbox.plugin.providedBy Test Plugin')).toBeInTheDocument();
  });

  it('shows plugin name badge in declarative mode', () => {
    const tool = { ...baseTool, uiMode: 'declarative' };
    render(<PluginToolRunner tool={tool} />);
    expect(screen.getByText('toolbox.plugin.providedBy Test Plugin')).toBeInTheDocument();
  });

  it('shows plugin name badge in iframe mode', () => {
    const tool = { ...baseTool, uiMode: 'iframe' };
    render(<PluginToolRunner tool={tool} />);
    expect(screen.getByText('toolbox.plugin.providedBy Test Plugin')).toBeInTheDocument();
  });

  // --- Text mode specifics ---

  it('renders text input area in text mode', () => {
    render(<PluginToolRunner tool={baseTool} />);
    expect(screen.getByText('toolbox.plugin.input')).toBeInTheDocument();
  });

  it('does not render text areas in declarative mode', () => {
    const tool = { ...baseTool, uiMode: 'declarative' };
    render(<PluginToolRunner tool={tool} />);
    expect(screen.queryByText('toolbox.plugin.input')).not.toBeInTheDocument();
    expect(screen.queryByText('toolbox.plugin.run')).not.toBeInTheDocument();
  });

  it('does not render text areas in iframe mode', () => {
    const tool = { ...baseTool, uiMode: 'iframe' };
    render(<PluginToolRunner tool={tool} />);
    expect(screen.queryByText('toolbox.plugin.input')).not.toBeInTheDocument();
    expect(screen.queryByText('toolbox.plugin.run')).not.toBeInTheDocument();
  });

  // --- Run + cancel ---

  it('shows cancel button and elapsed time while running', async () => {
    let resolveCall: (v: string) => void;
    mockCallTool.mockReturnValue(new Promise<string>((r) => { resolveCall = r; }));

    render(<PluginToolRunner tool={baseTool} />);
    const runButton = screen.getByText('toolbox.plugin.run');

    await act(async () => {
      fireEvent.click(runButton);
    });

    expect(screen.getByRole('button', { name: 'common.cancel' })).toBeInTheDocument();
    expect(screen.getAllByText('toolbox.plugin.running').length).toBeGreaterThan(0);

    // Cancel
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    });

    expect(screen.queryByRole('button', { name: 'common.cancel' })).not.toBeInTheDocument();
    expect(screen.getAllByText('toolbox.plugin.cancelled').length).toBeGreaterThan(0);

    // Resolve to prevent unhandled promise
    resolveCall!('done');
  });

  it('renders runtime progress state when backend progress is active', () => {
    mockUseToolProgress.mockReturnValue({
      phase: 'running',
      progress: 25,
      message: 'working',
      error: null,
    });

    render(<PluginToolRunner tool={baseTool} />);

    expect(screen.getByText('working')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.cancel' })).toBeInTheDocument();
  });

  it('forwards cancel action through plugin cancellation bridge', async () => {
    let resolveCall: (value: string) => void;
    mockCallTool.mockReturnValue(new Promise<string>((resolve) => {
      resolveCall = resolve;
    }));

    render(<PluginToolRunner tool={baseTool} />);

    await act(async () => {
      fireEvent.click(screen.getByText('toolbox.plugin.run'));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    });

    expect(mockCancelTool).toHaveBeenCalled();
    resolveCall!('done');
  });

  it('renders structured runtime errors with retry affordance', () => {
    mockUseToolProgress.mockReturnValue({
      phase: 'failed',
      progress: null,
      message: 'permission blocked',
      error: {
        kind: 'permission_denied',
        message: 'permission blocked',
      },
    });

    render(<PluginToolRunner tool={baseTool} />);

    expect(screen.getByText('permission_denied')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.retry' })).toBeInTheDocument();
  });

  // --- Smart output ---

  it('renders JSON output with pretty-print', async () => {
    mockCallTool.mockResolvedValue('{"name":"test","value":42}');
    render(<PluginToolRunner tool={baseTool} />);

    await act(async () => {
      fireEvent.click(screen.getByText('toolbox.plugin.run'));
    });

    await waitFor(() => {
      expect(screen.getByText('toolbox.plugin.output')).toBeInTheDocument();
    });
  });

  it('renders markdown output when __type is markdown', async () => {
    mockCallTool.mockResolvedValue(JSON.stringify({ __type: 'markdown', content: '# Hello' }));
    render(<PluginToolRunner tool={baseTool} />);

    await act(async () => {
      fireEvent.click(screen.getByText('toolbox.plugin.run'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('markdown-renderer')).toBeInTheDocument();
      expect(screen.getByText('# Hello')).toBeInTheDocument();
    });
  });

  it('renders plain text output for non-JSON', async () => {
    mockCallTool.mockResolvedValue('hello world');
    render(<PluginToolRunner tool={baseTool} />);

    await act(async () => {
      fireEvent.click(screen.getByText('toolbox.plugin.run'));
    });

    await waitFor(() => {
      expect(screen.getByText('toolbox.plugin.output')).toBeInTheDocument();
    });
  });

  // --- Error display ---

  it('shows error alert on tool failure', async () => {
    mockCallTool.mockRejectedValue(new Error('WASM crashed'));
    render(<PluginToolRunner tool={baseTool} />);

    await act(async () => {
      fireEvent.click(screen.getByText('toolbox.plugin.run'));
    });

    await waitFor(() => {
      expect(screen.getByText('WASM crashed')).toBeInTheDocument();
    });
  });
});
