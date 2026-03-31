/// <reference types="@testing-library/jest-dom" />

import React from 'react';
import { render, screen } from '@testing-library/react';
import { DocsBreadcrumb } from './docs-breadcrumb';

const mockGetBreadcrumbs = jest.fn();

let mockLocale: 'en' | 'zh' = 'en';
jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ locale: mockLocale, t: (key: string) => key }),
}));

jest.mock('@/lib/docs/navigation', () => ({
  getBreadcrumbs: (...args: unknown[]) => mockGetBreadcrumbs(...args),
}));

jest.mock('next/link', () => {
  type AnchorProps = React.ComponentPropsWithoutRef<'a'> & {
    href: string;
  };

  function MockLink({
    href,
    children,
    ...props
  }: AnchorProps) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('@/components/ui/breadcrumb', () => ({
  Breadcrumb: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <nav data-testid="breadcrumb" {...props}>
      {children}
    </nav>
  ),
  BreadcrumbList: ({ children }: { children: React.ReactNode }) => <ol>{children}</ol>,
  BreadcrumbItem: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <li {...props}>{children}</li>
  ),
  BreadcrumbLink: ({
    asChild,
    children,
    ...props
  }: {
    asChild?: boolean;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    asChild && React.isValidElement<Record<string, unknown>>(children)
      ? React.cloneElement(children, props)
      : <a {...props}>{children}</a>
  ),
  BreadcrumbPage: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <span data-testid="breadcrumb-page" {...props}>
      {children}
    </span>
  ),
  BreadcrumbSeparator: () => <span data-testid="breadcrumb-sep">/</span>,
}));

describe('DocsBreadcrumb', () => {
  beforeEach(() => {
    mockGetBreadcrumbs.mockReset();
    mockLocale = 'en';
  });

  it('renders nothing when there is only one crumb', () => {
    mockGetBreadcrumbs.mockReturnValue([{ title: '文档', titleEn: 'Docs', slug: 'index' }]);

    const { container } = render(<DocsBreadcrumb slug="index" />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('breadcrumb')).not.toBeInTheDocument();
  });

  it('renders links for all but the last crumb, and uses /docs for index slug', () => {
    mockGetBreadcrumbs.mockReturnValue([
      { title: '文档', titleEn: 'Docs', slug: 'index' },
      { title: '开发者', titleEn: 'Development', slug: 'development' },
      { title: '开发环境搭建', titleEn: 'Setup', slug: 'development/setup' },
    ]);

    render(<DocsBreadcrumb slug="development/setup" />);

    const docsLink = screen.getByRole('link', { name: 'Docs' });
    expect(docsLink).toHaveAttribute('href', '/docs');

    const devLink = screen.getByRole('link', { name: 'Development' });
    expect(devLink).toHaveAttribute('href', '/docs/development');

    const last = screen.getByText('Setup');
    expect(last.closest('a')).toBeNull();
    expect(screen.getByTestId('breadcrumb-page')).toHaveTextContent('Setup');

    // separators between items (n-1)
    expect(screen.getAllByTestId('breadcrumb-sep')).toHaveLength(2);
  });

  it('uses Chinese titles when locale is zh', () => {
    mockLocale = 'zh';
    mockGetBreadcrumbs.mockReturnValue([
      { title: '文档', titleEn: 'Docs', slug: 'index' },
      { title: '开发者', titleEn: 'Development', slug: 'development' },
      { title: '开发环境搭建', titleEn: 'Setup', slug: 'development/setup' },
    ]);

    render(<DocsBreadcrumb slug="development/setup" />);

    expect(screen.getByRole('link', { name: '文档' })).toHaveAttribute('href', '/docs');
    expect(screen.getByRole('link', { name: '开发者' })).toHaveAttribute('href', '/docs/development');
    expect(screen.getByText('开发环境搭建')).toBeInTheDocument();
    expect(screen.queryByText('Development')).not.toBeInTheDocument();
  });

  it('falls back to the local title when an English title is unavailable', () => {
    mockGetBreadcrumbs.mockReturnValue([
      { title: '文档', titleEn: 'Docs', slug: 'index' },
      { title: '仅本地标题', slug: 'localized-only' },
    ]);

    render(<DocsBreadcrumb slug="localized-only" />);

    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs');
    expect(screen.getByTestId('breadcrumb-page')).toHaveTextContent('仅本地标题');
  });
});
