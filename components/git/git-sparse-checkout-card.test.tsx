import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitSparseCheckoutCard } from './git-sparse-checkout-card';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, string>) =>
      key.replace('{count}', params?.count ?? ''),
  }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const { toast: mockToast } = jest.requireMock('sonner') as {
  toast: { success: jest.Mock; error: jest.Mock };
};

describe('GitSparseCheckoutCard', () => {
  const createProps = () => ({
    isSparseCheckout: true,
    sparsePatterns: ['src/**'],
    onRefresh: jest.fn().mockResolvedValue(undefined),
    onInit: jest.fn().mockResolvedValue('initialized'),
    onSet: jest.fn().mockResolvedValue('set'),
    onAdd: jest.fn().mockResolvedValue('added'),
    onDisable: jest.fn().mockResolvedValue('disabled'),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows support gating and disables actions when blocked', () => {
    render(
      <GitSparseCheckoutCard
        {...createProps()}
        supportReason="requires sparse-checkout support"
      />,
    );

    expect(
      screen.getByText('requires sparse-checkout support'),
    ).toBeInTheDocument();
    screen
      .getAllByRole('button', { name: 'git.sparseCheckout.init' })
      .forEach((button) => expect(button).toBeDisabled());
    expect(
      screen.getByRole('button', { name: 'git.sparseCheckout.disable' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'git.sparseCheckout.addPattern' }),
    ).toBeDisabled();
  });

  it('wires init, add, set, and disable actions with trimmed patterns', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<GitSparseCheckoutCard {...props} />);

    await user.click(screen.getByRole('checkbox'));
    await user.click(
      screen.getAllByRole('button', { name: 'git.sparseCheckout.init' })[0],
    );
    await waitFor(() => {
      expect(props.onInit).toHaveBeenCalledWith(false);
    });

    await user.type(
      screen.getByPlaceholderText('git.sparseCheckout.patternPlaceholder'),
      '  docs/**  ',
    );
    await user.click(
      screen.getByRole('button', { name: 'git.sparseCheckout.addPattern' }),
    );
    await waitFor(() => {
      expect(props.onAdd).toHaveBeenCalledWith(['docs/**']);
    });

    await user.clear(
      screen.getByPlaceholderText('git.sparseCheckout.patternPlaceholder'),
    );
    await user.type(
      screen.getByPlaceholderText('git.sparseCheckout.patternPlaceholder'),
      '  app/**  ',
    );
    await user.click(screen.getAllByRole('button', { name: 'git.sparseCheckout.init' })[1]);
    await waitFor(() => {
      expect(props.onSet).toHaveBeenCalledWith(['app/**']);
    });

    await user.click(screen.getByRole('button', { name: 'git.sparseCheckout.disable' }));
    await waitFor(() => {
      expect(props.onDisable).toHaveBeenCalled();
    });
  });

  it('renders patterns and surfaces failures through toast', async () => {
    const user = userEvent.setup();
    const props = createProps();

    const { rerender } = render(<GitSparseCheckoutCard {...props} />);
    expect(screen.getByText('src/**')).toBeInTheDocument();

    rerender(
      <GitSparseCheckoutCard
        {...props}
        sparsePatterns={[]}
        onAdd={jest.fn().mockRejectedValue(new Error('boom'))}
      />,
    );
    expect(screen.getByText('git.sparseCheckout.noPatterns')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('git.sparseCheckout.patternPlaceholder'), {
      target: { value: 'tests/**' },
    });
    await user.click(
      screen.getByRole('button', { name: 'git.sparseCheckout.addPattern' }),
    );

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error: boom');
    });
  });
});
