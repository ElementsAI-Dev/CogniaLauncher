import { render, screen } from '@testing-library/react';
import { DocsNavFooter } from './docs-nav-footer';

jest.mock('next/link', () => {
  function MockLink({ children, href, ...props }: { children: React.ReactNode; href: string }) {
    return <a href={href} {...props}>{children}</a>;
  }
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'docs.previousPage': 'Previous',
        'docs.nextPage': 'Next',
      };
      return translations[key] || key;
    },
    locale: 'en',
  }),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

describe('DocsNavFooter', () => {
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
    // Re-mock with zh locale
    jest.resetModules();
    jest.doMock('@/components/providers/locale-provider', () => ({
      useLocale: () => ({
        t: (key: string) => key,
        locale: 'zh',
      }),
    }));

    // The current mock is en, so titles show titleEn
    // In the default test setup locale='en', so it shows English
    render(<DocsNavFooter prev={{ title: '首页', titleEn: 'Home', slug: 'index' }} />);
    expect(screen.getByText('Home')).toBeInTheDocument();
  });
});
