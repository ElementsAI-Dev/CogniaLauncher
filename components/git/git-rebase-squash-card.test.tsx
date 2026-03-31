import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitRebaseSquashCard } from './git-rebase-squash-card';

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

describe('GitRebaseSquashCard', () => {
  const createProps = () => ({
    onRebase: jest.fn().mockResolvedValue('rebased'),
    onSquash: jest.fn().mockResolvedValue('squashed'),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows support gating and disables rewrite actions when blocked', () => {
    render(
      <GitRebaseSquashCard
        {...createProps()}
        supportReason="history rewrite unavailable"
      />,
    );

    expect(screen.getByText('history rewrite unavailable')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'git.quickOps.rebase' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'git.quickOps.squash' }),
    ).toBeDisabled();
  });

  it('requires confirmation before rebasing and passes trimmed values when confirmed', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<GitRebaseSquashCard {...props} />);

    await user.type(
      screen.getByPlaceholderText('git.interactiveRebase.basePlaceholder'),
      '  main  ',
    );

    await user.click(screen.getByRole('button', { name: 'git.quickOps.rebase' }));
    await user.click(screen.getByRole('button', { name: 'common.cancel' }));
    expect(props.onRebase).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'git.quickOps.rebase' }));
    await user.click(screen.getByRole('button', { name: 'common.confirm' }));
    await waitFor(() => {
      expect(props.onRebase).toHaveBeenCalledWith('main', true);
    });
  });

  it('rejects invalid squash counts before calling the action', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<GitRebaseSquashCard {...props} />);

    await user.clear(screen.getByPlaceholderText('git.quickOps.countPlaceholder'));
    await user.type(
      screen.getByPlaceholderText('git.quickOps.countPlaceholder'),
      '1',
    );
    await user.type(
      screen.getByPlaceholderText('git.commit.messagePlaceholder'),
      'cleanup',
    );
    await user.click(screen.getByRole('button', { name: 'git.quickOps.squash' }));

    expect(props.onSquash).not.toHaveBeenCalled();
    expect(mockToast.error).toHaveBeenCalledWith('git.quickOps.squashCountInvalid');
  });

  it('passes confirmRisk to squash and surfaces failures through toast', async () => {
    const user = userEvent.setup();
    const props = createProps();

    const { rerender } = render(<GitRebaseSquashCard {...props} />);

    await user.clear(screen.getByPlaceholderText('git.quickOps.countPlaceholder'));
    await user.type(
      screen.getByPlaceholderText('git.quickOps.countPlaceholder'),
      '3',
    );
    await user.type(
      screen.getByPlaceholderText('git.commit.messagePlaceholder'),
      '  combine commits  ',
    );
    await user.click(screen.getByRole('button', { name: 'git.quickOps.squash' }));
    await user.click(screen.getByRole('button', { name: 'common.confirm' }));

    await waitFor(() => {
      expect(props.onSquash).toHaveBeenCalledWith(3, 'combine commits', true);
    });

    rerender(
      <GitRebaseSquashCard
        {...props}
        onSquash={jest.fn().mockRejectedValue(new Error('boom'))}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('git.quickOps.countPlaceholder'), {
      target: { value: '4' },
    });
    fireEvent.change(screen.getByPlaceholderText('git.commit.messagePlaceholder'), {
      target: { value: 'redo' },
    });
    await user.click(screen.getByRole('button', { name: 'git.quickOps.squash' }));
    await user.click(screen.getByRole('button', { name: 'common.confirm' }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error: boom');
    });
  });
});
