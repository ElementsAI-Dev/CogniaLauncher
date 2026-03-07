import { fireEvent, render, screen } from '@testing-library/react';
import { DocsPageClient } from './docs-page-client';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'docs.readingTime') return `${params?.count} min read`;
      return key;
    },
    locale: 'en',
  }),
}));

jest.mock('@/components/docs', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <div data-testid="markdown">{content.slice(0, 50)}</div>,
  DocsSidebar: ({ searchIndex }: { searchIndex?: unknown[] }) => (
    <div data-testid="sidebar" data-index-count={searchIndex?.length ?? 0} />
  ),
  DocsMobileSidebar: ({ searchIndex }: { searchIndex?: unknown[] }) => (
    <div data-testid="mobile-sidebar" data-index-count={searchIndex?.length ?? 0} />
  ),
  DocsToc: ({ mode }: { mode?: string }) => <div data-testid={`toc-${mode}`} />,
  DocsNavFooter: ({ prev, next }: { prev?: { slug: string }; next?: { slug: string } }) => (
    <div data-testid="nav-footer" data-prev={prev?.slug ?? ''} data-next={next?.slug ?? ''} />
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
  afterEach(() => {
    window.location.hash = '';
  });

  it('renders all layout sections', () => {
    render(<DocsPageClient contentZh="# 你好" contentEn="# Hello" slug={['guide']} />);
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

  it('renders English content when locale is en', () => {
    render(<DocsPageClient contentZh="# 中文" contentEn="# English" slug={['guide']} />);
    expect(screen.getByTestId('markdown')).toHaveTextContent('# English');
  });

  it('falls back to zh content when en is null', () => {
    render(<DocsPageClient contentZh="# 中文" contentEn={null} slug={['guide']} />);
    expect(screen.getByTestId('markdown')).toHaveTextContent('# 中文');
  });

  it('renders empty string when both contents are null', () => {
    render(<DocsPageClient contentZh={null} contentEn={null} slug={['guide']} />);
    expect(screen.getByTestId('markdown')).toHaveTextContent('');
  });

  it('shows reading time', () => {
    const { container } = render(<DocsPageClient contentZh="# 内容" contentEn="# Content" slug={['guide']} />);
    // Reading time is rendered inside a span with Clock icon, text may be split across elements
    expect(container.textContent).toContain('3 min read');
  });

  it('renders DocsHomeCards on index page', () => {
    render(<DocsPageClient contentZh="# 首页" contentEn="# Home" />);
    expect(screen.getByTestId('home-cards')).toBeInTheDocument();
  });

  it('does not render DocsHomeCards on non-index pages', () => {
    render(<DocsPageClient contentZh="# 指南" contentEn="# Guide" slug={['guide']} />);
    expect(screen.queryByTestId('home-cards')).not.toBeInTheDocument();
  });

  it('passes searchIndex to DocsSidebar', () => {
    const index = [{ slug: 'x', pageSlug: 'x', anchorId: 'intro', sectionTitle: 'Intro', locale: 'en', excerpt: 'intro' }];
    render(<DocsPageClient contentZh="# A" contentEn="# B" slug={['guide']} searchIndex={index} />);
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-index-count', '1');
    expect(screen.getByTestId('mobile-sidebar')).toHaveAttribute('data-index-count', '1');
  });

  it('passes basePath to MarkdownRenderer', () => {
    render(<DocsPageClient contentZh="# A" contentEn="# B" slug={['guide', 'sub']} basePath="guide" />);
    expect(screen.getByTestId('markdown')).toBeInTheDocument();
  });

  it('renders breadcrumb with current slug', () => {
    render(<DocsPageClient contentZh="# A" contentEn="# B" slug={['architecture', 'frontend']} />);
    expect(screen.getByTestId('breadcrumb')).toHaveTextContent('architecture/frontend');
  });

  it('renders nav footer with adjacent docs', () => {
    render(<DocsPageClient contentZh="# A" contentEn="# B" slug={['guide']} />);
    const footer = screen.getByTestId('nav-footer');
    expect(footer).toHaveAttribute('data-prev', 'prev-page');
    expect(footer).toHaveAttribute('data-next', 'next-page');
  });

  it('scrolls to hash target on load', () => {
    const target = document.createElement('div');
    target.id = 'target-heading';
    const scrollMock = jest.fn();
    Object.defineProperty(target, 'scrollIntoView', { value: scrollMock, writable: true });
    document.body.appendChild(target);
    window.location.hash = '#target-heading';

    render(<DocsPageClient contentZh="# A" contentEn="# B" slug={['guide']} />);

    expect(scrollMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    document.body.removeChild(target);
  });

  it('responds to hashchange events for deep links', () => {
    const target = document.createElement('div');
    target.id = 'next-heading';
    const scrollMock = jest.fn();
    Object.defineProperty(target, 'scrollIntoView', { value: scrollMock, writable: true });
    document.body.appendChild(target);

    render(<DocsPageClient contentZh="# A" contentEn="# B" slug={['guide']} />);
    window.location.hash = '#next-heading';
    fireEvent(window, new HashChangeEvent('hashchange'));

    expect(scrollMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    document.body.removeChild(target);
  });

  it('falls back safely when hash target is missing', () => {
    const scrollSpy = jest.spyOn(HTMLElement.prototype, 'scrollIntoView');
    window.location.hash = '#missing-heading';

    render(<DocsPageClient contentZh="# A" contentEn="# B" slug={['guide']} />);

    expect(scrollSpy).toHaveBeenCalled();
    scrollSpy.mockRestore();
  });
});
