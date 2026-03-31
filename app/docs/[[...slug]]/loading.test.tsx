import { render, screen } from '@testing-library/react';
import DocsLoading from './loading';

jest.mock('@/components/layout/page-loading-skeleton', () => ({
  PageLoadingSkeleton: ({ variant }: { variant: string }) => (
    <div data-testid="page-loading-skeleton" data-variant={variant} />
  ),
}));

describe('DocsLoading', () => {
  it('renders the detail loading skeleton', () => {
    render(<DocsLoading />);

    expect(screen.getByTestId('page-loading-skeleton')).toHaveAttribute('data-variant', 'detail');
  });
});
