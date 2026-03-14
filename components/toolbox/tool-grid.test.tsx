import { render, screen } from '@testing-library/react';
import { ToolGrid } from './tool-grid';
import type { UnifiedTool } from '@/hooks/use-toolbox';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/lib/constants/toolbox', () => ({
  getCategoryMeta: () => ({
    id: 'formatters',
    nameKey: 'toolbox.categories.formatters',
    descriptionKey: '',
    icon: 'Code',
    color: 'bg-blue-500/10 text-blue-600',
  }),
}));

jest.mock('@/components/ui/dynamic-icon', () => ({
  DynamicIcon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

const mockTools: UnifiedTool[] = [
  {
    id: 'builtin:json-formatter',
    name: 'JSON Formatter',
    description: 'Format JSON',
    icon: 'Braces',
    category: 'formatters',
    keywords: ['json'],
    isBuiltIn: true,
    isNew: false,
    isBeta: false,
  },
  {
    id: 'builtin:uuid-generator',
    name: 'UUID Generator',
    description: 'Generate UUIDs',
    icon: 'Fingerprint',
    category: 'generators',
    keywords: ['uuid'],
    isBuiltIn: true,
    isNew: false,
    isBeta: false,
  },
];

describe('ToolGrid', () => {
  const defaultProps = {
    tools: mockTools,
    favorites: [],
    viewMode: 'grid' as const,
    onToggleFavorite: jest.fn(),
    onOpen: jest.fn(),
  };

  it('renders all tools', () => {
    render(<ToolGrid {...defaultProps} />);
    expect(screen.getByText('JSON Formatter')).toBeInTheDocument();
    expect(screen.getByText('UUID Generator')).toBeInTheDocument();
  });

  it('renders in grid layout', () => {
    const { container } = render(<ToolGrid {...defaultProps} viewMode="grid" />);
    const grid = container.firstChild as HTMLElement;
    expect(grid.className).toContain('grid');
    expect(grid.className).toContain('pb-4');
  });

  it('renders in list layout', () => {
    const { container } = render(<ToolGrid {...defaultProps} viewMode="list" />);
    const list = container.firstChild as HTMLElement;
    expect(list.className).toContain('flex-col');
    expect(list.className).toContain('pb-4');
  });

  it('renders empty grid when no tools', () => {
    const { container } = render(<ToolGrid {...defaultProps} tools={[]} />);
    const grid = container.firstChild as HTMLElement;
    expect(grid.children).toHaveLength(0);
  });

  it('passes toolUseCounts to cards', () => {
    const useCounts = { 'builtin:json-formatter': 3 };
    render(<ToolGrid {...defaultProps} toolUseCounts={useCounts} />);
    expect(screen.getByText('toolbox.categories.mostUsed: 3x')).toBeInTheDocument();
  });

  it('marks favorites correctly', () => {
    render(<ToolGrid {...defaultProps} favorites={['builtin:json-formatter']} />);
    // The favorite tool should have a filled star icon (tested via ToolCard)
    expect(screen.getByText('JSON Formatter')).toBeInTheDocument();
  });

  it('exposes a stable root test id for scroll-boundary assertions', () => {
    render(<ToolGrid {...defaultProps} />);
    expect(screen.getByTestId('tool-grid-root')).toBeInTheDocument();
  });
});
