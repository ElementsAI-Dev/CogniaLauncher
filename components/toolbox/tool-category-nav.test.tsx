import { render, screen, fireEvent } from '@testing-library/react';
import { ToolCategoryNav, ToolCategoryNavContent } from './tool-category-nav';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'toolbox.categories.favorites': 'Favorites',
        'toolbox.categories.recent': 'Recent',
        'toolbox.categories.mostUsed': 'Most Used',
        'toolbox.categories.all': 'All Tools',
        'toolbox.categories.converters': 'Converters',
        'toolbox.categories.encoders': 'Encoders',
        'toolbox.categories.formatters': 'Formatters',
        'toolbox.categories.generators': 'Generators',
        'toolbox.categories.text': 'Text',
        'toolbox.categories.network': 'Network',
        'toolbox.categories.graphics': 'Graphics',
        'toolbox.categories.developer': 'Developer',
        'toolbox.categories.system': 'System',
      };
      return map[key] || key;
    },
  }),
}));

jest.mock('@/components/ui/dynamic-icon', () => ({
  DynamicIcon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

describe('ToolCategoryNavContent', () => {
  const defaultProps = {
    selectedCategory: 'all' as const,
    onSelectCategory: jest.fn(),
    categoryToolCounts: new Map([
      ['converters', 2],
      ['formatters', 3],
      ['generators', 4],
      ['encoders', 1],
      ['text', 2],
      ['network', 0],
      ['graphics', 1],
      ['developer', 2],
      ['system', 0],
    ]),
    totalToolCount: 15,
    favoritesCount: 2,
    recentCount: 3,
    mostUsedCount: 5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Favorites button', () => {
    render(<ToolCategoryNavContent {...defaultProps} />);
    expect(screen.getByText('Favorites')).toBeInTheDocument();
  });

  it('renders Recent button', () => {
    render(<ToolCategoryNavContent {...defaultProps} />);
    expect(screen.getByText('Recent')).toBeInTheDocument();
  });

  it('renders Most Used button', () => {
    render(<ToolCategoryNavContent {...defaultProps} />);
    expect(screen.getByText('Most Used')).toBeInTheDocument();
  });

  it('renders All Tools button with total count', () => {
    render(<ToolCategoryNavContent {...defaultProps} />);
    expect(screen.getByText('All Tools')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('renders category buttons', () => {
    render(<ToolCategoryNavContent {...defaultProps} />);
    expect(screen.getByText('Converters')).toBeInTheDocument();
    expect(screen.getByText('Formatters')).toBeInTheDocument();
    expect(screen.getByText('Generators')).toBeInTheDocument();
  });

  it('calls onSelectCategory when Favorites is clicked', () => {
    render(<ToolCategoryNavContent {...defaultProps} />);
    fireEvent.click(screen.getByText('Favorites'));
    expect(defaultProps.onSelectCategory).toHaveBeenCalledWith('favorites');
  });

  it('calls onSelectCategory when Most Used is clicked', () => {
    render(<ToolCategoryNavContent {...defaultProps} />);
    fireEvent.click(screen.getByText('Most Used'));
    expect(defaultProps.onSelectCategory).toHaveBeenCalledWith('most-used');
  });

  it('calls onSelectCategory when All Tools is clicked', () => {
    render(<ToolCategoryNavContent {...defaultProps} />);
    fireEvent.click(screen.getByText('All Tools'));
    expect(defaultProps.onSelectCategory).toHaveBeenCalledWith('all');
  });

  it('calls onSelectCategory when a category is clicked', () => {
    render(<ToolCategoryNavContent {...defaultProps} />);
    fireEvent.click(screen.getByText('Formatters'));
    expect(defaultProps.onSelectCategory).toHaveBeenCalledWith('formatters');
  });

  it('shows favorites count badge when > 0', () => {
    render(<ToolCategoryNavContent {...defaultProps} favoritesCount={3} />);
    // Favorites button should contain the count '3'
    const favBtn = screen.getByText('Favorites').closest('button');
    expect(favBtn?.textContent).toContain('3');
  });

  it('shows mostUsedCount badge when > 0', () => {
    render(<ToolCategoryNavContent {...defaultProps} mostUsedCount={7} />);
    const mostUsedBtn = screen.getByText('Most Used').closest('button');
    expect(mostUsedBtn?.textContent).toContain('7');
  });

  it('disables categories with 0 tools', () => {
    render(<ToolCategoryNavContent {...defaultProps} />);
    const networkBtn = screen.getByText('Network').closest('button');
    expect(networkBtn).toBeDisabled();
  });

  it('highlights selected category', () => {
    render(<ToolCategoryNavContent {...defaultProps} selectedCategory="formatters" />);
    const btn = screen.getByText('Formatters').closest('button');
    expect(btn?.className).toContain('secondary');
  });

  it('uses container-relative scroll wrapper for desktop sidebar', () => {
    render(<ToolCategoryNav {...defaultProps} />);
    const wrapper = screen.getByTestId('tool-category-nav-scroll');
    expect(wrapper.className).toContain('min-h-0');
    expect(wrapper.className).toContain('flex-1');
    expect(wrapper.className).toContain('overflow-y-auto');
    expect(wrapper.className).not.toContain('100vh');
  });
});
