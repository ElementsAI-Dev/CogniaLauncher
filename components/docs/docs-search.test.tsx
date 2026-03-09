import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const defaultResults = [
  { title: '快速开始', titleEn: 'Quick Start', slug: 'getting-started', anchorId: 'quick-start', snippet: 'Quick Start', score: 10 },
  { title: '安装指南', titleEn: 'Installation', slug: 'installation', snippet: 'Installation', score: 5 },
];

function openSearch() {
  fireEvent.click(screen.getByRole('button', { name: 'Search docs...' }));
  return screen.getByPlaceholderText('Search docs...');
}

describe('DocsSearch', () => {
  beforeEach(() => {
    mockLocale = 'en';
    mockPush.mockReset();
    mockSearchDocs.mockReset();
    mockSearchDocs.mockReturnValue([]);
  });

  it('renders trigger and shortcut hint', () => {
    render(<DocsSearch />);
    expect(screen.getByRole('button', { name: 'Search docs...' })).toBeInTheDocument();
    expect(screen.getByText('/')).toBeInTheDocument();
  });

  it('opens popover with command input', async () => {
    render(<DocsSearch />);
    const input = openSearch();
    expect(input).toBeInTheDocument();
    await waitFor(() => expect(input).toHaveFocus());
  });

  it('shows no results message when query has no matches', () => {
    mockSearchDocs.mockReturnValue([]);
    render(<DocsSearch />);
    const input = openSearch();
    fireEvent.change(input, { target: { value: 'nonexistent' } });
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('shows search results when query matches', () => {
    mockSearchDocs.mockReturnValue(defaultResults);
    render(<DocsSearch />);
    const input = openSearch();
    fireEvent.change(input, { target: { value: 'start' } });
    expect(screen.getByText('Quick Start')).toBeInTheDocument();
    expect(screen.getByText('Installation')).toBeInTheDocument();
  });

  it('navigates to selected result on click', () => {
    mockSearchDocs.mockReturnValue(defaultResults);
    render(<DocsSearch />);
    const input = openSearch();
    fireEvent.change(input, { target: { value: 'start' } });
    fireEvent.click(screen.getByText('Quick Start'));
    expect(mockPush).toHaveBeenCalledWith('/docs/getting-started#quick-start');
  });

  it('navigates on Enter key', () => {
    mockSearchDocs.mockReturnValue(defaultResults);
    render(<DocsSearch />);
    const input = openSearch();
    fireEvent.change(input, { target: { value: 'start' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockPush).toHaveBeenCalledWith('/docs/getting-started#quick-start');
  });

  it('supports ArrowDown then Enter keyboard navigation', () => {
    mockSearchDocs.mockReturnValue(defaultResults);
    render(<DocsSearch />);
    const input = openSearch();
    fireEvent.change(input, { target: { value: 'start' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockPush).toHaveBeenCalledWith('/docs/installation');
  });

  it('closes popover on Escape', async () => {
    mockSearchDocs.mockReturnValue(defaultResults);
    render(<DocsSearch />);
    const input = openSearch();
    fireEvent.change(input, { target: { value: 'start' } });
    expect(screen.getByText('Quick Start')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('Quick Start')).not.toBeInTheDocument());
  });

  it('focuses search on "/" key press', async () => {
    render(<DocsSearch />);
    fireEvent.keyDown(document, { key: '/' });
    const input = await screen.findByPlaceholderText('Search docs...');
    await waitFor(() => expect(input).toHaveFocus());
  });

  it('focuses search on Ctrl+K', async () => {
    render(<DocsSearch />);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    const input = await screen.findByPlaceholderText('Search docs...');
    await waitFor(() => expect(input).toHaveFocus());
  });

  it('passes searchIndex to searchDocs', () => {
    const index = [{ slug: 'test', pageSlug: 'test', anchorId: 'intro', sectionTitle: 'Intro', locale: 'en', excerpt: 'intro section' }];
    render(<DocsSearch searchIndex={index} />);
    const input = openSearch();
    fireEvent.change(input, { target: { value: 'test' } });
    expect(mockSearchDocs).toHaveBeenCalledWith('test', 'en', index);
  });
});
