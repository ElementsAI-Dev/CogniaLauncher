import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { PluginToolRunner } from './plugin-tool-runner';
import type { PluginToolInfo } from '@/types/plugin';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (k: string) => k, locale: 'en' }),
}));

const mockCallTool = jest.fn().mockResolvedValue('{"result":"ok"}');
jest.mock('@/hooks/use-plugins', () => ({
  usePlugins: () => ({
    callTool: mockCallTool,
    getLocales: jest.fn().mockResolvedValue(null),
    translatePluginKey: jest.fn((_l: unknown, _lo: string, k: string) => k),
  }),
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

    expect(screen.getByText('common.cancel')).toBeInTheDocument();
    expect(screen.getByText('toolbox.plugin.running')).toBeInTheDocument();

    // Cancel
    await act(async () => {
      fireEvent.click(screen.getByText('common.cancel'));
    });

    expect(screen.queryByText('common.cancel')).not.toBeInTheDocument();
    expect(screen.getByText('toolbox.plugin.cancelled')).toBeInTheDocument();

    // Resolve to prevent unhandled promise
    resolveCall!('done');
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
