import { render, screen } from '@testing-library/react';
import { ToolDetailPanel } from './tool-detail-panel';
import type { UnifiedTool } from '@/hooks/use-toolbox';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'toolbox.plugin.external': 'Plugin',
        'toolbox.actions.openFullPage': 'Open Full Page',
        'toolbox.search.noResults': 'No results',
        'toolbox.errorBoundary.title': 'Error',
        'toolbox.errorBoundary.description': 'Something went wrong',
        'toolbox.errorBoundary.retry': 'Retry',
      };
      return map[key] || key;
    },
  }),
}));

jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

jest.mock('@/components/toolbox/plugin-tool-runner', () => ({
  PluginToolRunner: () => <div data-testid="plugin-tool-runner" />,
}));

jest.mock('@/components/toolbox/built-in-tool-renderer', () => ({
  BuiltInToolRenderer: ({ builtInId }: { builtInId: string }) => (
    <div data-testid={`built-in-renderer-${builtInId}`} />
  ),
}));

const mockTool: UnifiedTool = {
  id: 'builtin:json-formatter',
  name: 'JSON Formatter',
  description: 'Format JSON data',
  icon: 'Braces',
  category: 'formatters',
  keywords: ['json'],
  isBuiltIn: true,
  isNew: false,
  isBeta: false,
  builtInDef: {
    id: 'json-formatter',
    nameKey: 'toolbox.tools.jsonFormatter.name',
    descriptionKey: 'toolbox.tools.jsonFormatter.desc',
    icon: 'Braces',
    category: 'formatters',
    keywords: ['json'],
    component: () => Promise.resolve({ default: () => null }),
    isNew: false,
  },
};

describe('ToolDetailPanel', () => {
  it('renders nothing visible when tool is null', () => {
    render(<ToolDetailPanel tool={null} open={false} onOpenChange={jest.fn()} />);
    expect(screen.queryByText('JSON Formatter')).not.toBeInTheDocument();
  });

  it('renders tool name when open with a tool', () => {
    render(<ToolDetailPanel tool={mockTool} open={true} onOpenChange={jest.fn()} />);
    expect(screen.getByText('JSON Formatter')).toBeInTheDocument();
  });

  it('renders tool description', () => {
    render(<ToolDetailPanel tool={mockTool} open={true} onOpenChange={jest.fn()} />);
    expect(screen.getByText('Format JSON data')).toBeInTheDocument();
  });

  it('renders Open Full Page link', () => {
    render(<ToolDetailPanel tool={mockTool} open={true} onOpenChange={jest.fn()} />);
    expect(screen.getByText('Open Full Page')).toBeInTheDocument();
  });

  it('routes Open Full Page action to canonical tool detail path', () => {
    render(<ToolDetailPanel tool={mockTool} open={true} onOpenChange={jest.fn()} />);
    expect(screen.getByRole('link', { name: 'Open Full Page' })).toHaveAttribute(
      'href',
      '/toolbox/tool?id=builtin%3Ajson-formatter',
    );
  });

  it('renders BuiltInToolRenderer for built-in tools', () => {
    render(<ToolDetailPanel tool={mockTool} open={true} onOpenChange={jest.fn()} />);
    expect(screen.getByTestId('built-in-renderer-json-formatter')).toBeInTheDocument();
  });

  it('does not show Plugin badge for built-in tools', () => {
    render(<ToolDetailPanel tool={mockTool} open={true} onOpenChange={jest.fn()} />);
    expect(screen.queryByText('Plugin')).not.toBeInTheDocument();
  });

  it('shows Plugin badge for plugin tools', () => {
    const pluginTool: UnifiedTool = {
      id: 'plugin:com.test:tool1',
      name: 'Plugin Tool',
      description: 'A plugin tool',
      icon: 'Plug',
      category: 'developer',
      keywords: [],
      isBuiltIn: false,
      isNew: false,
      isBeta: false,
      pluginTool: {
        pluginId: 'com.test',
        pluginName: 'Test Plugin',
        toolId: 'tool1',
        nameEn: 'Plugin Tool',
        nameZh: null,
        descriptionEn: 'A plugin tool',
        descriptionZh: null,
        category: 'developer',
        keywords: [],
        icon: 'Plug',
        entry: 'run',
        uiMode: 'text',
      },
    };
    render(<ToolDetailPanel tool={pluginTool} open={true} onOpenChange={jest.fn()} />);
    expect(screen.getByText('Plugin')).toBeInTheDocument();
  });

  it('renders dedicated header, actions, and body regions', () => {
    render(<ToolDetailPanel tool={mockTool} open={true} onOpenChange={jest.fn()} />);
    expect(screen.getByTestId('tool-detail-panel-header')).toBeInTheDocument();
    expect(screen.getByTestId('tool-detail-panel-actions')).toBeInTheDocument();
    expect(screen.getByTestId('tool-detail-panel-body')).toBeInTheDocument();
  });

  it('uses bounded responsive width classes for the side panel', () => {
    render(<ToolDetailPanel tool={mockTool} open={true} onOpenChange={jest.fn()} />);
    expect(screen.getByTestId('tool-detail-panel-content')).toHaveClass('w-[min(94vw,980px)]');
    expect(screen.getByTestId('tool-detail-panel-content')).toHaveClass('sm:w-[min(88vw,980px)]');
    expect(screen.getByTestId('tool-detail-panel-content')).toHaveClass('md:w-[min(82vw,980px)]');
  });

  it('renders as a right-side panel instead of a centered modal', () => {
    render(<ToolDetailPanel tool={mockTool} open={true} onOpenChange={jest.fn()} />);
    const panel = screen.getByTestId('tool-detail-panel-content');
    expect(panel).toHaveClass('inset-y-0');
    expect(panel).toHaveClass('right-0');
    expect(panel.className).not.toContain('top-[50%]');
  });

  it('keeps the tool body scrollable for long content', () => {
    render(<ToolDetailPanel tool={mockTool} open={true} onOpenChange={jest.fn()} />);
    expect(screen.getByTestId('tool-detail-panel-body')).toHaveClass('overflow-y-auto');
  });
});
