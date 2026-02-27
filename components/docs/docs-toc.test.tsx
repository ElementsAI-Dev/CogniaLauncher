import { render, screen, fireEvent } from '@testing-library/react';
import { DocsToc } from './docs-toc';

// Mock extractHeadings to return controlled data
const mockExtractHeadings = jest.fn();
jest.mock('@/lib/docs/headings', () => ({
  extractHeadings: (...args: unknown[]) => mockExtractHeadings(...args),
}));

// Mock useActiveHeading
const mockScrollToId = jest.fn();
let mockActiveId = '';
jest.mock('@/hooks/use-active-heading', () => ({
  useActiveHeading: () => ({
    activeId: mockActiveId,
    scrollToId: mockScrollToId,
  }),
}));

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'docs.toc': 'Table of Contents',
      };
      return translations[key] || key;
    },
    locale: 'en',
  }),
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div data-testid="scroll-area">{children}</div>,
}));

jest.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children, open, onOpenChange }: { children: React.ReactNode; open: boolean; onOpenChange: (v: boolean) => void }) => (
    <div data-testid="collapsible" data-open={open} onClick={() => onOpenChange(!open)}>{children}</div>
  ),
  CollapsibleTrigger: ({ children, ...props }: { children: React.ReactNode }) => (
    <button data-testid="collapsible-trigger" {...props}>{children}</button>
  ),
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="collapsible-content">{children}</div>
  ),
}));

const defaultHeadings = [
  { id: 'introduction', text: 'Introduction', level: 2 },
  { id: 'getting-started', text: 'Getting Started', level: 3 },
  { id: 'api-reference', text: 'API Reference', level: 2 },
];

beforeEach(() => {
  mockActiveId = '';
  mockScrollToId.mockClear();
  mockExtractHeadings.mockReturnValue(defaultHeadings);
});

describe('DocsToc', () => {
  const contentWithHeadings = '## Introduction\n### Getting Started\n## API Reference';
  const contentNoHeadings = 'Just a paragraph\n\nAnother paragraph';

  it('returns null when content has no headings', () => {
    mockExtractHeadings.mockReturnValue([]);
    const { container } = render(<DocsToc content={contentNoHeadings} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders desktop TOC with heading title', () => {
    render(<DocsToc content={contentWithHeadings} />);
    const tocTitles = screen.getAllByText('Table of Contents');
    expect(tocTitles.length).toBeGreaterThanOrEqual(1);
  });

  it('renders heading links for each extracted heading', () => {
    render(<DocsToc content={contentWithHeadings} />);
    expect(screen.getAllByText('Introduction')).toHaveLength(2); // desktop + mobile
    expect(screen.getAllByText('Getting Started')).toHaveLength(2);
    expect(screen.getAllByText('API Reference')).toHaveLength(2);
  });

  it('renders heading links with correct href', () => {
    render(<DocsToc content={contentWithHeadings} mode="desktop" />);
    const introLink = screen.getByText('Introduction').closest('a');
    expect(introLink).toHaveAttribute('href', '#introduction');
  });

  it('applies pl-3 class for h3 headings (indented)', () => {
    render(<DocsToc content={contentWithHeadings} mode="desktop" />);
    const gsLink = screen.getByText('Getting Started').closest('a');
    expect(gsLink?.className).toContain('pl-3');
  });

  it('does not apply pl-3 class for h2 headings', () => {
    render(<DocsToc content={contentWithHeadings} mode="desktop" />);
    const introLink = screen.getByText('Introduction').closest('a');
    expect(introLink?.className).not.toContain('pl-3');
  });

  it('renders only desktop TOC when mode=desktop', () => {
    const { container } = render(<DocsToc content={contentWithHeadings} mode="desktop" />);
    expect(container.querySelector('aside')).toBeInTheDocument();
    expect(container.querySelector('.xl\\:hidden')).not.toBeInTheDocument();
  });

  it('renders only mobile TOC when mode=mobile', () => {
    const { container } = render(<DocsToc content={contentWithHeadings} mode="mobile" />);
    expect(container.querySelector('aside')).not.toBeInTheDocument();
    expect(container.querySelector('.xl\\:hidden')).toBeInTheDocument();
  });

  it('renders both desktop and mobile when mode=both (default)', () => {
    const { container } = render(<DocsToc content={contentWithHeadings} />);
    expect(container.querySelector('aside')).toBeInTheDocument();
    expect(container.querySelector('.xl\\:hidden')).toBeInTheDocument();
  });

  it('renders mobile collapsible trigger', () => {
    render(<DocsToc content={contentWithHeadings} mode="mobile" />);
    const trigger = screen.getByTestId('collapsible-trigger');
    expect(trigger).toBeInTheDocument();
  });

  it('applies custom className to desktop aside', () => {
    const { container } = render(<DocsToc content={contentWithHeadings} mode="desktop" className="my-custom" />);
    const aside = container.querySelector('aside');
    expect(aside?.className).toContain('my-custom');
  });

  it('delegates heading click to scrollToId from useActiveHeading', () => {
    render(<DocsToc content={contentWithHeadings} mode="desktop" />);
    const link = screen.getByText('Introduction').closest('a')!;
    fireEvent.click(link);

    expect(mockScrollToId).toHaveBeenCalledWith('introduction');
  });

  it('applies active style when activeId matches heading', () => {
    mockActiveId = 'introduction';
    render(<DocsToc content={contentWithHeadings} mode="desktop" />);
    const link = screen.getByText('Introduction').closest('a');
    expect(link?.className).toContain('text-primary');
  });

  it('applies inactive style when activeId does not match', () => {
    mockActiveId = 'introduction';
    render(<DocsToc content={contentWithHeadings} mode="desktop" />);
    const link = screen.getByText('API Reference').closest('a');
    expect(link?.className).toContain('text-muted-foreground');
  });
});
