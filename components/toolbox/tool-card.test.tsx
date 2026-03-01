import { render, screen, fireEvent } from '@testing-library/react';
import { ToolCard } from './tool-card';
import type { UnifiedTool } from '@/hooks/use-toolbox';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'toolbox.badges.new': 'New',
        'toolbox.badges.beta': 'Beta',
        'toolbox.actions.favorite': 'Favorite',
        'toolbox.actions.unfavorite': 'Unfavorite',
        'toolbox.plugin.external': 'Plugin',
      };
      return map[key] || key;
    },
  }),
}));

jest.mock('@/lib/constants/toolbox', () => ({
  getCategoryMeta: (id: string) => ({
    id,
    nameKey: `toolbox.categories.${id}`,
    descriptionKey: '',
    icon: 'Code',
    color: 'bg-blue-500/10 text-blue-600',
  }),
}));

jest.mock('@/components/ui/dynamic-icon', () => ({
  DynamicIcon: ({ name, className }: { name: string; className?: string }) => (
    <span data-testid={`icon-${name}`} className={className} />
  ),
}));

const mockTool: UnifiedTool = {
  id: 'builtin:json-formatter',
  name: 'JSON Formatter',
  description: 'Format and validate JSON data',
  icon: 'Braces',
  category: 'formatters',
  keywords: ['json', 'format'],
  isBuiltIn: true,
  isNew: false,
  isBeta: false,
};

const mockPluginTool: UnifiedTool = {
  id: 'plugin:com.test:tool1',
  name: 'Test Plugin Tool',
  description: 'A plugin-provided tool',
  icon: 'Plug',
  category: 'developer',
  keywords: ['test'],
  isBuiltIn: false,
  isNew: false,
  isBeta: false,
};

describe('ToolCard', () => {
  const defaultProps = {
    tool: mockTool,
    isFavorite: false,
    onToggleFavorite: jest.fn(),
    onOpen: jest.fn(),
    viewMode: 'grid' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders tool name and description in grid mode', () => {
    render(<ToolCard {...defaultProps} />);
    expect(screen.getByText('JSON Formatter')).toBeInTheDocument();
    expect(screen.getByText('Format and validate JSON data')).toBeInTheDocument();
  });

  it('renders tool name and description in list mode', () => {
    render(<ToolCard {...defaultProps} viewMode="list" />);
    expect(screen.getByText('JSON Formatter')).toBeInTheDocument();
    expect(screen.getByText('Format and validate JSON data')).toBeInTheDocument();
  });

  it('calls onOpen when card is clicked', () => {
    render(<ToolCard {...defaultProps} />);
    const card = screen.getByText('JSON Formatter').closest('[class*="cursor-pointer"]');
    if (card) fireEvent.click(card);
    expect(defaultProps.onOpen).toHaveBeenCalledWith('builtin:json-formatter');
  });

  it('calls onToggleFavorite when favorite button is clicked', () => {
    render(<ToolCard {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const favButton = buttons.find((b) => b.querySelector('svg'));
    if (favButton) {
      fireEvent.click(favButton);
      expect(defaultProps.onToggleFavorite).toHaveBeenCalledWith('builtin:json-formatter');
    }
  });

  it('shows plugin badge for non-built-in tools in grid mode', () => {
    render(<ToolCard {...defaultProps} tool={mockPluginTool} />);
    expect(screen.getByText('Plugin')).toBeInTheDocument();
  });

  it('does not show plugin badge for built-in tools', () => {
    render(<ToolCard {...defaultProps} />);
    expect(screen.queryByText('Plugin')).not.toBeInTheDocument();
  });

  it('renders icon via DynamicIcon', () => {
    render(<ToolCard {...defaultProps} />);
    expect(screen.getByTestId('icon-Braces')).toBeInTheDocument();
  });

  it('shows useCount badge when useCount > 0 in grid mode', () => {
    render(<ToolCard {...defaultProps} useCount={5} />);
    expect(screen.getByText('5×')).toBeInTheDocument();
  });

  it('does not show useCount badge when useCount is 0', () => {
    render(<ToolCard {...defaultProps} useCount={0} />);
    expect(screen.queryByText('0×')).not.toBeInTheDocument();
  });

  it('does not show useCount badge by default', () => {
    render(<ToolCard {...defaultProps} />);
    expect(screen.queryByText(/^\d+×$/)).not.toBeInTheDocument();
  });
});
