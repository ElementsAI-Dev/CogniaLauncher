import { render, screen } from '@testing-library/react';
import { DocsNavFooter } from './docs-nav-footer';

jest.mock('next/link', () => {
  function MockLink({ children, href, ...props }: { children: React.ReactNode; href: string }) {
    return <a href={href} {...props}>{children}</a>;
  }
  MockLink.displayName = 'MockLink';
  return MockLink;
});

let mockLocale = 'en';
jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'docs.previousPage': 'Previous',
        'docs.nextPage': 'Next',
      };
      return translations[key] || key;
    },
    locale: mockLocale,
  }),
}));

jest.mock('@/components/ui/button', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Button: ({ children, asChild, ...props }: { children: React.ReactNode; asChild?: boolean; [key: string]: unknown }) => (
    <button {...props}>{children}</button>
  ),
}));

describe('DocsNavFooter', () => {
  beforeEach(() => {
    mockLocale = 'en';
  });

  it('renders nothing when no prev or next', () => {
    const { container } = render(<DocsNavFooter />);
    expect(container.firstChild).toBeNull();
  });

  it('renders previous link', () => {
    render(<DocsNavFooter prev={{ title: '首页', titleEn: 'Home', slug: 'index' }} />);
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('renders next link', () => {
    render(<DocsNavFooter next={{ title: '安装', titleEn: 'Installation', slug: 'getting-started/installation' }} />);
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText('Installation')).toBeInTheDocument();
  });

  it('renders both prev and next', () => {
    render(
      <DocsNavFooter
        prev={{ title: '首页', titleEn: 'Home', slug: 'index' }}
        next={{ title: '安装', titleEn: 'Installation', slug: 'getting-started/installation' }}
      />
    );
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Installation')).toBeInTheDocument();
  });

  it('generates correct href for index slug', () => {
    render(<DocsNavFooter prev={{ title: '首页', titleEn: 'Home', slug: 'index' }} />);
    const link = screen.getByText('Home').closest('a');
    expect(link).toHaveAttribute('href', '/docs');
  });

  it('generates correct href for nested slug', () => {
    render(<DocsNavFooter next={{ title: '安装', titleEn: 'Installation', slug: 'getting-started/installation' }} />);
    const link = screen.getByText('Installation').closest('a');
    expect(link).toHaveAttribute('href', '/docs/getting-started/installation');
  });

  it('uses Chinese title when locale is zh', () => {
    mockLocale = 'zh';
    render(<DocsNavFooter prev={{ title: '首页', titleEn: 'Home', slug: 'index' }} />);
    expect(screen.getByText('首页')).toBeInTheDocument();
  });

  it('falls back to title when titleEn is missing and locale is en', () => {
    mockLocale = 'en';
    render(<DocsNavFooter prev={{ title: '首页', slug: 'index' }} />);
    expect(screen.getByText('首页')).toBeInTheDocument();
  });
});
