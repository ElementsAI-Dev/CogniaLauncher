import React from 'react';
import { render, screen } from '@testing-library/react';
import DocsNotFound from './not-found';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key, locale: 'en', setLocale: jest.fn() }),
}));

jest.mock('next/link', () => {
  function MockLink({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('@/components/ui/button', () => ({
  Button: ({
    asChild,
    children,
    ...props
  }: {
    asChild?: boolean;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (asChild && React.isValidElement(children) ? React.cloneElement(children, props) : <button {...props}>{children}</button>),
}));

describe('DocsNotFound', () => {
  it('renders localized copy and links back to /docs', () => {
    render(<DocsNotFound />);

    expect(screen.getByText('docs.noContent')).toBeInTheDocument();
    expect(screen.getByText('docs.description')).toBeInTheDocument();

    const backLink = screen.getByRole('link', { name: 'docs.backToIndex' });
    expect(backLink).toHaveAttribute('href', '/docs');
  });
});

