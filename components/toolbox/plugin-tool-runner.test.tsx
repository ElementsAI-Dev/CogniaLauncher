import { render, screen } from '@testing-library/react';
import { PluginToolRunner } from './plugin-tool-runner';
import type { PluginToolInfo } from '@/types/plugin';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (k: string) => k, locale: 'en' }),
}));

jest.mock('@/hooks/use-plugins', () => ({
  usePlugins: () => ({
    callTool: jest.fn().mockResolvedValue('{"result":"ok"}'),
    getLocales: jest.fn().mockResolvedValue(null),
    translatePluginKey: jest.fn((_l: unknown, _lo: string, k: string) => k),
  }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => false,
  pluginGetUiEntry: jest.fn().mockRejectedValue(new Error('Not desktop')),
}));

jest.mock('@/lib/clipboard', () => ({
  writeClipboard: jest.fn(),
  readClipboard: jest.fn().mockResolvedValue(''),
}));

jest.mock('@/components/plugin/plugin-ui-renderer', () => ({
  PluginUiRenderer: ({ blocks }: { blocks: unknown[] }) => (
    <div data-testid="plugin-ui-renderer">blocks: {blocks.length}</div>
  ),
}));

jest.mock('@/components/plugin/plugin-iframe-view', () => ({
  PluginIframeView: ({ pluginId }: { pluginId: string }) => (
    <div data-testid="plugin-iframe-view">iframe: {pluginId}</div>
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
  });

  it('renders text mode by default', () => {
    render(<PluginToolRunner tool={baseTool} />);
    expect(screen.getByText('toolbox.plugin.providedBy Test Plugin')).toBeInTheDocument();
    expect(screen.getByText('toolbox.plugin.run')).toBeInTheDocument();
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

  it('renders iframe mode', () => {
    const tool = { ...baseTool, uiMode: 'iframe' };
    render(<PluginToolRunner tool={tool} />);
    expect(screen.getByText('toolbox.plugin.uiModeIframe')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-iframe-view')).toBeInTheDocument();
  });

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

  it('renders text input and output areas in text mode', () => {
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
});
