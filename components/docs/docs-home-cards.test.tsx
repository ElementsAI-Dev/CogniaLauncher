import { render, screen } from '@testing-library/react';
import { DocsHomeCards } from './docs-home-cards';

jest.mock('next/link', () => {
  function MockLink({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) {
    return <a href={href} {...props}>{children}</a>;
  }
  MockLink.displayName = 'MockLink';
  return MockLink;
});

let mockLocale = 'en';
jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => key,
    locale: mockLocale,
  }),
}));

jest.mock('@/lib/docs/navigation', () => ({
  DOC_NAV: [
    { title: '首页', titleEn: 'Home', slug: 'index' },
    {
      title: '快速开始',
      titleEn: 'Getting Started',
      children: [
        { title: '概览', titleEn: 'Overview', slug: 'getting-started' },
        { title: '安装', titleEn: 'Installation', slug: 'getting-started/installation' },
      ],
    },
    {
      title: '使用指南',
      titleEn: 'User Guide',
      children: [
        { title: '概览', titleEn: 'Overview', slug: 'guide' },
      ],
    },
  ],
  slugToArray: (slug: string) => (slug === 'index' ? [] : slug.split('/')),
}));

describe('DocsHomeCards', () => {
  beforeEach(() => {
    mockLocale = 'en';
  });

  it('renders card for each section with children', () => {
    render(<DocsHomeCards />);
    // "Getting Started" and "User Guide" have children, "Home" does not
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('User Guide')).toBeInTheDocument();
  });

  it('does not render card for items without children', () => {
    render(<DocsHomeCards />);
    expect(screen.queryByText('Home')).not.toBeInTheDocument();
  });

  it('renders Chinese titles when locale is zh', () => {
    mockLocale = 'zh';
    render(<DocsHomeCards />);
    expect(screen.getByText('快速开始')).toBeInTheDocument();
    expect(screen.getByText('使用指南')).toBeInTheDocument();
  });

  it('renders child count per section', () => {
    render(<DocsHomeCards />);
    expect(screen.getByText('2 pages')).toBeInTheDocument();
    expect(screen.getByText('1 pages')).toBeInTheDocument();
  });

  it('renders Chinese child count when locale is zh', () => {
    mockLocale = 'zh';
    render(<DocsHomeCards />);
    expect(screen.getByText('2 篇')).toBeInTheDocument();
  });

  it('renders links with correct href to first child', () => {
    render(<DocsHomeCards />);
    const gsLink = screen.getByText('Getting Started').closest('a');
    expect(gsLink).toHaveAttribute('href', '/docs/getting-started');
  });

  it('applies custom className', () => {
    const { container } = render(<DocsHomeCards className="my-class" />);
    const grid = container.firstElementChild;
    expect(grid?.className).toContain('my-class');
  });

  it('renders grid layout', () => {
    const { container } = render(<DocsHomeCards />);
    const grid = container.firstElementChild;
    expect(grid?.className).toContain('grid');
  });

  it('renders section description for known sections', () => {
    render(<DocsHomeCards />);
    expect(screen.getByText('Install, configure, and get started')).toBeInTheDocument();
  });

  it('renders Chinese descriptions when locale is zh', () => {
    mockLocale = 'zh';
    render(<DocsHomeCards />);
    expect(screen.getByText('安装、配置、快速上手')).toBeInTheDocument();
  });
});
