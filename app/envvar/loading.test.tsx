import { render, screen } from '@testing-library/react';
import EnvVarLoading from './loading';

jest.mock('@/components/layout/page-loading-skeleton', () => ({
  PageLoadingSkeleton: ({ variant }: { variant: string }) => (
    <div data-testid="envvar-loading-skeleton" data-variant={variant}>
      loading
    </div>
  ),
}));

describe('EnvVarLoading', () => {
  it('renders the tabs loading skeleton', () => {
    render(<EnvVarLoading />);

    expect(screen.getByTestId('envvar-loading-skeleton')).toHaveAttribute('data-variant', 'tabs');
  });
});
