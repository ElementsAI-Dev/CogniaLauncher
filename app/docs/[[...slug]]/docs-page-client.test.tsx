import { fireEvent, render, screen } from '@testing-library/react';
import { DocsPageClient } from './docs-page-client';

let mockLocale = 'en';
jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'docs.readingTime') return `${params?.count} min read`;
      if (key === 'docs.lastUpdated') return 'Last updated';
      if (key === 'docs.fallbackNotice') {
        return `Showing ${params?.effectiveLanguage} because the ${params?.requestedLanguage} page is unavailable.`;
      }
      if (key === 'docs.languageEnglish') return 'English';
      if (key === 'docs.languageChinese') return 'Chinese';
      return key;
    },
    locale: mockLocale,
  }),
}));

jest.mock('@/components/docs', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <div data-testid="markdown">{content}</div>,
  DocsSidebar: ({ searchIndex, className }: { searchIndex?: unknown[]; className?: string }) => (
    <div data-testid="sidebar" data-class={className ?? ''} data-index-count={searchIndex?.length ?? 0} />
  ),
  DocsMobileSidebar: ({ searchIndex }: { searchIndex?: unknown[]; className?: string }) => (
    <div data-testid="mobile-sidebar" data-index-count={searchIndex?.length ?? 0} />
  ),
  DocsToc: ({ mode, className, headings }: { mode?: string; className?: string; headings?: unknown[] }) => (
    <div data-testid={`toc-${mode}`} data-class={className ?? ''} data-headings-count={headings?.length ?? 0} />
  ),
  DocsNavFooter: ({ prev, next, sourcePath }: { prev?: { slug: string }; next?: { slug: string }; sourcePath?: string }) => (
    <div data-testid="nav-footer" data-prev={prev?.slug ?? ''} data-next={next?.slug ?? ''} data-source-path={sourcePath ?? ''} />
  ),
  DocsBreadcrumb: ({ slug }: { slug: string }) => <div data-testid="breadcrumb">{slug}</div>,
  DocsScrollProgress: () => <div data-testid="scroll-progress" />,
  DocsHomeCards: () => <div data-testid="home-cards" />,
}));

jest.mock('@/lib/docs/navigation', () => ({
  getDocTitle: (slug: string) => (slug === 'index' ? 'Home' : `Title: ${slug}`),
  getAdjacentDocs: (slug: string) => {
    if (slug === 'index') return { prev: undefined, next: { title: 'Next', slug: 'next-page' } };
    return { prev: { title: 'Prev', slug: 'prev-page' }, next: { title: 'Next', slug: 'next-page' } };
  },
  arrayToSlug: (arr?: string[]) => (!arr || arr.length === 0 ? 'index' : arr.join('/')),
}));

jest.mock('@/lib/docs/reading-time', () => ({
  estimateReadingTime: () => 3,
}));

jest.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {actions && <div data-testid="page-header-actions">{actions}</div>}
    </div>
  ),
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div data-testid="scroll-area">{children}</div>,
}));

describe('DocsPageClient', () => {
  const createDoc = (
    locale: 'en' | 'zh',
    content: string,
    overrides?: Partial<{ sourcePath: string; lastModified: string | null }>
  ) => ({
    locale,
    content,
    sourcePath: `docs/${locale}/guide/index.md`,
    lastModified: '2026-01-15T12:00:00.000Z',
    ...overrides,
  });

  beforeEach(() => {
    mockLocale = 'en';
  });

  afterEach(() => {
    window.location.hash = '';
  });

  it('renders all layout sections', () => {
    render(<DocsPageClient docZh={createDoc('zh', '# 你好')} docEn={createDoc('en', '# Hello')} slug={['guide']} />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('scroll-progress')).toBeInTheDocument();
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
    expect(screen.getByTestId('page-header')).toBeInTheDocument();
    expect(screen.getByTestId('toc-mobile')).toBeInTheDocument();
    expect(screen.getByTestId('toc-desktop')).toBeInTheDocument();
    expect(screen.getByTestId('markdown')).toBeInTheDocument();
    expect(screen.getByTestId('nav-footer')).toBeInTheDocument();
  });

  it('keeps desktop section order as sidebar -> content -> desktop toc', () => {
    render(<DocsPageClient docZh={createDoc('zh', '# A')} docEn={createDoc('en', '# B')} slug={['guide']} />);
    const sidebar = screen.getByTestId('sidebar');
    const markdown = screen.getByTestId('markdown');
    const desktopToc = screen.getByTestId('toc-desktop');

    expect(sidebar.compareDocumentPosition(markdown) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(markdown.compareDocumentPosition(desktopToc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('passes responsive visibility classes to desktop controls', () => {
    render(<DocsPageClient docZh={createDoc('zh', '# A')} docEn={createDoc('en', '# B')} slug={['guide']} />);
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-class', expect.stringContaining('hidden'));
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-class', expect.stringContaining('lg:block'));
    expect(screen.getByTestId('toc-desktop')).toHaveAttribute('data-class', expect.stringContaining('border-l'));
  });

  it('renders English content when locale is en', () => {
    render(<DocsPageClient docZh={createDoc('zh', '# 中文')} docEn={createDoc('en', '# English')} slug={['guide']} />);
    expect(screen.getByTestId('markdown')).toHaveTextContent('# English');
  });

  it('falls back to zh content when en is null and shows a fallback notice', () => {
    render(<DocsPageClient docZh={createDoc('zh', '# 中文', { sourcePath: 'docs/zh/guide/index.md' })} docEn={null} slug={['guide']} />);
    expect(screen.getByTestId('markdown')).toHaveTextContent('# 中文');
    expect(screen.getByText('Showing Chinese because the English page is unavailable.')).toBeInTheDocument();
    expect(screen.getByTestId('nav-footer')).toHaveAttribute('data-source-path', 'docs/zh/guide/index.md');
  });

  it('does not show a fallback notice when requested locale content exists', () => {
    render(<DocsPageClient docZh={createDoc('zh', '# 中文')} docEn={createDoc('en', '# English')} slug={['guide']} />);
    expect(screen.queryByText(/Showing .* page is unavailable/)).not.toBeInTheDocument();
  });

  it('renders empty string when both contents are null', () => {
    render(<DocsPageClient docZh={null} docEn={null} slug={['guide']} />);
    expect(screen.getByTestId('markdown')).toHaveTextContent('');
  });

  it('shows reading time', () => {
    const { container } = render(<DocsPageClient docZh={createDoc('zh', '# 内容')} docEn={createDoc('en', '# Content')} slug={['guide']} />);
    // Reading time is rendered inside a span with Clock icon, text may be split across elements
    expect(container.textContent).toContain('3 min read');
  });

  it('shows last updated metadata for the rendered document', () => {
    const { container } = render(
      <DocsPageClient
        docZh={createDoc('zh', '# 内容')}
        docEn={createDoc('en', '# Content', { lastModified: '2026-01-15T12:00:00.000Z' })}
        slug={['guide']}
      />
    );

    expect(container.textContent).toContain('Last updated');
    expect(container.querySelector('time[datetime="2026-01-15T12:00:00.000Z"]')).toBeInTheDocument();
  });

  it('renders DocsHomeCards on index page', () => {
    render(<DocsPageClient docZh={createDoc('zh', '# 首页')} docEn={createDoc('en', '# Home')} />);
    expect(screen.getByTestId('home-cards')).toBeInTheDocument();
  });

  it('does not render DocsHomeCards on non-index pages', () => {
    render(<DocsPageClient docZh={createDoc('zh', '# 指南')} docEn={createDoc('en', '# Guide')} slug={['guide']} />);
    expect(screen.queryByTestId('home-cards')).not.toBeInTheDocument();
  });

  it('passes searchIndex to DocsSidebar', () => {
    const index = [{ slug: 'x', pageSlug: 'x', anchorId: 'intro', sectionTitle: 'Intro', locale: 'en', excerpt: 'intro' }];
    render(<DocsPageClient docZh={createDoc('zh', '# A')} docEn={createDoc('en', '# B')} slug={['guide']} searchIndex={index} />);
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-index-count', '1');
    expect(screen.getByTestId('mobile-sidebar')).toHaveAttribute('data-index-count', '1');
  });

  it('passes basePath to MarkdownRenderer', () => {
    render(<DocsPageClient docZh={createDoc('zh', '# A')} docEn={createDoc('en', '# B')} slug={['guide', 'sub']} basePath="guide" />);
    expect(screen.getByTestId('markdown')).toBeInTheDocument();
  });

  it('keeps heading extraction stable for mermaid-heavy content', () => {
    const content = ['# Overview', '```mermaid', 'graph TD', 'A-->B', '```', '## After Diagram'].join('\n');

    render(<DocsPageClient docZh={createDoc('zh', content)} docEn={createDoc('en', content)} slug={['architecture', 'overview']} />);

    expect(screen.getByTestId('markdown')).toHaveTextContent('```mermaid');
    expect(screen.getByTestId('toc-mobile')).toHaveAttribute('data-headings-count', '1');
    expect(screen.getByTestId('toc-desktop')).toHaveAttribute('data-headings-count', '1');
  });

  it('renders breadcrumb with current slug', () => {
    render(<DocsPageClient docZh={createDoc('zh', '# A')} docEn={createDoc('en', '# B')} slug={['architecture', 'frontend']} />);
    expect(screen.getByTestId('breadcrumb')).toHaveTextContent('architecture/frontend');
  });

  it('renders nav footer with adjacent docs', () => {
    render(
      <DocsPageClient
        docZh={createDoc('zh', '# A')}
        docEn={createDoc('en', '# B', { sourcePath: 'docs/en/guide/index.md' })}
        slug={['guide']}
      />
    );
    const footer = screen.getByTestId('nav-footer');
    expect(footer).toHaveAttribute('data-prev', 'prev-page');
    expect(footer).toHaveAttribute('data-next', 'next-page');
    expect(footer).toHaveAttribute('data-source-path', 'docs/en/guide/index.md');
  });

  it('scrolls to hash target on load', () => {
    const target = document.createElement('div');
    target.id = 'target-heading';
    const scrollMock = jest.fn();
    Object.defineProperty(target, 'scrollIntoView', { value: scrollMock, writable: true });
    document.body.appendChild(target);
    window.location.hash = '#target-heading';

    render(<DocsPageClient docZh={createDoc('zh', '# A')} docEn={createDoc('en', '# B')} slug={['guide']} />);

    expect(scrollMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    document.body.removeChild(target);
  });

  it('responds to hashchange events for deep links', () => {
    const target = document.createElement('div');
    target.id = 'next-heading';
    const scrollMock = jest.fn();
    Object.defineProperty(target, 'scrollIntoView', { value: scrollMock, writable: true });
    document.body.appendChild(target);

    render(<DocsPageClient docZh={createDoc('zh', '# A')} docEn={createDoc('en', '# B')} slug={['guide']} />);
    window.location.hash = '#next-heading';
    fireEvent(window, new HashChangeEvent('hashchange'));

    expect(scrollMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    document.body.removeChild(target);
  });

  it('falls back safely when hash target is missing', () => {
    const scrollSpy = jest.spyOn(HTMLElement.prototype, 'scrollIntoView');
    window.location.hash = '#missing-heading';

    render(<DocsPageClient docZh={createDoc('zh', '# A')} docEn={createDoc('en', '# B')} slug={['guide']} />);

    expect(scrollSpy).toHaveBeenCalled();
    scrollSpy.mockRestore();
  });
});
