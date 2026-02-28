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
        'docs.editOnGithub': 'Edit this page',
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

  it('renders no nav links or edit link when no props', () => {
    const { container } = render(<DocsNavFooter />);
    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit this page')).not.toBeInTheDocument();
    expect(container.querySelector('a[target="_blank"]')).not.toBeInTheDocument();
  });

  it('renders edit on github link when slug is provided', () => {
    render(<DocsNavFooter slug="guide/dashboard" />);
    const editLink = screen.getByText('Edit this page');
    expect(editLink).toBeInTheDocument();
    expect(editLink.closest('a')).toHaveAttribute('href', expect.stringContaining('guide/dashboard.md'));
    expect(editLink.closest('a')).toHaveAttribute('target', '_blank');
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
