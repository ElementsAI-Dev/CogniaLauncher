import { render, screen, fireEvent } from '@testing-library/react';
import { DocsSearch } from './docs-search';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

let mockLocale = 'en';
jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'docs.searchPlaceholder': 'Search docs...',
        'docs.searchNoResults': 'No results found',
      };
      return translations[key] || key;
    },
    locale: mockLocale,
  }),
}));

const mockSearchDocs = jest.fn();
jest.mock('@/lib/docs/search', () => ({
  searchDocs: (...args: unknown[]) => mockSearchDocs(...args),
}));

jest.mock('@/lib/docs/navigation', () => ({
  slugToArray: (slug: string) => (slug === 'index' ? [] : slug.split('/')),
}));

jest.mock('@/components/ui/input', () => ({
  Input: Object.assign(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (({ className, ...props }: any) => <input data-testid="search-input" className={className} {...props} />) as React.FC,
    { displayName: 'Input' },
  ),
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div data-testid="scroll-area">{children}</div>,
}));

const defaultResults = [
  { title: '快速开始', titleEn: 'Quick Start', slug: 'getting-started', snippet: 'Quick Start', score: 10 },
  { title: '安装指南', titleEn: 'Installation', slug: 'installation', snippet: 'Installation', score: 5 },
];

describe('DocsSearch', () => {
  beforeEach(() => {
    mockLocale = 'en';
    mockPush.mockClear();
    mockSearchDocs.mockReturnValue([]);
  });

  it('renders search input with placeholder', () => {
    render(<DocsSearch />);
    expect(screen.getByTestId('search-input')).toHaveAttribute('placeholder', 'Search docs...');
  });

  it('renders keyboard shortcut hint', () => {
    render(<DocsSearch />);
    expect(screen.getByText('/')).toBeInTheDocument();
  });

  it('does not show results dropdown initially', () => {
    render(<DocsSearch />);
    expect(screen.queryByText('No results found')).not.toBeInTheDocument();
  });

  it('shows no results message when query has no matches', () => {
    mockSearchDocs.mockReturnValue([]);
    render(<DocsSearch />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'nonexistent' } });
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('shows search results when query matches', () => {
    mockSearchDocs.mockReturnValue(defaultResults);
    render(<DocsSearch />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'start' } });
    expect(screen.getByText('Quick Start')).toBeInTheDocument();
    expect(screen.getByText('Installation')).toBeInTheDocument();
  });

  it('navigates on result click', () => {
    mockSearchDocs.mockReturnValue(defaultResults);
    render(<DocsSearch />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'start' } });
    fireEvent.click(screen.getByText('Quick Start'));
    expect(mockPush).toHaveBeenCalledWith('/docs/getting-started');
  });

  it('navigates on Enter key', () => {
    mockSearchDocs.mockReturnValue(defaultResults);
    render(<DocsSearch />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'start' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockPush).toHaveBeenCalledWith('/docs/getting-started');
  });

  it('moves selection with ArrowDown', () => {
    mockSearchDocs.mockReturnValue(defaultResults);
    render(<DocsSearch />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'start' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockPush).toHaveBeenCalledWith('/docs/installation');
  });

  it('moves selection with ArrowUp (wraps around)', () => {
    mockSearchDocs.mockReturnValue(defaultResults);
    render(<DocsSearch />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'start' } });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });
    // Wraps to last item (Installation)
    expect(mockPush).toHaveBeenCalledWith('/docs/installation');
  });

  it('closes dropdown on Escape', () => {
    mockSearchDocs.mockReturnValue(defaultResults);
    render(<DocsSearch />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'start' } });
    expect(screen.getByText('Quick Start')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('Quick Start')).not.toBeInTheDocument();
  });

  it('closes dropdown on outside click', () => {
    mockSearchDocs.mockReturnValue(defaultResults);
    render(<DocsSearch />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'start' } });
    expect(screen.getByText('Quick Start')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Quick Start')).not.toBeInTheDocument();
  });

  it('highlights selected result on mouse enter', () => {
    mockSearchDocs.mockReturnValue(defaultResults);
    render(<DocsSearch />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'start' } });
    const installBtn = screen.getByText('Installation').closest('button')!;
    fireEvent.mouseEnter(installBtn);
    // After hovering second item, Enter navigates to it
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockPush).toHaveBeenCalledWith('/docs/installation');
  });

  it('passes searchIndex to searchDocs', () => {
    const index = [{ slug: 'test', headingsZh: [], headingsEn: [], excerptZh: '', excerptEn: '' }];
    mockSearchDocs.mockReturnValue([]);
    render(<DocsSearch searchIndex={index} />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'test' } });
    expect(mockSearchDocs).toHaveBeenCalledWith('test', 'en', index);
  });

  it('focuses search on "/" key press', () => {
    render(<DocsSearch />);
    const input = screen.getByTestId('search-input');
    fireEvent.keyDown(document, { key: '/' });
    expect(document.activeElement).toBe(input);
  });

  it('focuses search on Ctrl+K', () => {
    render(<DocsSearch />);
    const input = screen.getByTestId('search-input');
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(document.activeElement).toBe(input);
  });

  it('does not trigger "/" shortcut when typing in input field', () => {
    mockSearchDocs.mockReturnValue([]);
    render(<DocsSearch />);
    const input = screen.getByTestId('search-input');
    input.focus();
    // When "/" is typed into the input, the global handler checks e.target.tagName === 'INPUT'
    // and skips focus. The input retains its existing focus.
    fireEvent.keyDown(input, { key: '/' });
    expect(document.activeElement).toBe(input);
  });

  it('reopens dropdown on focus if query exists', () => {
    mockSearchDocs.mockReturnValue(defaultResults);
    render(<DocsSearch />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'start' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('Quick Start')).not.toBeInTheDocument();
    fireEvent.focus(input);
    expect(screen.getByText('Quick Start')).toBeInTheDocument();
  });

  it('clears query after navigation', () => {
    mockSearchDocs.mockReturnValue(defaultResults);
    render(<DocsSearch />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'start' } });
    fireEvent.click(screen.getByText('Quick Start'));
    expect(input).toHaveValue('');
  });

  it('shows result slug', () => {
    mockSearchDocs.mockReturnValue(defaultResults);
    render(<DocsSearch />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'start' } });
    expect(screen.getByText('getting-started')).toBeInTheDocument();
  });

  it('shows snippet when different from title', () => {
    const resultsWithSnippet = [
      { title: '安装', titleEn: 'Installation', slug: 'installation', snippet: 'System Requirements', score: 5 },
    ];
    mockSearchDocs.mockReturnValue(resultsWithSnippet);
    render(<DocsSearch />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'system' } });
    expect(screen.getByText('System Requirements')).toBeInTheDocument();
  });

  it('does not show snippet when same as title', () => {
    const resultsNoSnippet = [
      { title: '安装', titleEn: 'Installation', slug: 'installation', snippet: 'Installation', score: 5 },
    ];
    mockSearchDocs.mockReturnValue(resultsNoSnippet);
    render(<DocsSearch />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'install' } });
    // Only one "Installation" element (the title), not a separate snippet
    const installations = screen.getAllByText('Installation');
    expect(installations).toHaveLength(1);
  });

  it('applies custom className', () => {
    const { container } = render(<DocsSearch className="my-custom" />);
    expect(container.firstElementChild?.className).toContain('my-custom');
  });
});
